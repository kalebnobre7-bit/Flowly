function renderRoutineView(embeddedEl) {
  const isEmbedded = !!embeddedEl;
  const view = embeddedEl || document.getElementById('routineView');
  if (!view) return;

  // Preserve active tab across re-renders
  const activeTab = view.dataset.routineTab || 'today';

  // Onclick strings for tab buttons â€” update correct element and re-render
  const tabClick = (tab) =>
    isEmbedded
      ? `document.getElementById('analyticsView').dataset.routineTab='${tab}';renderAnalyticsView()`
      : `document.getElementById('routineView').dataset.routineTab='${tab}';renderRoutineView()`;

  // -- Constants -----------------------------------------------------------
  const today = new Date();
  const todayStr = localDateStr(today);
  const DAY_NAMES = ['Domingo', 'Segunda', 'TerÃ§a', 'Quarta', 'Quinta', 'Sexta', 'SÃ¡bado'];
  const DAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'SÃ¡b'];
  const DAY_INIT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const MONTH_NAMES = [
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
  ];

  // -- Core Data ------------------------------------------------------------
  const todayTasks = getRoutineTasksForDate(todayStr);
  const totalToday = todayTasks.length;
  const completedToday = todayTasks.filter((t) => t.completed).length;
  const todayPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  const ringColor =
    todayPercent >= 80
      ? '#30D158'
      : todayPercent >= 50
        ? '#0A84FF'
        : todayPercent > 0
          ? '#FF9F0A'
          : 'rgba(255,255,255,0.12)';

  // Weekly stats (last 7 days)
  let totalWeekSch = 0,
    totalWeekComp = 0;
  const weeklyDayData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dStr = localDateStr(d);
    const tasks = getRoutineTasksForDate(dStr);
    const cnt = tasks.length;
    const comp = tasks.filter((t) => t.completed).length;
    if (cnt > 0) {
      totalWeekSch += cnt;
      totalWeekComp += comp;
    }
    weeklyDayData.push({
      abbr: DAY_ABBR[d.getDay()],
      init: DAY_INIT[d.getDay()],
      rate: cnt > 0 ? Math.round((comp / cnt) * 100) : 0,
      total: cnt,
      completed: comp,
      isToday: i === 0,
      dow: d.getDay()
    });
  }
  const weeklyRate = totalWeekSch > 0 ? Math.round((totalWeekComp / totalWeekSch) * 100) : 0;

  // Monthly stats (last 30 days)
  let totalMonth = 0,
    completedMonth = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const tasks = getRoutineTasksForDate(localDateStr(d));
    totalMonth += tasks.length;
    completedMonth += tasks.filter((t) => t.completed).length;
  }
  const monthlyRate = totalMonth > 0 ? Math.round((completedMonth / totalMonth) * 100) : 0;

  // Streak
  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const tasks = getRoutineTasksForDate(localDateStr(d));
    if (tasks.length > 0 && tasks.filter((t) => t.completed).length === tasks.length) {
      currentStreak++;
    } else if (i > 0) break;
  }

  // Best day (last 30 days)
  const perfDayCount = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const tasks = getRoutineTasksForDate(localDateStr(d));
    if (tasks.length > 0 && tasks.filter((t) => t.completed).length === tasks.length)
      perfDayCount[d.getDay()]++;
  }
  const bestDayIdx = perfDayCount.indexOf(Math.max(...perfDayCount));

  // Active habits
  const activeRoutines = allRecurringTasks.filter((t) => t.daysOfWeek && t.daysOfWeek.length > 0);

  // Category distribution (by type)
  const catMap = {};
  const taskTypes = getTaskTypes();
  activeRoutines.forEach((task) => {
    const typeId = task.type || 'OTHER';
    if (!catMap[typeId]) catMap[typeId] = { total: 0, done: 0 };
    catMap[typeId].total++;
    if (habitsHistory[task.text] && habitsHistory[task.text][todayStr]) catMap[typeId].done++;
  });
  const catMaxTotal = Math.max(...Object.values(catMap).map((c) => c.total), 1);

  // -- SVG Ring -------------------------------------------------------------
  const ringR = 52,
    ringCirc = 2 * Math.PI * ringR;
  const ringOffset = ringCirc * (1 - todayPercent / 100);

  // -- 12-week Heatmap -------------------------------------------------------
  const heatWeeks = [];
  for (let w = 11; w >= 0; w--) {
    const week = [];
    for (let d = 6; d >= 0; d--) {
      const offset = w * 7 + d;
      const dt = new Date(today);
      dt.setDate(today.getDate() - offset);
      const dStr = localDateStr(dt);
      const tasks = getRoutineTasksForDate(dStr);
      let bg = 'rgba(255,255,255,0.05)';
      if (tasks.length > 0) {
        const rate = tasks.filter((t) => t.completed).length / tasks.length;
        bg =
          rate >= 1
            ? '#30D158'
            : rate >= 0.7
              ? 'rgba(48,209,88,0.55)'
              : rate >= 0.4
                ? '#FF9F0A'
                : 'rgba(255,69,58,0.45)';
      }
      const isToday = dStr === todayStr;
      week.unshift({ bg, isToday, date: dt.getDate(), dStr });
    }
    heatWeeks.push(week);
  }
  const heatHTML = heatWeeks
    .map(
      (week) =>
        `<div class="routine-heatmap-week-row">${week
          .map(
            (cell) =>
              `<div class="routine-heatmap-cell-v2" style="background:${cell.bg};${cell.isToday ? 'outline:2px solid #0A84FF;outline-offset:1px' : ''}" title="${cell.dStr}"></div>`
          )
          .join('')}</div>`
    )
    .join('');

  // -- Habits HTML ------------------------------------------------------------
  const habitsHTML =
    activeRoutines.length === 0
      ? `<div style="padding:32px 0;text-align:center;color:var(--text-tertiary);font-size:13px;line-height:1.6">
               Nenhum hÃ¡bito configurado ainda.<br>Crie tarefas recorrentes na visÃ£o <b style="color:var(--text-secondary)">Semana</b>.
           </div>`
      : activeRoutines
          .map((task) => {
            let itemTotal = 0,
              itemCompleted = 0,
              runningStreak = 0,
              streakBroken = false;
            for (let i = 0; i < 30; i++) {
              const d = new Date(today);
              d.setDate(today.getDate() - i);
              const dStr = localDateStr(d);
              if (task.daysOfWeek.includes(d.getDay())) {
                itemTotal++;

                const done = habitsHistory[task.text] && habitsHistory[task.text][dStr];

                if (done) {
                  itemCompleted++;

                  if (!streakBroken) runningStreak++;
                } else if (dStr !== todayStr) streakBroken = true;
              }
            }
            const itemRate = itemTotal > 0 ? Math.round((itemCompleted / itemTotal) * 100) : 0;
            const isTodayDone = !!(habitsHistory[task.text] && habitsHistory[task.text][todayStr]);
            const isScheduledToday = task.daysOfWeek.includes(today.getDay());
            const checkClass = isTodayDone ? 'done' : !isScheduledToday ? 'inactive' : '';
            const rateColor =
              itemRate >= 80 ? '#30D158' : itemRate >= 50 ? '#0A84FF' : 'var(--text-tertiary)';
            const typeInfo = taskTypes.find((t) => t.id === task.type);
            const tagHTML = typeInfo
              ? `<span class="routine-habit-tag" style="background:${typeInfo.color}18;color:${typeInfo.color};border-color:${typeInfo.color}30">${typeInfo.name}</span>`
              : '';
            const priorityInfo = getTaskPriorities().find((p) => p.id === task.priority);
            const prioHTML = priorityInfo
              ? `<span class="routine-habit-tag" style="background:${priorityInfo.color}15;color:${priorityInfo.color};border-color:${priorityInfo.color}28">${priorityInfo.name}</span>`
              : '';
            const dayDots = [0, 1, 2, 3, 4, 5, 6]
              .map((dow) => {
                const active = task.daysOfWeek.includes(dow);

                const isNow = dow === today.getDay();

                return `<span class="routine-habit-day-dot" style="background:${active ? (isNow ? '#0A84FF' : 'rgba(255,255,255,0.3)') : 'rgba(255,255,255,0.06)'}"></span>`;
              })
              .join('');
            const safeText = task.text.replace(/'/g, "\\'");
            return `
            <div class="routine-habit-row-v2" onclick="window.toggleHabitToday('${safeText}', ${!isTodayDone})">
                <div class="routine-habit-check-v2 ${checkClass}">
                    <i data-lucide="check" style="width:14px;height:14px;stroke-width:3"></i>
                </div>
                <div style="min-width:0">
                    <div class="routine-habit-name-v2" style="color:${isTodayDone ? 'var(--text-tertiary)' : 'var(--text-primary)'};text-decoration:${isTodayDone ? 'line-through' : 'none'}">${task.text}</div>
                    <div class="routine-habit-meta">
                        <div class="routine-habit-days-track">${dayDots}</div>
                        ${tagHTML}${prioHTML}
                    </div>
                </div>
                <div class="routine-habit-stats">
                    <div class="routine-habit-rate-v2" style="color:${rateColor}">${itemRate}%</div>
                    ${runningStreak > 0 ? `<div class="routine-habit-streak-v2">?? ${runningStreak}d</div>` : `<div style="font-size:10px;color:var(--text-tertiary)">30 dias</div>`}
                </div>
            </div>`;
          })
          .join('');

  // -- Period breakdown (ManhÃ£/Tarde/Noite) ---------------------------------
  const todayAllTasks = allTasksData[todayStr] || {};
  const periods = [
    { key: 'ManhÃ£', label: 'ManhÃ£', icon: '??', color: '#FF9F0A' },
    { key: 'Tarde', label: 'Tarde', icon: '??', color: '#0A84FF' },
    { key: 'Noite', label: 'Noite', icon: '??', color: '#BF5AF2' }
  ];
  const periodHTML = periods
    .map((p) => {
      const tasks = todayAllTasks[p.key] || [];
      const tot = tasks.length,
        done = tasks.filter((t) => t.completed).length;
      const pct = tot > 0 ? Math.round((done / tot) * 100) : 0;
      return `<div class="routine-period-card">
            <div class="routine-period-icon" style="background:${p.color}15">${p.icon}</div>
            <div class="routine-period-label">${p.label}</div>
            <div class="routine-period-fraction" style="color:${p.color}">${done}<span style="font-size:13px;font-weight:400;color:var(--text-tertiary)">/${tot > 0 ? tot : 'â€“'}</span></div>
            <div class="routine-period-bar"><div class="routine-period-bar-fill" style="width:${pct}%;background:${p.color}"></div></div>
        </div>`;
    })
    .join('');

  // -- Weekly column view ----------------------------------------------------
  const weeklyColsHTML = weeklyDayData
    .map((day) => {
      const barH = day.rate > 0 ? Math.max(6, Math.round(day.rate * 0.8)) : 0;
      const barColor = day.isToday
        ? '#0A84FF'
        : day.rate >= 80
          ? '#30D158'
          : day.rate >= 50
            ? '#0A84FF'
            : day.rate > 0
              ? '#FF9F0A'
              : 'rgba(255,255,255,0.08)';
      return `<div class="routine-weekly-day-col ${day.isToday ? 'today' : ''}">
            <div class="routine-weekly-day-label">${day.abbr.substring(0, 3)}</div>
            <div class="routine-weekly-rate" style="color:${barColor}">${day.rate > 0 ? day.rate + '%' : 'â€”'}</div>
            <div class="routine-weekly-bar"><div class="routine-weekly-bar-fill" style="height:${barH}%;background:${barColor};opacity:${day.total > 0 ? 1 : 0}"></div></div>
            <div class="routine-weekly-tasks-count">${day.total > 0 ? `${day.completed}/${day.total}` : 'â€“'}</div>
        </div>`;
    })
    .join('');

  // -- Category distribution HTML --------------------------------------------
  const catHTML =
    Object.entries(catMap).length === 0
      ? `<div style="padding:16px 0;text-align:center;color:var(--text-tertiary);font-size:13px">Sem dados de categoria</div>`
      : Object.entries(catMap)
          .map(([id, c]) => {
            const ti = taskTypes.find((t) => t.id === id) || { name: id, color: '#888' };
            return `<div class="routine-category-row">
                <div class="routine-category-dot" style="background:${ti.color}"></div>
                <div class="routine-category-name">${ti.name}</div>
                <div class="routine-category-bar-wrap"><div class="routine-category-bar-fill" style="width:${Math.round((c.total / catMaxTotal) * 100)}%;background:${ti.color}"></div></div>
                <div class="routine-category-count" style="color:${ti.color}">${c.done}/${c.total}</div>
            </div>`;
          })
          .join('');

  // -- Streak Badge ----------------------------------------------------------
  const streakBadge =
    currentStreak >= 7
      ? `<span class="routine-streak-badge fire">?? ${currentStreak} dias de sequÃªncia</span>`
      : currentStreak >= 3
        ? `<span class="routine-streak-badge orange" style="background:rgba(255,159,10,0.1);border-color:rgba(255,159,10,0.25);color:#FF9F0A">? ${currentStreak} dias consecutivos</span>`
        : todayPercent === 100 && totalToday > 0
          ? `<span class="routine-streak-badge green">? Dia perfeito!</span>`
          : weeklyRate >= 80
            ? `<span class="routine-streak-badge blue">?? Semana excelente â€” ${weeklyRate}%</span>`
            : '';

  // -- TAB CONTENT -----------------------------------------------------------
  let tabContent = '';

  if (activeTab === 'today') {
    tabContent = `
        <div class="routine-section-card">
            <div class="routine-section-header">
                <i data-lucide="clock" style="width:14px;height:14px"></i>
                Tarefas por PerÃ­odo
                <span class="routine-badge">${(todayAllTasks['ManhÃ£'] || []).length + (todayAllTasks['Tarde'] || []).length + (todayAllTasks['Noite'] || []).length}</span>
            </div>
            <div class="routine-period-grid">${periodHTML}</div>
        </div>

        <div class="routine-section-card">
            <div class="routine-section-header">
                <i data-lucide="check-circle" style="width:14px;height:14px"></i>
                HÃ¡bitos de Hoje
                <span class="routine-badge">${completedToday}/${totalToday}</span>
            </div>
            <div class="routine-habits-list">${habitsHTML}</div>
            <button onclick="setView('week')"
                style="width:100%;margin-top:14px;padding:11px;font-size:13px;font-weight:600;color:var(--text-secondary);background:rgba(255,255,255,0.04);border:1px solid var(--border-subtle);border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:background 0.15s,color 0.15s"
                onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.color='var(--text-primary)'"
                onmouseout="this.style.background='rgba(255,255,255,0.04)';this.style.color='var(--text-secondary)'">
                Gerenciar HÃ¡bitos <i data-lucide="arrow-right" style="width:14px;height:14px"></i>
            </button>
        </div>

        ${
          Object.keys(catMap).length > 0
            ? `
        <div class="routine-section-card">
            <div class="routine-section-header">
                <i data-lucide="tag" style="width:14px;height:14px"></i>
                DistribuiÃ§Ã£o por Categoria
            </div>
            ${catHTML}
        </div>`
            : ''
        }`;
  } else if (activeTab === 'week') {
    tabContent = `
        <div class="routine-section-card">
            <div class="routine-section-header">
                <i data-lucide="bar-chart-2" style="width:14px;height:14px"></i>
                ConsistÃªncia â€” Esta Semana
                <span class="routine-badge">${weeklyRate}%</span>
            </div>
            <div class="routine-weekly-grid">${weeklyColsHTML}</div>
        </div>

        <div class="routine-section-card">
            <div class="routine-section-header">
                <i data-lucide="repeat" style="width:14px;height:14px"></i>
                HÃ¡bitos
                <span class="routine-badge">${activeRoutines.length}</span>
            </div>
            <div class="routine-habits-list">${habitsHTML}</div>
        </div>`;
  } else if (activeTab === 'month') {
    tabContent = `
        <div class="routine-section-card">
            <div class="routine-section-header">
                <i data-lucide="layout-grid" style="width:14px;height:14px"></i>
                HistÃ³rico â€” 12 Semanas
                <span class="routine-badge">${monthlyRate}% (30d)</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px;text-align:center">
                ${DAY_ABBR.map((d) => `<span style="font-size:10px;font-weight:700;color:var(--text-tertiary)">${d.charAt(0)}</span>`).join('')}
            </div>
            <div class="routine-heatmap-12w">${heatHTML}</div>
            <div class="routine-heatmap-legend" style="margin-top:14px">
                <div><div style="width:10px;height:10px;border-radius:3px;background:rgba(255,255,255,0.05)"></div><span>Vazio</span></div>
                <div><div style="width:10px;height:10px;border-radius:3px;background:rgba(255,69,58,0.45)"></div><span>&lt;40%</span></div>
                <div><div style="width:10px;height:10px;border-radius:3px;background:#FF9F0A"></div><span>40â€“70%</span></div>
                <div><div style="width:10px;height:10px;border-radius:3px;background:rgba(48,209,88,0.55)"></div><span>70â€“99%</span></div>
                <div><div style="width:10px;height:10px;border-radius:3px;background:#30D158"></div><span>100%</span></div>
            </div>
        </div>

        <div class="routine-section-card">
            <div class="routine-section-header">
                <i data-lucide="pie-chart" style="width:14px;height:14px"></i>
                HÃ¡bitos por Categoria
            </div>
            ${catHTML.replace(/done\/total/g, '') || `<div style="padding:16px 0;text-align:center;color:var(--text-tertiary);font-size:13px">Sem hÃ¡bitos com categoria</div>`}
        </div>`;
  }

  // -- FULL HTML -------------------------------------------------------------
  view.innerHTML = `
    <div class="routine-container">
        <div class="routine-header">
            <div>
                <h2 class="routine-title">Rotina</h2>
                <p class="routine-subtitle">${DAY_NAMES[today.getDay()]}, ${today.getDate()} de ${MONTH_NAMES[today.getMonth()]}</p>
            </div>
            <div class="routine-view-tabs">
                <button class="routine-tab-btn ${activeTab === 'today' ? 'active' : ''}" onclick="${tabClick('today')}">Hoje</button>
                <button class="routine-tab-btn ${activeTab === 'week' ? 'active' : ''}"  onclick="${tabClick('week')}">Semana</button>
                <button class="routine-tab-btn ${activeTab === 'month' ? 'active' : ''}" onclick="${tabClick('month')}">Mensal</button>
            </div>
        </div>

        <div class="routine-score-card">
            <div class="routine-ring-wrap">
                <svg width="130" height="130" viewBox="0 0 130 130" style="display:block">
                    <circle cx="65" cy="65" r="${ringR}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="11"/>
                    <circle cx="65" cy="65" r="${ringR}" fill="none" stroke="${ringColor}" stroke-width="11"
                        stroke-dasharray="${ringCirc.toFixed(2)}" stroke-dashoffset="${ringOffset.toFixed(2)}"
                        stroke-linecap="round" transform="rotate(-90 65 65)"
                        style="transition:stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1),stroke 0.4s ease"/>
                </svg>
                <div class="routine-ring-center">
                    <span class="routine-ring-pct" style="color:${ringColor}">${todayPercent}%</span>
                    <span class="routine-ring-label">Hoje</span>
                </div>
            </div>
            <div class="routine-score-info">
                <div class="routine-score-label">Progresso do Dia</div>
                <div class="routine-score-count">${completedToday}<span>/${totalToday}</span></div>
                <div class="routine-score-sub">hÃ¡bitos concluÃ­dos hoje</div>
                <div class="routine-progress-bar">
                    <div class="routine-progress-bar-fill" style="width:${todayPercent}%;background:${ringColor}"></div>
                </div>
                ${streakBadge}
            </div>
        </div>

        <div class="routine-metrics-strip">
            <div class="routine-metric-pill">
                <div class="routine-metric-pill-icon"><i data-lucide="flame" style="width:16px;height:16px;color:#FF9F0A"></i></div>
                <div class="routine-metric-pill-val" style="color:${currentStreak >= 7 ? '#FF9F0A' : currentStreak > 0 ? '#30D158' : 'var(--text-tertiary)'}">${currentStreak}</div>
                <div class="routine-metric-pill-lbl">Streak</div>
            </div>
            <div class="routine-metric-pill">
                <div class="routine-metric-pill-icon"><i data-lucide="trending-up" style="width:16px;height:16px;color:#0A84FF"></i></div>
                <div class="routine-metric-pill-val" style="color:${weeklyRate >= 80 ? '#30D158' : '#0A84FF'}">${weeklyRate}%</div>
                <div class="routine-metric-pill-lbl">Semana</div>
            </div>
            <div class="routine-metric-pill">
                <div class="routine-metric-pill-icon"><i data-lucide="calendar" style="width:16px;height:16px;color:#30D158"></i></div>
                <div class="routine-metric-pill-val" style="color:${monthlyRate >= 70 ? '#30D158' : '#0A84FF'}">${monthlyRate}%</div>
                <div class="routine-metric-pill-lbl">30 Dias</div>
            </div>
            <div class="routine-metric-pill">
                <div class="routine-metric-pill-icon"><i data-lucide="trophy" style="width:16px;height:16px;color:#BF5AF2"></i></div>
                <div class="routine-metric-pill-val" style="color:#BF5AF2">${DAY_ABBR[bestDayIdx]}</div>
                <div class="routine-metric-pill-lbl">Melhor Dia</div>
            </div>
        </div>

        ${tabContent}
    </div>`;

  if (window.lucide) lucide.createIcons();
}

