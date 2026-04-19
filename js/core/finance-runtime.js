// Finance runtime extracted from js/app.js

let financeState = normalizeFinanceState(safeJSONParse(localStorage.getItem('flowlyFinanceState'), null));
let financeSyncTimer = null;
let financeChartsState = { cashflow: null, category: null };

function createFinanceId(prefix = 'fin') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeFinanceState(state) {
  const base = state && typeof state === 'object' ? state : {};
  const settings = base.settings && typeof base.settings === 'object' ? base.settings : {};
  const normalizeTransaction = (item) => {
    if (!item || typeof item !== 'object') return null;
    const amount = Number(item.amount || 0);
    return {
      id: item.id || createFinanceId('txn'),
      type: item.type === 'expense' ? 'expense' : 'income',
      amount: Number.isFinite(amount) ? amount : 0,
      description: String(item.description || '').trim(),
      category: String(item.category || (item.type === 'expense' ? 'Operacional' : 'Receita')).trim() || 'Geral',
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) ? String(item.date) : localDateStr(),
      source: String(item.source || 'manual').trim() || 'manual',
      taskSupabaseId: item.taskSupabaseId ? String(item.taskSupabaseId) : null,
      taskText: item.taskText ? String(item.taskText) : '',
      projectId: item.projectId ? String(item.projectId) : null,
      projectName: item.projectName ? String(item.projectName) : '',
      notes: item.notes ? String(item.notes) : '',
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
    };
  };

  const normalizeImport = (item) => {
    if (!item || typeof item !== 'object') return null;
    return {
      id: item.id || createFinanceId('import'),
      source: String(item.source || 'sexta').trim() || 'sexta',
      status: String(item.status || 'processed').trim() || 'processed',
      summary: String(item.summary || '').trim(),
      importedAt: item.importedAt || new Date().toISOString(),
      transactionCount: Number(item.transactionCount || 0) || 0,
      metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
    };
  };

  return {
    settings: {
      monthlyGoal: Number(settings.monthlyGoal || 10000) || 10000,
      defaultIncomeCategory: settings.defaultIncomeCategory || 'Receita',
      defaultExpenseCategory: settings.defaultExpenseCategory || 'Operacional'
    },
    transactions: Array.isArray(base.transactions) ? base.transactions.map(normalizeTransaction).filter(Boolean) : [],
    imports: Array.isArray(base.imports) ? base.imports.map(normalizeImport).filter(Boolean) : []
  };
}

function persistFinanceStateLocal() {
  financeState = normalizeFinanceState(financeState);
  localStorage.setItem('flowlyFinanceState', JSON.stringify(financeState));
}

function scheduleFinanceSync(delay = 900) {
  if (financeSyncTimer) clearTimeout(financeSyncTimer);
  financeSyncTimer = setTimeout(() => {
    financeSyncTimer = null;
    syncFinanceStateToSupabase();
  }, delay);
}

async function loadFinanceStateFromSupabase() {
  const user = await ensureCurrentUserForSync();
  if (!user) {
    persistFinanceStateLocal();
    return;
  }

  try {
    const [settingsResult, transactionsResult, importsResult] = await Promise.all([
      supabaseClient.from('finance_settings').select('*').eq('user_id', user.id).maybeSingle(),
      supabaseClient.from('finance_transactions').select('*').eq('user_id', user.id).order('occurred_on', { ascending: false }).limit(300),
      supabaseClient.from('finance_imports').select('*').eq('user_id', user.id).order('imported_at', { ascending: false }).limit(50)
    ]);

    const missingTable = [settingsResult, transactionsResult, importsResult].some((result) => {
      const code = result && result.error ? String(result.error.code || '') : '';
      return code === '42P01';
    });
    if (missingTable) {
      console.warn('[Finance] Tabelas financeiras ainda nao existem no Supabase.');
      persistFinanceStateLocal();
      return;
    }

    if (settingsResult.error) throw settingsResult.error;
    if (transactionsResult.error) throw transactionsResult.error;
    if (importsResult.error) throw importsResult.error;

    financeState = normalizeFinanceState({
      settings: {
        monthlyGoal: settingsResult.data?.monthly_goal || financeState.settings.monthlyGoal,
        defaultIncomeCategory: settingsResult.data?.default_income_category || financeState.settings.defaultIncomeCategory,
        defaultExpenseCategory: settingsResult.data?.default_expense_category || financeState.settings.defaultExpenseCategory
      },
      transactions: (transactionsResult.data || []).map((row) => ({
        id: row.id,
        type: row.entry_type,
        amount: row.amount,
        description: row.description,
        category: row.category,
        date: row.occurred_on,
        source: row.source,
        taskSupabaseId: row.task_supabase_id,
        taskText: row.task_text,
        projectId: row.project_id,
        projectName: row.project_name,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: row.metadata || {}
      })),
      imports: (importsResult.data || []).map((row) => ({
        id: row.id,
        source: row.source,
        status: row.status,
        summary: row.summary,
        importedAt: row.imported_at,
        transactionCount: row.transaction_count,
        metadata: row.metadata || {}
      }))
    });
    persistFinanceStateLocal();
  } catch (error) {
    console.error('[Finance] Falha ao carregar estado financeiro:', error);
  }
}

