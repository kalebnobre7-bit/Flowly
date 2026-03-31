// Project runtime extracted from js/app.js

let projectsState = normalizeProjectsState(safeJSONParse(localStorage.getItem('flowlyProjectsState'), null));
let projectsSyncTimer = null;

function createProjectId(prefix = 'proj') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeProjectsState(state) {
  const base = state && typeof state === 'object' ? state : {};
  const normalizeTemplateTasks = (value) => {
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
    if (typeof value === 'string') return value.split('\n').map((item) => item.trim()).filter(Boolean);
    return [];
  };
  const normalizeProject = (item) => {
    if (!item || typeof item !== 'object') return null;
    return {
      id: item.id || createProjectId('proj'),
      name: String(item.name || '').trim(),
      clientName: String(item.clientName || '').trim(),
      status: String(item.status || 'active').trim() || 'active',
      serviceType: String(item.serviceType || '').trim(),
      expectedValue: Number(item.expectedValue || 0) || 0,
      closedValue: Number(item.closedValue || 0) || 0,
      notes: String(item.notes || '').trim(),
      startDate: item.startDate ? String(item.startDate) : '',
      deadline: item.deadline ? String(item.deadline) : '',
      completionDate: item.completionDate ? String(item.completionDate) : '',
      isPaid: item.isPaid === true,
      isDraft: item.isDraft === true || String(item.status || '').trim() === 'draft',
      templateTasks: normalizeTemplateTasks(item.templateTasks),
      collapseSubtasks: item.collapseSubtasks !== false,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    };
  };
  return {
    projects: Array.isArray(base.projects) ? base.projects.map(normalizeProject).filter((p) => p && p.name) : []
  };
}

function persistProjectsStateLocal() {
  projectsState = normalizeProjectsState(projectsState);
  localStorage.setItem('flowlyProjectsState', JSON.stringify(projectsState));
}

