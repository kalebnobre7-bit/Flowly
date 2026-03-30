// --- Supabase & Storage Logic ---
const SUPABASE_URL = window._FLOWLY_SUPABASE_URL || '';
const SUPABASE_KEY = window._FLOWLY_SUPABASE_KEY || '';
const { createClient } = window.supabase;
const FLOWLY_DEBUG =
  localStorage.getItem((window.FlowlyConfig && window.FlowlyConfig.DEBUG_KEY) || 'flowly_debug') ===
  'true';

function debugLog(...args) {
  if (FLOWLY_DEBUG) {
    console.log(...args);
  }
}

// Inicializar flowly_persist_session como true por padrÃ£o (checkbox vem marcado)
if (localStorage.getItem('flowly_persist_session') === null) {
  localStorage.setItem('flowly_persist_session', 'true');
}

const customStorage = {
  getItem: (key) => {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    debugLog('[Storage] getItem:', key, value ? 'found' : 'not found');
    return value;
  },
  setItem: (key, value) => {
    const shouldPersist = localStorage.getItem('flowly_persist_session') !== 'false';
    debugLog('[Storage] setItem:', key, 'persist:', shouldPersist);
    if (shouldPersist) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    debugLog('[Storage] removeItem:', key);
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'flowly-auth'
  }
});

const width = 600;
// Estado compartilhado carregado via js/flowly-state.js

function renderSyncStatus() {
  const bar = document.getElementById('syncStatusBar');
  const textEl = document.getElementById('syncStatusText');
  if (!bar || !textEl) return;

  bar.dataset.state = syncStatus.state;
  textEl.textContent = syncStatus.text;
  bar.classList.toggle('hidden', false);
}

function setSyncStatus(state, text, options = {}) {
  if (syncStatus.hideTimer) {
    clearTimeout(syncStatus.hideTimer);
    syncStatus.hideTimer = null;
  }

  syncStatus.state = state;
  syncStatus.text = text;
  renderSyncStatus();

  if (options.autoSaved) {
    syncStatus.lastSavedAt = Date.now();
    syncStatus.hideTimer = setTimeout(() => {
      if (syncStatus.state === 'saved') {
        syncStatus.text = 'Tudo salvo';
        renderSyncStatus();
      }
    }, options.autoSaved);
  }
}

function startSyncActivity(text = 'Sincronizando...') {
  syncStatus.busyCount += 1;
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? text : 'Sem conexao');
}

function finishSyncActivity(success = true, errorText = '') {
  syncStatus.busyCount = Math.max(0, syncStatus.busyCount - 1);
  if (!navigator.onLine) {
    setSyncStatus('offline', 'Sem conexao');
    return;
  }
  if (!success) {
    setSyncStatus('error', errorText || 'Falha ao sincronizar');
    return;
  }
  if (syncStatus.busyCount > 0) {
    setSyncStatus('syncing', 'Sincronizando...');
    return;
  }
  setSyncStatus('saved', 'Tudo salvo na nuvem', { autoSaved: 2200 });
}

// View Management Functions
function setView(view) {
  // Redirect routine to analytics with routine tab active
  if (view === 'routine') {
    const av = document.getElementById('analyticsView');
    if (av) av.dataset.mainTab = 'routine';
    view = 'analytics';
  }
  currentView = view;

  // Hide all views
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
  views.forEach((v) => {
    const el = document.getElementById(v);
    if (el) el.classList.add('hidden');
  });

  // Update navigation buttons
  document.querySelectorAll('.segment-btn, .sidebar-nav-btn').forEach((btn) => btn.classList.remove('active'));
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

  // Show week navigation only for week view
  const weekNav = document.getElementById('weekNav');
  if (weekNav) {
    weekNav.style.display = view === 'week' ? 'flex' : 'none';
  }

  renderView();
}

// Utilitarios compartilhados carregados via js/flowly-utils.js e js/core/*.js
function getRoutineKey(task) {
  if (!task) return '';
  return task.routineKey || task.supabaseId || task.text || '';
}

// Helper para JSON seguro
// Estado base carregado via js/flowly-state.js

function getTaskTypes() {
  if (customTaskTypes && customTaskTypes.length > 0) return customTaskTypes;
  return [
    { id: 'MONEY', name: 'Money', color: '#30D158' },
    { id: 'BODY', name: 'Body', color: '#5E5CE6' },
    { id: 'MIND', name: 'Mind', color: '#BF5AF2' },
    { id: 'SPIRIT', name: 'Spirit', color: '#FFD60A' },
    { id: 'OPERATIONAL', name: 'Operational', color: '#8E8E93' }
  ];
}

function getDefaultTaskPriorities() {
  return [
    { id: 'money', name: 'Dinheiro', color: '#30D158' },
    { id: 'urgent', name: 'Urgente', color: '#FF453A' },
    { id: 'important', name: 'Importante', color: '#FF9F0A' },
    { id: 'simple', name: 'Simples', color: '#FFD60A' }
  ];
}

function getTaskPriorities() {
  if (customTaskPriorities && customTaskPriorities.length > 0) return customTaskPriorities;
  return getDefaultTaskPriorities();
}