function deleteWeeklyRecurringTask(index) {
  if (!confirm('Remover esta tarefa semanal recorrente?')) return;
  weeklyRecurringTasks.splice(index, 1);
  localStorage.setItem('weeklyRecurringTasks', JSON.stringify(weeklyRecurringTasks));
  renderSettingsView();
}

async function deleteEmptyTasks() {
  if (
    !confirm(
      'Tem certeza que deseja excluir todas as tarefas vazias (sem texto)?\n\nEsta aÃ§Ã£o nÃ£o pode ser desfeita!'
    )
  )
    return;

  let deletedCount = 0;

  Object.entries(allTasksData).forEach(([dateStr, periods]) => {
    Object.entries(periods).forEach(([period, tasks]) => {
      if (Array.isArray(tasks)) {
        const beforeLength = tasks.length;
        const filteredTasks = tasks.filter((task) => task.text && task.text.trim() !== '');
        const afterLength = filteredTasks.length;

        deletedCount += beforeLength - afterLength;

        allTasksData[dateStr][period] = filteredTasks;

        if (filteredTasks.length === 0) {
          delete allTasksData[dateStr][period];
        }
      }
    });

    if (Object.keys(allTasksData[dateStr]).length === 0) {
      delete allTasksData[dateStr];
    }
  });

  if (currentUser) {
    try {
      await supabaseClient
        .from('tasks')
        .delete()
        .eq('user_id', currentUser.id)
        .or('text.is.null,text.eq.');
    } catch (error) {
      console.error('Erro ao deletar tarefas vazias do Supabase:', error);
    }
  }

  saveToLocalStorage();
  renderView();

  alert(`${deletedCount} tarefa(s) vazia(s) foram excluÃ­das!`);
}

