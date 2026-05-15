// renderProjectsView — redesign 2026 (kanban board + modal de detalhes).
// Lógica de dados preservada (mesmos data-* attributes do runtime).

const PROJECTS_KANBAN_COLUMNS = [
  { id: 'todo',    label: 'A fazer',       hint: 'Ainda não começou' },
  { id: 'doing',   label: 'Em andamento',  hint: 'Com tarefas abertas' },
  { id: 'late',    label: 'Em atraso',     hint: 'Passou do prazo', readonly: true },
  { id: 'done',    label: 'Concluído',     hint: 'Entregue e pago' },
];

function getProjectKanbanColumnId(project, today, progressRate) {
  if (project.status === 'archived') return 'archived';
  if (project.completionDate) return project.isPaid ? 'done' : 'awaiting-payment';
  if (project.deadline && project.deadline < today) return 'late';
  const rate = progressRate != null ? progressRate : (getProjectProgressRate(project.id)?.pct || 0);
  return rate > 0 ? 'doing' : 'todo';
}

window.moveProjectToKanbanColumn = function (projectId, columnId) {
  const today = localDateStr();
  updateProjectRecord(projectId, (project) => {
    if (columnId === 'archived') {
      project.status = 'archived';
      return project;
    }
    if (project.status === 'archived') project.status = project.isDraft ? 'draft' : 'active';
    if (columnId === 'todo' || columnId === 'doing') {
      project.completionDate = '';
      project.isPaid = false;
      if (project.isDraft) { project.isDraft = false; project.status = 'active'; }
      return project;
    }
    if (columnId === 'awaiting-payment') {
      if (!project.completionDate) project.completionDate = today;
      project.isPaid = false;
      return project;
    }
    if (columnId === 'done') {
      if (!project.completionDate) project.completionDate = today;
      project.isPaid = true;
      return project;
    }
    return project;
  });
  if (currentView === 'projects') renderProjectsView();
};

