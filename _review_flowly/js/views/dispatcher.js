(function () {
  function createViewDispatcher(handlers) {
    return {
      renderCurrent: function (currentView) {
        document.getElementById('monthView').classList.add('hidden');
        document.getElementById('weekGrid').classList.add('hidden');
        document.getElementById('weekGrid').classList.remove('today-container');
        document.getElementById('routineView').classList.add('hidden');
        document.getElementById('analyticsView').classList.add('hidden');
        const financeView = document.getElementById('financeView');
        if (financeView) financeView.classList.add('hidden');
        const sextaView = document.getElementById('sextaView');
        if (sextaView) sextaView.classList.add('hidden');
        document.getElementById('settingsView').classList.add('hidden');
        document.getElementById('weekNav').classList.add('hidden');

        if (currentView === 'week') {
          document.getElementById('weekNav').classList.remove('hidden');
        }

        if (currentView === 'month') {
          document.getElementById('monthView').classList.remove('hidden');
          handlers.renderMonth();
        } else if (currentView === 'analytics') {
          document.getElementById('analyticsView').classList.remove('hidden');
          handlers.renderAnalyticsView();
        } else if (currentView === 'finance') {
          document.getElementById('financeView').classList.remove('hidden');
          handlers.renderFinanceView();
        } else if (currentView === 'sexta') {
          document.getElementById('sextaView').classList.remove('hidden');
          handlers.renderSextaView();
        } else if (currentView === 'settings') {
          document.getElementById('settingsView').classList.remove('hidden');
          handlers.renderSettingsView();
        } else {
          document.getElementById('weekGrid').classList.remove('hidden');
          if (currentView === 'week') handlers.renderWeek();
          else handlers.renderToday();
        }
      }
    };
  }

  window.FlowlyViews = {
    createDispatcher: createViewDispatcher
  };
})();