function bindWeeklyDayButtons() {
  document.querySelectorAll('.weekly-day-btn').forEach((btn) => {
    if (btn.dataset.weeklyBound === '1') return;
    btn.dataset.weeklyBound = '1';
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.toggle('selected');
      btn.classList.toggle('active');
    });
  });
}

function showWeeklyRecurrenceDialog() {
  const modal = document.getElementById('weeklyModal');
  document.getElementById('weeklyTaskText').value = '';
  bindWeeklyDayButtons();
  document.querySelectorAll('.weekly-day-btn').forEach((b) => {
    b.classList.remove('selected');
    b.classList.remove('active');
  });
  modal.classList.add('show');
  setTimeout(() => {
    document.getElementById('weeklyTaskText').focus();
    lucide.createIcons();
  }, 100);
}

function getWeeklyRecurringForDay(dateStr, dayOfWeek) {
  const existingTexts = new Set();
  Object.values(allTasksData[dateStr] || {}).forEach((tasks) => {
    if (Array.isArray(tasks))
      tasks.forEach((t) => {
        if (t.text) existingTexts.add(t.text);
      });
  });
  return allRecurringTasks
    .filter((rt) => {
      if (!rt.daysOfWeek || !rt.daysOfWeek.includes(dayOfWeek)) return false;
      if (existingTexts.has(rt.text)) return false;

      const rawStart = rt.startDate || rt.createdAt || rt.created_at;
      if (!rawStart) return true;

      const parsed = new Date(rawStart);
      if (!Number.isFinite(parsed.getTime())) return true;

      const startKey = localDateStr(new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
      return dateStr >= startKey;
    })
    .map((rt) => ({
      text: rt.text,
      completed: false,
      color: rt.color,
      isHabit: rt.isHabit,
      isRecurring: true
    }));
}

window.renderRoutineView = renderRoutineView;
window.deleteWeeklyRecurringTask = deleteWeeklyRecurringTask;
window.deleteEmptyTasks = deleteEmptyTasks;
window.bindWeeklyDayButtons = bindWeeklyDayButtons;
window.showWeeklyRecurrenceDialog = showWeeklyRecurrenceDialog;
window.getWeeklyRecurringForDay = getWeeklyRecurringForDay;