function ensureMoneyPriorityOption() {
  const defaults = getDefaultTaskPriorities();
  if (!Array.isArray(customTaskPriorities) || customTaskPriorities.length === 0) {
    customTaskPriorities = defaults.map((item) => ({ ...item }));
    return;
  }

  const existingMap = new Map(customTaskPriorities.map((item) => [String(item.id || '').toLowerCase(), item]));
  customTaskPriorities = defaults.map((item) => {
    const existing = existingMap.get(String(item.id).toLowerCase());
    return existing ? { ...existing, name: item.name, color: item.color } : { ...item };
  });
}

// Estruturas compartilhadas carregadas via js/flowly-state.js
// Estado de recorr?ncia carregado via js/flowly-state.js


// FunÃ§Ã£o para abrir o modal de ediÃ§Ã£o
window.toggleTaskExpansion = function (task, el) {
  const isExpanded =
    el.nextElementSibling && el.nextElementSibling.classList.contains('task-expansion');

  // Close other expansions smoothly
  document.querySelectorAll('.task-expansion').forEach((exp) => {
    if (typeof exp._cleanup === 'function') exp._cleanup();
    exp.style.opacity = '0';
    exp.style.maxHeight = '0px';
    exp.style.marginTop = '0px';
    exp.style.marginBottom = '0px';
    setTimeout(() => exp.remove(), 200);
  });

  if (isExpanded) return;

  const renderDateStr = el.dataset.date;
  const { period: renderPeriod, index: renderIndex } = el.dataset;
  const dateStr = el.dataset.sourceDate || renderDateStr;
  const period = el.dataset.sourcePeriod || renderPeriod;
  const index = el.dataset.sourceIndex || renderIndex;
  const numericIndex = Number(index);
  const isRecurring = !el.dataset.sourceDate && index === '-1';
  const isTimerEligible =
    !isRecurring && !task.isHabit && !task.isRoutine && !task.isRecurring && period !== 'Rotina';

  normalizeTaskTimerData(task);

  const exp = document.createElement('div');
  exp.className = 'task-expansion task-expansion--minimal';
  exp.style.opacity = '0';
  exp.style.maxHeight = '0px';
  exp.style.marginTop = '0px';
  exp.style.marginBottom = '0px';

  const reopenExpansion = () => {
    setTimeout(() => {
      const nextEl = Array.from(document.querySelectorAll('.task-item')).find(
        (node) =>
          node.dataset.date === renderDateStr &&
          node.dataset.period === renderPeriod &&
          node.dataset.index === String(renderIndex)
      );
      if (!nextEl) return;

      const nextTask = isRecurring ? task : allTasksData?.[dateStr]?.[period]?.[numericIndex];
      if (!nextTask) return;
      window.toggleTaskExpansion(nextTask, nextEl);
    }, 55);
  };

  const persistTaskChanges = ({ reopen = false, syncWholeDate = false } = {}) => {
    saveToLocalStorage();
    if (isRecurring) {
      syncRecurringTasksToSupabase();
    } else if (syncWholeDate) {
      syncDateToSupabase(dateStr);
    } else {
      syncTaskToSupabase(dateStr, period, task);
    }
    renderView();
    if (reopen) reopenExpansion();
  };

  const recDefinition = isRecurring ? allRecurringTasks.find((rt) => rt.text === task.text) : null;
  const repeatedMatch = getProjectOptions().find(
    (project) => task.text && task.text.toLowerCase().includes(project.name.toLowerCase())
  );

  const header = document.createElement('div');
  header.className = 'task-expansion-head';

  const kicker = document.createElement('div');
  kicker.className = 'task-expansion-kicker';
  kicker.textContent = isRecurring ? 'Rotina' : task.completed ? 'Concluida' : 'Tarefa';
  header.appendChild(kicker);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = task.text || '';
  nameInput.className = 'finance-input finance-input--full task-expansion-title-input';
  nameInput.setAttribute('maxlength', '180');
  header.appendChild(nameInput);

  const metaRow = document.createElement('div');
  metaRow.className = 'task-expansion-meta';

  const appendMetaPill = (text, modifier = '') => {
    const pill = document.createElement('span');
    pill.className = `task-expansion-meta-pill${modifier ? ` ${modifier}` : ''}`;
    pill.textContent = text;
    metaRow.appendChild(pill);
  };

  if (task.projectName) appendMetaPill(task.projectName);
  if (task.priority) {
    const prio = getTaskPriorities().find((item) => item.id === task.priority);
    if (prio) appendMetaPill(prio.name);
  }
  if (isTimerEligible && (task.timerStartedAt || getTaskTimerTotalMs(task) > 0)) {
    appendMetaPill(
      task.timerStartedAt
        ? `Em execucao Â· ${formatDurationClock(getTaskTimerTotalMs(task))}`
        : `Tempo Â· ${formatDurationClock(getTaskTimerTotalMs(task))}`,
      task.timerStartedAt ? 'is-running' : ''
    );
  }
  if (task.completed && task.completedAt) appendMetaPill(`Feita ${formatTimeSince(task.completedAt)}`);
  if (metaRow.childNodes.length > 0) header.appendChild(metaRow);
  exp.appendChild(header);

  const applyTaskRename = async () => {
    const newText = nameInput.value.trim();
    const oldText = task.text || '';

    if (!newText || newText === oldText) {
      nameInput.value = oldText;
      return;
    }

    if (
      isRecurring &&
      allRecurringTasks.some((t) => t !== recDefinition && String(t.text || '') === newText)
    ) {
      alert('Ja existe uma rotina com esse nome.');
      nameInput.value = oldText;
      return;
    }

    if (isRecurring && recDefinition) {
      recDefinition.text = newText;
      task.text = newText;

      if (habitsHistory[oldText] && !habitsHistory[newText]) {
        habitsHistory[newText] = habitsHistory[oldText];
        delete habitsHistory[oldText];
      }

      Object.values(allTasksData || {}).forEach((periods) => {
        Object.values(periods || {}).forEach((tasks) => {
          if (!Array.isArray(tasks)) return;
          tasks.forEach((entry) => {
            if (!entry || entry.text !== oldText) return;
            if (entry.isHabit || entry.isRecurring || entry.isRoutine) entry.text = newText;
          });
        });
      });

      saveToLocalStorage();
      syncRecurringTasksToSupabase();
      if (currentUser && supabaseClient) {
        supabaseClient
          .from('habits_history')
          .update({ habit_name: newText })
          .eq('user_id', currentUser.id)
          .eq('habit_name', oldText);
      }
      renderView();
      return;
    }

    task.text = newText;
    persistTaskChanges({ reopen: true });
  };

  nameInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyTaskRename();
    }
  };
  nameInput.onblur = () => {
    applyTaskRename();
  };

  const grid = document.createElement('div');
  grid.className = 'task-expansion-grid';

  const createCard = (eyebrow, title, modifier = '') => {
    const card = document.createElement('section');
    card.className = `task-expansion-card${modifier ? ` ${modifier}` : ''}`;

    const eyebrowEl = document.createElement('div');
    eyebrowEl.className = 'task-expansion-card-eyebrow';
    eyebrowEl.textContent = eyebrow;
    card.appendChild(eyebrowEl);

    const titleEl = document.createElement('h4');
    titleEl.className = 'task-expansion-card-title';
    titleEl.textContent = title;
    card.appendChild(titleEl);

    return card;
  };

  const createChoiceChip = (text, isActive, activeColor, onClick) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `task-choice-chip${isActive ? ' is-active' : ''}`;
    btn.textContent = text;
    if (isActive && activeColor) {
      btn.style.borderColor = `${activeColor}33`;
      btn.style.background = `${activeColor}1A`;
      btn.style.color = activeColor;
    }
    btn.onclick = (e) => {
      e.stopPropagation();
      onClick();
    };
    return btn;
  };

  const projectCard = createCard('Contexto', 'Projeto');
  const projectSelect = document.createElement('select');
  projectSelect.className = 'finance-input finance-input--full task-expansion-select';
  const projectOptions = [{ id: '', name: 'Sem projeto', clientName: '' }, ...getProjectOptions()];
  projectSelect.innerHTML = projectOptions
    .map(
      (project) =>
        `<option value="${project.id}">${project.name}${project.clientName ? ` Â· ${project.clientName}` : ''}</option>`
    )
    .join('');
  projectSelect.value = task.projectId || '';
  projectSelect.onchange = () => {
    const project = getProjectOptions().find((item) => item.id === projectSelect.value) || null;
    const targetTasks = isRecurring
      ? [task]
      : collectTaskSubtree(allTasksData?.[dateStr]?.[period] || [], task);
    targetTasks.forEach((entry) => {
      entry.projectId = project ? project.id : null;
      entry.projectName = project ? project.name : '';
    });
    persistTaskChanges({ reopen: true, syncWholeDate: !isRecurring });
  };
  projectCard.appendChild(projectSelect);
  if (!task.projectId && repeatedMatch) {
    const suggest = document.createElement('button');
    suggest.type = 'button';
    suggest.className = 'btn-secondary task-expansion-inline-button';
    suggest.textContent = `Sugerir: ${repeatedMatch.name}`;
    suggest.onclick = () => {
      const targetTasks = isRecurring
        ? [task]
        : collectTaskSubtree(allTasksData?.[dateStr]?.[period] || [], task);
      targetTasks.forEach((entry) => {
        entry.projectId = repeatedMatch.id;
        entry.projectName = repeatedMatch.name;
      });
      persistTaskChanges({ reopen: true, syncWholeDate: !isRecurring });
    };
    projectCard.appendChild(suggest);
  }
  grid.appendChild(projectCard);

  const timerCard = createCard('Execucao', isTimerEligible ? 'Tempo real' : 'Timer');
  const timerValue = document.createElement('strong');
  timerValue.className = 'task-expansion-timer-value';
  timerCard.appendChild(timerValue);

  const timerStatus = document.createElement('span');
  timerStatus.className = 'task-expansion-timer-status';
  timerCard.appendChild(timerStatus);

  const timerHint = document.createElement('p');
  timerHint.className = 'task-expansion-timer-hint';
  timerCard.appendChild(timerHint);

  const timerActions = document.createElement('div');
  timerActions.className = 'task-expansion-actions';
  timerCard.appendChild(timerActions);

  const timerToggleBtn = document.createElement('button');
  timerToggleBtn.type = 'button';
  timerToggleBtn.className = 'btn-primary task-expansion-inline-button';
  timerActions.appendChild(timerToggleBtn);

  const timerResetBtn = document.createElement('button');
  timerResetBtn.type = 'button';
  timerResetBtn.className = 'btn-secondary task-expansion-inline-button';
  timerResetBtn.textContent = 'Zerar';
  timerActions.appendChild(timerResetBtn);

  const timerCompleteBtn = document.createElement('button');
  timerCompleteBtn.type = 'button';
  timerCompleteBtn.className = 'btn-secondary task-expansion-inline-button task-expansion-complete-button';
  timerActions.appendChild(timerCompleteBtn);

  const timerMeta = document.createElement('div');
  timerMeta.className = 'task-expansion-caption';
  timerCard.appendChild(timerMeta);

  let timerInterval = null;
  const refreshTimerCard = () => {
    normalizeTaskTimerData(task);

    if (!isTimerEligible) {
      timerValue.textContent = 'Disponivel so para tarefas do dia';
      timerStatus.textContent = 'Rotinas seguem outro fluxo.';
      timerHint.textContent = 'Use o timer em tarefas normais para medir execucao real.';
      timerToggleBtn.disabled = true;
      timerResetBtn.disabled = true;
      timerCompleteBtn.disabled = true;
      timerCompleteBtn.textContent = 'Concluir';
      timerMeta.textContent = '';
      return;
    }

    const totalMs = getTaskTimerTotalMs(task);
    const isRunning = Boolean(task.timerStartedAt);
    timerValue.textContent = formatDurationClock(totalMs);
    timerStatus.textContent = task.completed
      ? 'Concluida'
      : isRunning
        ? 'Rodando agora'
        : totalMs > 0
          ? 'Tempo acumulado'
          : 'Nenhuma sessao ainda';
    timerHint.textContent = isRunning
      ? 'Quando pausar ou concluir, o tempo fecha automaticamente.'
      : task.completed && totalMs > 0
        ? `Fechada com ${formatDurationClock(totalMs)} registrados.`
        : task.completed
          ? 'Tarefa concluida e registrada.'
      : task.timerLastStoppedAt
        ? `Ultima pausa ${formatTimeSince(task.timerLastStoppedAt)}.`
        : 'Inicie quando comecar a executar de verdade.';
    timerToggleBtn.disabled = task.completed && !isRunning;
    timerToggleBtn.textContent = isRunning ? 'Pausar' : totalMs > 0 ? 'Retomar' : 'Iniciar';
    timerCompleteBtn.disabled = false;
    timerCompleteBtn.textContent = task.completed ? 'Reabrir' : 'Concluir';
    timerMeta.textContent =
      task.completed && task.completedAt
        ? `Feita ${formatTimeSince(task.completedAt)}`
        : Number(task.timerSessionsCount || 0) > 0
        ? `${Math.max(1, Number(task.timerSessionsCount || 0))} sessao(oes)`
        : 'Sem historico ainda';

    if (isRunning && !timerInterval) {
      timerInterval = setInterval(refreshTimerCard, 1000);
    } else if (!isRunning && timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };

  timerToggleBtn.onclick = () => {
    if (!isTimerEligible) return;

    const nowIso = new Date().toISOString();
    const syncDates = new Set([dateStr]);

    if (task.timerStartedAt) {
      stopTaskTimer(task, nowIso);
    } else {
      startTaskTimer(task, nowIso).forEach((entry) => syncDates.add(entry.dateStr));
    }

    saveToLocalStorage();
    renderView();
    reopenExpansion();
    (async () => {
      for (const syncDate of syncDates) await syncDateToSupabase(syncDate);
    })();
  };

  timerResetBtn.onclick = () => {
    if (!isTimerEligible) return;
    resetTaskTimer(task);
    persistTaskChanges({ reopen: true });
  };

  timerCompleteBtn.onclick = () => {
    if (!isTimerEligible) return;

    const nowIso = new Date().toISOString();
    if (task.completed) {
      task.completed = false;
      task.completedAt = null;
    } else {
      if (task.timerStartedAt) {
        stopTaskTimer(task, nowIso);
      }
      task.completed = true;
      task.completedAt = nowIso;
    }

    persistTaskChanges({ reopen: true });
  };

  refreshTimerCard();
  exp._cleanup = () => {
    if (timerInterval) clearInterval(timerInterval);
  };
  grid.appendChild(timerCard);

  const prioCard = createCard('Sinal', 'Prioridade', 'task-expansion-card--wide');
  ensureMoneyPriorityOption();
  const prios = getTaskPriorities();
  let currentPrio = task.priority || null;
  if (isRecurring && recDefinition && recDefinition.priority) currentPrio = recDefinition.priority;
  const priosWrap = document.createElement('div');
  priosWrap.className = 'task-expansion-chip-row';
  prios.forEach((p) => {
    priosWrap.appendChild(
      createChoiceChip(p.name, currentPrio === p.id, p.color, () => {
        const newPrio = task.priority === p.id ? null : p.id;
        if (isRecurring && recDefinition) {
          recDefinition.priority = newPrio;
        } else {
          task.priority = newPrio;
        }
        persistTaskChanges({ reopen: true });
      })
    );
  });
  prioCard.appendChild(priosWrap);
  grid.appendChild(prioCard);

  const repeatCard = createCard('Cadencia', 'Repetir', 'task-expansion-card--wide');
  const days = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  let activeDays = recDefinition ? recDefinition.daysOfWeek || [] : [];
  const repWrap = document.createElement('div');
  repWrap.className = 'task-expansion-days';
  days.forEach((d, i) => {
    const dayBtn = document.createElement('button');
    const isActive = activeDays.includes(i);
    dayBtn.type = 'button';
    dayBtn.className = `task-day-chip${isActive ? ' is-active' : ''}`;
    dayBtn.textContent = d;
    dayBtn.onclick = (e) => {
      e.stopPropagation();
      if (!recDefinition && !isRecurring) {
        const newRecTask = {
          text: task.text,
          daysOfWeek: [i],
          priority: task.priority || null,
          color: task.color || 'default',
          type: task.type || 'OPERATIONAL',
          createdAt: new Date().toISOString()
        };
        allRecurringTasks.push(newRecTask);
        if (allTasksData[dateStr] && allTasksData[dateStr][period]) {
          allTasksData[dateStr][period].splice(parseInt(index, 10), 1);
        }
        saveToLocalStorage();
        syncRecurringTasksToSupabase().then(renderView);
        return;
      } else if (recDefinition) {
        const dayIndex = activeDays.indexOf(i);
        if (dayIndex >= 0) {
          recDefinition.daysOfWeek.splice(dayIndex, 1);
          if (recDefinition.daysOfWeek.length === 0) {
            if (confirm('Deixar sem nenhum dia excluirÃ¡ a rotina. Confirmar?')) {
              allRecurringTasks = allRecurringTasks.filter((t) => t.text !== task.text);
            } else {
              recDefinition.daysOfWeek.push(i);
            }
          }
        } else {
          recDefinition.daysOfWeek.push(i);
        }
        persistTaskChanges({ reopen: true });
      }
    };
    repWrap.appendChild(dayBtn);
  });
  repeatCard.appendChild(repWrap);
  const repeatHint = document.createElement('p');
  repeatHint.className = 'task-expansion-caption';
  repeatHint.textContent = recDefinition
    ? 'Ativar dias aqui ajusta a rotina original.'
    : 'Clique em um dia para transformar essa tarefa em recorrente.';
  repeatCard.appendChild(repeatHint);
  grid.appendChild(repeatCard);

  exp.appendChild(grid);

  const footer = document.createElement('div');
  footer.className = 'task-expansion-footer';

  const summary = document.createElement('span');
  summary.className = 'task-expansion-caption';
  if (isTimerEligible && (task.timerStartedAt || getTaskTimerTotalMs(task) > 0)) {
    summary.textContent = task.timerStartedAt
      ? `Em execucao ha ${formatElapsedShort(getTaskTimerTotalMs(task))}`
      : `Total rastreado ${formatDurationClock(getTaskTimerTotalMs(task))}`;
  } else {
    summary.textContent = task.projectName
      ? `Vinculada a ${task.projectName}`
      : 'Sem projeto vinculado ainda';
  }
  footer.appendChild(summary);

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'task-expansion-delete';
  delBtn.innerHTML = '<i data-lucide="trash-2" style="width:13px;height:13px"></i> Excluir';
  delBtn.onclick = (e) => {
    e.stopPropagation();
    window.deleteTaskInline(task, dateStr, period, index, isRecurring);
  };
  footer.appendChild(delBtn);
  exp.appendChild(footer);

  el.after(exp);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => {
    exp.style.opacity = '1';
    exp.style.maxHeight = `${Math.max(280, exp.scrollHeight + 32)}px`;
    exp.style.marginTop = '8px';
    exp.style.marginBottom = '8px';
  });
};

