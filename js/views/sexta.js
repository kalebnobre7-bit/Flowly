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
  const activeGoals = Array.isArray(sextaState.goals) ? sextaState.goals.slice(0, 4) : [];
  const recentEpisodes = Array.isArray(sextaState.episodeSummaries)
    ? sextaState.episodeSummaries.slice(0, 4)
    : [];
  const capabilityBacklog = Array.isArray(sextaState.capabilityBacklog)
    ? sextaState.capabilityBacklog.slice(0, 4)
    : [];
  const profile = getSextaProfile();
  const profileSummary = getSextaProfileSummary(profile);
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
  const memoryStatus = memories.length > 0 ? `${memories.length} memoria(s) salvas` : 'memoria livre';
  const profileStatus = profileSummary ? 'briefing operacional ativo' : 'sem briefing fixo';
  const statPills = [
    { label: 'Hoje', value: `${pending} abertas`, detail: `${completed}/${total} concluídas` },
    { label: 'Caixa', value: String(snapshot.moneyEntries.length), detail: 'tarefas puxando receita' },
    { label: 'Projetos', value: String(snapshot.activeProjects.length), detail: `${snapshot.lateProjects.length} em risco` },
    { label: 'Semana', value: `${weekRate}%`, detail: `${weekCompleted}/${weekTotal} concluídas` }
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
    { label: 'Criar', prompt: 'cria tarefa cobrar cliente antigo' },
    { label: 'Concluir', prompt: 'conclui a tarefa fechar pacote de thumbs com a Jess' },
    { label: 'Mover', prompt: 'move a tarefa fechar pacote de thumbs com a Jess para amanha' },
    { label: 'Apagar', prompt: 'apaga a tarefa follow-up em geral' },
    { label: 'Foco', prompt: 'o que eu ataco agora?' }
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

        <div class="sexta-panel-block sexta-panel-block--soft">
          <div class="sexta-panel-label">Objetivos ativos</div>
          <div class="sexta-log-list">
            ${activeGoals.length > 0
              ? activeGoals
                  .map(
                    (goal) => `<div class="sexta-log-item"><strong>${escapeProjectHtml(goal.title)}</strong><span>${escapeProjectHtml(goal.why || goal.status || 'ativo')}</span></div>`
                  )
                  .join('')
              : '<div class="sexta-log-item"><strong>vazio</strong><span>Nenhum objetivo ativo registrado ainda.</span></div>'}
          </div>
        </div>
      </section>
    `;
  } else if (activeTab === 'memory') {
    secondaryPanel = `
      <section class="sexta-card sexta-secondary-panel">
        <div class="sexta-card-head sexta-card-head--compact">
          <div>
            <h3>Memoria operacional</h3>
            <p>Configure o comportamento da Sexta e deixe o chat alinhado com a sua forma de operar.</p>
          </div>
          <button class="sexta-link-btn" type="button" data-sexta-command-action="clear-memory">Limpar memoria</button>
        </div>

        <section class="sexta-memory-config">
          <div class="sexta-memory-config-head">
            <div>
              <span class="sexta-panel-label">Perfil fixo</span>
              <strong>Briefing e comandos da assistente</strong>
            </div>
            <button class="btn-primary sexta-config-save" type="button" data-sexta-profile-action="save">Salvar briefing</button>
          </div>
          <div class="sexta-config-grid">
            <label class="sexta-config-field">
              <span>Memorias fixas</span>
              <textarea id="sextaMemoryProfileInput" rows="3" placeholder="Ex.: priorizar tarefas que puxam caixa pela manha.">${escapeProjectHtml(
                profile.memoryNotes
              )}</textarea>
            </label>
            <label class="sexta-config-field">
              <span>Regras da Sexta</span>
              <textarea id="sextaOperatorRulesInput" rows="3" placeholder="Ex.: responder curto, apontar risco e propor 1 proximo passo.">${escapeProjectHtml(
                profile.operatorRules
              )}</textarea>
            </label>
            <label class="sexta-config-field sexta-config-field--wide">
              <span>Comandos e formato</span>
              <textarea id="sextaCommandStyleInput" rows="3" placeholder="Ex.: quando eu disser foco, responder com prioridade, gargalo e acao.">${escapeProjectHtml(
                profile.commandStyle
              )}</textarea>
            </label>
            <label class="sexta-config-field sexta-config-field--wide">
              <span>Loop e autonomia</span>
              <textarea id="sextaAutonomyModeInput" rows="3" placeholder="Ex.: pode consultar tarefas, projetos, financas e agir em ate 2 passos antes de responder.">${escapeProjectHtml(
                profile.autonomyMode || ''
              )}</textarea>
            </label>
          </div>
          <div class="sexta-panel-caption">${
            profileSummary
              ? escapeProjectHtml(profileSummary)
              : 'Sem briefing salvo ainda. Use esse bloco para deixar tom, regras e comandos da IA mais previsiveis.'
          }</div>
        </section>

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

        <div class="sexta-panel-block sexta-panel-block--soft">
          <div class="sexta-panel-label">Memoria episodica</div>
          <div class="sexta-log-list">
            ${recentEpisodes.length > 0
              ? recentEpisodes
                  .map(
                    (episode) => `<div class="sexta-log-item"><strong>${escapeProjectHtml(episode.channel || 'app')}</strong><span>${escapeProjectHtml(episode.summary || '')}</span></div>`
                  )
                  .join('')
              : '<div class="sexta-log-item"><strong>vazio</strong><span>Nenhum episodio resumido ainda.</span></div>'}
          </div>
        </div>

        <div class="sexta-panel-block sexta-panel-block--soft">
          <div class="sexta-panel-label">Capacidades em evolucao</div>
          <div class="sexta-log-list">
            ${capabilityBacklog.length > 0
              ? capabilityBacklog
                  .map(
                    (item) => `<div class="sexta-log-item"><strong>${escapeProjectHtml(item.title)}</strong><span>${escapeProjectHtml(item.description || item.status || 'proposto')}</span></div>`
                  )
                  .join('')
              : '<div class="sexta-log-item"><strong>vazio</strong><span>Nenhuma melhoria sugerida ainda.</span></div>'}
          </div>
        </div>
      </section>
    `;
  }

  view.innerHTML = `
    <div class="flowly-shell flowly-shell--wide sexta-shell sexta-shell--chatfirst">
      <section class="sexta-topbar flowly-page-header">
        <div class="sexta-topbar-copy">
          <div class="sexta-kicker flowly-page-kicker">Sexta</div>
          <h2 class="flowly-page-title">Sexta</h2>
          <p class="flowly-page-subtitle">Chat local para decidir, registrar e mover o que importa agora.</p>
        </div>
        <div class="sexta-topbar-actions flowly-page-actions">
          <span class="flowly-status-chip">${escapeProjectHtml(assistantModeLabel)}</span>
          <button class="btn-secondary btn-inline sexta-link-btn" type="button" data-sexta-open-settings="ia">Conectar IA</button>
        </div>
      </section>

      ${activeTab === 'chat' ? '' : `<div class="sexta-stats-strip">${statPills}</div>`}

      <section class="sexta-mode-bar sexta-card">
        <div class="sexta-mode-bar-copy">
          <div class="sexta-panel-label">Modo da assistente</div>
          <p>Use chat para agir, contexto para diagnosticar e memória para fixar o comportamento.</p>
        </div>
        <div class="sexta-tabs sexta-tabs--compact">
          ${tabButtons}
        </div>
      </section>

      <div class="sexta-workspace${secondaryPanel ? ' sexta-workspace--split' : ''}">
      <section class="sexta-card sexta-chat-stage">
        <div class="sexta-chat-stage-head">
          <div>
            <h3>Sala de operação</h3>
            <p>${escapeProjectHtml(assistantHint)}</p>
          </div>
          <div class="sexta-chat-stage-status">
            <div class="sexta-chat-stage-stat">
              <span>Operação</span>
              <strong>${escapeProjectHtml(`${memoryStatus} • ${profileStatus}`)}</strong>
            </div>
          </div>
        </div>

        <div class="sexta-chat-thread">
          ${history
            .map((item) => {
              const roleClass = item.role === 'user' ? 'human' : 'ai';
              const author = item.role === 'user' ? 'Voce' : 'Sexta';
              const token = item.role === 'user' ? 'V' : 'S';
              return `
                <article class="sexta-chat-row ${roleClass}">
                  <div class="sexta-chat-line ${roleClass}">
                    <span class="sexta-chat-token ${roleClass}">${token}</span>
                    <div class="sexta-chat-content">
                      <div class="sexta-chat-author">${author}</div>
                      <div class="sexta-chat-bubble ${roleClass}">
                        <div>${escapeProjectHtml(item.text)}</div>
                        ${item.meta ? `<span class="sexta-chat-meta">${escapeProjectHtml(item.meta)}</span>` : ''}
                      </div>
                    </div>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>

        <div class="sexta-dock-grid">
          <div class="sexta-action-dock">
            <div class="sexta-action-dock-head">
              <span class="sexta-panel-label">Ações rápidas</span>
              <span class="sexta-action-dock-note">toque para preencher o comando</span>
            </div>
            <div class="sexta-quick-actions sexta-quick-actions--minimal">
              ${quickCommands}
            </div>
          </div>

          <div class="sexta-composer-card">
            <div class="sexta-composer-head">
              <span class="sexta-panel-label">Comando</span>
              <span class="sexta-composer-hint">Enter envia. Use verbos curtos e objetivos.</span>
            </div>
            <div class="sexta-command-row sexta-command-row--composer">
              <input id="sextaCommandInput" class="task-input sexta-command-input" type="text" placeholder="Ex.: cria tarefa cobrar cliente, conclui follow-up, move site para amanha, o que eu ataco agora?" />
              <button class="btn-primary btn-inline" type="button" data-sexta-command-action="send">Enviar</button>
            </div>
          </div>
        </div>
      </section>

      ${secondaryPanel}
      </div>
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
    view.querySelectorAll('[data-sexta-profile-action]').forEach((btn) => {
      btn.onclick = async () => {
        if ((btn.dataset.sextaProfileAction || '') !== 'save') return;
        const memoryNotes = document.getElementById('sextaMemoryProfileInput');
        const operatorRules = document.getElementById('sextaOperatorRulesInput');
        const commandStyle = document.getElementById('sextaCommandStyleInput');
        const autonomyMode = document.getElementById('sextaAutonomyModeInput');
        const nextProfile = saveSextaProfile({
          memoryNotes: memoryNotes ? memoryNotes.value : '',
          operatorRules: operatorRules ? operatorRules.value : '',
          commandStyle: commandStyle ? commandStyle.value : '',
          autonomyMode: autonomyMode ? autonomyMode.value : ''
        });
        try {
          if (typeof saveSextaProfileToServer === 'function') {
            await saveSextaProfileToServer(nextProfile);
          }
        } catch (_) {}
        pushSextaNote('perfil', 'Briefing da Sexta atualizado.');
        persistSextaState();
        renderSextaView();
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
    if (typeof syncSextaServerState === 'function') {
      syncSextaServerState();
    }
  }, 0);
};
