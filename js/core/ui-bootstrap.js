(function () {
  function showAuthMessage(message, type) {
    const msgEl = document.getElementById('authMessage');
    if (!msgEl) return;

    const tokenRgb =
      type === 'error' ? 'var(--flowly-accent-danger-rgb)' : 'var(--flowly-accent-success-rgb)';
    const tokenColor =
      type === 'error' ? 'var(--flowly-accent-danger)' : 'var(--flowly-accent-success)';

    msgEl.textContent = message;
    msgEl.style.display = 'block';
    msgEl.style.background = `rgba(${tokenRgb}, 0.15)`;
    msgEl.style.color = tokenColor;
    msgEl.style.border = `1px solid rgba(${tokenRgb}, 0.3)`;

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
    const pinned = localStorage.getItem('flowly_sidebar_pinned') === 'true';
    if (pinned) document.body.classList.add('sidebar-pinned');

    function updateToggleIcon() {
      const icon = sidebarToggle && sidebarToggle.querySelector('i');
      if (!icon) return;
      const isPinned = document.body.classList.contains('sidebar-pinned');
      icon.setAttribute('data-lucide', isPinned ? 'pin-off' : 'pin');
      sidebarToggle.setAttribute('aria-label', isPinned ? 'Desafixar barra lateral' : 'Fixar barra lateral');
      if (window.lucide) lucide.createIcons();
    }

    if (sidebarToggle) {
      sidebarToggle.onclick = function () {
        const next = !document.body.classList.contains('sidebar-pinned');
        document.body.classList.toggle('sidebar-pinned', next);
        localStorage.setItem('flowly_sidebar_pinned', String(next));
        updateToggleIcon();
      };
      updateToggleIcon();
    }

    // --- Sub-nav toggles (Notion-style) ---
    document.querySelectorAll('.sidebar-nav-toggle').forEach(function (toggle) {
      toggle.onclick = function (e) {
        e.stopPropagation();
        const groupId = toggle.dataset.group;
        const group = groupId ? document.getElementById(groupId) : null;
        if (!group) return;
        const wasExpanded = group.classList.contains('is-expanded');
        group.classList.toggle('is-expanded', !wasExpanded);
        // persiste estado por grupo
        try {
          const key = 'flowly_sidebar_group_' + groupId;
          localStorage.setItem(key, String(!wasExpanded));
        } catch (_) {}
        if (window.lucide) lucide.createIcons();
      };
    });

    // Restaura estado expandido dos grupos
    document.querySelectorAll('.sidebar-nav-group[id]').forEach(function (group) {
      const key = 'flowly_sidebar_group_' + group.id;
      if (localStorage.getItem(key) === 'true') {
        group.classList.add('is-expanded');
      }
    });

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
        const projectsTab = viewBtn.dataset.projectsTab;
        if (projectsTab) {
          try { localStorage.setItem('flowly_projects_tab', projectsTab); } catch (_) {}
        }
        if (targetView) setView(targetView);
        // Re-aplica active no sub-item de tab depois que setView limpa tudo
        if (projectsTab) viewBtn.classList.add('active');
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

  // --- Popula sub-itens do sidebar com dados reais ---
  function populateSidebarSubNav() {
    // Projetos
    (function () {
      const inner = document.querySelector('#subProjects .sidebar-nav-children__inner');
      const toggle = document.querySelector('[data-group="navGroupProjects"]');
      const list = document.getElementById('subProjects');
      if (!inner) return;

      let currentTab = 'active';
      try { currentTab = localStorage.getItem('flowly_projects_tab') || 'active'; } catch (_) {}

      const activeProjects =
        typeof projectsState !== 'undefined' && projectsState && Array.isArray(projectsState.projects)
          ? projectsState.projects.filter(function (p) { return p && !p.isDraft && p.status !== 'archived' && p.status !== 'draft'; })
          : [];
      const archivedCount =
        typeof projectsState !== 'undefined' && projectsState && Array.isArray(projectsState.projects)
          ? projectsState.projects.filter(function (p) { return p && p.status === 'archived'; }).length
          : 0;

      // Tabs fixas: Ativos + Arquivados
      const tabsHtml = '<button class="sidebar-nav-sub' + (currentTab === 'active' ? ' active' : '') + '" data-flowly-view="projects" data-projects-tab="active">'
        + '<span style="flex:1">Ativos</span>'
        + (activeProjects.length > 0 ? '<span class="sidebar-nav-sub__badge">' + activeProjects.length + '</span>' : '')
        + '</button>'
        + '<button class="sidebar-nav-sub' + (currentTab === 'archived' ? ' active' : '') + '" data-flowly-view="projects" data-projects-tab="archived">'
        + '<span style="flex:1">Arquivados</span>'
        + (archivedCount > 0 ? '<span class="sidebar-nav-sub__badge">' + archivedCount + '</span>' : '')
        + '</button>';

      // Projetos individuais ativos (máx 8, apenas quando tab ativa)
      const projectsHtml = currentTab === 'active' && activeProjects.length > 0
        ? '<div class="sidebar-nav-sub-divider"></div>'
          + activeProjects.slice(0, 8).map(function (p) {
              const name = String(p.name || 'Projeto sem nome');
              const safe = name.replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
              });
              const tasks = typeof p.taskCount === 'number' ? p.taskCount : '';
              return '<button class="sidebar-nav-sub sidebar-nav-sub--project" data-flowly-view="projects" data-project-id="'
                + encodeURIComponent(p.id || '') + '" title="' + safe + '">'
                + '<span style="overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1">' + safe + '</span>'
                + (tasks ? '<span class="sidebar-nav-sub__badge">' + tasks + '</span>' : '')
                + '</button>';
            }).join('')
        : '';

      if (toggle) toggle.style.display = '';
      if (list) list.hidden = false;
      inner.innerHTML = tabsHtml + projectsHtml;
    })();

    // Metas (goals)
    (function () {
      const inner = document.querySelector('#subGoals .sidebar-nav-children__inner');
      const toggle = document.querySelector('[data-group="navGroupGoals"]');
      const list = document.getElementById('subGoals');
      if (!inner) return;
      // goals são armazenadas em allGoalsState ou similar — tenta ler do localStorage
      let goals = [];
      try {
        const raw = localStorage.getItem('flowlyGoalsState');
        const parsed = raw ? JSON.parse(raw) : null;
        goals = (parsed && Array.isArray(parsed.goals)) ? parsed.goals : [];
      } catch (_) {}
      if (goals.length === 0) {
        if (toggle) toggle.style.display = 'none';
        if (list) list.hidden = true;
        inner.innerHTML = '';
        return;
      }
      if (toggle) toggle.style.display = '';
      if (list) list.hidden = false;
      inner.innerHTML = goals.slice(0, 8).map(function (g) {
        const name = String(g.title || g.name || 'Meta');
        const safe = name.replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
        return '<button class="sidebar-nav-sub" data-flowly-view="goals" title="' + safe + '">' +
          '<span style="overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1">' + safe + '</span>' +
          '</button>';
      }).join('');
    })();

    if (window.lucide) lucide.createIcons();
  }

  window.populateSidebarSubNav = populateSidebarSubNav;

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
