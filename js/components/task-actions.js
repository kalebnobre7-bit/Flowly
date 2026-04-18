(function () {
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

  function callGlobal(fnName, args) {
    if (typeof window[fnName] !== 'function') return null;
    return window[fnName].apply(window, args);
  }

  function createTaskActions() {
    return {
      createTask: function (dateStr, text, period) {
        return callGlobal('createTaskViaSexta', [dateStr, text, period]);
      },
      prioritizeTask: function (dateStr, query) {
        return callGlobal('prioritizeTaskViaSexta', [dateStr, query]);
      },
      findFirstPendingTask: function (dateStr) {
        return callGlobal('findFirstPendingTask', [dateStr]);
      },
      completeTask: function (query, preferredDateStr) {
        return callGlobal('completeTaskViaSexta', [query, preferredDateStr]);
      },
      deleteTask: function (query, preferredDateStr) {
        return callGlobal('deleteTaskViaSexta', [query, preferredDateStr]);
      },
      moveTask: function (query, targetDateStr, targetPeriod, preferredDateStr) {
        return callGlobal('moveTaskViaSexta', [query, targetDateStr, targetPeriod, preferredDateStr]);
      },
      getRelativeDateStr: function (dayOffset) {
        return callGlobal('getRelativeDateStr', [dayOffset]);
      },
      completeNextTask: function (dateStr) {
        const next = callGlobal('findFirstPendingTask', [dateStr]);
        if (!next || typeof window.toggleTaskStatus !== 'function') return null;
        window.toggleTaskStatus(dateStr, next.period, next.index, true, null);
        return next;
      }
    };
  }

  window.FlowlyTaskComponents = {
    getPriorityColorName: getPriorityColorName
  };

  window.FlowlyTaskActions = createTaskActions();
})();
