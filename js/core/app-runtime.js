function initFlowlyAppRuntime() {
  loadFromLocalStorage();
  normalizeAllTasks();
  initTaskNormalizerRuntime();
  let crossTabRefreshTimer = null;

  if (window.lucide) {
    lucide.createIcons();
  }
  renderSyncStatus();
  initAuthRuntime();

  window.addEventListener('online', () => {
    setSyncStatus('syncing', 'Conexao restabelecida. Sincronizando...');
    scheduleUnsyncedTasksSync(300);
  });

  window.addEventListener('offline', () => {
    syncStatus.busyCount = 0;
    setSyncStatus('offline', 'Sem conexao. Salvando no dispositivo');
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleUnsyncedTasksSync(500);
  });

  window.addEventListener('storage', (event) => {
    const syncKeys = new Set([
      'allTasksData',
      'flowlyPendingTaskDeletes',
      'allRecurringTasks',
      'routineCompletions',
      'habitsHistory',
      'flowlyFinanceState',
      'flowlyProjectsState'
    ]);

    if (!event || !event.key) return;
    if (event.key === 'flowly-auth') {
      location.reload();
      return;
    }
    if (!syncKeys.has(event.key)) return;

    if (crossTabRefreshTimer) clearTimeout(crossTabRefreshTimer);
    crossTabRefreshTimer = setTimeout(() => {
      crossTabRefreshTimer = null;
      loadFromLocalStorage();
      normalizeAllTasks();
      renderSyncStatus();
      renderView();
      if (typeof window.renderRoutineView === 'function') {
        window.renderRoutineView();
      }
    }, 80);
  });

  setInterval(() => {
    if (document.hidden) return;
    scheduleUnsyncedTasksSync(0);
  }, 15000);

  setInterval(() => {
    if (document.hidden) return;
    refreshInlineTaskTimers();
  }, 1000);

  const flowlyPwa = window.FlowlyPwa
    ? window.FlowlyPwa.create({
        supabaseClient,
        getCurrentUser: () => currentUser,
        debugLog
      })
    : null;

  window.flowlyPwa = flowlyPwa;

  if (flowlyPwa) {
    flowlyPwa.initServiceWorker();
  }
}

window.initFlowlyAppRuntime = initFlowlyAppRuntime;