async function syncFinanceStateToSupabase() {
  const user = await ensureCurrentUserForSync();
  if (!user) return;
  financeState = normalizeFinanceState(financeState);

  try {
    const settingsPayload = {
      user_id: user.id,
      monthly_goal: Number(financeState.settings.monthlyGoal || 0),
      default_income_category: financeState.settings.defaultIncomeCategory || 'Receita',
      default_expense_category: financeState.settings.defaultExpenseCategory || 'Operacional',
      updated_at: new Date().toISOString()
    };
    const settingsResult = await supabaseClient.from('finance_settings').upsert(settingsPayload, { onConflict: 'user_id' });
    if (settingsResult.error && String(settingsResult.error.code || '') !== '42P01') throw settingsResult.error;

    if (financeState.transactions.length > 0) {
      const transactionsPayload = financeState.transactions.map((item) => ({
        id: item.id,
        user_id: user.id,
        entry_type: item.type,
        amount: Number(item.amount || 0),
        description: item.description || '',
        category: item.category || 'Geral',
        occurred_on: item.date || localDateStr(),
        source: item.source || 'manual',
        task_supabase_id: item.taskSupabaseId || null,
        task_text: item.taskText || null,
        project_id: item.projectId || null,
        project_name: item.projectName || null,
        notes: item.notes || null,
        metadata: item.metadata || {},
        created_at: item.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      const txResult = await supabaseClient.from('finance_transactions').upsert(transactionsPayload, { onConflict: 'id' });
      if (txResult.error && String(txResult.error.code || '') !== '42P01') throw txResult.error;
    }

    if (financeState.imports.length > 0) {
      const importsPayload = financeState.imports.map((item) => ({
        id: item.id,
        user_id: user.id,
        source: item.source || 'sexta',
        status: item.status || 'processed',
        summary: item.summary || '',
        imported_at: item.importedAt || new Date().toISOString(),
        transaction_count: Number(item.transactionCount || 0),
        metadata: item.metadata || {},
        updated_at: new Date().toISOString()
      }));
      const importsResult = await supabaseClient.from('finance_imports').upsert(importsPayload, { onConflict: 'id' });
      if (importsResult.error && String(importsResult.error.code || '') !== '42P01') throw importsResult.error;
    }
  } catch (error) {
    console.error('[Finance] Falha ao sincronizar estado financeiro:', error);
  }
}

function getFinanceTaskCandidates() {
  const items = [];
  Object.entries(allTasksData || {}).forEach(([dateStr, periods]) => {
    Object.entries(periods || {}).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks)) return;
      tasks.forEach((task, index) => {
        if (!task || !task.text) return;
        items.push({
          id: task.supabaseId || `${dateStr}::${period}::${index}`,
          text: task.text,
          dateStr,
          period,
          amountHint: extractCurrencyValueFromText(task.text),
          completed: task.completed === true
        });
      });
    });
  });

  items.sort((a, b) => `${b.dateStr} ${b.period}`.localeCompare(`${a.dateStr} ${a.period}`));
  return items.slice(0, 120);
}

function extractCurrencyValueFromText(text) {
  const matches = String(text || '').match(/R\$\s*([\d\.]+(?:,\d{1,2})?)/i);
  if (!matches) return 0;
  return Number(matches[1].replace(/\./g, '').replace(',', '.')) || 0;
}

