// Analytics and habits view extracted from js/app.js

function getAllHabits() {
  if (routineService) return routineService.getAllHabits();
  return [];
}
function getHabitStreak(habitText) {
  if (routineService) return routineService.getHabitStreak(habitText);
  return 0;
}
function getHabitCompletionRate(habitText, days = 30) {
  if (routineService) return routineService.getHabitCompletionRate(habitText, days);
  return 0;
}

function markHabitCompleted(habitText, completed, targetDate = null) {
  if (routineService) {
    routineService.markHabitCompleted(habitText, completed, targetDate);
  }
}
window.toggleHabitToday = function (habitText, completed) {
  // Normalizar texto para evitar problemas com aspas
  const cleanText = habitText;
  // O toggleHabitToday da interface de rotina assume "hoje", mas podemos melhorar isso se necessÃ¡rio.
  // Por enquanto, mantÃ©m o comportamento atual de usar "hoje" SE nÃ£o passar data.
  markHabitCompleted(cleanText, completed);

  // Re-renderizar para atualizar UI imediatamente (optimistic update)
  setTimeout(() => {
    renderView();
  }, 50);
};

async function removeHabit(habitText) {
  const confirmed = await window.FlowlyDialogs.confirm(
    `Tem certeza que deseja remover "${habitText}" dos hÃ¡bitos?\n\nIsso irÃ¡ desmarcar esta tarefa como hÃ¡bito em todas as ocorrÃªncias.`,
    {
      title: 'Remover hábito',
      confirmLabel: 'Remover',
      tone: 'danger'
    }
  );
  if (!confirmed) return;

  // Remover de allRecurringTasks
  const recurringIdx = allRecurringTasks.findIndex((t) => t.text === habitText);
  if (recurringIdx !== -1) {
    allRecurringTasks.splice(recurringIdx, 1);
    saveToLocalStorage();
    syncRecurringTasksToSupabase();
  }

  // Desmarcar como hÃ¡bito em todas as tarefas existentes
  Object.entries(allTasksData).forEach(([dateStr, periods]) => {
    Object.entries(periods).forEach(([period, tasks]) => {
      tasks.forEach((task) => {
        if (task.text === habitText && task.isHabit) {
          task.isHabit = false;
        }
      });
    });
  });

  // Limpar histÃ³rico do hÃ¡bito
  if (habitsHistory[habitText]) {
    delete habitsHistory[habitText];
    localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));
  }

  saveToLocalStorage();
  renderView();
  setTimeout(() => lucide.createIcons(), 0);
  window.FlowlyDialogs.notify(`"${habitText}" removido dos hábitos.`, 'success');
}

function renderHabitsView() {
  const view = document.getElementById('habitsView'),
    habits = getAllHabits();
  if (habits.length === 0) {
    view.innerHTML =
      '<div class="text-center py-20"><p class="text-gray-400 text-lg">Nenhum hÃ¡bito rastreado ainda.</p><p class="text-gray-600 text-sm mt-2">Marque tasks como hÃ¡bitos no menu de contexto (botÃ£o direito).</p></div>';
    return;
  }

  let html = `<div class="flowly-shell flowly-shell--narrow"><h2 class="text-3xl font-bold mb-8 text-white flex items-center gap-3"><i data-lucide="repeat" style="width: 28px; height: 28px;"></i> Meus HÃ¡bitos</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"><div class="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Total de HÃ¡bitos</div><div class="text-3xl font-bold text-white">${habits.length}</div></div>
            <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"><div class="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">ConcluÃ­dos Hoje</div><div class="text-3xl font-bold text-[#30d158]">${habits.filter((h) => h.completedToday).length}</div></div>
            <div class="bg-[#1c1c1e] bg-opacity-60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"><div class="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Taxa Hoje</div><div class="text-3xl font-bold text-[#0A84FF]">${habits.length > 0 ? Math.round((habits.filter((h) => h.completedToday).length / habits.length) * 100) : 0}%</div></div></div><div class="space-y-3">`;

  habits.forEach((habit, index) => {
    const streak = getHabitStreak(habit.text),
      completionRate = getHabitCompletionRate(habit.text, 30);
    html += `<div class="bg-[#1c1c1e] bg-opacity-40 backdrop-blur-md border border-white/5 rounded-xl p-5 hover:bg-opacity-60 transition-all flex items-center justify-between gap-4 group">
                
                
                
                
                
                
                
                <div class="flex items-center gap-4 flex-1">
                
                
                
                
                
                
                
                    <input type="checkbox" class="checkbox-custom mt-1" ${habit.completedToday ? 'checked' : ''} data-habit-toggle="${encodeURIComponent(habit.text)}">
                
                
                
                
                
                
                
                    <div class="flex-1">
                
                
                
                
                
                
                
                        <div class="color-${habit.color} font-medium text-lg mb-1 group-hover:text-white transition-colors">${habit.text}</div>
                
                
                
                
                
                
                
                        <div class="flex items-center gap-3 text-xs text-gray-400">
                
                
                
                
                
                
                
                            ${streak > 0 ? `<span class="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium flex items-center gap-1"><i data-lucide="flame" style="width: 14px; height: 14px;"></i> ${streak} dias</span>` : ''}
                
                
                
                
                
                
                
                            <span>${completionRate}% consistency (30d)</span>
                
                
                
                
                
                
                
                        </div>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                <div class="flex items-center gap-3">
                
                
                
                
                
                
                
                    <div class="w-32 h-1.5 bg-gray-700/30 rounded-full overflow-hidden flex-shrink-0"><div class="h-full bg-blue-500 rounded-full transition-all duration-500" style="width: ${completionRate}%"></div></div>
                
                
                
                
                
                
                
                    <button type="button" data-habit-remove="${encodeURIComponent(habit.text)}" class="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg" title="Remover hÃ¡bito">
                
                
                
                
                
                
                
                        <i data-lucide="x" class="text-red-400" style="width: 18px; height: 18px;"></i>
                
                
                
                
                
                
                
                    </button>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                </div>`;
  });
  html += `</div></div>`;
  view.innerHTML = html;

  view.querySelectorAll('[data-habit-toggle]').forEach((input) => {
    input.onchange = () => {
      const habitText = decodeURIComponent(input.dataset.habitToggle || '');
      toggleHabitToday(habitText, input.checked);
    };
  });

  view.querySelectorAll('[data-habit-remove]').forEach((btn) => {
    btn.onclick = () => {
      const habitText = decodeURIComponent(btn.dataset.habitRemove || '');
      removeHabit(habitText);
    };
  });
}

