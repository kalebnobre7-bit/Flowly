(function () {
  function createAnalyticsService(deps) {
    const getAllTasksData = deps.getAllTasksData;
    const getRoutineTasksForDate = deps.getRoutineTasksForDate;

    function getDailyCompletion(dateStr) {
      const allTasksData = getAllTasksData();
      const dayData = allTasksData[dateStr] || {};
      let total = 0;
      let completed = 0;

      Object.entries(dayData).forEach(function ([period, tasks]) {
        if (period === 'Rotina') return;
        if (!Array.isArray(tasks)) return;
        total += tasks.length;
        completed += tasks.filter(function (t) {
          return t.completed;
        }).length;
      });

      const routine = getRoutineTasksForDate(dateStr);
      total += routine.length;
      completed += routine.filter(function (t) {
        return t.completed;
      }).length;

      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { total: total, completed: completed, rate: rate };
    }

    return {
      getDailyCompletion: getDailyCompletion
    };
  }

  window.FlowlyAnalyticsService = {
    create: createAnalyticsService
  };
})();