function getProjectOptions() {
  projectsState = normalizeProjectsState(projectsState);
  return projectsState.projects.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function findProjectById(projectId) {
  return getProjectOptions().find((project) => project.id === projectId) || null;
}

function updateProjectRecord(projectId, updater) {
  projectsState = normalizeProjectsState(projectsState);
  const index = projectsState.projects.findIndex((project) => project.id === projectId);
  if (index < 0) return null;
  const current = projectsState.projects[index];
  const next = typeof updater === 'function' ? updater({ ...current }) : { ...current, ...(updater || {}) };
  next.updatedAt = new Date().toISOString();
  projectsState.projects[index] = next;
  persistProjectsStateLocal();
  scheduleProjectsSync();
  return next;
}

function scheduleProjectsSync(delay = 900) {
  if (projectsSyncTimer) clearTimeout(projectsSyncTimer);
  projectsSyncTimer = setTimeout(() => {
    projectsSyncTimer = null;
    syncProjectsStateToSupabase();
  }, delay);
}

async function loadProjectsStateFromSupabase() {
  const user = await ensureCurrentUserForSync();
  if (!user) {
    persistProjectsStateLocal();
    return;
  }
  try {
    const localProjects = normalizeProjectsState(projectsState).projects;
    const localMap = new Map(localProjects.map((project) => [project.id, project]));
    const result = await supabaseClient.from('projects').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(200);
    if (result.error) {
      const code = String(result.error.code || '');
      if (code === '42P01') {
        persistProjectsStateLocal();
        return;
      }
      throw result.error;
    }
    projectsState = normalizeProjectsState({
      projects: (result.data || []).map((row) => {
        const localProject = localMap.get(row.id) || {};
        return {
          id: row.id,
          name: row.name,
          clientName: row.client_name,
          status: row.status,
          serviceType: row.service_type,
          expectedValue: row.expected_value,
          closedValue: row.closed_value,
          notes: row.notes,
          startDate: row.start_date || localProject.startDate || '',
          deadline: row.deadline || localProject.deadline || '',
          completionDate: row.completion_date || localProject.completionDate || '',
          isPaid: row.is_paid === true || localProject.isPaid === true,
          isDraft: localProject.isDraft === true || String(row.status || '').trim() === 'draft',
          templateTasks: localProject.templateTasks || [],
          collapseSubtasks: localProject.collapseSubtasks !== false,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      })
    });
    persistProjectsStateLocal();
  } catch (error) {
    console.error('[Projects] Falha ao carregar projetos:', error);
  }
}

async function syncProjectsStateToSupabase() {
  const user = await ensureCurrentUserForSync();
  if (!user) return;
  projectsState = normalizeProjectsState(projectsState);
  try {
    if (projectsState.projects.length === 0) return;
    const payload = projectsState.projects.map((item) => ({
      id: item.id,
      user_id: user.id,
      name: item.name,
      client_name: item.clientName || null,
      status: item.status || 'active',
      service_type: item.serviceType || null,
      expected_value: Number(item.expectedValue || 0),
      closed_value: Number(item.closedValue || 0),
      notes: item.notes || null,
      start_date: item.startDate || null,
      deadline: item.deadline || null,
      completion_date: item.completionDate || null,
      is_paid: item.isPaid === true,
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    const result = await supabaseClient.from('projects').upsert(payload, { onConflict: 'id' });
    if (result.error && String(result.error.code || '') !== '42P01') throw result.error;
  } catch (error) {
    console.error('[Projects] Falha ao sincronizar projetos:', error);
  }
}

window.createProjectQuick = async function () {
  const name = (document.getElementById('projectQuickName')?.value || '').trim();
  const clientName = (document.getElementById('projectQuickClient')?.value || '').trim();
  if (!name) {
    notifyProjectMessage('Da um nome pro projeto primeiro.', 'warn');
    return;
  }
  projectsState.projects.unshift({
    id: createProjectId('proj'),
    name,
    clientName,
    status: 'active',
    serviceType: '',
    expectedValue: 0,
    closedValue: 0,
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  persistProjectsStateLocal();
  scheduleProjectsSync();
  if (currentView === 'projects') renderProjectsView();
  if (currentView === 'finance') renderFinanceView();
};

function collectProjectTaskCandidates({ includeLinked = false, max = 24, projectId = null } = {}) {
  const entries = [];
  Object.entries(allTasksData || {}).forEach(([dateStr, periods]) => {
    Object.entries(periods || {}).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks) || period === 'Rotina') return;
      tasks.forEach((task, index) => {
        if (!task || !task.text) return;
        if (projectId && task.projectId !== projectId) return;
        if (!includeLinked && !projectId && task.projectId) return;
        entries.push({ dateStr, period, index, task });
      });
    });
  });

  const scoreDate = (dateStr) => {
    const today = new Date(localDateStr() + 'T00:00:00');
    const target = new Date(String(dateStr) + 'T00:00:00');
    return Math.abs(target.getTime() - today.getTime());
  };

  return entries
    .sort((a, b) => {
      if (Boolean(a.task.completed) !== Boolean(b.task.completed)) return a.task.completed ? 1 : -1;
      const diff = scoreDate(a.dateStr) - scoreDate(b.dateStr);
      if (diff !== 0) return diff;
      return String(a.task.text || '').localeCompare(String(b.task.text || ''));
    })
    .slice(0, max);
}

function applyProjectLinkToTask(dateStr, period, index, projectId) {
  const list = allTasksData?.[dateStr]?.[period];
  const task = list?.[index];
  if (!task) return false;
  const project = projectId ? getProjectOptions().find((item) => item.id === projectId) : null;
  const linkedTasks = collectTaskSubtree(list, task);

  linkedTasks.forEach((entry) => {
    entry.projectId = project ? project.id : null;
    entry.projectName = project ? project.name : '';
  });

  saveToLocalStorage();
  syncDateToSupabase(dateStr);
  renderView();
  return true;
}

window.createProjectWithLinks = function () {
  const name = (document.getElementById('projectQuickName')?.value || '').trim();
  const clientName = (document.getElementById('projectQuickClient')?.value || '').trim();
  const serviceType = (document.getElementById('projectQuickServiceType')?.value || '').trim();
  const startDate = (document.getElementById('projectQuickStartDate')?.value || '').trim();
  const deadline = (document.getElementById('projectQuickDeadline')?.value || '').trim();
  const completionDate = (document.getElementById('projectQuickCompletionDate')?.value || '').trim();
  const expectedValue = Number(document.getElementById('projectQuickExpectedValue')?.value || 0) || 0;
  const closedValue = Number(document.getElementById('projectQuickClosedValue')?.value || 0) || 0;
  const isPaid = document.getElementById('projectQuickIsPaid')?.checked === true;
  const templateId = document.getElementById('projectTemplateSource')?.value || '';
  const template = templateId ? findProjectById(templateId) : null;

  if (!name) {
    notifyProjectMessage('Da um nome pro projeto primeiro.', 'warn');
    return;
  }

  const projectId = createProjectId('proj');
  const project = {
    id: projectId,
    name,
    clientName,
    status: 'active',
    serviceType,
    expectedValue,
    closedValue,
    notes: '',
    startDate,
    deadline,
    completionDate,
    isPaid,
    isDraft: false,
    templateTasks: template?.templateTasks || [],
    collapseSubtasks: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  projectsState.projects.unshift(project);
  persistProjectsStateLocal();
  scheduleProjectsSync();

  const selectedTasks = Array.from(document.querySelectorAll('.project-create-task-check:checked'));
  selectedTasks.forEach((input) => {
    applyProjectLinkToTask(input.dataset.date, input.dataset.period, Number(input.dataset.index), projectId);
  });

  if (template && Array.isArray(template.templateTasks)) {
    template.templateTasks.forEach((taskText) => {
      const cleanText = String(taskText || '').trim();
      if (!cleanText) return;
      const dateStr = localDateStr();
      const period = 'Tarefas';
      const currentList = allTasksData[dateStr]?.[period] || [];
      const newTask = {
        text: cleanText,
        completed: false,
        color: 'default',
        type: 'OPERATIONAL',
        priority: null,
        parent_id: null,
        position: currentList.length,
        isHabit: false,
        supabaseId: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
        timerTotalMs: 0,
        timerStartedAt: null,
        timerLastStoppedAt: null,
        timerSessionsCount: 0,
        projectId,
        projectName: name
      };
      if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
      if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];
      allTasksData[dateStr][period].push(newTask);
      syncTaskToSupabase(dateStr, period, newTask);
    });
    saveToLocalStorage();
  }

  ['projectQuickName','projectQuickClient','projectQuickServiceType','projectQuickStartDate','projectQuickDeadline','projectQuickCompletionDate','projectQuickExpectedValue','projectQuickClosedValue','projectTemplateSource'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const paidCheckbox = document.getElementById('projectQuickIsPaid');
  if (paidCheckbox) paidCheckbox.checked = false;

  if (currentView === 'projects') renderProjectsView();
  if (currentView === 'finance') renderFinanceView();
};

window.updateProjectField = function (projectId, field, value) {
  updateProjectRecord(projectId, (project) => {
    if (field === 'expectedValue' || field === 'closedValue') project[field] = Number(value || 0) || 0;
    else if (field === 'isDraft' || field === 'collapseSubtasks' || field === 'isPaid') project[field] = value === true || value === 'true';
    else project[field] = String(value || '').trim();

    if (field === 'isDraft') {
      project.status = project.isDraft ? 'draft' : 'active';
    }
    return project;
  });
  if (currentView === 'projects') renderProjectsView();
};

window.saveProjectTemplateTasks = function (projectId, textareaId) {
  const value = document.getElementById(textareaId)?.value || '';
  updateProjectRecord(projectId, (project) => ({
    ...project,
    templateTasks: value.split('\n').map((item) => item.trim()).filter(Boolean)
  }));
  if (currentView === 'projects') renderProjectsView();
};

window.linkTaskToProject = function (dateStr, period, index, projectId) {
  return applyProjectLinkToTask(dateStr, period, Number(index), projectId);
};

window.unlinkTaskFromProject = function (dateStr, period, index) {
  return applyProjectLinkToTask(dateStr, period, Number(index), null);
};

function suggestProjectForTask(task) {
  const options = getProjectOptions();
  if (!task || !task.text || options.length === 0) return null;
  const text = task.text.toLowerCase();
  return options.find((project) => {
    const name = String(project.name || '').toLowerCase();
    const client = String(project.clientName || '').toLowerCase();
    return (name && text.includes(name)) || (client && text.includes(client));
  }) || null;
}

function suggestProjectForTransaction(transaction) {
  const options = getProjectOptions();
  if (!transaction || options.length === 0) return null;
  const text = `${transaction.description || ''} ${transaction.taskText || ''} ${transaction.projectName || ''}`.toLowerCase();
  return options.find((project) => {
    const name = String(project.name || '').toLowerCase();
    const client = String(project.clientName || '').toLowerCase();
    return (name && text.includes(name)) || (client && text.includes(client));
  }) || null;
}

function buildProjectsAnalytics() {
  const projects = getProjectOptions();
  const projectMap = new Map(projects.map((project) => [project.id, { ...project, income: 0, expense: 0, tasks: 0, completedTasks: 0, linkedTransactions: [] }]));

  Object.entries(allTasksData || {}).forEach(([dateStr, periods]) => {
    Object.entries(periods || {}).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks)) return;
      tasks.forEach((task) => {
        const suggested = !task.projectId ? suggestProjectForTask(task) : null;
        const key = task.projectId || (suggested ? suggested.id : null);
        if (!key || !projectMap.has(key)) return;
        const bucket = projectMap.get(key);
        bucket.tasks += 1;
        if (task.completed) bucket.completedTasks += 1;
      });
    });
  });

  financeState.transactions.forEach((transaction) => {
    const suggested = !transaction.projectId ? suggestProjectForTransaction(transaction) : null;
    const key = transaction.projectId || (suggested ? suggested.id : null);
    if (!key || !projectMap.has(key)) return;
    const bucket = projectMap.get(key);
    if (transaction.type === 'income') bucket.income += Number(transaction.amount || 0);
    else bucket.expense += Number(transaction.amount || 0);
    bucket.linkedTransactions.push(transaction);
  });

  const enriched = Array.from(projectMap.values()).map((project) => ({
    ...project,
    profit: project.income - project.expense,
    completionRate: project.tasks > 0 ? Math.round((project.completedTasks / project.tasks) * 100) : 0
  })).sort((a,b)=> b.income - a.income || b.tasks - a.tasks);

  const suggestionTasks = [];
  Object.entries(allTasksData || {}).forEach(([dateStr, periods]) => {
    Object.entries(periods || {}).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks)) return;
      tasks.forEach((task, index) => {
        if (task.projectId || !task.text) return;
        const suggestion = suggestProjectForTask(task);
        if (suggestion) suggestionTasks.push({ dateStr, period, index, text: task.text, suggestion });
      });
    });
  });

  const suggestionTransactions = financeState.transactions
    .filter((transaction) => !transaction.projectId)
    .map((transaction) => ({ transaction, suggestion: suggestProjectForTransaction(transaction) }))
    .filter((item) => item.suggestion)
    .slice(0, 8);

  return { projects: enriched, suggestionTasks: suggestionTasks.slice(0, 10), suggestionTransactions };
}