function renderAnalyticsView() {
  const view = document.getElementById('analyticsView');
  if (!view) return;

  // -- Outer tab (Rotina | Analytics) ------------------------------------
  const mainTab = view.dataset.mainTab || 'analytics';
  const outerTabsHTML = `
    <div style="display:flex;gap:6px;padding:0 0 20px">
        <button type="button" data-analytics-main-tab="routine"
            style="padding:7px 16px;border-radius:20px;font-size:13px;font-weight:600;border:1px solid;cursor:pointer;transition:all 0.15s;
                
                
                
                
                
                
                
                   background:${mainTab === 'routine' ? 'rgba(10,132,255,0.15)' : 'transparent'};
                
                
                
                
                
                
                
                   color:${mainTab === 'routine' ? '#0A84FF' : 'var(--text-tertiary)'};
                
                
                
                
                
                
                
                   border-color:${mainTab === 'routine' ? 'rgba(10,132,255,0.35)' : 'var(--border-subtle)'}">
            Rotina
        </button>
        <button type="button" data-analytics-main-tab="analytics"
            style="padding:7px 16px;border-radius:20px;font-size:13px;font-weight:600;border:1px solid;cursor:pointer;transition:all 0.15s;
                
                
                
                
                
                
                
                   background:${mainTab === 'analytics' ? 'rgba(10,132,255,0.15)' : 'transparent'};
                
                
                
                
                
                
                
                   color:${mainTab === 'analytics' ? '#0A84FF' : 'var(--text-tertiary)'};
                
                
                
                
                
                
                
                   border-color:${mainTab === 'analytics' ? 'rgba(10,132,255,0.35)' : 'var(--border-subtle)'}">
            Analytics
        </button>
    </div>`;

  // -- Routine tab: embed renderRoutineView inside analytics -------------
  if (mainTab === 'routine') {
    const routineTab = view.dataset.routineTab || 'today';
    const routineHtml = `<div class="flowly-shell"><div class="analytics-container-v2">${outerTabsHTML}<div id="routineEmbedded"></div></div></div>`;
    view.innerHTML = typeof fixMojibakeText === 'function' ? fixMojibakeText(routineHtml) : routineHtml;
    view.querySelectorAll('[data-analytics-main-tab]').forEach((btn) => {
      btn.onclick = () => {
        const nextTab = btn.dataset.analyticsMainTab || 'analytics';
        view.dataset.mainTab = nextTab;
        if (nextTab === 'routine' && !view.dataset.routineTab) view.dataset.routineTab = 'today';
        renderAnalyticsView();
      };
    });
    const embedded = document.getElementById('routineEmbedded');
    embedded.dataset.routineTab = routineTab;
    renderRoutineView(embedded);
    return;
  }

  // -- Constants ----------------------------------------------------------
  const MONTH_NAMES_PT = [
    'Janeiro',
    'Fevereiro',
    'MarÃ§o',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ].map((item) => (typeof fixMojibakeText === 'function' ? fixMojibakeText(item) : item));
  const DAY_ABBR_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'SÃ¡b'].map((item) =>
    typeof fixMojibakeText === 'function' ? fixMojibakeText(item) : item
  );

  // -- Today --------------------------------------------------------------
  const today = localDateStr();

  // -- Week stats ---------------------------------------------------------
  const weekDates = getWeekDates(0);
  let totalTasksWeek = 0,
    completedTasksWeek = 0;
  let totalTasksToday = 0,
    completedTasksToday = 0;
  const dayStatsMap = {};

  weekDates.forEach(({ name, dateStr }) => {
    const dayTasks = allTasksData[dateStr] || {};
    let dayTotal = 0,
      dayCompleted = 0;
    Object.entries(dayTasks).forEach(([period, tasks]) => {
      if (period === 'Rotina') return;
      if (Array.isArray(tasks)) {
        tasks.forEach((task) => {
          dayTotal++;
          totalTasksWeek++;
          if (task.completed) {
            dayCompleted++;
            completedTasksWeek++;
          }
          if (dateStr === today) {
            totalTasksToday++;
            if (task.completed) completedTasksToday++;
          }
        });
      }
    });
    const routineForDay = getRoutineTasksForDate(dateStr);
    dayTotal += routineForDay.length;
    totalTasksWeek += routineForDay.length;
    dayCompleted += routineForDay.filter((t) => t.completed).length;
    completedTasksWeek += routineForDay.filter((t) => t.completed).length;
    if (dateStr === today) {
      totalTasksToday += routineForDay.length;
      completedTasksToday += routineForDay.filter((t) => t.completed).length;
    }
    dayStatsMap[name] = { total: dayTotal, completed: dayCompleted, dateStr };
  });

  // -- Habit stats --------------------------------------------------------
  const allHabitsArr = getAllHabits();
  const totalHabits = allHabitsArr.length;
  const completedHabitsToday = allHabitsArr.filter((h) => h.completedToday).length;

  const performanceHistory = [];
  const perfCursor = new Date();
  perfCursor.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const targetDate = new Date(perfCursor);
    targetDate.setDate(perfCursor.getDate() - i);
    const dStr = localDateStr(targetDate);
    const dt = allTasksData[dStr] || {};
    let total = 0,
      completed = 0;
    Object.entries(dt).forEach(([p, tasks]) => {
      if (p === 'Rotina') return;
      if (Array.isArray(tasks)) {
        total += tasks.length;
        completed += tasks.filter((t) => t.completed).length;
      }
    });
    const rr = getRoutineTasksForDate(dStr);
    total += rr.length;
    completed += rr.filter((t) => t.completed).length;
    performanceHistory.push({
      dateStr: dStr,
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0
    });
  }
  const activeHistory = performanceHistory.filter((d) => d.total > 0);
  const avgCompletedBaseline = activeHistory.length > 0
    ? activeHistory.reduce((sum, d) => sum + d.completed, 0) / activeHistory.length
    : 0;
  const recent7 = performanceHistory.slice(-7);
  const prev7 = performanceHistory.slice(-14, -7);
  const recent7Active = recent7.filter((d) => d.total > 0);
  const prev7Active = prev7.filter((d) => d.total > 0);
  const recent7Completed = recent7.reduce((sum, d) => sum + d.completed, 0);
  const prev7Completed = prev7.reduce((sum, d) => sum + d.completed, 0);
  const recent7Avg = recent7Active.length > 0 ? recent7Completed / recent7Active.length : 0;
  const prev7Avg = prev7Active.length > 0 ? prev7Completed / prev7Active.length : 0;
  const todayCompletedVolume = completedTasksToday;
  const todayPerformanceScore = avgCompletedBaseline > 0
    ? Math.round((todayCompletedVolume / avgCompletedBaseline) * 100)
    : todayCompletedVolume > 0
      ? 100
      : 0;
  const weeklyPerformanceScore = prev7Avg > 0
    ? Math.round((recent7Avg / prev7Avg) * 100)
    : recent7Avg > 0
      ? 100
      : 0;
  const volumeDelta = Math.round(todayCompletedVolume - avgCompletedBaseline);
  const weeklyDeltaTasks = Math.round(recent7Avg - prev7Avg);
  const consistencyDays = performanceHistory.filter(
    (d) => d.total > 0 && d.completed >= avgCompletedBaseline
  ).length;
  const bestVolumeDay = activeHistory.length > 0
    ? activeHistory.reduce((best, d) => (d.completed > best.completed ? d : best))
    : null;
  const monthlyVolumeSeries = performanceHistory.map((d) => d.completed);
  const monthlyVolumeLabels = performanceHistory.map((d) => d.dateStr.slice(8, 10));

  // -- Rates --------------------------------------------------------------
  const todayRate =
    totalTasksToday > 0 ? Math.round((completedTasksToday / totalTasksToday) * 100) : 0;
  const weekRate = totalTasksWeek > 0 ? Math.round((completedTasksWeek / totalTasksWeek) * 100) : 0;
  const habitRate = totalHabits > 0 ? Math.round((completedHabitsToday / totalHabits) * 100) : 0;

  // -- Streak -------------------------------------------------------------
  let currentStreak = 0;
  const streakCheckDate = new Date();
  for (let i = 0; i < 60; i++) {
    const cStr = localDateStr(streakCheckDate);
    const cTasks = allTasksData[cStr] || {};
    let st = 0,
      sc = 0;
    Object.entries(cTasks).forEach(([p, tasks]) => {
      if (p === 'Rotina') return;
      if (Array.isArray(tasks)) {
        st += tasks.length;
        sc += tasks.filter((t) => t.completed).length;
      }
    });
    const rfc = getRoutineTasksForDate(cStr);
    st += rfc.length;
    sc += rfc.filter((t) => t.completed).length;
    if (st > 0 && sc === st) {
      currentStreak++;
    } else if (i > 0 || (i === 0 && st > 0)) {
      break;
    }
    streakCheckDate.setDate(streakCheckDate.getDate() - 1);
  }

  // -- Last-week comparison (fair: compare only up to same day of week) --
  const todayDayOfWeek = new Date().getDay(); // 0=Dom, 6=SÃ¡b
  const lastWeekDates = getWeekDates(-1);
  let lastWeekTotal = 0,
    lastWeekCompleted = 0;
  // Also recalculate current week up to today for fair comparison
  let thisWeekFairTotal = 0,
    thisWeekFairCompleted = 0;
  lastWeekDates.forEach(({ dateStr: lwds }, idx) => {
    // getWeekDates returns Mon-Sun (index 0=Mon). Map to day-of-week:
    // idx 0=Mon(1), 1=Tue(2)... 5=Sat(6), 6=Sun(0)
    const lwDow = idx < 6 ? idx + 1 : 0;
    // Only count days up to and including today's day-of-week
    // e.g. if today is Friday(5), count Mon-Fri of last week
    const lwDate = new Date(lwds);
    const currentWeekStart = new Date(weekDates[0].dateStr);
    const todayDate = new Date(today);
    // Simple: compare by index position in the week array
    if (idx <= weekDates.findIndex((w) => w.dateStr === today)) {
      const dt = allTasksData[lwds] || {};
      Object.entries(dt).forEach(([p, tasks]) => {
        if (p === 'Rotina') return;
        if (Array.isArray(tasks)) {
          lastWeekTotal += tasks.length;
          lastWeekCompleted += tasks.filter((t) => t.completed).length;
        }
      });
      const rlw = getRoutineTasksForDate(lwds);
      lastWeekTotal += rlw.length;
      lastWeekCompleted += rlw.filter((t) => t.completed).length;
    }
  });
  // Current week fair total (only up to today)
  weekDates.forEach(({ dateStr: wds }, idx) => {
    if (idx <= weekDates.findIndex((w) => w.dateStr === today)) {
      const dt = allTasksData[wds] || {};
      Object.entries(dt).forEach(([p, tasks]) => {
        if (p === 'Rotina') return;
        if (Array.isArray(tasks)) {
          thisWeekFairTotal += tasks.length;
          thisWeekFairCompleted += tasks.filter((t) => t.completed).length;
        }
      });
      const rtw = getRoutineTasksForDate(wds);
      thisWeekFairTotal += rtw.length;
      thisWeekFairCompleted += rtw.filter((t) => t.completed).length;
    }
  });
  const thisWeekFairRate =
    thisWeekFairTotal > 0 ? Math.round((thisWeekFairCompleted / thisWeekFairTotal) * 100) : 0;
  const lastWeekRate =
    lastWeekTotal > 0 ? Math.round((lastWeekCompleted / lastWeekTotal) * 100) : 0;
  const weekDiff = thisWeekFairRate - lastWeekRate;

  // -- Day-of-week performance --------------------------------------------
  const dayPerfData = weekDates.map(({ name, dateStr }, idx) => {
    const s = dayStatsMap[name] || { total: 0, completed: 0 };
    const rate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
    const isToday = dateStr === today;
    const color = isToday
      ? '#0A84FF'
      : rate >= 80
        ? '#30D158'
        : rate >= 50
          ? '#0A84FF'
          : rate > 0
            ? '#FF9F0A'
            : 'rgba(255,255,255,0.08)';
    return { name, rate, total: s.total, completed: s.completed, isToday, color, idx };
  });
  const dayRates = dayPerfData.filter((d) => d.total > 0);
  const bestDay = dayRates.length > 0 ? dayRates.reduce((b, d) => (d.rate > b.rate ? d : b)) : null;
  const worstDay =
    dayRates.length > 1 ? dayRates.reduce((w, d) => (d.rate < w.rate ? d : w)) : null;

  // -- KPI derived values -------------------------------------------------
  const todayKpiColor =
    todayPerformanceScore >= 110 ? '#30D158' : todayPerformanceScore >= 85 ? '#0A84FF' : '#FF9F0A';
  const trendClass = weeklyDeltaTasks > 0 ? 'up' : weeklyDeltaTasks < 0 ? 'down' : 'neutral';
  const trendLabel =
    weeklyDeltaTasks > 0 ? `â†‘ +${weeklyDeltaTasks}` : weeklyDeltaTasks < 0 ? `â†“ ${weeklyDeltaTasks}` : 'â‰ˆ estÃ¡vel';
  const trendTooltip = 'comparado Ã  mÃ©dia dos 7 dias anteriores';

  // -- Habit ranking -----------------------------------------------------
  const habitRanking = allHabitsArr
    .map((h) => ({
      text: h.text,
      rate: getHabitCompletionRate(h.text, 30),
      streak: getHabitStreak(h.text)
    }))
    .sort((a, b) => b.rate - a.rate);

  const habitRankingHTML =
    habitRanking.length === 0
      ? `<div style="padding:20px 0;text-align:center;color:var(--text-tertiary);font-size:13px;line-height:1.6">Nenhum hÃ¡bito rastreado ainda.<br>Adicione hÃ¡bitos na visÃ£o Semana.</div>`
      : habitRanking
          .slice(0, 8)
          .map((h, i) => {
            const medals = ['??', '??', '??'];
            const rank = i < 3 ? medals[i] : `${i + 1}Âº`;
            const rc = h.rate >= 80 ? '#30D158' : h.rate >= 50 ? '#0A84FF' : 'var(--text-tertiary)';
            const bc = h.rate >= 80 ? '#30D158' : h.rate >= 50 ? '#0A84FF' : '#FF9F0A';
            return `<div class="analytics-rank-row">
                
                
                
                
                
                
                
                <span class="analytics-rank-num">${rank}</span>
                
                
                
                
                
                
                
                <span class="analytics-rank-name">${h.text}</span>
                
                
                
                
                
                
                
                <div class="analytics-rank-bar-wrap"><div class="analytics-rank-bar" style="width:${h.rate}%;background:${bc}"></div></div>
                
                
                
                
                
                
                
                <span class="analytics-rank-pct" style="color:${rc}">${h.rate}%</span>
            </div>`;
          })
          .join('');

  // -- Category distribution ---------------------------------------------
  const taskTypes = getTaskTypes();
  const catCounts = {};
  weekDates.forEach(({ dateStr }) => {
    const dt = allTasksData[dateStr] || {};
    Object.entries(dt).forEach(([p, tasks]) => {
      if (p === 'Rotina') return;
      if (Array.isArray(tasks))
        tasks.forEach((t) => {
          const key = t.type || 'OTHER';
          if (!catCounts[key]) catCounts[key] = { total: 0, done: 0 };
          catCounts[key].total++;
          if (t.completed) catCounts[key].done++;
        });
    });
  });
  const catMaxVal = Math.max(...Object.values(catCounts).map((c) => c.total), 1);
  const catHTML =
    Object.keys(catCounts).length === 0
      ? `<div style="padding:16px 0;text-align:center;color:var(--text-tertiary);font-size:13px">Sem dados de categoria esta semana.</div>`
      : Object.entries(catCounts)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([id, c]) => {
            const ti = taskTypes.find((t) => t.id === id) || {
              name: id === 'OTHER' ? 'Sem categoria' : id,
              color: '#86868b'
            };
            const pct = Math.round((c.total / catMaxVal) * 100);
            const donePct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
            return `<div class="analytics-cat-row">
                
                
                
                
                
                
                
                <div class="analytics-cat-dot" style="background:${ti.color}"></div>
                
                
                
                
                
                
                
                <div class="analytics-cat-name">${ti.name}</div>
                
                
                
                
                
                
                
                <div style="font-size:11px;color:var(--text-tertiary);min-width:28px;text-align:right">${donePct}%</div>
                
                
                
                
                
                
                
                <div class="analytics-cat-bar-wrap"><div class="analytics-cat-bar" style="width:${pct}%;background:${ti.color}"></div></div>
                
                
                
                
                
                
                
                <div class="analytics-cat-count">${c.done}/${c.total}</div>
            </div>`;
          })
          .join('');

  // -- 30-day heatmap -----------------------------------------------------
  let heatmapCells = '';
  const heatCur = new Date();
  heatCur.setDate(heatCur.getDate() - 29);
  for (let i = 0; i < 30; i++) {
    const dStr = localDateStr(heatCur);
    const dt = allTasksData[dStr] || {};
    let ht = 0,
      hc = 0;
    Object.entries(dt).forEach(([p, tasks]) => {
      if (p === 'Rotina') return;
      if (Array.isArray(tasks)) {
        ht += tasks.length;
        hc += tasks.filter((t) => t.completed).length;
      }
    });
    const rh = getRoutineTasksForDate(dStr);
    ht += rh.length;
    hc += rh.filter((t) => t.completed).length;
    const rate = ht > 0 ? Math.round((hc / ht) * 100) : 0;
    const bg =
      rate >= 80
        ? '#30D158'
        : rate >= 60
          ? '#0A84FF'
          : rate >= 40
            ? '#FF9F0A'
            : rate > 0
              ? 'rgba(255,69,58,0.55)'
              : 'rgba(255,255,255,0.06)';
    const isToday = dStr === today;
    heatmapCells += `<div class="analytics-heatmap-cell" style="background:${bg};${isToday ? 'outline:2px solid #0A84FF;outline-offset:1px' : ''}" title="${dStr}: ${rate}%">${heatCur.getDate()}</div>`;
    heatCur.setDate(heatCur.getDate() + 1);
  }

  // -- Day performance columns HTML --------------------------------------
  const dayPerfHTML = dayPerfData
    .map((d) => {
      const barH = d.rate > 0 ? Math.max(6, Math.round(d.rate * 0.9)) : 0;
      return `<div class="analytics-day-perf-col ${d.isToday ? 'today-col' : ''}">
            <div class="analytics-day-label">${d.name.substring(0, 3)}</div>
            <div class="analytics-day-rate-v2" style="color:${d.color}">${d.rate > 0 ? d.rate + '%' : 'â€”'}</div>
            <div class="analytics-day-bar-wrap"><div class="analytics-day-bar-fill" style="height:${barH}%;background:${d.color};opacity:${d.total > 0 ? 1 : 0}"></div></div>
            <div class="analytics-day-total">${d.total > 0 ? `${d.completed}/${d.total}` : 'â€“'}</div>
        </div>`;
    })
    .join('');

  // -- Auto-insights -----------------------------------------------------
  const insights = [];
  if (totalTasksToday > 0 && completedTasksToday === totalTasksToday)
    insights.push({
      color: 'green',
      icon: '?',
      title: 'Dia Perfeito!',
      text: 'Todas as tarefas de hoje concluÃ­das. Excelente!'
    });
  if (currentStreak >= 3)
    insights.push({
      color: 'orange',
      icon: '??',
      title: `${currentStreak} Dias de Streak`,
      text: 'Dias consecutivos com 100% das tarefas concluÃ­das!'
    });
  if (habitRate === 100 && totalHabits > 0)
    insights.push({
      color: 'purple',
      icon: '?',
      title: 'HÃ¡bitos Perfeitos',
      text: 'Todos os hÃ¡bitos marcados hoje. ConsistÃªncia mÃ¡xima!'
    });
  if (weekDiff >= 10)
    insights.push({
      color: 'green',
      icon: '??',
      title: 'Semana em Alta',
      text: `+${weekDiff}% vs semana anterior. Crescendo consistentemente!`
    });
  if (weekDiff <= -10)
    insights.push({
      color: 'red',
      icon: '??',
      title: 'Queda de Desempenho',
      text: `${weekDiff}% vs semana anterior. Identifique o que estÃ¡ bloqueando.`
    });
  if (bestDay && bestDay.rate >= 80)
    insights.push({
      color: 'blue',
      icon: '?',
      title: `Destaque: ${bestDay.name}`,
      text: `${bestDay.rate}% de conclusÃ£o â€” seu melhor dia da semana!`
    });
  if (todayPerformanceScore >= 120)
    insights.push({
      color: 'green',
      icon: 'â†—',
      title: 'Acima da tua mÃ©dia',
      text: `Hoje vocÃª entregou ${todayPerformanceScore}% da tua mÃ©dia recente.`
    });
  if (todayPerformanceScore > 0 && todayPerformanceScore < 80)
    insights.push({
      color: 'orange',
      icon: 'â€¢',
      title: 'Abaixo da mÃ©dia',
      text: `Hoje ficou em ${todayPerformanceScore}% da tua mÃ©dia recente.`
    });
  if (insights.length === 0 && weekRate > 0)
    insights.push({
      color: 'blue',
      icon: '??',
      title: 'Continue Evoluindo',
      text: `${Math.round(recent7Avg || 0)} tarefas/dia na Ãºltima semana. Cada dia conta!`
    });
  if (insights.length === 0)
    insights.push({
      color: 'blue',
      icon: '??',
      title: 'Comece Hoje',
      text: 'Adicione tarefas e hÃ¡bitos para ver seus insights aqui.'
    });

  const insightsHTML = insights
    .map(
      (ins) => `
        <div class="analytics-insight-v2 ${ins.color}">
            <div class="analytics-insight-v2-icon">${ins.icon}</div>
            <div>
                
                
                
                
                
                
                
                <div class="analytics-insight-v2-title">${ins.title}</div>
                
                
                
                
                
                
                
                <div class="analytics-insight-v2-text">${ins.text}</div>
            </div>
        </div>`
    )
    .join('');

  // -- Monthly data -------------------------------------------------------
  const nowDate = new Date();
  const nowYear = nowDate.getFullYear(),
    nowMonth = nowDate.getMonth();
  const monthAvgRate = avgCompletedBaseline > 0 ? avgCompletedBaseline.toFixed(1) : '0';

  // -- Week chart data ----------------------------------------------------
  const weekChartData = weekDates.map(({ name }) => {
    const s = dayStatsMap[name] || { total: 0, completed: 0 };
    return s.total > 0 ? Math.round((s.completed / s.total) * 100) : null;
  });
  const weekChartColors = weekChartData.map((v, i) => {
    if (v === null) return 'rgba(255,255,255,0.2)';
    return v >= 80 ? '#30D158' : v >= 50 ? '#0A84FF' : '#FF9F0A';
  });

  // -- BUILD HTML ---------------------------------------------------------
  const analyticsSafe = (value) =>
    Number.isFinite(value) ? Number(value).toFixed(1).replace('.0', '') : '0';
  view.innerHTML = `<div class="flowly-shell flowly-shell--wide"><div class="analytics-container-v2 analytics-container-v3">

        <!-- Outer tabs -->
        ${outerTabsHTML}

        <!-- Header -->
        <div class="analytics-header-v2 flowly-page-header">
            <div>
                
                
                
                
                
                
                
                <h2 class="analytics-title-v2 flowly-page-title">Analytics</h2>
                
                
                
                
                
                
                
                <p class="analytics-subtitle-v2 flowly-page-subtitle">${MONTH_NAMES_PT[nowMonth]} ${nowYear} Â· Semana atual</p>
            </div>
        </div>

        <!-- KPI Grid -->
        <div class="analytics-kpi-grid-v2">
            <div class="analytics-kpi-v2">
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-glow" style="background:radial-gradient(circle,rgba(${todayRate >= 70 ? '48,209,88' : todayRate >= 40 ? '255,159,10' : '255,69,58'},0.18),transparent)"></div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-label"><i data-lucide="activity" style="width:12px;height:12px"></i> Performance Hoje</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-value" style="color:${todayKpiColor}">${todayPerformanceScore}%</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-sub">${todayCompletedVolume} concluÃ­das â€¢ mÃ©dia ${analyticsSafe(avgCompletedBaseline)}</div>
                
                
                
                
                
                
                
                ${todayCompletedVolume > 0 ? `<span class="analytics-kpi-v2-badge ${todayPerformanceScore >= 100 ? 'up' : 'neutral'}">${volumeDelta >= 0 ? 'â†‘' : 'â†“'} ${Math.abs(volumeDelta)} vs mÃ©dia</span>` : ''}
            </div>
            <div class="analytics-kpi-v2">
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-glow" style="background:radial-gradient(circle,rgba(${weekDiff > 0 ? '48,209,88' : weekDiff < 0 ? '255,69,58' : '10,132,255'},0.18),transparent)"></div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-label"><i data-lucide="bar-chart-3" style="width:12px;height:12px"></i> Ritmo semanal</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-value" style="color:${weeklyDeltaTasks > 0 ? '#30D158' : weeklyDeltaTasks < 0 ? '#FF453A' : '#0A84FF'}">${weeklyPerformanceScore}%</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-sub">${recent7Completed} concluÃ­das nos Ãºltimos 7 dias</div>
                
                
                
                
                
                
                
                <span class="analytics-kpi-v2-badge ${trendClass}" title="${trendTooltip}">${trendLabel} vs 7 dias anteriores</span>
            </div>
            <div class="analytics-kpi-v2">
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-glow" style="background:radial-gradient(circle,rgba(191,90,242,0.18),transparent)"></div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-label"><i data-lucide="gauge" style="width:12px;height:12px"></i> ConsistÃªncia</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-value" style="color:${consistencyDays >= 15 ? '#30D158' : consistencyDays >= 8 ? '#0A84FF' : '#BF5AF2'}">${activeHistory.length > 0 ? Math.round((consistencyDays / activeHistory.length) * 100) : 0}%</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-sub">${consistencyDays} dias na/acima da mÃ©dia em 30 dias</div>
            </div>
            <div class="analytics-kpi-v2">
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-glow" style="background:radial-gradient(circle,rgba(255,159,10,0.18),transparent)"></div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-label"><i data-lucide="zap" style="width:12px;height:12px"></i> Capacidade</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-value" style="color:${bestVolumeDay && bestVolumeDay.completed >= 8 ? '#FF9F0A' : bestVolumeDay ? '#30D158' : 'var(--text-tertiary)'}">${bestVolumeDay ? bestVolumeDay.completed : 0}</div>
                
                
                
                
                
                
                
                <div class="analytics-kpi-v2-sub">${bestVolumeDay ? `melhor dia: ${bestVolumeDay.dateStr}` : 'sem histÃ³rico suficiente'}</div>
            </div>
        </div>

        <!-- Day performance strip -->
        <div class="analytics-chart-v2">
            <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2-title"><i data-lucide="bar-chart-2" style="width:14px;height:14px"></i> Desempenho por Dia</div>
                
                
                
                
                
                
                
                <span class="analytics-chart-v2-badge">${weekRate}% semana</span>
            </div>
            <div class="analytics-day-perf-grid">${dayPerfHTML}</div>
        </div>

        <!-- Charts row: week bar + doughnut -->
        <div class="analytics-2col">
            <div class="analytics-chart-v2">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                    <div class="analytics-chart-v2-title"><i data-lucide="bar-chart-2" style="width:14px;height:14px"></i> Progresso Semanal</div>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                <div style="position:relative;height:200px">
                
                
                
                
                
                
                
                    <canvas id="weekChartV2"></canvas>
                
                
                
                
                
                
                
                </div>
            </div>
            <div class="analytics-chart-v2" style="display:flex;flex-direction:column">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                    <div class="analytics-chart-v2-title"><i data-lucide="pie-chart" style="width:14px;height:14px"></i> HÃ¡bitos Hoje</div>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                <div style="flex:1;display:flex;align-items:center;justify-content:center">
                
                
                
                
                
                
                
                    <div style="position:relative;width:160px;height:160px">
                
                
                
                
                
                
                
                        <canvas id="habitsChartV2"></canvas>
                
                
                
                
                
                
                
                        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
                
                
                
                
                
                
                
                            <div style="font-size:30px;font-weight:800;font-family:var(--font-display);color:${habitRate >= 80 ? '#30D158' : '#BF5AF2'};line-height:1">${habitRate}%</div>
                
                
                
                
                
                
                
                            <div style="font-size:10px;color:var(--text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">hÃ¡bitos</div>
                
                
                
                
                
                
                
                        </div>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                <div style="display:flex;justify-content:center;gap:16px;margin-top:14px;font-size:11px;color:var(--text-tertiary)">
                
                
                
                
                
                
                
                    <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:#30D158;display:inline-block"></span>${completedHabitsToday} feitos</span>
                
                
                
                
                
                
                
                    <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.1);display:inline-block"></span>${totalHabits - completedHabitsToday} pendentes</span>
                
                
                
                
                
                
                
                </div>
            </div>
        </div>

        <!-- Monthly evolution -->
        <div class="analytics-chart-v2">
            <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2-title"><i data-lucide="line-chart" style="width:14px;height:14px"></i> Volume diÃ¡rio â€” ${MONTH_NAMES_PT[nowMonth]}</div>
                
                
                
                
                
                
                
                <span class="analytics-chart-v2-badge">MÃ©dia ${monthAvgRate} tarefas/dia</span>
            </div>
            <div style="position:relative;height:180px">
                
                
                
                
                
                
                
                <canvas id="monthChartV2"></canvas>
            </div>
        </div>

        <!-- Ranking + Category -->
        <div class="analytics-2col">
            <div class="analytics-chart-v2">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                    <div class="analytics-chart-v2-title"><i data-lucide="award" style="width:14px;height:14px"></i> Ranking de HÃ¡bitos</div>
                
                
                
                
                
                
                
                    <span class="analytics-chart-v2-badge">30 dias</span>
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                ${habitRankingHTML}
            </div>
            <div style="display:flex;flex-direction:column;gap:12px">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2" style="flex:1">
                
                
                
                
                
                
                
                    <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                        <div class="analytics-chart-v2-title"><i data-lucide="tag" style="width:14px;height:14px"></i> Por Categoria</div>
                
                
                
                
                
                
                
                        <span class="analytics-chart-v2-badge">esta semana</span>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                    ${catHTML}
                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                
                
                
                
                
                
                
                    <div class="analytics-chart-v2" style="padding:16px 14px">
                
                
                
                
                
                
                
                        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-tertiary);margin-bottom:8px;display:flex;align-items:center;gap:5px"><i data-lucide="trophy" style="width:11px;height:11px;color:#30D158"></i> Melhor</div>
                
                
                
                
                
                
                
                        ${bestDay ? `<div style="font-size:18px;font-weight:800;color:#30D158;font-family:var(--font-display)">${bestDay.name.substring(0, 3)}</div><div style="font-size:24px;font-weight:900;font-family:var(--font-display);letter-spacing:-0.04em;color:#30D158">${bestDay.rate}%</div>` : `<div style="font-size:12px;color:var(--text-tertiary);padding:8px 0">Sem dados</div>`}
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                    <div class="analytics-chart-v2" style="padding:16px 14px">
                
                
                
                
                
                
                
                        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-tertiary);margin-bottom:8px;display:flex;align-items:center;gap:5px"><i data-lucide="alert-circle" style="width:11px;height:11px;color:#FF9F0A"></i> AtenÃ§Ã£o</div>
                
                
                
                
                
                
                
                        ${worstDay ? `<div style="font-size:18px;font-weight:800;color:#FF9F0A;font-family:var(--font-display)">${worstDay.name.substring(0, 3)}</div><div style="font-size:24px;font-weight:900;font-family:var(--font-display);letter-spacing:-0.04em;color:#FF9F0A">${worstDay.rate}%</div>` : `<div style="font-size:12px;color:var(--text-tertiary);padding:8px 0">Sem dados</div>`}
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>
            </div>
        </div>

        <!-- 30-day Heatmap -->
        <div class="analytics-chart-v2">
            <div class="analytics-chart-v2-header">
                
                
                
                
                
                
                
                <div class="analytics-chart-v2-title"><i data-lucide="layout-grid" style="width:14px;height:14px"></i> Heatmap de Produtividade</div>
                
                
                
                
                
                
                
                <span class="analytics-chart-v2-badge">30 dias</span>
            </div>
            <div class="analytics-heatmap-grid">${heatmapCells}</div>
            <div style="display:flex;gap:14px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">
                
                
                
                
                
                
                
                <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:3px;background:rgba(255,255,255,0.06)"></div><span style="font-size:10px;color:var(--text-tertiary)">Vazio</span></div>
                
                
                
                
                
                
                
                <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:3px;background:rgba(255,69,58,0.55)"></div><span style="font-size:10px;color:var(--text-tertiary)">&lt;40%</span></div>
                
                
                
                
                
                
                
                <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:3px;background:#FF9F0A"></div><span style="font-size:10px;color:var(--text-tertiary)">40â€“60%</span></div>
                
                
                
                
                
                
                
                <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:3px;background:#0A84FF"></div><span style="font-size:10px;color:var(--text-tertiary)">60â€“80%</span></div>
                
                
                
                
                
                
                
                <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:3px;background:#30D158"></div><span style="font-size:10px;color:var(--text-tertiary)">=80%</span></div>
            </div>
        </div>

        <!-- Smart Insights -->
        <div>
            <div class="analytics-section-label" style="margin-bottom:10px">AnÃ¡lise EstratÃ©gica</div>
            <div class="analytics-insights-v2">${insightsHTML}</div>
        </div>

    </div></div>`;
  if (typeof fixMojibakeText === 'function') {
    view.innerHTML = fixMojibakeText(view.innerHTML);
  }

  view.querySelectorAll('[data-analytics-main-tab]').forEach((btn) => {
    btn.onclick = () => {
      const nextTab = btn.dataset.analyticsMainTab || 'analytics';
      view.dataset.mainTab = nextTab;
      if (nextTab === 'routine' && !view.dataset.routineTab) view.dataset.routineTab = 'today';
      renderAnalyticsView();
    };
  });

  // -- Charts -------------------------------------------------------------
  setTimeout(() => {
    // Destroy any stale Chart.js instances on these canvases
    ['weekChartV2', 'habitsChartV2', 'monthChartV2'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        const existing = Chart.getChart(el);
        if (existing) existing.destroy();
      }
    });

    const chartDefaults = {
      color: '#888',
      gridColor: 'rgba(255,255,255,0.06)',
      tooltipBg: 'rgba(10,10,12,0.92)'
    };

    // Week bar chart
    const weekCtx = document.getElementById('weekChartV2');
    if (weekCtx) {
      new Chart(weekCtx, {
        type: 'bar',
        data: {
          labels: weekDates.map(({ name }) => name.substring(0, 3)),
          datasets: [
            {
              label: 'ConclusÃ£o (%)',
              data: weekChartData,
              backgroundColor: weekChartColors.map((c) => (c.startsWith('#') ? c + 'B3' : c)),
              borderColor: weekChartColors,
              borderWidth: 1.5,
              borderRadius: 8,
              borderSkipped: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: chartDefaults.tooltipBg,
              titleColor: '#ccc',
              bodyColor: '#fff',
              padding: 10,
              callbacks: { label: (item) => ` ${item.raw !== null ? item.raw + '%' : 'Sem dados'}` }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              grid: { color: chartDefaults.gridColor },
              ticks: { color: chartDefaults.color, callback: (v) => v + '%' },
              border: { display: false }
            },
            x: {
              grid: { display: false },
              ticks: { color: chartDefaults.color },
              border: { display: false }
            }
          }
        }
      });
    }

    // Habits doughnut
    const hCtx = document.getElementById('habitsChartV2');
    if (hCtx) {
      const doughnutData =
        totalHabits > 0
          ? [completedHabitsToday, Math.max(0, totalHabits - completedHabitsToday)]
          : [0, 1];
      const doughnutColors =
        totalHabits > 0
          ? ['#30D158', 'rgba(255,255,255,0.06)']
          : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.06)'];
      new Chart(hCtx, {
        type: 'doughnut',
        data: {
          labels: ['ConcluÃ­dos', 'Pendentes'],
          datasets: [
            {
              data: doughnutData,
              backgroundColor: doughnutColors,
              borderWidth: 0,
              hoverBorderWidth: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '76%',
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
    }

    // Monthly line chart
    const monthCtx = document.getElementById('monthChartV2');
    if (monthCtx) {
      new Chart(monthCtx, {
        type: 'line',
        data: {
          labels: monthlyVolumeLabels,
          datasets: [
            {
              label: 'Tarefas concluÃ­das',
              data: monthlyVolumeSeries,
              borderColor: '#0A84FF',
              backgroundColor: 'rgba(10,132,255,0.08)',
              tension: 0.35,
              fill: true,
              borderWidth: 2,
              pointRadius: monthlyVolumeSeries.map((_, i) => (i + 1 === monthlyVolumeSeries.length ? 6 : 3)),
              pointHoverRadius: 7,
              pointBackgroundColor: monthlyVolumeSeries.map((_, i) => (i + 1 === monthlyVolumeSeries.length ? '#f27405' : '#7dd3fc')),
              pointBorderColor: monthlyVolumeSeries.map((_, i) => (i + 1 === monthlyVolumeSeries.length ? '#f27405' : '#7dd3fc')),
              spanGaps: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: chartDefaults.tooltipBg,
              titleColor: '#ccc',
              bodyColor: '#fff',
              padding: 10,
              callbacks: {
                title: (items) => `Dia ${items[0].label}`,
                label: (item) =>
                  item.raw !== null ? ` ${item.raw} tarefa(s) concluÃ­da(s)` : ' Sem tarefas'
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: chartDefaults.gridColor },
              ticks: {
                color: chartDefaults.color,
                callback: (v) => `${v}`,
                precision: 0
              },
              border: { display: false }
            },
            x: {
              grid: { display: false },
              ticks: {
                color: chartDefaults.color,
                maxTicksLimit: 10,
                callback: function (val, index) {
                  const total = monthlyVolumeLabels.length;
                  return index === 0 || index === total - 1 || index % 5 === 0 ? monthlyVolumeLabels[index] : '';
                }
              },
              border: { display: false }
            }
          }
        }
      });
    }

    lucide.createIcons();
  }, 80);
}
