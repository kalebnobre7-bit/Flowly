function setView(view) {
  if (view === 'routine') {
    const analyticsView = document.getElementById('analyticsView');
    if (analyticsView) analyticsView.dataset.mainTab = 'routine';
    view = 'analytics';
  }

  currentView = view;

  const views = [
    'monthView',
    'weekGrid',
    'todayView',
    'routineView',
    'analyticsView',
    'financeView',
    'projectsView',
    'sextaView',
    'settingsView'
  ];

  views.forEach((viewId) => {
    const el = document.getElementById(viewId);
    if (el) el.classList.add('hidden');
  });

  document
    .querySelectorAll('.segment-btn, .sidebar-nav-btn')
    .forEach((btn) => btn.classList.remove('active'));

  const btnMap = {
    month: 'btnMonth',
    week: 'btnWeek',
    today: 'btnToday',
    analytics: 'btnAnalytics',
    finance: 'btnFinance',
    projects: 'btnProjects',
    sexta: 'btnSexta',
    settings: 'btnSettings'
  };

  const activeBtn = document.getElementById(btnMap[view]);
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.mobile-nav-btn').forEach((btn) => btn.classList.remove('active'));

  const mobileBtnMap = {
    week: 'btnMobileWeek',
    analytics: 'btnMobileAnalytics',
    finance: 'btnMobileFinance',
    projects: 'btnMobileProjects',
    today: 'btnMobileToday',
    sexta: 'btnMobileSexta',
    settings: 'btnMobileSettings'
  };

  const mobileActiveBtn = document.getElementById(mobileBtnMap[view]);
  if (mobileActiveBtn) mobileActiveBtn.classList.add('active');

  const weekNav = document.getElementById('weekNav');
  if (weekNav) {
    weekNav.style.display = view === 'week' ? 'flex' : 'none';
  }

  renderView();
}

function getWeekDates(weekOffset = 0) {
  const today = new Date();
  const viewSettings = getViewSettings();
  const weekStart = viewSettings.weekStart === 'sun' ? 'sun' : 'mon';
  const showWeekends = viewSettings.showWeekends !== false;

  const currentDay = today.getDay();
  const startDiff = weekStart === 'sun' ? -currentDay : currentDay === 0 ? -6 : 1 - currentDay;

  const startDate = new Date(today);
  startDate.setDate(today.getDate() + startDiff + weekOffset * 7);
  startDate.setHours(0, 0, 0, 0);

  const dayNames =
    weekStart === 'sun'
      ? ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
      : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dayIndex = date.getDay();
    const isWeekend = dayIndex === 0 || dayIndex === 6;
    if (!showWeekends && isWeekend) continue;

    dates.push({
      name: dayNames[i],
      date,
      dateStr: localDateStr(date)
    });
  }

  return dates;
}

function getMonthDates(monthOffset = 0) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + monthOffset;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  return { firstDay, lastDay, month: firstDay.getMonth(), year: firstDay.getFullYear() };
}

function getWeekLabel(weekOffset) {
  const dates = getWeekDates(weekOffset);
  if (!dates.length) return 'Semana Atual';

  const firstDate = dates[0].date;
  const lastDate = dates[dates.length - 1].date;

  if (weekOffset === 0) return 'Semana Atual';

  const format = (date) => date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `${format(firstDate)} - ${format(lastDate)}`;
}

function changeWeek(direction) {
  currentWeekOffset += direction;
  renderView();
}

function goToCurrentWeek() {
  currentWeekOffset = 0;
  renderView();
}

function goToDate(dateStr) {
  const targetDate = new Date(dateStr);
  const today = new Date();
  const diffTime = targetDate - today;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  currentWeekOffset = Math.floor(diffDays / 7);
  setView('week');
}

window.setView = setView;
window.getWeekDates = getWeekDates;
window.getMonthDates = getMonthDates;
window.getWeekLabel = getWeekLabel;
window.changeWeek = changeWeek;
window.goToCurrentWeek = goToCurrentWeek;
window.goToDate = goToDate;
