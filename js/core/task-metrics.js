(function () {
  function countDayTasks(dateStr) {
    if (analyticsService) {
      const metrics = analyticsService.getDailyCompletion(dateStr);
      return { total: metrics.total, completed: metrics.completed };
    }

    const dayData = allTasksData[dateStr] || {};
    let total = 0;
    let completed = 0;

    Object.entries(dayData).forEach(([period, tasks]) => {
      if (period === 'Rotina') return;
      if (!Array.isArray(tasks)) return;
      total += tasks.length;
      completed += tasks.filter((task) => task.completed).length;
    });

    const routine = getRoutineTasksForDate(dateStr);
    total += routine.length;
    completed += routine.filter((task) => task.completed).length;

    return { total, completed };
  }

  function getDailyNotificationSnapshot(dateStr) {
    const targetDate = dateStr || localDateStr();
    const stats = countDayTasks(targetDate);
    const dayData = allTasksData[targetDate] || {};
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
      durationSamplesMs.length > 0
        ? Math.round(totalTaskDurationMs / durationSamplesMs.length)
        : 0;

    const routine = getRoutineTasksForDate(targetDate);
    const routineTotal = routine.length;
    const routineCompleted = routine.filter((task) => task && task.completed).length;

    return {
      dateStr: targetDate,
      total: stats.total,
      completed: stats.completed,
      pending: Math.max(0, stats.total - stats.completed),
      percentage: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
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

    return template.replace(/\{([a-zA-Z]+)\}/g, function (_, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : '';
    });
  }

  window.countDayTasks = countDayTasks;
  window.getDailyNotificationSnapshot = getDailyNotificationSnapshot;
  window.renderNotifTemplate = renderNotifTemplate;
  window.FlowlyTaskMetrics = {
    countDayTasks,
    getDailyNotificationSnapshot,
    renderNotifTemplate
  };
})();
