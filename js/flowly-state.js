var currentUser = null;
var authSession = null;
var tasksRepo = null;
var tasksSyncService = null;
var routineService = null;
var analyticsService = null;
var localStore = null;
var eventBus = null;
var errorHandler = null;
var viewDispatcher = null;
var currentView = 'today';
var draggedTask = null;
var currentEditingTask = null;
var currentWeekOffset = 0;
var currentMonthOffset = 0;
var sextaState = safeJSONParse(localStorage.getItem('flowly_sexta_state'), {
  lastAction: '',
  notes: [],
  suggestions: [],
  chatHistory: [],
  memories: [],
  activeTab: 'chat'
});
var syncStatus = {
  state: navigator.onLine ? 'saved' : 'offline',
  text: navigator.onLine ? 'Tudo salvo' : 'Sem conexao',
  hideTimer: null,
  busyCount: 0,
  lastSavedAt: 0
};

// Data structures
var allRecurringTasks = safeJSONParse(localStorage.getItem('allRecurringTasks'), []);
var customTaskTypes = [];
var customTaskPriorities = [];
var dbUserSettings = { enable_week_hover_animation: true };
var dailyRoutine = safeJSONParse(localStorage.getItem('dailyRoutine'), []);
var weeklyRecurringTasks = safeJSONParse(localStorage.getItem('weeklyRecurringTasks'), []);
var allTasksData = safeJSONParse(localStorage.getItem('allTasksData'), {});
var collapsedTaskGroups = safeJSONParse(localStorage.getItem('flowlyCollapsedTaskGroups'), {});
var weekData = {
  'Segunda': {},
  'Terça': {},
  'Quarta': {},
  'Quinta': {},
  'Sexta': {},
  'Sábado': {},
  'Domingo': {}
};
var habitsHistory = safeJSONParse(localStorage.getItem('habitsHistory'), {});
var routineCompletions = safeJSONParse(localStorage.getItem('routineCompletions'), {});
var currentEditingTaskRef = null;

window.FlowlyState = {
  getSnapshot: function () {
    return {
      currentView,
      currentWeekOffset,
      currentMonthOffset,
      currentUser,
      allTasksData,
      allRecurringTasks,
      habitsHistory,
      sextaState
    };
  }
};