function buildFinanceAnalytics() {
  financeState = normalizeFinanceState(financeState);
  const monthKey = localDateStr().slice(0, 7);
  const formatBRL = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const currentMonthTransactions = financeState.transactions.filter((item) => String(item.date || '').startsWith(monthKey));
  const incomes = currentMonthTransactions.filter((item) => item.type === 'income');
  const expenses = currentMonthTransactions.filter((item) => item.type === 'expense');
  const incomeTotal = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = incomeTotal - expenseTotal;
  const goal = Number(financeState.settings.monthlyGoal || 0);
  const progress = goal > 0 ? Math.max(0, Math.min(100, Math.round((incomeTotal / goal) * 100))) : 0;

  const taskDerivedOpen = [];
  const taskDerivedDone = [];
  Object.entries(allTasksData || {}).forEach(([dateStr, periods]) => {
    Object.entries(periods || {}).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks)) return;
      tasks.forEach((task, index) => {
        if (!task || !task.text) return;
        const amount = extractCurrencyValueFromText(task.text);
        const type = String(task.type || '').toUpperCase();
        const priority = String(task.priority || '').toLowerCase();
        const looksFinancial = type === 'MONEY' || priority === 'money' || /dinheiro|cobrar|proposta|orcamento|orçamento|cliente|venda|pagamento|receber|pix|fee|briefing|cobran/i.test(task.text) || amount > 0;
        if (!looksFinancial) return;
        const row = {
          taskId: task.supabaseId || `${dateStr}::${period}::${index}`,
          text: task.text,
          dateStr,
          period,
          amount,
          completed: task.completed === true,
          priority,
          type
        };
        if (row.completed) taskDerivedDone.push(row);
        else taskDerivedOpen.push(row);
      });
    });
  });

  const linkedTaskMap = new Map();
  financeState.transactions.forEach((transaction) => {
    if (transaction.type !== 'income' || (!transaction.taskSupabaseId && !transaction.taskText)) return;
    const key = transaction.taskSupabaseId || transaction.taskText;
    const prev = linkedTaskMap.get(key) || { key, taskSupabaseId: transaction.taskSupabaseId || null, taskText: transaction.taskText || 'Sem nome', total: 0, count: 0, lastDate: transaction.date };
    prev.total += Number(transaction.amount || 0);
    prev.count += 1;
    prev.lastDate = transaction.date || prev.lastDate;
    linkedTaskMap.set(key, prev);
  });

  const categoryTotals = {};
  currentMonthTransactions.forEach((item) => {
    const key = item.category || (item.type === 'expense' ? 'Operacional' : 'Receita');
    categoryTotals[key] = (categoryTotals[key] || 0) + Number(item.amount || 0);
  });

  const dailyCashflowMap = {};
  currentMonthTransactions.forEach((item) => {
    const key = item.date || monthKey + '-01';
    if (!dailyCashflowMap[key]) dailyCashflowMap[key] = { income: 0, expense: 0 };
    if (item.type === 'expense') dailyCashflowMap[key].expense += Number(item.amount || 0);
    else dailyCashflowMap[key].income += Number(item.amount || 0);
  });

  const chartLabels = Object.keys(dailyCashflowMap).sort();
  const chartIncome = chartLabels.map((key) => dailyCashflowMap[key].income);
  const chartExpense = chartLabels.map((key) => dailyCashflowMap[key].expense);
  const recentTransactions = financeState.transactions.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 8);
  const incomeSources = {};
  incomes.forEach((item) => {
    const key = item.description || item.taskText || item.category || 'Receita';
    if (!incomeSources[key]) {
      incomeSources[key] = { amount: 0, count: 0, category: item.category || 'Receita' };
    }
    incomeSources[key].amount += Number(item.amount || 0);
    incomeSources[key].count += 1;
  });
  const expenseBreakdown = {};
  expenses.forEach((item) => {
    const key = item.category || item.description || 'Saída';
    expenseBreakdown[key] = (expenseBreakdown[key] || 0) + Number(item.amount || 0);
  });
  const topIncomeSources = Object.entries(incomeSources)
    .map(([label, meta]) => ({ label, amount: meta.amount, count: meta.count, category: meta.category }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  const topExpenseCategories = Object.entries(expenseBreakdown)
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  const avgTicketIn = incomes.length ? incomeTotal / incomes.length : 0;
  const avgTicketOut = expenses.length ? expenseTotal / expenses.length : 0;
  const analysisTone = balance >= 0
    ? 'Entradas segurando o mês. Agora é identificar os motores que mais repetem.'
    : 'As saídas estão acima das entradas. O foco é reduzir vazamentos e mapear o que realmente traz caixa.';

  return {
    formatBRL,
    goal,
    progress,
    incomeTotal,
    expenseTotal,
    balance,
    gap: Math.max(0, goal - incomeTotal),
    monthTransactionCount: currentMonthTransactions.length,
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    avgTicketIn,
    avgTicketOut,
    analysisTone,
    imports: financeState.imports.slice().sort((a, b) => String(b.importedAt || '').localeCompare(String(a.importedAt || ''))).slice(0, 6),
    taskDerivedOpen: taskDerivedOpen.sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 6),
    taskDerivedDone: taskDerivedDone.sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 6),
    linkedTasks: Array.from(linkedTaskMap.values()).sort((a, b) => b.total - a.total).slice(0, 8),
    recentTransactions,
    categoryTotals,
    topIncomeSources,
    topExpenseCategories,
    chartLabels,
    chartIncome,
    chartExpense,
    taskCandidates: getFinanceTaskCandidates()
  };
}