function renderArchivedProjectsSection(allProjects, formatBRL, today) {
  const archived = allProjects
    .filter((p) => p.status === 'archived')
    .sort((a, b) => (b.completionDate || '').localeCompare(a.completionDate || ''));

  if (archived.length === 0) {
    return '<div class="projects-archived-empty">'
      + '<div class="projects-archived-empty__icon">'
      +   '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>'
      + '</div>'
      + '<p class="projects-archived-empty__title">Arquivo vazio</p>'
      + '<p class="projects-archived-empty__hint">Projetos concluídos e pagos há mais de 7 dias são arquivados automaticamente.</p>'
      + '</div>';
  }

  // ── Métricas ──────────────────────────────────────────────
  const totalRevenue = archived.reduce((s, p) => s + (p.closedValue || p.expectedValue || 0), 0);
  const withValue = archived.filter((p) => (p.closedValue || p.expectedValue) > 0);
  const avgTicket = withValue.length > 0
    ? totalRevenue / withValue.length : 0;
  const withDates = archived.filter((p) => p.startDate && p.completionDate);
  const avgDuration = withDates.length > 0
    ? Math.round(withDates.reduce((s, p) => {
        return s + Math.max(0, (new Date(p.completionDate) - new Date(p.startDate)) / 86400000);
      }, 0) / withDates.length)
    : null;
  const allTaskStats = archived.map((p) => getProjectProgressRate(p.id)).filter(Boolean);
  const totalTasksDone = allTaskStats.reduce((s, t) => s + t.done, 0);
  const totalTasksAll = allTaskStats.reduce((s, t) => s + t.total, 0);
  const taskRatePct = totalTasksAll > 0 ? Math.round((totalTasksDone / totalTasksAll) * 100) : null;
  const bestProject = [...archived].sort((a, b) =>
    (b.closedValue || b.expectedValue || 0) - (a.closedValue || a.expectedValue || 0)
  )[0];

  const statsHtml = '<div class="arch-stats">'
    + '<div class="arch-stat">'
    +   '<div class="arch-stat__value">' + archived.length + '</div>'
    +   '<div class="arch-stat__label">Entregues</div>'
    + '</div>'
    + '<div class="arch-stat arch-stat--success">'
    +   '<div class="arch-stat__value">' + formatBRL(totalRevenue) + '</div>'
    +   '<div class="arch-stat__label">Receita total</div>'
    + '</div>'
    + (avgTicket > 0
      ? '<div class="arch-stat">'
        +   '<div class="arch-stat__value">' + formatBRL(avgTicket) + '</div>'
        +   '<div class="arch-stat__label">Ticket médio</div>'
        + '</div>'
      : '')
    + (avgDuration !== null
      ? '<div class="arch-stat">'
        +   '<div class="arch-stat__value">' + avgDuration + '<small>d</small></div>'
        +   '<div class="arch-stat__label">Duração média</div>'
        + '</div>'
      : '')
    + (taskRatePct !== null
      ? '<div class="arch-stat">'
        +   '<div class="arch-stat__value">' + taskRatePct + '<small>%</small></div>'
        +   '<div class="arch-stat__label">Tarefas fechadas</div>'
        + '</div>'
      : '')
    + '</div>';

  // ── Agrupar por ano ──────────────────────────────────────
  const byYear = {};
  archived.forEach((p) => {
    const year = p.completionDate ? p.completionDate.slice(0, 4) : 'Sem data';
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(p);
  });
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  // ── Valor → cor do indicador ─────────────────────────────
  const accentForValue = (v) => {
    if (v >= 5000) return 'var(--flowly-accent-success)';
    if (v >= 2000) return 'var(--flowly-accent-primary)';
    if (v > 0) return 'var(--flowly-text-tertiary)';
    return 'rgba(255,255,255,0.12)';
  };

  // ── Render de uma linha de projeto ───────────────────────
  const renderRow = (project) => {
    const value = project.closedValue || project.expectedValue || 0;
    const accentColor = accentForValue(value);
    const safeName = escapeProjectHtml(project.name);
    const safeClient = escapeProjectHtml(project.clientName || '');
    const safeType = escapeProjectHtml(project.serviceType || '');
    const amountStr = value > 0 ? formatBRL(value) : '';
    const isPaid = project.closedValue > 0;

    const completedText = (() => {
      if (!project.completionDate) return '—';
      const d = new Date(project.completionDate + 'T00:00:00');
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
    })();

    const durationDays = (() => {
      if (!project.startDate || !project.completionDate) return null;
      return Math.max(0, Math.round((new Date(project.completionDate) - new Date(project.startDate)) / 86400000));
    })();

    const progress = getProjectProgressRate(project.id);
    const hasProgress = progress && progress.total > 0;
    const progressPct = hasProgress ? progress.pct : 0;

    const isBest = bestProject && bestProject.id === project.id && value > 0;

    return '<div class="arch-row" data-project-id="' + project.id + '">'
      // Indicador colorido
      + '<div class="arch-row__indicator" style="background:' + accentColor + '"></div>'
      // Identidade
      + '<div class="arch-row__identity">'
      +   '<span class="arch-row__name">' + safeName + (isBest ? ' <span class="arch-row__best-badge">★ top</span>' : '') + '</span>'
      +   (safeClient ? '<span class="arch-row__client">' + safeClient + '</span>' : '')
      + '</div>'
      // Chips: tipo + duração
      + '<div class="arch-row__chips">'
      +   (safeType ? '<span class="arch-row__chip arch-row__chip--type">' + safeType + '</span>' : '')
      +   (durationDays !== null ? '<span class="arch-row__chip">' + durationDays + 'd</span>' : '')
      + '</div>'
      // Progress tasks
      + '<div class="arch-row__tasks">'
      +   (hasProgress
          ? '<div class="arch-row__progress-wrap">'
            +   '<div class="arch-row__progress-bar"><div class="arch-row__progress-fill" style="width:' + progressPct + '%;background:' + accentColor + '"></div></div>'
            +   '<span class="arch-row__progress-label">' + progress.done + '/' + progress.total + '</span>'
            + '</div>'
          : '<span class="arch-row__no-tasks">—</span>')
      + '</div>'
      // Valor
      + '<div class="arch-row__value">'
      +   (amountStr
          ? '<span class="arch-row__amount' + (isPaid ? ' arch-row__amount--paid' : '') + '">' + amountStr + '</span>'
          : '<span class="arch-row__amount arch-row__amount--empty">—</span>')
      + '</div>'
      // Data
      + '<div class="arch-row__date">' + completedText + '</div>'
      // Ação
      + '<div class="arch-row__actions">'
      +   '<button type="button" class="arch-row__restore flowly-btn flowly-btn--ghost flowly-btn--sm" data-projects-action="restore-project" data-project-id="' + project.id + '">↩ Restaurar</button>'
      + '</div>'
      + '</div>';
  };

  // ── Render de grupos por ano ─────────────────────────────
  const groupsHtml = years.map((year) => {
    const yearProjects = byYear[year];
    const yearRevenue = yearProjects.reduce((s, p) => s + (p.closedValue || p.expectedValue || 0), 0);
    return '<div class="arch-group">'
      + '<div class="arch-group__header">'
      +   '<span class="arch-group__year">' + year + '</span>'
      +   '<span class="arch-group__divider"></span>'
      +   '<span class="arch-group__summary">' + yearProjects.length + ' projeto' + (yearProjects.length > 1 ? 's' : '') + (yearRevenue > 0 ? ' · ' + formatBRL(yearRevenue) : '') + '</span>'
      + '</div>'
      + '<div class="arch-group__rows">'
      +   yearProjects.map(renderRow).join('')
      + '</div>'
      + '</div>';
  }).join('');

  return '<div class="arch-shell">' + statsHtml + groupsHtml + '</div>';
}

