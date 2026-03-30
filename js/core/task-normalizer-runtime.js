function normalizeAllTasks() {
  let hasChanges = false;

  Object.entries(allTasksData).forEach(([dateStr, periods]) => {
    if (periods['Rotina']) {
      delete periods['Rotina'];
      hasChanges = true;
    }

    if (periods._routineHydrated) {
      delete periods._routineHydrated;
      hasChanges = true;
    }

    Object.entries(periods).forEach(([period, tasks]) => {
      if (!Array.isArray(tasks)) return;

      const filtered = tasks.filter((task) => {
        if (task.isWeeklyRecurring || task.isRoutine || task.isRecurring) return false;
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

      if (allTasksData[dateStr][period].length === 0) {
        delete allTasksData[dateStr][period];
        hasChanges = true;
      }
    });

    if (Object.keys(allTasksData[dateStr] || {}).length === 0) {
      delete allTasksData[dateStr];
      hasChanges = true;
    }
  });

  if (hasChanges) {
    localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
    debugLog('Banco normalizado e limpo de artefatos legados.');
    if (document.getElementById('btnFixDuplicates')) {
      alert('Banco corrigido com sucesso! Tarefas legadas removidas.');
    }
  } else if (document.getElementById('btnFixDuplicates')) {
    alert('Nenhum problema encontrado no banco.');
  }
}

function initTaskNormalizerRuntime() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#btnFixDuplicates')) return;

    if (
      confirm(
        'Isso irá limpar vestígios de tarefas antigas (legado) para evitar duplicações visuais. Suas tarefas recorrentes configuradas NÃO serão afetadas.\n\nDeseja continuar?'
      )
    ) {
      normalizeAllTasks();
      renderView();
    }
  });
}

window.normalizeAllTasks = normalizeAllTasks;
window.initTaskNormalizerRuntime = initTaskNormalizerRuntime;