function renderFinanceCharts(analytics) {
  if (financeChartsState.cashflow) {
    financeChartsState.cashflow.destroy();
    financeChartsState.cashflow = null;
  }
  if (financeChartsState.category) {
    financeChartsState.category.destroy();
    financeChartsState.category = null;
  }

  const sharedGrid = { color: 'rgba(255,255,255,0.06)', drawBorder: false };
  const sharedTicks = { color: '#8b90a0', font: { size: 11 } };
  const cashflowCanvas = document.getElementById('financeCashflowChart');
  if (cashflowCanvas && analytics.chartLabels.length > 0) {
    financeChartsState.cashflow = new Chart(cashflowCanvas, {
      type: 'line',
      data: {
        labels: analytics.chartLabels.map((label) => label.slice(8, 10) + '/' + label.slice(5, 7)),
        datasets: [
          {
            label: 'Entradas',
            data: analytics.chartIncome,
            borderColor: '#4ade80',
            backgroundColor: 'rgba(74, 222, 128, 0.18)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5
          },
          {
            label: 'Saídas',
            data: analytics.chartExpense,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.14)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#d3d6df', usePointStyle: true, boxWidth: 8 } },
          tooltip: {
            backgroundColor: 'rgba(10,10,14,0.96)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${analytics.formatBRL(ctx.raw)}` }
          }
        },
        scales: {
          x: { ticks: sharedTicks, grid: { display: false } },
          y: { ticks: { ...sharedTicks, callback: (value) => analytics.formatBRL(value) }, grid: sharedGrid }
        }
      }
    });
  }

  const categoryCanvas = document.getElementById('financeCategoryChart');
  const categoryLabels = Object.keys(analytics.categoryTotals || {});
  if (categoryCanvas && categoryLabels.length > 0) {
    financeChartsState.category = new Chart(categoryCanvas, {
      type: 'doughnut',
      data: {
        labels: categoryLabels,
        datasets: [{
          data: categoryLabels.map((label) => analytics.categoryTotals[label]),
          backgroundColor: ['#4ade80', '#22c55e', '#60a5fa', '#8b5cf6', '#f97316', '#facc15', '#38bdf8', '#fb7185', '#c084fc', '#a78bfa'],
          borderWidth: 0,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${analytics.formatBRL(ctx.raw)}` } }
        }
      }
    });
  }
}

window.saveFinanceGoal = async function () {
  const input = document.getElementById('financeMonthlyGoalInput');
  const nextGoal = Number((input && input.value) || 0);
  financeState.settings.monthlyGoal = nextGoal > 0 ? nextGoal : 10000;
  persistFinanceStateLocal();
  scheduleFinanceSync();
  renderFinanceView();
};

window.saveFinanceTransactionFromForm = async function () {
  const type = document.getElementById('financeEntryType')?.value || 'income';
  const amount = Number(document.getElementById('financeEntryAmount')?.value || 0);
  const description = (document.getElementById('financeEntryDescription')?.value || '').trim();
  const category = (document.getElementById('financeEntryCategory')?.value || '').trim();
  const date = document.getElementById('financeEntryDate')?.value || localDateStr();
  const taskRef = document.getElementById('financeEntryTask')?.value || '';
  const projectRef = document.getElementById('financeEntryProject')?.value || '';
  const taskCandidates = getFinanceTaskCandidates();
  const selectedTask = taskCandidates.find((item) => item.id === taskRef) || null;
  const selectedProject = getProjectOptions().find((item) => item.id === projectRef) || null;

  if (!description || !Number.isFinite(amount) || amount <= 0) {
    window.FlowlyDialogs.notify('Preenche descricao e valor certinho.', 'warn');
    return;
  }

  financeState.transactions.unshift({
    id: createFinanceId('txn'),
    type,
    amount,
    description,
    category: category || (type === 'expense' ? financeState.settings.defaultExpenseCategory : financeState.settings.defaultIncomeCategory),
    date,
    source: 'manual',
    taskSupabaseId: selectedTask ? selectedTask.id : null,
    taskText: selectedTask ? selectedTask.text : '',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: selectedTask ? { linkedFrom: 'finance-form', taskDate: selectedTask.dateStr, taskPeriod: selectedTask.period } : {}
  });

  persistFinanceStateLocal();
  scheduleFinanceSync();
  renderFinanceView();
};
