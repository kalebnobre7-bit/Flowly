// renderSextaView movido de js/app.js

function getSextaDayTaskStats(dateStr) {
  const metricsApi = window.FlowlyTaskMetrics || {};
  const countTasks = metricsApi.countDayTasks || window.countDayTasks;
  if (typeof countTasks === 'function') return countTasks(dateStr);
  return { total: 0, completed: 0 };
}

renderSextaView = function () {
  const view = document.getElementById('sextaView');
  if (!view) return;

  const aiSettings = getFlowlyAISettings();
  const snapshot = getSextaOperationalSnapshot();
  const activeTabRaw = String(sextaState.activeTab || 'chat').trim() || 'chat';
  const activeTab = activeTabRaw === 'command' ? 'context' : activeTabRaw;
  if (sextaState.activeTab !== activeTab) {
    sextaState.activeTab = activeTab;
    persistSextaState();
  }

  const { total, completed } = getSextaDayTaskStats(snapshot.todayDate);
  const pending = Math.max(0, total - completed);
  const weekDates = getWeekDates(0);
  let weekTotal = 0;
  let weekCompleted = 0;
  weekDates.forEach(({ dateStr }) => {
    const stats = getSextaDayTaskStats(dateStr);
    weekTotal += stats.total;
    weekCompleted += stats.completed;
  });

  const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;
  const bottleneckLabel =
    snapshot.moneyEntries.length > 0
      ? 'Caixa pedindo acao agora.'
      : snapshot.followupEntries.length > 0
        ? 'Follow-up aberto pedindo resposta.'
        : snapshot.pendingEntries.length > 5
          ? 'Tem frente demais aberta ao mesmo tempo.'
          : 'Fluxo sob controle.';
  const primaryMoneyTask =
    snapshot.moneyEntries[0]?.task?.text || 'Nenhuma tarefa de dinheiro puxando a fila.';
  const primaryFollowupTask =
    snapshot.followupEntries[0]?.task?.text || 'Nenhum follow-up pedindo retorno agora.';
  const suggestions = buildSextaSuggestions().slice(0, 3);
  const notes = Array.isArray(sextaState.notes) ? sextaState.notes.slice().reverse().slice(0, 4) : [];
  const latestIaNote = notes.find((note) => note.action === 'ia');
  const memories = getSextaMemories().slice().reverse();
  const history =
    Array.isArray(sextaState.chatHistory) && sextaState.chatHistory.length > 0
      ? sextaState.chatHistory.slice(-10)
      : [
          {
            id: 'seed_ai_1',
            role: 'assistant',
            text: 'Me chama aqui para decidir prioridade, criar tarefa, concluir, mover ou apagar sem sair do Flowly.',
            meta: aiSettings.enabled && aiSettings.provider !== 'local' ? 'chat pronto' : 'modo local'
          }
        ];

  const assistantModeLabel =
    aiSettings.enabled && aiSettings.provider !== 'local'
      ? `${aiSettings.provider} · ${aiSettings.model || 'modelo externo'}`
      : 'modo local Flowly';
  const assistantHint = latestIaNote
    ? 'O conector externo falhou agora, entao a resposta voltou para o modo local.'
    : aiSettings.enabled && aiSettings.provider !== 'local'
      ? 'Chat conectado. Quando a IA externa falhar, a Sexta responde com os dados locais.'
      : 'Chat local, lendo tarefas, projetos e foco direto do Flowly.';
  const statPills = [
    { label: 'Hoje', value: `${pending} abertas`, detail: `${completed}/${total} concluidas` },
    { label: 'Caixa', value: String(snapshot.moneyEntries.length), detail: 'tarefas puxando receita' },
    { label: 'Projetos', value: String(snapshot.activeProjects.length), detail: `${snapshot.lateProjects.length} em risco` },
    { label: 'Semana', value: `${weekRate}%`, detail: `${weekCompleted}/${weekTotal} concluidas` }
  ]
    .map(
      (item) => `
        <article class="sexta-stat-pill-card">
          <span class="sexta-panel-label">${item.label}</span>
          <strong>${escapeProjectHtml(item.value)}</strong>
          <span>${escapeProjectHtml(item.detail)}</span>
        </article>
      `
    )
    .join('');
  const tabButtons = [
    { id: 'chat', label: 'Chat' },
    { id: 'context', label: 'Contexto' },
    { id: 'memory', label: 'Memoria' }
  ]
    .map(
      (tab) =>
        `<button type="button" class="sexta-tab-btn${activeTab === tab.id ? ' is-active' : ''}" data-sexta-tab="${tab.id}">${tab.label}</button>`
    )
    .join('');
  const quickCommands = [
    { label: 'criar tarefa', prompt: 'cria tarefa cobrar cliente antigo' },
    { label: 'concluir tarefa', prompt: 'conclui a tarefa fechar pacote de thumbs com a Jess' },
    { label: 'mover para amanha', prompt: 'move a tarefa fechar pacote de thumbs com a Jess para amanha' },
    { label: 'apagar tarefa', prompt: 'apaga a tarefa follow-up em geral' },
    { label: 'analisar foco', prompt: 'o que eu ataco agora?' }
  ]
    .map(
      (item) =>
        `<button type="button" class="sexta-chip" data-sexta-prompt="${escapeProjectHtml(item.prompt)}">${escapeProjectHtml(item.label)}</button>`
    )
    .join('');

  let secondaryPanel = '';
  if (activeTab === 'context') {
    secondaryPanel = `
      <section class="sexta-card sexta-secondary-panel">
        <div class="sexta-card-head sexta-card-head--compact">
          <div>
            <h3>Contexto</h3>
            <p>Leitura curta do que importa agora, sem roubar foco do chat.</p>
          </div>
        </div>

        <div class="sexta-secondary-grid">
          <article class="sexta-secondary-card">
            <span class="sexta-panel-label">Leitura do dia</span>
            <strong>${escapeProjectHtml(bottleneckLabel)}</strong>
            <p>${escapeProjectHtml(sextaState.lastAction || buildSextaAssistantReply('o que eu ataco agora'))}</p>
          </article>
          <article class="sexta-secondary-card">
            <span class="sexta-panel-label">Caixa em aberto</span>
            <strong>${snapshot.moneyEntries.length}</strong>
            <p>${escapeProjectHtml(primaryMoneyTask)}</p>
          </article>
          <article class="sexta-secondary-card">
            <span class="sexta-panel-label">Projetos</span>
            <strong>${snapshot.activeProjects.length}</strong>
            <p>${snapshot.activeProjects[0] ? escapeProjectHtml(snapshot.activeProjects[0].name) : 'Nenhum projeto ativo agora.'}</p>
          </article>
          <article class="sexta-secondary-card">
            <span class="sexta-panel-label">Follow-up</span>
            <strong>${snapshot.followupEntries.length}</strong>
            <p>${escapeProjectHtml(primaryFollowupTask)}</p>
          </article>
        </div>

        <div class="sexta-inline-actions">
          <button class="sexta-link-btn" type="button" data-sexta-quick-action="focus">Puxar foco</button>
          <button class="sexta-link-btn" type="button" data-sexta-quick-action="review">Revisar hoje</button>
          <button class="sexta-link-btn" type="button" data-sexta-quick-action="tomorrow">Planejar amanha</button>
          <button class="sexta-link-btn" type="button" data-sexta-quick-action="plan">Criar base</button>
        </div>

        <div class="sexta-list sexta-list--compact">
          ${suggestions
            .map(
              (item) => `<div class="sexta-list-item"><span class="sexta-dot"></span><div><strong>${escapeProjectHtml(item.title)}</strong><p>${escapeProjectHtml(item.body)}</p></div></div>`
            )
            .join('')}
        </div>

        ${latestIaNote ? `
          <div class="sexta-panel-block sexta-panel-block--soft">
            <div class="sexta-panel-label">IA</div>
            <div class="sexta-panel-highlight">${escapeProjectHtml(latestIaNote.text)}</div>
          </div>
        ` : ''}

        <div class="sexta-panel-block sexta-panel-block--soft">
          <div class="sexta-panel-label">Log recente</div>
          <div class="sexta-log-list">
            ${notes.length > 0
              ? notes
                  .map(
                    (note) => `<div class="sexta-log-item"><strong>${escapeProjectHtml(note.action)}</strong><span>${escapeProjectHtml(note.text)}</span></div>`
                  )
                  .join('')
              : '<div class="sexta-log-item"><strong>vazio</strong><span>Nenhuma acao registrada ainda.</span></div>'}
          </div>
        </div>
      </section>
    `;
  } else if (activeTab === 'memory') {
    secondaryPanel = `
      <section class="sexta-card sexta-secondary-panel">
        <div class="sexta-card-head sexta-card-head--compact">
          <div>
            <h3>Memoria</h3>
            <p>Preferencias operacionais e comandos que o agente deve lembrar.</p>
          </div>
          <button class="sexta-link-btn" type="button" data-sexta-command-action="clear-memory">Limpar memoria</button>
        </div>

        <div class="sexta-memory-guide sexta-memory-guide--inline">
          <div><strong>Salvar</strong><span>lembra que eu prefiro atacar dinheiro pela manha</span></div>
          <div><strong>Consultar</strong><span>o que voce lembra?</span></div>
          <div><strong>Apagar</strong><span>esquecer prefiro atacar dinheiro pela manha</span></div>
        </div>

        <div class="sexta-memory-list">
          ${
            memories.length > 0
              ? memories
                  .map(
                    (item) => `
                      <article class="sexta-memory-item">
                        <div class="sexta-memory-text">${escapeProjectHtml(item.text)}</div>
                        <div class="sexta-memory-meta">${escapeProjectHtml(item.source || 'manual')} · ${new Date(item.createdAt).toLocaleDateString('pt-BR')}</div>
                      </article>
                    `
                  )
                  .join('')
              : '<div class="sexta-log-item"><strong>vazio</strong><span>Nenhuma memoria salva ainda.</span></div>'
          }
        </div>
      </section>
    `;
  }

  view.innerHTML = `
    <div class="flowly-shell flowly-shell--wide sexta-shell sexta-shell--chatfirst">
      <section class="sexta-topbar">
        <div class="sexta-topbar-copy">
          <div class="sexta-kicker">Sexta</div>
          <h2>Assistente operacional do Flowly</h2>
          <p>Chat para conversar, criar tarefa, concluir, mover, apagar e revisar o que esta acontecendo agora.</p>
        </div>
        <div class="sexta-topbar-actions">
          <span class="sexta-badge">${escapeProjectHtml(assistantModeLabel)}</span>
          <button class="sexta-link-btn" type="button" data-sexta-open-settings="ia">Conectar IA</button>
        </div>
      </section>

      <div class="sexta-stats-strip">
        ${statPills}
      </div>

      <div class="sexta-tabs sexta-tabs--compact">
        ${tabButtons}
      </div>

      <section class="sexta-card sexta-chat-stage">
        <div class="sexta-chat-stage-head">
          <div>
            <h3>Chat</h3>
            <p>${escapeProjectHtml(assistantHint)}</p>
          </div>
        </div>

        <div class="sexta-chat-thread">
          ${history
            .map((item) => {
              const roleClass = item.role === 'user' ? 'human' : 'ai';
              const author = item.role === 'user' ? 'Voce' : 'Sexta';
              return `
                <article class="sexta-chat-row ${roleClass}">
                  <div class="sexta-chat-author">${author}</div>
                  <div class="sexta-chat-bubble ${roleClass}">
                    <div>${escapeProjectHtml(item.text)}</div>
                    ${item.meta ? `<span class="sexta-chat-meta">${escapeProjectHtml(item.meta)}</span>` : ''}
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>

        <div class="sexta-quick-actions sexta-quick-actions--minimal">
          ${quickCommands}
        </div>

        <div class="sexta-command-row sexta-command-row--composer">
          <input id="sextaCommandInput" class="task-input sexta-command-input" type="text" placeholder="Ex.: cria tarefa cobrar cliente, conclui follow-up, move site para amanha, o que eu ataco agora?" />
          <button class="btn-primary" type="button" data-sexta-command-action="send">Enviar</button>
        </div>
      </section>

      ${secondaryPanel}
    </div>
  `;

  setTimeout(() => {
    view.querySelectorAll('[data-sexta-tab]').forEach((btn) => {
      btn.onclick = () => {
        sextaState.activeTab = btn.dataset.sextaTab || 'chat';
        persistSextaState();
        renderSextaView();
      };
    });
    view.querySelectorAll('[data-sexta-prompt]').forEach((btn) => {
      btn.onclick = () => {
        const input = document.getElementById('sextaCommandInput');
        if (!input) return;
        input.value = btn.dataset.sextaPrompt || '';
        input.focus();
      };
    });
    view.querySelectorAll('[data-sexta-quick-action]').forEach((btn) => {
      btn.onclick = () => {
        const action = btn.dataset.sextaQuickAction;
        if (action) runSextaQuickAction(action);
      };
    });
    view.querySelectorAll('[data-sexta-open-settings]').forEach((btn) => {
      btn.onclick = () => {
        const tabId = btn.dataset.sextaOpenSettings || 'ia';
        openFlowlySettingsTab(tabId);
      };
    });
    view.querySelectorAll('[data-sexta-command-action]').forEach((btn) => {
      btn.onclick = () => {
        const action = btn.dataset.sextaCommandAction;
        const input = document.getElementById('sextaCommandInput');
        if (action === 'clear-memory') {
          if (input) input.value = 'limpar memoria';
          runSextaCommand();
          return;
        }
        if (action === 'send') runSextaCommand();
      };
    });
    const input = document.getElementById('sextaCommandInput');
    if (input) {
      input.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          runSextaCommand();
        }
      };
    }
    const thread = view.querySelector('.sexta-chat-thread');
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, 0);
};