// Retorna tab ativo: 'active' | 'archived'
function getProjectsTab() {
  return localStorage.getItem('flowly_projects_tab') || 'active';
}
function setProjectsTab(tab) {
  localStorage.setItem('flowly_projects_tab', tab);
}

// Auto-arquiva projetos concluídos (isPaid) há mais de 7 dias
function autoArchiveOldProjects() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = localDateStr(cutoff);
  getProjectOptions()
    .filter((p) => p.completionDate && p.isPaid && p.status !== 'archived' && !p.isDraft && p.completionDate <= cutoffStr)
    .forEach((p) => {
      updateProjectRecord(p.id, (proj) => { proj.status = 'archived'; return proj; });
    });
}

function renderProjectsView() {
  const view = document.getElementById('projectsView');
  if (!view) return;

  // Auto-arquiva projetos antigos antes de renderizar
  autoArchiveOldProjects();

  const analytics = buildProjectsAnalytics();
  const formatBRL = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const taskBacklogCount = collectProjectTaskCandidates({ includeLinked: false, max: 999 }).length;
  const today = localDateStr();
  const allProjects = analytics.projects.filter((p) => !p.isDraft && p.status !== 'draft');
  const activeCount = allProjects.filter((p) => !p.completionDate && p.status !== 'archived').length;
  const lateCount = allProjects.filter((p) => !p.completionDate && p.deadline && p.deadline < today).length;
  const unpaidCount = allProjects.filter((p) => !p.isPaid && p.status !== 'archived').length;
  const deliveredUnpaidCount = allProjects.filter((p) => p.completionDate && !p.isPaid).length;
  const totalRevenue = allProjects.reduce((sum, p) => sum + (p.expectedValue || 0), 0);
  const closedRevenue = allProjects.reduce((sum, p) => sum + (p.closedValue || 0), 0);
  const awaitingRevenue = allProjects.filter((p) => p.completionDate && !p.isPaid).reduce((sum, p) => sum + (p.expectedValue || 0), 0);

  const heroInsight = (() => {
    if (lateCount > 0) return `${lateCount} projeto(s) em atraso — ação urgente.`;
    if (deliveredUnpaidCount > 0) return `${deliveredUnpaidCount} entrega(s) aguardando pagamento — cobrar agora.`;
    if (activeCount === 0) return 'Nenhum projeto ativo. Hora de abrir um novo.';
    if (taskBacklogCount > 0) return `${taskBacklogCount} tarefa(s) soltas podem virar projeto.`;
    return 'Operação sob controle.';
  })();

  // Agrupa projetos por coluna
  const projectsByColumn = {};
  PROJECTS_KANBAN_COLUMNS.forEach((col) => { projectsByColumn[col.id] = []; });
  allProjects.forEach((project) => {
    const colId = getProjectKanbanColumnId(project, today);
    if (projectsByColumn[colId]) projectsByColumn[colId].push(project);
  });

  const renderKanbanCard = (project) => {
    const progress = getProjectProgressRate(project.id);
    const progressPct = progress ? progress.pct : 0;
    const progressTotal = progress ? progress.total : 0;
    const deadlineDiff = getProjectDeadlineDiff(project.deadline, today);
    const isLate = !project.completionDate && deadlineDiff !== null && deadlineDiff < 0;
    const isDone = !!project.completionDate;

    const deadlineText = (() => {
      if (project.completionDate) return 'Fechado ' + formatProjectDateShort(project.completionDate);
      if (deadlineDiff === null) return 'Sem prazo';
      if (deadlineDiff < 0) return Math.abs(deadlineDiff) + 'd atraso';
      if (deadlineDiff === 0) return 'Hoje';
      if (deadlineDiff === 1) return 'Amanhã';
      return 'em ' + deadlineDiff + 'd';
    })();

    const amountLabel = project.closedValue > 0
      ? formatBRL(project.closedValue)
      : (project.expectedValue > 0 ? formatBRL(project.expectedValue) : '');
    const amountColor = project.closedValue > 0 ? 'style="color:var(--flowly-accent-success)"' : '';

    const safeName = escapeProjectHtml(project.name);
    const safeClient = escapeProjectHtml(project.clientName || '');
    const safeType = escapeProjectHtml(project.serviceType || '');

    const progressVariant = isDone ? 'flowly-progress--success'
      : isLate ? 'flowly-progress--danger'
      : progressPct >= 60 ? ''
      : 'flowly-progress--warning';

    const avatarLabel = (project.clientName || project.serviceType || project.name || '?').trim();
    const initials = avatarLabel.split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase() || '?';

    const colId = getProjectKanbanColumnId(project, today, progressPct);
    const quickActions = (() => {
      if (colId === 'todo' || colId === 'doing' || colId === 'late') {
        return '<div class="kanban-card__actions">'
          + '<button type="button" class="kanban-card__action-btn" data-project-quick-action="complete" data-project-id="' + project.id + '">Concluir →</button>'
          + '</div>';
      }
      return '';
    })();

    return '<article class="kanban-card" draggable="true" data-project-card-id="' + project.id + '" data-project-id="' + project.id + '">'
      + '<div class="kanban-card__title">' + safeName + '</div>'
      + (safeClient ? '<div class="kanban-card__sub">' + safeClient + '</div>' : '')
      + (safeType ? '<span class="kanban-card__badge">' + safeType + '</span>' : '')
      + (progressTotal > 0
          ? '<div class="kanban-card__progress"><div class="flowly-progress ' + progressVariant + '"><div class="flowly-progress__fill" style="width:' + progressPct + '%"></div></div><span>' + progress.done + '/' + progressTotal + '</span></div>'
          : '<div class="kanban-card__progress kanban-card__progress--empty">Sem tarefas</div>')
      + quickActions
      + '<div class="kanban-card__foot">'
      +   '<span class="kanban-card__deadline' + (isLate ? ' is-late' : '') + '">' + deadlineText + '</span>'
      +   (amountLabel ? '<span class="kanban-card__amount" ' + amountColor + '>' + amountLabel + '</span>' : '')
      +   '<span class="flowly-avatar flowly-avatar--sm kanban-card__avatar">' + escapeProjectHtml(initials) + '</span>'
      + '</div>'
      + '</article>';
  };

  const renderKanbanColumn = (col) => {
    const items = projectsByColumn[col.id] || [];
    const isEmpty = items.length === 0;
    return '<section class="kanban-column' + (col.readonly ? ' kanban-column--readonly' : '') + (isEmpty ? ' kanban-column--empty' : '') + '" data-kanban-column="' + col.id + '">'
      + '<header class="kanban-column__header">'
      +   '<div class="kanban-column__title">'
      +     '<span>' + col.label + '</span>'
      +     '<span class="kanban-column__count">' + items.length + '</span>'
      +   '</div>'
      +   '<div class="kanban-column__hint">' + col.hint + '</div>'
      + '</header>'
      + '<div class="kanban-column__body">'
      +   (items.length > 0 ? items.map(renderKanbanCard).join('') : '<div class="kanban-column__empty">—</div>')
      + '</div>'
      + '</section>';
  };

  const statsStrip = '<div class="flowly-stat-strip kanban-stats-strip">'
    + '<div class="flowly-stat-card flowly-stat-card--inline flowly-stat-card--primary"><div class="flowly-stat-card__label">Ativos</div><div class="flowly-stat-card__value">' + activeCount + '</div></div>'
    + '<div class="flowly-stat-card flowly-stat-card--inline flowly-stat-card--' + (lateCount > 0 ? 'danger' : 'success') + '"><div class="flowly-stat-card__label">Atrasados</div><div class="flowly-stat-card__value">' + lateCount + '</div></div>'
    + '<div class="flowly-stat-card flowly-stat-card--inline flowly-stat-card--' + (deliveredUnpaidCount > 0 ? 'warning' : 'success') + '"><div class="flowly-stat-card__label">A receber</div><div class="flowly-stat-card__value">' + formatBRL(awaitingRevenue) + '</div></div>'
    + '<div class="flowly-stat-card flowly-stat-card--inline"><div class="flowly-stat-card__label">Previsto</div><div class="flowly-stat-card__value">' + formatBRL(totalRevenue) + '</div></div>'
    + '<div class="flowly-stat-card flowly-stat-card--inline flowly-stat-card--' + (closedRevenue > 0 ? 'success' : '') + '"><div class="flowly-stat-card__label">Recebido</div><div class="flowly-stat-card__value">' + formatBRL(closedRevenue) + '</div></div>'
    + '</div>';

  const activeTab = getProjectsTab();

  const tabBar = '<div class="projects-tab-bar">'
    + '<button type="button" class="projects-tab-btn' + (activeTab === 'active' ? ' is-active' : '') + '" data-projects-tab="active">Ativos</button>'
    + '<button type="button" class="projects-tab-btn' + (activeTab === 'archived' ? ' is-active' : '') + '" data-projects-tab="archived">Arquivados</button>'
    + '</div>';

  const mainContent = activeTab === 'archived'
    ? renderArchivedProjectsSection(analytics.projects, formatBRL, today)
    : statsStrip + '<div class="kanban-board" data-projects-kanban>' + PROJECTS_KANBAN_COLUMNS.map(renderKanbanColumn).join('') + '</div>';

  view.innerHTML = '<div class="flowly-shell flowly-shell--wide projects-shell-v2">'
    + '<header class="flowly-page-header">'
    +   '<div class="flowly-page-header__title"><h1 class="flowly-page-title">Projetos</h1><p class="flowly-page-subtitle">' + heroInsight + '</p></div>'
    +   '<div class="flowly-page-header__actions">'
    +     tabBar
    +     '<button type="button" class="flowly-btn flowly-btn--primary" data-projects-action="open-quick-modal">'
    +       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>'
    +       '<span>Novo projeto</span>'
    +     '</button>'
    +   '</div>'
    + '</header>'
    + mainContent
    + '</div>'
    + '<div class="flowly-modal" id="projectDetailModal" role="dialog" aria-modal="true">'
    +   '<div class="flowly-modal__backdrop" data-project-modal-close></div>'
    +   '<div class="flowly-modal__content" style="max-width:640px" id="projectDetailModalContent"></div>'
    + '</div>';

  if (window.lucide) lucide.createIcons();

  // --- Event listeners ---
  view.querySelectorAll('[data-projects-tab]').forEach((btn) => {
    btn.onclick = () => {
      setProjectsTab(btn.dataset.projectsTab);
      renderProjectsView();
    };
  });

  view.querySelectorAll('[data-projects-action]').forEach((btn) => {
    btn.onclick = () => {
      const action = btn.dataset.projectsAction;
      if (action === 'open-quick-modal') openQuickProjectModal();
      if (action === 'restore-project') {
        const pid = btn.dataset.projectId;
        if (pid) window.moveProjectToKanbanColumn(pid, 'todo');
      }
    };
  });

  view.querySelectorAll('[data-project-card-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, input, textarea, select, label, a')) return;
      const pid = card.dataset.projectCardId;
      if (pid) openProjectDetailModal(pid);
    });
  });

  // Cards da view arquivada também abrem modal
  view.querySelectorAll('.projects-archive-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, input, a')) return;
      const pid = card.dataset.projectId;
      if (pid) openProjectDetailModal(pid);
    });
  });

  // Drag and drop
  let draggedProjectId = null;
  view.querySelectorAll('.kanban-card[draggable="true"]').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      draggedProjectId = card.dataset.projectId;
      card.classList.add('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedProjectId);
      }
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      draggedProjectId = null;
      view.querySelectorAll('.kanban-column.is-drop-target').forEach((c) => c.classList.remove('is-drop-target'));
    });
  });
  view.querySelectorAll('.kanban-column').forEach((col) => {
    if (col.classList.contains('kanban-column--readonly')) return;
    col.addEventListener('dragover', (e) => {
      if (!draggedProjectId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      col.classList.add('is-drop-target');
    });
    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) col.classList.remove('is-drop-target');
    });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('is-drop-target');
      const targetCol = col.dataset.kanbanColumn;
      const pid = draggedProjectId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
      if (pid && targetCol) window.moveProjectToKanbanColumn(pid, targetCol);
    });
  });

  view.querySelectorAll('[data-project-modal-close]').forEach((el) => {
    el.addEventListener('click', closeProjectDetailModal);
  });

  // Ações rápidas nos cards (Concluir / Recebi)
  view.querySelectorAll('[data-project-quick-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.projectQuickAction;
      const pid = btn.dataset.projectId;
      if (action === 'complete' && pid) window.moveProjectToKanbanColumn(pid, 'done');
    });
  });
}