window.deleteTaskInline = async function (task, dateStr, period, _indexStr, isRecurring) {
  if (confirm('Excluir esta tarefa definitivamente?')) {
    // Cancel any pending Realtime-driven re-render so it doesn't race with the optimistic update
    if (window._rtTimeout) {
      clearTimeout(window._rtTimeout);
      window._rtTimeout = null;
    }
    let deleted = false;

    if (isRecurring || allRecurringTasks.some((t) => t.text === task.text)) {
      const recIndex = allRecurringTasks.findIndex((t) => t.text === task.text);
      if (recIndex >= 0) allRecurringTasks.splice(recIndex, 1);

      const textToRemove = task.text;
      Object.keys(allTasksData).forEach((dStr) => {
        Object.keys(allTasksData[dStr] || {}).forEach((per) => {
          if (Array.isArray(allTasksData[dStr][per])) {
            allTasksData[dStr][per] = allTasksData[dStr][per].filter(
              (t) => t.text !== textToRemove
            );
            if (allTasksData[dStr][per].length === 0) delete allTasksData[dStr][per];
          }
        });
        if (Object.keys(allTasksData[dStr] || {}).length === 0) delete allTasksData[dStr];
      });
      syncRecurringTasksToSupabase();
      deleted = true;
    }

    if (!isRecurring) {
      // OPTIMISTIC DELETE: update local state and re-render IMMEDIATELY (synchronous),
      // then fire the Supabase DELETE in the background.
      // This avoids a race where a pending Realtime loadDataFromSupabase() runs during
      // the network await and re-renders the task before the splice happens.
      if (allTasksData[dateStr]?.[period]) {
        const localIdx = allTasksData[dateStr][period].findIndex(
          (t) => (task.supabaseId && t.supabaseId === task.supabaseId) || t.text === task.text
        );
        if (localIdx >= 0) {
          allTasksData[dateStr][period].splice(localIdx, 1);
          if (allTasksData[dateStr][period].length === 0) delete allTasksData[dateStr][period];
          if (Object.keys(allTasksData[dateStr] || {}).length === 0) delete allTasksData[dateStr];
        }
      }
      deleted = true;
    }

    if (deleted) {
      saveToLocalStorage();
      renderView();
    }

    // Fire backend DELETE after UI is already updated (non-blocking)
    if (!isRecurring) {
      deleteTaskFromSupabase(task, dateStr, period).catch((err) =>
        console.error('[Delete] Background sync error:', err)
      );
    }
  }
};

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



