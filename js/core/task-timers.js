function normalizeTaskTimerData(task) {
  if (!task || typeof task !== 'object') return false;

  let changed = false;
  const normalizedTotal = Math.max(0, Number(task.timerTotalMs || 0) || 0);
  if (task.timerTotalMs !== normalizedTotal) {
    task.timerTotalMs = normalizedTotal;
    changed = true;
  }

  const normalizedSessions = Math.max(0, Math.floor(Number(task.timerSessionsCount || 0) || 0));
  if (task.timerSessionsCount !== normalizedSessions) {
    task.timerSessionsCount = normalizedSessions;
    changed = true;
  }

  if (task.timerStartedAt) {
    const startedTs = new Date(task.timerStartedAt).getTime();
    if (!Number.isFinite(startedTs)) {
      task.timerStartedAt = null;
      changed = true;
    }
  } else if (task.timerStartedAt !== null) {
    task.timerStartedAt = null;
    changed = true;
  }

  if (task.timerLastStoppedAt) {
    const stoppedTs = new Date(task.timerLastStoppedAt).getTime();
    if (!Number.isFinite(stoppedTs)) {
      task.timerLastStoppedAt = null;
      changed = true;
    }
  } else if (task.timerLastStoppedAt !== null) {
    task.timerLastStoppedAt = null;
    changed = true;
  }

  return changed;
}

function getTaskTimerTotalMs(task, now = Date.now()) {
  if (!task) return 0;
  normalizeTaskTimerData(task);

  let total = Math.max(0, Number(task.timerTotalMs || 0) || 0);
  if (!task.timerStartedAt) return total;

  const startedTs = new Date(task.timerStartedAt).getTime();
  if (!Number.isFinite(startedTs)) return total;

  return total + Math.max(0, now - startedTs);
}

function forEachPersistedTask(callback) {
  Object.entries(allTasksData || {}).forEach(([dateStr, periods]) => {
    Object.entries(periods || {}).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks)) return;
      tasks.forEach((task, index) => {
        if (!task || task.isWeeklyRecurring || task.isRoutine || task.isRecurring) return;
        callback(task, { dateStr, period, index });
      });
    });
  });
}

function stopTaskTimer(task, stoppedAtIso = new Date().toISOString()) {
  if (!task) return false;
  normalizeTaskTimerData(task);
  if (!task.timerStartedAt) return false;

  const startedTs = new Date(task.timerStartedAt).getTime();
  const stoppedTs = new Date(stoppedAtIso).getTime();
  const elapsedMs =
    Number.isFinite(startedTs) && Number.isFinite(stoppedTs)
      ? Math.max(0, stoppedTs - startedTs)
      : 0;

  task.timerTotalMs = Math.max(0, Number(task.timerTotalMs || 0) + elapsedMs);
  task.timerStartedAt = null;
  task.timerLastStoppedAt = stoppedAtIso;
  task.updatedAt = stoppedAtIso;
  return true;
}

function stopOtherActiveTaskTimers(currentTask, stoppedAtIso = new Date().toISOString()) {
  const affectedEntries = [];

  forEachPersistedTask((task, ctx) => {
    if (task === currentTask || !task.timerStartedAt) return;
    if (stopTaskTimer(task, stoppedAtIso)) affectedEntries.push(ctx);
  });

  return affectedEntries;
}

function startTaskTimer(task, startedAtIso = new Date().toISOString()) {
  if (!task) return [];
  normalizeTaskTimerData(task);

  const affectedEntries = stopOtherActiveTaskTimers(task, startedAtIso);
  if (!task.timerStartedAt) {
    task.timerStartedAt = startedAtIso;
    task.timerSessionsCount = Math.max(0, Number(task.timerSessionsCount || 0) || 0) + 1;
    task.updatedAt = startedAtIso;
  }

  return affectedEntries;
}

function resetTaskTimer(task) {
  if (!task) return;
  task.timerTotalMs = 0;
  task.timerStartedAt = null;
  task.timerLastStoppedAt = null;
  task.timerSessionsCount = 0;
  task.updatedAt = new Date().toISOString();
}

function getTaskFromDomPointer(dateStr, period, index) {
  const numericIndex = Number(index);
  if (!dateStr || !period || !Number.isInteger(numericIndex) || numericIndex < 0) return null;
  return allTasksData?.[dateStr]?.[period]?.[numericIndex] || null;
}

function refreshInlineTaskTimers() {
  document.querySelectorAll('.task-timer-meta[data-live-timer="1"]').forEach((node) => {
    const task = getTaskFromDomPointer(
      node.dataset.sourceDate,
      node.dataset.sourcePeriod,
      node.dataset.sourceIndex
    );
    if (!task) {
      node.remove();
      return;
    }

    const totalMs = getTaskTimerTotalMs(task);
    node.textContent = ` · ${formatDurationClock(totalMs)}`;
    node.classList.toggle('is-running', Boolean(task.timerStartedAt));
  });
}

function formatTimeSince(dateLike) {
  const ts = new Date(dateLike).getTime();
  if (!Number.isFinite(ts)) return 'sem registro';

  const diff = Date.now() - ts;
  if (diff <= 0) return 'agora';
  return `ha ${formatElapsedShort(diff)}`;
}

function formatLastCompletionDisplay(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return 'Sem tarefas concluidas';

  const completedAt = new Date(ts);
  const now = new Date();
  const hhmm = completedAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const isSameDay =
    completedAt.getFullYear() === now.getFullYear() &&
    completedAt.getMonth() === now.getMonth() &&
    completedAt.getDate() === now.getDate();

  if (isSameDay) return hhmm;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    completedAt.getFullYear() === yesterday.getFullYear() &&
    completedAt.getMonth() === yesterday.getMonth() &&
    completedAt.getDate() === yesterday.getDate();

  if (isYesterday) return `${hhmm} (dia anterior)`;

  const ddmm = completedAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  });
  return `${hhmm} (${ddmm})`;
}

function getLatestCompletionTimestamp() {
  let latest = 0;

  Object.values(allTasksData || {}).forEach((periods) => {
    Object.values(periods || {}).forEach((tasks) => {
      if (!Array.isArray(tasks)) return;
      tasks.forEach((task) => {
        if (!task || !task.completed || !task.completedAt) return;
        const ts = new Date(task.completedAt).getTime();
        if (Number.isFinite(ts) && ts > latest) latest = ts;
      });
    });
  });

  Object.values(habitsHistory || {}).forEach((historyByDate) => {
    Object.values(historyByDate || {}).forEach((value) => {
      if (typeof value !== 'string') return;
      const ts = new Date(value).getTime();
      if (Number.isFinite(ts) && ts > latest) latest = ts;
    });
  });

  return latest > 0 ? latest : null;
}
