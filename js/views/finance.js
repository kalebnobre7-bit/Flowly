// renderFinanceView movido de js/app.js

function renderFinanceView() {
  const view = document.getElementById('financeView');
  if (!view) return;

  const analytics = buildFinanceAnalytics();
  const sourceHint = analytics.imports[0]
    ? `Último import da Sexta: ${new Date(analytics.imports[0].importedAt).toLocaleString('pt-BR')}`
    : 'Quando você mandar print do extrato pra Sexta, isso vai cair aqui organizado.';

  const expenseShare = analytics.expenseTotal > 0
    ? analytics.topExpenseCategories.map((item) => ({ ...item, share: Math.round((item.amount / analytics.expenseTotal) * 100) }))
    : [];
  const incomeShare = analytics.incomeTotal > 0
    ? analytics.topIncomeSources.map((item) => ({ ...item, share: Math.round((item.amount / analytics.incomeTotal) * 100) }))
    : [];

  view.innerHTML = `
    <div class="flowly-shell flowly-shell--wide finance-shell finance-shell--rebuilt finance-shell--premium">
      <section class="finance-dashboard-hero">
        <div class="finance-hero-copy flowly-page-header">
          <div class="finance-kicker flowly-page-kicker">Finance intelligence</div>
          <h2 class="flowly-page-title">Financeiro claro, acionável e sem ruído</h2>
          <p class="flowly-page-subtitle">${analytics.analysisTone}</p>
          <div class="finance-inline-pills">
            <span class="sexta-pill">${analytics.monthTransactionCount} movimentações</span>
            <span class="sexta-pill sexta-pill--soft">${sourceHint}</span>
          </div>
        </div>
        <div class="finance-kpi-strip">
          <div class="finance-kpi-spot finance-kpi-spot--income">
            <span>Entradas</span>
            <strong>${analytics.formatBRL(analytics.incomeTotal)}</strong>
            <small>${analytics.incomeCount} entrada(s) • ticket médio ${analytics.formatBRL(analytics.avgTicketIn)}</small>
          </div>
          <div class="finance-kpi-spot finance-kpi-spot--expense">
            <span>Saídas</span>
            <strong>${analytics.formatBRL(analytics.expenseTotal)}</strong>
            <small>${analytics.expenseCount} saída(s) • ticket médio ${analytics.formatBRL(analytics.avgTicketOut)}</small>
          </div>
          <div class="finance-kpi-spot finance-kpi-spot--balance">
            <span>Saldo do mês</span>
            <strong>${analytics.formatBRL(analytics.balance)}</strong>
            <small>${analytics.balance >= 0 ? 'Operação no azul.' : 'Operação pressionada pelo gasto.'}</small>
          </div>
        </div>
      </section>

      <section class="finance-grid finance-grid--topline">
        <section class="finance-card finance-card--chart finance-card--hero-chart">
          <div class="finance-card-head finance-card-head--dense">
            <div>
              <h3>Fluxo do mês</h3>
              <p>Entradas vs saídas, sem ruído.</p>
            </div>
          </div>
          <div class="finance-chart-wrap finance-chart-wrap--lg">
            ${analytics.chartLabels.length > 0 ? '<canvas id="financeCashflowChart"></canvas>' : '<div class="finance-empty">Ainda não há transações suficientes para desenhar o gráfico.</div>'}
          </div>
        </section>

        <section class="finance-card finance-card--analysis">
          <div class="finance-card-head finance-card-head--dense">
            <div>
              <h3>Mapa rápido</h3>
              <p>Só os sinais que importam.</p>
            </div>
          </div>
          <div class="finance-mini-stack">
            <div class="finance-mini-card">
              <span>Principal origem</span>
              <strong>${incomeShare[0] ? incomeShare[0].label : 'Sem entradas ainda'}</strong>
              <small>${incomeShare[0] ? `${analytics.formatBRL(incomeShare[0].amount)} • ${incomeShare[0].share}% das entradas` : 'Ainda sem base suficiente.'}</small>
            </div>
            <div class="finance-mini-card finance-mini-card--warn">
              <span>Maior vazamento</span>
              <strong>${expenseShare[0] ? expenseShare[0].label : 'Sem saídas ainda'}</strong>
              <small>${expenseShare[0] ? `${analytics.formatBRL(expenseShare[0].amount)} • ${expenseShare[0].share}% das saídas` : 'Ainda sem base suficiente.'}</small>
            </div>
            <div class="finance-mini-card">
              <span>Import da Sexta</span>
              <strong>${analytics.imports[0] ? analytics.imports[0].transactionCount + ' itens' : 'Nenhum import'}</strong>
              <small>${analytics.imports[0] ? new Date(analytics.imports[0].importedAt).toLocaleString('pt-BR') : 'Sem extrato carregado.'}</small>
            </div>
          </div>
          <div class="finance-chart-wrap finance-chart-wrap--donut">
            ${Object.keys(analytics.categoryTotals).length > 0 ? '<canvas id="financeCategoryChart"></canvas>' : '<div class="finance-empty">Sem categorias registradas ainda.</div>'}
          </div>
          <div class="finance-legend-grid">
            ${expenseShare.slice(0, 4).map((item, index) => `
              <div class="finance-legend-item">
                <span class="finance-legend-dot finance-legend-dot--${index + 1}"></span>
                <div>
                  <strong>${item.label}</strong>
                  <small>${item.share}% das saídas</small>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </section>

      <section class="finance-grid finance-grid--insights">
        <section class="finance-card">
          <div class="finance-card-head finance-card-head--dense">
            <div>
              <h3>De onde vem a grana</h3>
              <p>Entradas detalhadas pelo nome real de quem pagou ou da origem do valor.</p>
            </div>
          </div>
          <div class="finance-breakdown-list">
            ${incomeShare.length > 0 ? incomeShare.map((item) => `
              <div class="finance-breakdown-item finance-breakdown-item--income">
                <div class="finance-breakdown-head">
                  <strong>${item.label}</strong>
                  <span>${analytics.formatBRL(item.amount)}</span>
                </div>
                <div class="finance-breakdown-bar"><span style="width:${Math.max(item.share, 6)}%"></span></div>
                <small>${item.share}% das entradas • ${item.count || 1} lançamento(s) • ${item.category || 'Receita'}</small>
              </div>
            `).join('') : '<div class="finance-empty">Sem entradas registradas ainda.</div>'}
          </div>
        </section>

        <section class="finance-card">
          <div class="finance-card-head finance-card-head--dense">
            <div>
              <h3>Pra onde sai a grana</h3>
              <p>O que mais está puxando teu caixa.</p>
            </div>
          </div>
          <div class="finance-breakdown-list">
            ${expenseShare.length > 0 ? expenseShare.map((item) => `
              <div class="finance-breakdown-item finance-breakdown-item--expense">
                <div class="finance-breakdown-head">
                  <strong>${item.label}</strong>
                  <span>${analytics.formatBRL(item.amount)}</span>
                </div>
                <div class="finance-breakdown-bar"><span style="width:${Math.max(item.share, 6)}%"></span></div>
                <small>${item.share}% das saídas</small>
              </div>
            `).join('') : '<div class="finance-empty">Sem saídas registradas ainda.</div>'}
          </div>
        </section>
      </section>

      <section class="finance-grid finance-grid--lists">
        <section class="finance-card">
          <div class="finance-card-head finance-card-head--dense">
            <div>
              <h3>Movimentações recentes</h3>
              <p>Leitura limpa do que aconteceu agora.</p>
            </div>
          </div>
          <div class="finance-list finance-list--compact">
            ${analytics.recentTransactions.length > 0 ? analytics.recentTransactions.map((item) => `
              <div class="finance-list-item ${item.type === 'income' ? 'finance-list-item--done' : ''}">
                <div>
                  <strong>${item.description}</strong>
                  <p>${item.date} • ${item.category}${item.taskText ? ` • ${item.taskText}` : ''}</p>
                </div>
                <span>${item.type === 'expense' ? '-' : '+'}${analytics.formatBRL(item.amount)}</span>
              </div>
            `).join('') : '<div class="finance-empty">Ainda não há movimentações registradas nesse painel.</div>'}
          </div>
        </section>

        <section class="finance-card">
          <div class="finance-card-head finance-card-head--dense">
            <div>
              <h3>Receita ligada a trabalho</h3>
              <p>Receitas já conectadas a trabalho real.</p>
            </div>
          </div>
          <div class="finance-list finance-list--compact">
            ${analytics.linkedTasks.length > 0 ? analytics.linkedTasks.map((item) => `
              <div class="finance-list-item finance-list-item--done finance-list-item--stacked">
                <div>
                  <strong>${item.taskText}</strong>
                  <p>${item.count} lançamento(s) vinculados • último em ${item.lastDate}</p>
                </div>
                <span>${analytics.formatBRL(item.total)}</span>
              </div>
            `).join('') : '<div class="finance-empty">Ainda não existem entradas vinculadas a tarefas. Esse bloco vai ficar brutal quando você começar a relacionar receita com trabalho.</div>'}
          </div>
        </section>
      </section>

      <section class="finance-grid finance-grid--bottom">
        <section class="finance-card finance-card--form">
          <div class="finance-card-head finance-card-head--dense">
            <div>
              <h3>Lançar movimentação</h3>
              <p>Lançamento manual limpo e direto.</p>
            </div>
          </div>
          <div class="finance-form-grid">
            <select id="financeEntryType" class="finance-input">
              <option value="income">Entrada</option>
              <option value="expense">Saída</option>
            </select>
            <input id="financeEntryAmount" class="finance-input" type="number" min="0" step="0.01" placeholder="Valor">
            <input id="financeEntryDate" class="finance-input" type="date" value="${localDateStr()}">
            <input id="financeEntryCategory" class="finance-input" type="text" placeholder="Categoria (ex: Cliente, Ferramenta, Tráfego)">
            <input id="financeEntryDescription" class="finance-input finance-input--full" type="text" placeholder="Descrição da movimentação">
            <select id="financeEntryTask" class="finance-input finance-input--full">
              <option value="">Vincular a uma tarefa (opcional)</option>
              ${analytics.taskCandidates.map((task) => `<option value="${task.id}">${task.dateStr} · ${task.text}</option>`).join('')}
            </select>
            <select id="financeEntryProject" class="finance-input finance-input--full">
              <option value="">Vincular a um projeto (opcional)</option>
              ${getProjectOptions().map((project) => `<option value="${project.id}">${project.name}${project.clientName ? ` · ${project.clientName}` : ''}</option>`).join('')}
            </select>
          </div>
          <div class="finance-form-actions">
            <button class="btn-primary" style="width:auto;padding:12px 18px;" onclick="saveFinanceTransactionFromForm()">Salvar movimentação</button>
            <span class="finance-form-hint">Quanto mais você vincular entrada com tarefa/projeto, melhor fica a leitura do teu motor de caixa.</span>
          </div>
        </section>

        <section class="finance-card">
          <div class="finance-card-head finance-card-head--dense">
            <div>
              <h3>Projetos</h3>
              <p>Cria o projeto uma vez e usa ele para conectar tarefa e receita.</p>
            </div>
          </div>
          <div class="finance-form-grid">
            <input id="projectQuickName" class="finance-input" type="text" placeholder="Nome do projeto">
            <input id="projectQuickClient" class="finance-input" type="text" placeholder="Cliente (opcional)">
            <button class="btn-secondary" style="width:auto;padding:12px 18px;" onclick="createProjectQuick()">Criar projeto</button>
          </div>
          <div class="finance-list finance-list--compact" style="margin-top:14px;">
            ${getProjectOptions().length > 0 ? getProjectOptions().slice(0, 8).map((project) => `
              <div class="finance-list-item finance-list-item--stacked">
                <div>
                  <strong>${project.name}</strong>
                  <p>${project.clientName || 'sem cliente'} • ${project.status}</p>
                </div>
                <span>${project.closedValue > 0 ? analytics.formatBRL(project.closedValue) : '-'}</span>
              </div>
            `).join('') : '<div class="finance-empty">Cria teus projetos aqui pra começar a ligar receita e tarefa em algo real.</div>'}
          </div>
        </section>

        <section class="finance-card finance-card--goal-low">
          <div class="finance-card-head finance-card-head--dense">
            <div>
              <h3>Meta mensal</h3>
              <p>Meta fica abaixo da análise operacional.</p>
            </div>
          </div>
          <div class="finance-goal-panel">
            <div class="finance-goal-row">
              <strong>${analytics.formatBRL(analytics.goal)}</strong>
              <div class="finance-goal-inline">
                <input id="financeMonthlyGoalInput" class="finance-input finance-input--sm" type="number" min="0" step="100" value="${analytics.goal}">
                <button class="btn-secondary" style="width:auto;padding:10px 14px;" onclick="saveFinanceGoal()">Salvar meta</button>
              </div>
            </div>
            <span>${analytics.progress}% da meta capturada • gap de ${analytics.formatBRL(analytics.gap)}</span>
            <div class="finance-progress"><span style="width:${analytics.progress}%"></span></div>
          </div>
          <div class="finance-list finance-list--compact">
            ${analytics.imports.length > 0 ? analytics.imports.map((item) => `
              <div class="finance-list-item finance-list-item--stacked">
                <div>
                  <strong>${item.summary || 'Importação do extrato'}</strong>
                  <p>${new Date(item.importedAt).toLocaleString('pt-BR')} • ${item.status}</p>
                </div>
                <span>${item.transactionCount} itens</span>
              </div>
            `).join('') : '<div class="finance-empty">Nenhum extrato importado ainda.</div>'}
          </div>
        </section>
      </section>
    </div>
  `;
  if (typeof fixMojibakeText === 'function') {
    view.innerHTML = fixMojibakeText(view.innerHTML);
  }

  renderFinanceCharts(analytics);
}


