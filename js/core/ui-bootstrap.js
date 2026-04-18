(function () {
  function showAuthMessage(message, type) {
    const msgEl = document.getElementById('authMessage');
    if (!msgEl) return;

    msgEl.textContent = message;
    msgEl.style.display = 'block';
    msgEl.style.background =
      type === 'error' ? 'rgba(255, 69, 58, 0.15)' : 'rgba(48, 209, 88, 0.15)';
    msgEl.style.color = type === 'error' ? '#FF453A' : '#30D158';
    msgEl.style.border =
      type === 'error'
        ? '1px solid rgba(255, 69, 58, 0.3)'
        : '1px solid rgba(48, 209, 88, 0.3)';

    setTimeout(function () {
      msgEl.style.display = 'none';
      msgEl.textContent = '';
    }, 5000);
  }
  window.showAuthMessage = showAuthMessage;

  function addRoutineTask(text, daysOfWeek) {
    if (!text || !daysOfWeek || daysOfWeek.length === 0) return;
    const exists = allRecurringTasks.find((task) => task.text === text);
    if (exists) return;

    const nextTask = {
      text,
      daysOfWeek,
      priority: 'none',
      color: 'default',
      isHabit: false,
      createdAt: new Date().toISOString(),
      _syncPending: true,
      order: allRecurringTasks.length
    };
    if (typeof ensureRecurringTaskIdentity === 'function') {
      ensureRecurringTaskIdentity(nextTask);
    }

    allRecurringTasks.push(nextTask);
    saveToLocalStorage();
    syncRecurringTasksToSupabase();
    renderView();
  }

  function deleteRoutineTask(text) {
    if (!text) return;
    window.FlowlyDialogs.confirm(`Remover "${text}" da rotina?`, {
      title: 'Remover da rotina',
      confirmLabel: 'Remover',
      tone: 'danger'
    }).then((confirmed) => {
      if (!confirmed) return;
      const idx =
        typeof findRecurringTaskIndex === 'function'
          ? findRecurringTaskIndex(allRecurringTasks, text)
          : allRecurringTasks.findIndex((task) => task.text === text);
      if (idx < 0) return;

      allRecurringTasks.splice(idx, 1);
      saveToLocalStorage();
      syncRecurringTasksToSupabase();
      renderView();
    });
  }

  function toggleRoutineToday(text, completed) {
    const today = localDateStr();
    if (!habitsHistory[text]) habitsHistory[text] = {};
    if (completed) {
      habitsHistory[text][today] = new Date().toISOString();
    } else {
      delete habitsHistory[text][today];
    }
    localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));
    if (typeof syncHabitToSupabase === 'function') {
      syncHabitToSupabase(text, today, completed);
    }
    renderView();
  }

  function showAddRoutineTask() {
    if (typeof showWeeklyRecurrenceDialog === 'function') {
      showWeeklyRecurrenceDialog();
    }
  }

  function setAuthModalVisibility(shouldShow) {
    const authModal = document.getElementById('authModal');
    if (!authModal) return;
    authModal.classList.toggle('show', shouldShow);
  }

  function bindAuthUi() {
    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) {
      btnLogin.onclick = async function () {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        if (!email || !password) {
          showAuthMessage('Preencha email e senha!', 'error');
          return;
        }

        const originalText = btnLogin.innerHTML;
        btnLogin.innerHTML = 'Entrando...';
        btnLogin.disabled = true;
        try {
          await signIn(email, password);
        } catch (e) {
          console.error(e);
          showAuthMessage(e.message, 'error');
        } finally {
          btnLogin.innerHTML = originalText;
          btnLogin.disabled = false;
        }
      };
    }

    const btnSignup = document.getElementById('btnSignup');
    if (btnSignup) {
      btnSignup.onclick = async function () {
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        if (!email || !password) {
          showAuthMessage('Preencha email e senha!', 'error');
          return;
        }

        const originalText = btnSignup.innerHTML;
        btnSignup.innerHTML = 'Criando...';
        btnSignup.disabled = true;
        try {
          await signUp(email, password);
        } catch (e) {
          console.error(e);
          showAuthMessage(e.message, 'error');
        } finally {
          btnSignup.innerHTML = originalText;
          btnSignup.disabled = false;
        }
      };
    }

    const btnShowSignup = document.getElementById('btnShowSignup');
    if (btnShowSignup) {
      btnShowSignup.onclick = function () {
        document.getElementById('authLogin').style.display = 'none';
        document.getElementById('authSignup').style.display = 'block';
      };
    }

    const btnShowLogin = document.getElementById('btnShowLogin');
    if (btnShowLogin) {
      btnShowLogin.onclick = function () {
        document.getElementById('authSignup').style.display = 'none';
        document.getElementById('authLogin').style.display = 'block';
      };
    }

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.onclick = async function () {
        const confirmed = await window.FlowlyDialogs.confirm('Deseja realmente sair?', {
          title: 'Encerrar sessão',
          confirmLabel: 'Sair',
          tone: 'danger'
        });
        if (confirmed) {
          await signOut();
        }
      };
    }
  }

  function bindHeaderAndQuickAdd() {
    const btnUser = document.getElementById('btnUser');
    if (btnUser) {
      btnUser.onclick = function (e) {
        e.stopPropagation();
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
          dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
        }
      };
    }

    document.addEventListener('click', function (e) {
      const dropdown = document.getElementById('userDropdown');
      if (
        dropdown &&
        dropdown.style.display === 'flex' &&
        !dropdown.contains(e.target) &&
        e.target !== btnUser
      ) {
        dropdown.style.display = 'none';
      }

      const quickAddMenu = document.getElementById('quickAddMenu');
      const fab = document.getElementById('floatingAddBtn');
      if (
        quickAddMenu &&
        quickAddMenu.style.display === 'flex' &&
        !quickAddMenu.contains(e.target) &&
        (!fab || !fab.contains(e.target))
      ) {
        quickAddMenu.style.display = 'none';
        if (fab) {
          const fabIcon = fab.querySelector('i');
          if (fabIcon) fabIcon.setAttribute('data-lucide', 'zap');
          if (window.lucide) lucide.createIcons();
        }
      }
    });

    const fab = document.getElementById('floatingAddBtn');
    if (fab) {
      fab.onclick = function (e) {
        e.stopPropagation();
        const menu = document.getElementById('quickAddMenu');
        if (!menu) return;

        const isHidden = menu.style.display === 'none' || menu.style.display === '';
        menu.style.display = isHidden ? 'flex' : 'none';

        const icon = fab.querySelector('i');
        if (icon) {
          icon.setAttribute('data-lucide', isHidden ? 'x' : 'zap');
          if (window.lucide) lucide.createIcons();
        }
      };
    }

    const quickAddMenu = document.getElementById('quickAddMenu');
    const quickAddTypeHandlers = {
      custom: function () {
        if (quickAddMenu) quickAddMenu.style.display = 'none';
        const todayStr = localDateStr();
        const container = document.querySelector(`.day-column[data-date="${todayStr}"]`);
        if (container) insertQuickTaskInput(container, todayStr, 'Tarefas');
      },
      routine: function () {
        if (quickAddMenu) quickAddMenu.style.display = 'none';
        showAddRoutineTask();
      },
      weekly: function () {
        if (quickAddMenu) quickAddMenu.style.display = 'none';
        if (typeof showWeeklyRecurrenceDialog === 'function') {
          showWeeklyRecurrenceDialog();
        }
      }
    };

    document.querySelectorAll('#quickAddMenu .quick-add-option').forEach((btn) => {
      btn.onclick = function () {
        const type = btn.dataset.type || btn.dataset.action;
        const handler = quickAddTypeHandlers[type];
        if (handler) handler();
      };
    });

    const btnQuickTask = document.querySelector('[data-action="quick-task"]');
    if (btnQuickTask) {
      btnQuickTask.onclick = quickAddTypeHandlers.custom;
    }
  }

  function bindShellUi() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const collapsed = localStorage.getItem('flowly_sidebar_collapsed') === 'true';
    if (collapsed) document.body.classList.add('sidebar-collapsed');

    if (sidebarToggle) {
      sidebarToggle.onclick = function () {
        const next = !document.body.classList.contains('sidebar-collapsed');
        document.body.classList.toggle('sidebar-collapsed', next);
        localStorage.setItem('flowly_sidebar_collapsed', String(next));
        const icon = sidebarToggle.querySelector('i');
        if (icon) {
          icon.setAttribute('data-lucide', next ? 'panel-left-open' : 'panel-left-close');
        }
        if (window.lucide) lucide.createIcons();
      };

      const icon = sidebarToggle.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', collapsed ? 'panel-left-open' : 'panel-left-close');
      }
    }

    document.querySelectorAll('.priority-btn').forEach((btn) => {
      btn.onclick = function () {
        document.querySelectorAll('.priority-btn').forEach((item) => item.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    if (typeof bindWeeklyDayButtons === 'function') {
      bindWeeklyDayButtons();
    }

    const btnSave = document.getElementById('btnSaveTaskEdit');
    if (btnSave) btnSave.onclick = window.saveTaskEdit;

    const btnDelete = document.getElementById('btnDeleteTaskEdit');
    if (btnDelete) btnDelete.onclick = window.deleteTaskEdit;

    const btnCancel = document.getElementById('btnCancelTaskEdit');
    if (btnCancel) {
      btnCancel.onclick = function () {
        document.getElementById('taskEditModal').classList.remove('show');
      };
    }

    document.addEventListener('click', function (event) {
      const viewBtn = event.target.closest('[data-flowly-view]');
      if (viewBtn) {
        const targetView = viewBtn.dataset.flowlyView;
        if (targetView) setView(targetView);
        return;
      }

      const weekNavBtn = event.target.closest('[data-week-nav]');
      if (weekNavBtn) {
        const action = weekNavBtn.dataset.weekNav;
        if (action === 'current') goToCurrentWeek();
        else changeWeek(Number(action || 0));
        return;
      }

      const authModalBtn = event.target.closest('[data-auth-modal]');
      if (authModalBtn) {
        setAuthModalVisibility(authModalBtn.dataset.authModal === 'open');
      }
    });
  }

  window.setView = setView;
  window.renderView = renderView;
  window.runSextaQuickAction = runSextaQuickAction;
  window.runSextaCommand = runSextaCommand;
  window.openFlowlySettingsTab = openFlowlySettingsTab;
  window.showWeeklyRecurrenceDialog = showWeeklyRecurrenceDialog;
  window.showAddRoutineTask = showAddRoutineTask;
  window.addRoutineTask = addRoutineTask;
  window.deleteRoutineTask = deleteRoutineTask;
  window.toggleRoutineToday = toggleRoutineToday;
  window.goToDate = goToDate;
  window.changeWeek = changeWeek;
  window.goToCurrentWeek = goToCurrentWeek;
  window.signOut = signOut;
  window.setAuthModalVisibility = setAuthModalVisibility;

  document.addEventListener('DOMContentLoaded', function () {
    bindAuthUi();
    bindHeaderAndQuickAdd();
    bindShellUi();
    if (typeof renderView === 'function') {
      renderView();
    }
    if (window.lucide) lucide.createIcons();
  });
})();
