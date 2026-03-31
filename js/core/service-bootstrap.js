function initializeFlowlyServices() {
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
    window.flowlyErrors = errorHandler;
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
      getPendingTaskDeletes: () => pendingTaskDeletes,
      setPendingTaskDeletes: (next) => {
        pendingTaskDeletes = Array.isArray(next) ? next : [];
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
        customTaskPriorities = Array.isArray(next) ? next : [];
        if (typeof ensureMoneyPriorityOption === 'function') {
          ensureMoneyPriorityOption();
        }
      },
      getDbUserSettings: () => dbUserSettings,
      setDbUserSettings: (next) => {
        dbUserSettings = next;
      },
      normalizeAllTasks,
      syncRecurringTasksToSupabase,
      syncTaskToSupabase,
      renderView,
      renderRoutineView: window.renderRoutineView
    });
  }
}
