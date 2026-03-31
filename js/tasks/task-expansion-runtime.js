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
        ? `Em execucao · ${formatDurationClock(getTaskTimerTotalMs(task))}`
        : `Tempo · ${formatDurationClock(getTaskTimerTotalMs(task))}`,
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
      window.FlowlyDialogs.notify('Ja existe uma rotina com esse nome.', 'warn');
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
    dayBtn.onclick = async (e) => {
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
            const confirmed = await window.FlowlyDialogs.confirm(
              'Deixar sem nenhum dia vai excluir a rotina. Confirmar?',
              {
                title: 'Excluir rotina',
                confirmLabel: 'Excluir',
                tone: 'danger'
              }
            );
            if (confirmed) {
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

  if (!isRecurring) {
    const moveCard = createCard('Agenda', 'Mover tarefa', 'task-expansion-card--wide');
    const moveControls = document.createElement('div');
    moveControls.className = 'task-expansion-move-controls';

    const moveDateInput = document.createElement('input');
    moveDateInput.type = 'date';
    moveDateInput.value = dateStr;
    moveDateInput.className = 'finance-input finance-input--full task-expansion-select';
    moveControls.appendChild(moveDateInput);

    const movePeriodSelect = document.createElement('select');
    movePeriodSelect.className = 'finance-input finance-input--full task-expansion-select';
    movePeriodSelect.innerHTML = `
      <option value="Tarefas" ${period === 'Tarefas' ? 'selected' : ''}>Tarefas</option>
      <option value="Later" ${period === 'Later' ? 'selected' : ''}>Later</option>
      <option value="Follow-up" ${period === 'Follow-up' ? 'selected' : ''}>Follow-up</option>
    `;
    moveControls.appendChild(movePeriodSelect);
    moveCard.appendChild(moveControls);

    const quickMoveRow = document.createElement('div');
    quickMoveRow.className = 'task-expansion-chip-row';
    const todayDate = localDateStr();
    const tomorrowDate = localDateStr(new Date(Date.now() + 86400000));
    const nextWeekDate = localDateStr(new Date(Date.now() + 7 * 86400000));

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

    quickMoveRow.appendChild(
      createChoiceChip('Hoje', dateStr === todayDate, null, () => {
        moveDateInput.value = todayDate;
      })
    );
    quickMoveRow.appendChild(
      createChoiceChip('Amanhã', dateStr === tomorrowDate, null, () => {
        moveDateInput.value = tomorrowDate;
      })
    );
    quickMoveRow.appendChild(
      createChoiceChip('Próx. semana', false, null, () => {
        moveDateInput.value = nextWeekDate;
      })
    );
    moveCard.appendChild(quickMoveRow);

    const moveActionRow = document.createElement('div');
    moveActionRow.className = 'task-expansion-actions';
    const moveBtn = document.createElement('button');
    moveBtn.type = 'button';
    moveBtn.className = 'btn-secondary task-expansion-inline-button';
    moveBtn.textContent = 'Mover agora';
    moveBtn.onclick = () => {
      applyMove(moveDateInput.value, movePeriodSelect.value || 'Tarefas');
    };
    moveActionRow.appendChild(moveBtn);
    moveCard.appendChild(moveActionRow);

    const moveHint = document.createElement('p');
    moveHint.className = 'task-expansion-caption task-expansion-caption--show';
    moveHint.textContent = 'Move a tarefa e a árvore inteira de subtarefas para outra data.';
    moveCard.appendChild(moveHint);

    grid.appendChild(moveCard);
  }

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
