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

// Inicializar flowly_persist_session como true por padrão (checkbox vem marcado)
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

let currentUser = null;
let authSession = null;
let tasksRepo = null;
let tasksSyncService = null;
let routineService = null;
let analyticsService = null;
let localStore = null;
let eventBus = null;
let errorHandler = null;
let viewDispatcher = null;
let currentView = 'today';
let draggedTask = null; // usado pelo sistema real de D&D (handleDragStart / handleDropZoneDrop)
let currentEditingTask = null;
const width = 600;
let currentWeekOffset = 0; // 0 = semana atual, -1 = semana passada, +1 = próxima semana
let currentMonthOffset = 0; // 0 = mês atual
let sextaState = safeJSONParse(localStorage.getItem('flowly_sexta_state'), {
  lastAction: '',
  notes: [],
  suggestions: [],
  chatHistory: [],
  memories: [],
  activeTab: 'chat'
});
let syncStatus = {
  state: navigator.onLine ? 'saved' : 'offline',
  text: navigator.onLine ? 'Tudo salvo' : 'Sem conexao',
  hideTimer: null,
  busyCount: 0,
  lastSavedAt: 0
};

function renderSyncStatus() {
  const bar = document.getElementById('syncStatusBar');
  const textEl = document.getElementById('syncStatusText');
  if (!bar || !textEl) return;

  bar.dataset.state = syncStatus.state;
  textEl.textContent = syncStatus.text;
  bar.classList.toggle('hidden', false);
}

function setSyncStatus(state, text, options = {}) {
  if (syncStatus.hideTimer) {
    clearTimeout(syncStatus.hideTimer);
    syncStatus.hideTimer = null;
  }

  syncStatus.state = state;
  syncStatus.text = text;
  renderSyncStatus();

  if (options.autoSaved) {
    syncStatus.lastSavedAt = Date.now();
    syncStatus.hideTimer = setTimeout(() => {
      if (syncStatus.state === 'saved') {
        syncStatus.text = 'Tudo salvo';
        renderSyncStatus();
      }
    }, options.autoSaved);
  }
}

function startSyncActivity(text = 'Sincronizando...') {
  syncStatus.busyCount += 1;
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? text : 'Sem conexao');
}

function finishSyncActivity(success = true, errorText = '') {
  syncStatus.busyCount = Math.max(0, syncStatus.busyCount - 1);
  if (!navigator.onLine) {
    setSyncStatus('offline', 'Sem conexao');
    return;
  }
  if (!success) {
    setSyncStatus('error', errorText || 'Falha ao sincronizar');
    return;
  }
  if (syncStatus.busyCount > 0) {
    setSyncStatus('syncing', 'Sincronizando...');
    return;
  }
  setSyncStatus('saved', 'Tudo salvo na nuvem', { autoSaved: 2200 });
}

// View Management Functions
function setView(view) {
  // Redirect routine to analytics with routine tab active
  if (view === 'routine') {
    const av = document.getElementById('analyticsView');
    if (av) av.dataset.mainTab = 'routine';
    view = 'analytics';
  }
  currentView = view;

  // Hide all views
  const views = [
    'monthView',
    'weekGrid',
    'todayView',
    'routineView',
    'analyticsView',
    'financeView',
    'projectsView',
    'sextaView',
    'settingsView'
  ];
  views.forEach((v) => {
    const el = document.getElementById(v);
    if (el) el.classList.add('hidden');
  });

  // Update navigation buttons
  document.querySelectorAll('.segment-btn, .sidebar-nav-btn').forEach((btn) => btn.classList.remove('active'));
  const btnMap = {
    month: 'btnMonth',
    week: 'btnWeek',
    today: 'btnToday',
    analytics: 'btnAnalytics',
    finance: 'btnFinance',
    projects: 'btnProjects',
    sexta: 'btnSexta',
    settings: 'btnSettings'
  };
  const activeBtn = document.getElementById(btnMap[view]);
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.mobile-nav-btn').forEach((btn) => btn.classList.remove('active'));
  const mobileBtnMap = {
    week: 'btnMobileWeek',
    analytics: 'btnMobileAnalytics',
    finance: 'btnMobileFinance',
    projects: 'btnMobileProjects',
    today: 'btnMobileToday',
    sexta: 'btnMobileSexta',
    settings: 'btnMobileSettings'
  };
  const mobileActiveBtn = document.getElementById(mobileBtnMap[view]);
  if (mobileActiveBtn) mobileActiveBtn.classList.add('active');

  // Show week navigation only for week view
  const weekNav = document.getElementById('weekNav');
  if (weekNav) {
    weekNav.style.display = view === 'week' ? 'flex' : 'none';
  }

  renderView();
}

// Funções auxiliares de data (ISO Local Robusto)
function localDateStr(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatElapsedShort(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'agora';

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    if (hours > 0) return `${days}d ${hours}h`;
    return `${days}d`;
  }

  if (hours > 0) {
    if (minutes > 0) return `${hours}h ${minutes}m`;
    return `${hours}h`;
  }

  return `${Math.max(1, minutes)}m`;
}

function formatDurationClock(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function normalizeTaskTimerData(task) {
  if (!task || typeof task !== 'object') return false;

  let changed = false;
  const normalizedTotal = Math.max(0, Number(task.timerTotalMs || 0) || 0);
  if (task.timerTotalMs !== normalizedTotal) {
    task.timerTotalMs = normalizedTotal;
    changed = true;
  }

  const normalizedSessions = Math.max(0, Math.floor(Number(task.timerSessionsCount || 0) || 0));
  if (task.timerSessionsCount !== normalizedSessions) {
    task.timerSessionsCount = normalizedSessions;
    changed = true;
  }

  if (task.timerStartedAt) {
    const startedTs = new Date(task.timerStartedAt).getTime();
    if (!Number.isFinite(startedTs)) {
      task.timerStartedAt = null;
      changed = true;
    }
  } else if (task.timerStartedAt !== null) {
    task.timerStartedAt = null;
    changed = true;
  }

  if (task.timerLastStoppedAt) {
    const stoppedTs = new Date(task.timerLastStoppedAt).getTime();
    if (!Number.isFinite(stoppedTs)) {
      task.timerLastStoppedAt = null;
      changed = true;
    }
  } else if (task.timerLastStoppedAt !== null) {
    task.timerLastStoppedAt = null;
    changed = true;
  }

  return changed;
}

function getTaskTimerTotalMs(task, now = Date.now()) {
  if (!task) return 0;
  normalizeTaskTimerData(task);

  let total = Math.max(0, Number(task.timerTotalMs || 0) || 0);
  if (!task.timerStartedAt) return total;

  const startedTs = new Date(task.timerStartedAt).getTime();
  if (!Number.isFinite(startedTs)) return total;

  return total + Math.max(0, now - startedTs);
}

function forEachPersistedTask(callback) {
  Object.entries(allTasksData || {}).forEach(([dateStr, periods]) => {
    Object.entries(periods || {}).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks)) return;
      tasks.forEach((task, index) => {
        if (!task || task.isWeeklyRecurring || task.isRoutine || task.isRecurring) return;
        callback(task, { dateStr, period, index });
      });
    });
  });
}

function stopTaskTimer(task, stoppedAtIso = new Date().toISOString()) {
  if (!task) return false;
  normalizeTaskTimerData(task);
  if (!task.timerStartedAt) return false;

  const startedTs = new Date(task.timerStartedAt).getTime();
  const stoppedTs = new Date(stoppedAtIso).getTime();
  const elapsedMs =
    Number.isFinite(startedTs) && Number.isFinite(stoppedTs) ? Math.max(0, stoppedTs - startedTs) : 0;

  task.timerTotalMs = Math.max(0, Number(task.timerTotalMs || 0) + elapsedMs);
  task.timerStartedAt = null;
  task.timerLastStoppedAt = stoppedAtIso;
  task.updatedAt = stoppedAtIso;
  return true;
}

function stopOtherActiveTaskTimers(currentTask, stoppedAtIso = new Date().toISOString()) {
  const affectedEntries = [];

  forEachPersistedTask((task, ctx) => {
    if (task === currentTask || !task.timerStartedAt) return;
    if (stopTaskTimer(task, stoppedAtIso)) affectedEntries.push(ctx);
  });

  return affectedEntries;
}

function startTaskTimer(task, startedAtIso = new Date().toISOString()) {
  if (!task) return [];
  normalizeTaskTimerData(task);

  const affectedEntries = stopOtherActiveTaskTimers(task, startedAtIso);
  if (!task.timerStartedAt) {
    task.timerStartedAt = startedAtIso;
    task.timerSessionsCount = Math.max(0, Number(task.timerSessionsCount || 0) || 0) + 1;
    task.updatedAt = startedAtIso;
  }

  return affectedEntries;
}

function resetTaskTimer(task) {
  if (!task) return;
  task.timerTotalMs = 0;
  task.timerStartedAt = null;
  task.timerLastStoppedAt = null;
  task.timerSessionsCount = 0;
  task.updatedAt = new Date().toISOString();
}

function normalizeFlowlyThemeSettings(rawSettings = {}) {
  const base = { ...FLOWLY_THEME_DEFAULTS, ...(rawSettings || {}) };
  if (!FLOWLY_FONT_PRESETS[base.fontMain]) base.fontMain = FLOWLY_THEME_DEFAULTS.fontMain;
  if (!FLOWLY_FONT_PRESETS[base.fontDisplay]) base.fontDisplay = FLOWLY_THEME_DEFAULTS.fontDisplay;
  if (!FLOWLY_RADIUS_PRESETS[base.radiusScale]) base.radiusScale = FLOWLY_THEME_DEFAULTS.radiusScale;
  return base;
}

function normalizeFlowlyAISettings(rawSettings = {}) {
  const base = { ...FLOWLY_AI_DEFAULTS, ...(rawSettings || {}) };
  base.enabled = base.enabled === true;
  base.provider = String(base.provider || 'local').trim() || 'local';
  base.model = String(base.model || FLOWLY_AI_DEFAULTS.model).trim() || FLOWLY_AI_DEFAULTS.model;
  base.endpoint = String(base.endpoint || '').trim();
  base.apiKey = String(base.apiKey || '').trim();
  base.systemPrompt =
    String(base.systemPrompt || FLOWLY_AI_DEFAULTS.systemPrompt).trim() ||
    FLOWLY_AI_DEFAULTS.systemPrompt;
  return base;
}

function getFlowlyAISettings() {
  return normalizeFlowlyAISettings(
    safeJSONParse(localStorage.getItem(FLOWLY_AI_STORAGE_KEY), FLOWLY_AI_DEFAULTS)
  );
}

function saveFlowlyAISettings(nextSettings) {
  const normalized = normalizeFlowlyAISettings(nextSettings);
  localStorage.setItem(FLOWLY_AI_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function getFlowlyThemeSettings() {
  return normalizeFlowlyThemeSettings(
    safeJSONParse(localStorage.getItem(FLOWLY_THEME_STORAGE_KEY), FLOWLY_THEME_DEFAULTS)
  );
}

function saveFlowlyThemeSettings(nextSettings) {
  const normalized = normalizeFlowlyThemeSettings(nextSettings);
  localStorage.setItem(FLOWLY_THEME_STORAGE_KEY, JSON.stringify(normalized));
  applyFlowlyThemeSettings(normalized);
  return normalized;
}

function applyFlowlyThemeSettings(settings = getFlowlyThemeSettings()) {
  const normalized = normalizeFlowlyThemeSettings(settings);
  const root = document.documentElement;
  const mainFont = FLOWLY_FONT_PRESETS[normalized.fontMain] || FLOWLY_FONT_PRESETS.system;
  const displayFont = FLOWLY_FONT_PRESETS[normalized.fontDisplay] || FLOWLY_FONT_PRESETS.system;
  const radius = FLOWLY_RADIUS_PRESETS[normalized.radiusScale] || FLOWLY_RADIUS_PRESETS.soft;

  root.style.setProperty('--accent-blue', normalized.primaryColor);
  root.style.setProperty('--accent-orange', normalized.secondaryColor);
  root.style.setProperty('--font-main', mainFont.main);
  root.style.setProperty('--font-display', displayFont.display);
  root.style.setProperty('--radius-lg', radius.lg);
  root.style.setProperty('--radius-md', radius.md);

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', normalized.primaryColor);
  }
}

function getTaskFromDomPointer(dateStr, period, index) {
  const numericIndex = Number(index);
  if (!dateStr || !period || !Number.isInteger(numericIndex) || numericIndex < 0) return null;
  return allTasksData?.[dateStr]?.[period]?.[numericIndex] || null;
}

function refreshInlineTaskTimers() {
  document.querySelectorAll('.task-timer-meta[data-live-timer="1"]').forEach((node) => {
    const task = getTaskFromDomPointer(node.dataset.sourceDate, node.dataset.sourcePeriod, node.dataset.sourceIndex);
    if (!task) {
      node.remove();
      return;
    }

    const totalMs = getTaskTimerTotalMs(task);
    node.textContent = ` · ${formatDurationClock(totalMs)}`;
    node.classList.toggle('is-running', Boolean(task.timerStartedAt));
  });
}

function formatTimeSince(dateLike) {
  const ts = new Date(dateLike).getTime();
  if (!Number.isFinite(ts)) return 'sem registro';

  const diff = Date.now() - ts;
  if (diff <= 0) return 'agora';
  return `ha ${formatElapsedShort(diff)}`;
}

function formatLastCompletionDisplay(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return 'Sem tarefas concluidas';

  const completedAt = new Date(ts);
  const now = new Date();
  const hhmm = completedAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const isSameDay =
    completedAt.getFullYear() === now.getFullYear() &&
    completedAt.getMonth() === now.getMonth() &&
    completedAt.getDate() === now.getDate();

  if (isSameDay) return hhmm;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    completedAt.getFullYear() === yesterday.getFullYear() &&
    completedAt.getMonth() === yesterday.getMonth() &&
    completedAt.getDate() === yesterday.getDate();

  if (isYesterday) return `${hhmm} (dia anterior)`;

  const ddmm = completedAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  });
  return `${hhmm} (${ddmm})`;
}

function getLatestCompletionTimestamp() {
  let latest = 0;

  Object.values(allTasksData || {}).forEach((periods) => {
    Object.values(periods || {}).forEach((tasks) => {
      if (!Array.isArray(tasks)) return;
      tasks.forEach((task) => {
        if (!task || !task.completed || !task.completedAt) return;
        const ts = new Date(task.completedAt).getTime();
        if (Number.isFinite(ts) && ts > latest) latest = ts;
      });
    });
  });

  Object.values(habitsHistory || {}).forEach((historyByDate) => {
    Object.values(historyByDate || {}).forEach((value) => {
      if (typeof value !== 'string') return;
      const ts = new Date(value).getTime();
      if (Number.isFinite(ts) && ts > latest) latest = ts;
    });
  });

  return latest > 0 ? latest : null;
}

function getRoutineKey(task) {
  if (!task) return '';
  return task.routineKey || task.supabaseId || task.text || '';
}

// Helper para JSON seguro
function safeJSONParse(str, fallback) {
  if (localStore && typeof localStore.safeJSONParse === 'function') {
    return localStore.safeJSONParse(str, fallback);
  }
  try {
    return str ? JSON.parse(str) : fallback;
  } catch (e) {
    console.error('Erro ao fazer parse do JSON:', e);
    return fallback;
  }
}

// Data Structures
// NOVO: Tarefas recorrentes unificadas (substituem dailyRoutine e weeklyRecurringTasks)
// Formato: { text, daysOfWeek: [0-6], priority, createdAt }
let allRecurringTasks = safeJSONParse(localStorage.getItem('allRecurringTasks'), []);

// Custom Settings (from Supabase)
let customTaskTypes = [];
let customTaskPriorities = [];
let dbUserSettings = { enable_week_hover_animation: true };

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
  customTaskPriorities = defaults.map((item) => {
    const existing = existingMap.get(String(item.id).toLowerCase());
    return existing ? { ...existing, name: item.name, color: item.color } : { ...item };
  });
}

// Compatibilidade: manter dailyRoutine para migração (será removido após migrar)
let dailyRoutine = safeJSONParse(localStorage.getItem('dailyRoutine'), []);
let weeklyRecurringTasks = safeJSONParse(localStorage.getItem('weeklyRecurringTasks'), []);

// Estrutura expandida: armazena tarefas por data ISO (YYYY-MM-DD) e período
let allTasksData = safeJSONParse(localStorage.getItem('allTasksData'), {});
let collapsedTaskGroups = safeJSONParse(localStorage.getItem('flowlyCollapsedTaskGroups'), {});

// Compatibilidade: estrutura antiga para a semana atual
const weekData = {
  Segunda: {},
  Terça: {},
  Quarta: {},
  Quinta: {},
  Sexta: {},
  Sábado: {},
  Domingo: {}
};
let habitsHistory = safeJSONParse(localStorage.getItem('habitsHistory'), {});
let financeState = normalizeFinanceState(safeJSONParse(localStorage.getItem('flowlyFinanceState'), null));
let projectsState = normalizeProjectsState(safeJSONParse(localStorage.getItem('flowlyProjectsState'), null));
let financeSyncTimer = null;
let projectsSyncTimer = null;
let financeChartsState = { cashflow: null, category: null };
const FLOWLY_AI_STORAGE_KEY = 'flowly_ai_settings';
const FLOWLY_THEME_STORAGE_KEY = 'flowly_theme_settings';
const FLOWLY_SETTINGS_TAB_KEY = 'flowly_settings_tab';
const FLOWLY_AI_DEFAULTS = {
  enabled: false,
  provider: 'local',
  model: 'flowly-local-ops',
  endpoint: '',
  apiKey: '',
  systemPrompt:
    'Voce e a Sexta, assistente operacional do Flowly. Responda com objetividade, priorizacao e foco em execucao.'
};
const FLOWLY_THEME_DEFAULTS = {
  primaryColor: '#0A84FF',
  secondaryColor: '#FF9F0A',
  fontMain: 'system',
  fontDisplay: 'system',
  radiusScale: 'soft'
};
const FLOWLY_FONT_PRESETS = {
  system: {
    label: 'Sistema',
    main: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    display:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  geometric: {
    label: 'Geometrica',
    main: '"Avenir Next", "Futura", "Trebuchet MS", sans-serif',
    display: '"Avenir Next", "Futura", "Trebuchet MS", sans-serif'
  },
  editorial: {
    label: 'Editorial',
    main: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    display: '"Georgia", "Times New Roman", serif'
  },
  mono: {
    label: 'Mono',
    main: '"IBM Plex Sans", "Segoe UI", Arial, sans-serif',
    display: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace'
  }
};
const FLOWLY_RADIUS_PRESETS = {
  compact: { label: 'Compacto', lg: '12px', md: '8px' },
  soft: { label: 'Suave', lg: '16px', md: '10px' },
  rounded: { label: 'Arredondado', lg: '24px', md: '16px' }
};

applyFlowlyThemeSettings();

// Estado de conclusão de tarefas recorrentes por data
let routineCompletions = safeJSONParse(localStorage.getItem('routineCompletions'), {});
// Formato: { "taskText": { "2026-02-17": true, "2026-02-18": false } }

// --- Funções Globais do Analytics e Rotina ---

// Variáveis para edição
let currentEditingTaskRef = null;

// Função para abrir o modal de edição
window.toggleTaskExpansion = function (task, el) {
  const isExpanded =
    el.nextElementSibling && el.nextElementSibling.classList.contains('task-expansion');

  // Close other expansions smoothly
  document.querySelectorAll('.task-expansion').forEach((exp) => {
    if (typeof exp._cleanup === 'function') exp._cleanup();
    exp.style.opacity = '0';
    exp.style.maxHeight = '0px';
    exp.style.marginTop = '0px';
    exp.style.marginBottom = '0px';
    setTimeout(() => exp.remove(), 200);
  });

  if (isExpanded) return;

  const renderDateStr = el.dataset.date;
  const { period: renderPeriod, index: renderIndex } = el.dataset;
  const dateStr = el.dataset.sourceDate || renderDateStr;
  const period = el.dataset.sourcePeriod || renderPeriod;
  const index = el.dataset.sourceIndex || renderIndex;
  const numericIndex = Number(index);
  const isRecurring = !el.dataset.sourceDate && index === '-1';
  const isTimerEligible =
    !isRecurring && !task.isHabit && !task.isRoutine && !task.isRecurring && period !== 'Rotina';

  normalizeTaskTimerData(task);

  const exp = document.createElement('div');
  exp.className = 'task-expansion task-expansion--minimal';
  exp.style.opacity = '0';
  exp.style.maxHeight = '0px';
  exp.style.marginTop = '0px';
  exp.style.marginBottom = '0px';

  const reopenExpansion = () => {
    setTimeout(() => {
      const nextEl = Array.from(document.querySelectorAll('.task-item')).find(
        (node) =>
          node.dataset.date === renderDateStr &&
          node.dataset.period === renderPeriod &&
          node.dataset.index === String(renderIndex)
      );
      if (!nextEl) return;

      const nextTask = isRecurring ? task : allTasksData?.[dateStr]?.[period]?.[numericIndex];
      if (!nextTask) return;
      window.toggleTaskExpansion(nextTask, nextEl);
    }, 55);
  };

  const persistTaskChanges = ({ reopen = false, syncWholeDate = false } = {}) => {
    saveToLocalStorage();
    if (isRecurring) {
      syncRecurringTasksToSupabase();
    } else if (syncWholeDate) {
      syncDateToSupabase(dateStr);
    } else {
      syncTaskToSupabase(dateStr, period, task);
    }
    renderView();
    if (reopen) reopenExpansion();
  };

  const recDefinition = isRecurring ? allRecurringTasks.find((rt) => rt.text === task.text) : null;
  const repeatedMatch = getProjectOptions().find(
    (project) => task.text && task.text.toLowerCase().includes(project.name.toLowerCase())
  );

  const header = document.createElement('div');
  header.className = 'task-expansion-head';

  const kicker = document.createElement('div');
  kicker.className = 'task-expansion-kicker';
  kicker.textContent = isRecurring ? 'Rotina' : task.completed ? 'Concluida' : 'Tarefa';
  header.appendChild(kicker);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = task.text || '';
  nameInput.className = 'finance-input finance-input--full task-expansion-title-input';
  nameInput.setAttribute('maxlength', '180');
  header.appendChild(nameInput);

  const metaRow = document.createElement('div');
  metaRow.className = 'task-expansion-meta';

  const appendMetaPill = (text, modifier = '') => {
    const pill = document.createElement('span');
    pill.className = `task-expansion-meta-pill${modifier ? ` ${modifier}` : ''}`;
    pill.textContent = text;
    metaRow.appendChild(pill);
  };

  if (task.projectName) appendMetaPill(task.projectName);
  if (task.priority) {
    const prio = getTaskPriorities().find((item) => item.id === task.priority);
    if (prio) appendMetaPill(prio.name);
  }
  if (isTimerEligible && (task.timerStartedAt || getTaskTimerTotalMs(task) > 0)) {
    appendMetaPill(
      task.timerStartedAt
        ? `Em execucao · ${formatDurationClock(getTaskTimerTotalMs(task))}`
        : `Tempo · ${formatDurationClock(getTaskTimerTotalMs(task))}`,
      task.timerStartedAt ? 'is-running' : ''
    );
  }
  if (task.completed && task.completedAt) appendMetaPill(`Feita ${formatTimeSince(task.completedAt)}`);
  if (metaRow.childNodes.length > 0) header.appendChild(metaRow);
  exp.appendChild(header);

  const applyTaskRename = async () => {
    const newText = nameInput.value.trim();
    const oldText = task.text || '';

    if (!newText || newText === oldText) {
      nameInput.value = oldText;
      return;
    }

    if (
      isRecurring &&
      allRecurringTasks.some((t) => t !== recDefinition && String(t.text || '') === newText)
    ) {
      alert('Ja existe uma rotina com esse nome.');
      nameInput.value = oldText;
      return;
    }

    if (isRecurring && recDefinition) {
      recDefinition.text = newText;
      task.text = newText;

      if (habitsHistory[oldText] && !habitsHistory[newText]) {
        habitsHistory[newText] = habitsHistory[oldText];
        delete habitsHistory[oldText];
      }

      Object.values(allTasksData || {}).forEach((periods) => {
        Object.values(periods || {}).forEach((tasks) => {
          if (!Array.isArray(tasks)) return;
          tasks.forEach((entry) => {
            if (!entry || entry.text !== oldText) return;
            if (entry.isHabit || entry.isRecurring || entry.isRoutine) entry.text = newText;
          });
        });
      });

      saveToLocalStorage();
      syncRecurringTasksToSupabase();
      if (currentUser && supabaseClient) {
        supabaseClient
          .from('habits_history')
          .update({ habit_name: newText })
          .eq('user_id', currentUser.id)
          .eq('habit_name', oldText);
      }
      renderView();
      return;
    }

    task.text = newText;
    persistTaskChanges({ reopen: true });
  };

  nameInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyTaskRename();
    }
  };
  nameInput.onblur = () => {
    applyTaskRename();
  };

  const grid = document.createElement('div');
  grid.className = 'task-expansion-grid';

  const createCard = (eyebrow, title, modifier = '') => {
    const card = document.createElement('section');
    card.className = `task-expansion-card${modifier ? ` ${modifier}` : ''}`;

    const eyebrowEl = document.createElement('div');
    eyebrowEl.className = 'task-expansion-card-eyebrow';
    eyebrowEl.textContent = eyebrow;
    card.appendChild(eyebrowEl);

    const titleEl = document.createElement('h4');
    titleEl.className = 'task-expansion-card-title';
    titleEl.textContent = title;
    card.appendChild(titleEl);

    return card;
  };

  const createChoiceChip = (text, isActive, activeColor, onClick) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `task-choice-chip${isActive ? ' is-active' : ''}`;
    btn.textContent = text;
    if (isActive && activeColor) {
      btn.style.borderColor = `${activeColor}33`;
      btn.style.background = `${activeColor}1A`;
      btn.style.color = activeColor;
    }
    btn.onclick = (e) => {
      e.stopPropagation();
      onClick();
    };
    return btn;
  };

  const projectCard = createCard('Contexto', 'Projeto');
  const projectSelect = document.createElement('select');
  projectSelect.className = 'finance-input finance-input--full task-expansion-select';
  const projectOptions = [{ id: '', name: 'Sem projeto', clientName: '' }, ...getProjectOptions()];
  projectSelect.innerHTML = projectOptions
    .map(
      (project) =>
        `<option value="${project.id}">${project.name}${project.clientName ? ` · ${project.clientName}` : ''}</option>`
    )
    .join('');
  projectSelect.value = task.projectId || '';
  projectSelect.onchange = () => {
    const project = getProjectOptions().find((item) => item.id === projectSelect.value) || null;
    const targetTasks = isRecurring
      ? [task]
      : collectTaskSubtree(allTasksData?.[dateStr]?.[period] || [], task);
    targetTasks.forEach((entry) => {
      entry.projectId = project ? project.id : null;
      entry.projectName = project ? project.name : '';
    });
    persistTaskChanges({ reopen: true, syncWholeDate: !isRecurring });
  };
  projectCard.appendChild(projectSelect);
  if (!task.projectId && repeatedMatch) {
    const suggest = document.createElement('button');
    suggest.type = 'button';
    suggest.className = 'btn-secondary task-expansion-inline-button';
    suggest.textContent = `Sugerir: ${repeatedMatch.name}`;
    suggest.onclick = () => {
      const targetTasks = isRecurring
        ? [task]
        : collectTaskSubtree(allTasksData?.[dateStr]?.[period] || [], task);
      targetTasks.forEach((entry) => {
        entry.projectId = repeatedMatch.id;
        entry.projectName = repeatedMatch.name;
      });
      persistTaskChanges({ reopen: true, syncWholeDate: !isRecurring });
    };
    projectCard.appendChild(suggest);
  }
  grid.appendChild(projectCard);

  const timerCard = createCard('Execucao', isTimerEligible ? 'Tempo real' : 'Timer');
  const timerValue = document.createElement('strong');
  timerValue.className = 'task-expansion-timer-value';
  timerCard.appendChild(timerValue);

  const timerStatus = document.createElement('span');
  timerStatus.className = 'task-expansion-timer-status';
  timerCard.appendChild(timerStatus);

  const timerHint = document.createElement('p');
  timerHint.className = 'task-expansion-timer-hint';
  timerCard.appendChild(timerHint);

  const timerActions = document.createElement('div');
  timerActions.className = 'task-expansion-actions';
  timerCard.appendChild(timerActions);

  const timerToggleBtn = document.createElement('button');
  timerToggleBtn.type = 'button';
  timerToggleBtn.className = 'btn-primary task-expansion-inline-button';
  timerActions.appendChild(timerToggleBtn);

  const timerResetBtn = document.createElement('button');
  timerResetBtn.type = 'button';
  timerResetBtn.className = 'btn-secondary task-expansion-inline-button';
  timerResetBtn.textContent = 'Zerar';
  timerActions.appendChild(timerResetBtn);

  const timerCompleteBtn = document.createElement('button');
  timerCompleteBtn.type = 'button';
  timerCompleteBtn.className = 'btn-secondary task-expansion-inline-button task-expansion-complete-button';
  timerActions.appendChild(timerCompleteBtn);

  const timerMeta = document.createElement('div');
  timerMeta.className = 'task-expansion-caption';
  timerCard.appendChild(timerMeta);

  let timerInterval = null;
  const refreshTimerCard = () => {
    normalizeTaskTimerData(task);

    if (!isTimerEligible) {
      timerValue.textContent = 'Disponivel so para tarefas do dia';
      timerStatus.textContent = 'Rotinas seguem outro fluxo.';
      timerHint.textContent = 'Use o timer em tarefas normais para medir execucao real.';
      timerToggleBtn.disabled = true;
      timerResetBtn.disabled = true;
      timerCompleteBtn.disabled = true;
      timerCompleteBtn.textContent = 'Concluir';
      timerMeta.textContent = '';
      return;
    }

    const totalMs = getTaskTimerTotalMs(task);
    const isRunning = Boolean(task.timerStartedAt);
    timerValue.textContent = formatDurationClock(totalMs);
    timerStatus.textContent = task.completed
      ? 'Concluida'
      : isRunning
        ? 'Rodando agora'
        : totalMs > 0
          ? 'Tempo acumulado'
          : 'Nenhuma sessao ainda';
    timerHint.textContent = isRunning
      ? 'Quando pausar ou concluir, o tempo fecha automaticamente.'
      : task.completed && totalMs > 0
        ? `Fechada com ${formatDurationClock(totalMs)} registrados.`
        : task.completed
          ? 'Tarefa concluida e registrada.'
      : task.timerLastStoppedAt
        ? `Ultima pausa ${formatTimeSince(task.timerLastStoppedAt)}.`
        : 'Inicie quando comecar a executar de verdade.';
    timerToggleBtn.disabled = task.completed && !isRunning;
    timerToggleBtn.textContent = isRunning ? 'Pausar' : totalMs > 0 ? 'Retomar' : 'Iniciar';
    timerCompleteBtn.disabled = false;
    timerCompleteBtn.textContent = task.completed ? 'Reabrir' : 'Concluir';
    timerMeta.textContent =
      task.completed && task.completedAt
        ? `Feita ${formatTimeSince(task.completedAt)}`
        : Number(task.timerSessionsCount || 0) > 0
        ? `${Math.max(1, Number(task.timerSessionsCount || 0))} sessao(oes)`
        : 'Sem historico ainda';

    if (isRunning && !timerInterval) {
      timerInterval = setInterval(refreshTimerCard, 1000);
    } else if (!isRunning && timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };

  timerToggleBtn.onclick = () => {
    if (!isTimerEligible) return;

    const nowIso = new Date().toISOString();
    const syncDates = new Set([dateStr]);

    if (task.timerStartedAt) {
      stopTaskTimer(task, nowIso);
    } else {
      startTaskTimer(task, nowIso).forEach((entry) => syncDates.add(entry.dateStr));
    }

    saveToLocalStorage();
    renderView();
    reopenExpansion();
    (async () => {
      for (const syncDate of syncDates) await syncDateToSupabase(syncDate);
    })();
  };

  timerResetBtn.onclick = () => {
    if (!isTimerEligible) return;
    resetTaskTimer(task);
    persistTaskChanges({ reopen: true });
  };

  timerCompleteBtn.onclick = () => {
    if (!isTimerEligible) return;

    const nowIso = new Date().toISOString();
    if (task.completed) {
      task.completed = false;
      task.completedAt = null;
    } else {
      if (task.timerStartedAt) {
        stopTaskTimer(task, nowIso);
      }
      task.completed = true;
      task.completedAt = nowIso;
    }

    persistTaskChanges({ reopen: true });
  };

  refreshTimerCard();
  exp._cleanup = () => {
    if (timerInterval) clearInterval(timerInterval);
  };
  grid.appendChild(timerCard);

  const prioCard = createCard('Sinal', 'Prioridade', 'task-expansion-card--wide');
  ensureMoneyPriorityOption();
  const prios = getTaskPriorities();
  let currentPrio = task.priority || null;
  if (isRecurring && recDefinition && recDefinition.priority) currentPrio = recDefinition.priority;
  const priosWrap = document.createElement('div');
  priosWrap.className = 'task-expansion-chip-row';
  prios.forEach((p) => {
    priosWrap.appendChild(
      createChoiceChip(p.name, currentPrio === p.id, p.color, () => {
        const newPrio = task.priority === p.id ? null : p.id;
        if (isRecurring && recDefinition) {
          recDefinition.priority = newPrio;
        } else {
          task.priority = newPrio;
        }
        persistTaskChanges({ reopen: true });
      })
    );
  });
  prioCard.appendChild(priosWrap);
  grid.appendChild(prioCard);

  const repeatCard = createCard('Cadencia', 'Repetir', 'task-expansion-card--wide');
  const days = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  let activeDays = recDefinition ? recDefinition.daysOfWeek || [] : [];
  const repWrap = document.createElement('div');
  repWrap.className = 'task-expansion-days';
  days.forEach((d, i) => {
    const dayBtn = document.createElement('button');
    const isActive = activeDays.includes(i);
    dayBtn.type = 'button';
    dayBtn.className = `task-day-chip${isActive ? ' is-active' : ''}`;
    dayBtn.textContent = d;
    dayBtn.onclick = (e) => {
      e.stopPropagation();
      if (!recDefinition && !isRecurring) {
        const newRecTask = {
          text: task.text,
          daysOfWeek: [i],
          priority: task.priority || null,
          color: task.color || 'default',
          type: task.type || 'OPERATIONAL',
          createdAt: new Date().toISOString()
        };
        allRecurringTasks.push(newRecTask);
        if (allTasksData[dateStr] && allTasksData[dateStr][period]) {
          allTasksData[dateStr][period].splice(parseInt(index, 10), 1);
        }
        saveToLocalStorage();
        syncRecurringTasksToSupabase().then(renderView);
        return;
      } else if (recDefinition) {
        const dayIndex = activeDays.indexOf(i);
        if (dayIndex >= 0) {
          recDefinition.daysOfWeek.splice(dayIndex, 1);
          if (recDefinition.daysOfWeek.length === 0) {
            if (confirm('Deixar sem nenhum dia excluirá a rotina. Confirmar?')) {
              allRecurringTasks = allRecurringTasks.filter((t) => t.text !== task.text);
            } else {
              recDefinition.daysOfWeek.push(i);
            }
          }
        } else {
          recDefinition.daysOfWeek.push(i);
        }
        persistTaskChanges({ reopen: true });
      }
    };
    repWrap.appendChild(dayBtn);
  });
  repeatCard.appendChild(repWrap);
  const repeatHint = document.createElement('p');
  repeatHint.className = 'task-expansion-caption';
  repeatHint.textContent = recDefinition
    ? 'Ativar dias aqui ajusta a rotina original.'
    : 'Clique em um dia para transformar essa tarefa em recorrente.';
  repeatCard.appendChild(repeatHint);
  grid.appendChild(repeatCard);

  exp.appendChild(grid);

  const footer = document.createElement('div');
  footer.className = 'task-expansion-footer';

  const summary = document.createElement('span');
  summary.className = 'task-expansion-caption';
  if (isTimerEligible && (task.timerStartedAt || getTaskTimerTotalMs(task) > 0)) {
    summary.textContent = task.timerStartedAt
      ? `Em execucao ha ${formatElapsedShort(getTaskTimerTotalMs(task))}`
      : `Total rastreado ${formatDurationClock(getTaskTimerTotalMs(task))}`;
  } else {
    summary.textContent = task.projectName
      ? `Vinculada a ${task.projectName}`
      : 'Sem projeto vinculado ainda';
  }
  footer.appendChild(summary);

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'task-expansion-delete';
  delBtn.innerHTML = '<i data-lucide="trash-2" style="width:13px;height:13px"></i> Excluir';
  delBtn.onclick = (e) => {
    e.stopPropagation();
    window.deleteTaskInline(task, dateStr, period, index, isRecurring);
  };
  footer.appendChild(delBtn);
  exp.appendChild(footer);

  el.after(exp);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => {
    exp.style.opacity = '1';
    exp.style.maxHeight = `${Math.max(280, exp.scrollHeight + 32)}px`;
    exp.style.marginTop = '8px';
    exp.style.marginBottom = '8px';
  });
};

window.deleteTaskInline = async function (task, dateStr, period, _indexStr, isRecurring) {
  if (confirm('Excluir esta tarefa definitivamente?')) {
    // Cancel any pending Realtime-driven re-render so it doesn't race with the optimistic update
    if (window._rtTimeout) {
      clearTimeout(window._rtTimeout);
      window._rtTimeout = null;
    }
    let deleted = false;

    if (isRecurring || allRecurringTasks.some((t) => t.text === task.text)) {
      const recIndex = allRecurringTasks.findIndex((t) => t.text === task.text);
      if (recIndex >= 0) allRecurringTasks.splice(recIndex, 1);

      const textToRemove = task.text;
      Object.keys(allTasksData).forEach((dStr) => {
        Object.keys(allTasksData[dStr] || {}).forEach((per) => {
          if (Array.isArray(allTasksData[dStr][per])) {
            allTasksData[dStr][per] = allTasksData[dStr][per].filter(
              (t) => t.text !== textToRemove
            );
            if (allTasksData[dStr][per].length === 0) delete allTasksData[dStr][per];
          }
        });
        if (Object.keys(allTasksData[dStr] || {}).length === 0) delete allTasksData[dStr];
      });
      syncRecurringTasksToSupabase();
      deleted = true;
    }

    if (!isRecurring) {
      // OPTIMISTIC DELETE: update local state and re-render IMMEDIATELY (synchronous),
      // then fire the Supabase DELETE in the background.
      // This avoids a race where a pending Realtime loadDataFromSupabase() runs during
      // the network await and re-renders the task before the splice happens.
      if (allTasksData[dateStr]?.[period]) {
        const localIdx = allTasksData[dateStr][period].findIndex(
          (t) => (task.supabaseId && t.supabaseId === task.supabaseId) || t.text === task.text
        );
        if (localIdx >= 0) {
          allTasksData[dateStr][period].splice(localIdx, 1);
          if (allTasksData[dateStr][period].length === 0) delete allTasksData[dateStr][period];
          if (Object.keys(allTasksData[dateStr] || {}).length === 0) delete allTasksData[dateStr];
        }
      }
      deleted = true;
    }

    if (deleted) {
      saveToLocalStorage();
      renderView();
    }

    // Fire backend DELETE after UI is already updated (non-blocking)
    if (!isRecurring) {
      deleteTaskFromSupabase(task, dateStr, period).catch((err) =>
        console.error('[Delete] Background sync error:', err)
      );
    }
  }
};

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
    alert('Dá um nome pro projeto primeiro.');
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
    alert('Dá um nome pro projeto primeiro.');
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

// ===== FUNÇÕES DE SALVAMENTO =====
function saveToLocalStorage() {
  if (localStore) {
    localStore.saveCoreState({
      allTasksData,
      allRecurringTasks,
      routineCompletions,
      habitsHistory,
      financeState,
      projectsState
    });
    if (eventBus) eventBus.emit('storage:saved', { at: Date.now() });
    if (navigator.onLine) setSyncStatus('saving', 'Alteracoes locais salvas');
    else setSyncStatus('offline', 'Alteracoes salvas no dispositivo');
    return;
  }
  localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
  localStorage.setItem('allRecurringTasks', JSON.stringify(allRecurringTasks));
  localStorage.setItem('routineCompletions', JSON.stringify(routineCompletions));
  localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));
  persistFinanceStateLocal();
  persistProjectsStateLocal();
  if (navigator.onLine) setSyncStatus('saving', 'Alteracoes locais salvas');
  else setSyncStatus('offline', 'Alteracoes salvas no dispositivo');
}

// ===== DRAG AND DROP =====

// Retorna tarefas de rotina para exibição (NÃO persiste em allTasksData)
function getRoutineTasksForDate(dateStr) {
  if (routineService) return routineService.getRoutineTasksForDate(dateStr);
  return [];
}

// Compatibilidade: manter hydrateRoutineForDate como no-op para não quebrar chamadas existentes
function hydrateRoutineForDate(dateStr) {
  // Não faz mais nada - rotinas são geradas dinamicamente
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

  saveToLocalStorage();
  if (typeof syncRecurringTasksToSupabase === 'function') {
    syncRecurringTasksToSupabase();
  }

  return true;
}

// Fallback: drop na coluna (não em drop zone) → insere no fim da lista do dia
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

function getWeekDates(weekOffset = 0) {
  const today = new Date();
  const viewSettings = getViewSettings();
  const weekStart = viewSettings.weekStart === 'sun' ? 'sun' : 'mon';
  const showWeekends = viewSettings.showWeekends !== false;

  const currentDay = today.getDay(); // 0 = Domingo
  const startDiff = weekStart === 'sun' ? -currentDay : currentDay === 0 ? -6 : 1 - currentDay;

  const startDate = new Date(today);
  startDate.setDate(today.getDate() + startDiff + weekOffset * 7);
  startDate.setHours(0, 0, 0, 0);

  const dayNames =
    weekStart === 'sun'
      ? ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
      : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dayIndex = date.getDay();
    const isWeekend = dayIndex === 0 || dayIndex === 6;
    if (!showWeekends && isWeekend) continue;

    dates.push({
      name: dayNames[i],
      date: date,
      dateStr: localDateStr(date)
    });
  }

  return dates;
}

function getMonthDates(monthOffset = 0) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + monthOffset;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  return { firstDay, lastDay, month: firstDay.getMonth(), year: firstDay.getFullYear() };
}

function getWeekLabel(weekOffset) {
  const dates = getWeekDates(weekOffset);
  if (!dates.length) return 'Semana Atual';

  const firstDate = dates[0].date;
  const lastDate = dates[dates.length - 1].date;

  if (weekOffset === 0) return 'Semana Atual';

  const format = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `${format(firstDate)} - ${format(lastDate)}`;
}

function changeWeek(direction) {
  currentWeekOffset += direction;
  renderView();
}

function goToCurrentWeek() {
  currentWeekOffset = 0;
  renderView();
}

// --- Core Functions ---

async function checkAuth() {
  if (!authSession) return false;
  return authSession.checkAuth();
}

async function signUp(email, password) {
  if (!authSession) return false;
  const result = await authSession.signUp(
    email,
    password,
    () => !allTasksData || Object.keys(allTasksData).length === 0
  );
  if (!result.ok) {
    showAuthMessage(result.error);
    return false;
  }

  showAuthMessage('Conta criada! Fazendo login...', 'success');
  return true;
}

async function signIn(email, password) {
  if (!authSession) return false;
  const result = await authSession.signIn(
    email,
    password,
    () => !allTasksData || Object.keys(allTasksData).length === 0
  );
  if (!result.ok) {
    showAuthMessage(result.error);
    return false;
  }
  return true;
}

async function signOut() {
  if (!authSession) return;
  await authSession.signOut();
}

// --- Sync Logic ---

async function migrateLocalDataToSupabase() {
  if (!tasksRepo) return;
  await tasksRepo.migrateLocalDataToSupabase();
}

async function loadDataFromSupabase() {
  if (!tasksRepo) return;
  await tasksRepo.loadDataFromSupabase();
  await loadFinanceStateFromSupabase();
  await loadProjectsStateFromSupabase();
}
async function syncDailyRoutineToSupabase() {
  // Deprecated or Legacy handled silently
}

// Sincroniza allRecurringTasks com Supabase de forma inteligente (Diff Sync)
function markLocalSupabaseMutation(ms = 1800) {
  const until = Date.now() + ms;
  const prev = Number(window._flowlySuppressRealtimeUntil || 0);
  window._flowlySuppressRealtimeUntil = Math.max(prev, until);
}
let _unsyncedSyncInFlight = false;
let _unsyncedSyncTimer = null;

function scheduleUnsyncedTasksSync(delay = 600) {
  if (_unsyncedSyncTimer) clearTimeout(_unsyncedSyncTimer);
  _unsyncedSyncTimer = setTimeout(() => {
    _unsyncedSyncTimer = null;
    syncUnsyncedTasksToSupabase();
  }, delay);
}

async function ensureCurrentUserForSync() {
  if (currentUser) return currentUser;
  try {
    const result = await supabaseClient.auth.getSession();
    const session = result && result.data ? result.data.session : null;
    if (session && session.user) {
      currentUser = session.user;
      return currentUser;
    }
  } catch (err) {
    console.error('[Auth] Falha ao recuperar sessao para sincronizacao:', err);
  }
  return null;
}

async function syncUnsyncedTasksToSupabase() {
  if (_unsyncedSyncInFlight) return;
  if (!tasksSyncService) return;
  const user = await ensureCurrentUserForSync();
  if (!user) return;

  _unsyncedSyncInFlight = true;
  try {
    let hasChanges = false;

    for (const [dateStr, periods] of Object.entries(allTasksData || {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

      for (const [period, tasks] of Object.entries(periods || {})) {
        if (!Array.isArray(tasks) || period === 'Rotina') continue;

        for (const task of tasks) {
          if (!task || !task.text || task.text.trim() === '') continue;
          if (task.isWeeklyRecurring || task.isRoutine || task.isRecurring) continue;
          if (typeof task.supabaseId === 'string' && task.supabaseId.indexOf('-') > -1) continue;

          markLocalSupabaseMutation();
          const result = await tasksSyncService.syncTaskToSupabase(dateStr, period, task);
          if (result && result.success) hasChanges = true;
        }
      }
    }

    const hasUnsyncedRecurring = (allRecurringTasks || []).some(
      (t) => t && (!t.supabaseId || String(t.supabaseId).indexOf('-') === -1)
    );
    if (hasUnsyncedRecurring) {
      await syncRecurringTasksToSupabase();
    }

    if (hasChanges) saveToLocalStorage();
  } catch (err) {
    console.error('[Sync] Erro ao sincronizar tarefas pendentes:', err);
  } finally {
    _unsyncedSyncInFlight = false;
  }
}

async function syncRecurringTasksToSupabase() {
  if (!tasksSyncService) return;
  const user = await ensureCurrentUserForSync();
  if (!user) {
    scheduleUnsyncedTasksSync(2000);
    finishSyncActivity(false, 'Login necessario para sincronizar');
    return;
  }
  markLocalSupabaseMutation();
  startSyncActivity('Sincronizando recorrencias...');
  try {
    await tasksSyncService.syncRecurringTasksToSupabase();
    finishSyncActivity(true);
  } catch (err) {
    finishSyncActivity(false, 'Falha ao sincronizar recorrencias');
    throw err;
  }
}

async function syncTaskToSupabase(dateStr, period, task) {
  if (!tasksSyncService) return { success: false, errorText: 'Sync service indisponivel.' };
  const user = await ensureCurrentUserForSync();
  if (!user) {
    scheduleUnsyncedTasksSync(2000);
    finishSyncActivity(false, 'Login necessario para sincronizar');
    return { success: false, errorText: 'Usuario nao autenticado para sincronizacao.' };
  }
  markLocalSupabaseMutation();
  startSyncActivity('Sincronizando alteracoes...');
  const result = await tasksSyncService.syncTaskToSupabase(dateStr, period, task);
  if (!result || !result.success) {
    scheduleUnsyncedTasksSync(1500);
    finishSyncActivity(false, (result && result.errorText) || 'Falha ao sincronizar');
    return result;
  }
  finishSyncActivity(true);
  return result;
}

async function deleteTaskFromSupabase(task, day, period) {
  if (!tasksSyncService) return;
  markLocalSupabaseMutation();
  startSyncActivity('Removendo tarefa na nuvem...');
  try {
    await tasksSyncService.deleteTaskFromSupabase(task, day, period);
    finishSyncActivity(true);
  } catch (err) {
    finishSyncActivity(false, 'Falha ao remover tarefa');
    throw err;
  }
}

async function syncHabitToSupabase(habitText, date, completed) {
  if (!tasksSyncService) return;
  markLocalSupabaseMutation();
  startSyncActivity('Sincronizando habitos...');
  try {
    await tasksSyncService.syncHabitToSupabase(habitText, date, completed);
    finishSyncActivity(true);
  } catch (err) {
    finishSyncActivity(false, 'Falha ao sincronizar habitos');
    throw err;
  }
}

let _isSyncingDate = false;

const flowlyLocalStoreFactory = window.FlowlyLocalStore;
if (flowlyLocalStoreFactory) {
  localStore = flowlyLocalStoreFactory.create();
}

const flowlyEventsFactory = window.FlowlyEvents;
if (flowlyEventsFactory) {
  eventBus = flowlyEventsFactory.createEventBus();
}

const flowlyErrorsFactory = window.FlowlyErrors;
if (flowlyErrorsFactory) {
  errorHandler = flowlyErrorsFactory.create({ debugLog });
}

const flowlyRoutineFactory = window.FlowlyRoutineService;
if (flowlyRoutineFactory) {
  routineService = flowlyRoutineFactory.create({
    localDateStr,
    getAllRecurringTasks: () => allRecurringTasks,
    getHabitsHistory: () => habitsHistory,
    setHabitsHistory: (next) => {
      habitsHistory = next;
    },
    getCurrentUser: () => currentUser,
    supabaseClient
  });
}

const flowlyTasksSyncFactory = window.FlowlyTasksSync;
if (flowlyTasksSyncFactory) {
  tasksSyncService = flowlyTasksSyncFactory.create({
    supabaseClient,
    getCurrentUser: () => currentUser,
    getAllRecurringTasks: () => allRecurringTasks,
    setAllRecurringTasks: (next) => {
      allRecurringTasks = next;
    }
  });
}

const flowlyAnalyticsFactory = window.FlowlyAnalyticsService;
if (flowlyAnalyticsFactory) {
  analyticsService = flowlyAnalyticsFactory.create({
    getAllTasksData: () => allTasksData,
    getRoutineTasksForDate
  });
}

const flowlyTasksRepoFactory = window.FlowlyTasksRepo;
if (flowlyTasksRepoFactory) {
  tasksRepo = flowlyTasksRepoFactory.create({
    supabaseClient,
    debugLog,
    getCurrentUser: () => currentUser,
    getAllTasksData: () => allTasksData,
    setAllTasksData: (next) => {
      allTasksData = next;
    },
    getAllRecurringTasks: () => allRecurringTasks,
    setAllRecurringTasks: (next) => {
      allRecurringTasks = next;
    },
    getHabitsHistory: () => habitsHistory,
    setHabitsHistory: (next) => {
      habitsHistory = next;
    },
    setCustomTaskTypes: (next) => {
      customTaskTypes = next;
    },
    setCustomTaskPriorities: (next) => {
      customTaskPriorities = next;
    },
    getDbUserSettings: () => dbUserSettings,
    setDbUserSettings: (next) => {
      dbUserSettings = next;
    },
    normalizeAllTasks,
    syncRecurringTasksToSupabase,
    syncTaskToSupabase,
    renderView,
    renderRoutineView
  });
}

function loadFromLocalStorage() {
  if (localStore) {
    localStore.loadLegacyWeekData(weekData);
    return;
  }
  const saved = localStorage.getItem('weekData');
  if (saved) {
    const savedData = JSON.parse(saved);
    Object.keys(weekData).forEach((day) => {
      if (savedData[day]) weekData[day] = savedData[day];
    });
  }
}

// --- Render Functions ---

// --- Habits & Analytics Logic ---

function getAllHabits() {
  if (routineService) return routineService.getAllHabits();
  return [];
}
function getHabitStreak(habitText) {
  if (routineService) return routineService.getHabitStreak(habitText);
  return 0;
}
function getHabitCompletionRate(habitText, days = 30) {
  if (routineService) return routineService.getHabitCompletionRate(habitText, days);
  return 0;
}

function markHabitCompleted(habitText, completed, targetDate = null) {
  if (routineService) {
    routineService.markHabitCompleted(habitText, completed, targetDate);
  }
}
window.toggleHabitToday = function (habitText, completed) {
  // Normalizar texto para evitar problemas com aspas
  const cleanText = habitText;
  // O toggleHabitToday da interface de rotina assume "hoje", mas podemos melhorar isso se necessário.
  // Por enquanto, mantém o comportamento atual de usar "hoje" SE não passar data.
  markHabitCompleted(cleanText, completed);

  // Re-renderizar para atualizar UI imediatamente (optimistic update)
  setTimeout(() => {
    renderView();
  }, 50);
};

function removeHabit(habitText) {
  if (
    !confirm(
      `Tem certeza que deseja remover "${habitText}" dos hábitos?\n\nIsso irá desmarcar esta tarefa como hábito em todas as ocorrências.`
    )
  )
    return;

  // Remover de allRecurringTasks
  const recurringIdx = allRecurringTasks.findIndex((t) => t.text === habitText);
  if (recurringIdx !== -1) {
    allRecurringTasks.splice(recurringIdx, 1);
    saveToLocalStorage();
    syncRecurringTasksToSupabase();
  }

  // Desmarcar como hábito em todas as tarefas existentes
  Object.entries(allTasksData).forEach(([dateStr, periods]) => {
    Object.entries(periods).forEach(([period, tasks]) => {
      tasks.forEach((task) => {
        if (task.text === habitText && task.isHabit) {
          task.isHabit = false;
        }
      });
    });
  });

  // Limpar histórico do hábito
  if (habitsHistory[habitText]) {
    delete habitsHistory[habitText];
    localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));
  }

  saveToLocalStorage();
  renderView();
  setTimeout(() => lucide.createIcons(), 0);
}

function renderHabitsView() {
  const view = document.getElementById('habitsView'),
    habits = getAllHabits();
  if (habits.length === 0) {
    view.innerHTML =
      '<div class="text-center py-20"><p class="text-gray-400 text-lg">Nenhum hábito rastreado ainda.</p><p class="text-gray-600 text-sm mt-2">Marque tasks como hábitos no menu de contexto (botão direito).</p></div>';
    return;
  }

  let html = `<div class="flowly-shell flowly-shell--narrow"><h2 class="text-3xl font-bold mb-8 text-white flex items-center gap-3"><i data-lucide="repeat" style="width: 28px; height: 28px;"></i> Meus Hábitos</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"><div class="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Total de Hábitos</div><div class="text-3xl font-bold text-white">${habits.length}</div></div>
            <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"><div class="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Concluídos Hoje</div><div class="text-3xl font-bold text-[#30d158]">${habits.filter((h) => h.completedToday).length}</div></div>
            <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"><div class="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Taxa Hoje</div><div class="text-3xl font-bold text-[#0A84FF]">${habits.length > 0 ? Math.round((habits.filter((h) => h.completedToday).length / habits.length) * 100) : 0}%</div></div></div><div class="space-y-3">`;

  habits.forEach((habit, index) => {
    const streak = getHabitStreak(habit.text),
      completionRate = getHabitCompletionRate(habit.text, 30);
    html += `<div class="bg-[#1c1c1e] bg-opacity-40 backdrop-blur-md border border-white/5 rounded-xl p-5 hover:bg-opacity-60 transition-all flex items-center justify-between gap-4 group">
                
                
                
                
                
                
                
                <div class="flex items-center gap-4 flex-1">
                
                
                
                
                
                
                
                    <input type="checkbox" class="checkbox-custom mt-1" ${habit.completedToday ? 'checked' : ''} onchange="toggleHabitToday('${habit.text.replace(/'/g, "\\'")}', this.checked)">
                
                
                
                
                
                
                
                    <div class="flex-1">
                
                
                
                
                
                
                
                        <div class="color-${habit.color} font-medium text-lg mb-1 group-hover:text-white transition-colors">${habit.text}</div>
                
                
                
                
                
                
                
                        <div class="flex items-center gap-3 text-xs text-gray-400">
                
                
                
                
                
                
                
                            ${streak > 0 ? `<span class="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium flex items-center gap-1"><i data-lucide="flame" style="width: 14px; height: 14px;"></i> ${streak} dias</span>` : ''}
                
                
                
                
                
                
                
                            <span>${completionRate}% consistency (30d)</span>
                
                
                
                
                
                
                
                        </div>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                <div class="flex items-center gap-3">
                
                
                
                
                
                
                
                    <div class="w-32 h-1.5 bg-gray-700/30 rounded-full overflow-hidden flex-shrink-0"><div class="h-full bg-blue-500 rounded-full transition-all duration-500" style="width: ${completionRate}%"></div></div>
                
                
                
                
                
                
                
                    <button onclick="removeHabit('${habit.text.replace(/'/g, "\\'")}');" class="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg" title="Remover hábito">
                
                
                
                
                
                
                
                        <i data-lucide="x" class="text-red-400" style="width: 18px; height: 18px;"></i>
                
                
                
                
                
                
                
                    </button>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                </div>`;
  });
  html += `</div></div>`;
  view.innerHTML = html;
}

function renderAnalyticsView() {
  const view = document.getElementById('analyticsView');
  if (!view) return;

  // -- Outer tab (Rotina | Analytics) ------------------------------------
  const mainTab = view.dataset.mainTab || 'analytics';
  const outerTabsHTML = `
    <div style="display:flex;gap:6px;padding:0 0 20px">
        <button onclick="document.getElementById('analyticsView').dataset.mainTab='routine';document.getElementById('analyticsView').dataset.routineTab=document.getElementById('analyticsView').dataset.routineTab||'today';renderAnalyticsView()"
            style="padding:7px 16px;border-radius:20px;font-size:13px;font-weight:600;border:1px solid;cursor:pointer;transition:all 0.15s;
                
                
                
                
                
                
                
                   background:${mainTab === 'routine' ? 'rgba(10,132,255,0.15)' : 'transparent'};
                
                
                
                
                
                
                
                   color:${mainTab === 'routine' ? '#0A84FF' : 'var(--text-tertiary)'};
                
                
                
                
                
                
                
                   border-color:${mainTab === 'routine' ? 'rgba(10,132,255,0.35)' : 'var(--border-subtle)'}">
            Rotina
        </button>
        <button onclick="document.getElementById('analyticsView').dataset.mainTab='analytics';renderAnalyticsView()"
            style="padding:7px 16px;border-radius:20px;font-size:13px;font-weight:600;border:1px solid;cursor:pointer;transition:all 0.15s;
                
                
                
                
                
                
                
                   background:${mainTab === 'analytics' ? 'rgba(10,132,255,0.15)' : 'transparent'};
                
                
                
                
                
                
                
                   color:${mainTab === 'analytics' ? '#0A84FF' : 'var(--text-tertiary)'};
                
                
                
                
                
                
                
                   border-color:${mainTab === 'analytics' ? 'rgba(10,132,255,0.35)' : 'var(--border-subtle)'}">
            Analytics
        </button>
    </div>`;

  // -- Routine tab: embed renderRoutineView inside analytics -------------
  if (mainTab === 'routine') {
    const routineTab = view.dataset.routineTab || 'today';
    view.innerHTML = `<div class="flowly-shell"><div class="analytics-container-v2">${outerTabsHTML}<div id="routineEmbedded"></div></div></div>`;
    const embedded = document.getElementById('routineEmbedded');
    embedded.dataset.routineTab = routineTab;
    renderRoutineView(embedded);
    return;
  }

  // -- Constants ----------------------------------------------------------
  const MONTH_NAMES_PT = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ];
  const DAY_ABBR_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // -- Today --------------------------------------------------------------
  const today = localDateStr();

  // -- Week stats ---------------------------------------------------------
  const weekDates = getWeekDates(0);
  let totalTasksWeek = 0,
    completedTasksWeek = 0;
  let totalTasksToday = 0,
    completedTasksToday = 0;
  const dayStatsMap = {};

  weekDates.forEach(({ name, dateStr }) => {
    const dayTasks = allTasksData[dateStr] || {};
    let dayTotal = 0,
      dayCompleted = 0;
    Object.entries(dayTasks).forEach(([period, tasks]) => {
      if (period === 'Rotina') return;
      if (Array.isArray(tasks)) {
        tasks.forEach((task) => {
          dayTotal++;
          totalTasksWeek++;
          if (task.completed) {
            dayCompleted++;
            completedTasksWeek++;
          }
          if (dateStr === today) {
            totalTasksToday++;
            if (task.completed) completedTasksToday++;
          }
        });
      }
    });
    const routineForDay = getRoutineTasksForDate(dateStr);
    dayTotal += routineForDay.length;
    totalTasksWeek += routineForDay.length;
    dayCompleted += routineForDay.filter((t) => t.completed).length;
    completedTasksWeek += routineForDay.filter((t) => t.completed).length;
    if (dateStr === today) {
      totalTasksToday += routineForDay.length;
      completedTasksToday += routineForDay.filter((t) => t.completed).length;
    }
    dayStatsMap[name] = { total: dayTotal, completed: dayCompleted, dateStr };
  });

  // -- Habit stats --------------------------------------------------------
  const allHabitsArr = getAllHabits();
  const totalHabits = allHabitsArr.length;
  const completedHabitsToday = allHabitsArr.filter((h) => h.completedToday).length;

  const performanceHistory = [];
  const perfCursor = new Date();
  perfCursor.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const targetDate = new Date(perfCursor);
    targetDate.setDate(perfCursor.getDate() - i);
    const dStr = localDateStr(targetDate);
    const dt = allTasksData[dStr] || {};
    let total = 0,
      completed = 0;
    Object.entries(dt).forEach(([p, tasks]) => {
      if (p === 'Rotina') return;
      if (Array.isArray(tasks)) {
        total += tasks.length;
        completed += tasks.filter((t) => t.completed).length;
      }
    });
    const rr = getRoutineTasksForDate(dStr);
    total += rr.length;
    completed += rr.filter((t) => t.completed).length;
    performanceHistory.push({
      dateStr: dStr,
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0
    });
  }
  const activeHistory = performanceHistory.filter((d) => d.total > 0);
  const avgCompletedBaseline = activeHistory.length > 0
    ? activeHistory.reduce((sum, d) => sum + d.completed, 0) / activeHistory.length
    : 0;
  const recent7 = performanceHistory.slice(-7);
  const prev7 = performanceHistory.slice(-14, -7);
  const recent7Active = recent7.filter((d) => d.total > 0);
  const prev7Active = prev7.filter((d) => d.total > 0);
  const recent7Completed = recent7.reduce((sum, d) => sum + d.completed, 0);
  const prev7Completed = prev7.reduce((sum, d) => sum + d.completed, 0);
  const recent7Avg = recent7Active.length > 0 ? recent7Completed / recent7Active.length : 0;
  const prev7Avg = prev7Active.length > 0 ? prev7Completed / prev7Active.length : 0;
  const todayCompletedVolume = completedTasksToday;
  const todayPerformanceScore = avgCompletedBaseline > 0
    ? Math.round((todayCompletedVolume / avgCompletedBaseline) * 100)
    : todayCompletedVolume > 0
      ? 100
      : 0;
  const weeklyPerformanceScore = prev7Avg > 0
    ? Math.round((recent7Avg / prev7Avg) * 100)
    : recent7Avg > 0
      ? 100
      : 0;
  const volumeDelta = Math.round(todayCompletedVolume - avgCompletedBaseline);
  const weeklyDeltaTasks = Math.round(recent7Avg - prev7Avg);
  const consistencyDays = performanceHistory.filter(
    (d) => d.total > 0 && d.completed >= avgCompletedBaseline
  ).length;
  const bestVolumeDay = activeHistory.length > 0
    ? activeHistory.reduce((best, d) => (d.completed > best.completed ? d : best))
    : null;
  const monthlyVolumeSeries = performanceHistory.map((d) => d.completed);
  const monthlyVolumeLabels = performanceHistory.map((d) => d.dateStr.slice(8, 10));

  // -- Rates --------------------------------------------------------------
  const todayRate =
    totalTasksToday > 0 ? Math.round((completedTasksToday / totalTasksToday) * 100) : 0;
  const weekRate = totalTasksWeek > 0 ? Math.round((completedTasksWeek / totalTasksWeek) * 100) : 0;
  const habitRate = totalHabits > 0 ? Math.round((completedHabitsToday / totalHabits) * 100) : 0;

  // -- Streak -------------------------------------------------------------
  let currentStreak = 0;
  const streakCheckDate = new Date();
  for (let i = 0; i < 60; i++) {
    const cStr = localDateStr(streakCheckDate);
    const cTasks = allTasksData[cStr] || {};
    let st = 0,
      sc = 0;
    Object.entries(cTasks).forEach(([p, tasks]) => {
      if (p === 'Rotina') return;
      if (Array.isArray(tasks)) {
        st += tasks.length;
        sc += tasks.filter((t) => t.completed).length;
      }
    });
    const rfc = getRoutineTasksForDate(cStr);
    st += rfc.length;
    sc += rfc.filter((t) => t.completed).length;
    if (st > 0 && sc === st) {
      currentStreak++;
    } else if (i > 0 || (i === 0 && st > 0)) {
      break;
    }
    streakCheckDate.setDate(streakCheckDate.getDate() - 1);
  }

  // -- Last-week comparison (fair: compare only up to same day of week) --
  const todayDayOfWeek = new Date().getDay(); // 0=Dom, 6=Sáb
  const lastWeekDates = getWeekDates(-1);
  let lastWeekTotal = 0,
    lastWeekCompleted = 0;
  // Also recalculate current week up to today for fair comparison
  let thisWeekFairTotal = 0,
    thisWeekFairCompleted = 0;
  lastWeekDates.forEach(({ dateStr: lwds }, idx) => {
    // getWeekDates returns Mon-Sun (index 0=Mon). Map to day-of-week:
    // idx 0=Mon(1), 1=Tue(2)... 5=Sat(6), 6=Sun(0)
    const lwDow = idx < 6 ? idx + 1 : 0;
    // Only count days up to and including today's day-of-week
    // e.g. if today is Friday(5), count Mon-Fri of last week
    const lwDate = new Date(lwds);
    const currentWeekStart = new Date(weekDates[0].dateStr);
    const todayDate = new Date(today);
    // Simple: compare by index position in the week array
    if (idx <= weekDates.findIndex((w) => w.dateStr === today)) {
      const dt = allTasksData[lwds] || {};
      Object.entries(dt).forEach(([p, tasks]) => {
        if (p === 'Rotina') return;
        if (Array.isArray(tasks)) {
          lastWeekTotal += tasks.length;
          lastWeekCompleted += tasks.filter((t) => t.completed).length;
        }
      });
      const rlw = getRoutineTasksForDate(lwds);
      lastWeekTotal += rlw.length;
      lastWeekCompleted += rlw.filter((t) => t.completed).length;
    }
  });
  // Current week fair total (only up to today)
  weekDates.forEach(({ dateStr: wds }, idx) => {
    if (idx <= weekDates.findIndex((w) => w.dateStr === today)) {
      const dt = allTasksData[wds] || {};
      Object.entries(dt).forEach(([p, tasks]) => {
        if (p === 'Rotina') return;
        if (Array.isArray(tasks)) {
          thisWeekFairTotal += tasks.length;
          thisWeekFairCompleted += tasks.filter((t) => t.completed).length;
        }
      });
      const rtw = getRoutineTasksForDate(wds);
      thisWeekFairTotal += rtw.length;
      thisWeekFairCompleted += rtw.filter((t) => t.completed).length;
    }
  });
  const thisWeekFairRate =
    thisWeekFairTotal > 0 ? Math.round((thisWeekFairCompleted / thisWeekFairTotal) * 100) : 0;
  const lastWeekRate =
    lastWeekTotal > 0 ? Math.round((lastWeekCompleted / lastWeekTotal) * 100) : 0;
  const weekDiff = thisWeekFairRate - lastWeekRate;

  // -- Day-of-week performance --------------------------------------------
  const dayPerfData = weekDates.map(({ name, dateStr }, idx) => {
    const s = dayStatsMap[name] || { total: 0, completed: 0 };
    const rate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
    const isToday = dateStr === today;
    const color = isToday
      ? '#0A84FF'
      : rate >= 80
        ? '#30D158'
        : rate >= 50
          ? '#0A84FF'
          : rate > 0
            ? '#FF9F0A'
            : 'rgba(255,255,255,0.08)';
    return { name, rate, total: s.total, completed: s.completed, isToday, color, idx };
  });
  const dayRates = dayPerfData.filter((d) => d.total > 0);
  const bestDay = dayRates.length > 0 ? dayRates.reduce((b, d) => (d.rate > b.rate ? d : b)) : null;
  const worstDay =
    dayRates.length > 1 ? dayRates.reduce((w, d) => (d.rate < w.rate ? d : w)) : null;

  // -- KPI derived values -------------------------------------------------
  const todayKpiColor =
    todayPerformanceScore >= 110 ? '#30D158' : todayPerformanceScore >= 85 ? '#0A84FF' : '#FF9F0A';
  const trendClass = weeklyDeltaTasks > 0 ? 'up' : weeklyDeltaTasks < 0 ? 'down' : 'neutral';
  const trendLabel =
    weeklyDeltaTasks > 0 ? `↑ +${weeklyDeltaTasks}` : weeklyDeltaTasks < 0 ? `↓ ${weeklyDeltaTasks}` : '≈ estável';
  const trendTooltip = 'comparado à média dos 7 dias anteriores';

  // -- Habit ranking -----------------------------------------------------
  const habitRanking = allHabitsArr
    .map((h) => ({
      text: h.text,
      rate: getHabitCompletionRate(h.text, 30),
      streak: getHabitStreak(h.text)
    }))
    .sort((a, b) => b.rate - a.rate);

  const habitRankingHTML =
    habitRanking.length === 0
      ? `<div style="padding:20px 0;text-align:center;color:var(--text-tertiary);font-size:13px;line-height:1.6">Nenhum hábito rastreado ainda.<br>Adicione hábitos na visão Semana.</div>`
      : habitRanking
          .slice(0, 8)
          .map((h, i) => {
            const medals = ['??', '??', '??'];
            const rank = i < 3 ? medals[i] : `${i + 1}º`;
            const rc = h.rate >= 80 ? '#30D158' : h.rate >= 50 ? '#0A84FF' : 'var(--text-tertiary)';
            const bc = h.rate >= 80 ? '#30D158' : h.rate >= 50 ? '#0A84FF' : '#FF9F0A';
            return `<div class="analytics-rank-row">
                
                
                
                
                
                
                
                <span class="analytics-rank-num">${rank}</span>
                
                
                
                
                
                
                
                <span class="analytics-rank-name">${h.text}</span>
                
                
                
                
                
                
                
                <div class="analytics-rank-bar-wrap"><div class="analytics-rank-bar" style="width:${h.rate}%;background:${bc}"></div></div>
                
                
                
                
                
                
                
                <span class="analytics-rank-pct" style="color:${rc}">${h.rate}%</span>
            </div>`;
          })
          .join('');

  // -- Category distribution ---------------------------------------------
  const taskTypes = getTaskTypes();
  const catCounts = {};
  weekDates.forEach(({ dateStr }) => {
    const dt = allTasksData[dateStr] || {};
    Object.entries(dt).forEach(([p, tasks]) => {
      if (p === 'Rotina') return;
      if (Array.isArray(tasks))
        tasks.forEach((t) => {
          const key = t.type || 'OTHER';
          if (!catCounts[key]) catCounts[key] = { total: 0, done: 0 };
          catCounts[key].total++;
          if (t.completed) catCounts[key].done++;
        });
    });
  });
  const catMaxVal = Math.max(...Object.values(catCounts).map((c) => c.total), 1);
  const catHTML =
    Object.keys(catCounts).length === 0
      ? `<div style="padding:16px 0;text-align:center;color:var(--text-tertiary);font-size:13px">Sem dados de categoria esta semana.</div>`
      : Object.entries(catCounts)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([id, c]) => {
            const ti = taskTypes.find((t) => t.id === id) || {
              name: id === 'OTHER' ? 'Sem categoria' : id,
              color: '#86868b'
            };
            const pct = Math.round((c.total / catMaxVal) * 100);
            const donePct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
            return `<div class="analytics-cat-row">
                
                
                
                
                
                
                
                <div class="analytics-cat-dot" style="background:${ti.color}"></div>
                
                
                
                
                
                
                
                <div class="analytics-cat-name">${ti.name}</div>
                
                
                
                
                
                
                
                <div style="font-size:11px;color:var(--text-tertiary);min-width:28px;text-align:right">${donePct}%</div>
                
                
                
                
                
                
                
                <div class="analytics-cat-bar-wrap"><div class="analytics-cat-bar" style="width:${pct}%;background:${ti.color}"></div></div>
                
                
                
                
                
                
                
                <div class="analytics-cat-count">${c.done}/${c.total}</div>
            </div>`;
          })
          .join('');

  // -- 30-day heatmap -----------------------------------------------------
  let heatmapCells = '';
  const heatCur = new Date();
  heatCur.setDate(heatCur.getDate() - 29);
  for (let i = 0; i < 30; i++) {
    const dStr = localDateStr(heatCur);
    const dt = allTasksData[dStr] || {};
    let ht = 0,
      hc = 0;
    Object.entries(dt).forEach(([p, tasks]) => {
      if (p === 'Rotina') return;
      if (Array.isArray(tasks)) {
        ht += tasks.length;
        hc += tasks.filter((t) => t.completed).length;
      }
    });
    const rh = getRoutineTasksForDate(dStr);
    ht += rh.length;
    hc += rh.filter((t) => t.completed).length;
    const rate = ht > 0 ? Math.round((hc / ht) * 100) : 0;
    const bg =
      rate >= 80
        ? '#30D158'
        : rate >= 60
          ? '#0A84FF'
          : rate >= 40
            ? '#FF9F0A'
            : rate > 0
              ? 'rgba(255,69,58,0.55)'
              : 'rgba(255,255,255,0.06)';
    const isToday = dStr === today;
    heatmapCells += `<div class="analytics-heatmap-cell" style="background:${bg};${isToday ? 'outline:2px solid #0A84FF;outline-offset:1px' : ''}" title="${dStr}: ${rate}%">${heatCur.getDate()}</div>`;
    heatCur.setDate(heatCur.getDate() + 1);
  }

  // -- Day performance columns HTML --------------------------------------
  const dayPerfHTML = dayPerfData
    .map((d) => {
      const barH = d.rate > 0 ? Math.max(6, Math.round(d.rate * 0.9)) : 0;
      return `<div class="analytics-day-perf-col ${d.isToday ? 'today-col' : ''}">
            <div class="analytics-day-label">${d.name.substring(0, 3)}</div>
            <div class="analytics-day-rate-v2" style="color:${d.color}">${d.rate > 0 ? d.rate + '%' : '—'}</div>
            <div class="analytics-day-bar-wrap"><div class="analytics-day-bar-fill" style="height:${barH}%;background:${d.color};opacity:${d.total > 0 ? 1 : 0}"></div></div>
            <div class="analytics-day-total">${d.total > 0 ? `${d.completed}/${d.total}` : '–'}</div>
        </div>`;
    })
    .join('');

  // -- Auto-insights -----------------------------------------------------
  const insights = [];
  if (totalTasksToday > 0 && completedTasksToday === totalTasksToday)
    insights.push({
      color: 'green',
      icon: '?',
      title: 'Dia Perfeito!',
      text: 'Todas as tarefas de hoje concluídas. Excelente!'
    });
  if (currentStreak >= 3)
    insights.push({
      color: 'orange',
      icon: '??',
      title: `${currentStreak} Dias de Streak`,
      text: 'Dias consecutivos com 100% das tarefas concluídas!'
    });
  if (habitRate === 100 && totalHabits > 0)
    insights.push({
      color: 'purple',
      icon: '?',
      title: 'Hábitos Perfeitos',
      text: 'Todos os hábitos marcados hoje. Consistência máxima!'
    });
  if (weekDiff >= 10)
    insights.push({
      color: 'green',
      icon: '??',
      title: 'Semana em Alta',
      text: `+${weekDiff}% vs semana anterior. Crescendo consistentemente!`
    });
  if (weekDiff <= -10)
    insights.push({
      color: 'red',
      icon: '??',
      title: 'Queda de Desempenho',
      text: `${weekDiff}% vs semana anterior. Identifique o que está bloqueando.`
    });
  if (bestDay && bestDay.rate >= 80)
    insights.push({
      color: 'blue',
      icon: '?',
      title: `Destaque: ${bestDay.name}`,
      text: `${bestDay.rate}% de conclusão — seu melhor dia da semana!`
    });
  if (todayPerformanceScore >= 120)
    insights.push({
      color: 'green',
      icon: '↗',
      title: 'Acima da tua média',
      text: `Hoje você entregou ${todayPerformanceScore}% da tua média recente.`
    });
  if (todayPerformanceScore > 0 && todayPerformanceScore < 80)
    insights.push({
      color: 'orange',
      icon: '•',
      title: 'Abaixo da média',
      text: `Hoje ficou em ${todayPerformanceScore}% da tua média recente.`
    });
  if (insights.length === 0 && weekRate > 0)
    insights.push({
      color: 'blue',
      icon: '??',
      title: 'Continue Evoluindo',
      text: `${Math.round(recent7Avg || 0)} tarefas/dia na última semana. Cada dia conta!`
    });
  if (insights.length === 0)
    insights.push({
      color: 'blue',
      icon: '??',
      title: 'Comece Hoje',
      text: 'Adicione tarefas e hábitos para ver seus insights aqui.'
    });

  const insightsHTML = insights
    .map(
      (ins) => `
        <div class="analytics-insight-v2 ${ins.color}">
            <div class="analytics-insight-v2-icon">${ins.icon}</div>
            <div>
                
                
                
                
                
                
                
                <div class="analytics-insight-v2-title">${ins.title}</div>
                
                
                
                
                
                
                
                <div class="analytics-insight-v2-text">${ins.text}</div>
            </div>
        </div>`
    )
    .join('');

  // -- Monthly data -------------------------------------------------------
  const nowDate = new Date();
  const nowYear = nowDate.getFullYear(),
    nowMonth = nowDate.getMonth();
  const monthAvgRate = avgCompletedBaseline > 0 ? avgCompletedBaseline.toFixed(1) : '0';

  // -- Week chart data ----------------------------------------------------
  const weekChartData = weekDates.map(({ name }) => {
    const s = dayStatsMap[name] || { total: 0, completed: 0 };
    return s.total > 0 ? Math.round((s.completed / s.total) * 100) : null;
  });
  const weekChartColors = weekChartData.map((v, i) => {
    if (v === null) return 'rgba(255,255,255,0.2)';
    return v >= 80 ? '#30D158' : v >= 50 ? '#0A84FF' : '#FF9F0A';
  });

  // -- BUILD HTML ---------------------------------------------------------
  const analyticsSafe = (value) =>
    Number.isFinite(value) ? Number(value).toFixed(1).replace('.0', '') : '0';
  view.innerHTML = `<div class="flowly-shell flowly-shell--wide"><div class="analytics-container-v2 analytics-container-v3">

        <!-- Outer tabs -->
        ${outerTabsHTML}

        <!-- Header -->
        <div class="analytics-header-v2">
            <div>
                
                
                
                
                
                
                
                <h2 class="analytics-title-v2">Analytics</h2>
                
                
                
                
                
                
                
                <p class="analytics-subtitle-v2">${MONTH_NAMES_PT[nowMonth]} ${nowYear} · Semana atual</p>
            </div>
        </div>

        <!-- KPI Grid -->
        <div class="analytics-kpi-grid-v2">
            <div class="analytics-kpi-v2">
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-glow" style="background:radial-gradient(circle,rgba(${todayRate >= 70 ? '48,209,88' : todayRate >= 40 ? '255,159,10' : '255,69,58'},0.18),transparent)"></div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-label"><i data-lucide="activity" style="width:12px;height:12px"></i> Performance Hoje</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-value" style="color:${todayKpiColor}">${todayPerformanceScore}%</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-sub">${todayCompletedVolume} concluídas • média ${analyticsSafe(avgCompletedBaseline)}</div>
                
                
                
                
                
                
                
                ${todayCompletedVolume > 0 ? `<span class="analytics-kpi-v2-badge ${todayPerformanceScore >= 100 ? 'up' : 'neutral'}">${volumeDelta >= 0 ? '↑' : '↓'} ${Math.abs(volumeDelta)} vs média</span>` : ''}
            </div>
            <div class="analytics-kpi-v2">
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-glow" style="background:radial-gradient(circle,rgba(${weekDiff > 0 ? '48,209,88' : weekDiff < 0 ? '255,69,58' : '10,132,255'},0.18),transparent)"></div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-label"><i data-lucide="bar-chart-3" style="width:12px;height:12px"></i> Ritmo semanal</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-value" style="color:${weeklyDeltaTasks > 0 ? '#30D158' : weeklyDeltaTasks < 0 ? '#FF453A' : '#0A84FF'}">${weeklyPerformanceScore}%</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-sub">${recent7Completed} concluídas nos últimos 7 dias</div>
                
                
                
                
                
                
                
                <span class="analytics-kpi-v2-badge ${trendClass}" title="${trendTooltip}">${trendLabel} vs 7 dias anteriores</span>
            </div>
            <div class="analytics-kpi-v2">
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-glow" style="background:radial-gradient(circle,rgba(191,90,242,0.18),transparent)"></div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-label"><i data-lucide="gauge" style="width:12px;height:12px"></i> Consistência</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-value" style="color:${consistencyDays >= 15 ? '#30D158' : consistencyDays >= 8 ? '#0A84FF' : '#BF5AF2'}">${activeHistory.length > 0 ? Math.round((consistencyDays / activeHistory.length) * 100) : 0}%</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-sub">${consistencyDays} dias na/acima da média em 30 dias</div>
            </div>
            <div class="analytics-kpi-v2">
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-glow" style="background:radial-gradient(circle,rgba(255,159,10,0.18),transparent)"></div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-label"><i data-lucide="zap" style="width:12px;height:12px"></i> Capacidade</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-value" style="color:${bestVolumeDay && bestVolumeDay.completed >= 8 ? '#FF9F0A' : bestVolumeDay ? '#30D158' : 'var(--text-tertiary)'}">${bestVolumeDay ? bestVolumeDay.completed : 0}</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-sub">${bestVolumeDay ? `melhor dia: ${bestVolumeDay.dateStr}` : 'sem histórico suficiente'}</div>
            </div>
        </div>

        <!-- Day performance strip -->
        <div class="analytics-chart-v2">
            <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2-title"><i data-lucide="bar-chart-2" style="width:14px;height:14px"></i> Desempenho por Dia</div>
                
                
                
                
                
                
                
                <span class="analytics-chart-v2-badge">${weekRate}% semana</span>
            </div>
            <div class="analytics-day-perf-grid">${dayPerfHTML}</div>
        </div>

        <!-- Charts row: week bar + doughnut -->
        <div class="analytics-2col">
            <div class="analytics-chart-v2">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                    <div class="analytics-chart-v2-title"><i data-lucide="bar-chart-2" style="width:14px;height:14px"></i> Progresso Semanal</div>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                <div style="position:relative;height:200px">
                
                
                
                
                
                
                
                    <canvas id="weekChartV2"></canvas>
                
                
                
                
                
                
                
                </div>
            </div>
            <div class="analytics-chart-v2" style="display:flex;flex-direction:column">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                    <div class="analytics-chart-v2-title"><i data-lucide="pie-chart" style="width:14px;height:14px"></i> Hábitos Hoje</div>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                <div style="flex:1;display:flex;align-items:center;justify-content:center">
                
                
                
                
                
                
                
                    <div style="position:relative;width:160px;height:160px">
                
                
                
                
                
                
                
                        <canvas id="habitsChartV2"></canvas>
                
                
                
                
                
                
                
                        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
                
                
                
                
                
                
                
                            <div style="font-size:30px;font-weight:800;font-family:var(--font-display);color:${habitRate >= 80 ? '#30D158' : '#BF5AF2'};line-height:1">${habitRate}%</div>
                
                
                
                
                
                
                
                            <div style="font-size:10px;color:var(--text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">hábitos</div>
                
                
                
                
                
                
                
                        </div>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                <div style="display:flex;justify-content:center;gap:16px;margin-top:14px;font-size:11px;color:var(--text-tertiary)">
                
                
                
                
                
                
                
                    <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:#30D158;display:inline-block"></span>${completedHabitsToday} feitos</span>
                
                
                
                
                
                
                
                    <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.1);display:inline-block"></span>${totalHabits - completedHabitsToday} pendentes</span>
                
                
                
                
                
                
                
                </div>
            </div>
        </div>

        <!-- Monthly evolution -->
        <div class="analytics-chart-v2">
            <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2-title"><i data-lucide="line-chart" style="width:14px;height:14px"></i> Volume diário — ${MONTH_NAMES_PT[nowMonth]}</div>
                
                
                
                
                
                
                
                <span class="analytics-chart-v2-badge">Média ${monthAvgRate} tarefas/dia</span>
            </div>
            <div style="position:relative;height:180px">
                
                
                
                
                
                
                
                <canvas id="monthChartV2"></canvas>
            </div>
        </div>

        <!-- Ranking + Category -->
        <div class="analytics-2col">
            <div class="analytics-chart-v2">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                    <div class="analytics-chart-v2-title"><i data-lucide="award" style="width:14px;height:14px"></i> Ranking de Hábitos</div>
                
                
                
                
                
                
                
                    <span class="analytics-chart-v2-badge">30 dias</span>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                ${habitRankingHTML}
            </div>
            <div style="display:flex;flex-direction:column;gap:12px">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2" style="flex:1">
                
                
                
                
                
                
                
                    <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                        <div class="analytics-chart-v2-title"><i data-lucide="tag" style="width:14px;height:14px"></i> Por Categoria</div>
                
                
                
                
                
                
                
                        <span class="analytics-chart-v2-badge">esta semana</span>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                    ${catHTML}
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                
                
                
                
                
                
                
                    <div class="analytics-chart-v2" style="padding:16px 14px">
                
                
                
                
                
                
                
                        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-tertiary);margin-bottom:8px;display:flex;align-items:center;gap:5px"><i data-lucide="trophy" style="width:11px;height:11px;color:#30D158"></i> Melhor</div>
                
                
                
                
                
                
                
                        ${bestDay ? `<div style="font-size:18px;font-weight:800;color:#30D158;font-family:var(--font-display)">${bestDay.name.substring(0, 3)}</div><div style="font-size:24px;font-weight:900;font-family:var(--font-display);letter-spacing:-0.04em;color:#30D158">${bestDay.rate}%</div>` : `<div style="font-size:12px;color:var(--text-tertiary);padding:8px 0">Sem dados</div>`}
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                    <div class="analytics-chart-v2" style="padding:16px 14px">
                
                
                
                
                
                
                
                        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-tertiary);margin-bottom:8px;display:flex;align-items:center;gap:5px"><i data-lucide="alert-circle" style="width:11px;height:11px;color:#FF9F0A"></i> Atenção</div>
                
                
                
                
                
                
                
                        ${worstDay ? `<div style="font-size:18px;font-weight:800;color:#FF9F0A;font-family:var(--font-display)">${worstDay.name.substring(0, 3)}</div><div style="font-size:24px;font-weight:900;font-family:var(--font-display);letter-spacing:-0.04em;color:#FF9F0A">${worstDay.rate}%</div>` : `<div style="font-size:12px;color:var(--text-tertiary);padding:8px 0">Sem dados</div>`}
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>
            </div>
        </div>

        <!-- 30-day Heatmap -->
        <div class="analytics-chart-v2">
            <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2-title"><i data-lucide="layout-grid" style="width:14px;height:14px"></i> Heatmap de Produtividade</div>
                
                
                
                
                
                
                
                <span class="analytics-chart-v2-badge">30 dias</span>
            </div>
            <div class="analytics-heatmap-grid">${heatmapCells}</div>
            <div style="display:flex;gap:14px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">
                
                
                
                
                
                
                
                <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:3px;background:rgba(255,255,255,0.06)"></div><span style="font-size:10px;color:var(--text-tertiary)">Vazio</span></div>
                
                
                
                
                
                
                
                <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:3px;background:rgba(255,69,58,0.55)"></div><span style="font-size:10px;color:var(--text-tertiary)">&lt;40%</span></div>
                
                
                
                
                
                
                
                <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:3px;background:#FF9F0A"></div><span style="font-size:10px;color:var(--text-tertiary)">40–60%</span></div>
                
                
                
                
                
                
                
                <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:3px;background:#0A84FF"></div><span style="font-size:10px;color:var(--text-tertiary)">60–80%</span></div>
                
                
                
                
                
                
                
                <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:3px;background:#30D158"></div><span style="font-size:10px;color:var(--text-tertiary)">=80%</span></div>
            </div>
        </div>

        <!-- Smart Insights -->
        <div>
            <div class="analytics-section-label" style="margin-bottom:10px">Análise Estratégica</div>
            <div class="analytics-insights-v2">${insightsHTML}</div>
        </div>

    </div></div>`;

  // -- Charts -------------------------------------------------------------
  setTimeout(() => {
    // Destroy any stale Chart.js instances on these canvases
    ['weekChartV2', 'habitsChartV2', 'monthChartV2'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        const existing = Chart.getChart(el);
        if (existing) existing.destroy();
      }
    });

    const chartDefaults = {
      color: '#888',
      gridColor: 'rgba(255,255,255,0.06)',
      tooltipBg: 'rgba(10,10,12,0.92)'
    };

    // Week bar chart
    const weekCtx = document.getElementById('weekChartV2');
    if (weekCtx) {
      new Chart(weekCtx, {
        type: 'bar',
        data: {
          labels: weekDates.map(({ name }) => name.substring(0, 3)),
          datasets: [
            {
              label: 'Conclusão (%)',
              data: weekChartData,
              backgroundColor: weekChartColors.map((c) => (c.startsWith('#') ? c + 'B3' : c)),
              borderColor: weekChartColors,
              borderWidth: 1.5,
              borderRadius: 8,
              borderSkipped: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: chartDefaults.tooltipBg,
              titleColor: '#ccc',
              bodyColor: '#fff',
              padding: 10,
              callbacks: { label: (item) => ` ${item.raw !== null ? item.raw + '%' : 'Sem dados'}` }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              grid: { color: chartDefaults.gridColor },
              ticks: { color: chartDefaults.color, callback: (v) => v + '%' },
              border: { display: false }
            },
            x: {
              grid: { display: false },
              ticks: { color: chartDefaults.color },
              border: { display: false }
            }
          }
        }
      });
    }

    // Habits doughnut
    const hCtx = document.getElementById('habitsChartV2');
    if (hCtx) {
      const doughnutData =
        totalHabits > 0
          ? [completedHabitsToday, Math.max(0, totalHabits - completedHabitsToday)]
          : [0, 1];
      const doughnutColors =
        totalHabits > 0
          ? ['#30D158', 'rgba(255,255,255,0.06)']
          : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.06)'];
      new Chart(hCtx, {
        type: 'doughnut',
        data: {
          labels: ['Concluídos', 'Pendentes'],
          datasets: [
            {
              data: doughnutData,
              backgroundColor: doughnutColors,
              borderWidth: 0,
              hoverBorderWidth: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '76%',
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
    }

    // Monthly line chart
    const monthCtx = document.getElementById('monthChartV2');
    if (monthCtx) {
      new Chart(monthCtx, {
        type: 'line',
        data: {
          labels: monthlyVolumeLabels,
          datasets: [
            {
              label: 'Tarefas concluídas',
              data: monthlyVolumeSeries,
              borderColor: '#0A84FF',
              backgroundColor: 'rgba(10,132,255,0.08)',
              tension: 0.35,
              fill: true,
              borderWidth: 2,
              pointRadius: monthlyVolumeSeries.map((_, i) => (i + 1 === monthlyVolumeSeries.length ? 6 : 3)),
              pointHoverRadius: 7,
              pointBackgroundColor: monthlyVolumeSeries.map((_, i) => (i + 1 === monthlyVolumeSeries.length ? '#f27405' : '#7dd3fc')),
              pointBorderColor: monthlyVolumeSeries.map((_, i) => (i + 1 === monthlyVolumeSeries.length ? '#f27405' : '#7dd3fc')),
              spanGaps: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: chartDefaults.tooltipBg,
              titleColor: '#ccc',
              bodyColor: '#fff',
              padding: 10,
              callbacks: {
                title: (items) => `Dia ${items[0].label}`,
                label: (item) =>
                  item.raw !== null ? ` ${item.raw} tarefa(s) concluída(s)` : ' Sem tarefas'
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: chartDefaults.gridColor },
              ticks: {
                color: chartDefaults.color,
                callback: (v) => `${v}`,
                precision: 0
              },
              border: { display: false }
            },
            x: {
              grid: { display: false },
              ticks: {
                color: chartDefaults.color,
                maxTicksLimit: 10,
                callback: function (val, index) {
                  const total = monthlyVolumeLabels.length;
                  return index === 0 || index === total - 1 || index % 5 === 0 ? monthlyVolumeLabels[index] : '';
                }
              },
              border: { display: false }
            }
          }
        }
      });
    }

    lucide.createIcons();
  }, 80);
}

function renderMonth() {
  const view = document.getElementById('monthView');
  const { firstDay, lastDay, month, year } = getMonthDates(currentMonthOffset);

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ];

  let html = `
                
                
                
                
                
                
                
                <div class="flowly-shell flowly-shell--wide">
                
                
                
                
                
                
                
                    <div class="flex items-center justify-center gap-4 mb-6">
                
                
                
                
                
                
                
                        <button onclick="currentMonthOffset--; renderView();" class="utility-btn">
                
                
                
                
                
                
                
                            <i data-lucide="chevron-left" style="width: 18px; height: 18px;"></i>
                
                
                
                
                
                
                
                        </button>
                
                
                
                
                
                
                
                        <h2 class="text-2xl font-bold text-white min-w-[200px] text-center">
                
                
                
                
                
                
                
                            ${monthNames[month]} ${year}
                
                
                
                
                
                
                
                        </h2>
                
                
                
                
                
                
                
                        <button onclick="currentMonthOffset++; renderView();" class="utility-btn">
                
                
                
                
                
                
                
                            <i data-lucide="chevron-right" style="width: 18px; height: 18px;"></i>
                
                
                
                
                
                
                
                        </button>
                
                
                
                
                
                
                
                        <button onclick="currentMonthOffset = 0; renderView();" class="btn-secondary text-xs px-3 py-1 ml-4" style="width: auto; padding: 6px 12px;">
                
                
                
                
                
                
                
                            Mês Atual
                
                
                
                
                
                
                
                        </button>
                
                
                
                
                
                
                
                    </div>

                
                
                
                
                
                
                
                    <!-- Cabeçalho dos dias da semana -->
                
                
                
                
                
                
                
                    <div class="grid grid-cols-7 gap-2 mb-2">
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Seg</div>
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Ter</div>
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Qua</div>
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Qui</div>
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Sex</div>
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Sáb</div>
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Dom</div>
                
                
                
                
                
                
                
                    </div>

                
                
                
                
                
                
                
                    <!-- Grid do calendário -->
                
                
                
                
                
                
                
                    <div class="grid grid-cols-7 gap-2">
            `;

  // Calcular o primeiro dia da semana (segunda = 0)
  const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  // Preencher dias vazios antes do primeiro dia
  for (let i = 0; i < firstDayOfWeek; i++) {
    html += `<div class="min-h-[120px] bg-[#1c1c1e] bg-opacity-30 rounded-lg"></div>`;
  }

  // Preencher os dias do mês
  const today = localDateStr();
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const dateStr = localDateStr(date);
    const isToday = dateStr === today;

    const dayTasks = allTasksData[dateStr] || {};
    let totalTasks = 0;
    let completedTasks = 0;
    const completedTaskNames = [];

    // Conjunto de textos ignorados (recorrentes e rotinas)
    const ignoredTexts = new Set([
      ...weeklyRecurringTasks.map((t) => t.text),
      ...dailyRoutine.map((t) => t.text)
    ]);

    // Contar apenas tarefas normais persistidas (excluir período 'Rotina' e tarefas que são cópias de recorrentes)
    Object.entries(dayTasks).forEach(([period, tasks]) => {
      if (period === 'Rotina') return;
      if (Array.isArray(tasks)) {
        // Filtra tarefas que não são recorrentes
        const validTasks = tasks.filter((t) => !ignoredTexts.has(t.text));
        totalTasks += validTasks.length;
        completedTasks += validTasks.filter((t) => t.completed).length;
        validTasks.forEach((t) => {
          if (t && t.completed && t.text) completedTaskNames.push(String(t.text));
        });
      }
    });

    const completedRoutineNames = getRoutineTasksForDate(dateStr)
      .filter((t) => t && t.completed && t.text)
      .map((t) => String(t.text));
    completedRoutineNames.forEach((name) => completedTaskNames.push(name));

    const uniqueCompletedTaskNames = [...new Set(completedTaskNames)];
    const previewMaxItems = 6;
    const previewItems = uniqueCompletedTaskNames.slice(0, previewMaxItems);
    const previewMore = uniqueCompletedTaskNames.length - previewItems.length;
    const monthDayTooltip =
      uniqueCompletedTaskNames.length > 0
        ? `Concluidas: ${uniqueCompletedTaskNames.length}\n${previewItems.map((name) => `- ${name}`).join('\n')}${previewMore > 0 ? `\n+${previewMore} outras` : ''}`
        : 'Nenhuma tarefa concluida neste dia';
    const monthDayTooltipAttr = monthDayTooltip
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '&#10;');

    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    html += `
                
                
                
                
                
                
                
                    <div class="min-h-[120px] bg-[#1c1c1e] bg-opacity-40 rounded-lg p-3 hover:bg-opacity-60 transition-all cursor-pointer border ${isToday ? 'border-blue-500' : 'border-white/5'}"
                
                
                
                
                
                
                
                         title="${monthDayTooltipAttr}"
                         onclick="goToDate('${dateStr}')">
                
                
                
                
                
                
                
                        <div class="flex items-center justify-between mb-2">
                
                
                
                
                
                
                
                            <div class="text-sm font-semibold ${isToday ? 'text-blue-400' : 'text-white'}">${day}</div>
                
                
                
                
                
                
                
                            ${
                              totalTasks > 0
                                ? `
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                <div class="text-xs text-gray-500">
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                    ${completedTasks}/${totalTasks}
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                            `
                                : ''
                            }
                
                
                
                
                
                
                
                        </div>

                
                
                
                
                
                
                
                        ${
                          totalTasks > 0
                            ? `
                
                
                
                
                
                
                
                            <div class="w-full h-1 bg-gray-700/30 rounded-full overflow-hidden mb-2">
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                <div class="h-full bg-blue-500 rounded-full transition-all" style="width: ${completionPercent}%"></div>
                
                
                
                
                
                
                
                            </div>
                
                
                
                
                
                
                
                        `
                            : ''
                        }

                
                
                
                
                
                
                
                        <div class="text-xs text-gray-600 space-y-1">
                
                
                
                
                
                
                
                            ${totalTasks === 0 ? '<div class="text-center py-4 text-gray-700">Sem tarefas</div>' : ''}
                
                
                
                
                
                
                
                        </div>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                `;
  }

  html += `
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>
            `;

  view.innerHTML = html;
}

function goToDate(dateStr) {
  // Calcular qual semana essa data está
  const targetDate = new Date(dateStr);
  const today = new Date();
  const diffTime = targetDate - today;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  currentWeekOffset = Math.floor(diffDays / 7);

  // Mudar para view semanal
  setView('week');
}

function renderRoutineView(embeddedEl) {
  const isEmbedded = !!embeddedEl;
  const view = embeddedEl || document.getElementById('routineView');
  if (!view) return;

  // Preserve active tab across re-renders
  const activeTab = view.dataset.routineTab || 'today';

  // Onclick strings for tab buttons — update correct element and re-render
  const tabClick = (tab) =>
    isEmbedded
      ? `document.getElementById('analyticsView').dataset.routineTab='${tab}';renderAnalyticsView()`
      : `document.getElementById('routineView').dataset.routineTab='${tab}';renderRoutineView()`;

  // -- Constants -----------------------------------------------------------
  const today = new Date();
  const todayStr = localDateStr(today);
  const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const DAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DAY_INIT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const MONTH_NAMES = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ];
  const MONTH_SHORT = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez'
  ];

  // -- Core Data ------------------------------------------------------------
  const todayTasks = getRoutineTasksForDate(todayStr);
  const totalToday = todayTasks.length;
  const completedToday = todayTasks.filter((t) => t.completed).length;
  const todayPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  const ringColor =
    todayPercent >= 80
      ? '#30D158'
      : todayPercent >= 50
        ? '#0A84FF'
        : todayPercent > 0
          ? '#FF9F0A'
          : 'rgba(255,255,255,0.12)';

  // Weekly stats (last 7 days)
  let totalWeekSch = 0,
    totalWeekComp = 0;
  const weeklyDayData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dStr = localDateStr(d);
    const tasks = getRoutineTasksForDate(dStr);
    const cnt = tasks.length;
    const comp = tasks.filter((t) => t.completed).length;
    if (cnt > 0) {
      totalWeekSch += cnt;
      totalWeekComp += comp;
    }
    weeklyDayData.push({
      abbr: DAY_ABBR[d.getDay()],
      init: DAY_INIT[d.getDay()],
      rate: cnt > 0 ? Math.round((comp / cnt) * 100) : 0,
      total: cnt,
      completed: comp,
      isToday: i === 0,
      dow: d.getDay()
    });
  }
  const weeklyRate = totalWeekSch > 0 ? Math.round((totalWeekComp / totalWeekSch) * 100) : 0;

  // Monthly stats (last 30 days)
  let totalMonth = 0,
    completedMonth = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const tasks = getRoutineTasksForDate(localDateStr(d));
    totalMonth += tasks.length;
    completedMonth += tasks.filter((t) => t.completed).length;
  }
  const monthlyRate = totalMonth > 0 ? Math.round((completedMonth / totalMonth) * 100) : 0;

  // Streak
  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const tasks = getRoutineTasksForDate(localDateStr(d));
    if (tasks.length > 0 && tasks.filter((t) => t.completed).length === tasks.length) {
      currentStreak++;
    } else if (i > 0) break;
  }

  // Best day (last 30 days)
  const perfDayCount = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const tasks = getRoutineTasksForDate(localDateStr(d));
    if (tasks.length > 0 && tasks.filter((t) => t.completed).length === tasks.length)
      perfDayCount[d.getDay()]++;
  }
  const bestDayIdx = perfDayCount.indexOf(Math.max(...perfDayCount));

  // Active habits
  const activeRoutines = allRecurringTasks.filter((t) => t.daysOfWeek && t.daysOfWeek.length > 0);

  // Category distribution (by type)
  const catMap = {};
  const taskTypes = getTaskTypes();
  activeRoutines.forEach((task) => {
    const typeId = task.type || 'OTHER';
    if (!catMap[typeId]) catMap[typeId] = { total: 0, done: 0 };
    catMap[typeId].total++;
    if (habitsHistory[task.text] && habitsHistory[task.text][todayStr]) catMap[typeId].done++;
  });
  const catMaxTotal = Math.max(...Object.values(catMap).map((c) => c.total), 1);

  // -- SVG Ring -------------------------------------------------------------
  const ringR = 52,
    ringCirc = 2 * Math.PI * ringR;
  const ringOffset = ringCirc * (1 - todayPercent / 100);

  // -- 12-week Heatmap -------------------------------------------------------
  let heatWeeks = [];
  for (let w = 11; w >= 0; w--) {
    const week = [];
    for (let d = 6; d >= 0; d--) {
      const offset = w * 7 + d;
      const dt = new Date(today);
      dt.setDate(today.getDate() - offset);
      const dStr = localDateStr(dt);
      const tasks = getRoutineTasksForDate(dStr);
      let bg = 'rgba(255,255,255,0.05)';
      if (tasks.length > 0) {
        const rate = tasks.filter((t) => t.completed).length / tasks.length;
        bg =
          rate >= 1
            ? '#30D158'
            : rate >= 0.7
              ? 'rgba(48,209,88,0.55)'
              : rate >= 0.4
                ? '#FF9F0A'
                : 'rgba(255,69,58,0.45)';
      }
      const isToday = dStr === todayStr;
      week.unshift({ bg, isToday, date: dt.getDate(), dStr });
    }
    heatWeeks.push(week);
  }
  const heatHTML = heatWeeks
    .map(
      (week, wi) =>
        `<div class="routine-heatmap-week-row">${week
          .map(
            (cell) =>
              `<div class="routine-heatmap-cell-v2" style="background:${cell.bg};${cell.isToday ? 'outline:2px solid #0A84FF;outline-offset:1px' : ''}" title="${cell.dStr}"></div>`
          )
          .join('')}</div>`
    )
    .join('');

  // -- Habits HTML ------------------------------------------------------------
  const habitsHTML =
    activeRoutines.length === 0
      ? `<div style="padding:32px 0;text-align:center;color:var(--text-tertiary);font-size:13px;line-height:1.6">
               Nenhum hábito configurado ainda.<br>Crie tarefas recorrentes na visão <b style="color:var(--text-secondary)">Semana</b>.
           </div>`
      : activeRoutines
          .map((task) => {
            let itemTotal = 0,
              itemCompleted = 0,
              runningStreak = 0,
              streakBroken = false;
            for (let i = 0; i < 30; i++) {
              const d = new Date(today);
              d.setDate(today.getDate() - i);
              const dStr = localDateStr(d);
              if (task.daysOfWeek.includes(d.getDay())) {
                itemTotal++;

                const done = habitsHistory[task.text] && habitsHistory[task.text][dStr];

                if (done) {
                  itemCompleted++;

                  if (!streakBroken) runningStreak++;
                } else if (dStr !== todayStr) streakBroken = true;
              }
            }
            const itemRate = itemTotal > 0 ? Math.round((itemCompleted / itemTotal) * 100) : 0;
            const isTodayDone = !!(habitsHistory[task.text] && habitsHistory[task.text][todayStr]);
            const isScheduledToday = task.daysOfWeek.includes(today.getDay());
            const checkClass = isTodayDone ? 'done' : !isScheduledToday ? 'inactive' : '';
            const rateColor =
              itemRate >= 80 ? '#30D158' : itemRate >= 50 ? '#0A84FF' : 'var(--text-tertiary)';
            const typeInfo = taskTypes.find((t) => t.id === task.type);
            const tagHTML = typeInfo
              ? `<span class="routine-habit-tag" style="background:${typeInfo.color}18;color:${typeInfo.color};border-color:${typeInfo.color}30">${typeInfo.name}</span>`
              : '';
            const priorityInfo = getTaskPriorities().find((p) => p.id === task.priority);
            const prioHTML = priorityInfo
              ? `<span class="routine-habit-tag" style="background:${priorityInfo.color}15;color:${priorityInfo.color};border-color:${priorityInfo.color}28">${priorityInfo.name}</span>`
              : '';
            const dayDots = [0, 1, 2, 3, 4, 5, 6]
              .map((dow) => {
                const active = task.daysOfWeek.includes(dow);

                const isNow = dow === today.getDay();

                return `<span class="routine-habit-day-dot" style="background:${active ? (isNow ? '#0A84FF' : 'rgba(255,255,255,0.3)') : 'rgba(255,255,255,0.06)'}"></span>`;
              })
              .join('');
            const safeText = task.text.replace(/'/g, "\\'");
            return `
            <div class="routine-habit-row-v2" onclick="window.toggleHabitToday('${safeText}', ${!isTodayDone})">
                
                
                
                
                
                
                
                <div class="routine-habit-check-v2 ${checkClass}">
                
                
                
                
                
                
                
                    <i data-lucide="check" style="width:14px;height:14px;stroke-width:3"></i>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                <div style="min-width:0">
                
                
                
                
                
                
                
                    <div class="routine-habit-name-v2" style="color:${isTodayDone ? 'var(--text-tertiary)' : 'var(--text-primary)'};text-decoration:${isTodayDone ? 'line-through' : 'none'}">${task.text}</div>
                
                
                
                
                
                
                
                    <div class="routine-habit-meta">
                
                
                
                
                
                
                
                        <div class="routine-habit-days-track">${dayDots}</div>
                
                
                
                
                
                
                
                        ${tagHTML}${prioHTML}
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                <div class="routine-habit-stats">
                
                
                
                
                
                
                
                    <div class="routine-habit-rate-v2" style="color:${rateColor}">${itemRate}%</div>
                
                
                
                
                
                
                
                    ${runningStreak > 0 ? `<div class="routine-habit-streak-v2">?? ${runningStreak}d</div>` : `<div style="font-size:10px;color:var(--text-tertiary)">30 dias</div>`}
                
                
                
                
                
                
                
                </div>
            </div>`;
          })
          .join('');

  // -- Period breakdown (Manhã/Tarde/Noite) ---------------------------------
  const todayAllTasks = allTasksData[todayStr] || {};
  const periods = [
    { key: 'Manhã', label: 'Manhã', icon: '??', color: '#FF9F0A' },
    { key: 'Tarde', label: 'Tarde', icon: '??', color: '#0A84FF' },
    { key: 'Noite', label: 'Noite', icon: '??', color: '#BF5AF2' }
  ];
  const periodHTML = periods
    .map((p) => {
      const tasks = todayAllTasks[p.key] || [];
      const tot = tasks.length,
        done = tasks.filter((t) => t.completed).length;
      const pct = tot > 0 ? Math.round((done / tot) * 100) : 0;
      return `<div class="routine-period-card">
            <div class="routine-period-icon" style="background:${p.color}15">${p.icon}</div>
            <div class="routine-period-label">${p.label}</div>
            <div class="routine-period-fraction" style="color:${p.color}">${done}<span style="font-size:13px;font-weight:400;color:var(--text-tertiary)">/${tot > 0 ? tot : '–'}</span></div>
            <div class="routine-period-bar"><div class="routine-period-bar-fill" style="width:${pct}%;background:${p.color}"></div></div>
        </div>`;
    })
    .join('');

  // -- Weekly column view ----------------------------------------------------
  const weeklyColsHTML = weeklyDayData
    .map((day) => {
      const barH = day.rate > 0 ? Math.max(6, Math.round(day.rate * 0.8)) : 0;
      const barColor = day.isToday
        ? '#0A84FF'
        : day.rate >= 80
          ? '#30D158'
          : day.rate >= 50
            ? '#0A84FF'
            : day.rate > 0
              ? '#FF9F0A'
              : 'rgba(255,255,255,0.08)';
      return `<div class="routine-weekly-day-col ${day.isToday ? 'today' : ''}">
            <div class="routine-weekly-day-label">${day.abbr.substring(0, 3)}</div>
            <div class="routine-weekly-rate" style="color:${barColor}">${day.rate > 0 ? day.rate + '%' : '—'}</div>
            <div class="routine-weekly-bar"><div class="routine-weekly-bar-fill" style="height:${barH}%;background:${barColor};opacity:${day.total > 0 ? 1 : 0}"></div></div>
            <div class="routine-weekly-tasks-count">${day.total > 0 ? `${day.completed}/${day.total}` : '–'}</div>
        </div>`;
    })
    .join('');

  // -- Category distribution HTML --------------------------------------------
  const catHTML =
    Object.entries(catMap).length === 0
      ? `<div style="padding:16px 0;text-align:center;color:var(--text-tertiary);font-size:13px">Sem dados de categoria</div>`
      : Object.entries(catMap)
          .map(([id, c]) => {
            const ti = taskTypes.find((t) => t.id === id) || { name: id, color: '#888' };
            return `<div class="routine-category-row">
                
                
                
                
                
                
                
                <div class="routine-category-dot" style="background:${ti.color}"></div>
                
                
                
                
                
                
                
                <div class="routine-category-name">${ti.name}</div>
                
                
                
                
                
                
                
                <div class="routine-category-bar-wrap"><div class="routine-category-bar-fill" style="width:${Math.round((c.total / catMaxTotal) * 100)}%;background:${ti.color}"></div></div>
                
                
                
                
                
                
                
                <div class="routine-category-count" style="color:${ti.color}">${c.done}/${c.total}</div>
            </div>`;
          })
          .join('');

  // -- Streak Badge ----------------------------------------------------------
  const streakBadge =
    currentStreak >= 7
      ? `<span class="routine-streak-badge fire">?? ${currentStreak} dias de sequência</span>`
      : currentStreak >= 3
        ? `<span class="routine-streak-badge orange" style="background:rgba(255,159,10,0.1);border-color:rgba(255,159,10,0.25);color:#FF9F0A">? ${currentStreak} dias consecutivos</span>`
        : todayPercent === 100 && totalToday > 0
          ? `<span class="routine-streak-badge green">? Dia perfeito!</span>`
          : weeklyRate >= 80
            ? `<span class="routine-streak-badge blue">?? Semana excelente — ${weeklyRate}%</span>`
            : '';

  // -- TAB CONTENT -----------------------------------------------------------
  let tabContent = '';

  if (activeTab === 'today') {
    tabContent = `
        <!-- Period breakdown -->
        <div class="routine-section-card">
            <div class="routine-section-header">
                
                
                
                
                
                
                
                <i data-lucide="clock" style="width:14px;height:14px"></i>
                
                
                
                
                
                
                
                Tarefas por Período
                
                
                
                
                
                
                
                <span class="routine-badge">${(todayAllTasks['Manhã'] || []).length + (todayAllTasks['Tarde'] || []).length + (todayAllTasks['Noite'] || []).length}</span>
            </div>
            <div class="routine-period-grid">${periodHTML}</div>
        </div>

        <!-- Habits List -->
        <div class="routine-section-card">
            <div class="routine-section-header">
                
                
                
                
                
                
                
                <i data-lucide="check-circle" style="width:14px;height:14px"></i>
                
                
                
                
                
                
                
                Hábitos de Hoje
                
                
                
                
                
                
                
                <span class="routine-badge">${completedToday}/${totalToday}</span>
            </div>
            <div class="routine-habits-list">${habitsHTML}</div>
            <button onclick="setView('week')"
                
                
                
                
                
                
                
                style="width:100%;margin-top:14px;padding:11px;font-size:13px;font-weight:600;color:var(--text-secondary);background:rgba(255,255,255,0.04);border:1px solid var(--border-subtle);border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:background 0.15s,color 0.15s"
                
                
                
                
                
                
                
                onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.color='var(--text-primary)'"
                
                
                
                
                
                
                
                onmouseout="this.style.background='rgba(255,255,255,0.04)';this.style.color='var(--text-secondary)'">
                
                
                
                
                
                
                
                Gerenciar Hábitos <i data-lucide="arrow-right" style="width:14px;height:14px"></i>
            </button>
        </div>

        ${
          Object.keys(catMap).length > 0
            ? `
        <!-- Category distribution -->
        <div class="routine-section-card">
            <div class="routine-section-header">
                
                
                
                
                
                
                
                <i data-lucide="tag" style="width:14px;height:14px"></i>
                
                
                
                
                
                
                
                Distribuição por Categoria
            </div>
            ${catHTML}
        </div>`
            : ''
        }`;
  } else if (activeTab === 'week') {
    tabContent = `
        <!-- Weekly columns -->
        <div class="routine-section-card">
            <div class="routine-section-header">
                
                
                
                
                
                
                
                <i data-lucide="bar-chart-2" style="width:14px;height:14px"></i>
                
                
                
                
                
                
                
                Consistência — Esta Semana
                
                
                
                
                
                
                
                <span class="routine-badge">${weeklyRate}%</span>
            </div>
            <div class="routine-weekly-grid">${weeklyColsHTML}</div>
        </div>

        <!-- Habits with weekly performance -->
        <div class="routine-section-card">
            <div class="routine-section-header">
                
                
                
                
                
                
                
                <i data-lucide="repeat" style="width:14px;height:14px"></i>
                
                
                
                
                
                
                
                Hábitos
                
                
                
                
                
                
                
                <span class="routine-badge">${activeRoutines.length}</span>
            </div>
            <div class="routine-habits-list">${habitsHTML}</div>
        </div>`;
  } else if (activeTab === 'month') {
    tabContent = `
        <!-- 12-week heatmap -->
        <div class="routine-section-card">
            <div class="routine-section-header">
                
                
                
                
                
                
                
                <i data-lucide="layout-grid" style="width:14px;height:14px"></i>
                
                
                
                
                
                
                
                Histórico — 12 Semanas
                
                
                
                
                
                
                
                <span class="routine-badge">${monthlyRate}% (30d)</span>
            </div>
            <!-- Day labels -->
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px;text-align:center">
                
                
                
                
                
                
                
                ${DAY_ABBR.map((d) => `<span style="font-size:10px;font-weight:700;color:var(--text-tertiary)">${d.charAt(0)}</span>`).join('')}
            </div>
            <div class="routine-heatmap-12w">${heatHTML}</div>
            <div class="routine-heatmap-legend" style="margin-top:14px">
                
                
                
                
                
                
                
                <div><div style="width:10px;height:10px;border-radius:3px;background:rgba(255,255,255,0.05)"></div><span>Vazio</span></div>
                
                
                
                
                
                
                
                <div><div style="width:10px;height:10px;border-radius:3px;background:rgba(255,69,58,0.45)"></div><span>&lt;40%</span></div>
                
                
                
                
                
                
                
                <div><div style="width:10px;height:10px;border-radius:3px;background:#FF9F0A"></div><span>40–70%</span></div>
                
                
                
                
                
                
                
                <div><div style="width:10px;height:10px;border-radius:3px;background:rgba(48,209,88,0.55)"></div><span>70–99%</span></div>
                
                
                
                
                
                
                
                <div><div style="width:10px;height:10px;border-radius:3px;background:#30D158"></div><span>100%</span></div>
            </div>
        </div>

        <!-- Category breakdown over month -->
        <div class="routine-section-card">
            <div class="routine-section-header">
                
                
                
                
                
                
                
                <i data-lucide="pie-chart" style="width:14px;height:14px"></i>
                
                
                
                
                
                
                
                Hábitos por Categoria
            </div>
            ${catHTML.replace(/done\/total/g, '') || `<div style="padding:16px 0;text-align:center;color:var(--text-tertiary);font-size:13px">Sem hábitos com categoria</div>`}
        </div>`;
  }

  // -- FULL HTML -------------------------------------------------------------
  view.innerHTML = `
    <div class="routine-container">
        <!-- Header -->
        <div class="routine-header">
            <div>
                
                
                
                
                
                
                
                <h2 class="routine-title">Rotina</h2>
                
                
                
                
                
                
                
                <p class="routine-subtitle">${DAY_NAMES[today.getDay()]}, ${today.getDate()} de ${MONTH_NAMES[today.getMonth()]}</p>
            </div>
            <div class="routine-view-tabs">
                
                
                
                
                
                
                
                <button class="routine-tab-btn ${activeTab === 'today' ? 'active' : ''}" onclick="${tabClick('today')}">Hoje</button>
                
                
                
                
                
                
                
                <button class="routine-tab-btn ${activeTab === 'week' ? 'active' : ''}"  onclick="${tabClick('week')}">Semana</button>
                
                
                
                
                
                
                
                <button class="routine-tab-btn ${activeTab === 'month' ? 'active' : ''}" onclick="${tabClick('month')}">Mensal</button>
            </div>
        </div>

        <!-- Score Hero Card -->
        <div class="routine-score-card">
            <div class="routine-ring-wrap">
                
                
                
                
                
                
                
                <svg width="130" height="130" viewBox="0 0 130 130" style="display:block">
                
                
                
                
                
                
                
                    <circle cx="65" cy="65" r="${ringR}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="11"/>
                
                
                
                
                
                
                
                    <circle cx="65" cy="65" r="${ringR}" fill="none" stroke="${ringColor}" stroke-width="11"
                
                
                
                
                
                
                
                        stroke-dasharray="${ringCirc.toFixed(2)}" stroke-dashoffset="${ringOffset.toFixed(2)}"
                
                
                
                
                
                
                
                        stroke-linecap="round" transform="rotate(-90 65 65)"
                
                
                
                
                
                
                
                        style="transition:stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1),stroke 0.4s ease"/>
                
                
                
                
                
                
                
                </svg>
                
                
                
                
                
                
                
                <div class="routine-ring-center">
                
                
                
                
                
                
                
                    <span class="routine-ring-pct" style="color:${ringColor}">${todayPercent}%</span>
                
                
                
                
                
                
                
                    <span class="routine-ring-label">Hoje</span>
                
                
                
                
                
                
                
                </div>
            </div>
            <div class="routine-score-info">
                
                
                
                
                
                
                
                <div class="routine-score-label">Progresso do Dia</div>
                
                
                
                
                
                
                
                <div class="routine-score-count">${completedToday}<span>/${totalToday}</span></div>
                
                
                
                
                
                
                
                <div class="routine-score-sub">hábitos concluídos hoje</div>
                
                
                
                
                
                
                
                <div class="routine-progress-bar">
                
                
                
                
                
                
                
                    <div class="routine-progress-bar-fill" style="width:${todayPercent}%;background:${ringColor}"></div>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                ${streakBadge}
            </div>
        </div>

        <!-- Metrics Strip -->
        <div class="routine-metrics-strip">
            <div class="routine-metric-pill">
                
                
                
                
                
                
                
                <div class="routine-metric-pill-icon"><i data-lucide="flame" style="width:16px;height:16px;color:#FF9F0A"></i></div>
                
                
                
                
                
                
                
                <div class="routine-metric-pill-val" style="color:${currentStreak >= 7 ? '#FF9F0A' : currentStreak > 0 ? '#30D158' : 'var(--text-tertiary)'}">${currentStreak}</div>
                
                
                
                
                
                
                
                <div class="routine-metric-pill-lbl">Streak</div>
            </div>
            <div class="routine-metric-pill">
                
                
                
                
                
                
                
                <div class="routine-metric-pill-icon"><i data-lucide="trending-up" style="width:16px;height:16px;color:#0A84FF"></i></div>
                
                
                
                
                
                
                
                <div class="routine-metric-pill-val" style="color:${weeklyRate >= 80 ? '#30D158' : '#0A84FF'}">${weeklyRate}%</div>
                
                
                
                
                
                
                
                <div class="routine-metric-pill-lbl">Semana</div>
            </div>
            <div class="routine-metric-pill">
                
                
                
                
                
                
                
                <div class="routine-metric-pill-icon"><i data-lucide="calendar" style="width:16px;height:16px;color:#30D158"></i></div>
                
                
                
                
                
                
                
                <div class="routine-metric-pill-val" style="color:${monthlyRate >= 70 ? '#30D158' : '#0A84FF'}">${monthlyRate}%</div>
                
                
                
                
                
                
                
                <div class="routine-metric-pill-lbl">30 Dias</div>
            </div>
            <div class="routine-metric-pill">
                
                
                
                
                
                
                
                <div class="routine-metric-pill-icon"><i data-lucide="trophy" style="width:16px;height:16px;color:#BF5AF2"></i></div>
                
                
                
                
                
                
                
                <div class="routine-metric-pill-val" style="color:#BF5AF2">${DAY_ABBR[bestDayIdx]}</div>
                
                
                
                
                
                
                
                <div class="routine-metric-pill-lbl">Melhor Dia</div>
            </div>
        </div>

        <!-- Tab Content -->
        ${tabContent}
    </div>`;

  if (window.lucide) lucide.createIcons();
}

function persistSextaState() {
  localStorage.setItem('flowly_sexta_state', JSON.stringify(sextaState || {}));
}

function pushSextaNote(action, text) {
  sextaState.lastAction = text;
  sextaState.notes = [
    ...(Array.isArray(sextaState.notes) ? sextaState.notes : []).slice(-7),
    {
      action,
      text,
      at: new Date().toISOString()
    }
  ];
}

function pushSextaChatMessage(role, text, meta = '') {
  sextaState.chatHistory = [
    ...(Array.isArray(sextaState.chatHistory) ? sextaState.chatHistory : []).slice(-11),
    {
      id: `sexta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role,
      text,
      meta,
      at: new Date().toISOString()
    }
  ];
}

function getSextaMemories() {
  return Array.isArray(sextaState.memories) ? sextaState.memories : [];
}

function saveSextaMemory(text, source = 'manual') {
  const normalized = String(text || '').trim();
  if (!normalized) return null;
  const existing = getSextaMemories().find(
    (item) => String(item.text || '').toLowerCase() === normalized.toLowerCase()
  );
  if (existing) return existing;

  const memory = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: normalized,
    source,
    createdAt: new Date().toISOString()
  };
  sextaState.memories = [...getSextaMemories().slice(-19), memory];
  return memory;
}

function removeSextaMemory(query) {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return null;
  const memories = getSextaMemories();
  const target = memories.find((item) => String(item.text || '').toLowerCase().includes(normalized));
  if (!target) return null;
  sextaState.memories = memories.filter((item) => item.id !== target.id);
  return target;
}

function clearSextaMemories() {
  sextaState.memories = [];
}

function getSextaOperationalSnapshot() {
  const todayDate = localDateStr();
  const todayData = allTasksData[todayDate] || {};
  const pendingEntries = [];
  const completedEntries = [];

  Object.entries(todayData).forEach(([period, tasks]) => {
    if (!Array.isArray(tasks)) return;
    tasks.forEach((task, index) => {
      if (!task || !task.text) return;
      const entry = { task, period, index, dateStr: todayDate };
      if (task.completed) completedEntries.push(entry);
      else pendingEntries.push(entry);
    });
  });

  const projects = getProjectOptions();
  const activeProjects = projects.filter((project) => !project.completionDate && project.status !== 'archived');
  const unpaidProjects = projects.filter((project) => !project.isPaid && !project.isDraft && !project.completionDate);
  const lateProjects = activeProjects.filter(
    (project) => project.deadline && project.deadline < todayDate
  );
  const standaloneTasks = pendingEntries.filter((entry) => !entry.task.projectId);
  const moneyEntries = pendingEntries.filter(
    (entry) => String(entry.task.priority || '').toLowerCase() === 'money'
  );
  const followupEntries = pendingEntries.filter((entry) =>
    /follow|cobrar|cliente|whats|proposta|responder/i.test(String(entry.task.text || ''))
  );

  return {
    todayDate,
    pendingEntries,
    completedEntries,
    activeProjects,
    unpaidProjects,
    lateProjects,
    standaloneTasks,
    moneyEntries,
    followupEntries
  };
}

function buildSextaContextSummary(snapshot = getSextaOperationalSnapshot()) {
  const topPending = snapshot.pendingEntries.slice(0, 8).map((entry) => ({
    text: entry.task.text,
    priority: entry.task.priority || 'default',
    project: entry.task.projectName || null,
    period: entry.period
  }));
  const activeProjects = snapshot.activeProjects.slice(0, 6).map((project) => ({
    name: project.name,
    client: project.clientName || null,
    deadline: project.deadline || null,
    paid: project.isPaid === true
  }));
  const memories = getSextaMemories().slice(-8).map((item) => item.text);

  return {
    date: snapshot.todayDate,
    pendingCount: snapshot.pendingEntries.length,
    completedCount: snapshot.completedEntries.length,
    moneyCount: snapshot.moneyEntries.length,
    followupCount: snapshot.followupEntries.length,
    unpaidProjects: snapshot.unpaidProjects.length,
    topPending,
    activeProjects,
    memories
  };
}

async function requestSextaExternalReply(userPrompt) {
  const aiSettings = getFlowlyAISettings();
  if (!aiSettings.enabled || !aiSettings.apiKey) return null;

  const provider = String(aiSettings.provider || '').toLowerCase();
  const snapshot = getSextaOperationalSnapshot();
  const contextSummary = buildSextaContextSummary(snapshot);
  const baseHistory = (Array.isArray(sextaState.chatHistory) ? sextaState.chatHistory : [])
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: String(item.text || '')
    }));

  const systemContent = `${aiSettings.systemPrompt}\n\nContexto atual do Flowly:\n${JSON.stringify(contextSummary)}`;
  const messages = [{ role: 'system', content: systemContent }, ...baseHistory];

  const model =
    provider === 'minimax' && (!aiSettings.model || aiSettings.model === 'flowly-local-ops')
      ? 'M2-her'
      : aiSettings.model;

  let endpoint = aiSettings.endpoint;
  if (!endpoint && provider === 'minimax') endpoint = 'https://api.minimax.io/v1/chat/completions';
  if (!endpoint && provider === 'openai') endpoint = 'https://api.openai.com/v1/chat/completions';
  if (!endpoint) return null;

  const payload = {
    model,
    messages,
    temperature: provider === 'minimax' ? 1.0 : 0.7,
    max_tokens: 600
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiSettings.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IA ${response.status}: ${text.slice(0, 220)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('IA sem resposta em choices[0].message.content');
  return String(content).trim();
}

function buildSextaAssistantReply(prompt) {
  const question = String(prompt || '').trim();
  const lower = question.toLowerCase();
  const aiSettings = getFlowlyAISettings();
  const snapshot = getSextaOperationalSnapshot();
  const memories = getSextaMemories();
  const memoryHint =
    memories.length > 0
      ? `Memoria ativa: ${memories
          .slice(-3)
          .map((item) => item.text)
          .join(' | ')}.`
      : '';

  if (!question) {
    return 'Me manda uma pergunta direta. Ex.: o que eu ataco agora, quais projetos estão em risco, o que está sem projeto.';
  }

  if (/(o que|oq|que eu faço|ataco|prioridade|foco)/i.test(lower)) {
    const topMoney = snapshot.moneyEntries[0]?.task?.text;
    const topPending = snapshot.pendingEntries[0]?.task?.text;
    if (topMoney) {
      return `Ataca primeiro "${topMoney}". E uma tarefa com impacto direto em caixa, entao vale fechar esse ciclo antes de abrir outra frente. ${memoryHint}`.trim();
    }
    if (topPending) {
      return `Eu iria em "${topPending}" agora. Fecha essa peca inteira e depois revisa o resto da fila. ${memoryHint}`.trim();
    }
    return `Hoje esta limpo. Puxa uma tarefa curta que gere tracao ou organiza amanha com 3 prioridades reais. ${memoryHint}`.trim();
  }

  if (/(projeto|projetos|risco|atras)/i.test(lower)) {
    if (snapshot.lateProjects.length > 0) {
      const names = snapshot.lateProjects.slice(0, 3).map((project) => project.name).join(', ');
      return `Projetos em risco agora: ${names}. Eu revisaria prazo, proximo passo e pendencia de cliente ainda hoje. ${memoryHint}`.trim();
    }
    if (snapshot.activeProjects.length > 0) {
      const nextProject = snapshot.activeProjects[0];
      return `Voce tem ${snapshot.activeProjects.length} projeto(s) ativo(s). O mais sensivel agora parece ser "${nextProject.name}". Vale puxar um proximo passo claro dentro dele. ${memoryHint}`.trim();
    }
    return 'Nao encontrei projeto ativo agora. Talvez seja um bom momento para transformar tarefas soltas em projetos.';
  }

  if (/(dinheiro|caixa|receita|pago|pagamento)/i.test(lower)) {
    if (snapshot.moneyEntries.length > 0) {
      return `Existem ${snapshot.moneyEntries.length} tarefa(s) com prioridade dinheiro. A primeira da fila e "${snapshot.moneyEntries[0].task.text}". ${memoryHint}`.trim();
    }
    if (snapshot.unpaidProjects.length > 0) {
      return `Nao vi tarefa de dinheiro no topo, mas ha ${snapshot.unpaidProjects.length} projeto(s) ainda nao pagos. Vale revisar cobranca e follow-up. ${memoryHint}`.trim();
    }
    return 'Nao apareceu nenhum sinal forte de caixa no momento. Se quiser, eu posso te puxar um plano de follow-up para destravar receita.';
  }

  if (/(sem projeto|solta|soltas|desorganizada|desorganizadas)/i.test(lower)) {
    if (snapshot.standaloneTasks.length === 0) {
      return 'As pendencias principais ja estao relativamente organizadas em projeto ou rotina. Nao achei tarefa solta critica agora.';
    }
    const sample = snapshot.standaloneTasks.slice(0, 3).map((entry) => entry.task.text).join(', ');
    return `Voce tem ${snapshot.standaloneTasks.length} tarefa(s) pendente(s) sem projeto. As que eu olharia primeiro: ${sample}. ${memoryHint}`.trim();
  }

  if (/(amanh|planej|semana|resumo)/i.test(lower)) {
    return `Para o proximo bloco, eu montaria assim: 3 prioridades reais, 1 follow-up que puxa cliente e 1 tarefa que mexa em caixa. Hoje voce fechou ${snapshot.completedEntries.length} e ainda tem ${snapshot.pendingEntries.length} abertas. ${memoryHint}`.trim();
  }

  if (/(memoria|lembra|lembrancas|o que voce lembra)/i.test(lower)) {
    if (memories.length === 0) return 'Minha memoria esta vazia agora. Se quiser, me diga algo como: lembra que eu quero priorizar tarefas de dinheiro pela manha.';
    return `O que eu tenho salvo na memoria: ${memories.map((item) => item.text).join(' | ')}.`;
  }

  if (/(ia|modelo|chatgpt|minimax|openai)/i.test(lower)) {
    if (aiSettings.enabled && aiSettings.provider !== 'local') {
      return `O conector de IA esta configurado para ${aiSettings.provider} com modelo ${aiSettings.model}. A interface ja esta pronta; o proximo passo e plugar isso numa Edge Function para chamadas seguras. ${memoryHint}`.trim();
    }
    return 'No momento a Sexta esta respondendo no modo local, usando os dados do Flowly. Se quiser IA externa, configura em Ajustes > IA e depois a gente liga isso num backend.';
  }

  if (snapshot.followupEntries.length > 0) {
    return `Minha leitura: fecha primeiro "${snapshot.followupEntries[0].task.text}" ou a tarefa de maior impacto financeiro. O risco agora e deixar frente aberta demais. ${memoryHint}`.trim();
  }

  return `Minha leitura operacional e simples: corta ruido, escolhe uma frente de alavancagem e fecha antes de trocar. Se quiser, me pergunta sobre foco, projetos, dinheiro ou tarefas sem projeto. ${memoryHint}`.trim();
}

function openFlowlySettingsTab(tabId = 'ia') {
  localStorage.setItem(FLOWLY_SETTINGS_TAB_KEY, tabId);
  currentView = 'settings';
  renderView();
}

function buildSextaSuggestions() {
  const todayDate = localDateStr();
  const dayData = allTasksData[todayDate] || {};
  const allTodayTasks = [];
  Object.entries(dayData).forEach(([period, tasks]) => {
    if (!Array.isArray(tasks) || period === 'Rotina') return;
    tasks.forEach((task) => {
      if (task && task.text) allTodayTasks.push({ ...task, period });
    });
  });

  const pendingTasks = allTodayTasks.filter((task) => !task.completed);
  const completedTasks = allTodayTasks.filter((task) => task.completed);
  const suggestions = [];

  const moneyTasks = pendingTasks.filter((task) => String(task.priority || '').toLowerCase() === 'money');
  const followupTasks = pendingTasks.filter((task) => /follow|cobrar|cliente|whats|proposta/i.test(String(task.text || '')));

  if (moneyTasks.length > 0) {
    suggestions.push({
      title: 'Caixa primeiro',
      body: `Se quer puxar dinheiro, começa por: ${moneyTasks[0].text}`
    });
  } else if (pendingTasks.length > 0) {
    suggestions.push({
      title: 'Prioridade imediata',
      body: `Ataca primeiro: ${pendingTasks[0].text}`
    });
  }

  if (followupTasks.length > 0) {
    suggestions.push({
      title: 'Cliente na mesa',
      body: `Tem follow-up aberto: ${followupTasks[0].text}`
    });
  }

  if (completedTasks.length === 0 && pendingTasks.length > 0) {
    suggestions.push({
      title: 'Momentum',
      body: 'Fecha uma tarefa curta logo no início para ganhar tração.'
    });
  }

  if (pendingTasks.length >= 5) {
    suggestions.push({
      title: 'Corte de ruído',
      body: 'Tem tarefa demais aberta. Vale escolher 3 principais e ignorar o resto por agora.'
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: 'Ritmo bom',
      body: 'Hoje está mais limpo. Mantém o foco e evita abrir frente nova sem fechar ciclo.'
    });
  }

  return suggestions;
}

function runSextaQuickAction(action) {
  const suggestions = buildSextaSuggestions();
  if (action === 'focus') {
    sextaState.lastAction = suggestions[0] ? suggestions[0].body : 'Sem sugestão agora.';
  } else if (action === 'review') {
    const todayDate = localDateStr();
    const { total, completed } = countDayTasks(todayDate);
    sextaState.lastAction = `Hoje: ${completed}/${total} concluídas. Fecha o que ficou aberto antes de virar o dia.`;
  } else if (action === 'tomorrow') {
    sextaState.lastAction = 'Amanhã: separa 3 prioridades, 1 follow-up e 1 tarefa que puxe caixa.';
  } else if (action === 'plan') {
    const todayDate = localDateStr();
    const created = [
      createTaskViaSexta(todayDate, 'Definir 3 prioridades reais do dia'),
      createTaskViaSexta(todayDate, 'Fechar 1 tarefa rápida para ganhar momentum'),
      createTaskViaSexta(todayDate, 'Atacar a tarefa de maior alavancagem sem abrir outra frente')
    ].filter(Boolean).length;
    sextaState.lastAction = created > 0
      ? `Criei ${created} tarefas-base para organizar tua execução de hoje.`
      : 'Não consegui criar novas tarefas agora.';
  }
  sextaState.suggestions = suggestions;
  pushSextaNote(action, sextaState.lastAction);
  pushSextaChatMessage('assistant', sextaState.lastAction, 'acao rapida');
  persistSextaState();
  renderSextaView();
}

function runSextaCommand() {
  const input = document.getElementById('sextaCommandInput');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;

  const lower = raw.toLowerCase();
  const todayDate = localDateStr();
  let handled = false;

  if (lower.startsWith('criar tarefa ')) {
    const taskText = raw.slice('criar tarefa '.length).trim();
    handled = createTaskViaSexta(todayDate, taskText);
    sextaState.lastAction = handled
      ? `Criei a tarefa: ${taskText}`
      : 'Não consegui criar essa tarefa.';
  } else if (lower.startsWith('priorizar ')) {
    const query = raw.slice('priorizar '.length).trim();
    const task = prioritizeTaskViaSexta(todayDate, query);
    handled = !!task;
    sextaState.lastAction = task
      ? `Joguei "${task.text}" para o topo das prioridades de hoje.`
      : 'Não achei uma tarefa com esse texto para priorizar.';
  } else if (lower.includes('concluir próxima') || lower.includes('concluir proxima')) {
    const next = findFirstPendingTask(todayDate);
    if (next) {
      window.toggleTaskStatus(todayDate, next.period, next.index, true, null);
      handled = true;
      sextaState.lastAction = `Concluí a próxima tarefa pendente: ${next.task.text}`;
    } else {
      handled = true;
      sextaState.lastAction = 'Não achei tarefa pendente para concluir agora.';
    }
  } else if (lower.includes('foco')) {
    runSextaQuickAction('focus');
    input.value = '';
    return;
  } else if (lower.includes('amanhã') || lower.includes('amanha')) {
    runSextaQuickAction('tomorrow');
    input.value = '';
    return;
  } else if (lower.includes('planeja') || lower.includes('plano')) {
    runSextaQuickAction('plan');
    input.value = '';
    return;
  } else {
    sextaState.lastAction = 'Ainda não entendi esse comando. Tenta algo como: criar tarefa revisar proposta, foco, planejar amanhã.';
    handled = true;
  }

  sextaState.notes = [
    ...(sextaState.notes || []).slice(-4),
    {
      action: 'command',
      text: sextaState.lastAction,
      at: new Date().toISOString()
    }
  ];
  persistSextaState();
  input.value = '';
  renderSextaView();
}

runSextaQuickAction = function (action) {
  const suggestions = buildSextaSuggestions();
  if (action === 'focus') {
    sextaState.lastAction = suggestions[0] ? suggestions[0].body : 'Sem sugestao agora.';
  } else if (action === 'review') {
    const todayDate = localDateStr();
    const { total, completed } = countDayTasks(todayDate);
    sextaState.lastAction = `Hoje: ${completed}/${total} concluidas. Fecha o que ficou aberto antes de virar o dia.`;
  } else if (action === 'tomorrow') {
    sextaState.lastAction = 'Amanha: separa 3 prioridades, 1 follow-up e 1 tarefa que puxe caixa.';
  } else if (action === 'plan') {
    const todayDate = localDateStr();
    const created = [
      createTaskViaSexta(todayDate, 'Definir 3 prioridades reais do dia'),
      createTaskViaSexta(todayDate, 'Fechar 1 tarefa rapida para ganhar momentum'),
      createTaskViaSexta(todayDate, 'Atacar a tarefa de maior alavancagem sem abrir outra frente')
    ].filter(Boolean).length;
    sextaState.lastAction =
      created > 0
        ? `Criei ${created} tarefas-base para organizar tua execucao de hoje.`
        : 'Nao consegui criar novas tarefas agora.';
  }
  sextaState.suggestions = suggestions;
  pushSextaNote(action, sextaState.lastAction);
  pushSextaChatMessage('assistant', sextaState.lastAction, 'acao rapida');
  persistSextaState();
  renderSextaView();
};

runSextaCommand = async function () {
  const input = document.getElementById('sextaCommandInput');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;

  const lower = raw.toLowerCase();
  const normalizedLower = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const todayDate = localDateStr();
  let responseText = '';
  let responseMeta = 'sexta';
  const createMatch = raw.match(/^(criar tarefa|cria tarefa|criar|cria|adicionar tarefa|adiciona tarefa|adicionar|adiciona|anotar|anota|nova tarefa)\s+(.+)$/i);
  const prioritizeMatch = raw.match(/^(priorizar|prioriza|colocar no topo|coloca no topo|puxa pro topo|puxa para o topo)\s+(.+)$/i);
  const completeMatch = raw.match(/^(concluir|conclui|fechar|fecha|finalizar|finaliza|resolver|resolve)\s+(.+)$/i);
  const deleteMatch = raw.match(/^(apagar|apaga|excluir|exclui|deletar|deleta|remover|remove)\s+(.+)$/i);
  const moveMatch = raw.match(/^(mover|move|jogar|joga|passar|passa)\s+(.+?)\s+para\s+(amanha|amanhã|hoje)$/i);

  pushSextaChatMessage('user', raw, 'pergunta');
  persistSextaState();
  input.value = '';
  renderSextaView();

  if (
    normalizedLower.startsWith('lembrar ') ||
    normalizedLower.startsWith('lembra que ') ||
    normalizedLower.startsWith('memorizar ') ||
    normalizedLower.startsWith('guarde ')
  ) {
    const memoryText = raw
      .replace(/^lembrar\s+/i, '')
      .replace(/^lembra que\s+/i, '')
      .replace(/^memorizar\s+/i, '')
      .replace(/^guarde\s+/i, '')
      .trim();
    const memory = saveSextaMemory(memoryText, 'chat');
    responseText = memory
      ? `Guardei isso na memoria: ${memory.text}`
      : 'Nao consegui registrar essa memoria.';
  } else if (normalizedLower.startsWith('esquecer ') || normalizedLower.startsWith('remove da memoria ')) {
    const memoryQuery = raw.replace(/^esquecer\s+/i, '').replace(/^remove da memoria\s+/i, '').trim();
    const removed = removeSextaMemory(memoryQuery);
    responseText = removed
      ? `Removi da memoria: ${removed.text}`
      : 'Nao achei nada parecido na memoria para remover.';
  } else if (normalizedLower.includes('limpar memoria')) {
    clearSextaMemories();
    responseText = 'Limpei a memoria da Sexta.';
  } else if (createMatch) {
    const taskText = createMatch[2].trim();
    const handled = createTaskViaSexta(todayDate, taskText);
    responseText = handled ? `Criei a tarefa: ${taskText}` : 'Nao consegui criar essa tarefa.';
    responseMeta = 'acao executada';
  } else if (prioritizeMatch) {
    const query = prioritizeMatch[2].trim();
    const task = prioritizeTaskViaSexta(todayDate, query);
    responseText = task
      ? `Joguei "${task.text}" para o topo das prioridades de hoje.`
      : 'Nao achei uma tarefa com esse texto para priorizar.';
    responseMeta = 'acao executada';
  } else if (normalizedLower.includes('concluir proxima')) {
    const next = findFirstPendingTask(todayDate);
    if (next) {
      window.toggleTaskStatus(todayDate, next.period, next.index, true, null);
      responseText = `Conclui a proxima tarefa pendente: ${next.task.text}`;
    } else {
      responseText = 'Nao achei tarefa pendente para concluir agora.';
    }
    responseMeta = 'acao executada';
  } else if (completeMatch) {
    const query = completeMatch[2].replace(/^(a|a tarefa|tarefa)\s+/i, '').trim();
    const completedTask = completeTaskViaSexta(query, todayDate);
    responseText = completedTask
      ? `Marquei como concluida: ${completedTask.task.text}`
      : 'Nao achei essa tarefa para concluir.';
    responseMeta = 'acao executada';
  } else if (deleteMatch) {
    const query = deleteMatch[2].replace(/^(a|a tarefa|tarefa)\s+/i, '').trim();
    const removedTask = deleteTaskViaSexta(query, todayDate);
    responseText = removedTask
      ? `Apaguei a tarefa: ${removedTask.task.text}`
      : 'Nao achei essa tarefa para apagar.';
    responseMeta = 'acao executada';
  } else if (moveMatch) {
    const query = moveMatch[2].replace(/^(a|a tarefa|tarefa)\s+/i, '').trim();
    const targetDateStr = /amanha|amanhã/i.test(moveMatch[3]) ? getRelativeDateStr(1) : todayDate;
    const movedTask = moveTaskViaSexta(query, targetDateStr, 'Tarefas', todayDate);
    responseText = movedTask
      ? `Mudei "${movedTask.task.text}" para ${targetDateStr === todayDate ? 'hoje' : 'amanha'}.`
      : 'Nao achei essa tarefa para mover.';
    responseMeta = 'acao executada';
  } else if (normalizedLower.includes('foco')) {
    runSextaQuickAction('focus');
    return;
  } else if (normalizedLower.includes('amanha')) {
    runSextaQuickAction('tomorrow');
    return;
  } else if (normalizedLower.includes('planeja') || normalizedLower.includes('plano')) {
    runSextaQuickAction('plan');
    return;
  } else {
    const aiSettings = getFlowlyAISettings();
    const providerLabel = aiSettings.provider && aiSettings.provider !== 'local'
      ? String(aiSettings.provider).toLowerCase()
      : 'modo local';

    try {
      const externalReply = await requestSextaExternalReply(raw);
      if (externalReply) {
        responseText = externalReply;
        responseMeta = providerLabel;
      } else {
        responseText = buildSextaAssistantReply(raw);
        responseMeta = 'modo local';
      }
    } catch (error) {
      responseText = buildSextaAssistantReply(raw);
      responseMeta = 'fallback local';
      pushSextaNote(
        'ia',
        `Falha no conector ${providerLabel}: ${String(error?.message || 'erro desconhecido').slice(0, 180)}`
      );
    }
  }

  pushSextaNote('command', responseText);
  pushSextaChatMessage('assistant', responseText, responseMeta);
  persistSextaState();
  renderSextaView();
};

renderSextaView = function () {
  const view = document.getElementById('sextaView');
  if (!view) return;

  const todayDate = localDateStr();
  const todayData = allTasksData[todayDate] || {};
  const allOpenToday = [];
  Object.entries(todayData).forEach(([period, tasks]) => {
    if (!Array.isArray(tasks)) return;
    tasks.forEach((task, index) => {
      if (task && !task.completed) allOpenToday.push({ task, period, index });
    });
  });
  const openRoutineToday = getRoutineTasksForDate(todayDate).filter((task) => task && !task.completed);
  const moneyOpen = allOpenToday.filter((entry) => String(entry.task.priority || '').toLowerCase() === 'money');
  const urgentOpen = allOpenToday.filter((entry) => String(entry.task.priority || '').toLowerCase() === 'urgent');
  const followUpOpen = allOpenToday.filter((entry) => /follow|cobrar|cliente|whats|proposta/i.test(String(entry.task.text || '')));
  const bottleneckLabel = moneyOpen.length > 0
    ? 'Caixa pendente na mesa.'
    : urgentOpen.length > 0
      ? 'Tem urgência aberta travando o ritmo.'
      : openRoutineToday.length > 2
        ? 'Rotina está comendo teu foco.'
        : allOpenToday.length > 5
          ? 'Excesso de frente aberta.'
          : 'Fluxo sob controle.';
  const primaryMoneyTask = moneyOpen[0]?.task?.text || 'Nenhuma tarefa marcada como dinheiro hoje.';
  const primaryFollowupTask = followUpOpen[0]?.task?.text || 'Nenhum follow-up pendente visível.';
  const { total, completed } = countDayTasks(todayDate);
  const pending = Math.max(0, total - completed);
  const weekDates = getWeekDates(0);
  let weekTotal = 0;
  let weekCompleted = 0;
  weekDates.forEach(({ dateStr }) => {
    const stats = countDayTasks(dateStr);
    weekTotal += stats.total;
    weekCompleted += stats.completed;
  });
  const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;
  const suggestions = buildSextaSuggestions();
  if (!Array.isArray(sextaState.suggestions) || sextaState.suggestions.length === 0) {
    sextaState.suggestions = suggestions;
    persistSextaState();
  }
  const lastAction = sextaState.lastAction || 'Ainda sem ação rodada aqui dentro. Usa os botões abaixo pra eu começar a operar no painel.';
  const notes = Array.isArray(sextaState.notes) ? sextaState.notes.slice().reverse().slice(0, 3) : [];
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const focusLabel = pending <= 2 ? 'Fechamento' : pending <= 5 ? 'Execução' : 'Limpeza';
  const momentumLabel = completionRate >= 70 ? 'Alto' : completionRate >= 35 ? 'Médio' : 'Baixo';

  view.innerHTML = `
    <div class="flowly-shell flowly-shell--narrow sexta-shell">
      <div class="sexta-hero">
        <div class="sexta-hero-main">
          <div class="sexta-kicker">Sexta inside Flowly</div>
          <h2>Sala de comando</h2>
          <p>Camada de inteligência, contexto e ação para transformar o Flowly em sistema vivo.</p>
          <div class="sexta-hero-pills">
            <span class="sexta-pill">Modo ${focusLabel}</span>
            <span class="sexta-pill sexta-pill--soft">Momentum ${momentumLabel}</span>
          </div>
        </div>
        <div class="sexta-hero-side">
          <div class="sexta-mini-stat">
            <span class="sexta-mini-label">Hoje</span>
            <strong>${completed}/${total}</strong>
            <span>${pending} pendentes</span>
          </div>
          <div class="sexta-mini-stat">
            <span class="sexta-mini-label">Semana</span>
            <strong>${weekRate}%</strong>
            <span>${weekCompleted}/${weekTotal} concluídas</span>
          </div>
        </div>
      </div>

      <div class="sexta-overview-grid">
        <div class="sexta-overview-card">
          <span class="sexta-panel-label">Taxa de conclusão hoje</span>
          <strong>${completionRate}%</strong>
          <p>${completionRate >= 70 ? 'Dia sob controle.' : completionRate >= 35 ? 'Tem tração, mas ainda dá pra apertar.' : 'Baixa tração. Fecha uma tarefa curta e entra no fluxo.'}</p>
        </div>
        <div class="sexta-overview-card">
          <span class="sexta-panel-label">Caixa em aberto</span>
          <strong>${moneyOpen.length}</strong>
          <p>${primaryMoneyTask}</p>
        </div>
        <div class="sexta-overview-card">
          <span class="sexta-panel-label">Gargalo do dia</span>
          <strong>${bottleneckLabel}</strong>
          <p>${followUpOpen.length > 0 ? 'Follow-up pendente: ' + primaryFollowupTask : pending > 5 ? 'Tem tarefa demais aberta ao mesmo tempo.' : 'Nada crítico travando agora.'}</p>
        </div>
      </div>

      <div class="sexta-grid">
        <section class="sexta-card sexta-card--chat">
          <div class="sexta-card-head">
            <div>
              <h3>Chat operacional</h3>
              <p>Espaço para pedir estratégia, foco, revisão e próximos passos.</p>
            </div>
            <span class="sexta-badge">Ao vivo</span>
          </div>
          <div class="sexta-chat-placeholder">
            <div class="sexta-chat-bubble ai">Posso virar teu copiloto dentro do Flowly: sugerir prioridade, limpar ruído e destravar execução.</div>
            <div class="sexta-chat-bubble human">O que eu ataco agora?</div>
            <div class="sexta-chat-bubble ai">Começa pela próxima tarefa de maior alavancagem e fecha o ciclo antes de abrir outra frente. Também já aceito comandos como criar tarefa, priorizar e concluir próxima.</div>
          </div>
          <div class="sexta-command-row">
            <input id="sextaCommandInput" class="task-input sexta-command-input" type="text" placeholder="Ex.: criar tarefa revisar proposta, priorizar proposta, concluir próxima">
            <button class="btn-primary" type="button" onclick="runSextaCommand()">Executar</button>
          </div>
          <div class="sexta-quick-actions">
            <button class="btn-secondary" type="button" onclick="runSextaQuickAction('focus')">Sugerir foco</button>
            <button class="btn-secondary" type="button" onclick="runSextaQuickAction('review')">Revisar hoje</button>
            <button class="btn-secondary" type="button" onclick="runSextaQuickAction('tomorrow')">Planejar amanhã</button>
            <button class="btn-secondary" type="button" onclick="runSextaQuickAction('plan')">Montar plano base</button>
          </div>
          <div class="sexta-command-examples">
            <button type="button" class="sexta-chip" onclick="document.getElementById('sextaCommandInput').value='priorizar lévessy'">priorizar lévessy</button>
            <button type="button" class="sexta-chip" onclick="document.getElementById('sextaCommandInput').value='criar tarefa cobrar cliente antigo'">criar tarefa cobrar cliente antigo</button>
            <button type="button" class="sexta-chip" onclick="document.getElementById('sextaCommandInput').value='concluir próxima'">concluir próxima</button>
          </div>
        </section>

        <section class="sexta-card">
          <div class="sexta-card-head">
            <div>
              <h3>Motor estratégico</h3>
              <p>Sugestões reais calculadas a partir do estado atual do teu dia.</p>
            </div>
          </div>
          <div class="sexta-panel-block">
            <div class="sexta-panel-label">Última ação</div>
            <div class="sexta-panel-highlight">${lastAction}</div>
          </div>
          <div class="sexta-ops-grid">
            <div class="sexta-panel-block sexta-panel-block--soft">
              <div class="sexta-panel-label">Próxima ação que puxa caixa</div>
              <div class="sexta-panel-highlight sexta-panel-highlight--small">${primaryMoneyTask}</div>
            </div>
            <div class="sexta-panel-block sexta-panel-block--soft">
              <div class="sexta-panel-label">Follow-up mais próximo</div>
              <div class="sexta-panel-highlight sexta-panel-highlight--small">${primaryFollowupTask}</div>
            </div>
          </div>
          <div class="sexta-list">
            ${suggestions
              .map(
                (item) => `<div class="sexta-list-item"><span class="sexta-dot"></span><div><strong>${item.title}</strong><p>${item.body}</p></div></div>`
              )
              .join('')}
          </div>
          <div class="sexta-panel-block sexta-panel-block--soft">
            <div class="sexta-panel-label">Log recente</div>
            <div class="sexta-log-list">
              ${notes.length > 0 ? notes
                .map((note) => `<div class="sexta-log-item"><strong>${note.action}</strong><span>${note.text}</span></div>`)
                .join('') : '<div class="sexta-log-item"><strong>vazio</strong><span>Nenhuma ação rápida rodada ainda.</span></div>'}
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
};

renderSextaView = function () {
  const view = document.getElementById('sextaView');
  if (!view) return;

  const aiSettings = getFlowlyAISettings();
  const snapshot = getSextaOperationalSnapshot();
  const activeTab = String(sextaState.activeTab || 'chat').trim() || 'chat';
  const { total, completed } = countDayTasks(snapshot.todayDate);
  const pending = Math.max(0, total - completed);
  const weekDates = getWeekDates(0);
  let weekTotal = 0;
  let weekCompleted = 0;
  weekDates.forEach(({ dateStr }) => {
    const stats = countDayTasks(dateStr);
    weekTotal += stats.total;
    weekCompleted += stats.completed;
  });

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;
  const focusLabel = pending <= 2 ? 'Fechamento' : pending <= 5 ? 'Execucao' : 'Limpeza';
  const momentumLabel = completionRate >= 70 ? 'Alto' : completionRate >= 35 ? 'Medio' : 'Baixo';
  const bottleneckLabel =
    snapshot.moneyEntries.length > 0
      ? 'Caixa pendente na mesa.'
      : snapshot.followupEntries.length > 0
        ? 'Follow-up aberto pedindo resposta.'
        : snapshot.pendingEntries.length > 5
          ? 'Frente demais aberta ao mesmo tempo.'
          : 'Fluxo sob controle.';
  const primaryMoneyTask =
    snapshot.moneyEntries[0]?.task?.text || 'Nenhuma tarefa marcada como dinheiro hoje.';
  const primaryFollowupTask =
    snapshot.followupEntries[0]?.task?.text || 'Nenhum follow-up pendente visivel.';
  const suggestions = buildSextaSuggestions();
  const notes = Array.isArray(sextaState.notes) ? sextaState.notes.slice().reverse().slice(0, 4) : [];
  const memories = getSextaMemories().slice().reverse();
  const history =
    Array.isArray(sextaState.chatHistory) && sextaState.chatHistory.length > 0
      ? sextaState.chatHistory.slice(-8)
      : [
          {
            id: 'seed_ai_1',
            role: 'assistant',
            text: 'Eu leio teu Flowly e te respondo com base em tarefas, projetos e foco operacional.',
            meta: aiSettings.enabled && aiSettings.provider !== 'local' ? 'conector pronto' : 'modo local'
          },
          {
            id: 'seed_user_1',
            role: 'user',
            text: 'O que eu ataco agora?',
            meta: ''
          },
          {
            id: 'seed_ai_2',
            role: 'assistant',
            text: buildSextaAssistantReply('o que eu ataco agora'),
            meta: 'leitura do dia'
          }
        ];

  const assistantModeLabel =
    aiSettings.enabled && aiSettings.provider !== 'local'
      ? `${aiSettings.provider} · ${aiSettings.model}`
      : 'modo local Flowly';
  const assistantHint =
    aiSettings.enabled && aiSettings.provider !== 'local'
      ? `Conector ${String(aiSettings.provider).toLowerCase()} ativo. A Sexta tenta responder por ele e volta para o modo local se a chamada falhar.`
      : 'Respondendo com heuristica local baseada nos teus dados do Flowly.';
  const tabButtons = [
    { id: 'chat', label: 'Chat' },
    { id: 'command', label: 'Centro de comando' },
    { id: 'memory', label: 'Memoria' }
  ]
    .map(
      (tab) =>
        `<button type="button" class="sexta-tab-btn${activeTab === tab.id ? ' is-active' : ''}" data-sexta-tab="${tab.id}">${tab.label}</button>`
    )
    .join('');
  const chatPanel = `
        <section class="sexta-card sexta-card--chat sexta-card--chat-shell">
          <div class="sexta-card-head">
            <div>
              <h3>Chat</h3>
              <p>Pergunta sobre foco, projetos, dinheiro, backlog e proximos passos.</p>
            </div>
            <button class="sexta-link-btn" type="button" onclick="openFlowlySettingsTab('ia')">Conectar IA</button>
          </div>

          <div class="sexta-chat-status">
            <span class="sexta-badge">${assistantModeLabel}</span>
            <span>${assistantHint}</span>
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

          <div class="sexta-command-row sexta-command-row--composer">
            <input id="sextaCommandInput" class="task-input sexta-command-input" type="text" placeholder="Ex.: o que eu ataco agora?, quais projetos estao em risco?, criar tarefa cobrar cliente" />
            <button class="btn-primary" type="button" onclick="runSextaCommand()">Enviar</button>
          </div>

          <div class="sexta-command-examples">
            <button type="button" class="sexta-chip" onclick="document.getElementById('sextaCommandInput').value='o que eu ataco agora?'">o que eu ataco agora?</button>
            <button type="button" class="sexta-chip" onclick="document.getElementById('sextaCommandInput').value='quais projetos estao em risco?'">quais projetos estao em risco?</button>
            <button type="button" class="sexta-chip" onclick="document.getElementById('sextaCommandInput').value='quais tarefas estao sem projeto?'">quais tarefas estao sem projeto?</button>
            <button type="button" class="sexta-chip" onclick="document.getElementById('sextaCommandInput').value='lembra que eu priorizo tarefas de dinheiro pela manha'">lembra que...</button>
            <button type="button" class="sexta-chip" onclick="document.getElementById('sextaCommandInput').value='criar tarefa cobrar cliente antigo'">criar tarefa cobrar cliente antigo</button>
          </div>
        </section>
  `;
  const commandPanel = `
        <section class="sexta-card sexta-card--intel">
          <div class="sexta-card-head">
            <div>
              <h3>Centro de comando</h3>
              <p>O que a Sexta esta vendo agora dentro do teu Flowly.</p>
            </div>
          </div>

          <div class="sexta-panel-block">
            <div class="sexta-panel-label">Ultima acao</div>
            <div class="sexta-panel-highlight">${escapeProjectHtml(sextaState.lastAction || 'Nenhuma acao rodada ainda.')}</div>
          </div>

          <div class="sexta-insight-grid">
            <div class="sexta-panel-block sexta-panel-block--soft">
              <div class="sexta-panel-label">Proximo foco de caixa</div>
              <div class="sexta-panel-highlight sexta-panel-highlight--small">${escapeProjectHtml(primaryMoneyTask)}</div>
            </div>
            <div class="sexta-panel-block sexta-panel-block--soft">
              <div class="sexta-panel-label">Follow-up mais proximo</div>
              <div class="sexta-panel-highlight sexta-panel-highlight--small">${escapeProjectHtml(primaryFollowupTask)}</div>
            </div>
          </div>

          <div class="sexta-list">
            ${suggestions
              .map(
                (item) => `<div class="sexta-list-item"><span class="sexta-dot"></span><div><strong>${escapeProjectHtml(item.title)}</strong><p>${escapeProjectHtml(item.body)}</p></div></div>`
              )
              .join('')}
          </div>

          <div class="sexta-panel-block sexta-panel-block--soft">
            <div class="sexta-panel-label">Estado rapido</div>
            <div class="sexta-metrics-list">
              <div><strong>${snapshot.pendingEntries.length}</strong><span>pendencias abertas hoje</span></div>
              <div><strong>${snapshot.followupEntries.length}</strong><span>follow-ups esperando resposta</span></div>
              <div><strong>${snapshot.unpaidProjects.length}</strong><span>projetos ainda nao pagos</span></div>
            </div>
          </div>

          <div class="sexta-panel-block sexta-panel-block--soft">
            <div class="sexta-panel-label">Log recente</div>
            <div class="sexta-log-list">
              ${notes.length > 0
                ? notes
                    .map(
                      (note) => `<div class="sexta-log-item"><strong>${escapeProjectHtml(note.action)}</strong><span>${escapeProjectHtml(note.text)}</span></div>`
                    )
                    .join('')
                : '<div class="sexta-log-item"><strong>vazio</strong><span>Nenhuma acao rapida rodada ainda.</span></div>'}
            </div>
          </div>
        </section>
  `;
  const memoryPanel = `
        <section class="sexta-card sexta-card--memory">
          <div class="sexta-card-head">
            <div>
              <h3>Memoria do agente</h3>
              <p>Comandos e preferencias que a Sexta deve carregar nas proximas conversas.</p>
            </div>
            <button class="sexta-link-btn" type="button" onclick="document.getElementById('sextaCommandInput').value='limpar memoria'; runSextaCommand();">Limpar memoria</button>
          </div>

          <div class="sexta-panel-block sexta-panel-block--soft">
            <div class="sexta-panel-label">Como usar</div>
            <div class="sexta-memory-guide">
              <div><strong>Salvar</strong><span>lembra que eu prefiro atacar dinheiro pela manha</span></div>
              <div><strong>Consultar</strong><span>o que voce lembra?</span></div>
              <div><strong>Apagar</strong><span>esquecer prefiro atacar dinheiro pela manha</span></div>
            </div>
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

  view.innerHTML = `
    <div class="flowly-shell flowly-shell--wide sexta-shell sexta-shell--rebuilt">
      <div class="sexta-hero sexta-hero--rebuilt">
        <div class="sexta-hero-main">
          <div class="sexta-kicker">Sexta</div>
          <h2>Assistente operacional do Flowly</h2>
          <p>Chat para perguntar, revisar contexto e decidir a proxima acao sem sair do teu sistema.</p>
          <div class="sexta-hero-pills">
            <span class="sexta-pill">Modo ${focusLabel}</span>
            <span class="sexta-pill sexta-pill--soft">Momentum ${momentumLabel}</span>
            <span class="sexta-pill sexta-pill--soft">${assistantModeLabel}</span>
          </div>
        </div>
        <div class="sexta-hero-side sexta-hero-side--stacked">
          <div class="sexta-mini-stat">
            <span class="sexta-mini-label">Hoje</span>
            <strong>${completed}/${total}</strong>
            <span>${pending} pendentes</span>
          </div>
          <div class="sexta-mini-stat">
            <span class="sexta-mini-label">Semana</span>
            <strong>${weekRate}%</strong>
            <span>${weekCompleted}/${weekTotal} concluidas</span>
          </div>
          <div class="sexta-mini-stat">
            <span class="sexta-mini-label">Projetos ativos</span>
            <strong>${snapshot.activeProjects.length}</strong>
            <span>${snapshot.lateProjects.length} em risco agora</span>
          </div>
        </div>
      </div>

      <div class="sexta-overview-grid sexta-overview-grid--tight">
        <div class="sexta-overview-card">
          <span class="sexta-panel-label">Leitura do dia</span>
          <strong>${bottleneckLabel}</strong>
          <p>${assistantHint}</p>
        </div>
        <div class="sexta-overview-card">
          <span class="sexta-panel-label">Caixa em aberto</span>
          <strong>${snapshot.moneyEntries.length}</strong>
          <p>${escapeProjectHtml(primaryMoneyTask)}</p>
        </div>
        <div class="sexta-overview-card">
          <span class="sexta-panel-label">Tarefas sem projeto</span>
          <strong>${snapshot.standaloneTasks.length}</strong>
          <p>${snapshot.standaloneTasks[0] ? escapeProjectHtml(snapshot.standaloneTasks[0].task.text) : 'Nada gritando por organizacao agora.'}</p>
        </div>
      </div>

      <div class="sexta-tabs">
        ${tabButtons}
      </div>

      <div class="sexta-grid sexta-grid--rebuilt ${activeTab === 'chat' ? 'sexta-grid--chat' : ''}">
        ${
          activeTab === 'chat'
            ? chatPanel + commandPanel
            : activeTab === 'memory'
              ? memoryPanel + chatPanel
              : commandPanel + chatPanel
        }
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

  const { total, completed } = countDayTasks(snapshot.todayDate);
  const pending = Math.max(0, total - completed);
  const weekDates = getWeekDates(0);
  let weekTotal = 0;
  let weekCompleted = 0;
  weekDates.forEach(({ dateStr }) => {
    const stats = countDayTasks(dateStr);
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
          <button class="sexta-link-btn" type="button" onclick="runSextaQuickAction('focus')">Puxar foco</button>
          <button class="sexta-link-btn" type="button" onclick="runSextaQuickAction('review')">Revisar hoje</button>
          <button class="sexta-link-btn" type="button" onclick="runSextaQuickAction('tomorrow')">Planejar amanha</button>
          <button class="sexta-link-btn" type="button" onclick="runSextaQuickAction('plan')">Criar base</button>
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
          <button class="sexta-link-btn" type="button" onclick="document.getElementById('sextaCommandInput').value='limpar memoria'; runSextaCommand();">Limpar memoria</button>
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
          <button class="sexta-link-btn" type="button" onclick="openFlowlySettingsTab('ia')">Conectar IA</button>
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
          <button class="btn-primary" type="button" onclick="runSextaCommand()">Enviar</button>
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
    alert('Preenche descrição e valor certinho.');
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
        <div class="finance-hero-copy">
          <div class="finance-kicker">Finance intelligence</div>
          <h2>Visão financeira clara, rápida e útil</h2>
          <p>${analytics.analysisTone}</p>
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
              <h3>Leitura mensal</h3>
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

  renderFinanceCharts(analytics);
}


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
        <button onclick="document.getElementById('projectsQuickModal').remove()" style="background:rgba(255,255,255,0.06);border:none;border-radius:12px;width:36px;height:36px;cursor:pointer;color:rgba(255,255,255,0.6);font-size:18px;display:flex;align-items:center;justify-content:center">x</button>
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
        <button onclick="document.getElementById('projectsQuickModal').remove()" class="btn-secondary" style="width:auto;padding:13px 20px;border-radius:16px">Cancelar</button>
        <button onclick="quickCreateProject()" class="btn-primary" style="width:auto;padding:13px 20px;border-radius:16px;background:#4D6BFE">Criar projeto</button>
      </div>
    </div>`;

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
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
  const text = prompt('Nome da tarefa:');
  if (!text || !text.trim()) return;
  const dateStr = localDateStr();
  const period = 'Tarefas';
  const project = findProjectById(projectId);
  if (!project) return;
  const currentList = allTasksData[dateStr]?.[period] || [];
  const newTask = {
    text: text.trim(),
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
};

window.archiveProject = function (projectId) {
  if (!confirm('Tem certeza que quer arquivar esse projeto?')) return;
  updateProjectRecord(projectId, (project) => ({ ...project, status: 'archived' }));
  if (currentView === 'projects') renderProjectsView();
};

window.deleteProject = function (projectId) {
  if (!confirm('Remover esse projeto permanentemente?')) return;
  projectsState = normalizeProjectsState(projectsState);
  projectsState.projects = projectsState.projects.filter((p) => p.id !== projectId);
  persistProjectsStateLocal();
  scheduleProjectsSync();
  if (currentView === 'projects') renderProjectsView();
};

function getProjectStatus(project, today) {
  if (project.isDraft || project.status === 'draft') return { label: 'Rascunho', cls: 'projects-badge--draft' };
  if (project.status === 'archived') return { label: 'Arquivado', cls: 'projects-badge--archived' };
  if (project.completionDate) {
    if (project.isPaid) return { label: 'Concluído e pago', cls: 'projects-badge--done-paid' };
    return { label: 'Concluído', cls: 'projects-badge--done' };
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

function renderProjectsView() {
  const view = document.getElementById('projectsView');
  if (!view) return;

  const analytics = buildProjectsAnalytics();
  const formatBRL = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      Number(value || 0)
    );
  const taskCandidates = collectProjectTaskCandidates({ includeLinked: false, max: 10 });
  const taskBacklogCount = collectProjectTaskCandidates({ includeLinked: false, max: 999 }).length;
  const draftTemplates = getProjectOptions().filter(
    (project) => project.isDraft || project.status === 'draft'
  );
  const today = localDateStr();
  const allProjects = analytics.projects;
  const urgentProjects = getUrgentProjects(allProjects, 5);
  const filteredProjects = filterProjects(allProjects, projectsFilter, today);
  const boardSections = buildProjectsBoardSections(filteredProjects, projectsFilter, today);
  const starterTasks = taskCandidates.slice(0, 4);
  const starterTransactionSuggestions = analytics.suggestionTransactions.slice(0, 3);
  const activeCount = allProjects.filter(
    (p) => !p.isDraft && !p.completionDate && p.status !== 'archived'
  ).length;
  const lateCount = allProjects.filter(
    (p) => !p.completionDate && p.deadline && p.deadline < today && !p.isDraft
  ).length;
  const draftCount = allProjects.filter((p) => p.isDraft || p.status === 'draft').length;
  const doneCount = allProjects.filter((p) => !!p.completionDate).length;
  const archivedCount = allProjects.filter((p) => p.status === 'archived').length;
  const paidCount = allProjects.filter((p) => p.isPaid).length;
  const unpaidCount = allProjects.filter((p) => !p.isPaid && !p.isDraft).length;
  const totalRevenue = allProjects.reduce(
    (sum, project) => sum + (project.expectedValue || 0),
    0
  );
  const deliveredUnpaidCount = allProjects.filter((p) => p.completionDate && !p.isPaid).length;
  const suggestionCount =
    Number(analytics.suggestionTasks.length || 0) +
    Number(analytics.suggestionTransactions.length || 0);
  const focusProject = sortProjectsForBoard(allProjects, today)[0] || null;
  const focusProgress = focusProject ? getProjectProgressRate(focusProject.id) : null;
  const focusHint = focusProject
    ? getProjectActionHint(focusProject, focusProgress, today)
    : null;
  const heroStats = [
    { label: 'Ativos', value: activeCount },
    { label: 'Sem projeto', value: taskBacklogCount },
    { label: 'Receita prevista', value: formatBRL(totalRevenue) },
    { label: 'Nao pagos', value: unpaidCount }
  ];

  const heroInsight = (() => {
    if (lateCount > 0) return `${lateCount} projeto(s) estao em atraso e pedem resposta hoje.`;
    if (deliveredUnpaidCount > 0) {
      return `${deliveredUnpaidCount} entrega(s) concluida(s) ainda nao viraram caixa.`;
    }
    if (urgentProjects.length > 0) {
      return `${urgentProjects.length} projeto(s) vencem nos proximos 5 dias.`;
    }
    if (taskBacklogCount > 0) {
      return `${taskBacklogCount} tarefa(s) ainda estao soltas e podem virar projeto.`;
    }
    return 'Operacao sob controle. Agora vale organizar melhor as proximas entregas.';
  })();

  const renderProjectCard = (project, sectionKey, index) => {
    const linkedTasks = collectProjectTaskCandidates({
      includeLinked: true,
      max: 8,
      projectId: project.id
    });
    const templateTextareaId = `projectTemplate_${project.id}`;
    const statusBadge = getProjectStatus(project, today);
    const progress = getProjectProgressRate(project.id);
    const actionHint = getProjectActionHint(project, progress, today);
    const deadlineDiff = getProjectDeadlineDiff(project.deadline, today);
    const shouldOpen = index === 0 && (sectionKey === 'attention' || boardSections.length === 1);
    const progressPct = progress ? progress.pct : 0;
    const progressDone = progress ? progress.done : 0;
    const progressTotal = progress ? progress.total : 0;
    const progressColor =
      progressPct === 100 ? '#30D158' : progressPct >= 55 ? '#4D6BFE' : '#fb923c';
    const deadlineText = (() => {
      if (project.completionDate) {
        return `Fechado em ${formatProjectDateShort(project.completionDate)}`;
      }
      if (deadlineDiff === null) return 'Sem prazo definido';
      if (deadlineDiff < 0) return `${Math.abs(deadlineDiff)}d atrasado`;
      if (deadlineDiff === 0) return 'Entrega hoje';
      if (deadlineDiff === 1) return 'Entrega amanha';
      return `Entrega em ${deadlineDiff} dias`;
    })();
    const notesValue = escapeProjectHtml(project.notes || '');
    const templateValue = escapeProjectHtml((project.templateTasks || []).join('\n'));
    const safeName = escapeProjectHtml(project.name);
    const safeClient = escapeProjectHtml(project.clientName || '');
    const safeType = escapeProjectHtml(project.serviceType || '');
    const summaryMeta = [safeClient || null, safeType || null, deadlineText].filter(Boolean).join(' • ');
    const amountLabel = project.closedValue > 0 ? formatBRL(project.closedValue || 0) : formatBRL(project.expectedValue || 0);
    const amountCaption = project.closedValue > 0 ? 'Fechado' : 'Previsto';
    const summaryMetaLabel = summaryMeta.replaceAll('â€¢', '•');

    return `
      <details class="projects-item projects-item--board ${project.isDraft ? 'projects-item--draft' : ''}" ${
        shouldOpen ? 'open' : ''
      }>
        <summary class="projects-item-summary projects-item-summary--board">
          <div class="projects-item-main projects-item-main--board">
            <div class="projects-row-badges">
              <span class="projects-badge ${statusBadge.cls}">${statusBadge.label}</span>
              ${project.serviceType ? `<span class="projects-badge">${safeType}</span>` : ''}
              <span class="projects-badge ${
                project.isPaid ? 'projects-badge--paid' : 'projects-badge--unpaid'
              }">${project.isPaid ? 'Pago' : 'Aberto'}</span>
            </div>
            <div class="projects-item-kicker">${summaryMetaLabel || 'Sem cliente ou prazo definido'}</div>
            <div class="projects-item-title-row">
              <strong>${safeName}</strong>
              <div class="projects-item-value">
                <span>${amountCaption}</span>
                <strong>${amountLabel}</strong>
              </div>
            </div>
            <div class="projects-item-summary-note">${actionHint.detail}</div>
            <p>${safeClient || 'Sem cliente definido'} • ${deadlineText}</p>
          </div>
          <div class="projects-item-side projects-item-side--board">
            <div class="projects-item-side-top">
              <span class="projects-item-side-label">Progresso</span>
              <strong style="color:${progressColor}">${progressTotal > 0 ? `${progressPct}%` : '0%'}</strong>
            </div>
            <div class="projects-progress-track projects-progress-track--summary">
              <div class="projects-progress-fill" style="width:${progressTotal > 0 ? progressPct : 0}%;background:${progressColor}"></div>
            </div>
            <small class="projects-item-side-note">${progressTotal > 0 ? `${progressDone}/${progressTotal} tarefas concluidas` : 'Nenhuma tarefa ligada ainda'}</small>
            <span class="projects-metric">${formatBRL(project.expectedValue || 0)}</span>
            <small>${actionHint.detail}</small>
          </div>
        </summary>

        <div class="projects-item-body">
          <div class="projects-progress-block projects-progress-block--compact">
            <div class="projects-progress-meta">
              <span>Progresso real</span>
              <strong style="color:${progressColor}">${
                progressTotal > 0
                  ? `${progressPct}% (${progressDone}/${progressTotal})`
                  : 'Sem tarefas ligadas'
              }</strong>
            </div>
            <div class="projects-progress-track">
              <div class="projects-progress-fill" style="width:${
                progressTotal > 0 ? progressPct : 0
              }%;background:${progressColor}"></div>
            </div>
          </div>

          <div class="projects-health-grid projects-health-grid--compact">
            <div class="projects-health-card">
              <span>Tarefas ligadas</span>
              <strong>${linkedTasks.length}</strong>
            </div>
            <div class="projects-health-card">
              <span>Fluxo financeiro</span>
              <strong>${formatBRL(project.income || 0)}</strong>
            </div>
            <div class="projects-health-card">
              <span>Lucro atual</span>
              <strong>${formatBRL(project.profit || 0)}</strong>
            </div>
          </div>

          <details class="projects-inline-group" open>
            <summary>Dados do projeto</summary>
            <div class="projects-config-grid projects-config-grid--tight">
            <label class="projects-config-field">
              <span>Nome</span>
              <input class="finance-input" type="text" value="${safeName}" onchange="updateProjectField('${project.id}','name',this.value)">
            </label>
            <label class="projects-config-field">
              <span>Cliente</span>
              <input class="finance-input" type="text" value="${safeClient}" placeholder="Nome do cliente" onchange="updateProjectField('${project.id}','clientName',this.value)">
            </label>
            <label class="projects-config-field">
              <span>Tipo</span>
              <input class="finance-input" type="text" value="${safeType}" placeholder="LP, Shopify, etc" onchange="updateProjectField('${project.id}','serviceType',this.value)">
            </label>
            <label class="projects-config-field">
              <span>Valor previsto</span>
              <input class="finance-input" type="number" min="0" step="0.01" value="${Number(project.expectedValue || 0)}" onchange="updateProjectField('${project.id}','expectedValue',this.value)">
            </label>
            <label class="projects-config-field">
              <span>Inicio</span>
              <input class="finance-input" type="date" value="${project.startDate || ''}" onchange="updateProjectField('${project.id}','startDate',this.value)">
            </label>
            <label class="projects-config-field">
              <span>Prazo</span>
              <input class="finance-input" type="date" value="${project.deadline || ''}" onchange="updateProjectField('${project.id}','deadline',this.value)">
            </label>
            <label class="projects-config-field">
              <span>Conclusao real</span>
              <input class="finance-input" type="date" value="${project.completionDate || ''}" onchange="updateProjectField('${project.id}','completionDate',this.value)">
            </label>
            <label class="projects-toggle-pill projects-toggle-pill--field">
              <input type="checkbox" ${
                project.isPaid ? 'checked' : ''
              } onchange="updateProjectField('${project.id}','isPaid',this.checked)">
              <span>Pago</span>
            </label>
            <label class="projects-toggle-pill projects-toggle-pill--field">
              <input type="checkbox" ${
                project.isDraft ? 'checked' : ''
              } onchange="updateProjectField('${project.id}','isDraft',this.checked)">
              <span>Template</span>
            </label>
            <label class="projects-toggle-pill projects-toggle-pill--field">
              <input type="checkbox" ${
                project.collapseSubtasks !== false ? 'checked' : ''
              } onchange="updateProjectField('${project.id}','collapseSubtasks',this.checked)">
              <span>Recolher subtarefas</span>
            </label>
            </div>
          </details>

          <details class="projects-inline-group">
            <summary>Notas, tarefas e checklist</summary>
            <label class="projects-config-field projects-config-field--full">
            <span>Notas operacionais</span>
            <textarea class="finance-input projects-note-textarea" onchange="updateProjectField('${project.id}','notes',this.value)" placeholder="Resumo rapido, proximo passo, observacoes de cliente...">${notesValue}</textarea>
            </label>

            <div class="projects-row-actions">
            <button class="btn-secondary projects-btn-inline" onclick="addTaskInsideProject('${project.id}')">Adicionar tarefa</button>
            ${
              project.status !== 'archived'
                ? `<button class="btn-secondary projects-btn-inline" onclick="archiveProject('${project.id}')">Arquivar</button>`
                : ''
            }
            <button class="btn-secondary projects-btn-inline" onclick="deleteProject('${project.id}')">Remover</button>
            </div>

            <div class="projects-item-sections projects-item-sections--stacked">
            <div class="projects-template-block">
              <div class="projects-linked-header">Checklist padrao</div>
              <textarea id="${templateTextareaId}" class="finance-input projects-template-textarea" placeholder="Uma tarefa por linha">${templateValue}</textarea>
              <div class="projects-template-actions">
                <button class="btn-secondary projects-btn-inline" onclick="saveProjectTemplateTasks('${project.id}','${templateTextareaId}')">Salvar checklist</button>
              </div>
            </div>

            <div class="projects-linked-block">
              <div class="projects-linked-header">Tarefas vinculadas</div>
              ${
                linkedTasks.length > 0
                  ? `
                    <div class="projects-linked-list">
                      ${linkedTasks
                        .map(
                          (item) => `
                            <div class="projects-linked-item">
                              <div>
                                <strong>${escapeProjectHtml(item.task.text)}</strong>
                                <p>${item.dateStr} • ${item.period}${
                            item.task.completed ? ' • concluida' : ''
                          }</p>
                              </div>
                              <button class="btn-secondary projects-btn-inline" onclick="unlinkTaskFromProject('${item.dateStr}','${item.period}',${item.index})">Desvincular</button>
                            </div>
                          `
                        )
                        .join('')}
                    </div>
                  `
                  : '<div class="finance-empty">Nenhuma tarefa ligada ainda.</div>'
              }
            </div>
            </div>
          </details>
        </div>
      </details>
    `;
  };

  view.innerHTML = `
    <div class="flowly-shell flowly-shell--wide projects-shell projects-shell--rebuilt">
      <section class="projects-hero">
        <div class="projects-hero-main">
          <div class="finance-kicker">Projects OS</div>
          <h2>Projetos organizados pela operacao</h2>
          <p>${heroInsight}</p>
          <div class="projects-hero-actions">
            <button onclick="openQuickProjectModal()" class="btn-primary projects-hero-cta projects-btn-inline">
              Novo projeto
            </button>
            <span class="projects-hero-pill">${filteredProjects.length} na visao</span>
            <span class="projects-hero-pill">${suggestionCount} sinais</span>
            <span class="projects-hero-pill">${taskBacklogCount} tarefa(s) sem projeto</span>
          </div>
        </div>
        <div class="projects-hero-panel projects-hero-panel--compact">
          <div class="projects-hero-stats">
            ${heroStats
              .map(
                (item) => `
                  <div class="projects-hero-stat">
                    <span>${item.label}</span>
                    <strong>${item.value}</strong>
                  </div>
                `
              )
              .join('')}
          </div>
          ${
            focusProject
              ? `
                <div class="projects-hero-focus">
                  <div class="projects-suggest-title">Projeto mais sensivel agora</div>
                  <strong>${escapeProjectHtml(focusProject.name)}</strong>
                  <p>${focusHint ? focusHint.detail : 'Sem alerta ativo.'}</p>
                  <div class="projects-row-badges">
                    <span class="projects-badge ${
                      focusHint ? focusHint.cls : 'projects-badge--active'
                    }">${focusHint ? focusHint.label : 'Operando'}</span>
                    ${
                      focusProject.deadline
                        ? `<span class="projects-badge">${formatProjectDateShort(
                            focusProject.deadline
                          )}</span>`
                        : '<span class="projects-badge">Sem prazo</span>'
                    }
                    <span class="projects-badge ${
                      focusProject.isPaid ? 'projects-badge--paid' : 'projects-badge--unpaid'
                    }">${focusProject.isPaid ? 'Pago' : 'Aberto'}</span>
                  </div>
                </div>
              `
              : `
                <div class="projects-hero-focus">
                  <div class="projects-suggest-title">Sem projetos ainda</div>
                  <strong>Comece com uma operacao limpa</strong>
                  <p>Crie um projeto, puxe tarefas para dentro e use esse painel como base de execucao.</p>
                </div>
              `
          }
        </div>
      </section>

      ${
        urgentProjects.length > 0
          ? `
            <section class="projects-urgent-strip">
              <span class="projects-urgent-label">Radar de prazo</span>
              <div class="projects-urgent-list">
                ${urgentProjects
                  .slice(0, 6)
                  .map(
                    (project) => `
                      <span class="projects-urgent-chip">
                        ${escapeProjectHtml(project.name)}
                        <em>${formatProjectDateShort(project.deadline)}</em>
                      </span>
                    `
                  )
                  .join('')}
              </div>
            </section>
          `
          : ''
      }

      <section class="projects-filters-bar projects-filters-bar--rebuilt">
        <button class="projects-filter-chip ${
          projectsFilter === 'all' ? 'is-active' : ''
        }" onclick="setProjectsFilter('all')">Todos</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'active' ? 'is-active' : ''
        }" onclick="setProjectsFilter('active')">Ativos (${activeCount})</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'late' ? 'is-active' : ''
        }" onclick="setProjectsFilter('late')">Atrasados (${lateCount})</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'paid' ? 'is-active' : ''
        }" onclick="setProjectsFilter('paid')">Pagos (${paidCount})</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'unpaid' ? 'is-active' : ''
        }" onclick="setProjectsFilter('unpaid')">Nao pagos (${unpaidCount})</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'done' ? 'is-active' : ''
        }" onclick="setProjectsFilter('done')">Concluidos (${doneCount})</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'draft' ? 'is-active' : ''
        }" onclick="setProjectsFilter('draft')">Templates (${draftCount})</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'archived' ? 'is-active' : ''
        }" onclick="setProjectsFilter('archived')">Arquivados (${archivedCount})</button>
      </section>

      <section class="projects-layout">
        <div class="projects-main">
          ${
            boardSections.length > 0
              ? boardSections
                  .map(
                    (section) => `
                      <section class="finance-card projects-board-section">
                        <div class="projects-board-header">
                          <div>
                            <div class="projects-suggest-title">${section.title}</div>
                            <h3>${section.title}</h3>
                            <p>${section.subtitle}</p>
                          </div>
                          <span class="projects-board-count">${section.items.length}</span>
                        </div>
                        <div class="projects-board-list">
                          ${section.items
                            .map((project, index) => renderProjectCard(project, section.key, index))
                            .join('')}
                        </div>
                      </section>
                    `
                  )
                  .join('')
              : projectsFilter === 'all'
                ? `
                  <section class="finance-card projects-board-section projects-board-section--starter">
                    <div class="projects-board-header">
                      <div>
                        <div class="projects-suggest-title">Comeco guiado</div>
                        <h3>Transforme esse vazio em operacao</h3>
                        <p>O lado esquerdo agora te ajuda a criar contexto, nao fica parado esperando projeto aparecer.</p>
                      </div>
                    </div>
                    <div class="projects-starter-grid">
                      <article class="projects-starter-card">
                        <span class="projects-starter-step">01</span>
                        <strong>Crie o container do trabalho</strong>
                        <p>Defina nome, cliente, prazo e valor. So isso ja organiza melhor o resto do Flowly.</p>
                      </article>
                      <article class="projects-starter-card">
                        <span class="projects-starter-step">02</span>
                        <strong>Puxe as tarefas que ja existem</strong>
                        <p>${taskBacklogCount} tarefa(s) estao sem projeto e podem virar contexto operacional agora.</p>
                      </article>
                      <article class="projects-starter-card">
                        <span class="projects-starter-step">03</span>
                        <strong>Feche o ciclo com receita</strong>
                        <p>${suggestionCount} sugestao(oes) podem ligar entrega, recebimento e cliente na mesma visao.</p>
                      </article>
                    </div>
                  </section>

                  <section class="finance-card projects-board-section">
                    <div class="projects-board-header">
                      <div>
                        <div class="projects-suggest-title">Tarefas mais prontas</div>
                        <h3>O que ja da para transformar em projeto</h3>
                        <p>Essas tarefas estao mais proximas de virarem um card real na operacao.</p>
                      </div>
                      <span class="projects-board-count">${taskBacklogCount}</span>
                    </div>
                    ${
                      starterTasks.length > 0
                        ? `
                          <div class="projects-starter-list">
                            ${starterTasks
                              .map(
                                (item) => `
                                  <div class="projects-linked-item projects-linked-item--starter">
                                    <div>
                                      <strong>${escapeProjectHtml(item.task.text)}</strong>
                                      <p>${item.dateStr} • ${item.period}${item.task.completed ? ' • concluida' : ''}</p>
                                    </div>
                                    <span class="projects-badge projects-badge--focus">Pronta</span>
                                  </div>
                                `
                              )
                              .join('')}
                          </div>
                        `
                        : '<div class="projects-empty-state"><strong>Nenhuma tarefa avulsa agora.</strong><p>Quando houver tarefas sem contexto de cliente, elas aparecem aqui.</p></div>'
                    }
                  </section>

                  <section class="finance-card projects-board-section">
                    <div class="projects-board-header">
                      <div>
                        <div class="projects-suggest-title">Sinais financeiros</div>
                        <h3>Receitas que pedem contexto</h3>
                        <p>Use isso para nao deixar entrada de dinheiro solta, sem amarrar ao projeto certo.</p>
                      </div>
                      <span class="projects-board-count">${starterTransactionSuggestions.length}</span>
                    </div>
                    ${
                      starterTransactionSuggestions.length > 0
                        ? `
                          <div class="projects-starter-list">
                            ${starterTransactionSuggestions
                              .map(
                                (item) => `
                                  <div class="projects-linked-item projects-linked-item--starter">
                                    <div>
                                      <strong>${escapeProjectHtml(item.transaction.description)}</strong>
                                      <p>${formatBRL(item.transaction.amount)} • sugestao: ${escapeProjectHtml(item.suggestion.name)}</p>
                                    </div>
                                    <button class="btn-secondary projects-btn-inline" onclick="applySuggestedTransactionProject('${item.transaction.id}','${item.suggestion.id}')">Aplicar</button>
                                  </div>
                                `
                              )
                              .join('')}
                          </div>
                        `
                        : '<div class="projects-empty-state"><strong>Nenhuma receita pendente de vinculo.</strong><p>Quando existir ambiguidade entre receita e projeto, o Flowly destaca aqui.</p></div>'
                    }
                  </section>
                `
              : `
                <section class="finance-card projects-board-section">
                  <div class="projects-empty-state">
                    <strong>Nada nessa visao agora.</strong>
                    <p>Mude o filtro ou crie um novo projeto para comecar essa area com mais estrutura.</p>
                  </div>
                </section>
              `
          }
        </div>

        <aside class="projects-sidebar">
          <section class="finance-card projects-create-card">
            <div class="finance-card-head finance-card-head--dense">
              <div>
                <h3>Novo projeto</h3>
                <p>Comece limpo e abra o resto so quando precisar.</p>
              </div>
            </div>
            <div class="projects-create-form projects-create-form--nested">
              <div class="projects-form-row">
                <input id="projectQuickName" class="finance-input" type="text" placeholder="Nome do projeto">
                <input id="projectQuickClient" class="finance-input" type="text" placeholder="Cliente">
              </div>
              <div class="projects-form-row">
                <input id="projectQuickServiceType" class="finance-input" type="text" placeholder="Tipo de projeto">
                <input id="projectQuickDeadline" class="finance-input" type="date" placeholder="Prazo">
              </div>
              <details class="projects-collapsible projects-collapsible--soft">
                <summary>Mais detalhes</summary>
              <div class="projects-form-row">
                <input id="projectQuickStartDate" class="finance-input" type="date" placeholder="Inicio">
                <input id="projectQuickCompletionDate" class="finance-input" type="date" placeholder="Conclusao">
              </div>
              <div class="projects-form-row">
                <input id="projectQuickExpectedValue" class="finance-input" type="number" min="0" step="0.01" placeholder="Valor previsto">
                <label class="projects-toggle-pill projects-toggle-pill--field">
                  <input id="projectQuickIsPaid" type="checkbox">
                  <span>Pago</span>
                </label>
              </div>
              <div class="projects-form-row">
                <select id="projectTemplateSource" class="finance-input finance-input--full">
                  <option value="">Sem template</option>
                  ${draftTemplates
                    .map(
                      (project) => `
                        <option value="${project.id}">
                          ${escapeProjectHtml(project.name)}${
                        project.templateTasks?.length
                          ? ` • ${project.templateTasks.length} tarefas`
                          : ''
                      }
                        </option>
                      `
                    )
                    .join('')}
                </select>
              </div>
              </details>

              <details class="projects-collapsible projects-collapsible--soft">
                <summary>Tarefas para puxar agora ${
                  taskBacklogCount > 0 ? `<span>${taskBacklogCount}</span>` : ''
                }</summary>
                ${
                  taskCandidates.length > 0
                    ? `
                      <div class="projects-task-list">
                        ${taskCandidates
                          .map(
                            (item) => `
                              <label class="projects-task-option">
                                <input type="checkbox" class="project-create-task-check" data-date="${item.dateStr}" data-period="${item.period}" data-index="${item.index}">
                                <div>
                                  <strong>${escapeProjectHtml(item.task.text)}</strong>
                                  <p>${item.dateStr} • ${item.period}${
                                item.task.completed ? ' • concluida' : ''
                              }</p>
                                </div>
                              </label>
                            `
                          )
                          .join('')}
                      </div>
                    `
                    : '<div class="finance-empty">Nenhuma tarefa solta disponivel agora.</div>'
                }
              </details>

              <div class="projects-create-actions">
                <button class="btn-secondary projects-btn-inline" onclick="createProjectQuick()">Criar rapido</button>
                <button class="btn-primary projects-btn-inline" onclick="createProjectWithLinks()">Criar projeto</button>
              </div>
            </div>
          </section>

          <section class="finance-card projects-command-card">
            <div class="finance-card-head finance-card-head--dense">
              <div>
                <h3>Centro de comando</h3>
                <p>O que esta pedindo acao na operacao.</p>
              </div>
            </div>
            <div class="projects-sidebar-list">
              <div class="projects-linked-item">
                <div>
                  <strong>Atrasos ativos</strong>
                  <p>${
                    lateCount > 0
                      ? `${lateCount} projeto(s) fora do prazo.`
                      : 'Nenhum atraso ativo agora.'
                  }</p>
                </div>
                <span class="projects-board-count">${lateCount}</span>
              </div>
              <div class="projects-linked-item">
                <div>
                  <strong>Entregue e nao pago</strong>
                  <p>${
                    deliveredUnpaidCount > 0
                      ? 'Hora de cobrar e fechar o ciclo.'
                      : 'Nenhuma entrega aguardando pagamento.'
                  }</p>
                </div>
                <span class="projects-board-count">${deliveredUnpaidCount}</span>
              </div>
              <div class="projects-linked-item">
                <div>
                  <strong>Tarefas sem projeto</strong>
                  <p>${
                    taskBacklogCount > 0
                      ? 'Vale transformar essas tarefas em contexto de cliente.'
                      : 'Tudo ja esta contextualizado.'
                  }</p>
                </div>
                <span class="projects-board-count">${taskBacklogCount}</span>
              </div>
              <div class="projects-linked-item">
                <div>
                  <strong>Templates prontos</strong>
                  <p>${
                    draftCount > 0
                      ? 'Base pronta para duplicar processos repetidos.'
                      : 'Ainda nao ha templates prontos.'
                  }</p>
                </div>
                <span class="projects-board-count">${draftCount}</span>
              </div>
            </div>
          </section>

          <section class="finance-card projects-suggestions-card">
            <div class="finance-card-head finance-card-head--dense">
              <div>
                <h3>Sugestoes inteligentes</h3>
                <p>Vinculos que o Flowly acha que fazem sentido.</p>
              </div>
            </div>
            <div class="projects-suggestions">
              <div>
                <div class="projects-suggest-title">Tarefas</div>
                ${
                  analytics.suggestionTasks.length > 0
                    ? analytics.suggestionTasks
                        .slice(0, 4)
                        .map(
                          (item) => `
                            <div class="projects-suggest-item">
                              <div>
                                <strong>${escapeProjectHtml(item.text)}</strong>
                                <p>${escapeProjectHtml(item.suggestion.name)}</p>
                              </div>
                              <button class="btn-secondary projects-btn-inline" onclick="applySuggestedTaskProject('${item.dateStr}','${item.period}',${item.index},'${item.suggestion.id}')">Aplicar</button>
                            </div>
                          `
                        )
                        .join('')
                    : '<div class="finance-empty">Nada para sugerir em tarefas.</div>'
                }
              </div>
              <div>
                <div class="projects-suggest-title">Receitas</div>
                ${
                  analytics.suggestionTransactions.length > 0
                    ? analytics.suggestionTransactions
                        .slice(0, 4)
                        .map(
                          (item) => `
                            <div class="projects-suggest-item">
                              <div>
                                <strong>${escapeProjectHtml(item.transaction.description)}</strong>
                                <p>${formatBRL(item.transaction.amount)} • ${escapeProjectHtml(
                            item.suggestion.name
                          )}</p>
                              </div>
                              <button class="btn-secondary projects-btn-inline" onclick="applySuggestedTransactionProject('${item.transaction.id}','${item.suggestion.id}')">Aplicar</button>
                            </div>
                          `
                        )
                        .join('')
                    : '<div class="finance-empty">Nada para sugerir em receitas.</div>'
                }
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>`;
}

function renderSettingsView() {
  const view = document.getElementById('settingsView');
  if (!view) return;

  const notifSettings = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
  const notifEnabled = notifSettings.enabled === true;
  const morningTime = notifSettings.morningTime || '08:30';
  const middayTime = notifSettings.middayTime || '12:30';
  const eveningTime = notifSettings.eveningTime || '23:00';
  const inactivityEnabled = notifSettings.inactivityEnabled !== false;
  const inactivityThresholdMinutes = Number(notifSettings.inactivityThresholdMinutes || 150);
  const progressEnabled = notifSettings.progressEnabled !== false;
  const morningTemplate =
    notifSettings.morningTemplate || 'Bom dia. Hoje voce tem {total} tarefas planejadas.';
  const middayTemplate =
    notifSettings.middayTemplate || 'Como estamos de produtividade? {completed}/{total} ({percentage}%).';
  const nightTemplate =
    notifSettings.nightTemplate ||
    'Resumo do dia: {completed}/{total} ({percentage}%). Tempo total {totalDuration}. Hora de descansar.';
  const inactivityTemplate =
    notifSettings.inactivityTemplate || 'Bem, o que andou fazendo nas ultimas 3h?';
  const progressTemplate =
    notifSettings.progressTemplate || 'Estamos no caminho, {completed}/{total}';
  const notifPerm = 'Notification' in window ? Notification.permission : 'unsupported';
  const notifSecureContext = window.isSecureContext === true;

  const viewSettings = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
  const weekStart = viewSettings.weekStart || 'mon';
  const showWeekends = viewSettings.showWeekends !== false;
  const hapticsEnabled = viewSettings.haptics !== false;

  const displayName =
    localStorage.getItem('flowly_display_name') ||
    (currentUser ? currentUser.email.split('@')[0] : 'Usuario');
  const aiSettings = getFlowlyAISettings();
  const themeSettings = getFlowlyThemeSettings();
  const settingsTab = localStorage.getItem(FLOWLY_SETTINGS_TAB_KEY) || 'conta';

  const permBadge =
    notifPerm === 'granted'
      ? '<span class="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Ativo</span>'
      : '<span class="inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">Inativo</span>';

  const sectionCard = (title, subtitle, icon, content) => `
    <section class="rounded-2xl border border-white/10 bg-[#141417] shadow-[0_12px_30px_rgba(0,0,0,0.28)] overflow-hidden">
      <header class="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-gradient-to-r from-white/[0.03] to-white/[0.01]">
        <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-gray-300">
          <i data-lucide="${icon}" style="width:16px;height:16px;"></i>
        </span>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-gray-100">${title}</h3>
          <p class="text-xs text-gray-400">${subtitle}</p>
        </div>
      </header>
      <div class="p-4">${content}</div>
    </section>
  `;

  const settingRow = (icon, title, desc, control) => `
    <div class="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-3">
      <div class="flex min-w-0 items-center gap-3">
        <span class="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-gray-400">
          <i data-lucide="${icon}" style="width:14px;height:14px;"></i>
        </span>
        <div class="min-w-0">
          <div class="text-sm font-medium text-gray-100">${title}</div>
          <div class="truncate text-xs text-gray-400">${desc}</div>
        </div>
      </div>
      <div class="flex-shrink-0">${control}</div>
    </div>
  `;

  const toggle = (id, checked) => `
    <button id="${id}" role="switch" aria-checked="${checked}" class="relative h-6 w-11 rounded-full border border-white/20 transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-700'}">
      <span class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}"></span>
    </button>
  `;

  const settingsTabs = [
    { id: 'conta', label: 'Conta', icon: 'user-round' },
    { id: 'notificacoes', label: 'Notificacoes', icon: 'bell-ring' },
    { id: 'app', label: 'App', icon: 'sliders-horizontal' },
    { id: 'personalizacao', label: 'Personalizacao', icon: 'palette' },
    { id: 'ia', label: 'IA', icon: 'bot' },
    { id: 'operacao', label: 'Operacao', icon: 'signal' },
    { id: 'dados', label: 'Dados', icon: 'database' }
  ];
  const settingsTabNav = settingsTabs
    .map(
      (tab) => `
        <button class="settings-tab-btn${settingsTab === tab.id ? ' is-active' : ''}" data-settings-tab="${tab.id}">
          <i data-lucide="${tab.icon}" style="width:14px;height:14px;"></i>
          <span>${tab.label}</span>
        </button>
      `
    )
    .join('');
  const fontMainOptions = Object.entries(FLOWLY_FONT_PRESETS)
    .map(
      ([key, preset]) =>
        `<option value="${key}" ${themeSettings.fontMain === key ? 'selected' : ''}>${preset.label}</option>`
    )
    .join('');
  const fontDisplayOptions = Object.entries(FLOWLY_FONT_PRESETS)
    .map(
      ([key, preset]) =>
        `<option value="${key}" ${themeSettings.fontDisplay === key ? 'selected' : ''}>${preset.label}</option>`
    )
    .join('');
  const radiusOptions = Object.entries(FLOWLY_RADIUS_PRESETS)
    .map(
      ([key, preset]) =>
        `<option value="${key}" ${themeSettings.radiusScale === key ? 'selected' : ''}>${preset.label}</option>`
    )
    .join('');

  const notifStatusText =
    notifPerm === 'granted'
      ? 'Permissao concedida.'
      : notifPerm === 'denied'
        ? 'Permissao bloqueada no navegador.'
        : notifPerm === 'default'
          ? 'Permissao ainda nao solicitada.'
          : 'Navegador sem suporte a notificacoes.';

  const secureContextText = notifSecureContext
    ? 'Ambiente seguro detectado (HTTPS/localhost).'
    : 'Para ativar notificacoes, abra por HTTPS ou localhost.';

  const profileSection = sectionCard(
    'Perfil',
    'Dados basicos e conta conectada',
    'user-round',
    `
      <div class="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
        <div class="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-lg font-bold text-white">
          ${displayName.charAt(0).toUpperCase()}
        </div>
        <div class="min-w-0 flex-1">
          <label class="mb-1 block text-xs uppercase tracking-wide text-gray-400" for="inputDisplayName">Nome de exibicao</label>
          <input id="inputDisplayName" type="text" value="${displayName}" placeholder="Seu nome" class="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500/70" />
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
        <span class="truncate">${currentUser ? `Conectado como ${currentUser.email}` : 'Sem conta conectada'}</span>
        ${
          currentUser
            ? '<span class="text-emerald-300">Conta ativa</span>'
            : '<button onclick="document.getElementById(\'authModal\').classList.add(\'show\')" class="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-500">Entrar / Criar Conta</button>'
        }
      </div>
    `
  );

  const notificationsSection = sectionCard(
    'Notificacoes',
    'Alertas, horarios e mensagens',
    'bell-ring',
    `
      <div class="space-y-3">
        ${settingRow('bell', 'Ativar notificacoes', 'Liga ou desliga alertas do app', toggle('toggleNotif', notifEnabled))}
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Horario Manha</span>
            <input id="inputMorningTime" type="time" value="${morningTime}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Horario Meio-dia</span>
            <input id="inputMiddayTime" type="time" value="${middayTime}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Horario Noite</span>
            <input id="inputEveningTime" type="time" value="${eveningTime}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
        </div>
        <div class="space-y-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          ${settingRow('timer-reset', 'Lembrete por inatividade', 'Se ficar muito tempo sem concluir tarefa', toggle('toggleInactivityNotif', inactivityEnabled))}
          <label class="block text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Limite inatividade (min)</span>
            <input id="inputInactivityMinutes" type="number" min="30" max="480" step="10" value="${inactivityThresholdMinutes}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          ${settingRow('gauge', 'Notificacao de progresso', 'Notifica a cada tarefa concluida', toggle('toggleProgressNotif', progressEnabled))}
        </div>
        <div class="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <label class="text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Template manha</span>
            <input id="inputMorningTemplate" type="text" value="${morningTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Template meio-dia</span>
            <input id="inputMiddayTemplate" type="text" value="${middayTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Template noite</span>
            <input id="inputNightTemplate" type="text" value="${nightTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Template inatividade</span>
            <input id="inputInactivityTemplate" type="text" value="${inactivityTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Template progresso</span>
            <input id="inputProgressTemplate" type="text" value="${progressTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <p class="text-[11px] text-gray-500">Use variaveis: {completed}, {total}, {pending}, {percentage}, {avgDuration}, {totalDuration}, {bestPeriod}.</p>
        </div>
      </div>
    `
  );

  const notificationStatusCard = sectionCard(
    'Status',
    'Permissao e teste rapido',
    'shield-check',
    `
      <div class="space-y-3">
        <div class="mb-2 flex items-center justify-between gap-2 text-xs text-gray-300">
          <span>Status da permissao</span>
          ${permBadge}
        </div>
        <p class="text-xs text-gray-400">${notifStatusText}</p>
        <p class="text-xs ${notifSecureContext ? 'text-emerald-300' : 'text-amber-300'}">${secureContextText}</p>
        <button id="btnTestNotification" class="mt-2 inline-flex items-center gap-2 rounded-lg border border-cyan-500/45 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25">
          <i data-lucide="send" style="width:14px;height:14px;"></i>
          Enviar notificacao de teste
        </button>
        <div id="notifTestFeedback" class="min-h-[16px] text-xs text-gray-400"></div>
      </div>
    `
  );

  const appSection = sectionCard(
    'Visual e interacao',
    'Preferencias de exibicao e feedback',
    'sliders-horizontal',
    `
      <div class="space-y-3">
        <label class="block rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
          <span class="mb-1 block uppercase tracking-wide text-gray-400">Inicio da semana</span>
          <select id="selectWeekStart" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">
            <option value="sun" ${weekStart === 'sun' ? 'selected' : ''}>Domingo</option>
            <option value="mon" ${weekStart === 'mon' ? 'selected' : ''}>Segunda</option>
          </select>
        </label>
        ${settingRow('calendar-range', 'Mostrar fins de semana', 'Exibe Sabado e Domingo na semana', toggle('toggleWeekends', showWeekends))}
        ${settingRow('vibrate', 'Feedback haptico', 'Vibracao em interacoes suportadas', toggle('toggleHaptics', hapticsEnabled))}
        ${settingRow('sparkles', 'Animacao no hover semanal', 'Destaque visual ao passar mouse na semana', toggle('toggleWeekHover', dbUserSettings.enable_week_hover_animation !== false))}
      </div>
    `
  );

  const personalizationSection = sectionCard(
    'Personalizacao',
    'Cores, fontes e bordas',
    'palette',
    `
      <div class="settings-theme-grid">
        <label class="settings-theme-field">
          <span>Cor primaria</span>
          <div class="settings-theme-input-wrap">
            <input id="inputThemePrimaryColor" type="color" value="${themeSettings.primaryColor}" />
            <code>${themeSettings.primaryColor}</code>
          </div>
        </label>
        <label class="settings-theme-field">
          <span>Cor secundaria</span>
          <div class="settings-theme-input-wrap">
            <input id="inputThemeSecondaryColor" type="color" value="${themeSettings.secondaryColor}" />
            <code>${themeSettings.secondaryColor}</code>
          </div>
        </label>
        <label class="settings-theme-field">
          <span>Fonte base</span>
          <select id="selectThemeFontMain" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">${fontMainOptions}</select>
        </label>
        <label class="settings-theme-field">
          <span>Fonte destaque</span>
          <select id="selectThemeFontDisplay" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">${fontDisplayOptions}</select>
        </label>
        <label class="settings-theme-field settings-theme-field--wide">
          <span>Arredondamento</span>
          <select id="selectThemeRadiusScale" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">${radiusOptions}</select>
        </label>
      </div>
      <div class="settings-theme-preview">
        <div class="settings-theme-preview-card">
          <div class="settings-theme-preview-kicker">Preview</div>
          <strong>Flowly do seu jeito</strong>
          <p>Teste o visual antes de voltar para o resto da app.</p>
          <div class="settings-theme-preview-actions">
            <span class="settings-theme-preview-primary">Primaria</span>
            <span class="settings-theme-preview-secondary">Secundaria</span>
          </div>
        </div>
        <button id="btnResetThemeSettings" class="settings-theme-reset">Restaurar visual padrao</button>
      </div>
    `
  );

  const aiSection = sectionCard(
    'Conexao de IA',
    'Deixa a Sexta pronta para conversar com provedores externos',
    'bot',
    `
      <div class="space-y-3">
        ${settingRow('bot', 'Ativar conector externo', 'Mantem a configuracao de IA pronta para backend seguro', toggle('toggleAiEnabled', aiSettings.enabled === true))}
        <div class="settings-ai-grid">
          <label class="settings-theme-field">
            <span>Provedor</span>
            <select id="selectAiProvider" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">
              <option value="local" ${aiSettings.provider === 'local' ? 'selected' : ''}>Local Flowly</option>
              <option value="minimax" ${aiSettings.provider === 'minimax' ? 'selected' : ''}>MiniMax</option>
              <option value="openai" ${aiSettings.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
              <option value="custom" ${aiSettings.provider === 'custom' ? 'selected' : ''}>Custom</option>
            </select>
          </label>
          <label class="settings-theme-field">
            <span>Modelo</span>
            <input id="inputAiModel" type="text" value="${escapeProjectHtml(aiSettings.model)}" placeholder="Ex.: minimax-text-01" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="settings-theme-field settings-theme-field--wide">
            <span>Endpoint / Edge Function</span>
            <input id="inputAiEndpoint" type="text" value="${escapeProjectHtml(aiSettings.endpoint)}" placeholder="https://.../functions/v1/ask-flowly" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="settings-theme-field settings-theme-field--wide">
            <span>API key</span>
            <input id="inputAiApiKey" type="password" value="${escapeProjectHtml(aiSettings.apiKey)}" placeholder="Cole a chave aqui se quiser testar localmente" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
        </div>
        <label class="settings-theme-field settings-theme-field--wide">
          <span>Prompt base da Sexta</span>
          <textarea id="inputAiSystemPrompt" rows="4" class="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none">${escapeProjectHtml(aiSettings.systemPrompt)}</textarea>
        </label>
        <p class="text-[11px] text-gray-500">Hoje a Sexta ja responde localmente com base nos dados do Flowly. Essa aba deixa o conector pronto para voce plugar MiniMax, OpenAI ou outro backend depois.</p>
      </div>
    `
  );

  const aiStatusCard = sectionCard(
    'Status da Sexta',
    'Leitura do que ja esta ativo',
    'sparkles',
    `
      <div class="space-y-3">
        <div class="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <div class="text-xs uppercase tracking-wide text-gray-400">Modo atual</div>
          <div class="mt-1 text-sm font-semibold text-white">${aiSettings.enabled && aiSettings.provider !== 'local' ? escapeProjectHtml(aiSettings.provider + ' · ' + aiSettings.model) : 'Local Flowly'}</div>
          <p class="mt-2 text-xs text-gray-400">${aiSettings.enabled && aiSettings.provider !== 'local' ? 'Conector salvo. O passo seguinte e ligar esse endpoint a uma Edge Function segura.' : 'Aba Sexta operando no modo local com leitura de tarefas, projetos e contexto.'}</p>
        </div>
        <div class="settings-guide-list">
          <div><strong>1. Salvar provedor</strong><span>MiniMax, OpenAI ou endpoint custom</span></div>
          <div><strong>2. Ligar backend</strong><span>Ideal via Supabase Edge Function</span></div>
          <div><strong>3. Conversar na Sexta</strong><span>usar o chat ja dentro do Flowly</span></div>
        </div>
      </div>
    `
  );

  const prioritiesSection = sectionCard(
    'Prioridades',
    'Edite as prioridades personalizadas da sua operacao',
    'signal',
    `
      <div class="space-y-3">
        <div>
          <div class="mb-2 flex items-center justify-between gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Prioridades</span>
            <button id="btnAddPrio" class="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-gray-200 hover:bg-white/10">Adicionar</button>
          </div>
          <div id="priosList" class="space-y-2"></div>
        </div>
      </div>
    `
  );

  const dataSection = sectionCard(
    'Dados e manutencao',
    'Backup, reparo e limpeza',
    'database',
    `
      <div class="grid grid-cols-2 gap-2">
        <button id="btnExportSettings" class="group flex flex-col items-center justify-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-emerald-200 hover:bg-emerald-500/20">
          <i data-lucide="download" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i>
          <span class="text-xs font-semibold">Exportar Backup</span>
        </button>
        <label class="group flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-3 text-blue-200 hover:bg-blue-500/20">
          <i data-lucide="upload" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i>
          <span class="text-xs font-semibold">Importar Backup</span>
          <input id="fileImportSettings" type="file" accept="application/json" class="hidden" />
        </label>
        <button id="btnFixDuplicates" class="group flex flex-col items-center justify-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-amber-200 hover:bg-amber-500/20">
          <i data-lucide="wrench" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i>
          <span class="text-xs font-semibold">Corrigir Banco</span>
        </button>
        <button id="btnClearAllSettings" class="group flex flex-col items-center justify-center gap-1 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-3 text-rose-200 hover:bg-rose-500/20">
          <i data-lucide="trash-2" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i>
          <span class="text-xs font-semibold">Limpar Tudo</span>
        </button>
      </div>
      <p class="mt-3 text-[11px] text-gray-500">A limpeza remove dados locais e remotos da sua conta. Use com cuidado.</p>
    `
  );

  const quickGuideCard = sectionCard(
    'Leitura rapida',
    'Tudo agora esta separado por contexto',
    'folders',
    `
      <div class="settings-guide-list">
        <div><strong>Conta</strong><span>nome, login e identidade</span></div>
        <div><strong>Notificacoes</strong><span>horarios, templates e permissao</span></div>
        <div><strong>App</strong><span>semana, hover e feedback</span></div>
        <div><strong>Personalizacao</strong><span>cores, fontes e arredondamento</span></div>
        <div><strong>IA</strong><span>provedor, modelo e endpoint da Sexta</span></div>
        <div><strong>Operacao</strong><span>prioridades e sinais</span></div>
        <div><strong>Dados</strong><span>backup, reparo e limpeza</span></div>
      </div>
    `
  );

  const tabPanels = {
    conta: { main: [profileSection], side: [quickGuideCard] },
    notificacoes: { main: [notificationsSection], side: [notificationStatusCard] },
    app: { main: [appSection], side: [quickGuideCard] },
    personalizacao: { main: [personalizationSection], side: [quickGuideCard] },
    ia: { main: [aiSection], side: [aiStatusCard] },
    operacao: { main: [prioritiesSection], side: [quickGuideCard] },
    dados: { main: [dataSection], side: [quickGuideCard] }
  };
  const currentTabPanels = tabPanels[settingsTab] || tabPanels.conta;

  view.innerHTML = `
    <div class="flowly-shell flowly-shell--narrow settings-shell">
      <div class="settings-topbar">
        <div>
          <h2 class="flex items-center gap-3 text-2xl font-bold text-white">
            <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-900/25">
              <i data-lucide="settings-2" style="width:20px;height:20px;"></i>
            </span>
            Configuracoes
          </h2>
          <p class="mt-1 text-sm text-gray-400">Agora separado por abas para voce ajustar uma area por vez.</p>
        </div>
        <div class="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-300">
          <div class="font-semibold text-gray-200">FLOWLY v1.2</div>
          <div class="text-gray-400">Sincronizado via Supabase</div>
        </div>
      </div>

      <div class="settings-tabs" role="tablist">
        ${settingsTabNav}
      </div>

      <div class="settings-panels">
        <div class="space-y-4">${currentTabPanels.main.join('')}</div>
        <div class="space-y-4">${currentTabPanels.side.join('')}</div>
      </div>
    </div>
  `;

  if (false) view.innerHTML = `
    <div class="flowly-shell flowly-shell--narrow">
      <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="flex items-center gap-3 text-2xl font-bold text-white">
            <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-900/25">
              <i data-lucide="settings-2" style="width:20px;height:20px;"></i>
            </span>
            Configuracoes
          </h2>
          <p class="mt-1 text-sm text-gray-400">Central unica para conta, notificacoes, personalizacao e dados.</p>
        </div>
        <div class="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-300">
          <div class="font-semibold text-gray-200">FLOWLY v1.2</div>
          <div class="text-gray-400">Sincronizado via Supabase</div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div class="space-y-4">
          ${sectionCard(
            'Perfil',
            'Dados basicos e conta conectada',
            'user-round',
            `
              <div class="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
                <div class="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-lg font-bold text-white">
                  ${displayName.charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                  <label class="mb-1 block text-xs uppercase tracking-wide text-gray-400" for="inputDisplayName">Nome de exibicao</label>
                  <input id="inputDisplayName" type="text" value="${displayName}" placeholder="Seu nome" class="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500/70" />
                </div>
              </div>
              <div class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
                <span class="truncate">${currentUser ? `Conectado como ${currentUser.email}` : 'Sem conta conectada'}</span>
                ${
                  currentUser
                    ? '<span class="text-emerald-300">Conta ativa</span>'
                    : '<button onclick="document.getElementById(\'authModal\').classList.add(\'show\')" class="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-500">Entrar / Criar Conta</button>'
                }
              </div>
            `
          )}

          ${sectionCard(
            'Notificacoes',
            'Alertas de tarefas e teste rapido',
            'bell-ring',
            `
              <div class="space-y-3">
                ${settingRow('bell', 'Ativar notificacoes', 'Liga ou desliga alertas do app', toggle('toggleNotif', notifEnabled))}
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
                    <span class="mb-1 block uppercase tracking-wide text-gray-400">Horario Manha</span>
                    <input id="inputMorningTime" type="time" value="${morningTime}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
                  </label>
                  <label class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
                    <span class="mb-1 block uppercase tracking-wide text-gray-400">Horario Meio-dia</span>
                    <input id="inputMiddayTime" type="time" value="${middayTime}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
                  </label>
                  <label class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
                    <span class="mb-1 block uppercase tracking-wide text-gray-400">Horario Noite</span>
                    <input id="inputEveningTime" type="time" value="${eveningTime}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
                  </label>
                </div>
                <div class="space-y-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  ${settingRow('timer-reset', 'Lembrete por inatividade', 'Se ficar muito tempo sem concluir tarefa', toggle('toggleInactivityNotif', inactivityEnabled))}
                  <label class="block text-xs text-gray-300">
                    <span class="mb-1 block uppercase tracking-wide text-gray-400">Limite inatividade (min)</span>
                    <input id="inputInactivityMinutes" type="number" min="30" max="480" step="10" value="${inactivityThresholdMinutes}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
                  </label>
                  ${settingRow('gauge', 'Notificacao de progresso', 'Notifica a cada tarefa concluida', toggle('toggleProgressNotif', progressEnabled))}
                </div>
                <div class="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <label class="text-xs text-gray-300">
                    <span class="mb-1 block uppercase tracking-wide text-gray-400">Template manha</span>
                    <input id="inputMorningTemplate" type="text" value="${morningTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
                  </label>
                  <label class="text-xs text-gray-300">
                    <span class="mb-1 block uppercase tracking-wide text-gray-400">Template meio-dia</span>
                    <input id="inputMiddayTemplate" type="text" value="${middayTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
                  </label>
                  <label class="text-xs text-gray-300">
                    <span class="mb-1 block uppercase tracking-wide text-gray-400">Template noite</span>
                    <input id="inputNightTemplate" type="text" value="${nightTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
                  </label>
                  <label class="text-xs text-gray-300">
                    <span class="mb-1 block uppercase tracking-wide text-gray-400">Template inatividade</span>
                    <input id="inputInactivityTemplate" type="text" value="${inactivityTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
                  </label>
                  <label class="text-xs text-gray-300">
                    <span class="mb-1 block uppercase tracking-wide text-gray-400">Template progresso</span>
                    <input id="inputProgressTemplate" type="text" value="${progressTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
                  </label>
                  <p class="text-[11px] text-gray-500">Use variaveis: {completed}, {total}, {pending}, {percentage}, {avgDuration}, {totalDuration}, {bestPeriod}.</p>
                </div>
                  <div class="mb-2 flex items-center justify-between gap-2 text-xs text-gray-300">
                    <span>Status da permissao</span>
                    ${permBadge}
                  </div>
                  <p class="text-xs text-gray-400">${notifStatusText}</p>
                  <p class="mt-1 text-xs ${notifSecureContext ? 'text-emerald-300' : 'text-amber-300'}">${secureContextText}</p>
                  <button id="btnTestNotification" class="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan-500/45 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25">
                    <i data-lucide="send" style="width:14px;height:14px;"></i>
                    Enviar notificacao de teste
                  </button>
                  <div id="notifTestFeedback" class="mt-2 min-h-[16px] text-xs text-gray-400"></div>
                </div>
              </div>
            `
          )}

          ${sectionCard(
            'Visual e interacao',
            'Preferencias de exibicao e feedback',
            'sliders-horizontal',
            `
              <div class="space-y-3">
                <label class="block rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
                  <span class="mb-1 block uppercase tracking-wide text-gray-400">Inicio da semana</span>
                  <select id="selectWeekStart" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">
                    <option value="sun" ${weekStart === 'sun' ? 'selected' : ''}>Domingo</option>
                    <option value="mon" ${weekStart === 'mon' ? 'selected' : ''}>Segunda</option>
                  </select>
                </label>
                ${settingRow('calendar-range', 'Mostrar fins de semana', 'Exibe Sabado e Domingo na semana', toggle('toggleWeekends', showWeekends))}
                ${settingRow('vibrate', 'Feedback haptico', 'Vibracao em interacoes suportadas', toggle('toggleHaptics', hapticsEnabled))}
                ${settingRow('sparkles', 'Animacao no hover semanal', 'Destaque visual ao passar mouse na semana', toggle('toggleWeekHover', dbUserSettings.enable_week_hover_animation !== false))}
              </div>
            `
          )}
        </div>

        <div class="space-y-4">
          ${sectionCard(
            'Prioridades',
            'Edite as prioridades personalizadas da sua operação',
            'signal',
            `
              <div class="space-y-3">
                <div>
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Prioridades</span>
                    <button id="btnAddPrio" class="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-gray-200 hover:bg-white/10">Adicionar</button>
                  </div>
                  <div id="priosList" class="space-y-2"></div>
                </div>
              </div>
            `
          )}

          ${sectionCard(
            'Dados e manutencao',
            'Backup, reparo e limpeza',
            'database',
            `
              <div class="grid grid-cols-2 gap-2">
                <button id="btnExportSettings" class="group flex flex-col items-center justify-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-emerald-200 hover:bg-emerald-500/20">
                  <i data-lucide="download" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i>
                  <span class="text-xs font-semibold">Exportar Backup</span>
                </button>
                <label class="group flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-3 text-blue-200 hover:bg-blue-500/20">
                  <i data-lucide="upload" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i>
                  <span class="text-xs font-semibold">Importar Backup</span>
                  <input id="fileImportSettings" type="file" accept="application/json" class="hidden" />
                </label>
                <button id="btnFixDuplicates" class="group flex flex-col items-center justify-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-amber-200 hover:bg-amber-500/20">
                  <i data-lucide="wrench" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i>
                  <span class="text-xs font-semibold">Corrigir Banco</span>
                </button>
                <button id="btnClearAllSettings" class="group flex flex-col items-center justify-center gap-1 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-3 text-rose-200 hover:bg-rose-500/20">
                  <i data-lucide="trash-2" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i>
                  <span class="text-xs font-semibold">Limpar Tudo</span>
                </button>
              </div>
              <p class="mt-3 text-[11px] text-gray-500">A limpeza remove dados locais e remotos da sua conta. Use com cuidado.</p>
            `
          )}
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    lucide.createIcons();

    document.querySelectorAll('[data-settings-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        localStorage.setItem(FLOWLY_SETTINGS_TAB_KEY, btn.dataset.settingsTab || 'conta');
        renderSettingsView();
      });
    });

    const bindThemeField = (id, updater) => {
      const el = document.getElementById(id);
      if (!el) return;
      const commit = () => {
        const current = getFlowlyThemeSettings();
        saveFlowlyThemeSettings(updater(current, el.value));
        renderSettingsView();
      };
      if (el.type === 'color') {
        el.oninput = function () {
          const current = getFlowlyThemeSettings();
          saveFlowlyThemeSettings(updater(current, el.value));
        };
        el.onchange = commit;
        return;
      }
      el.onchange = commit;
    };

    bindThemeField('inputThemePrimaryColor', (current, value) => ({ ...current, primaryColor: value }));
    bindThemeField('inputThemeSecondaryColor', (current, value) => ({
      ...current,
      secondaryColor: value
    }));
    bindThemeField('selectThemeFontMain', (current, value) => ({ ...current, fontMain: value }));
    bindThemeField('selectThemeFontDisplay', (current, value) => ({
      ...current,
      fontDisplay: value
    }));
    bindThemeField('selectThemeRadiusScale', (current, value) => ({
      ...current,
      radiusScale: value
    }));

    const resetThemeBtn = document.getElementById('btnResetThemeSettings');
    if (resetThemeBtn) {
      resetThemeBtn.onclick = () => {
        saveFlowlyThemeSettings(FLOWLY_THEME_DEFAULTS);
        renderSettingsView();
      };
    }

    const bindAiField = (id, fieldName) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.onchange = function () {
        const current = getFlowlyAISettings();
        saveFlowlyAISettings({
          ...current,
          [fieldName]: this.value
        });
        renderSettingsView();
      };
    };

    bindAiField('selectAiProvider', 'provider');
    bindAiField('inputAiModel', 'model');
    bindAiField('inputAiEndpoint', 'endpoint');
    bindAiField('inputAiApiKey', 'apiKey');
    bindAiField('inputAiSystemPrompt', 'systemPrompt');

    const toggleAiEnabled = document.getElementById('toggleAiEnabled');
    if (toggleAiEnabled) {
      toggleAiEnabled.onclick = function () {
        const current = getFlowlyAISettings();
        saveFlowlyAISettings({
          ...current,
          enabled: !(current.enabled === true)
        });
        renderSettingsView();
      };
    }

    // Name Change
    const nameInput = document.getElementById('inputDisplayName');
    if (nameInput) {
      nameInput.onchange = function () {
        localStorage.setItem('flowly_display_name', this.value);
      };
    }

    // Toggle Notificacoes
    const toggleNotif = document.getElementById('toggleNotif');
    if (toggleNotif) {
      toggleNotif.onclick = async function () {
        if (!('Notification' in window)) {
          alert('Este navegador nao suporta notificacoes.');
          return;
        }

        if (!window.isSecureContext) {
          alert(
            'Notificacoes exigem HTTPS ou localhost. Se abriu por arquivo, rode via servidor local.'
          );
          return;
        }

        const cur = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
        const currentEnabled = cur.enabled === true;
        const nextEnabled = !currentEnabled;

        if (nextEnabled) {
          if (Notification.permission === 'denied') {
            alert(
              'Permissao de notificacao bloqueada no navegador. Libere nas configuracoes do site.'
            );
            renderSettingsView();
            return;
          }

          await requestNotificationPermission();
          if (Notification.permission !== 'granted') {
            renderSettingsView();
            return;
          }
        }

        cur.enabled = nextEnabled;
        localStorage.setItem('flowly_notif_settings', JSON.stringify(cur));
        await saveNotifSettingsToSupabase();
        renderSettingsView();
      };
    }

    const btnTestNotification = document.getElementById('btnTestNotification');
    if (btnTestNotification) {
      btnTestNotification.onclick = async function () {
        const feedbackEl = document.getElementById('notifTestFeedback');
        this.disabled = true;
        this.classList.add('opacity-70', 'cursor-not-allowed');

        if (!('Notification' in window)) {
          if (feedbackEl) {
            feedbackEl.className = 'text-xs text-red-400 mt-2 min-h-[16px]';
            feedbackEl.textContent = 'Seu navegador nao suporta notificacoes.';
          }
          this.disabled = false;
          this.classList.remove('opacity-70', 'cursor-not-allowed');
          return;
        }

        if (Notification.permission !== 'granted') {
          await requestNotificationPermission();
        }

        const result = await sendTestNotification();

        if (feedbackEl) {
          if (result && result.ok) {
            feedbackEl.className = 'text-xs text-green-400 mt-2 min-h-[16px]';
            feedbackEl.textContent = 'Notificacao de teste enviada com sucesso.';
          } else if (result && result.reason === 'permission') {
            feedbackEl.className = 'text-xs text-red-400 mt-2 min-h-[16px]';
            feedbackEl.textContent = 'Permissao negada. Libere nas configuracoes do navegador.';
          } else if (result && result.reason === 'unsupported') {
            feedbackEl.className = 'text-xs text-red-400 mt-2 min-h-[16px]';
            feedbackEl.textContent = 'Seu navegador nao suporta notificacoes.';
          } else {
            feedbackEl.className = 'text-xs text-red-400 mt-2 min-h-[16px]';
            feedbackEl.textContent = 'Nao foi possivel enviar a notificacao de teste.';
          }
        }

        this.disabled = false;
        this.classList.remove('opacity-70', 'cursor-not-allowed');
      };
    }

    const saveNotifField = async (id, value) => {
      const cur = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
      const valueById = {
        inputMorningTime: ['morningTime', value],
        inputMiddayTime: ['middayTime', value],
        inputEveningTime: ['eveningTime', value],
        inputInactivityMinutes: [
          'inactivityThresholdMinutes',
          Math.max(30, Math.min(480, Number(value) || 150))
        ],
        inputMorningTemplate: ['morningTemplate', value],
        inputMiddayTemplate: ['middayTemplate', value],
        inputNightTemplate: ['nightTemplate', value],
        inputInactivityTemplate: ['inactivityTemplate', value],
        inputProgressTemplate: ['progressTemplate', value]
      };

      const config = valueById[id];
      if (!config) return;
      cur[config[0]] = config[1];
      localStorage.setItem('flowly_notif_settings', JSON.stringify(cur));
      await saveNotifSettingsToSupabase();
    };

    // Inputs de notificacoes
    [
      'inputMorningTime',
      'inputMiddayTime',
      'inputEveningTime',
      'inputInactivityMinutes',
      'inputMorningTemplate',
      'inputMiddayTemplate',
      'inputNightTemplate',
      'inputInactivityTemplate',
      'inputProgressTemplate'
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.onchange = async function () {
          await saveNotifField(id, this.value);
          if (id === 'inputInactivityMinutes') {
            this.value = String(Math.max(30, Math.min(480, Number(this.value) || 150)));
          }
        };
      }
    });

    const bindNotifToggle = (id, fieldName) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.onclick = async function () {
        const cur = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
        cur[fieldName] = !(cur[fieldName] !== false);
        localStorage.setItem('flowly_notif_settings', JSON.stringify(cur));
        await saveNotifSettingsToSupabase();
        renderSettingsView();
      };
    };

    bindNotifToggle('toggleInactivityNotif', 'inactivityEnabled');
    bindNotifToggle('toggleProgressNotif', 'progressEnabled');

    // Week Hover Toggle
    const toggleWH = document.getElementById('toggleWeekHover');
    if (toggleWH) {
      toggleWH.onclick = async function () {
        dbUserSettings.enable_week_hover_animation = !dbUserSettings.enable_week_hover_animation;
        if (!dbUserSettings.enable_week_hover_animation) {
          document.body.classList.add('no-week-hover');
        } else {
          document.body.classList.remove('no-week-hover');
        }
        renderSettingsView();
        if (currentUser) {
          await supabaseClient.from('user_settings').upsert(
            {
              user_id: currentUser.id,
              enable_week_hover_animation: dbUserSettings.enable_week_hover_animation
            },
            { onConflict: 'user_id' }
          );
        }
      };
    }

    // Inline Editors for Types and Priorities
    renderInlineEditors();

    // Week Start
    const weekSelect = document.getElementById('selectWeekStart');
    if (weekSelect) {
      weekSelect.onchange = function () {
        const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
        cur.weekStart = this.value;
        localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
        if (currentView === 'week') renderView();
      };
    }

    // Weekends Toggle
    const toggleW = document.getElementById('toggleWeekends');
    if (toggleW) {
      toggleW.onclick = function () {
        const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
        cur.showWeekends = !(cur.showWeekends !== false);
        localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
        renderSettingsView();
        if (currentView === 'week') renderView();
      };
    }

    // Haptics Toggle
    const toggleH = document.getElementById('toggleHaptics');
    if (toggleH) {
      toggleH.onclick = function () {
        const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
        cur.haptics = !(cur.haptics !== false);
        localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
        renderSettingsView();
      };
    }

    // Export
    const exportBtn = document.getElementById('btnExportSettings');
    if (exportBtn) {
      exportBtn.onclick = () => {
        const backup = {
          allTasksData,
          allRecurringTasks,
          weeklyRecurringTasks,
          dailyRoutine,
          habitsHistory,
          exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flowly-backup-${localDateStr()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };
    }

    // Import
    const importInput = document.getElementById('fileImportSettings');
    if (importInput) {
      importInput.onchange = function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (data.allTasksData) {
              allTasksData = data.allTasksData;
              localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
            }
            if (data.allRecurringTasks) {
              allRecurringTasks = data.allRecurringTasks;
              localStorage.setItem('allRecurringTasks', JSON.stringify(allRecurringTasks));
            }
            if (data.habitsHistory) {
              habitsHistory = data.habitsHistory;
              localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));
            }
            renderView();
            alert('Backup importado com sucesso!');
          } catch (error) {
            alert('Erro ao importar backup: ' + error.message);
          }
        };
        reader.readAsText(file);
      };
    }

    // Fix
    const fixBtn = document.getElementById('btnFixDuplicates');
    if (fixBtn) {
      fixBtn.onclick = async () => {
        if (!currentUser) {
          alert('Faca login primeiro!');
          return;
        }
        if (!confirm('Remove duplicatas e tarefas corrompidas do banco. Continuar?')) return;
        const btn = document.getElementById('btnFixDuplicates');
        const originalText =
          '<i data-lucide="wrench" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i><span class="text-xs font-semibold">Corrigir Banco</span>';
        btn.innerHTML = '<span class="text-xs font-semibold text-amber-200">Limpando...</span>';
        btn.disabled = true;
        try {
          const { data: allT } = await supabaseClient
            .from('tasks')
            .select('*')
            .eq('user_id', currentUser.id);
          if (!allT) {
            alert('Erro ao buscar dados.');
            return;
          }
          const recurringTexts = new Set(allRecurringTasks.map((rt) => rt.text));
          const seen = new Map();
          const del = [];
          allT.forEach((t) => {
            const d = t.day || '';
            if (
              !d ||
              !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
              !t.period ||
              !t.text ||
              recurringTexts.has(t.text)
            ) {
              del.push(t.id);
              return;
            }
            const k = `${d}| ${t.period}| ${t.text} `;
            seen.has(k) ? del.push(t.id) : seen.set(k, t.id);
          });
          for (let i = 0; i < del.length; i += 100) {
            await supabaseClient
              .from('tasks')
              .delete()
              .in('id', del.slice(i, i + 100));
          }
          allTasksData = {};
          localStorage.removeItem('allTasksData');
          await loadDataFromSupabase();
          renderView();
          alert(`${del.length} registros removidos.`);
        } catch (e) {
          alert('Erro: ' + e.message);
        } finally {
          btn.innerHTML = originalText;
          btn.disabled = false;
          lucide.createIcons();
        }
      };
    }

    // Clear
    const clearBtn = document.getElementById('btnClearAllSettings');
    if (clearBtn) {
      clearBtn.onclick = async () => {
        if (!confirm('Apagar TODOS os dados? Isso nao pode ser desfeito!')) return;
        const authKeys = Object.keys(localStorage).filter(
          (k) => k.startsWith('sb-') || k === 'flowly_persist_session'
        );
        const authData = {};
        authKeys.forEach((k) => (authData[k] = localStorage.getItem(k)));
        if (currentUser) {
          await supabaseClient.from('tasks').delete().eq('user_id', currentUser.id);
          await supabaseClient.from('habits_history').delete().eq('user_id', currentUser.id);
        }
        Object.keys(weekData).forEach((d) => (weekData[d] = {}));
        allTasksData = {};
        habitsHistory = {};
        localStorage.clear();
        Object.entries(authData).forEach(([k, v]) => localStorage.setItem(k, v));
        saveToLocalStorage();
        location.reload();
      };
    }
  }, 50);
}

async function renderInlineEditors() {
  const priosList = document.getElementById('priosList');
  if (!priosList) return;

  if (customTaskPriorities.length === 0) {
    customTaskPriorities.push(...getTaskPriorities().map((p) => ({ ...p })));
  }
  ensureMoneyPriorityOption();

  const renderItem = (item, type, container, arr, dbTable) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 group';

    const inputName = document.createElement('input');
    inputName.type = 'text';
    inputName.value = item.name || '';
    inputName.className =
      'bg-black/30 border border-white/10 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none flex-1 transition-colors';

    const inputColor = document.createElement('input');
    inputColor.type = 'color';
    inputColor.value = item.color || '#ffffff';
    inputColor.className = 'w-6 h-6 rounded border-0 bg-transparent cursor-pointer flex-shrink-0';

    let pendingUpdate = null;
    const triggerUpdate = () => {
      clearTimeout(pendingUpdate);
      pendingUpdate = setTimeout(async () => {
        const oldId = item.id;
        item.name = inputName.value;
        item.color = inputColor.value;
        if (!item.id || item.id === item.name.toUpperCase().replace(/\s+/g, '_')) {
          item.id = item.name.toUpperCase().replace(/\s+/g, '_');
        }
        if (currentUser) {
          if (oldId && oldId !== item.id) {
            await supabaseClient
              .from(dbTable)
              .delete()
              .eq('id', oldId)
              .eq('user_id', currentUser.id);
          }
          await supabaseClient
            .from(dbTable)
            .upsert({ id: item.id, name: item.name, color: item.color, user_id: currentUser.id });
        }
      }, 800);
    };

    inputName.oninput = triggerUpdate;
    inputColor.oninput = triggerUpdate;

    const btnDelete = document.createElement('button');
    btnDelete.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
    btnDelete.className =
      'text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1';
    btnDelete.onclick = async () => {
      if (!confirm('Excluir este item?')) return;
      const idx = arr.indexOf(item);
      if (idx > -1) arr.splice(idx, 1);
      row.remove();
      if (currentUser && item.id) {
        await supabaseClient.from(dbTable).delete().eq('id', item.id).eq('user_id', currentUser.id);
      }
    };

    row.appendChild(inputColor);
    row.appendChild(inputName);
    row.appendChild(btnDelete);
    container.appendChild(row);
  };

  priosList.innerHTML = '';
  customTaskPriorities.forEach((p) =>
    renderItem(p, 'priority', priosList, customTaskPriorities, 'task_priorities')
  );

  document.getElementById('btnAddPrio').onclick = async () => {
    const newItem = { id: 'NOVA_PRIO_' + Date.now(), name: 'Nova Prio', color: '#FFD60A' };
    customTaskPriorities.push(newItem);
    renderItem(newItem, 'priority', priosList, customTaskPriorities, 'task_priorities');
    if (currentUser)
      await supabaseClient.from('task_priorities').upsert({
        id: newItem.id,
        name: newItem.name,
        color: newItem.color,
        user_id: currentUser.id
      });
    lucide.createIcons();
  };
}

function deleteWeeklyRecurringTask(index) {
  if (!confirm('Remover esta tarefa semanal recorrente?')) return;
  weeklyRecurringTasks.splice(index, 1);
  localStorage.setItem('weeklyRecurringTasks', JSON.stringify(weeklyRecurringTasks));
  renderSettingsView();
}

async function deleteEmptyTasks() {
  if (
    !confirm(
      'Tem certeza que deseja excluir todas as tarefas vazias (sem texto)?\n\nEsta ação não pode ser desfeita!'
    )
  )
    return;

  let deletedCount = 0;

  // Percorrer todas as datas
  Object.entries(allTasksData).forEach(([dateStr, periods]) => {
    Object.entries(periods).forEach(([period, tasks]) => {
      if (Array.isArray(tasks)) {
        // Filtrar tarefas vazias
        const beforeLength = tasks.length;
        const filteredTasks = tasks.filter((task) => task.text && task.text.trim() !== '');
        const afterLength = filteredTasks.length;

        deletedCount += beforeLength - afterLength;

        // Atualizar array
        allTasksData[dateStr][period] = filteredTasks;

        // Remover período se ficou vazio
        if (filteredTasks.length === 0) {
          delete allTasksData[dateStr][period];
        }
      }
    });

    // Remover data se não tem mais períodos
    if (Object.keys(allTasksData[dateStr]).length === 0) {
      delete allTasksData[dateStr];
    }
  });

  // Deletar tarefas vazias do Supabase
  if (currentUser) {
    try {
      await supabaseClient
        .from('tasks')
        .delete()
        .eq('user_id', currentUser.id)
        .or('text.is.null,text.eq.');
    } catch (error) {
      console.error('Erro ao deletar tarefas vazias do Supabase:', error);
    }
  }

  saveToLocalStorage();
  renderView();

  alert(`${deletedCount} tarefa(s) vazia(s) foram excluídas!`);
}

// Função para mostrar modal de criação de tarefa semanal recorrente
function bindWeeklyDayButtons() {
  document.querySelectorAll('.weekly-day-btn').forEach((btn) => {
    if (btn.dataset.weeklyBound === '1') return;
    btn.dataset.weeklyBound = '1';
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.toggle('selected');
      btn.classList.toggle('active');
    });
  });
}

function showWeeklyRecurrenceDialog() {
  const modal = document.getElementById('weeklyModal');
  document.getElementById('weeklyTaskText').value = '';
  // Limpar seleção de dias
  bindWeeklyDayButtons();
  document.querySelectorAll('.weekly-day-btn').forEach((b) => {
    b.classList.remove('selected');
    b.classList.remove('active');
  });
  modal.classList.add('show');
  setTimeout(() => {
    document.getElementById('weeklyTaskText').focus();
    lucide.createIcons();
  }, 100);
}

// Retorna as tarefas recorrentes semanais de um dia (apenas para exibição, sem persistir)
function getWeeklyRecurringForDay(dateStr, dayOfWeek) {
  // Usa allRecurringTasks como fonte única
  const existingTexts = new Set();
  Object.values(allTasksData[dateStr] || {}).forEach((tasks) => {
    if (Array.isArray(tasks))
      tasks.forEach((t) => {
        if (t.text) existingTexts.add(t.text);
      });
  });
  return allRecurringTasks
    .filter((rt) => {
      if (!rt.daysOfWeek || !rt.daysOfWeek.includes(dayOfWeek)) return false;
      if (existingTexts.has(rt.text)) return false;

      const rawStart = rt.startDate || rt.createdAt || rt.created_at;
      if (!rawStart) return true;

      const parsed = new Date(rawStart);
      if (!Number.isFinite(parsed.getTime())) return true;

      const startKey = localDateStr(new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
      return dateStr >= startKey;
    })
    .map((rt) => ({
      text: rt.text,
      completed: false,
      color: rt.color,
      isHabit: rt.isHabit,
      isRecurring: true
    }));
}

function renderView() {
  if (currentView === 'projects') {
    document.getElementById('monthView').classList.add('hidden');
    document.getElementById('weekGrid').classList.add('hidden');
    document.getElementById('weekGrid').classList.remove('today-container');
    document.getElementById('routineView').classList.add('hidden');
    document.getElementById('analyticsView').classList.add('hidden');
    document.getElementById('financeView').classList.add('hidden');
    document.getElementById('projectsView').classList.add('hidden');
    document.getElementById('settingsView').classList.add('hidden');
    document.getElementById('sextaView').classList.add('hidden');
    document.getElementById('weekNav').classList.add('hidden');
    document.getElementById('projectsView').classList.remove('hidden');
    renderProjectsView();
    setTimeout(() => lucide.createIcons(), 0);
    return;
  }

  if (currentView === 'finance') {
    document.getElementById('monthView').classList.add('hidden');
    document.getElementById('weekGrid').classList.add('hidden');
    document.getElementById('weekGrid').classList.remove('today-container');
    document.getElementById('routineView').classList.add('hidden');
    document.getElementById('analyticsView').classList.add('hidden');
    document.getElementById('settingsView').classList.add('hidden');
    document.getElementById('sextaView').classList.add('hidden');
    document.getElementById('weekNav').classList.add('hidden');
    document.getElementById('financeView').classList.remove('hidden');
    renderFinanceView();
    setTimeout(() => lucide.createIcons(), 0);
    return;
  }

  if (currentView === 'sexta') {
    document.getElementById('monthView').classList.add('hidden');
    document.getElementById('weekGrid').classList.add('hidden');
    document.getElementById('weekGrid').classList.remove('today-container');
    document.getElementById('routineView').classList.add('hidden');
    document.getElementById('analyticsView').classList.add('hidden');
    document.getElementById('financeView').classList.add('hidden');
    document.getElementById('settingsView').classList.add('hidden');
    document.getElementById('weekNav').classList.add('hidden');
    document.getElementById('sextaView').classList.remove('hidden');
    renderSextaView();
    setTimeout(() => lucide.createIcons(), 0);
    return;
  }

  if (!viewDispatcher && window.FlowlyViews) {
    viewDispatcher = window.FlowlyViews.createDispatcher({
      renderMonth,
      renderAnalyticsView,
      renderFinanceView,
      renderProjectsView,
      renderSextaView,
      renderSettingsView,
      renderWeek,
      renderToday
    });
  }

  if (viewDispatcher) {
    viewDispatcher.renderCurrent(currentView);
  } else {
    document.getElementById('monthView').classList.add('hidden');
    document.getElementById('weekGrid').classList.add('hidden');
    document.getElementById('weekGrid').classList.remove('today-container');
    document.getElementById('routineView').classList.add('hidden');
    document.getElementById('analyticsView').classList.add('hidden');
    document.getElementById('financeView').classList.add('hidden');
    document.getElementById('projectsView').classList.add('hidden');
    document.getElementById('sextaView').classList.add('hidden');
    document.getElementById('settingsView').classList.add('hidden');
    document.getElementById('weekNav').classList.add('hidden');

    if (currentView === 'week') document.getElementById('weekNav').classList.remove('hidden');
    if (currentView === 'month') {
      document.getElementById('monthView').classList.remove('hidden');
      renderMonth();
    } else if (currentView === 'analytics') {
      document.getElementById('analyticsView').classList.remove('hidden');
      renderAnalyticsView();
    } else if (currentView === 'finance') {
      document.getElementById('financeView').classList.remove('hidden');
      renderFinanceView();
    } else if (currentView === 'projects') {
      document.getElementById('projectsView').classList.remove('hidden');
      renderProjectsView();
    } else if (currentView === 'sexta') {
      document.getElementById('sextaView').classList.remove('hidden');
      renderSextaView();
    } else if (currentView === 'settings') {
      document.getElementById('settingsView').classList.remove('hidden');
      renderSettingsView();
    } else {
      document.getElementById('weekGrid').classList.remove('hidden');
      if (currentView === 'week') renderWeek();
      else renderToday();
    }
  }

  setTimeout(() => lucide.createIcons(), 0);
}

function renderWeek() {
  const grid = document.getElementById('weekGrid');
  grid.className = '';
  grid.style.cssText = '';
  grid.innerHTML = '';

  // Atualizar label da semana
  document.getElementById('weekLabel').textContent = getWeekLabel(currentWeekOffset);

  const weekDates = getWeekDates(currentWeekOffset);

  // HIDRATAR A SEMANA: Garantir que as rotinas existam no banco para todos os dias visíveis
  weekDates.forEach(({ dateStr }) => hydrateRoutineForDate(dateStr));

  weekDates.forEach(({ name: day, dateStr }) => {
    // Ler tarefas persistidas (sem rotina/recorrentes)
    const dayTasks = allTasksData[dateStr] || {};

    const col = document.createElement('div');
    col.className = 'day-column';
    col.dataset.day = day;
    col.dataset.date = dateStr;

    // Drag Events (coluna como drop zone de fallback)
    col.addEventListener('dragover', (e) => e.preventDefault());
    col.addEventListener('drop', columnDropFallback);

    const todayStr = localDateStr();
    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;

    if (isToday) col.classList.add('today-active');
    if (isPast) col.classList.add('past-day');
    if (dateStr > todayStr) col.classList.add('future-day');

    const header = document.createElement('h2');
    const dayNum = dateStr.split('-')[2].replace(/^0/, '');

    header.className = `flex items-center gap-2 mb-3 ${isToday ? 'text-blue-500 font-bold' : 'text-gray-400'} `;
    header.innerHTML = `
    <span> ${day}</span>
        <span class="${isToday ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-gray-500'} text-xs px-2 py-0.5 rounded-full font-mono">${dayNum}</span>
`;
    col.appendChild(header);

    // Flatten all tasks
    let allTasks = [];

    // 1. Adicionar tarefas de rotina e recorrentes semanais (geradas dinamicamente, index = -1)
    const routineTasks = getRoutineTasksForDate(dateStr);
    routineTasks.forEach((task, routineIndex) => {
      allTasks.push({
        task,
        day,
        dateStr,
        period: 'Rotina',
        originalIndex: routineIndex
      });
    });

    // 2. Adicionar tarefas normais persistidas (excluindo período 'Rotina' se foi salvo indevidamente)
    Object.entries(dayTasks).forEach(([period, tasks]) => {
      if (period === 'Rotina') return; // Pular - rotinas são geradas dinamicamente acima
      if (Array.isArray(tasks)) {
        tasks.forEach((task, index) => {
          if (task && typeof task === 'object') {
            allTasks.push({
              task,
              day,
              dateStr,
              period,
              originalIndex: index
            });
          }
        });
      }
    });

    // ===== ORDENAÇÃO UNIFICADA =====
    getProjectMirrorEntriesForDate(dateStr, day).forEach((entry) => {
      allTasks.push(entry);
    });

    allTasks = unifiedTaskSort(allTasks);

    // Renderizar
    allTasks.forEach(({ task, day, dateStr, period, originalIndex }) => {
      col.appendChild(createTaskElement(day, dateStr, period, task, originalIndex));
    });

    // ===== DROP ZONE NO FINAL PADRONIZADA =====
    // Usa createDropZone com index = allTasks.length para inserir no fim
    const endDropZone = createDropZone(day.name, dateStr, 'Tarefas', allTasks.length);
    endDropZone.classList.add('flex-grow', 'min-h-[40px]'); // Estilo para ocupar espaço
    endDropZone.innerText = '';

    // Atalho: clique na zona final abre input de nova tarefa
    endDropZone.addEventListener('click', (e) => {
      if (!document.body.classList.contains('dragging-active')) {
        insertQuickTaskInput(col, dateStr, 'Tarefas', endDropZone);
      }
    });

    col.appendChild(endDropZone);

    // Adicionar área clicável para nova tarefa (estilo Notion)
    col.addEventListener('click', (e) => {
      // Só adicionar se clicar na área vazia (não em tasks ou inputs existentes)
      if (e.target === col || e.target.tagName === 'H2' || e.target.tagName === 'H3') {
        insertQuickTaskInput(col, dateStr, 'Tarefas', endDropZone);
      }
    });

    grid.appendChild(col);
  });

  // --- Dynamic Column Hover Resizing ---
  const columns = grid.querySelectorAll('.day-column');
  columns.forEach((col, index) => {
    col.addEventListener('mouseenter', () => {
      // Use 0.9fr for others, 1.6fr for hovered
      const tmpl = Array(columns.length).fill('0.9fr');
      tmpl[index] = '1.6fr';
      grid.style.gridTemplateColumns = tmpl.join(' ');
    });

    col.addEventListener('mouseleave', () => {
      grid.style.gridTemplateColumns = `repeat(${columns.length}, 1fr)`;
    });
  });
}

// Função de Ordenação Unificada (Regra: Rotina -> Concluídas -> Pendentes)
function getTaskTreeId(task) {
  if (!task) return '';
  return String(task.supabaseId || task.text || '').trim();
}

function buildTaskChildrenMap(list) {
  const safeList = Array.isArray(list) ? list : [];
  const orderMap = new Map();
  const childrenMap = new Map();

  safeList.forEach((task, index) => {
    const id = getTaskTreeId(task);
    if (id) orderMap.set(id, index);
  });

  safeList.forEach((task) => {
    if (!task || !task.parent_id || !orderMap.has(task.parent_id)) return;
    if (!childrenMap.has(task.parent_id)) childrenMap.set(task.parent_id, []);
    childrenMap.get(task.parent_id).push(task);
  });

  childrenMap.forEach((children) => {
    children.sort((a, b) => {
      const orderA = orderMap.get(getTaskTreeId(a));
      const orderB = orderMap.get(getTaskTreeId(b));
      return (orderA ?? Number.MAX_SAFE_INTEGER) - (orderB ?? Number.MAX_SAFE_INTEGER);
    });
  });

  return childrenMap;
}

function collectTaskSubtree(list, rootTask) {
  if (!Array.isArray(list) || !rootTask) return [];

  const childrenMap = buildTaskChildrenMap(list);
  const subtree = [];
  const visited = new Set();

  const visit = (task) => {
    if (!task || visited.has(task)) return;
    visited.add(task);
    subtree.push(task);

    const taskId = getTaskTreeId(task);
    if (!taskId || !childrenMap.has(taskId)) return;
    childrenMap.get(taskId).forEach((child) => visit(child));
  };

  visit(rootTask);
  return subtree;
}

function moveTaskSubtree({
  sourceDateStr,
  sourcePeriod,
  sourceIndex,
  targetDateStr,
  targetPeriod,
  insertAt,
  indentIntent = false,
  outdentIntent = false
}) {
  if (!allTasksData[sourceDateStr]) allTasksData[sourceDateStr] = {};
  if (!allTasksData[targetDateStr]) allTasksData[targetDateStr] = {};
  if (!allTasksData[sourceDateStr][sourcePeriod]) allTasksData[sourceDateStr][sourcePeriod] = [];
  if (!allTasksData[targetDateStr][targetPeriod]) allTasksData[targetDateStr][targetPeriod] = [];

  const sourceList = allTasksData[sourceDateStr][sourcePeriod];
  const rootTask = sourceList[sourceIndex];
  if (!rootTask) return { moved: false };

  const subtreeTasks = collectTaskSubtree(sourceList, rootTask);
  if (subtreeTasks.length === 0) return { moved: false };

  const subtreeSet = new Set(subtreeTasks);
  const subtreeIndexes = [];
  sourceList.forEach((task, index) => {
    if (subtreeSet.has(task)) subtreeIndexes.push(index);
  });

  if (subtreeIndexes.length === 0) return { moved: false };

  const movingWithinSameList = sourceDateStr === targetDateStr && sourcePeriod === targetPeriod;
  const firstSubtreeIndex = subtreeIndexes[0];
  const lastSubtreeIndex = subtreeIndexes[subtreeIndexes.length - 1];

  if (movingWithinSameList && insertAt >= firstSubtreeIndex && insertAt <= lastSubtreeIndex + 1) {
    return { moved: false, noOp: true };
  }

  let normalizedInsertAt = Number.isFinite(insertAt) ? insertAt : sourceList.length;
  if (movingWithinSameList) {
    const removedBeforeInsert = subtreeIndexes.filter((index) => index < normalizedInsertAt).length;
    normalizedInsertAt -= removedBeforeInsert;
  }

  const sourceRemainder = sourceList.filter((task) => !subtreeSet.has(task));
  allTasksData[sourceDateStr][sourcePeriod] = sourceRemainder;

  const destinationList = movingWithinSameList ? sourceRemainder : allTasksData[targetDateStr][targetPeriod];
  normalizedInsertAt = Math.max(0, Math.min(normalizedInsertAt, destinationList.length));

  subtreeTasks.forEach((task) => {
    task.isRoutine = targetPeriod === 'Rotina';
  });

  destinationList.splice(normalizedInsertAt, 0, ...subtreeTasks);

  const movedRootTask = subtreeTasks[0];
  if (indentIntent && normalizedInsertAt > 0) {
    const prevTask = destinationList[normalizedInsertAt - 1];
    if (prevTask && !subtreeSet.has(prevTask) && (prevTask.depth || 0) < 2) {
      movedRootTask.parent_id = getTaskTreeId(prevTask);
    }
  } else if (outdentIntent) {
    movedRootTask.parent_id = null;
  } else if (
    movedRootTask.parent_id &&
    !destinationList.some((task) => getTaskTreeId(task) === movedRootTask.parent_id)
  ) {
    movedRootTask.parent_id = null;
  }

  destinationList.forEach((task, index) => {
    task.position = index;
  });

  if (!movingWithinSameList) {
    sourceRemainder.forEach((task, index) => {
      task.position = index;
    });
  }

  if (allTasksData[sourceDateStr][sourcePeriod].length === 0) {
    delete allTasksData[sourceDateStr][sourcePeriod];
  }

  return {
    moved: true,
    datesToSync: [...new Set([sourceDateStr, targetDateStr])]
  };
}

function persistCollapsedTaskGroups() {
  localStorage.setItem('flowlyCollapsedTaskGroups', JSON.stringify(collapsedTaskGroups || {}));
}

function isTaskGroupCollapsed(task) {
  const id = getTaskTreeId(task);
  return Boolean(id && collapsedTaskGroups && collapsedTaskGroups[id] === true);
}

function getTaskChildrenCount(dateStr, period, task) {
  const list = allTasksData?.[dateStr]?.[period] || [];
  const parentId = getTaskTreeId(task);
  if (!parentId) return 0;
  return list.filter((item) => item && item.parent_id === parentId).length;
}

window.toggleTaskTreeCollapse = function (task) {
  const id = getTaskTreeId(task);
  if (!id) return;
  collapsedTaskGroups[id] = !collapsedTaskGroups[id];
  if (!collapsedTaskGroups[id]) delete collapsedTaskGroups[id];
  persistCollapsedTaskGroups();
  renderView();
};

window.toggleTaskChildrenCollapse = function (dateStr, period, index) {
  const task = allTasksData?.[dateStr]?.[period]?.[index];
  if (!task) return;
  window.toggleTaskTreeCollapse(task);
};

function isProjectSubtasksCollapsed(task) {
  if (currentView !== 'projects' || !task || !task.projectId) return false;
  const project = findProjectById(task.projectId);
  return project ? project.collapseSubtasks !== false : false;
}

function unifiedTaskSort(taskList) {
  if (!taskList || taskList.length === 0) return [];

  const itemMap = new Map();
  const childrenMap = new Map();

  taskList.forEach((item) => {
    if (!item.task) return;
    if (typeof item.task.position !== 'number') item.task.position = item.originalIndex || 0;
    const id = item.task.supabaseId || item.task.text;
    itemMap.set(id, item);
  });

  const roots = [];

  taskList.forEach((item) => {
    if (!item.task) return;
    const pId = item.task.parent_id;
    if (pId && itemMap.has(pId)) {
      if (!childrenMap.has(pId)) childrenMap.set(pId, []);
      childrenMap.get(pId).push(item);
    } else {
      roots.push(item);
    }
  });

  const sortFn = (a, b) => {
    const tA = a.task;
    const tB = b.task;

    // 1. Rotinas sempre no topo absoluto
    const isRoutineA = tA.isRoutine || tA.isRecurring || a.period === 'Rotina';
    const isRoutineB = tB.isRoutine || tB.isRecurring || b.period === 'Rotina';
    if (isRoutineA !== isRoutineB) return isRoutineA ? -1 : 1;
    if (isRoutineA && isRoutineB) {
      // Dentro de rotinas: concluídas primeiro, depois por ordem original
      if (tA.completed !== tB.completed) return tA.completed ? -1 : 1;
      return (a.originalIndex || 0) - (b.originalIndex || 0);
    }

    const isProjectAnchorA = false;
    const isProjectAnchorB = false;
    if (isProjectAnchorA !== isProjectAnchorB) return isProjectAnchorA ? -1 : 1;
    if (isProjectAnchorA && isProjectAnchorB) {
      const scheduleA = String(tA.projectScheduleText || '');
      const scheduleB = String(tB.projectScheduleText || '');
      const scheduleCmp = scheduleA.localeCompare(scheduleB);
      if (scheduleCmp !== 0) return scheduleCmp;
      return String(tA.text || '').localeCompare(String(tB.text || ''));
    }

    // 2. Concluídas em cima, pendentes embaixo
    if (tA.completed !== tB.completed) return tA.completed ? -1 : 1;

    // 3. Dentro de concluídas: ordenar por completedAt (mais antiga primeiro = ordem de conclusão)
    if (tA.completed && tB.completed) {
      const timeA = tA.completedAt ? new Date(tA.completedAt).getTime() : 0;
      const timeB = tB.completedAt ? new Date(tB.completedAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB; // mais antiga primeiro
    }

    // 4. Dentro de pendentes: por position, depois originalIndex
    if (tA.position !== tB.position && (tA.position !== 0 || tB.position !== 0)) {
      return tA.position - tB.position;
    }

    return (a.originalIndex || 0) - (b.originalIndex || 0);
  };

  roots.sort(sortFn);

  const flattened = [];

  const traverse = (item, depth) => {
    if (depth > 2) depth = 2; // Profundidade máxima inicial: 2 níveis
    item.task.depth = depth;
    flattened.push(item);

    const id = item.task.supabaseId || item.task.text;
    const shouldCollapseChildren = isTaskGroupCollapsed(item.task) || isProjectSubtasksCollapsed(item.task);
    if (childrenMap.has(id) && !shouldCollapseChildren) {
      const children = childrenMap.get(id);
      children.sort(sortFn);
      children.forEach((child) => traverse(child, depth + 1));
    }
  };

  roots.forEach((r) => traverse(r, 0));

  return flattened;
}

// Nova função global para toggle com reordenação
window.toggleTaskStatus = function (dateStr, period, index, isChecked, element) {
  // Se for Rotina/Hábito (index -1), usa a lógica específica de hábitos
  if (period === 'Rotina' || index === -1) {
    const taskText = element.querySelector('.task-label').textContent; // Hacky but works for generated routine items
    // Melhor pegar do dataset ou passar o objeto task direto, mas createTaskElement fecha o scope.
    // Vamos usar o markHabitCompleted direto no checkbox.onchange para rotinas,
    // e esta função APENAS para regular tasks.
    return;
  }

  const list = allTasksData[dateStr]?.[period];
  if (!list || !list[index]) return;

  const task = list[index];
  if (!task.createdAt) task.createdAt = new Date().toISOString();

  // 1. Atualizar Estado
  task.completed = isChecked;

  if (isChecked) {
    task.completedAt = new Date().toISOString();

    // 2. Mover: Logo abaixo da última tarefa já concluída
    // Como estamos na lista crua (sem separação de Routine),
    // precisamos achar onde termina o bloco de "Concluídos" dentro dessa lista.
    // Mas espere, unifiedSort mistura períodos se renderWeek juntasse períodos.
    // Mas allTasksData[date][period] é a fonte da verdade.
    // Se "period" é unico (ex: 'Tarefas'), a lista é autocontida.

    // Remover da posição atual
    list.splice(index, 1);

    // Achar nova posição:
    // Queremos inserir APÓS a última concluída.
    // Percorrer e achar índice.
    let insertIdx = 0;
    let foundCompleted = false;
    for (let i = 0; i < list.length; i++) {
      if (list[i].completed) {
        insertIdx = i + 1;
        foundCompleted = true;
      } else {
        // Se achou pendente e já passamos por completadas (ou no inicio se R->C->P),
        // Para R->C->P: Completadas vêm ANTES das Pendentes.
        // Então inserimos logo antes da primeira pendente?
        // Ou após a última concluída.
        // Se sort order é C -> P.
        // Lista ordenada: [C, C, C, P, P].
        // Task virou C. Deve ir para fim dos C.
        // InsertIdx deve ser index da primeira P.
        if (foundCompleted) break;
        // Se ainda nao achou completada, e achou pendente?
        // Se não tem completadas, insertIdx = 0.
      }
    }

    // Refinamento: Se ordenação é C -> P.
    // Inserir após a última C existente.
    // Se não houver C, inserir no topo (índice 0).
    // Mas cuidado com a ordem original das P.

    // Vamos simplificar: Inserir no final das concluídas.
    // Filtrar C e P.
    const completed = list.filter((t) => t.completed);
    const pending = list.filter((t) => !t.completed);

    // A task atual já foi removida. Adicionar em 'completed' no final.
    completed.push(task);

    // Reconstruir lista: Completed + Pending
    allTasksData[dateStr][period] = [...completed, ...pending];
  } else {
    task.completedAt = null;

    // 3. Mover: Topo das pendentes
    // Remover da posição atual
    list.splice(index, 1);

    // Separar
    const completed = list.filter((t) => t.completed);
    const pending = list.filter((t) => !t.completed);

    // Inserir no TOPO de pending
    pending.unshift(task);

    // Reconstruir: Completed + Pending
    allTasksData[dateStr][period] = [...completed, ...pending];
  }

  // Recalcular posicao de toda a lista para persistir a nova ordem corretamente
  allTasksData[dateStr][period].forEach((t, i) => {
    t.position = i;
  });

  // Salvar e sincronizar a data inteira para evitar divergencia de ordem no reload
  saveToLocalStorage();
  if (typeof syncDateToSupabase === 'function') {
    syncDateToSupabase(dateStr);
  } else if (typeof syncTaskToSupabase === 'function') {
    syncTaskToSupabase(dateStr, period, task);
  }

  // Re-renderizar TUDO para garantir consistencia visual imediata
  renderView();
};

function renderToday() {
  const grid = document.getElementById('todayView');
  const todayViewSettings = safeJSONParse(localStorage.getItem('flowly_today_view_settings'), {});
  const focusOnlyMode = todayViewSettings.focusOnlyMode === true;

  grid.className = focusOnlyMode ? 'today-container today-focus-mode' : 'today-container';
  grid.style.cssText = '';
  grid.innerHTML = '';

  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const today = days[new Date().getDay()];
  const dateStr = localDateStr();

  // ===== LEFT: Main area =====
  const main = document.createElement('div');
  main.className = 'today-main';

  // Focus toggle (daily view)
  const focusToggleWrap = document.createElement('div');
  focusToggleWrap.className = focusOnlyMode
    ? 'today-focus-toggle-wrap focus-active'
    : 'today-focus-toggle-wrap';

  const focusToggleBtn = document.createElement('button');
  focusToggleBtn.className = 'today-focus-toggle-btn';
  focusToggleBtn.textContent = focusOnlyMode ? 'Mostrar dados' : 'Modo foco';
  focusToggleBtn.onclick = (e) => {
    e.stopPropagation();
    const current = safeJSONParse(localStorage.getItem('flowly_today_view_settings'), {});
    current.focusOnlyMode = !(current.focusOnlyMode === true);
    localStorage.setItem('flowly_today_view_settings', JSON.stringify(current));
    renderView();
  };
  focusToggleWrap.appendChild(focusToggleBtn);
  main.appendChild(focusToggleWrap);

  // Header
  const header = document.createElement('div');
  header.className = 'today-header';
  header.innerHTML = `<h1> ${today}</h1> <p>${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>`;

  const totalTasksPreview = allTasksData[dateStr]
    ? Object.values(allTasksData[dateStr]).reduce(
        (sum, tasks) => sum + (Array.isArray(tasks) ? tasks.length : 0),
        0
      ) + getRoutineTasksForDate(dateStr).length
    : getRoutineTasksForDate(dateStr).length;

  // Task list container
  const taskList = document.createElement('div');
  taskList.className = 'today-task-list';

  // Buscar tarefas de hoje
  const dayTasks = allTasksData[dateStr] || {};
  const todayPersistedTasks = [];
  let allTasks = [];

  // 1. Rotina diária + recorrentes semanais
  const routineTasks = getRoutineTasksForDate(dateStr);
  routineTasks.forEach((task, routineIndex) => {
    allTasks.push({ task, day: today, dateStr, period: 'Rotina', originalIndex: routineIndex });
  });

  getProjectMirrorEntriesForDate(dateStr, today).forEach((entry) => {
    allTasks.push(entry);
  });

  // 2. Tarefas normais persistidas
  Object.entries(dayTasks).forEach(([period, tasks]) => {
    if (period === 'Rotina') return;
    if (Array.isArray(tasks)) {
      tasks.forEach((task, index) => {
        if (task && typeof task === 'object') {
          allTasks.push({ task, day: today, dateStr, period, originalIndex: index });
          todayPersistedTasks.push(task);
        }
      });
    }
  });

  // Render all tasks (Unified Sort)
  allTasks = unifiedTaskSort(allTasks);

  const actionableEntries = allTasks.filter((entry) => entry.task && !entry.task.isProjectMirror);
  const completedCount = actionableEntries.filter((entry) => entry.task && entry.task.completed).length;
  const pendingEntries = actionableEntries.filter((entry) => entry.task && !entry.task.completed);
  const routinePending = pendingEntries.filter((entry) => entry.period === 'Rotina').length;
  const moneyEntries = pendingEntries.filter((entry) => String(entry.task.priority || '').toLowerCase() === 'money');
  const nextTask = moneyEntries[0] || pendingEntries[0] || null;
  const focusLabel = nextTask ? nextTask.task.text : 'Dia zerado por aqui';
  const progressPct = actionableEntries.length > 0 ? Math.round((completedCount / actionableEntries.length) * 100) : 0;
  const focusModeLabel = moneyEntries.length > 0 ? 'Caixa' : pendingEntries.length > 5 ? 'Ataque' : pendingEntries.length > 0 ? 'Fechamento' : 'Livre';

  if (!focusOnlyMode) {
    const todayHero = document.createElement('div');
    todayHero.className = 'today-hero';
    todayHero.innerHTML = `
      <div class="today-hero-main">
        <div class="today-hero-kicker">Painel de hoje</div>
        <h1>${today}</h1>
        <p>${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <div class="today-hero-pills">
          <span class="today-hero-pill today-hero-pill--accent">Modo ${focusModeLabel}</span>
          <span class="today-hero-pill">Meta 5 concluídas</span>
        </div>
      </div>
      <div class="today-hero-metrics">
        <div class="today-hero-card accent">
          <span class="today-hero-card-label">Planejadas</span>
          <strong class="today-hero-card-value">${totalTasksPreview}</strong>
          <span class="today-hero-card-sub">tarefas mapeadas pro dia</span>
        </div>
        <div class="today-hero-card">
          <span class="today-hero-card-label">Pendentes</span>
          <strong class="today-hero-card-value">${pendingEntries.length}</strong>
          <span class="today-hero-card-sub">${routinePending} de rotina ainda abertas</span>
        </div>
      </div>
    `;
    main.appendChild(todayHero);

    const summaryStrip = document.createElement('div');
    summaryStrip.className = 'today-summary-strip';
    summaryStrip.innerHTML = `
      <div class="today-summary-card primary">
        <span class="today-summary-label">Próxima ação</span>
        <strong class="today-summary-value">${focusLabel}</strong>
        <span class="today-summary-sub">${nextTask ? 'fecha essa antes de abrir outra frente' : 'aproveita pra puxar algo novo com intenção'}</span>
      </div>
      <div class="today-summary-card compact">
        <span class="today-summary-label">Progresso</span>
          <strong class="today-summary-value">${completedCount}/${actionableEntries.length || 0}</strong>
        <span class="today-summary-sub">${progressPct}% concluído</span>
      </div>
      <div class="today-summary-card compact">
        <span class="today-summary-label">Prioridade</span>
        <strong class="today-summary-value">${moneyEntries.length > 0 ? 'Dinheiro' : focusModeLabel}</strong>
        <span class="today-summary-sub">${moneyEntries.length > 0 ? moneyEntries.length + ' tarefa(s) com impacto financeiro' : 'estado operacional do dia'}</span>
      </div>
    `;
    main.appendChild(summaryStrip);
  }

  allTasks.forEach(({ task, day, dateStr, period, originalIndex }) => {
    taskList.appendChild(createTaskElement(day, dateStr, period, task, originalIndex));
  });

  // ===== UNIFIED DROP ZONE (Igual a renderWeek) =====
  // Usa createDropZone com index = allTasks.length para inserir no fim
  const endDropZone = createDropZone(today, dateStr, 'Tarefas', allTasks.length);
  endDropZone.classList.add('flex-grow', 'min-h-[40px]'); // Estilo para ocupar espaço
  endDropZone.innerText = '';

  // Atalho: clique na zona final abre input de nova tarefa
  endDropZone.addEventListener('click', (e) => {
    if (!document.body.classList.contains('dragging-active')) {
      insertQuickTaskInput(taskList, dateStr, 'Tarefas', endDropZone);
    }
  });

  taskList.appendChild(endDropZone);

  main.appendChild(taskList);

  // Empty state
  if (allTasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'today-empty';
    empty.innerHTML = `<p> Nenhuma tarefa para hoje</p> <p>Clique para adicionar uma tarefa</p>`;
    // Inserir empty state DENTRO da taskList ou logo após, mas mantendo a dropzone funcional?
    // Melhor: Se vazio, dropzone já serve. O texto ajuda.
    // Vamos manter o empty state visual, mas o clique nele aciona o input.
    empty.addEventListener('click', () => {
      insertQuickTaskInput(taskList, dateStr, 'Tarefas', endDropZone);
      empty.remove();
    });
    taskList.insertBefore(empty, endDropZone);
  }

  // Clickable area for quick add (Container principal)
  main.style.cursor = 'text';
  main.style.minHeight = '50vh';
  main.addEventListener('click', (e) => {
    // Só acionar se clicar no container vazio ("fundo"), não em elementos interativos
    if (e.target === main || e.target === taskList || e.target.classList.contains('today-main')) {
      insertQuickTaskInput(taskList, dateStr, 'Tarefas', endDropZone);
    }
  });

  grid.appendChild(main);

  if (focusOnlyMode) {
    return;
  }


  // ===== RIGHT: Sidebar stats =====
  const sidebar = document.createElement('div');
  sidebar.className = 'today-sidebar';

  // Calcular stats
  const totalTasks = actionableEntries.length;
  const completedTasks = allTasks.filter((t) => t.task.completed).length;
  const pendingTasks = totalTasks - completedTasks;
  const todayRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Rotina stats
  const routineTotal = routineTasks.length;
  const routineCompleted = routineTasks.filter((t) => t.completed).length;
  const routineRate = routineTotal > 0 ? Math.round((routineCompleted / routineTotal) * 100) : 0;

  const latestCompletionTs = getLatestCompletionTimestamp();
  const lastCompletedTask = latestCompletionTs
    ? { completedAt: new Date(latestCompletionTs).toISOString() }
    : null;
  const lastCompletedText = formatLastCompletionDisplay(latestCompletionTs);

  const durationSamplesMs = todayPersistedTasks
    .filter((t) => t && t.completed && t.createdAt && t.completedAt)
    .map((t) => new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= 0);

  const avgTaskDurationText =
    durationSamplesMs.length > 0
      ? formatElapsedShort(
          Math.round(durationSamplesMs.reduce((sum, ms) => sum + ms, 0) / durationSamplesMs.length)
        )
      : 'Sem dados';

  // Streak
  let streak = 0;
  const checkD = new Date();
  for (let i = 0; i < 60; i++) {
    const cds = localDateStr(checkD);
    const { total: sTotal, completed: sCompleted } = countDayTasks(cds);
    if (sTotal > 0 && sCompleted === sTotal) {
      streak++;
    } else if (i > 0 || (i === 0 && sTotal > 0)) {
      break;
    }
    checkD.setDate(checkD.getDate() - 1);
  }

  // Semana
  const weekDates = getWeekDates(0);
  let weekTotal = 0,
    weekCompleted = 0;
  weekDates.forEach(({ dateStr: wds }) => {
    const { total: wt, completed: wc } = countDayTasks(wds);
    weekTotal += wt;
    weekCompleted += wc;
  });
  const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

  // Ring color
  const ringColor =
    todayRate >= 70
      ? 'var(--accent-green)'
      : todayRate >= 40
        ? 'var(--accent-orange)'
        : todayRate > 0
          ? 'var(--accent-red)'
          : 'rgba(255,255,255,0.1)';
  const ringPct = todayRate;
  const circumference = 2 * Math.PI * 19;
  const dashOffset = circumference - (circumference * ringPct) / 100;

  // Build sidebar HTML
  sidebar.innerHTML = `
    <!--Progresso do dia-->
                
                
                
                
                
                
                
                <div class="stat-section">
                
                
                
                
                
                
                
                    <div class="stat-section-title">Progresso</div>
                
                
                
                
                
                
                
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
                
                
                
                
                
                
                
                        <div class="stat-ring">
                
                
                
                
                
                
                
                            <svg width="48" height="48" viewBox="0 0 48 48">
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                <circle cx="24" cy="24" r="19" fill="none" stroke="${ringColor}" stroke-width="3"
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                    stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                    stroke-linecap="round"/>
                
                
                
                
                
                
                
                            </svg>
                
                
                
                
                
                
                
                            <div class="stat-ring-text">${todayRate}%</div>
                
                
                
                
                
                
                
                        </div>
                
                
                
                
                
                
                
                        <div>
                
                
                
                
                
                
                
                            <div style="font-size: 13px; color: var(--text-secondary);">${completedTasks} de ${totalTasks}</div>
                
                
                
                
                
                
                
                            <div style="font-size: 11px; color: var(--text-tertiary);">tarefas concluídas</div>
                
                
                
                
                
                
                
                        </div>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                    <div class="progress-bar-mini">
                
                
                
                
                
                
                
                        <div class="progress-bar-mini-fill" style="width: ${todayRate}%; background: ${ringColor};"></div>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>

                
                
                
                
                
                
                
                <!--Resumo -->
                
                
                
                
                
                
                
                <div class="stat-section">
                
                
                
                
                
                
                
                    <div class="stat-section-title">Resumo</div>
                
                
                
                
                
                
                
                    <div class="stat-card">
                
                
                
                
                
                
                
                        <span class="stat-label">Pendentes</span>
                
                
                
                
                
                
                
                        <span class="stat-value ${pendingTasks > 0 ? 'orange' : 'green'}">${pendingTasks}</span>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                    <div class="stat-card">
                
                
                
                
                
                
                
                        <span class="stat-label">Rotina</span>
                
                
                
                
                
                
                
                        <span class="stat-value ${routineRate >= 80 ? 'green' : routineRate >= 50 ? 'blue' : ''}">${routineCompleted}/${routineTotal}</span>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                                        <div class="stat-card">
                        <span class="stat-label">Ultima conclusao</span>
                        <span class="stat-value ${lastCompletedTask ? 'blue' : ''}">${lastCompletedText}</span>
                    </div>

                    <div class="stat-card">
                        <span class="stat-label">Media por tarefa</span>
                        <span class="stat-value ${durationSamplesMs.length > 0 ? 'blue' : ''}">${avgTaskDurationText}</span>
                    </div>
<div class="stat-card">
                
                
                
                
                
                
                
                        <span class="stat-label">Streak</span>
                
                
                
                
                
                
                
                        <span class="stat-value ${streak >= 3 ? 'green' : ''}">${streak > 0 ? streak + ' dia' + (streak > 1 ? 's' : '') : '—'}</span>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                    <div class="stat-card">
                
                
                
                
                
                
                
                        <span class="stat-label">Semana</span>
                
                
                
                
                
                
                
                        <span class="stat-value ${weekRate >= 70 ? 'green' : weekRate >= 40 ? 'blue' : ''}">${weekRate}%</span>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>

                
                
                
                
                
                
                
                <!--Mini semana-->
    <div class="stat-section">
        <div class="stat-section-title">Esta semana</div>
        <div style="display: flex; gap: 6px; align-items: flex-end;">
            ${weekDates
              .map(({ name, dateStr: wds }) => {
                const { total: wt, completed: wc } = countDayTasks(wds);

                const pct = wt > 0 ? Math.round((wc / wt) * 100) : 0;

                const isToday = wds === dateStr;

                const barColor =
                  pct >= 80
                    ? 'var(--accent-green)'
                    : pct >= 50
                      ? 'var(--accent-blue)'
                      : pct > 0
                        ? 'var(--accent-orange)'
                        : 'rgba(255,255,255,0.06)';

                const barH = wt > 0 ? Math.max(6, pct * 0.4) : 4;

                return `<div style="flex: 1; text-align: center;">
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                <div style="height: 40px; display: flex; align-items: flex-end; justify-content: center;">
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                    <div style="width: 100%; max-width: 20px; height: ${barH}px; background: ${barColor}; border-radius: 2px; ${isToday ? 'box-shadow: 0 0 6px ' + barColor + ';' : ''}"></div>
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                <div style="font-size: 10px; color: ${isToday ? 'var(--accent-blue)' : 'var(--text-tertiary)'}; margin-top: 4px; font-weight: ${isToday ? '600' : '400'};">${name.slice(0, 3)}</div>
                
                
                
                
                
                
                
                            </div>`;
              })
              .join('')}
        </div>
    </div>
`;

  grid.appendChild(sidebar);
}

// Função unificada para inserção de input de tarefa
function findFirstPendingTask(dateStr = localDateStr()) {
  const dayData = allTasksData[dateStr] || {};
  for (const [period, tasks] of Object.entries(dayData)) {
    if (!Array.isArray(tasks) || period === 'Rotina') continue;
    const index = tasks.findIndex((task) => task && !task.completed);
    if (index >= 0) {
      return { period, index, task: tasks[index] };
    }
  }
  return null;
}

function prioritizeTaskViaSexta(dateStr = localDateStr(), query = '') {
  const cleanQuery = String(query || '').trim().toLowerCase();
  if (!cleanQuery) return false;
  const dayData = allTasksData[dateStr] || {};

  for (const [period, tasks] of Object.entries(dayData)) {
    if (!Array.isArray(tasks) || tasks.length === 0) continue;
    const index = tasks.findIndex((task) => String(task.text || '').toLowerCase().includes(cleanQuery));
    if (index >= 0) {
      const [task] = tasks.splice(index, 1);
      task.completed = false;
      task.completedAt = null;
      tasks.unshift(task);
      tasks.forEach((item, idx) => {
        item.position = idx;
      });
      saveToLocalStorage();
      syncDateToSupabase(dateStr);
      renderView();
      return task;
    }
  }

  return false;
}

function createTaskViaSexta(dateStr, text, period = 'Tarefas') {
  const cleanText = String(text || '').trim();
  if (!cleanText) return false;

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
    timerSessionsCount: 0
  };

  if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
  if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];
  allTasksData[dateStr][period].push(newTask);
  saveToLocalStorage();
  renderView();
  syncTaskToSupabase(dateStr, period, newTask).then((result) => {
    if (!result.success) console.error('[Sexta] Sync falhou:', result.errorText);
    else saveToLocalStorage();
  });
  return true;
}

function normalizeSextaQuery(text = '') {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getSextaSearchEntries(preferredDateStr = localDateStr(), includeCompleted = true) {
  const allDates = Object.keys(allTasksData || {}).sort();
  const orderedDates = [
    preferredDateStr,
    ...allDates.filter((dateStr) => dateStr !== preferredDateStr)
  ];
  const entries = [];

  orderedDates.forEach((dateStr) => {
    const dayData = allTasksData[dateStr] || {};
    Object.entries(dayData).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks) || period === 'Rotina') return;
      tasks.forEach((task, index) => {
        if (!task || !task.text) return;
        if (!includeCompleted && task.completed) return;
        entries.push({ dateStr, period, index, task });
      });
    });
  });

  return entries;
}

function findTaskEntryViaSexta(query, options = {}) {
  const normalizedQuery = normalizeSextaQuery(query);
  if (!normalizedQuery) return null;

  const preferredDateStr = options.preferredDateStr || localDateStr();
  const includeCompleted = options.includeCompleted !== false;
  const entries = getSextaSearchEntries(preferredDateStr, includeCompleted);
  const exactMatch = entries.find(
    (entry) => normalizeSextaQuery(entry.task.text) === normalizedQuery
  );
  if (exactMatch) return exactMatch;

  return (
    entries.find((entry) => normalizeSextaQuery(entry.task.text).includes(normalizedQuery)) || null
  );
}

function getRelativeDateStr(dayOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return localDateStr(date);
}

function deleteTaskViaSexta(query, preferredDateStr = localDateStr()) {
  const entry = findTaskEntryViaSexta(query, { preferredDateStr, includeCompleted: true });
  if (!entry) return null;

  const list = allTasksData[entry.dateStr]?.[entry.period];
  if (!Array.isArray(list)) return null;

  const subtreeTasks = collectTaskSubtree(list, entry.task);
  const subtreeSet = new Set(subtreeTasks);
  allTasksData[entry.dateStr][entry.period] = list.filter((task) => !subtreeSet.has(task));
  allTasksData[entry.dateStr][entry.period].forEach((task, index) => {
    task.position = index;
  });

  if (allTasksData[entry.dateStr][entry.period].length === 0) delete allTasksData[entry.dateStr][entry.period];
  if (Object.keys(allTasksData[entry.dateStr] || {}).length === 0) delete allTasksData[entry.dateStr];

  saveToLocalStorage();
  syncDateToSupabase(entry.dateStr);
  renderView();
  return entry;
}

function completeTaskViaSexta(query, preferredDateStr = localDateStr()) {
  const entry = findTaskEntryViaSexta(query, { preferredDateStr, includeCompleted: false });
  if (!entry) return null;
  window.toggleTaskStatus(entry.dateStr, entry.period, entry.index, true, null);
  return entry;
}

function moveTaskViaSexta(query, targetDateStr, targetPeriod = 'Tarefas', preferredDateStr = localDateStr()) {
  const entry = findTaskEntryViaSexta(query, { preferredDateStr, includeCompleted: true });
  if (!entry) return null;

  const targetList = allTasksData[targetDateStr]?.[targetPeriod] || [];
  const moveResult = moveTaskSubtree({
    sourceDateStr: entry.dateStr,
    sourcePeriod: entry.period,
    sourceIndex: entry.index,
    targetDateStr,
    targetPeriod,
    insertAt: targetList.length
  });

  if (!moveResult.moved) return null;

  saveToLocalStorage();
  (async () => {
    for (const dateStr of moveResult.datesToSync || []) await syncDateToSupabase(dateStr);
  })();
  renderView();
  return entry;
}

function insertQuickTaskInput(container, dateStr, period, beforeElement = null) {
  // Verificar se já existe um input ativo no container
  const existingInput = container.querySelector('.quick-task-input');
  if (existingInput) {
    existingInput.focus();
    return;
  }

  const inputContainer = document.createElement('div');
  inputContainer.className = 'quick-task-container';
  inputContainer.style.padding = '5px 6px';

  // Checkbox placeholder (visual apenas)
  const checkboxPlaceholder = document.createElement('div');
  checkboxPlaceholder.style.width = '16px';
  checkboxPlaceholder.style.height = '16px';
  checkboxPlaceholder.style.borderRadius = '4px';
  checkboxPlaceholder.style.border = '1.5px solid rgba(255,255,255,0.15)';
  checkboxPlaceholder.style.flexShrink = '0';
  checkboxPlaceholder.style.marginTop = '2px';
  inputContainer.appendChild(checkboxPlaceholder);

  // Input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'quick-task-input flex-1';
  input.placeholder = 'Escreva a tarefa...';
  input.autocomplete = 'off';
  input.setAttribute('data-form-type', 'other');
  inputContainer.appendChild(input);

  // Inserção no DOM
  if (beforeElement) {
    container.insertBefore(inputContainer, beforeElement);
  } else {
    container.appendChild(inputContainer);
  }

  input.focus();

  // Handlers
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();

      createTaskViaSexta(dateStr, input.value.trim(), period);
      inputContainer.remove();
    }

    if ((e.key === 'Backspace' || e.key === 'Delete') && input.value.trim() === '') {
      e.preventDefault();
      inputContainer.remove();
    }

    if (e.key === 'Escape') {
      inputContainer.remove();
    }
  });

  input.addEventListener('blur', () => {
    // Pequeno delay para permitir clique em botões se houver
    setTimeout(() => {
      if (document.activeElement !== input && input.value.trim() === '') {
        inputContainer.remove();
      }
    }, 100);
  });
}

function createTaskElement(day, dateStr, period, task, index) {
  const container = document.createElement('div');

  const isRoutineTask = task.isRoutine || task.isRecurring || period === 'Rotina';
  const isProjectMirror = task.isProjectMirror === true;
  const normalizedIndex = Number.isInteger(index) ? index : -1;
  const actionDateStr = isProjectMirror ? task.mirrorSourceDateStr || dateStr : dateStr;
  const actionPeriod = isProjectMirror ? task.mirrorSourcePeriod || period : period;
  const actionIndex = isProjectMirror
    ? Number.isInteger(task.mirrorSourceIndex)
      ? task.mirrorSourceIndex
      : -1
    : normalizedIndex;
  const actionTask = allTasksData?.[actionDateStr]?.[actionPeriod]?.[actionIndex] || task;

  // Top Drop Zone
  if (normalizedIndex >= 0 && !isProjectMirror) {
    container.appendChild(createDropZone(day, dateStr, period, normalizedIndex));
  }

  const el = document.createElement('div');
  el.className = `task-item ${task.isHabit ? 'is-habit' : ''} `;
  el.draggable = normalizedIndex >= 0 && !isProjectMirror;
  el.dataset.day = day;
  el.dataset.date = dateStr;
  el.dataset.period = period;
  el.dataset.index = normalizedIndex;
  if (isProjectMirror) {
    el.classList.add('task-item--project-mirror');
    el.dataset.sourceDate = actionDateStr;
    el.dataset.sourcePeriod = actionPeriod;
    el.dataset.sourceIndex = String(actionIndex);
  }
  if (isRoutineTask) {
    el.dataset.routineKey = getRoutineKey(task);
  }

  // Aplicar indent de árvore hierárquica (Notion-style)
  el.tabIndex = 0; // Make focusable for keyboard events

  if (task.depth && task.depth > 0) {
    el.style.marginLeft = `${task.depth * 28}px`;
    el.style.borderLeft = '2px solid rgba(255,255,255,0.08)';
    el.style.paddingLeft = '12px';
    const fontSize = 16 - task.depth * 1;
    el.style.fontSize = `${fontSize}px`;
    el.style.opacity = '0.9';
  } else if (task.indent && task.indent > 0) {
    // Fallback legado
    el.style.paddingLeft = `${task.indent * 24}px`;
  }

  el.onkeydown = (e) => {
    if (isProjectMirror) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.handleTaskIndent === 'function') {
        window.handleTaskIndent(dateStr, period, index, e.shiftKey);
      }
    }
  };

  const childrenCount = isProjectMirror
    ? Number(task.renderChildrenCount || 0)
    : normalizedIndex >= 0
      ? getTaskChildrenCount(dateStr, period, task)
      : 0;
  const hasChildren = childrenCount > 0;
  const isCollapsed = hasChildren ? isTaskGroupCollapsed(task) : false;

  let collapseBtn = null;
  if (hasChildren) {
    collapseBtn = document.createElement('button');
    collapseBtn.className = 'task-collapse-btn';
    collapseBtn.type = 'button';
    collapseBtn.innerHTML = `${isCollapsed ? '▶' : '▼'} <span>${childrenCount}</span>`;
    collapseBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isProjectMirror) {
        window.toggleTaskTreeCollapse(task);
        return;
      }
      window.toggleTaskChildrenCollapse(dateStr, period, normalizedIndex);
    };
  }

  if (task.isProjectAnchor) {
    el.classList.add('task-item--project-anchor');
    el.draggable = false;
    el.dataset.projectId = task.projectId || '';
    el.dataset.sourceDate = actionDateStr;
    el.dataset.sourcePeriod = actionPeriod;
    el.dataset.sourceIndex = String(actionIndex);
    el.title = 'Abrir tarefa do projeto';

    const anchorCheckbox = document.createElement('span');
    anchorCheckbox.className = 'task-project-anchor-checkbox';
    el.appendChild(anchorCheckbox);

    const anchorBody = document.createElement('div');
    anchorBody.className = 'task-project-anchor-body';
    anchorBody.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.toggleTaskExpansion(actionTask, el);
    };

    const anchorTitle = document.createElement('span');
    anchorTitle.className = 'task-project-anchor-title';
    anchorTitle.textContent = task.text || 'Projeto';
    anchorBody.appendChild(anchorTitle);

    const anchorMetaParts = [
      task.projectName && task.projectName !== task.text ? `em ${task.projectName}` : null,
      task.projectScheduleText || null
    ].filter(Boolean);

    if (anchorMetaParts.length > 0) {
      const anchorMeta = document.createElement('div');
      anchorMeta.className = 'task-project-anchor-meta';
      anchorMeta.textContent = anchorMetaParts.join(' • ');
      anchorBody.appendChild(anchorMeta);
    }

    el.appendChild(anchorBody);
    if (collapseBtn) {
      collapseBtn.style.marginLeft = 'auto';
      el.appendChild(collapseBtn);
    }
    container.appendChild(el);
    return container;
  }

  // Label (criado primeiro para ser referenciado pelos callbacks)
  // Label (criado primeiro para ser referenciado pelos callbacks)
  const label = document.createElement('span');
  // Removemos task-completed daqui para não afetar todos os filhos
  label.className = `task-label color-${task.color || 'default'}`;
  // Aplicar cor azul se for tarefa de rotina
  if (task.isRoutine || task.isRecurring || period === 'Rotina') {
    label.style.color = 'var(--accent-blue)';
  }

  // Cor da DIFICULDADE (Prioridade) - sobrepõe rotina se existir
  if (task.priority && task.priority !== 'none' && task.priority !== 'null') {
    const customPrio = getTaskPriorities().find((p) => p.id === task.priority);
    if (customPrio) {
      label.style.color = customPrio.color;
    }
  }

  // Normalizar texto da tarefa (garantir que não seja undefined)
  if (task.text === undefined || task.text === null) {
    task.text = '';
  }

  // Se a tarefa está vazia, mostrar placeholder
  // Modificação da Estrutura para separar Texto (line-through) do Horário (sem line-through)
  const textContentSpan = document.createElement('span');
  textContentSpan.className = 'task-content-span';

  if (task.text.trim() === '') {
    label.textContent = '';
    label.style.color = '#666';
    label.setAttribute('data-placeholder', 'Clique para editar...');
    label.style.position = 'relative';
  } else {
    textContentSpan.textContent = task.text;
    if (task.completed) {
      textContentSpan.classList.add('task-completed');
    }
    label.appendChild(textContentSpan);
  }

  // Single Click Toggle Expansion
  label.onclick = (e) => {
    e.preventDefault();
    window.toggleTaskExpansion(actionTask, el);
  };

  // Make element flex and handle alignment
  el.style.display = 'flex';
  el.style.alignItems = 'center';

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'checkbox-custom';
  checkbox.checked = task.completed;
  if (isProjectMirror) {
    checkbox.disabled = true;
    checkbox.tabIndex = -1;
  }
  checkbox.onchange = (e) => {
    if (isProjectMirror) return;
    if (e.target.checked && task.timerStartedAt) {
      stopTaskTimer(task);
    }
    task.completed = e.target.checked;
    if (!task.createdAt) task.createdAt = new Date().toISOString();
    if (task.completed && navigator.vibrate) {
      const vs = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
      if (vs.haptics !== false) navigator.vibrate(15);
    }

    // Atualiza visualmente o span de texto interno
    const innerText = label.querySelector('.task-content-span');
    if (innerText) {
      innerText.classList.toggle('task-completed', task.completed);
    }

    // Se for rotina ou habito, usar a função centralizada que sincroniza com Supabase
    if (task.isRoutine || task.isRecurring || task.isHabit || period === 'Rotina') {
      if (task.completed) {
        task.completedAt = new Date().toISOString();
      } else {
        task.completedAt = null;
      }

      // Usa a função global que já lida com habitsHistory + localStorage + Supabase
      // IMPORTANTE: Passar dateStr para marcar no dia CORRETO, não apenas hoje
      if (typeof markHabitCompleted === 'function') {
        markHabitCompleted(task.text, task.completed, dateStr);
      }
    } else {
      // Apenas salvar se for tarefa comum
      // USAR NOVO TOGGLE HANDLER para reordenar array
      window.toggleTaskStatus(dateStr, period, index, task.completed, el);
      // Nota: toggleTaskStatus já chama saveToLocalStorage e renderView
    }
  };
  el.appendChild(checkbox);

  // Horário de Conclusão — mostrar pra TODAS as tarefas concluídas (incluindo rotinas)
  if (
    (currentView === 'today' || currentView === 'week') &&
    task.completed &&
    task.text.trim() !== ''
  ) {
    const timeSource =
      task.completedAt ||
      (task.isHabit && habitsHistory[task.text] && habitsHistory[task.text][dateStr]) ||
      null;
    if (timeSource && typeof timeSource === 'string') {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'task-time';
      timeSpan.textContent = ' · ' + formatTaskTime(timeSource);
      timeSpan.style.cssText =
        'font-size:11px;color:var(--text-tertiary);margin-left:6px;font-weight:normal;text-decoration:none;opacity:0.6;white-space:nowrap;';
      label.appendChild(timeSpan);
    }
  }

  if (task.projectName) {
    const projectMeta = document.createElement('span');
    projectMeta.className = 'task-project-meta';
    projectMeta.textContent = ` em ${task.projectName}`;
    label.appendChild(projectMeta);
  }

  const trackedTimeMs = getTaskTimerTotalMs(task);
  if (trackedTimeMs > 0 || task.timerStartedAt) {
    const timerMeta = document.createElement('span');
    timerMeta.className = `task-timer-meta${task.timerStartedAt ? ' is-running' : ''}`;
    timerMeta.textContent = ` · ${formatDurationClock(trackedTimeMs)}`;
    timerMeta.dataset.liveTimer = '1';
    timerMeta.dataset.sourceDate = actionDateStr;
    timerMeta.dataset.sourcePeriod = actionPeriod;
    timerMeta.dataset.sourceIndex = String(actionIndex);
    label.appendChild(timerMeta);
  }

  el.appendChild(label);
  if (collapseBtn) {
    collapseBtn.style.marginLeft = 'auto';
    el.appendChild(collapseBtn);
  }

  // Drag Events
  el.ondragstart = handleDragStart;
  el.ondragend = handleDragEnd;

  container.appendChild(el);
  return container;
}

function createDropZone(day, dateStr, period, index) {
  const dz = document.createElement('div');
  dz.className = 'task-drop-zone';
  dz.dataset.day = day;
  dz.dataset.date = dateStr;
  dz.dataset.period = period;
  dz.dataset.insertAt = index;

  dz.ondragover = (e) => {
    e.preventDefault();
    dz.classList.add('show');

    const rect = dz.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;

    if (offsetX > 40) {
      dz.style.marginLeft = '28px';
      dz.dataset.indentIntent = 'true';
      dz.dataset.outdentIntent = 'false';
      dz.style.borderLeft = '2px solid rgba(255,255,255,0.2)';
      dz.style.paddingLeft = '8px';
    } else if (offsetX < 10) {
      dz.style.marginLeft = '0px';
      dz.dataset.outdentIntent = 'true';
      dz.dataset.indentIntent = 'false';
      dz.style.borderLeft = 'none';
      dz.style.paddingLeft = '0px';
    } else {
      dz.style.marginLeft = '0px';
      dz.dataset.indentIntent = 'false';
      dz.dataset.outdentIntent = 'false';
      dz.style.borderLeft = 'none';
      dz.style.paddingLeft = '0px';
    }
  };
  dz.ondragleave = () => {
    dz.classList.remove('show');
    dz.style.marginLeft = '0px';
    dz.style.borderLeft = 'none';
    dz.style.paddingLeft = '0px';
  };
  dz.ondrop = (e) => handleDropZoneDrop(e, dz);
  return dz;
}

// --- Editing Logic ---

function startEditing(label, task, taskDiv) {
  if (currentEditingTask) finishEditing();
  currentEditingTask = { label, task, original: task.text };

  label.contentEditable = true;
  label.focus();
  taskDiv.draggable = false;

  // Select all text
  const range = document.createRange();
  range.selectNodeContents(label);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  label.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEditing();
    }
    if (e.key === 'Escape') {
      label.textContent = currentEditingTask.original;
      finishEditing();
    }
    // Delete ou Backspace em tarefa vazia = deletar a tarefa
    if ((e.key === 'Backspace' || e.key === 'Delete') && label.textContent.trim() === '') {
      e.preventDefault();
      label.textContent = ''; // Garantir que está vazio
      finishEditing(); // Vai deletar a tarefa automaticamente
    }
    // TAB para indent (estilo Notion)
    if (e.key === 'Tab') {
      e.preventDefault();
      const taskItem = label.closest('.task-item');
      const currentIndent = parseInt(task.indent || 0);

      if (e.shiftKey) {
        // Shift+Tab = desindentar
        if (currentIndent > 0) {
          task.indent = currentIndent - 1;
          taskItem.style.paddingLeft = `${task.indent * 24} px`;
        }
      } else {
        // Tab = indentar
        if (currentIndent < 3) {
          // Máximo 3 níveis
          task.indent = currentIndent + 1;
          taskItem.style.paddingLeft = `${task.indent * 24} px`;
        }
      }

      saveToLocalStorage();
    }
  };
  label.onblur = finishEditing;
}

async function finishEditing() {
  if (!currentEditingTask) return;
  const { label, task } = currentEditingTask;
  const newText = label.textContent.trim();

  // Se a tarefa ficou vazia, deletar
  if (!newText || newText === '') {
    const taskElement = label.closest('.task-item');
    const dateStr = taskElement.dataset.date;
    const period = taskElement.dataset.period;
    const index = parseInt(taskElement.dataset.index);

    if (allTasksData[dateStr] && allTasksData[dateStr][period]) {
      const taskToDelete = allTasksData[dateStr][period][index] || task;

      // OPTIMISTIC DELETE: splice first, render, then fire Supabase in background
      const localIdx = allTasksData[dateStr][period].findIndex(
        (t) =>
          (taskToDelete.supabaseId && t.supabaseId === taskToDelete.supabaseId) ||
          t.text === taskToDelete.text
      );
      if (localIdx >= 0) allTasksData[dateStr][period].splice(localIdx, 1);

      if (allTasksData[dateStr][period].length === 0) delete allTasksData[dateStr][period];
      if (Object.keys(allTasksData[dateStr] || {}).length === 0) delete allTasksData[dateStr];

      localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
      currentEditingTask = null;
      renderView();

      // Fire backend DELETE non-blocking
      deleteTaskFromSupabase(taskToDelete, dateStr, period).catch((err) =>
        console.error('[Delete/finishEditing] Background sync error:', err)
      );
      return;
    }

    currentEditingTask = null;
    renderView();
    return;
  }

  // Tarefa tem texto, salvar normalmente
  task.text = newText;
  label.contentEditable = false;
  label.closest('.task-item').draggable = true;

  // Remover placeholder se tinha
  if (label.hasAttribute('data-placeholder')) {
    label.removeAttribute('data-placeholder');
    label.style.color = '';
  }

  saveToLocalStorage();
  currentEditingTask = null;
}

function showTaskInput(btn, day, period) {
  const input = document.createElement('input');
  input.className = 'task-input';
  input.placeholder = 'Nova tarefa...';
  btn.replaceWith(input);
  input.focus();

  const save = () => {
    if (input.value.trim()) {
      if (!weekData[day][period]) weekData[day][period] = [];
      weekData[day][period].push({
        text: input.value.trim(),
        completed: false,
        color: 'default',
        isHabit: false
      });
      saveToLocalStorage();
    }
    renderView();
  };

  input.onkeydown = (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') renderView();
  };
  input.onblur = () => setTimeout(save, 100);
}

// --- Drag & Drop Handlers ---

function handleDragStart(e) {
  const period = this.dataset.period;
  const dateStr = this.dataset.date;
  const index = parseInt(this.dataset.index);
  const routineKey = this.dataset.routineKey || null;

  if (period === 'Rotina' || routineKey) {
    draggedTask = {
      day: this.dataset.day,
      dateStr,
      period,
      index,
      routineKey,
      isRoutineDrag: true,
      task: { text: this.querySelector('.task-content-span')?.textContent || '' }
    };

    document.body.classList.add('dragging-active');
    setTimeout(() => this.classList.add('opacity-50'), 0);
    return;
  }

  // Usar allTasksData para buscar a tarefa
  const dayData = allTasksData[dateStr] || {};
  const task = (dayData[period] || [])[index];
  if (!task) {
    e.preventDefault();
    return;
  }

  draggedTask = {
    day: this.dataset.day,
    dateStr: dateStr,
    period: period,
    index: index,
    isRoutineDrag: false,
    task: task
  };

  document.body.classList.add('dragging-active');
  setTimeout(() => this.classList.add('opacity-50'), 0);
}

function handleDragEnd(e) {
  document.body.classList.remove('dragging-active');
  this.classList.remove('opacity-50');
  document.querySelectorAll('.day-column').forEach((c) => c.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDropZoneDrop(e, dz) {
  e.stopPropagation();
  dz.classList.remove('show');
  if (!draggedTask) return;

  const indentIntent = dz.dataset.indentIntent === 'true';
  const outdentIntent = dz.dataset.outdentIntent === 'true';

  const targetDateStr = dz.dataset.date;
  const targetPeriod = dz.dataset.period;
  let insertAt = parseInt(dz.dataset.insertAt);

  const sourceDateStr = draggedTask.dateStr;
  const sourcePeriod = draggedTask.period;
  const sourceIndex = draggedTask.index;

  if (draggedTask.isRoutineDrag) {
    if (targetPeriod !== 'Rotina') {
      draggedTask = null;
      renderView();
      return;
    }

    const routineKey = draggedTask.routineKey || getRoutineKey(draggedTask.task);
    const movedOnTarget = reorderRoutineTasksForDate(targetDateStr, routineKey, insertAt);
    if (!movedOnTarget) {
      reorderRoutineTasksForDate(sourceDateStr, routineKey, insertAt);
    }

    draggedTask = null;
    renderView();
    return;
  }

  const moveResult = moveTaskSubtree({
    sourceDateStr,
    sourcePeriod,
    sourceIndex,
    targetDateStr,
    targetPeriod,
    insertAt,
    indentIntent,
    outdentIntent
  });

  if (moveResult.moved) {
    saveToLocalStorage();
    (async () => {
      for (const d of moveResult.datesToSync || []) await syncDateToSupabase(d);
    })();
  }

  renderView();
  draggedTask = null;
}

// Sincroniza todas as tarefas de uma data via Upsert seguro para preservar parent_id
async function syncDateToSupabase(dateStr) {
  if (!currentUser) return;
  markLocalSupabaseMutation(2400);
  _isSyncingDate = true;

  try {
    const periods = allTasksData[dateStr] || {};
    const updates = [];
    const inserts = [];

    const { data: remoteRows, error: remoteError } = await supabaseClient
      .from('tasks')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('day', dateStr);

    if (remoteError) {
      throw remoteError;
    }

    Object.entries(periods).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks)) return;

      tasks.forEach((task, index) => {
        if (!task.text || task.text.trim() === '') return;
        if (task.isWeeklyRecurring || task.isRoutine || task.isRecurring) return;

        const payload = {
          user_id: currentUser.id,
          day: dateStr,
          period,
          text: task.text,
          completed: task.completed || false,
          color: task.color || 'default',
          type: task.type || 'OPERATIONAL',
          priority: task.priority || null,
          parent_id: task.parent_id || null,
          project_id: task.projectId || null,
          project_name: task.projectName || null,
          position: typeof task.position === 'number' ? task.position : index,
          is_habit: task.isHabit || false,
          created_at: task.createdAt || undefined,
          completed_at: task.completed ? task.completedAt || undefined : null,
          timer_total_ms: Math.max(0, Number(task.timerTotalMs || 0) || 0),
          timer_started_at: task.timerStartedAt || null,
          timer_last_stopped_at: task.timerLastStoppedAt || null,
          timer_sessions_count: Math.max(0, Math.floor(Number(task.timerSessionsCount || 0) || 0)),
          updated_at: new Date().toISOString()
        };

        if (task.supabaseId && task.supabaseId.indexOf('-') > -1) {
          payload.id = task.supabaseId;
          updates.push(payload);
        } else {
          inserts.push({ taskRef: task, payload });
        }
      });
    });

    if (updates.length > 0) {
      await supabaseClient.from('tasks').upsert(updates, { onConflict: 'id' });
    }

    if (inserts.length > 0) {
      const payloadsToInsert = inserts.map((i) => i.payload);
      const { data, error } = await supabaseClient.from('tasks').insert(payloadsToInsert).select();

      if (error) {
        throw error;
      }

      if (Array.isArray(data) && data.length > 0) {
        const usedLocalIdx = new Set();

        data.forEach((row) => {
          const rowPos = typeof row.position === 'number' ? row.position : null;
          const localIdx = inserts.findIndex((item, idx) => {
            if (usedLocalIdx.has(idx)) return false;

            const sameParent = (item.payload.parent_id || null) === (row.parent_id || null);
            const samePosition = rowPos === null || item.payload.position === rowPos;

            return (
              item.payload.text === row.text &&
              item.payload.period === row.period &&
              sameParent &&
              samePosition
            );
          });

          if (localIdx >= 0) {
            inserts[localIdx].taskRef.supabaseId = row.id;
            usedLocalIdx.add(localIdx);
          }
        });
      }
    }

    const localIds = new Set();
    Object.values(periods).forEach((tasks) => {
      if (!Array.isArray(tasks)) return;

      tasks.forEach((task) => {
        if (!task || !task.supabaseId || task.supabaseId.indexOf('-') === -1) return;
        localIds.add(task.supabaseId);
      });
    });

    const staleIds = (remoteRows || [])
      .map((row) => row.id)
      .filter((id) => id && !localIds.has(id));

    if (staleIds.length > 0) {
      await supabaseClient.from('tasks').delete().in('id', staleIds);
    }

    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
  } catch (e) {
    console.error('Error syncing date:', e);
  } finally {
    _isSyncingDate = false;
  }
}
// --- Menus ---
function showEditToolbar(e, task, label) {
  const toolbar = document.getElementById('editToolbar');
  toolbar.style.left = e.pageX + 'px';
  toolbar.style.top = e.pageY + 'px';
  toolbar.classList.add('show');

  // Setup buttons (simplified)
  toolbar.querySelector('[data-action="color"]').onclick = (ev) => {
    ev.stopPropagation();
    showColorMenu(ev, task, label);
  };
  toolbar.querySelector('[data-action="habit"]').onclick = () => {
    task.isHabit = !task.isHabit;

    if (task.isHabit) {
      const alreadyInRecurring = allRecurringTasks.some((t) => t.text === task.text);
      if (!alreadyInRecurring) {
        allRecurringTasks.push({
          text: task.text,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          priority: task.priority || 'none',
          color: task.color || 'default',
          isHabit: true,
          createdAt: new Date().toISOString()
        });
      }
      alert(`"${task.text}" marcado como hábito e adicionado à Rotina!`);
    } else {
      const recurringIdx2 = allRecurringTasks.findIndex((t) => t.text === task.text);
      if (recurringIdx2 !== -1) allRecurringTasks.splice(recurringIdx2, 1);
      alert(`"${task.text}" removido dos hábitos e da Rotina.`);
    }

    saveToLocalStorage();
    syncRecurringTasksToSupabase();
    renderView();
    toolbar.classList.remove('show');
  };
  toolbar.querySelector('[data-action="delete"]').onclick = async () => {
    // Delete logic
    const taskElement = label.closest('.task-item');
    const dateStr = taskElement.dataset.date;
    const period = taskElement.dataset.period;
    const index = parseInt(taskElement.dataset.index);

    // Buscar a tarefa
    if (!allTasksData[dateStr] || !allTasksData[dateStr][period]) return;
    const taskToDelete = allTasksData[dateStr][period][index] || task;

    // OPTIMISTIC DELETE: remove from local state and render immediately,
    // then fire Supabase DELETE in the background (non-blocking)
    const localIdx = allTasksData[dateStr][period].findIndex(
      (t) =>
        (taskToDelete.supabaseId && t.supabaseId === taskToDelete.supabaseId) ||
        t.text === taskToDelete.text
    );
    if (localIdx >= 0) allTasksData[dateStr][period].splice(localIdx, 1);

    if (allTasksData[dateStr][period].length === 0) delete allTasksData[dateStr][period];
    if (Object.keys(allTasksData[dateStr] || {}).length === 0) delete allTasksData[dateStr];

    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
    renderView();

    deleteTaskFromSupabase(taskToDelete, dateStr, period).catch((err) =>
      console.error('[Delete/editToolbar] Background sync error:', err)
    );
  };
}

function showColorMenu(e, task, label) {
  const menu = document.getElementById('colorMenu');
  const rect = document.getElementById('editToolbar').getBoundingClientRect();
  // Fix positioning (scroll aware)
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
  const scrollTop = window.scrollY || document.documentElement.scrollTop;

  menu.style.left = rect.left + scrollLeft + 'px';
  menu.style.top = rect.bottom + scrollTop + 8 + 'px';
  menu.classList.add('show');

  menu.querySelectorAll('.color-swatch').forEach((s) => {
    s.onclick = () => {
      const color = s.dataset.color;
      task.color = color;
      saveToLocalStorage();
      renderView();
    };
  });
}

// --- Init ---
document.addEventListener('click', (e) => {
  if (!e.target.closest('#editToolbar') && !e.target.closest('#colorMenu')) {
    document.getElementById('editToolbar').classList.remove('show');
    document.getElementById('colorMenu').classList.remove('show');
  }
  const userDropdown = document.getElementById('userDropdown');
  if (userDropdown && !e.target.closest('#userDropdown') && !e.target.closest('#btnUser')) {
    userDropdown.classList.remove('show');
  }
});

const btnUserEl = document.getElementById('btnUser');
if (btnUserEl) {
  btnUserEl.onclick = () => {
    const drop = document.getElementById('userDropdown');
    if (!drop) return;
    drop.style.display = drop.style.display === 'flex' ? 'none' : 'flex';
  };
}

const btnLogoutEl = document.getElementById('btnLogout');
if (btnLogoutEl) {
  btnLogoutEl.onclick = signOut;
}

// Event listeners para opÇÕES do quick add menu
document.querySelectorAll('.quick-add-option').forEach((option) => {
  option.onclick = async () => {
    const type = option.dataset.type;
    document.getElementById('quickAddMenu').style.display = 'none';

    if (type === 'routine') {
      const text = prompt('Digite a tarefa de rotina diária:');
      if (text && text.trim()) {
        allRecurringTasks.push({
          text: text.trim(),
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          priority: null,
          color: 'default',
          type: 'OPERATIONAL',
          isHabit: true,
          createdAt: new Date().toISOString()
        });
        saveToLocalStorage();
        syncRecurringTasksToSupabase();
        renderView();
      }
    } else if (type === 'weekly') {
      showWeeklyRecurrenceDialog();
    } else if (type === 'custom') {
      // Abre um prompt para tarefa customizada (ex: adicionar em data específica)
      const text = prompt('Digite a tarefa:');
      if (text && text.trim()) {
        const dateStr = localDateStr();
        const period = 'Tarefas';

        if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
        if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];

        const currentList = allTasksData[dateStr]?.[period] || [];
        const newTask = {
          text: text.trim(),
          completed: false,
          color: 'default',
          type: 'OPERATIONAL',
          priority: null,
          parent_id: null,
          position: currentList.length,
          isHabit: false,
          supabaseId: null,
          timerTotalMs: 0,
          timerStartedAt: null,
          timerLastStoppedAt: null,
          timerSessionsCount: 0
        };

        if (!allTasksData[dateStr]) allTasksData[dateStr] = {};
        if (!allTasksData[dateStr][period]) allTasksData[dateStr][period] = [];
        allTasksData[dateStr][period].push(newTask);
        saveToLocalStorage();
        renderView();
        syncTaskToSupabase(dateStr, period, newTask).then((r) => {
          if (r.success) saveToLocalStorage();
        });
      }
    }
  };
});

// Event listeners do modal de tarefa semanal
bindWeeklyDayButtons();

// Listeners do modal semanal — só vinculam se os elementos existirem no HTML
// (podem ser gerados dinamicamente via renderSettingsView, portanto usamos delegação)
document.addEventListener('keydown', (e) => {
  const weeklyModal = document.getElementById('weeklyModal');
  if (!weeklyModal || !weeklyModal.classList.contains('show')) return;
  const weeklyTaskText = document.getElementById('weeklyTaskText');
  if (!weeklyTaskText) return;
  if (document.activeElement === weeklyTaskText) {
    if (e.key === 'Enter') {
      const btnSave = document.getElementById('btnSaveWeekly');
      if (btnSave) btnSave.click();
    }
    if (e.key === 'Escape') {
      const btnCancel = document.getElementById('btnCancelWeekly');
      if (btnCancel) btnCancel.click();
    }
  }
});

// Handlers de export/import/clear estão dentro de renderSettingsView()

// Normalizar tarefas (corrigir text: undefined e remover recorrentes/rotina persistidas)
function normalizeAllTasks() {
  let hasChanges = false;
  const recurringTextsSet = new Set(allRecurringTasks.map((rt) => rt.text));

  Object.entries(allTasksData).forEach(([dateStr, periods]) => {
    // Remover completamente o período 'Rotina' se existir (nunca deve ser persistido)
    if (periods['Rotina']) {
      delete periods['Rotina'];
      hasChanges = true;
    }
    // Remover flag de hidratação antiga (não mais utilizado)
    if (periods._routineHydrated) {
      delete periods._routineHydrated;
      hasChanges = true;
    }

    Object.entries(periods).forEach(([period, tasks]) => {
      if (Array.isArray(tasks)) {
        // Normalizar: remover APENAS se for flag antiga explícita
        const filtered = tasks.filter((task) => {
          // Remover tarefas que são marcadas explicitamente como legado de recorrência
          if (task.isWeeklyRecurring || task.isRoutine || task.isRecurring) return false;

          // NÃO remover apenas pelo texto. Isso causava sumiço de tarefas manuais duplicadas.
          // if (task.text && recurringTextsSet.has(task.text)) return false;

          return true;
        });
        if (filtered.length !== tasks.length) {
          allTasksData[dateStr][period] = filtered;
          hasChanges = true;
        }
        allTasksData[dateStr][period].forEach((task) => {
          if (task.text === undefined || task.text === null) {
            task.text = '';
            hasChanges = true;
          }
          if (normalizeTaskTimerData(task)) {
            hasChanges = true;
          }
        });
        // Limpar período vazio
        if (allTasksData[dateStr][period].length === 0) {
          delete allTasksData[dateStr][period];
          hasChanges = true;
        }
      }
    });
    // Limpar data vazia
    if (Object.keys(allTasksData[dateStr] || {}).length === 0) {
      delete allTasksData[dateStr];
      hasChanges = true;
    }
  });

  if (hasChanges) {
    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
    debugLog('Banco normalizado e limpo de artefatos legados.');
    if (document.getElementById('btnFixDuplicates'))
      alert('Banco corrigido com sucesso! Tarefas legadas removidas.');
  } else {
    if (document.getElementById('btnFixDuplicates')) alert('Nenhum problema encontrado no banco.');
  }
}

// Handler do botão Corrigir Banco (garantir que existe)
document.addEventListener('click', (e) => {
  if (e.target.closest('#btnFixDuplicates')) {
    if (
      confirm(
        'Isso irá limpar vestígios de tarefas antigas (legado) para evitar duplicações visuais. Suas tarefas recorrentes configuradas NÃO serão afetadas.\n\nDeseja continuar?'
      )
    ) {
      normalizeAllTasks();
      renderView();
    }
  }
});

loadFromLocalStorage();
normalizeAllTasks(); // Normalizar tarefas antigas
// checkAuth agora é chamado via onAuthStateChange (INITIAL_SESSION)
// setTimeout(checkAuth, 100);

// Inicializar ícones Lucide
if (window.lucide) {
  lucide.createIcons();
}
renderSyncStatus();

const flowlyAuthSessionFactory = window.FlowlyAuthSession;
if (flowlyAuthSessionFactory) {
  authSession = flowlyAuthSessionFactory.create({
    supabaseClient,
    debugLog,
    setCurrentUser: (user) => {
      currentUser = user;
    },
    getCurrentUser: () => currentUser,
    onSessionDataRequired: async () => {
      await loadDataFromSupabase();
      await syncUnsyncedTasksToSupabase();
      renderView();
    },
    onSignedOut: () => {
      location.reload();
    },
    migrateLocalDataToSupabase
  });

  authSession.init(() => !allTasksData || Object.keys(allTasksData).length === 0);
}

window.addEventListener('online', () => {
  setSyncStatus('syncing', 'Conexao restabelecida. Sincronizando...');
  scheduleUnsyncedTasksSync(300);
});

window.addEventListener('offline', () => {
  // Reset busyCount so finishSyncActivity won't block status transition when coming back online
  syncStatus.busyCount = 0;
  setSyncStatus('offline', 'Sem conexao. Salvando no dispositivo');
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleUnsyncedTasksSync(500);
});

setInterval(() => {
  if (document.hidden) return;
  scheduleUnsyncedTasksSync(0);
}, 15000);

setInterval(() => {
  if (document.hidden) return;
  refreshInlineTaskTimers();
}, 1000);
// ========================================
// PWA - Service Worker & Notificacoes
// ========================================

const flowlyPwa = window.FlowlyPwa
  ? window.FlowlyPwa.create({
      supabaseClient,
      getCurrentUser: () => currentUser,
      debugLog
    })
  : null;

if (flowlyPwa) {
  flowlyPwa.initServiceWorker();
}

async function saveNotifSettingsToSupabase() {
  if (!flowlyPwa) return;
  await flowlyPwa.saveNotifSettingsToSupabase();
}

async function requestNotificationPermission() {
  if (!flowlyPwa) return { ok: false, reason: 'unavailable' };
  return flowlyPwa.requestNotificationPermission();
}

async function sendTestNotification() {
  if (!flowlyPwa) return { ok: false, reason: 'unavailable' };
  return flowlyPwa.sendTestNotification();
}

// Enviar notificacao de progresso
// Função helper para contar tarefas do dia (exclui rotinas persistidas)
function countDayTasks(dateStr) {
  if (analyticsService) {
    const metrics = analyticsService.getDailyCompletion(dateStr);
    return { total: metrics.total, completed: metrics.completed };
  }

  const dayData = allTasksData[dateStr] || {};
  let total = 0,
    completed = 0;

  Object.entries(dayData).forEach(([period, tasks]) => {
    if (period === 'Rotina') return;
    if (Array.isArray(tasks)) {
      total += tasks.length;
      completed += tasks.filter((t) => t.completed).length;
    }
  });

  const routine = getRoutineTasksForDate(dateStr);
  total += routine.length;
  completed += routine.filter((t) => t.completed).length;

  return { total, completed };
}

function getDailyNotificationSnapshot(dateStr = localDateStr()) {
  const { total, completed } = countDayTasks(dateStr);
  const dayData = allTasksData[dateStr] || {};
  const periodDone = {};
  const durationSamplesMs = [];

  Object.entries(dayData).forEach(([period, tasks]) => {
    if (!Array.isArray(tasks)) return;
    tasks.forEach((task) => {
      if (!task || !task.completed) return;
      periodDone[period] = (periodDone[period] || 0) + 1;

      if (task.createdAt && task.completedAt) {
        const diff = new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime();
        if (Number.isFinite(diff) && diff >= 0 && diff <= 24 * 60 * 60 * 1000) {
          durationSamplesMs.push(diff);
        }
      }
    });
  });

  const bestPeriodEntry = Object.entries(periodDone).sort((a, b) => b[1] - a[1])[0];
  const totalTaskDurationMs = durationSamplesMs.reduce((sum, ms) => sum + ms, 0);
  const avgTaskDurationMs =
    durationSamplesMs.length > 0 ? Math.round(totalTaskDurationMs / durationSamplesMs.length) : 0;

  const routine = getRoutineTasksForDate(dateStr);
  const routineTotal = routine.length;
  const routineCompleted = routine.filter((task) => task && task.completed).length;

  return {
    dateStr,
    total,
    completed,
    pending: Math.max(0, total - completed),
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    avgTaskDurationMs,
    totalTaskDurationMs,
    bestPeriod: bestPeriodEntry ? bestPeriodEntry[0] : null,
    routineTotal,
    routineCompleted
  };
}

function renderNotifTemplate(template, snapshot) {
  if (typeof template !== 'string' || template.trim().length === 0) return '';
  const values = {
    completed: snapshot.completed,
    total: snapshot.total,
    pending: snapshot.pending,
    percentage: snapshot.percentage,
    avgDuration: formatElapsedShort(snapshot.avgTaskDurationMs || 0),
    totalDuration: formatElapsedShort(snapshot.totalTaskDurationMs || 0),
    bestPeriod: snapshot.bestPeriod || 'sem destaque'
  };

  return template.replace(/\{([a-zA-Z]+)\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : '';
  });
}

function getProgressNotificationState() {
  try {
    return JSON.parse(localStorage.getItem('flowly_progress_notif_state') || '{}');
  } catch (e) {
    return {};
  }
}

function setProgressNotificationState(state) {
  localStorage.setItem('flowly_progress_notif_state', JSON.stringify(state || {}));
}

function sendProgressNotification() {
  if (!flowlyPwa) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notifSettings = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
  if (notifSettings.enabled !== true) return;
  if (notifSettings.progressEnabled === false) return;

  const snapshot = getDailyNotificationSnapshot(localDateStr());
  if (snapshot.total <= 0 || snapshot.completed <= 0) return;

  const state = getProgressNotificationState();
  const currentDay = snapshot.dateStr;
  const prev = state[currentDay] || { completed: 0, total: 0 };
  if (snapshot.completed <= prev.completed) return;

  const body = renderNotifTemplate(
    notifSettings.progressTemplate || 'Estamos no caminho, {completed}/{total}',
    snapshot
  );

  flowlyPwa.sendProgressNotification({
    completed: snapshot.completed,
    total: snapshot.total,
    percentage: snapshot.percentage,
    title: 'Flowly | Progresso',
    body,
    tag: 'flowly-progress'
  });

  state[currentDay] = { completed: snapshot.completed, total: snapshot.total };
  setProgressNotificationState(state);
}
// Enviar estatísticas diárias para o resumo da noite
function sendDailyStats() {
  const { total, completed } = countDayTasks(localDateStr());
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (flowlyPwa) {
    flowlyPwa.sendDailyStats({ completed, total, percentage });
  }
}

const enableLocalSmartNotifFallback =
  localStorage.getItem('flowly_notif_local_fallback') === 'true';

if (
  enableLocalSmartNotifFallback &&
  flowlyPwa &&
  typeof flowlyPwa.startSmartDailyNotifications === 'function'
) {
  flowlyPwa.startSmartDailyNotifications({
    getSnapshot: () => getDailyNotificationSnapshot(localDateStr())
  });
}


// Enviar notificacao de progresso quando tarefa e marcada
const originalSaveToLocalStorage = saveToLocalStorage;
saveToLocalStorage = function () {
  originalSaveToLocalStorage();
  setTimeout(sendProgressNotification, 250);
};

// ========================================
// Fim PWA
// ========================================

// Expose functions to window for HTML onclick compatibility
window.setView = setView;
window.renderView = renderView;
window.runSextaQuickAction = runSextaQuickAction;
window.runSextaCommand = runSextaCommand;
window.openFlowlySettingsTab = openFlowlySettingsTab;
window.showWeeklyRecurrenceDialog = showWeeklyRecurrenceDialog;
window.showAddRoutineTask = showAddRoutineTask;

// Helper function to show auth messages
function showAuthMessage(message, type = 'error') {
  const msgEl = document.getElementById('authMessage');
  if (!msgEl) return;

  msgEl.textContent = message;
  msgEl.style.display = 'block';
  msgEl.style.background = type === 'error' ? 'rgba(255, 69, 58, 0.15)' : 'rgba(48, 209, 88, 0.15)';
  msgEl.style.color = type === 'error' ? '#FF453A' : '#30D158';
  msgEl.style.border =
    type === 'error' ? '1px solid rgba(255, 69, 58, 0.3)' : '1px solid rgba(48, 209, 88, 0.3)';

  setTimeout(() => {
    msgEl.style.display = 'none';
    msgEl.textContent = '';
  }, 5000);
}

// Inicialização da Interface e Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Auth - Login
  const btnLogin = document.getElementById('btnLogin');
  if (btnLogin) {
    btnLogin.onclick = async () => {
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      if (!email || !password) {
        showAuthMessage('Preencha email e senha!', 'error');
        return;
      }
      const btn = document.getElementById('btnLogin');
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Entrando...';
      btn.disabled = true;
      try {
        await signIn(email, password);
      } catch (e) {
        console.error(e);
        showAuthMessage(e.message, 'error');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    };
  }

  // Auth - Signup
  const btnSignup = document.getElementById('btnSignup');
  if (btnSignup) {
    btnSignup.onclick = async () => {
      const email = document.getElementById('signupEmail').value;
      const password = document.getElementById('signupPassword').value;
      if (!email || !password) {
        showAuthMessage('Preencha email e senha!', 'error');
        return;
      }
      const btn = document.getElementById('btnSignup');
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Criando...';
      btn.disabled = true;
      try {
        await signUp(email, password);
      } catch (e) {
        console.error(e);
        showAuthMessage(e.message, 'error');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    };
  }

  // Auth - Toggles
  const btnShowSignup = document.getElementById('btnShowSignup');
  if (btnShowSignup) {
    btnShowSignup.onclick = () => {
      document.getElementById('authLogin').style.display = 'none';
      document.getElementById('authSignup').style.display = 'block';
    };
  }

  const btnShowLogin = document.getElementById('btnShowLogin');
  if (btnShowLogin) {
    btnShowLogin.onclick = () => {
      document.getElementById('authSignup').style.display = 'none';
      document.getElementById('authLogin').style.display = 'block';
    };
  }

  // Logout Button
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.onclick = async () => {
      if (confirm('Deseja realmente sair?')) {
        await signOut();
      }
    };
  }

  // Header - User Dropdown
  const btnUser = document.getElementById('btnUser');
  if (btnUser) {
    btnUser.onclick = (e) => {
      e.stopPropagation();
      const dd = document.getElementById('userDropdown');
      if (dd) dd.style.display = dd.style.display === 'flex' ? 'none' : 'flex';
    };
  }

  document.addEventListener('click', (e) => {
    const dd = document.getElementById('userDropdown');
    if (dd && dd.style.display === 'flex' && !dd.contains(e.target) && e.target !== btnUser) {
      dd.style.display = 'none';
    }
    // Hide Quick Add Menu
    const qm = document.getElementById('quickAddMenu');
    const fab = document.getElementById('floatingAddBtn');
    // fab pode não existir no HTML (elemento opcional) — guard obrigatório
    if (
      qm &&
      qm.style.display === 'flex' &&
      !qm.contains(e.target) &&
      (!fab || !fab.contains(e.target))
    ) {
      qm.style.display = 'none';
      if (fab) {
        const fabIcon = fab.querySelector('i');
        if (fabIcon) fabIcon.setAttribute('data-lucide', 'zap');
        if (window.lucide) lucide.createIcons();
      }
    }
  });

  // FAB Logic
  const fab = document.getElementById('floatingAddBtn');
  if (fab) {
    fab.onclick = (e) => {
      e.stopPropagation();
      const menu = document.getElementById('quickAddMenu');
      if (menu) {
        const isHidden = menu.style.display === 'none' || menu.style.display === '';
        menu.style.display = isHidden ? 'flex' : 'none';

        // Toggle Icon
        const icon = fab.querySelector('i');
        if (icon) {
          icon.setAttribute('data-lucide', isHidden ? 'x' : 'zap');
          if (window.lucide) lucide.createIcons();
        }
      }
    };
  }

  // Quick Menu Actions (Add Task, Add Routine, Add Weekly)
  const quickAddMenu = document.getElementById('quickAddMenu');
  const quickAddTypeHandlers = {
    custom: () => {
      if (quickAddMenu) quickAddMenu.style.display = 'none';
      const todayStr = localDateStr();
      const container = document.querySelector(`.day-column[data-date="${todayStr}"]`);
      if (container) insertQuickTaskInput(container, todayStr, 'Tarefas');
    },
    routine: () => {
      if (quickAddMenu) quickAddMenu.style.display = 'none';
      if (typeof showAddRoutineTask === 'function') showAddRoutineTask();
    },
    weekly: () => {
      if (quickAddMenu) quickAddMenu.style.display = 'none';
      if (typeof showWeeklyRecurrenceDialog === 'function') showWeeklyRecurrenceDialog();
    }
  };

  document.querySelectorAll('#quickAddMenu .quick-add-option').forEach((btn) => {
    btn.onclick = () => {
      const type = btn.dataset.type || btn.dataset.action;
      const handler = quickAddTypeHandlers[type];
      if (handler) handler();
    };
  });

  const btnQuickTask = document.querySelector('[data-action="quick-task"]');
  if (btnQuickTask) {
    btnQuickTask.onclick = quickAddTypeHandlers.custom;
  }

  // Refresh Icons
  if (window.lucide) lucide.createIcons();
});
// Funções de gestão de rotina referenciadas por onclick no HTML gerado
function addRoutineTask(text, daysOfWeek) {
  if (!text || !daysOfWeek || daysOfWeek.length === 0) return;
  const exists = allRecurringTasks.find((t) => t.text === text);
  if (!exists) {
    allRecurringTasks.push({
      text,
      daysOfWeek,
      priority: 'none',
      color: 'default',
      isHabit: false,
      createdAt: new Date().toISOString()
    });
    saveToLocalStorage();
    syncRecurringTasksToSupabase();
    renderView();
  }
}

function deleteRoutineTask(text) {
  if (!text) return;
  if (!confirm('Remover "' + text + '" da rotina?')) return;
  const idx = allRecurringTasks.findIndex((t) => t.text === text);
  if (idx >= 0) {
    allRecurringTasks.splice(idx, 1);
    saveToLocalStorage();
    syncRecurringTasksToSupabase();
    renderView();
  }
}

function toggleRoutineToday(text, completed) {
  const today = localDateStr();
  if (!habitsHistory[text]) habitsHistory[text] = {};
  if (completed) {
    habitsHistory[text][today] = new Date().toISOString();
  } else {
    delete habitsHistory[text][today];
  }
  localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));
  if (typeof syncHabitToSupabase === 'function') syncHabitToSupabase(text, today, completed);
  renderView();
}

function showAddRoutineTask() {
  if (typeof showWeeklyRecurrenceDialog === 'function') showWeeklyRecurrenceDialog();
}

window.addRoutineTask = addRoutineTask;
window.deleteRoutineTask = deleteRoutineTask;
window.toggleRoutineToday = toggleRoutineToday;
window.showAddRoutineTask = showAddRoutineTask;
window.goToDate = goToDate;
window.changeWeek = changeWeek;
window.goToCurrentWeek = goToCurrentWeek;
window.signOut = signOut;

// --- Event Listeners do Novo Modal de Tarefas ---
document.addEventListener('DOMContentLoaded', () => {
  const sidebarToggle = document.getElementById('sidebarToggle');
  const collapsed = localStorage.getItem('flowly_sidebar_collapsed') === 'true';
  if (collapsed) document.body.classList.add('sidebar-collapsed');
  if (sidebarToggle) {
    sidebarToggle.onclick = () => {
      const next = !document.body.classList.contains('sidebar-collapsed');
      document.body.classList.toggle('sidebar-collapsed', next);
      localStorage.setItem('flowly_sidebar_collapsed', String(next));
      const icon = sidebarToggle.querySelector('i');
      if (icon) icon.setAttribute('data-lucide', next ? 'panel-left-open' : 'panel-left-close');
      if (window.lucide) lucide.createIcons();
    };
    const icon = sidebarToggle.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', collapsed ? 'panel-left-open' : 'panel-left-close');
  }

  // Priority Buttons
  document.querySelectorAll('.priority-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.priority-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });

  // Week Day Buttons (Toggle)
  bindWeeklyDayButtons();

  // Action Buttons
  const btnSave = document.getElementById('btnSaveTaskEdit');
  if (btnSave) btnSave.onclick = window.saveTaskEdit;

  const btnDelete = document.getElementById('btnDeleteTaskEdit');
  if (btnDelete) btnDelete.onclick = window.deleteTaskEdit;

  const btnCancel = document.getElementById('btnCancelTaskEdit');
  if (btnCancel)
    btnCancel.onclick = () => document.getElementById('taskEditModal').classList.remove('show');

  // Refresh Icons
  if (window.lucide) lucide.createIcons();
});

window.handleTaskIndent = function (dateStr, period, index, shiftKey) {
  const list = allTasksData[dateStr]?.[period] || [];
  if (list.length === 0) return;

  const visualList = unifiedTaskSort(list.map((t, idx) => ({ task: t, originalIndex: idx })));
  const visualIndex = visualList.findIndex((v) => v.originalIndex === index);
  if (visualIndex < 0) return;

  const currentTask = visualList[visualIndex].task;

  if (shiftKey) {
    if (!currentTask.parent_id) return;
    currentTask.parent_id = null;
  } else {
    if (visualIndex === 0) return;
    const prevTask = visualList[visualIndex - 1].task;
    if (prevTask.depth >= 2) return;

    const possibleParentId = prevTask.supabaseId || prevTask.text;
    if (prevTask.parent_id === possibleParentId) return;
    currentTask.parent_id = possibleParentId;
  }

  saveToLocalStorage();
  syncTaskToSupabase(dateStr, period, currentTask);
  renderView();
};
