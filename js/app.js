// --- Supabase & Storage Logic ---
const SUPABASE_URL = window._FLOWLY_SUPABASE_URL || '';
const SUPABASE_KEY = window._FLOWLY_SUPABASE_KEY || '';
const { createClient } = window.supabase;
const FLOWLY_DEBUG =
  localStorage.getItem((window.FlowlyConfig && window.FlowlyConfig.DEBUG_KEY) || 'flowly_debug') ===
  'true';

function debugLog(...args) {
  if (FLOWLY_DEBUG) {
    console.log(...args);
  }
}

// Inicializar flowly_persist_session como true por padrÃ£o (checkbox vem marcado)
if (localStorage.getItem('flowly_persist_session') === null) {
  localStorage.setItem('flowly_persist_session', 'true');
}

const customStorage = {
  getItem: (key) => {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    debugLog('[Storage] getItem:', key, value ? 'found' : 'not found');
    return value;
  },
  setItem: (key, value) => {
    const shouldPersist = localStorage.getItem('flowly_persist_session') !== 'false';
    debugLog('[Storage] setItem:', key, 'persist:', shouldPersist);
    if (shouldPersist) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    debugLog('[Storage] removeItem:', key);
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'flowly-auth'
  }
});

const width = 600;
// Estado compartilhado carregado via js/flowly-state.js

// Utilitarios compartilhados carregados via js/flowly-utils.js e js/core/*.js
function getRoutineKey(task) {
  if (typeof getRecurringTaskIdentity === 'function') {
    return getRecurringTaskIdentity(task);
  }
  if (!task) return '';
  return task.routineKey || task.routineId || task.supabaseId || task.text || '';
}

// Helper para JSON seguro
// Estado base carregado via js/flowly-state.js

function getTaskTypes() {
  if (customTaskTypes && customTaskTypes.length > 0) return customTaskTypes;
  return [
    { id: 'MONEY', name: 'Money', color: '#30D158' },
    { id: 'BODY', name: 'Body', color: '#5E5CE6' },
    { id: 'MIND', name: 'Mind', color: '#BF5AF2' },
    { id: 'SPIRIT', name: 'Spirit', color: '#FFD60A' },
    { id: 'OPERATIONAL', name: 'Operational', color: '#8E8E93' }
  ];
}

function getDefaultTaskPriorities() {
  return [
    { id: 'money', name: 'Dinheiro', color: '#30D158' },
    { id: 'urgent', name: 'Urgente', color: '#FF453A' },
    { id: 'important', name: 'Importante', color: '#FF9F0A' },
    { id: 'simple', name: 'Simples', color: '#FFD60A' }
  ];
}

function getTaskPriorities() {
  if (customTaskPriorities && customTaskPriorities.length > 0) return customTaskPriorities;
  return getDefaultTaskPriorities();
}

function ensureMoneyPriorityOption() {
  const defaults = getDefaultTaskPriorities();
  if (!Array.isArray(customTaskPriorities) || customTaskPriorities.length === 0) {
    customTaskPriorities = defaults.map((item) => ({ ...item }));
    return;
  }

  const existingMap = new Map(customTaskPriorities.map((item) => [String(item.id || '').toLowerCase(), item]));
  const defaultIds = new Set(defaults.map((item) => String(item.id || '').toLowerCase()));
  const mergedDefaults = defaults.map((item) => {
    const existing = existingMap.get(String(item.id).toLowerCase());
    return existing ? { ...existing, name: item.name, color: item.color } : { ...item };
  });
  const customExtras = customTaskPriorities.filter((item) => {
    const id = String((item && item.id) || '').toLowerCase();
    return id && !defaultIds.has(id);
  });

  customTaskPriorities = [...mergedDefaults, ...customExtras];
}

// Estruturas compartilhadas carregadas via js/flowly-state.js
// Estado de recorr?ncia carregado via js/flowly-state.js


// FunÃ§Ã£o para abrir o modal de ediÃ§Ã£o
// toggleTaskExpansion e deleteTaskInline movidos para js/tasks/task-expansion-runtime.js

function getPriorityColorName(priority) {
  switch (priority) {
    case 'urgent':
      return 'red';
    case 'important':
      return 'orange';
    case 'simple':
      return 'yellow';
    case 'money':
      return 'green';
    default:
      return 'default';
  }
}



// ===== FUNÃ‡Ã•ES DE SALVAMENTO =====
// Persistencia local movida para js/core/app-storage.js


// ===== DRAG AND DROP =====