// =============================================================
// MODAL DE DETALHES DO PROJETO — redesign 2026
// =============================================================
function openProjectDetailModal(projectId) {
  const project = getProjectOptions().find((p) => p.id === projectId);
  if (!project) return;
  const modal = document.getElementById('projectDetailModal');
  const content = document.getElementById('projectDetailModalContent');
  if (!modal || !content) return;

  const pid = project.id;
  const linkedTasks = collectProjectTaskCandidates({ includeLinked: true, max: 20, projectId: pid });
  const templateTextareaId = 'projectTemplate_' + pid;
  const deadlineInputId   = 'projDeadline_' + pid;
  const startInputId      = 'projStart_' + pid;

  // ── Helpers ──────────────────────────────────────────────
  const safe = (v) => escapeProjectHtml(String(v == null ? '' : v));

  const shortDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

  // ── Status line ───────────────────────────────────────────
  const today = localDateStr();
  const progress = getProjectProgressRate(pid);
  const hasTasks = progress && progress.total > 0;
  const progressPct = hasTasks ? progress.pct : 0;
  const deadlineDiff = getProjectDeadlineDiff(project.deadline, today);
  const isLate = !project.completionDate && deadlineDiff !== null && deadlineDiff < 0;
  const isDone = !!project.completionDate;

  const statusDot = isDone ? 'proj-dot--done' : isLate ? 'proj-dot--late' : deadlineDiff !== null ? 'proj-dot--doing' : 'proj-dot--idle';
  const statusParts = [];
  if (isDone) {
    statusParts.push('Entregue ' + shortDate(project.completionDate));
    statusParts.push(project.isPaid ? '✓ Pago' : 'Aguardando pagamento');
  } else if (isLate) {
    statusParts.push(Math.abs(deadlineDiff) + 'd em atraso');
  } else if (deadlineDiff !== null) {
    statusParts.push(deadlineDiff === 0 ? 'Prazo hoje' : deadlineDiff === 1 ? 'Prazo amanhã' : deadlineDiff + 'd restantes');
  } else {
    statusParts.push('Sem prazo definido');
  }
  if (hasTasks) statusParts.push(progress.done + '/' + progress.total + ' tarefas');

  // ── Tarefas vinculadas ────────────────────────────────────
  const linkedHtml = linkedTasks.length > 0
    ? '<div class="proj-modal-section">'
      + '<div class="proj-modal-section__header">Tarefas vinculadas</div>'
      + '<div style="display:flex;flex-direction:column;gap:var(--flowly-space-2)">'
      + linkedTasks.map((item) =>
          '<div class="projects-linked-item-v2">'
          + '<div><strong>' + safe(item.task.text) + '</strong>'
          + '<p>' + item.dateStr + ' · ' + item.period + (item.task.completed ? ' · concluída' : '') + '</p></div>'
          + '<button type="button" class="flowly-btn flowly-btn--ghost flowly-btn--sm" '
          + 'data-project-card-action="unlink-task" data-project-task-date="' + item.dateStr + '" '
          + 'data-project-task-period="' + item.period + '" data-project-task-index="' + item.index + '">Desvincular</button>'
          + '</div>'
        ).join('')
      + '</div></div>'
    : '';

  // ── HTML ──────────────────────────────────────────────────
  content.innerHTML =
    '<button type="button" class="flowly-modal__close" data-project-modal-close aria-label="Fechar">'
    + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
    + '</button>'

    // Hero: nome editável + status
    + '<div class="proj-modal-hero">'
    +   '<input class="proj-modal-name" type="text" value="' + safe(project.name) + '" placeholder="Nome do projeto" data-project-field="name" data-project-id="' + pid + '">'
    +   '<div class="proj-modal-status-line">'
    +     '<span class="proj-dot ' + statusDot + '"></span>'
    +     '<span class="proj-modal-status-text">' + statusParts.join(' · ') + '</span>'
    +   '</div>'
    + '</div>'

    // Progress bar (só se tem tarefas)
    + (hasTasks
      ? '<div class="proj-modal-progress">'
        + '<div class="proj-modal-progress__bar"><div class="proj-modal-progress__fill" style="width:' + progressPct + '%"></div></div>'
        + '</div>'
      : '')

    + '<div class="proj-modal-body">'

    // Propriedades
    + '<div class="proj-modal-props">'

      // Cliente
      + '<div class="proj-modal-prop">'
      +   '<span class="proj-modal-prop__label">Cliente</span>'
      +   '<input class="proj-modal-prop__input" type="text" value="' + safe(project.clientName) + '" placeholder="—" data-project-field="clientName" data-project-id="' + pid + '">'
      + '</div>'

      // Tipo
      + '<div class="proj-modal-prop">'
      +   '<span class="proj-modal-prop__label">Tipo</span>'
      +   '<input class="proj-modal-prop__input" type="text" value="' + safe(project.serviceType) + '" placeholder="LP, Shopify, etc." data-project-field="serviceType" data-project-id="' + pid + '">'
      + '</div>'

      // Valor + Pago inline
      + '<div class="proj-modal-prop">'
      +   '<span class="proj-modal-prop__label">Valor</span>'
      +   '<div class="proj-modal-value-row">'
      +     '<span class="proj-modal-currency">R$</span>'
      +     '<input class="proj-modal-prop__input proj-modal-prop__input--number" type="number" min="0" step="0.01" '
      +       'value="' + Number(project.expectedValue || 0) + '" placeholder="0" '
      +       'data-project-field="expectedValue" data-project-id="' + pid + '" id="projVal_' + pid + '">'
      +     '<label class="proj-modal-paid-label' + (project.isPaid ? ' is-paid' : '') + '">'
      +       '<input type="checkbox" class="proj-modal-paid-check"' + (project.isPaid ? ' checked' : '') + ' '
      +       'data-project-field="isPaid" data-project-id="' + pid + '">'
      +       '<span>Pago</span>'
      +     '</label>'
      +   '</div>'
      + '</div>'

      // Datas: Prazo + Início side-by-side
      + '<div class="proj-modal-prop proj-modal-prop--dates">'
      +   '<span class="proj-modal-prop__label">Datas</span>'
      +   '<div class="proj-modal-dates-row">'
      +     '<div class="proj-modal-date-field">'
      +       '<span class="proj-modal-date-label">Prazo</span>'
      +       '<button type="button" class="proj-modal-date-btn" data-date-for="' + deadlineInputId + '">' + shortDate(project.deadline) + '</button>'
      +       '<input type="date" class="proj-modal-date-hidden" value="' + (project.deadline || '') + '" id="' + deadlineInputId + '" data-project-field="deadline" data-project-id="' + pid + '">'
      +     '</div>'
      +     '<div class="proj-modal-date-field">'
      +       '<span class="proj-modal-date-label">Início</span>'
      +       '<button type="button" class="proj-modal-date-btn" data-date-for="' + startInputId + '">' + shortDate(project.startDate) + '</button>'
      +       '<input type="date" class="proj-modal-date-hidden" value="' + (project.startDate || '') + '" id="' + startInputId + '" data-project-field="startDate" data-project-id="' + pid + '">'
      +     '</div>'
      +   '</div>'
      + '</div>'

      // Opções secundárias (compactas)
      + '<div class="proj-modal-prop proj-modal-prop--options">'
      +   '<span class="proj-modal-prop__label">Opções</span>'
      +   '<div class="proj-modal-chips-row">'
      +     '<label class="proj-modal-chip-toggle">'
      +       '<input type="checkbox"' + (project.isDraft ? ' checked' : '') + ' data-project-field="isDraft" data-project-id="' + pid + '"> Template'
      +     '</label>'
      +     '<label class="proj-modal-chip-toggle">'
      +       '<input type="checkbox"' + (project.collapseSubtasks !== false ? ' checked' : '') + ' data-project-field="collapseSubtasks" data-project-id="' + pid + '"> Recolher subtarefas'
      +     '</label>'
      +   '</div>'
      + '</div>'

    + '</div>' // /proj-modal-props

    // Notas
    + '<div class="proj-modal-section">'
    +   '<div class="proj-modal-section__header">Notas</div>'
    +   '<textarea class="flowly-textarea proj-modal-textarea" data-project-field="notes" data-project-id="' + pid + '" placeholder="Próximo passo, observações...">' + safe(project.notes || '') + '</textarea>'
    + '</div>'

    // Checklist padrão
    + '<div class="proj-modal-section">'
    +   '<div class="proj-modal-section__header">Checklist padrão</div>'
    +   '<textarea id="' + templateTextareaId + '" class="flowly-textarea proj-modal-textarea" placeholder="Uma tarefa por linha">' + safe((project.templateTasks || []).join('\n')) + '</textarea>'
    + '</div>'

    + linkedHtml

    + '</div>' // /proj-modal-body

    // Footer
    + '<footer class="proj-modal-footer">'
    +   '<button type="button" class="proj-modal-footer__danger flowly-btn flowly-btn--ghost" data-project-card-action="delete" data-project-id="' + pid + '">'
    +     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
    +   '</button>'
    +   (project.status !== 'archived'
      ? '<button type="button" class="flowly-btn flowly-btn--ghost" data-project-card-action="archive" data-project-id="' + pid + '">Arquivar</button>'
      : '<button type="button" class="flowly-btn flowly-btn--ghost" data-project-card-action="restore" data-project-id="' + pid + '">↩ Restaurar</button>')
    +   '<div class="proj-modal-footer__spacer"></div>'
    +   '<button type="button" class="flowly-btn flowly-btn--ghost" data-project-card-action="save-template" data-project-id="' + pid + '" data-project-template-id="' + templateTextareaId + '">Salvar checklist</button>'
    +   '<button type="button" class="flowly-btn flowly-btn--primary" data-project-card-action="add-task" data-project-id="' + pid + '">+ Tarefa</button>'
    + '</footer>';

  // ── Event: campos de projeto ──────────────────────────────
  content.querySelectorAll('[data-project-field]').forEach((field) => {
    field.onchange = () => {
      const fid = field.dataset.projectId;
      const fname = field.dataset.projectField;
      if (!fid || !fname) return;
      const value = field.type === 'checkbox' ? field.checked : field.value;
      updateProjectField(fid, fname, value);

      // Sincroniza closedValue com expectedValue quando Pago está ativo
      if (fname === 'isPaid') {
        const valInput = content.querySelector('#projVal_' + fid);
        const currentVal = valInput ? Number(valInput.value) : Number(project.expectedValue || 0);
        updateProjectField(fid, 'closedValue', value ? currentVal : 0);
        field.closest('.proj-modal-paid-label').classList.toggle('is-paid', !!value);
      }
      if (fname === 'expectedValue') {
        const paidCheck = content.querySelector('[data-project-field="isPaid"][data-project-id="' + fid + '"]');
        if (paidCheck && paidCheck.checked) {
          updateProjectField(fid, 'closedValue', Number(value));
        }
      }
      // Atualiza label do botão de data
      if (fname === 'deadline' || fname === 'startDate') {
        const btnId = fname === 'deadline' ? deadlineInputId : startInputId;
        const btn = content.querySelector('[data-date-for="' + btnId + '"]');
        if (btn) btn.textContent = shortDate(value) || '—';
      }
    };
  });

  // ── Event: botões de data (abre picker) ───────────────────
  content.querySelectorAll('[data-date-for]').forEach((btn) => {
    btn.onclick = () => {
      const input = document.getElementById(btn.dataset.dateFor);
      if (!input) return;
      try { input.showPicker(); } catch (_) { input.focus(); input.click(); }
    };
  });

  // ── Event: ações do modal ─────────────────────────────────
  content.querySelectorAll('[data-project-card-action]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const action = btn.dataset.projectCardAction;
      const fid = btn.dataset.projectId;
      if (action === 'add-task' && fid) { addTaskInsideProject(fid); return; }
      if (action === 'archive' && fid) { archiveProject(fid); closeProjectDetailModal(); return; }
      if (action === 'restore' && fid) { window.moveProjectToKanbanColumn(fid, 'todo'); closeProjectDetailModal(); return; }
      if (action === 'delete' && fid) { deleteProject(fid); closeProjectDetailModal(); return; }
      if (action === 'save-template') {
        const textareaId = btn.dataset.projectTemplateId;
        if (fid && textareaId) saveProjectTemplateTasks(fid, textareaId);
        return;
      }
      if (action === 'unlink-task') {
        const dateStr = btn.dataset.projectTaskDate;
        const period = btn.dataset.projectTaskPeriod;
        const index = Number(btn.dataset.projectTaskIndex);
        if (dateStr && period && Number.isFinite(index)) unlinkTaskFromProject(dateStr, period, index);
      }
    };
  });

  content.querySelectorAll('[data-project-modal-close]').forEach((el) => {
    el.addEventListener('click', closeProjectDetailModal);
  });

  modal.classList.add('is-open');
}

function closeProjectDetailModal() {
  const modal = document.getElementById('projectDetailModal');
  if (modal) modal.classList.remove('is-open');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('projectDetailModal');
    if (modal && modal.classList.contains('is-open')) closeProjectDetailModal();
  }
});
