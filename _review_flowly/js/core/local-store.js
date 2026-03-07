(function () {
  function safeJSONParse(str, fallback) {
    try {
      return str ? JSON.parse(str) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function createLocalStore() {
    function saveCoreState(state) {
      localStorage.setItem('allTasksData', JSON.stringify(state.allTasksData));
      localStorage.setItem('allRecurringTasks', JSON.stringify(state.allRecurringTasks));
      localStorage.setItem('routineCompletions', JSON.stringify(state.routineCompletions));
      localStorage.setItem('habitsHistory', JSON.stringify(state.habitsHistory));
      localStorage.setItem('dailyRoutine', JSON.stringify([]));
      localStorage.setItem('weeklyRecurringTasks', JSON.stringify([]));
    }

    function loadLegacyWeekData(weekData) {
      const saved = localStorage.getItem('weekData');
      if (!saved) return;
      const savedData = safeJSONParse(saved, {});
      Object.keys(weekData).forEach(function (day) {
        if (savedData[day]) weekData[day] = savedData[day];
      });
    }

    return {
      safeJSONParse: safeJSONParse,
      saveCoreState: saveCoreState,
      loadLegacyWeekData: loadLegacyWeekData
    };
  }

  window.FlowlyLocalStore = {
    create: createLocalStore,
    safeJSONParse: safeJSONParse
  };
})();
