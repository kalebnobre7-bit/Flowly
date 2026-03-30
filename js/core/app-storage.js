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

function loadFromLocalStorage() {
  const parse =
    (localStore && typeof localStore.safeJSONParse === 'function'
      ? localStore.safeJSONParse
      : typeof safeJSONParse === 'function'
        ? safeJSONParse
        : function (raw, fallback) {
            try {
              return raw ? JSON.parse(raw) : fallback;
            } catch (error) {
              return fallback;
            }
          });

  allTasksData = parse(localStorage.getItem('allTasksData'), allTasksData || {});
  allRecurringTasks = parse(localStorage.getItem('allRecurringTasks'), allRecurringTasks || []);
  routineCompletions = parse(
    localStorage.getItem('routineCompletions'),
    routineCompletions || {}
  );
  habitsHistory = parse(localStorage.getItem('habitsHistory'), habitsHistory || {});

  if (typeof normalizeFinanceState === 'function') {
    financeState = normalizeFinanceState(
      parse(localStorage.getItem('flowlyFinanceState'), financeState || null)
    );
  }

  if (typeof normalizeProjectsState === 'function') {
    projectsState = normalizeProjectsState(
      parse(localStorage.getItem('flowlyProjectsState'), projectsState || null)
    );
  }

  if (localStore) {
    localStore.loadLegacyWeekData(weekData);
    return;
  }

  const saved = localStorage.getItem('weekData');
  if (!saved) return;

  const savedData = JSON.parse(saved);
  Object.keys(weekData).forEach((day) => {
    if (savedData[day]) weekData[day] = savedData[day];
  });
}
