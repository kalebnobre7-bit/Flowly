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
      window.FlowlyDialogs.notify('Banco corrigido com sucesso. Tarefas legadas removidas.', 'success');
    }
  } else if (document.getElementById('btnFixDuplicates')) {
    window.FlowlyDialogs.notify('Nenhum problema encontrado no banco.', 'success');
  }
}

function initTaskNormalizerRuntime() {
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('#btnFixDuplicates')) return;

    if (
      await window.FlowlyDialogs.confirm(
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

normalizeAllTasks = function () {
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

      const filtered = tasks.filter((task) => !task.isWeeklyRecurring && !task.isRoutine && !task.isRecurring);
      if (filtered.length !== tasks.length) {
        allTasksData[dateStr][period] = filtered;
        hasChanges = true;
      }

      allTasksData[dateStr][period].forEach((task) => {
        if (task.text === undefined || task.text === null) {
          task.text = '';
          hasChanges = true;
        }
        if (normalizeTaskTimerData(task)) hasChanges = true;
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
      window.FlowlyDialogs.notify('Banco corrigido com sucesso. Tarefas legadas removidas.', 'success');
    }
  } else if (document.getElementById('btnFixDuplicates')) {
    window.FlowlyDialogs.notify('Nenhum problema encontrado no banco.', 'success');
  }
};

initTaskNormalizerRuntime = function () {
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('#btnFixDuplicates')) return;

    const confirmed = await window.FlowlyDialogs.confirm(
      'Isso vai limpar vestigios de tarefas antigas para evitar duplicacoes visuais. Suas tarefas recorrentes configuradas nao serao afetadas.\n\nDeseja continuar?',
      {
        title: 'Corrigir banco local',
        confirmLabel: 'Corrigir'
      }
    );
    if (!confirmed) return;
    normalizeAllTasks();
    renderView();
  });
};

window.normalizeAllTasks = normalizeAllTasks;
window.initTaskNormalizerRuntime = initTaskNormalizerRuntime;