// Retorna tarefas de rotina para exibiÃ§Ã£o (NÃƒO persiste em allTasksData)
function getRoutineTasksForDate(dateStr) {
  if (routineService) return routineService.getRoutineTasksForDate(dateStr);
  return [];
}

// Compatibilidade: manter hydrateRoutineForDate como no-op para nÃ£o quebrar chamadas existentes
function hydrateRoutineForDate(dateStr) {
  // NÃ£o faz mais nada - rotinas sÃ£o geradas dinamicamente
}

function reorderRoutineTasksForDate(dateStr, sourceRoutineKey, insertAt) {
  if (!sourceRoutineKey) return false;

  const routineKeys = getRoutineTasksForDate(dateStr)
    .map((task) => getRoutineKey(task))
    .filter(Boolean);

  const sourceIdx = routineKeys.indexOf(sourceRoutineKey);
  if (sourceIdx < 0) return false;

  let targetIdx = Number.isFinite(insertAt) ? insertAt : routineKeys.length;
  if (sourceIdx < targetIdx) targetIdx -= 1;

  routineKeys.splice(sourceIdx, 1);
  targetIdx = Math.max(0, Math.min(targetIdx, routineKeys.length));
  routineKeys.splice(targetIdx, 0, sourceRoutineKey);

  const desiredOrder = new Map(routineKeys.map((key, idx) => [key, idx]));
  const recurringIndices = [];
  const recurringSubset = [];

  allRecurringTasks.forEach((task, idx) => {
    const key = getRoutineKey(task);
    if (!desiredOrder.has(key)) return;
    recurringIndices.push(idx);
    recurringSubset.push(task);
  });

  if (recurringSubset.length > 1) {
    recurringSubset.sort(
      (a, b) => desiredOrder.get(getRoutineKey(a)) - desiredOrder.get(getRoutineKey(b))
    );
    recurringIndices.forEach((globalIdx, subsetIdx) => {
      allRecurringTasks[globalIdx] = recurringSubset[subsetIdx];
    });
  }

  allRecurringTasks.forEach((task, idx) => {
    if (!task || typeof task !== 'object') return;
    task.order = idx;
    task._syncPending = true;
    if (typeof ensureRecurringTaskIdentity === 'function') {
      ensureRecurringTaskIdentity(task);
    }
  });

  saveToLocalStorage();
  if (typeof syncRecurringTasksToSupabase === 'function') {
    syncRecurringTasksToSupabase();
  }

  return true;
}

// Fallback: drop na coluna (nÃ£o em drop zone) â†’ insere no fim da lista do dia
function columnDropFallback(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!draggedTask || draggedTask.isRoutineDrag) return;

  const col = e.target.closest('.day-column');
  if (!col) return;

  const targetDateStr = col.dataset.date;
  const targetPeriod = 'Tarefas';
  const sourceDateStr = draggedTask.dateStr;
  const sourcePeriod = draggedTask.period;
  const sourceIndex = draggedTask.index;

  const targetList = allTasksData?.[targetDateStr]?.[targetPeriod] || [];
  const moveResult = moveTaskSubtree({
    sourceDateStr,
    sourcePeriod,
    sourceIndex,
    targetDateStr,
    targetPeriod,
    insertAt: targetList.length
  });

  if (moveResult.moved) {
    saveToLocalStorage();
    (moveResult.datesToSync || []).forEach((date) => syncDateToSupabase(date));
  }

  draggedTask = null;
  renderView();
}

// Helper Time Formatter (Global)
function formatTaskTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getViewSettings() {
  return safeJSONParse(localStorage.getItem('flowly_view_settings'), {});
}

// Auth e wrappers de sincronizacao movidos para js/core/auth-runtime.js

// Sincroniza allRecurringTasks com Supabase de forma inteligente (Diff Sync)
// Runtime de sincronizacao movido para js/core/sync-runtime.js


// Bootstrap de servicos movido para js/core/service-bootstrap.js
initializeFlowlyServices();

// renderRoutineView e helpers de rotina movidos para js/views/routine.js
// renderView movido para js/core/view-runtime.js

// renderWeek movido para js/views/week.js
// task tree helpers movidos para js/tasks/flowly-tasks-core.js
// task ui helpers movidos para js/tasks/flowly-tasks-ui.js
// navegacao/semana movidas para js/core/navigation-runtime.js
// normalizacao de tarefas movida para js/core/task-normalizer-runtime.js

initFlowlyAppRuntime();

// Bootstrap da interface movido para js/core/ui-bootstrap.js

