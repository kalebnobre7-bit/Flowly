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

  const recDefinition =
    isRecurring && typeof findRecurringTask === 'function'
      ? findRecurringTask(allRecurringTasks, task)
      : isRecurring
        ? allRecurringTasks.find((rt) => rt.text === task.text)
        : null;
  const repeatedMatch = getProjectOptions().find(
    (project) => task.text && task.text.toLowerCase().includes(project.name.toLowerCase())
  );

  const header = document.createElement('div');
  header.className = 'task-expansion-head';


  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = task.text || '';
  nameInput.className = 'task-expansion-title-input';
  nameInput.setAttribute('maxlength', '180');
  header.appendChild(nameInput);


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
      window.FlowlyDialogs.notify('Ja existe uma rotina com esse nome.', 'warn');
      nameInput.value = oldText;
      return;
    }

    if (isRecurring && recDefinition) {
      recDefinition.text = newText;
      recDefinition._syncPending = true;
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

  const createCard = (label, iconName, modifier = '') => {
    const card = document.createElement('section');
    card.className = `task-expansion-property-row${modifier ? ` ${modifier}` : ''}`;

    const labelContainer = document.createElement('div');
    labelContainer.className = 'task-expansion-property-label';
    if (iconName) {
      labelContainer.innerHTML = `<i data-lucide="${iconName}" style="width:16px;height:16px;color:#fff;"></i>`;
      labelContainer.title = label;
    } else {
      labelContainer.textContent = label;
    }
    card.appendChild(labelContainer);

    const contentContainer = document.createElement('div');
    contentContainer.className = 'task-expansion-property-content';
    card.appendChild(contentContainer);

    // Intercept appendChild to redirect inputs/buttons to the content area effortlessly
    const originalAppend = card.appendChild.bind(card);
    card.appendChild = (el) => {
        if(el === labelContainer || el === contentContainer) return originalAppend(el);
        return contentContainer.appendChild(el);
    };

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

  const projectCard = createCard('Projeto', 'folder');
  const projectSelect = document.createElement('select');
  projectSelect.className = 'task-expansion-select';
  const projectOptions = [{ id: '', name: 'Sem projeto', clientName: '' }, ...getProjectOptions()];
  projectSelect.innerHTML = projectOptions
    .map(
      (project) =>
        `<option value="${project.id}">${project.name}${project.clientName ? ` · ${project.clientName}` : ''}</option>`
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

  const timerCard = createCard(isTimerEligible ? 'Tempo real' : 'Timer', 'play-circle');
  const timerActions = document.createElement('div');
  timerActions.className = 'task-expansion-actions';
  timerCard.appendChild(timerActions);

  const timerValue = document.createElement('strong');
  timerValue.className = 'task-expansion-timer-value';
  timerValue.style.marginRight = 'auto'; // Push actions to the right
  timerValue.style.fontSize = '14px';
  timerActions.appendChild(timerValue);

  const timerToggleBtn = document.createElement('button');
  timerToggleBtn.type = 'button';
  timerToggleBtn.className = 'btn-primary task-expansion-inline-button';
  timerActions.appendChild(timerToggleBtn);

  const timerResetBtn = document.createElement('button');
  timerResetBtn.type = 'button';
  timerResetBtn.className = 'btn-secondary task-expansion-inline-button task-timer-secondary';
  timerResetBtn.innerHTML = '<i data-lucide="rotate-ccw" style="width:14px;height:14px"></i>';
  timerResetBtn.title = 'Zerar Timer';
  timerActions.appendChild(timerResetBtn);

  const timerCompleteBtn = document.createElement('button');
  timerCompleteBtn.type = 'button';
  timerCompleteBtn.className = 'btn-secondary task-expansion-inline-button task-expansion-complete-button task-timer-secondary';
  timerActions.appendChild(timerCompleteBtn);



  let timerInterval = null;
  const refreshTimerCard = () => {
    normalizeTaskTimerData(task);

    if (!isTimerEligible) {
      timerValue.textContent = 'Não disponivel em rotinas';
      timerToggleBtn.disabled = true;
      timerResetBtn.disabled = true;
      timerCompleteBtn.disabled = true;
      timerCompleteBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px"></i>';
      return;
    }

    const totalMs = getTaskTimerTotalMs(task);
    const isRunning = Boolean(task.timerStartedAt);
    timerValue.textContent = formatDurationClock(totalMs);

    timerToggleBtn.disabled = task.completed && !isRunning;
    timerToggleBtn.innerHTML = isRunning 
      ? '<i data-lucide="pause" style="width:14px;height:14px"></i>' 
      : '<i data-lucide="play" style="width:14px;height:14px"></i>';
    timerToggleBtn.title = isRunning ? 'Pausar' : 'Iniciar';

    timerCompleteBtn.disabled = false;
    timerCompleteBtn.innerHTML = task.completed 
      ? '<i data-lucide="calendar-check" style="width:14px;height:14px"></i>' 
      : '<i data-lucide="check" style="width:14px;height:14px"></i>';
    timerCompleteBtn.title = task.completed ? 'Reabrir' : 'Concluir';



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

  const prioCard = createCard('Prioridade', 'flag');
  ensureMoneyPriorityOption();
  const prios = getTaskPriorities();
  let currentPrio = task.priority || null;
  if (isRecurring && recDefinition && recDefinition.priority) currentPrio = recDefinition.priority;

  const applyPrio = (newPrioId) => {
    if (isRecurring && recDefinition) {
      recDefinition.priority = newPrioId;
      recDefinition._syncPending = true;
    } else {
      task.priority = newPrioId;
    }
    persistTaskChanges({ reopen: true });
  };

  const currentPrioObj = prios.find((p) => p.id === currentPrio) || null;
  const prioPicker = document.createElement('div');
  prioPicker.className = 'task-prio-picker';

  const prioTrigger = document.createElement('button');
  prioTrigger.type = 'button';
  prioTrigger.className = 'task-prio-trigger';
  prioTrigger.setAttribute('aria-haspopup', 'listbox');
  prioTrigger.setAttribute('aria-expanded', 'false');
  const triggerDotColor = currentPrioObj ? currentPrioObj.color : 'rgba(255,255,255,0.25)';
  const triggerLabel = currentPrioObj ? currentPrioObj.name : 'Sem prioridade';
  prioTrigger.innerHTML = `
    <span class="task-prio-dot" style="background:${triggerDotColor}"></span>
    <span class="task-prio-label">${triggerLabel}</span>
    <svg class="task-prio-chevron" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
  `;
  prioPicker.appendChild(prioTrigger);

  const prioMenu = document.createElement('div');
  prioMenu.className = 'task-prio-menu';
  prioMenu.setAttribute('role', 'listbox');
  prioMenu.hidden = true;

  const buildPrioItem = (id, name, color, isActive) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `task-prio-item${isActive ? ' is-active' : ''}`;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.innerHTML = `
      <span class="task-prio-dot" style="background:${color}"></span>
      <span class="task-prio-item-label">${name}</span>
      ${isActive ? '<svg class="task-prio-check" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
    `;
    btn.onclick = (e) => {
      e.stopPropagation();
      applyPrio(id);
    };
    return btn;
  };

  prioMenu.appendChild(buildPrioItem(null, 'Sem prioridade', 'rgba(255,255,255,0.25)', currentPrio == null));
  prios.forEach((p) => {
    prioMenu.appendChild(buildPrioItem(p.id, p.name, p.color, currentPrio === p.id));
  });
  prioPicker.appendChild(prioMenu);

  const closePrioMenu = () => {
    prioMenu.hidden = true;
    prioTrigger.setAttribute('aria-expanded', 'false');
  };
  const onDocClickForPrio = (e) => {
    if (!prioPicker.contains(e.target)) closePrioMenu();
  };
  prioTrigger.onclick = (e) => {
    e.stopPropagation();
    const willOpen = prioMenu.hidden;
    prioMenu.hidden = !willOpen;
    prioTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if (willOpen) document.addEventListener('click', onDocClickForPrio);
    else document.removeEventListener('click', onDocClickForPrio);
  };

  prioCard.appendChild(prioPicker);
  grid.appendChild(prioCard);

  const repeatCard = createCard('Repetir', 'repeat-2');
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
    dayBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!recDefinition && !isRecurring) {
        const newRecTask = {
          text: task.text,
          daysOfWeek: [i],
          priority: task.priority || null,
          color: task.color || 'default',
          type: task.type || 'OPERATIONAL',
          createdAt: new Date().toISOString(),
          _syncPending: true,
          order: allRecurringTasks.length
        };
        if (typeof ensureRecurringTaskIdentity === 'function') {
          ensureRecurringTaskIdentity(newRecTask);
        }
        allRecurringTasks.push(newRecTask);
        const sourceTask =
          allTasksData?.[dateStr]?.[period]?.[parseInt(index, 10)] || null;
        let removed = false;

        if (sourceTask && typeof window.deleteTaskOptimistically === 'function') {
          const removal = window.deleteTaskOptimistically(dateStr, period, sourceTask, {
            sync: false,
            render: false
          });
          removed = removal && removal.deleted === true;
        }

        if (!removed && allTasksData[dateStr] && allTasksData[dateStr][period]) {
          allTasksData[dateStr][period].splice(parseInt(index, 10), 1);
          allTasksData[dateStr][period].forEach((entry, entryIndex) => {
            if (!entry || typeof entry !== 'object') return;
            entry.position = entryIndex;
          });
        }

        saveToLocalStorage();
        Promise.all([
          Promise.resolve(syncRecurringTasksToSupabase()),
          Promise.resolve(typeof syncDateToSupabase === 'function' ? syncDateToSupabase(dateStr) : null)
        ]).then(() => renderView());
        return;
      } else if (recDefinition) {
        const dayIndex = activeDays.indexOf(i);
        if (dayIndex >= 0) {
          recDefinition.daysOfWeek.splice(dayIndex, 1);
          if (recDefinition.daysOfWeek.length === 0) {
            const confirmed = await window.FlowlyDialogs.confirm(
              'Deixar sem nenhum dia vai excluir a rotina. Confirmar?',
              {
                title: 'Excluir rotina',
                confirmLabel: 'Excluir',
                tone: 'danger'
              }
            );
            if (confirmed) {
              const recIndex =
                typeof findRecurringTaskIndex === 'function'
                  ? findRecurringTaskIndex(allRecurringTasks, recDefinition)
                  : allRecurringTasks.findIndex((t) => t.text === task.text);
              if (recIndex >= 0) allRecurringTasks.splice(recIndex, 1);
            } else {
              recDefinition.daysOfWeek.push(i);
            }
          }
        } else {
          recDefinition.daysOfWeek.push(i);
        }
        recDefinition._syncPending = true;
        persistTaskChanges({ reopen: true });
      }
    };
    repWrap.appendChild(dayBtn);
  });
  repeatCard.appendChild(repWrap);

  grid.appendChild(repeatCard);

  if (!isRecurring) {
    const moveCard = createCard('Mover', 'calendar');
    const moveRow = document.createElement('div');
    moveRow.className = 'task-expansion-move-row';

    const moveDateInput = document.createElement('input');
    moveDateInput.type = 'date';
    moveDateInput.value = dateStr;
    moveDateInput.className = 'task-expansion-select task-expansion-move-date';
    moveRow.appendChild(moveDateInput);

    const todayDate = localDateStr();
    const tomorrowDate = localDateStr(new Date(Date.now() + 86400000));
    const nextWeekDate = localDateStr(new Date(Date.now() + 7 * 86400000));

    moveRow.appendChild(
      createChoiceChip('Hoje', dateStr === todayDate, null, () => {
        moveDateInput.value = todayDate;
      })
    );
    moveRow.appendChild(
      createChoiceChip('Amanhã', dateStr === tomorrowDate, null, () => {
        moveDateInput.value = tomorrowDate;
      })
    );
    moveRow.appendChild(
      createChoiceChip('+7d', false, null, () => {
        moveDateInput.value = nextWeekDate;
      })
    );

    const movePeriodSelect = document.createElement('select');
    movePeriodSelect.className = 'task-expansion-select task-expansion-move-period';
    movePeriodSelect.title = 'Seção';
    movePeriodSelect.innerHTML = `
      <option value="Tarefas" ${period === 'Tarefas' ? 'selected' : ''}>Tarefas</option>
      <option value="Later" ${period === 'Later' ? 'selected' : ''}>Later</option>
      <option value="Follow-up" ${period === 'Follow-up' ? 'selected' : ''}>Follow-up</option>
    `;
    moveRow.appendChild(movePeriodSelect);

    const applyMove = (targetDate, targetPeriod) => {
      const result = window.moveTaskToDate(dateStr, period, numericIndex, targetDate, targetPeriod);
      if (!result) return;
      if (typeof recordSyncEvent === 'function') {
        recordSyncEvent('move', 'Tarefa movida', {
          from: `${dateStr}/${period}`,
          to: `${targetDate}/${targetPeriod}`,
          text: task.text || ''
        });
      }
    };

    const moveBtn = document.createElement('button');
    moveBtn.type = 'button';
    moveBtn.className = 'btn-secondary task-expansion-inline-button task-expansion-move-confirm';
    moveBtn.innerHTML = '<i data-lucide="arrow-right" style="width:14px;height:14px"></i>';
    moveBtn.title = 'Confirmar Mover';
    moveBtn.onclick = () => {
      applyMove(moveDateInput.value, movePeriodSelect.value || 'Tarefas');
    };
    moveRow.appendChild(moveBtn);

    moveCard.appendChild(moveRow);
    grid.appendChild(moveCard);
  }

  exp.appendChild(grid);

  const footer = document.createElement('div');
  footer.className = 'task-expansion-footer';



  if (!isRecurring) {
    const addSubtaskBtn = document.createElement('button');
    addSubtaskBtn.type = 'button';
    addSubtaskBtn.className = 'btn-secondary task-expansion-inline-button';
    addSubtaskBtn.innerHTML = '<i data-lucide="indent" style="width:14px;height:14px"></i>';
    addSubtaskBtn.title = 'Adicionar Subtarefa';
    addSubtaskBtn.onclick = async (e) => {
      e.stopPropagation();
      const text = await window.FlowlyDialogs.prompt('Digite a subtarefa:', {
        title: 'Nova subtarefa',
        confirmLabel: 'Criar',
        inputPlaceholder: 'Ex.: Melhorar 2 seções'
      });
      const cleanText = String(text || '').trim();
      if (!cleanText || typeof window.createSubtaskForTask !== 'function') return;

      const targetDateStr = renderDateStr || dateStr;
      const targetPeriod = renderPeriod === 'Projetos' ? 'Tarefas' : renderPeriod || period || 'Tarefas';
      const created = window.createSubtaskForTask(task, {
        text: cleanText,
        targetDateStr,
        targetPeriod
      });
      if (created && window.FlowlyDialogs && typeof window.FlowlyDialogs.notify === 'function') {
        window.FlowlyDialogs.notify('Subtarefa criada dentro do projeto.', 'success');
      }
    };
    footer.appendChild(addSubtaskBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'task-expansion-delete';
  delBtn.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px"></i>';
  delBtn.title = 'Excluir';
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
  const confirmed = await window.FlowlyDialogs.confirm('Excluir esta tarefa definitivamente?', {
    title: 'Excluir tarefa',
    confirmLabel: 'Excluir',
    tone: 'danger'
  });
  if (confirmed) {
    // Cancel any pending Realtime-driven re-render so it doesn't race with the optimistic update
    if (window._rtTimeout) {
      clearTimeout(window._rtTimeout);
      window._rtTimeout = null;
    }
    let deleted = false;

    const recIndex =
      isRecurring && typeof findRecurringTaskIndex === 'function'
        ? findRecurringTaskIndex(allRecurringTasks, task)
        : isRecurring
          ? allRecurringTasks.findIndex((t) => t.text === task.text)
          : -1;

    if (isRecurring && recIndex >= 0) {
      if (recIndex >= 0) allRecurringTasks.splice(recIndex, 1);

      const textToRemove = task.text;
      Object.keys(allTasksData).forEach((dStr) => {
        Object.keys(allTasksData[dStr] || {}).forEach((per) => {
          if (Array.isArray(allTasksData[dStr][per])) {
            allTasksData[dStr][per] = allTasksData[dStr][per].filter(
              (t) =>
                t.text !== textToRemove || !(t.isHabit || t.isRecurring || t.isRoutine)
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
      const removal =
        typeof window.deleteTaskOptimistically === 'function'
          ? window.deleteTaskOptimistically(dateStr, period, task, {
              sync: false,
              render: false
            })
          : { deleted: false };
      deleted = removal.deleted === true;
    }

    if (deleted) {
      saveToLocalStorage();
      renderView();
    }

    // Fire backend DELETE after UI is already updated (non-blocking)
    if (!isRecurring) {
      syncDateToSupabase(dateStr).catch((err) => console.error('[Delete] Background sync error:', err));
    }
  }
};