window.applySuggestedTaskProject = function (dateStr, period, index, projectId) {
  return applyProjectLinkToTask(dateStr, period, Number(index), projectId);
};

window.applySuggestedTransactionProject = function (transactionId, projectId) {
  const transaction = financeState.transactions.find((item) => item.id === transactionId);
  const project = getProjectOptions().find((item) => item.id === projectId);
  if (!transaction || !project) return;
  transaction.projectId = project.id;
  transaction.projectName = project.name;
  persistFinanceStateLocal();
  scheduleFinanceSync();
  if (currentView === 'projects') renderProjectsView();
  if (currentView === 'finance') renderFinanceView();
};

function getProjectsNotifier() {
  return window.flowlyErrors || window.FlowlyErrorHandler || null;
}

function notifyProjectMessage(message, level = 'warn') {
  const notifier = getProjectsNotifier();
  if (notifier && typeof notifier.notify === 'function') {
    notifier.notify(message, level);
    return;
  }
  console[level === 'error' ? 'error' : 'warn'](message);
}

function closeProjectsPromptModal() {
  const modal = document.getElementById('projectsPromptModal');
  if (modal) modal.remove();
}

function openProjectsPromptModal(options) {
  closeProjectsPromptModal();

  const {
    title = 'Confirmar',
    description = '',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    inputPlaceholder = '',
    inputValue = '',
    requireValue = false,
    onConfirm
  } = options || {};

  const overlay = document.createElement('div');
  overlay.id = 'projectsPromptModal';
  overlay.className = 'modal-overlay show';
  overlay.style.zIndex = '100000';

  overlay.innerHTML = `
    <div class="modal-content" style="max-width:420px;display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
        <div>
          <h3 style="margin:0;font-size:20px;font-weight:800;color:#fff;">${escapeProjectHtml(title)}</h3>
          ${description ? `<p style="margin:8px 0 0;color:rgba(255,255,255,0.6);font-size:13px;line-height:1.5;">${escapeProjectHtml(description)}</p>` : ''}
        </div>
        <button type="button" data-projects-prompt-close class="btn-secondary projects-btn-inline" style="padding:8px 12px;">Fechar</button>
      </div>
      ${
        requireValue
          ? `<input id="projectsPromptInput" class="finance-input" type="text" placeholder="${escapeProjectHtml(inputPlaceholder)}" value="${escapeProjectHtml(inputValue)}">`
          : ''
      }
      <div style="display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap;">
        <button type="button" data-projects-prompt-close class="btn-secondary projects-btn-inline">${escapeProjectHtml(cancelLabel)}</button>
        <button type="button" id="projectsPromptConfirm" class="btn-primary projects-btn-inline">${escapeProjectHtml(confirmLabel)}</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeProjectsPromptModal();
  });

  document.body.appendChild(overlay);

  overlay.querySelectorAll('[data-projects-prompt-close]').forEach((btn) => {
    btn.onclick = () => closeProjectsPromptModal();
  });

  const input = document.getElementById('projectsPromptInput');
  if (input) {
    setTimeout(() => {
      input.focus();
      input.select();
    }, 30);
    input.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        document.getElementById('projectsPromptConfirm')?.click();
      }
    };
  }

  const confirmBtn = document.getElementById('projectsPromptConfirm');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      const rawValue = input ? input.value.trim() : '';
      if (requireValue && !rawValue) {
        notifyProjectMessage('Preencha o valor antes de continuar.', 'warn');
        input?.focus();
        return;
      }

      const maybePromise = typeof onConfirm === 'function' ? onConfirm(rawValue) : null;
      Promise.resolve(maybePromise)
        .then(() => {
          closeProjectsPromptModal();
        })
        .catch((error) => {
          const message = error && error.message ? error.message : 'Nao foi possivel concluir a acao.';
          notifyProjectMessage(message, 'error');
        });
    };
  }
}


// === Quick Project Modal (1-click create) ===
window.openQuickProjectModal = function () {
  const existing = document.getElementById('projectsQuickModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'projectsQuickModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);';

  overlay.innerHTML = `
    <div style="background:#12121c;border:1px solid rgba(255,255,255,0.1);border-radius:28px;padding:36px;width:100%;max-width:440px;display:flex;flex-direction:column;gap:20px;box-shadow:0 32px 80px rgba(0,0,0,0.6);">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <h2 style="margin:0;font-size:20px;font-weight:800;color:#fff">Novo projeto</h2>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.4)">Cria em 3 segundos.</p>
        </div>
        <button type="button" data-projects-quick-close style="background:rgba(255,255,255,0.06);border:none;border-radius:12px;width:36px;height:36px;cursor:pointer;color:rgba(255,255,255,0.6);font-size:18px;display:flex;align-items:center;justify-content:center">x</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#bfdbfe;margin-bottom:6px;font-weight:700">Nome do projeto *</label>
          <input id="qpmName" class="finance-input" type="text" placeholder="Ex: Landing Page - Cliente X" autofocus style="width:100%;box-sizing:border-box">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#bfdbfe;margin-bottom:6px;font-weight:700">Cliente</label>
            <input id="qpmClient" class="finance-input" type="text" placeholder="Nome do cliente" style="width:100%;box-sizing:border-box">
          </div>
          <div>
            <label style="display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#bfdbfe;margin-bottom:6px;font-weight:700">Tipo</label>
            <input id="qpmType" class="finance-input" type="text" placeholder="LP, Loja, etc" style="width:100%;box-sizing:border-box">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#bfdbfe;margin-bottom:6px;font-weight:700">Valor (R$)</label>
            <input id="qpmValue" class="finance-input" type="number" min="0" step="0.01" placeholder="650,00" style="width:100%;box-sizing:border-box">
          </div>
          <div>
            <label style="display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#bfdbfe;margin-bottom:6px;font-weight:700">Deadline</label>
            <input id="qpmDeadline" class="finance-input" type="date" style="width:100%;box-sizing:border-box">
          </div>
        </div>
      </div>
      <div style="display:flex;gap:12px;justify-content:flex-end">
        <button type="button" data-projects-quick-close class="btn-secondary" style="width:auto;padding:13px 20px;border-radius:16px">Cancelar</button>
        <button type="button" id="btnProjectsQuickCreate" class="btn-primary" style="width:auto;padding:13px 20px;border-radius:16px;background:#4D6BFE">Criar projeto</button>
      </div>
    </div>`;

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  overlay.querySelectorAll('[data-projects-quick-close]').forEach((btn) => {
    btn.onclick = () => overlay.remove();
  });
  const quickCreateBtn = document.getElementById('btnProjectsQuickCreate');
  if (quickCreateBtn) quickCreateBtn.onclick = () => quickCreateProject();
  const quickInput = document.getElementById('qpmName');
  if (quickInput) {
    quickInput.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        quickCreateProject();
      }
    };
  }
  setTimeout(() => document.getElementById('qpmName') && document.getElementById('qpmName').focus(), 50);
};

window.quickCreateProject = function () {
  const name = document.getElementById('qpmName').value.trim();
  if (!name) { document.getElementById('qpmName').focus(); return; }
  const newProject = {
    id: createProjectId('proj'),
    name,
    clientName: document.getElementById('qpmClient').value.trim(),
    serviceType: document.getElementById('qpmType').value.trim(),
    status: 'active',
    expectedValue: Number(document.getElementById('qpmValue').value) || 0,
    deadline: document.getElementById('qpmDeadline').value || '',
    isPaid: false,
    isDraft: false,
    startDate: localDateStr(),
    completionDate: '',
    notes: '',
    templateTasks: [],
    collapseSubtasks: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  projectsState = normalizeProjectsState(projectsState);
  projectsState.projects.unshift(newProject);
  persistProjectsStateLocal();
  scheduleProjectsSync();
  const modal = document.getElementById('projectsQuickModal');
  if (modal) modal.remove();
  if (currentView === 'projects') renderProjectsView();
  if (currentView === 'finance') renderFinanceView();
};

function getUrgentProjects(allProjects, days = 5) {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() + days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const todayStr = localDateStr();
  return allProjects
    .filter((p) =>
      !p.isDraft && !p.completionDate && p.status !== 'archived' &&
      p.deadline && p.deadline >= todayStr && p.deadline <= cutoffStr
    )
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));
}

function getProjectProgressRate(projectId) {
  const candidates = collectProjectTaskCandidates({ includeLinked: true, max: 200, projectId });
  if (candidates.length === 0) return null;
  const done = candidates.filter((c) => c.task.completed).length;
  return { done, total: candidates.length, pct: Math.round((done / candidates.length) * 100) };
}


let projectsFilter = 'all';
window.setProjectsFilter = function (filter) {
  projectsFilter = filter || 'all';
  renderProjectsView();
};

window.addTaskInsideProject = function (projectId) {
  const project = findProjectById(projectId);
  if (!project) return;
  openProjectsPromptModal({
    title: 'Nova tarefa do projeto',
    description: `A tarefa entra em Hoje e ja fica ligada a ${project.name}.`,
    confirmLabel: 'Criar tarefa',
    requireValue: true,
    inputPlaceholder: 'Nome da tarefa',
    onConfirm: (text) => {
      const dateStr = localDateStr();
      const period = 'Tarefas';
      const currentList = allTasksData[dateStr]?.[period] || [];
      const newTask = {
        text,
        completed: false,
        color: 'default',
        type: 'OPERATIONAL',
        priority: null,
        parent_id: null,
        position: currentList.length,
        isHabit: false,
        supabaseId: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
        timerTotalMs: 0,
        timerStartedAt: null,
        timerLastStoppedAt: null,
        timerSessionsCount: 0,
        projectId: project.id,
        projectName: project.name
      };
      if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
      if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];
      allTasksData[dateStr][period].push(newTask);
      saveToLocalStorage();
      syncTaskToSupabase(dateStr, period, newTask);
      if (currentView === 'projects') renderProjectsView();
      renderView();
      notifyProjectMessage('Tarefa criada dentro do projeto.', 'success');
    }
  });
};

window.archiveProject = function (projectId) {
  openProjectsPromptModal({
    title: 'Arquivar projeto',
    description: 'O projeto sai da operacao ativa, mas continua salvo no historico.',
    confirmLabel: 'Arquivar',
    onConfirm: () => {
      updateProjectRecord(projectId, (project) => ({ ...project, status: 'archived' }));
      if (currentView === 'projects') renderProjectsView();
      notifyProjectMessage('Projeto arquivado.', 'success');
    }
  });
};

window.deleteProject = function (projectId) {
  openProjectsPromptModal({
    title: 'Remover projeto',
    description: 'Essa acao apaga o projeto permanentemente da base local e do sync.',
    confirmLabel: 'Remover',
    onConfirm: () => {
      projectsState = normalizeProjectsState(projectsState);
      projectsState.projects = projectsState.projects.filter((p) => p.id !== projectId);
      persistProjectsStateLocal();
      scheduleProjectsSync();
      if (currentView === 'projects') renderProjectsView();
      notifyProjectMessage('Projeto removido.', 'success');
    }
  });
};

function getProjectStatus(project, today) {
  if (project.isDraft || project.status === 'draft') return { label: 'Rascunho', cls: 'projects-badge--draft' };
  if (project.status === 'archived') return { label: 'Arquivado', cls: 'projects-badge--archived' };
  if (project.completionDate) {
    if (project.isPaid) return { label: 'ConcluÃ­do e pago', cls: 'projects-badge--done-paid' };
    return { label: 'ConcluÃ­do', cls: 'projects-badge--done' };
  }
  if (project.deadline && project.deadline < today) return { label: 'Atrasado', cls: 'projects-badge--late' };
  return { label: 'Em andamento', cls: 'projects-badge--active' };
}

function filterProjects(projects, filter, today) {
  if (filter === 'all') return projects;
  if (filter === 'active') return projects.filter((p) => !p.completionDate && !p.isDraft && p.status !== 'archived');
  if (filter === 'late') return projects.filter((p) => !p.completionDate && p.deadline && p.deadline < today && !p.isDraft);
  if (filter === 'paid') return projects.filter((p) => p.isPaid);
  if (filter === 'unpaid') return projects.filter((p) => !p.isPaid && !p.isDraft);
  if (filter === 'draft') return projects.filter((p) => p.isDraft || p.status === 'draft');
  if (filter === 'done') return projects.filter((p) => !!p.completionDate);
  if (filter === 'archived') return projects.filter((p) => p.status === 'archived');
  return projects;
}

function escapeProjectHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });
}

function formatProjectDateShort(dateStr) {
  const value = String(dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Sem data';
  const parts = value.split('-');
  return `${parts[2]}/${parts[1]}`;
}

function getProjectDeadlineDiff(dateStr, todayStr = localDateStr()) {
  const value = String(dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const today = new Date(`${todayStr}T00:00:00`);
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(today.getTime()) || Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function getProjectAnchorStartDate(project, fallbackDateStr = localDateStr()) {
  const explicitStart = String(project?.startDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicitStart)) return explicitStart;

  const createdAt = String(project?.createdAt || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(createdAt)) return createdAt.slice(0, 10);

  return fallbackDateStr;
}

function getProjectAnchorEndDate(project) {
  const completionDate = String(project?.completionDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(completionDate)) return completionDate;

  const deadline = String(project?.deadline || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return deadline;

  return '';
}

function getProjectAnchorScheduleText(project, dateStr) {
  const completionDate = String(project?.completionDate || '').trim();
  if (completionDate) return `Vai ate ${formatProjectDateShort(completionDate)}`;

  const deadline = String(project?.deadline || '').trim();
  if (!deadline) return 'Projeto continuo';

  const diff = getProjectDeadlineDiff(deadline, dateStr);
  if (diff === null) return `Prazo ${formatProjectDateShort(deadline)}`;
  if (diff < 0) return `${Math.abs(diff)}d atrasado`;
  if (diff === 0) return 'Fecha hoje';
  if (diff === 1) return 'Fecha amanha';
  return `Fecha em ${diff} dias`;
}

function isProjectVisibleOnDate(project, dateStr) {
  if (!project || !project.name) return false;
  if (project.isDraft || project.status === 'draft' || project.status === 'archived') return false;

  const startDate = getProjectAnchorStartDate(project, dateStr);
  if (startDate && dateStr < startDate) return false;

  const endDate = getProjectAnchorEndDate(project);
  if (endDate && dateStr > endDate) return false;

  return true;
}

function getProjectAnchorSourceTask(projectId) {
  const linkedTasks = collectProjectTaskCandidates({ includeLinked: true, max: 200, projectId });
  if (linkedTasks.length === 0) return null;

  const rootTasks = linkedTasks.filter((entry) => !entry.task?.parent_id);
  const pool = rootTasks.length > 0 ? rootTasks : linkedTasks;

  return pool
    .slice()
    .sort((a, b) => {
      if (Boolean(a.task?.completed) !== Boolean(b.task?.completed)) return a.task?.completed ? 1 : -1;
      const positionDiff = Number(a.task?.position || 0) - Number(b.task?.position || 0);
      if (positionDiff !== 0) return positionDiff;
      return String(a.task?.text || '').localeCompare(String(b.task?.text || ''));
    })[0];
}

function getProjectMirrorEntriesForDate(dateStr, dayLabel = '') {
  const projects = sortProjectsForBoard(getProjectOptions(), dateStr).filter((project) =>
    isProjectVisibleOnDate(project, dateStr)
  );

  return projects.flatMap((project, order) => {
    const sourceEntry = getProjectAnchorSourceTask(project.id);
    const sourceTask = sourceEntry?.task || null;
    const hasRealTaskOnDate = collectProjectTaskCandidates({
      includeLinked: true,
      max: 200,
      projectId: project.id
    }).some((entry) => entry.dateStr === dateStr);

    if (!sourceEntry || !sourceTask || hasRealTaskOnDate) return [];

    const sourceList = allTasksData?.[sourceEntry.dateStr]?.[sourceEntry.period] || [];
    const subtree = collectTaskSubtree(sourceList, sourceTask);
    if (subtree.length === 0) return [];

    const childCountMap = new Map();
    subtree.forEach((entryTask) => {
      childCountMap.set(getTaskTreeId(entryTask), 0);
    });
    subtree.forEach((entryTask) => {
      if (!entryTask?.parent_id || !childCountMap.has(entryTask.parent_id)) return;
      childCountMap.set(entryTask.parent_id, (childCountMap.get(entryTask.parent_id) || 0) + 1);
    });

    const renderIndexBase = 100000 + order * 10000;

    return subtree
      .map((entryTask) => {
        const sourceIndex = sourceList.indexOf(entryTask);
        if (sourceIndex < 0) return null;

        return {
          task: {
            ...entryTask,
            isProjectMirror: true,
            projectId: project.id,
            projectName: entryTask.projectName || project.name,
            mirrorSourceDateStr: sourceEntry.dateStr,
            mirrorSourcePeriod: sourceEntry.period,
            mirrorSourceIndex: sourceIndex,
            projectScheduleText:
              entryTask === sourceTask ? getProjectAnchorScheduleText(project, dateStr) : '',
            projectStatusLabel:
              entryTask === sourceTask ? getProjectStatus(project, dateStr).label : '',
            renderChildrenCount: childCountMap.get(getTaskTreeId(entryTask)) || 0
          },
          day: dayLabel,
          dateStr,
          period: 'Projetos',
          originalIndex: renderIndexBase + sourceIndex
        };
      })
      .filter(Boolean);
  });
}

function getProjectPriorityScore(project, todayStr) {
  const deadlineDiff = getProjectDeadlineDiff(project.deadline, todayStr);
  let score = 0;

  if (project.completionDate && !project.isPaid) score += 110;
  if (deadlineDiff !== null) {
    if (deadlineDiff < 0) score += 140 + Math.abs(deadlineDiff);
    else if (deadlineDiff <= 2) score += 95 - deadlineDiff * 10;
    else if (deadlineDiff <= 7) score += 45 - deadlineDiff;
  }

  if (!project.completionDate && !project.isDraft && project.status !== 'archived') score += 20;
  score += Math.min(40, Number(project.tasks || 0));

  return score;
}

function sortProjectsForBoard(projects, todayStr) {
  return projects.slice().sort((a, b) => {
    const scoreDiff = getProjectPriorityScore(b, todayStr) - getProjectPriorityScore(a, todayStr);
    if (scoreDiff !== 0) return scoreDiff;

    const deadlineA = String(a.deadline || '9999-12-31');
    const deadlineB = String(b.deadline || '9999-12-31');
    const deadlineCmp = deadlineA.localeCompare(deadlineB);
    if (deadlineCmp !== 0) return deadlineCmp;

    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function getProjectActionHint(project, progress, todayStr) {
  const deadlineDiff = getProjectDeadlineDiff(project.deadline, todayStr);

  if (project.isDraft || project.status === 'draft') {
    return {
      label: 'Modelar',
      detail: 'Defina escopo e tarefas padrao antes de usar.',
      cls: 'projects-badge--draft'
    };
  }

  if (project.status === 'archived') {
    return {
      label: 'Arquivo',
      detail: 'Mantido so para historico e referencia.',
      cls: 'projects-badge--archived'
    };
  }

  if (project.completionDate && !project.isPaid) {
    return {
      label: 'Cobrar',
      detail: 'Entrega feita. Falta transformar em caixa.',
      cls: 'projects-badge--late'
    };
  }

  if (deadlineDiff !== null && deadlineDiff < 0) {
    return {
      label: 'Em atraso',
      detail: `${Math.abs(deadlineDiff)} dia(s) fora do prazo.`,
      cls: 'projects-badge--late'
    };
  }

  if (!progress || progress.total === 0) {
    return {
      label: 'Sem plano',
      detail: 'Linke tarefas para destravar acompanhamento real.',
      cls: 'projects-badge--focus'
    };
  }

  if (deadlineDiff !== null && deadlineDiff === 0) {
    return {
      label: 'Entrega hoje',
      detail: 'Dia de fechar pendencias e revisar escopo.',
      cls: 'projects-badge--focus'
    };
  }

  if (deadlineDiff !== null && deadlineDiff > 0 && deadlineDiff <= 2) {
    return {
      label: 'Sprint final',
      detail: `Faltam ${deadlineDiff} dia(s) para o prazo.`,
      cls: 'projects-badge--focus'
    };
  }

  if (project.completionDate && project.isPaid) {
    return {
      label: 'Fechado',
      detail: 'Projeto entregue e pagamento confirmado.',
      cls: 'projects-badge--done-paid'
    };
  }

  if (progress.pct < 35) {
    return {
      label: 'Ganhar tracao',
      detail: `${progress.done}/${progress.total} tarefas concluidas ate agora.`,
      cls: 'projects-badge--focus'
    };
  }

  if (project.isPaid) {
    return {
      label: 'Caixa ok',
      detail: 'Pagamento confirmado. Agora e execucao.',
      cls: 'projects-badge--paid'
    };
  }

  return {
    label: 'Operando',
    detail: `${progress.done}/${progress.total} tarefas concluidas.`,
    cls: 'projects-badge--active'
  };
}

function buildProjectsBoardSections(projects, filter, todayStr) {
  const sorted = sortProjectsForBoard(projects, todayStr);

  if (filter !== 'all') {
    const filterLabels = {
      active: ['Ativos', 'Projetos em execucao agora.'],
      late: ['Em atraso', 'Projetos que exigem resposta imediata.'],
      paid: ['Pagos', 'Projetos com pagamento confirmado.'],
      unpaid: ['Nao pagos', 'Projetos que ainda nao viraram caixa.'],
      draft: ['Rascunhos', 'Estruturas e templates em preparacao.'],
      done: ['Concluidos', 'Entregas finalizadas.'],
      archived: ['Arquivados', 'Historico e referencia.']
    };
    const labels = filterLabels[filter] || ['Todos', 'Visao geral da operacao.'];
    return [{ key: filter, title: labels[0], subtitle: labels[1], items: sorted }];
  }

  const attention = [];
  const execution = [];
  const closed = [];
  const library = [];

  sorted.forEach((project) => {
    const deadlineDiff = getProjectDeadlineDiff(project.deadline, todayStr);
    const needsAttention =
      (!project.completionDate && deadlineDiff !== null && deadlineDiff <= 2) ||
      (!project.completionDate && deadlineDiff !== null && deadlineDiff < 0) ||
      (project.completionDate && !project.isPaid);

    if (project.isDraft || project.status === 'draft' || project.status === 'archived') {
      library.push(project);
      return;
    }

    if (project.completionDate) {
      closed.push(project);
      return;
    }

    if (needsAttention) {
      attention.push(project);
      return;
    }

    execution.push(project);
  });

  return [
    {
      key: 'attention',
      title: 'Radar',
      subtitle: 'Onde vale entrar primeiro para nao perder prazo ou caixa.',
      items: attention
    },
    {
      key: 'execution',
      title: 'Execucao',
      subtitle: 'Projetos rodando com espaco para avancar sem pressa toxica.',
      items: execution
    },
    {
      key: 'closed',
      title: 'Fechamento',
      subtitle: 'Entregas encerradas ou quase encerradas.',
      items: closed
    },
    {
      key: 'library',
      title: 'Biblioteca',
      subtitle: 'Templates, rascunhos e historico arquivado.',
      items: library
    }
  ].filter((section) => section.items.length > 0);
}
