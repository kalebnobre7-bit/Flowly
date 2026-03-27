(function () {
  function createViewDispatcher(handlers) {
    function hideIfExists(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
      return el;
    }

    return {
      renderCurrent: function (currentView) {
        // Esconde TODOS os containers de view
        hideIfExists('monthView');
        const weekGrid = hideIfExists('weekGrid');
        if (weekGrid) weekGrid.classList.remove('today-container');
        hideIfExists('todayView');
        hideIfExists('routineView');
        const analyticsView = hideIfExists('analyticsView');
        const financeView = hideIfExists('financeView');
        const projectsView = hideIfExists('projectsView');
        const sextaView = hideIfExists('sextaView');
        const settingsView = hideIfExists('settingsView');
        const weekNav = document.getElementById('weekNav');
        if (weekNav) weekNav.classList.add('hidden');

        if (currentView === 'week') {
          if (weekNav) weekNav.classList.remove('hidden');
          if (weekGrid) weekGrid.classList.remove('hidden');
          handlers.renderWeek();
          return;
        }

        if (currentView === 'month') {
          if (monthView) monthView.classList.remove('hidden');
          handlers.renderMonth();
          return;
        }

        if (currentView === 'analytics') {
          if (analyticsView) analyticsView.classList.remove('hidden');
          handlers.renderAnalyticsView();
          return;
        }

        if (currentView === 'finance') {
          if (financeView) financeView.classList.remove('hidden');
          handlers.renderFinanceView();
          return;
        }

        if (currentView === 'projects') {
          if (projectsView) projectsView.classList.remove('hidden');
          if (typeof handlers.renderProjectsView === 'function') {
            handlers.renderProjectsView();
          }
          return;
        }

        if (currentView === 'sexta') {
          if (sextaView) sextaView.classList.remove('hidden');
          handlers.renderSextaView();
          return;
        }

        if (currentView === 'settings') {
          if (settingsView) settingsView.classList.remove('hidden');
          handlers.renderSettingsView();
          return;
        }

        // today (default)
        const todayView = document.getElementById('todayView');
        if (todayView) todayView.classList.remove('hidden');
        handlers.renderToday();
      }
    };
  }

  window.FlowlyViews = {
    createDispatcher: createViewDispatcher
  };
})();
