function renderView() {
  if (!viewDispatcher && window.FlowlyViews) {
    viewDispatcher = window.FlowlyViews.createDispatcher({
      renderMonth,
      renderAnalyticsView,
      renderFinanceView,
      renderProjectsView,
      renderSextaView,
      renderWatchView: typeof renderWatchView === 'function' ? renderWatchView : null,
      renderGoalsView: typeof renderGoalsView === 'function' ? renderGoalsView : null,
      renderSettingsView,
      renderWeek,
      renderToday
    });
  }

  if (viewDispatcher) {
    viewDispatcher.renderCurrent(currentView);
  } else {
    document.getElementById('monthView').classList.add('hidden');
    document.getElementById('weekGrid').classList.add('hidden');
    document.getElementById('weekGrid').classList.remove('today-container');
    document.getElementById('routineView').classList.add('hidden');
    document.getElementById('analyticsView').classList.add('hidden');
    document.getElementById('financeView').classList.add('hidden');
    document.getElementById('projectsView').classList.add('hidden');
    document.getElementById('sextaView').classList.add('hidden');
    document.getElementById('settingsView').classList.add('hidden');
    document.getElementById('weekNav').classList.add('hidden');

    if (currentView === 'week') document.getElementById('weekNav').classList.remove('hidden');
    if (currentView === 'month') {
      document.getElementById('monthView').classList.remove('hidden');
      renderMonth();
    } else if (currentView === 'analytics') {
      document.getElementById('analyticsView').classList.remove('hidden');
      renderAnalyticsView();
    } else if (currentView === 'finance') {
      document.getElementById('financeView').classList.remove('hidden');
      renderFinanceView();
    } else if (currentView === 'projects') {
      document.getElementById('projectsView').classList.remove('hidden');
      renderProjectsView();
    } else if (currentView === 'sexta') {
      document.getElementById('sextaView').classList.remove('hidden');
      renderSextaView();
    } else if (currentView === 'settings') {
      document.getElementById('settingsView').classList.remove('hidden');
      renderSettingsView();
    } else {
      document.getElementById('weekGrid').classList.remove('hidden');
      if (currentView === 'week') renderWeek();
      else renderToday();
    }
  }

  setTimeout(() => lucide.createIcons(), 0);
}

window.renderView = renderView;