// ===== FUNÃ‡Ã•ES DE SALVAMENTO =====
// Persistencia local movida para js/core/app-storage.js


// ===== DRAG AND DROP =====

// Retorna tarefas de rotina para exibiÃ§Ã£o (NÃƒO persiste em allTasksData)
function getRoutineTasksForDate(dateStr) {
  if (routineService) return routineService.getRoutineTasksForDate(dateStr);
  return [];
}

// Compatibilidade: manter hydrateRoutineForDate como no-op para nÃ£o quebrar chamadas existentes
function hydrateRoutineForDate(dateStr) {
  // NÃ£o faz mais nada - rotinas sÃ£o geradas dinamicamente
}

function reorderRoutineTasksForDate(dateStr, sourceRoutineKey, insertAt) {
  if (!sourceRoutineKey) return false;

  const routineKeys = getRoutineTasksForDate(dateStr)
    .map((task) => getRoutineKey(task))
    .filter(Boolean);

  const sourceIdx = routineKeys.indexOf(sourceRoutineKey);
  if (sourceIdx < 0) return false;

  let targetIdx = Number.isFinite(insertAt) ? insertAt : routineKeys.length;
  if (sourceIdx < targetIdx) targetIdx -= 1;

  routineKeys.splice(sourceIdx, 1);
  targetIdx = Math.max(0, Math.min(targetIdx, routineKeys.length));
  routineKeys.splice(targetIdx, 0, sourceRoutineKey);

  const desiredOrder = new Map(routineKeys.map((key, idx) => [key, idx]));
  const recurringIndices = [];
  const recurringSubset = [];

  allRecurringTasks.forEach((task, idx) => {
    const key = getRoutineKey(task);
    if (!desiredOrder.has(key)) return;
    recurringIndices.push(idx);
    recurringSubset.push(task);
  });

  if (recurringSubset.length > 1) {
    recurringSubset.sort(
      (a, b) => desiredOrder.get(getRoutineKey(a)) - desiredOrder.get(getRoutineKey(b))
    );
    recurringIndices.forEach((globalIdx, subsetIdx) => {
      allRecurringTasks[globalIdx] = recurringSubset[subsetIdx];
    });
  }

  saveToLocalStorage();
  if (typeof syncRecurringTasksToSupabase === 'function') {
    syncRecurringTasksToSupabase();
  }

  return true;
}

