// renderFinanceView — redesign completo com padrão Flowly DS
function renderFinanceView() {
  const view = document.getElementById('financeView');
  if (!view) return;

  const analytics = buildFinanceAnalytics();
  const sourceHint = analytics.imports[0]
    ? `Importado em ${new Date(analytics.imports[0].importedAt).toLocaleString('pt-BR')}`
    : 'Sem import recente';

  const expenseShare = analytics.expenseTotal > 0
    ? analytics.topExpenseCategories.map((item) => ({ ...item, share: Math.round((item.amount / analytics.expenseTotal) * 100) }))
    : [];
  const incomeShare = analytics.incomeTotal > 0
    ? analytics.topIncomeSources.map((item) => ({ ...item, share: Math.round((item.amount / analytics.incomeTotal) * 100) }))
    : [];

  const balancePositive = analytics.balance >= 0;
  const progressPct = Math.min(analytics.progress, 100);

  const LEGEND_COLORS = ['#F27405', '#30D158', '#0A84FF', '#FF9F0A', '#FF453A', '#BF5AF2'];

  // Tabela de transações recentes
  const txRows = analytics.recentTransactions.length > 0
    ? analytics.recentTransactions.slice(0, 10).map((item) => `
        <div class="finance-tx-item">
          <div class="finance-tx-left">
            <div class="finance-tx-desc">${item.description}</div>
            <div class="finance-tx-meta">${item.date} &bull; ${item.category}</div>
          </div>
          <div class="finance-tx-amount finance-tx-amount--${item.type}">${item.type === 'expense' ? '-' : '+'}${analytics.formatBRL(item.amount)}</div>
        </div>`)
    .join('')
    : '<div class="finance-empty">Nenhuma movimentação registrada ainda.</div>';

  // Breakdown de saídas
  const expenseRows = expenseShare.length > 0
    ? expenseShare.slice(0, 6).map((item) => `
        <div class="finance-breakdown-item finance-breakdown-item--expense">
          <div class="finance-breakdown-head">
            <strong>${item.label}</strong>
            <span>${analytics.formatBRL(item.amount)}</span>
          </div>
          <div class="finance-breakdown-bar"><span style="width:${Math.max(item.share, 6)}%"></span></div>
          <div class="finance-breakdown-meta">${item.share}% das saídas${item.count ? ` &bull; ${item.count} lançamento(s)` : ''}</div>
        </div>`)
    .join('')
    : '<div class="finance-empty">Sem saídas registradas ainda.</div>';

  // Breakdown de entradas
  const incomeRows = incomeShare.length > 0
    ? incomeShare.slice(0, 6).map((item) => `
        <div class="finance-breakdown-item finance-breakdown-item--income">
          <div class="finance-breakdown-head">
            <strong>${item.label}</strong>
            <span>${analytics.formatBRL(item.amount)}</span>
          </div>
          <div class="finance-breakdown-bar"><span style="width:${Math.max(item.share, 6)}%"></span></div>
          <div class="finance-breakdown-meta">${item.share}% das entradas${item.count ? ` &bull; ${item.count} lançamento(s)` : ''}</div>
        </div>`)
    .join('')
    : '<div class="finance-empty">Sem entradas registradas ainda.</div>';

  // Legend de categorias
  const legendRows = expenseShare.slice(0, 5).map((item, i) => `
    <div class="finance-legend-row">
      <span class="finance-legend-dot" style="background:${LEGEND_COLORS[i] || '#555'}"></span>
      <span class="finance-legend-name">${item.label}</span>
      <span class="finance-legend-pct">${item.share}%</span>
    </div>`).join('');

  // Projects list (quick)
  const projectRows = getProjectOptions().length > 0
    ? getProjectOptions().slice(0, 5).map((project) => `
        <div class="finance-data-row">
          <span class="finance-data-row-label">${project.name}${project.clientName ? ` &bull; ${project.clientName}` : ''}</span>
          <span class="finance-data-row-value">${project.closedValue > 0 ? analytics.formatBRL(project.closedValue) : '—'}</span>
        </div>`)
    .join('')
    : '<div class="finance-empty">Sem projetos cadastrados.</div>';

  view.innerHTML = `
    <div class="flowly-shell flowly-shell--wide finance-shell">

      <!-- PAGE HEADER -->
      <div class="flowly-page-header">
        <div class="flowly-page-header-left">
          <div class="flowly-page-kicker">Painel financeiro</div>
          <h2 class="flowly-page-title">Finanças</h2>
          <p class="flowly-page-subtitle">${analytics.analysisTone}</p>
          <div class="flowly-inline-pills" style="margin-top:10px">
            <span class="flowly-soft-pill flowly-soft-pill--accent">${analytics.monthTransactionCount} movimentações</span>
            <span class="flowly-soft-pill">${sourceHint}</span>
          </div>
        </div>
        <div class="flowly-page-actions">
          <button class="btn-primary" onclick="saveFinanceTransactionFromForm()" style="display:none" id="financeQuickSaveBtn">Salvar</button>
        </div>
      </div>

      <!-- KPI STRIP -->
      <div class="finance-kpi-row">
        <div class="finance-kpi-card finance-kpi-card--income">
          <div class="finance-kpi-label">Entradas</div>
          <div class="finance-kpi-value">${analytics.formatBRL(analytics.incomeTotal)}</div>
          <div class="finance-kpi-meta">${analytics.incomeCount} lançamento(s) &bull; ticket médio ${analytics.formatBRL(analytics.avgTicketIn)}</div>
        </div>
        <div class="finance-kpi-card finance-kpi-card--expense">
          <div class="finance-kpi-label">Saídas</div>
          <div class="finance-kpi-value">${analytics.formatBRL(analytics.expenseTotal)}</div>
          <div class="finance-kpi-meta">${analytics.expenseCount} lançamento(s) &bull; ticket médio ${analytics.formatBRL(analytics.avgTicketOut)}</div>
        </div>
        <div class="finance-kpi-card finance-kpi-card--balance">
          <div class="finance-kpi-label">Saldo do mês</div>
          <div class="finance-kpi-value">${analytics.formatBRL(analytics.balance)}</div>
          <div class="finance-kpi-meta">${balancePositive ? 'Operação no azul.' : 'Saldo pressionado.'}</div>
          <span class="finance-kpi-delta finance-kpi-delta--${balancePositive ? 'up' : 'down'}">${balancePositive ? '↑' : '↓'} ${analytics.progress}% da meta</span>
        </div>
      </div>

      <!-- MAIN GRID -->
      <div class="finance-main-grid">

        <!-- LEFT COLUMN -->
        <div style="display:flex;flex-direction:column;gap:16px">

          <!-- Cash flow chart -->
          <div class="finance-card">
            <div class="finance-card-head">
              <div>
                <h3>Fluxo do mês</h3>
                <p>Entradas vs saídas, sem ruído.</p>
              </div>
            </div>
            <div class="finance-chart-area">
              ${analytics.chartLabels.length > 0
                ? '<canvas id="financeCashflowChart"></canvas>'
                : '<span style="font-size:13px;color:var(--ds-text-muted)">Adicione transações para visualizar o gráfico.</span>'}
            </div>
          </div>

          <!-- Breakdown grid -->
          <div class="finance-dual-grid">
            <div class="finance-card">
              <div class="finance-card-head">
                <div><h3>De onde vem</h3><p>Origens de receita detalhadas.</p></div>
              </div>
              <div class="finance-breakdown-list">${incomeRows}</div>
            </div>
            <div class="finance-card">
              <div class="finance-card-head">
                <div><h3>Pra onde vai</h3><p>O que mais está puxando caixa.</p></div>
              </div>
              <div class="finance-breakdown-list">${expenseRows}</div>
            </div>
          </div>

          <!-- Recent transactions -->
          <div class="finance-card">
            <div class="finance-card-head">
              <div><h3>Movimentações recentes</h3><p>Últimas entradas e saídas.</p></div>
            </div>
            <div class="finance-tx-list">${txRows}</div>
          </div>

        </div>

        <!-- RIGHT SIDEBAR -->
        <div class="finance-side-stack">

          <!-- Meta mensal -->
          <div class="finance-goal-card">
            <div class="finance-card-head">
              <div><h3>Meta mensal</h3><p>${analytics.progress}% capturado</p></div>
            </div>
            <div class="finance-goal-body">
              <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
                <span style="font-family:var(--ds-font-display);font-size:22px;font-weight:800;letter-spacing:-0.04em">${analytics.formatBRL(analytics.goal)}</span>
                <span style="font-size:11px;color:var(--ds-text-muted)">gap ${analytics.formatBRL(analytics.gap)}</span>
              </div>
              <div class="finance-goal-progress">
                <div class="finance-goal-fill" style="width:${progressPct}%"></div>
              </div>
              <div class="finance-goal-numbers">
                <span>${analytics.formatBRL(analytics.incomeTotal)} captado</span>
                <span>${progressPct}%</span>
              </div>
              <div class="finance-goal-row">
                <input id="financeMonthlyGoalInput" class="finance-input finance-input--sm" type="number" min="0" step="100" value="${analytics.goal}" placeholder="Meta" style="max-width:120px">
                <button class="btn-secondary btn-inline" onclick="saveFinanceGoal()">Salvar meta</button>
              </div>
            </div>
          </div>

          <!-- Donut chart + legend -->
          <div class="finance-quick-card">
            <div class="finance-card-head">
              <div><h3>Por categoria</h3><p>Distribuição das saídas.</p></div>
            </div>
            <div class="finance-chart-area" style="min-height:160px">
              ${Object.keys(analytics.categoryTotals).length > 0
                ? '<canvas id="financeCategoryChart"></canvas>'
                : '<span style="font-size:12px;color:var(--ds-text-muted)">Sem categorias registradas.</span>'}
            </div>
            ${legendRows ? `<div>${legendRows}</div>` : ''}
          </div>

          <!-- Projetos ativos -->
          <div class="finance-quick-card">
            <div class="finance-card-head">
              <div><h3>Projetos</h3><p>Visão rápida com receita.</p></div>
            </div>
            ${projectRows}
            <div style="padding:10px 20px;border-top:1px solid var(--ds-border)">
              <div class="finance-form-grid" style="padding:0;grid-template-columns:1fr 1fr">
                <input id="projectQuickName" class="finance-input" type="text" placeholder="Nome do projeto">
                <input id="projectQuickClient" class="finance-input" type="text" placeholder="Cliente (opcional)">
              </div>
              <div style="padding:10px 0 0">
                <button class="btn-secondary btn-inline" onclick="createProjectQuick()">Criar projeto</button>
              </div>
            </div>
          </div>

          <!-- Lançar movimentação -->
          <div class="finance-quick-card">
            <div class="finance-card-head">
              <div><h3>Lançar</h3><p>Movimentação manual rápida.</p></div>
            </div>
            <div class="finance-form-grid">
              <select id="financeEntryType" class="finance-input">
                <option value="income">Entrada</option>
                <option value="expense">Saída</option>
              </select>
              <input id="financeEntryAmount" class="finance-input" type="number" min="0" step="0.01" placeholder="Valor (R$)">
              <input id="financeEntryDate" class="finance-input" type="date" value="${localDateStr()}">
              <input id="financeEntryCategory" class="finance-input" type="text" placeholder="Categoria">
              <input id="financeEntryDescription" class="finance-input finance-input--full" type="text" placeholder="Descrição">
              <select id="financeEntryTask" class="finance-input finance-input--full">
                <option value="">Vincular a tarefa (opcional)</option>
                ${analytics.taskCandidates.map((task) => `<option value="${task.id}">${task.dateStr} · ${task.text}</option>`).join('')}
              </select>
              <select id="financeEntryProject" class="finance-input finance-input--full">
                <option value="">Vincular a projeto (opcional)</option>
                ${getProjectOptions().map((project) => `<option value="${project.id}">${project.name}${project.clientName ? ` · ${project.clientName}` : ''}</option>`).join('')}
              </select>
            </div>
            <div class="finance-form-actions">
              <button class="btn-primary btn-inline" onclick="saveFinanceTransactionFromForm()">Salvar movimentação</button>
            </div>
          </div>

        </div>
      </div>

    </div>
  `;

  if (typeof fixMojibakeText === 'function') {
    view.innerHTML = fixMojibakeText(view.innerHTML);
  }
  renderFinanceCharts(analytics);
}