// Fallback: drop na coluna (nÃ£o em drop zone) â†’ insere no fim da lista do dia
function columnDropFallback(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!draggedTask || draggedTask.isRoutineDrag) return;

  const col = e.target.closest('.day-column');
  if (!col) return;

  const targetDateStr = col.dataset.date;
  const targetPeriod = 'Tarefas';
  const sourceDateStr = draggedTask.dateStr;
  const sourcePeriod = draggedTask.period;
  const sourceIndex = draggedTask.index;

  const targetList = allTasksData?.[targetDateStr]?.[targetPeriod] || [];
  const moveResult = moveTaskSubtree({
    sourceDateStr,
    sourcePeriod,
    sourceIndex,
    targetDateStr,
    targetPeriod,
    insertAt: targetList.length
  });

  if (moveResult.moved) {
    saveToLocalStorage();
    (moveResult.datesToSync || []).forEach((date) => syncDateToSupabase(date));
  }

  draggedTask = null;
  renderView();
}

// Helper Time Formatter (Global)
function formatTaskTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getViewSettings() {
  return safeJSONParse(localStorage.getItem('flowly_view_settings'), {});
}

function getWeekDates(weekOffset = 0) {
  const today = new Date();
  const viewSettings = getViewSettings();
  const weekStart = viewSettings.weekStart === 'sun' ? 'sun' : 'mon';
  const showWeekends = viewSettings.showWeekends !== false;

  const currentDay = today.getDay(); // 0 = Domingo
  const startDiff = weekStart === 'sun' ? -currentDay : currentDay === 0 ? -6 : 1 - currentDay;

  const startDate = new Date(today);
  startDate.setDate(today.getDate() + startDiff + weekOffset * 7);
  startDate.setHours(0, 0, 0, 0);

  const dayNames =
    weekStart === 'sun'
      ? ['Domingo', 'Segunda', 'TerÃ§a', 'Quarta', 'Quinta', 'Sexta', 'SÃ¡bado']
      : ['Segunda', 'TerÃ§a', 'Quarta', 'Quinta', 'Sexta', 'SÃ¡bado', 'Domingo'];

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dayIndex = date.getDay();
    const isWeekend = dayIndex === 0 || dayIndex === 6;
    if (!showWeekends && isWeekend) continue;

    dates.push({
      name: dayNames[i],
      date: date,
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

  const format = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
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

// --- Core Functions ---

async function checkAuth() {
  if (!authSession) return false;
  return authSession.checkAuth();
}

async function signUp(email, password) {
  if (!authSession) return false;
  const result = await authSession.signUp(
    email,
    password,
    () => !allTasksData || Object.keys(allTasksData).length === 0
  );
  if (!result.ok) {
    showAuthMessage(result.error);
    return false;
  }

  showAuthMessage('Conta criada! Fazendo login...', 'success');
  return true;
}

async function signIn(email, password) {
  if (!authSession) return false;
  const result = await authSession.signIn(
    email,
    password,
    () => !allTasksData || Object.keys(allTasksData).length === 0
  );
  if (!result.ok) {
    showAuthMessage(result.error);
    return false;
  }
  return true;
}

async function signOut() {
  if (!authSession) return;
  await authSession.signOut();
}

// --- Sync Logic ---

async function migrateLocalDataToSupabase() {
  if (!tasksRepo) return;
  await tasksRepo.migrateLocalDataToSupabase();
}

async function loadDataFromSupabase() {
  if (!tasksRepo) return;
  await tasksRepo.loadDataFromSupabase();
  await loadFinanceStateFromSupabase();
  await loadProjectsStateFromSupabase();
}
async function syncDailyRoutineToSupabase() {
  // Deprecated or Legacy handled silently
}

// Sincroniza allRecurringTasks com Supabase de forma inteligente (Diff Sync)
// Runtime de sincronizacao movido para js/core/sync-runtime.js


// Bootstrap de servicos movido para js/core/service-bootstrap.js
initializeFlowlyServices();


// renderMonth movido para js/views/month.js
function goToDate(dateStr) {
  // Calcular qual semana essa data estÃ¡
  const targetDate = new Date(dateStr);
  const today = new Date();
  const diffTime = targetDate - today;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  currentWeekOffset = Math.floor(diffDays / 7);

  // Mudar para view semanal
  setView('week');
}

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
  const MONTH_SHORT = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez'
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
  let heatWeeks = [];
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
      (week, wi) =>
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
        <!-- Period breakdown -->
        <div class="routine-section-card">
            <div class="routine-section-header">
                
                
                
                
                
                
                
                <i data-lucide="clock" style="width:14px;height:14px"></i>
                
                
                
                
                
                
                
                Tarefas por PerÃ­odo
                
                
                
                
                
                
                
                <span class="routine-badge">${(todayAllTasks['ManhÃ£'] || []).length + (todayAllTasks['Tarde'] || []).length + (todayAllTasks['Noite'] || []).length}</span>
            </div>
            <div class="routine-period-grid">${periodHTML}</div>
        </div>

        <!-- Habits List -->
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
        <!-- Category distribution -->
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
        <!-- Weekly columns -->
        <div class="routine-section-card">
            <div class="routine-section-header">
                
                
                
                
                
                
                
                <i data-lucide="bar-chart-2" style="width:14px;height:14px"></i>
                
                
                
                
                
                
                
                ConsistÃªncia â€” Esta Semana
                
                
                
                
                
                
                
                <span class="routine-badge">${weeklyRate}%</span>
            </div>
            <div class="routine-weekly-grid">${weeklyColsHTML}</div>
        </div>

        <!-- Habits with weekly performance -->
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
        <!-- 12-week heatmap -->
        <div class="routine-section-card">
            <div class="routine-section-header">
                
                
                
                
                
                
                
                <i data-lucide="layout-grid" style="width:14px;height:14px"></i>
                
                
                
                
                
                
                
                HistÃ³rico â€” 12 Semanas
                
                
                
                
                
                
                
                <span class="routine-badge">${monthlyRate}% (30d)</span>
            </div>
            <!-- Day labels -->
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

        <!-- Category breakdown over month -->
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
        <!-- Header -->
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

        <!-- Score Hero Card -->
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

        <!-- Metrics Strip -->
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

        <!-- Tab Content -->
        ${tabContent}
    </div>`;

  if (window.lucide) lucide.createIcons();
}

// Sexta controller movido para js/views/sexta-controller.js


// renderFinanceView movido para js/views/finance.js


// renderProjectsView movido para js/views/projects.js

// renderSettingsView movido para js/views/settings.js

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

  // Percorrer todas as datas
  Object.entries(allTasksData).forEach(([dateStr, periods]) => {
    Object.entries(periods).forEach(([period, tasks]) => {
      if (Array.isArray(tasks)) {
        // Filtrar tarefas vazias
        const beforeLength = tasks.length;
        const filteredTasks = tasks.filter((task) => task.text && task.text.trim() !== '');
        const afterLength = filteredTasks.length;

        deletedCount += beforeLength - afterLength;

        // Atualizar array
        allTasksData[dateStr][period] = filteredTasks;

        // Remover perÃ­odo se ficou vazio
        if (filteredTasks.length === 0) {
          delete allTasksData[dateStr][period];
        }
      }
    });

    // Remover data se nÃ£o tem mais perÃ­odos
    if (Object.keys(allTasksData[dateStr]).length === 0) {
      delete allTasksData[dateStr];
    }
  });

  // Deletar tarefas vazias do Supabase
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

// FunÃ§Ã£o para mostrar modal de criaÃ§Ã£o de tarefa semanal recorrente
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
  // Limpar seleÃ§Ã£o de dias
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

// Retorna as tarefas recorrentes semanais de um dia (apenas para exibiÃ§Ã£o, sem persistir)
function getWeeklyRecurringForDay(dateStr, dayOfWeek) {
  // Usa allRecurringTasks como fonte Ãºnica
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

function renderView() {
  if (!viewDispatcher && window.FlowlyViews) {
    viewDispatcher = window.FlowlyViews.createDispatcher({
      renderMonth,
      renderAnalyticsView,
      renderFinanceView,
      renderProjectsView,
      renderSextaView,
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

// renderWeek movido para js/views/week.js
// task tree helpers movidos para js/tasks/flowly-tasks-core.js

// task ui helpers movidos para js/tasks/flowly-tasks-ui.js

function normalizeAllTasks() {
  let hasChanges = false;
  const recurringTextsSet = new Set(allRecurringTasks.map((rt) => rt.text));

  Object.entries(allTasksData).forEach(([dateStr, periods]) => {
    // Remover completamente o perÃ­odo 'Rotina' se existir (nunca deve ser persistido)
    if (periods['Rotina']) {
      delete periods['Rotina'];
      hasChanges = true;
    }
    // Remover flag de hidrataÃ§Ã£o antiga (nÃ£o mais utilizado)
    if (periods._routineHydrated) {
      delete periods._routineHydrated;
      hasChanges = true;
    }

    Object.entries(periods).forEach(([period, tasks]) => {
      if (Array.isArray(tasks)) {
        // Normalizar: remover APENAS se for flag antiga explÃ­cita
        const filtered = tasks.filter((task) => {
          // Remover tarefas que sÃ£o marcadas explicitamente como legado de recorrÃªncia
          if (task.isWeeklyRecurring || task.isRoutine || task.isRecurring) return false;

          // NÃƒO remover apenas pelo texto. Isso causava sumiÃ§o de tarefas manuais duplicadas.
          // if (task.text && recurringTextsSet.has(task.text)) return false;

          return true;
        });
        if (filtered.length !== tasks.length) {
          allTasksData[dateStr][period] = filtered;
          hasChanges = true;
        }
        allTasksData[dateStr][period].forEach((task) => {
          if (task.text === undefined || task.text === null) {
            task.text = '';
            hasChanges = true;
          }
          if (normalizeTaskTimerData(task)) {
            hasChanges = true;
          }
        });
        // Limpar perÃ­odo vazio
        if (allTasksData[dateStr][period].length === 0) {
          delete allTasksData[dateStr][period];
          hasChanges = true;
        }
      }
    });
    // Limpar data vazia
    if (Object.keys(allTasksData[dateStr] || {}).length === 0) {
      delete allTasksData[dateStr];
      hasChanges = true;
    }
  });

  if (hasChanges) {
    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
    debugLog('Banco normalizado e limpo de artefatos legados.');
    if (document.getElementById('btnFixDuplicates'))
      alert('Banco corrigido com sucesso! Tarefas legadas removidas.');
  } else {
    if (document.getElementById('btnFixDuplicates')) alert('Nenhum problema encontrado no banco.');
  }
}

// Handler do botÃ£o Corrigir Banco (garantir que existe)
document.addEventListener('click', (e) => {
  if (e.target.closest('#btnFixDuplicates')) {
    if (
      confirm(
        'Isso irÃ¡ limpar vestÃ­gios de tarefas antigas (legado) para evitar duplicaÃ§Ãµes visuais. Suas tarefas recorrentes configuradas NÃƒO serÃ£o afetadas.\n\nDeseja continuar?'
      )
    ) {
      normalizeAllTasks();
      renderView();
    }
  }
});

loadFromLocalStorage();
normalizeAllTasks(); // Normalizar tarefas antigas
// checkAuth agora Ã© chamado via onAuthStateChange (INITIAL_SESSION)
// setTimeout(checkAuth, 100);

// Inicializar Ã­cones Lucide
if (window.lucide) {
  lucide.createIcons();
}
renderSyncStatus();

const flowlyAuthSessionFactory = window.FlowlyAuthSession;
if (flowlyAuthSessionFactory) {
  authSession = flowlyAuthSessionFactory.create({
    supabaseClient,
    debugLog,
    setCurrentUser: (user) => {
      currentUser = user;
    },
    getCurrentUser: () => currentUser,
    onSessionDataRequired: async () => {
      await loadDataFromSupabase();
      await syncUnsyncedTasksToSupabase();
      renderView();
    },
    onSignedOut: () => {
      location.reload();
    },
    migrateLocalDataToSupabase
  });

  authSession.init(() => !allTasksData || Object.keys(allTasksData).length === 0);
}

window.addEventListener('online', () => {
  setSyncStatus('syncing', 'Conexao restabelecida. Sincronizando...');
  scheduleUnsyncedTasksSync(300);
});

window.addEventListener('offline', () => {
  // Reset busyCount so finishSyncActivity won't block status transition when coming back online
  syncStatus.busyCount = 0;
  setSyncStatus('offline', 'Sem conexao. Salvando no dispositivo');
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleUnsyncedTasksSync(500);
});

setInterval(() => {
  if (document.hidden) return;
  scheduleUnsyncedTasksSync(0);
}, 15000);

setInterval(() => {
  if (document.hidden) return;
  refreshInlineTaskTimers();
}, 1000);
// ========================================
// PWA - Service Worker & Notificacoes
// ========================================

const flowlyPwa = window.FlowlyPwa
  ? window.FlowlyPwa.create({
      supabaseClient,
      getCurrentUser: () => currentUser,
      debugLog
    })
  : null;

if (flowlyPwa) {
  flowlyPwa.initServiceWorker();
}

// Metricas do dia e notificacoes de progresso movidas para:
// - js/core/task-metrics.js
// - js/core/progress-notifications.js

// ========================================
// Fim PWA
// ========================================

// Expose functions to window for HTML onclick compatibility
// Bootstrap da interface movido para js/core/ui-bootstrap.js


