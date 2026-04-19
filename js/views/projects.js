// renderProjectsView — redesign 2026 (kanban board + modal de detalhes).
// Lógica de dados preservada (mesmos data-* attributes do runtime).

const PROJECTS_KANBAN_COLUMNS = [
  { id: 'todo', label: 'A fazer', hint: 'Ainda não começou' },
  { id: 'doing', label: 'Em andamento', hint: 'Com tarefas abertas' },
  { id: 'late', label: 'Em atraso', hint: 'Passou do prazo', readonly: true },
  { id: 'awaiting-payment', label: 'Aguardando pagamento', hint: 'Entregue, falta receber' },
  { id: 'done', label: 'Concluído', hint: 'Entregue e pago' },
  { id: 'archived', label: 'Arquivado', hint: 'Fora do radar' }
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

function renderProjectsView() {
  const view = document.getElementById('projectsView');
  if (!view) return;

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

  const heroInsight = (() => {
    if (lateCount > 0) return lateCount + ' projeto(s) em atraso. Precisam de resposta.';
    if (deliveredUnpaidCount > 0) return deliveredUnpaidCount + ' entrega(s) concluídas aguardando pagamento.';
    if (taskBacklogCount > 0) return taskBacklogCount + ' tarefa(s) soltas podem virar projeto.';
    return 'Operação sob controle. Organize as próximas entregas.';
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

    const safeName = escapeProjectHtml(project.name);
    const safeClient = escapeProjectHtml(project.clientName || project.serviceType || '');

    const progressVariant = isDone ? 'flowly-progress--success'
      : isLate ? 'flowly-progress--danger'
      : progressPct >= 60 ? ''
      : 'flowly-progress--warning';

    const avatarLabel = (project.clientName || project.serviceType || project.name || '?').trim();
    const initials = avatarLabel.split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase() || '?';

    return '<article class="kanban-card" draggable="true" data-project-card-id="' + project.id + '" data-project-id="' + project.id + '">'
      + '<div class="kanban-card__title">' + safeName + '</div>'
      + (safeClient ? '<div class="kanban-card__sub">' + safeClient + '</div>' : '')
      + (progressTotal > 0
          ? '<div class="kanban-card__progress"><div class="flowly-progress ' + progressVariant + '"><div class="flowly-progress__fill" style="width:' + progressPct + '%"></div></div><span>' + progress.done + '/' + progressTotal + '</span></div>'
          : '<div class="kanban-card__progress kanban-card__progress--empty">Sem tarefas</div>')
      + '<div class="kanban-card__foot">'
      +   '<span class="kanban-card__deadline' + (isLate ? ' is-late' : '') + '">' + deadlineText + '</span>'
      +   (amountLabel ? '<span class="kanban-card__amount">' + amountLabel + '</span>' : '')
      +   '<span class="flowly-avatar flowly-avatar--sm kanban-card__avatar">' + escapeProjectHtml(initials) + '</span>'
      + '</div>'
      + '</article>';
  };

  const renderKanbanColumn = (col) => {
    const items = projectsByColumn[col.id] || [];
    return '<section class="kanban-column' + (col.readonly ? ' kanban-column--readonly' : '') + '" data-kanban-column="' + col.id + '">'
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
    + '<div class="flowly-stat-card flowly-stat-card--inline flowly-stat-card--' + (deliveredUnpaidCount > 0 ? 'warning' : 'success') + '"><div class="flowly-stat-card__label">Aguardando pagamento</div><div class="flowly-stat-card__value">' + deliveredUnpaidCount + '</div></div>'
    + '<div class="flowly-stat-card flowly-stat-card--inline"><div class="flowly-stat-card__label">Receita prevista</div><div class="flowly-stat-card__value">' + formatBRL(totalRevenue) + '</div></div>'
    + '</div>';

  view.innerHTML = '<div class="flowly-shell flowly-shell--wide projects-shell-v2">'
    + '<header class="flowly-page-header">'
    +   '<div class="flowly-page-header__title"><h1 class="flowly-page-title">Projetos</h1><p class="flowly-page-subtitle">' + heroInsight + '</p></div>'
    +   '<div class="flowly-page-header__actions">'
    +     '<button type="button" class="flowly-btn flowly-btn--primary" data-projects-action="open-quick-modal">'
    +       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>'
    +       '<span>Novo projeto</span>'
    +     '</button>'
    +   '</div>'
    + '</header>'
    + statsStrip
    + '<div class="kanban-board" data-projects-kanban>'
    +   PROJECTS_KANBAN_COLUMNS.map(renderKanbanColumn).join('')
    + '</div>'
    + '</div>'
    + '<div class="flowly-modal" id="projectDetailModal" role="dialog" aria-modal="true">'
    +   '<div class="flowly-modal__backdrop" data-project-modal-close></div>'
    +   '<div class="flowly-modal__content" style="max-width:640px" id="projectDetailModalContent"></div>'
    + '</div>';

  if (window.lucide) lucide.createIcons();

  // --- Event listeners ---
  view.querySelectorAll('[data-projects-action]').forEach((btn) => {
    btn.onclick = () => {
      const action = btn.dataset.projectsAction;
      if (action === 'open-quick-modal') openQuickProjectModal();
    };
  });

  view.querySelectorAll('[data-project-card-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, input, textarea, select, label, a')) return;
      const pid = card.dataset.projectCardId;
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
}

// =============================================================
// MODAL DE DETALHES DO PROJETO
// =============================================================
function openProjectDetailModal(projectId) {
  const project = getProjectOptions().find((p) => p.id === projectId);
  if (!project) return;
  const modal = document.getElementById('projectDetailModal');
  const content = document.getElementById('projectDetailModalContent');
  if (!modal || !content) return;

  const linkedTasks = collectProjectTaskCandidates({ includeLinked: true, max: 20, projectId: project.id });
  const templateTextareaId = 'projectTemplate_' + project.id;
  const notesValue = escapeProjectHtml(project.notes || '');
  const templateValue = escapeProjectHtml((project.templateTasks || []).join('\n'));
  const safeName = escapeProjectHtml(project.name);
  const safeClient = escapeProjectHtml(project.clientName || '');
  const safeType = escapeProjectHtml(project.serviceType || '');

  const linkedTasksHtml = linkedTasks.length > 0
    ? '<div><span style="display:block;font-size:var(--flowly-text-xs);font-weight:600;color:var(--flowly-text-secondary);margin-bottom:var(--flowly-space-2)">Tarefas vinculadas</span><div style="display:flex;flex-direction:column;gap:var(--flowly-space-2)">'
      + linkedTasks.map((item) => '<div class="projects-linked-item-v2"><div><strong>' + escapeProjectHtml(item.task.text) + '</strong><p>' + item.dateStr + ' · ' + item.period + (item.task.completed ? ' · concluida' : '') + '</p></div><button type="button" class="flowly-btn flowly-btn--ghost flowly-btn--sm" data-project-card-action="unlink-task" data-project-task-date="' + item.dateStr + '" data-project-task-period="' + item.period + '" data-project-task-index="' + item.index + '">Desvincular</button></div>').join('')
      + '</div></div>'
    : '';

  content.innerHTML = '<button type="button" class="flowly-modal__close" data-project-modal-close aria-label="Fechar">'
    + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>'
    + '</button>'
    + '<header class="flowly-modal__header">'
    +   '<div>'
    +     '<h2 class="flowly-modal__title">' + safeName + '</h2>'
    +     '<p class="flowly-modal__subtitle">Detalhes do projeto</p>'
    +   '</div>'
    + '</header>'
    + '<div class="flowly-modal__body">'
    +   '<div class="projects-modal-grid">'
    +     '<label class="projects-modal-field"><span>Nome</span><input class="flowly-input" type="text" value="' + safeName + '" data-project-field="name" data-project-id="' + project.id + '"></label>'
    +     '<label class="projects-modal-field"><span>Cliente</span><input class="flowly-input" type="text" value="' + safeClient + '" placeholder="Nome do cliente" data-project-field="clientName" data-project-id="' + project.id + '"></label>'
    +     '<label class="projects-modal-field"><span>Tipo</span><input class="flowly-input" type="text" value="' + safeType + '" placeholder="LP, Shopify, etc" data-project-field="serviceType" data-project-id="' + project.id + '"></label>'
    +     '<label class="projects-modal-field"><span>Valor previsto</span><input class="flowly-input" type="number" min="0" step="0.01" value="' + Number(project.expectedValue || 0) + '" data-project-field="expectedValue" data-project-id="' + project.id + '"></label>'
    +     '<label class="projects-modal-field"><span>Prazo</span><input class="flowly-input" type="date" value="' + (project.deadline || '') + '" data-project-field="deadline" data-project-id="' + project.id + '"></label>'
    +     '<label class="projects-modal-field"><span>Inicio</span><input class="flowly-input" type="date" value="' + (project.startDate || '') + '" data-project-field="startDate" data-project-id="' + project.id + '"></label>'
    +   '</div>'
    +   '<div class="projects-modal-toggles">'
    +     '<label class="projects-modal-toggle"><input type="checkbox"' + (project.isPaid ? ' checked' : '') + ' data-project-field="isPaid" data-project-id="' + project.id + '"><span>Pago</span></label>'
    +     '<label class="projects-modal-toggle"><input type="checkbox"' + (project.isDraft ? ' checked' : '') + ' data-project-field="isDraft" data-project-id="' + project.id + '"><span>Template</span></label>'
    +     '<label class="projects-modal-toggle"><input type="checkbox"' + (project.collapseSubtasks !== false ? ' checked' : '') + ' data-project-field="collapseSubtasks" data-project-id="' + project.id + '"><span>Recolher subtarefas</span></label>'
    +   '</div>'
    +   '<label class="projects-modal-field"><span>Notas operacionais</span><textarea class="flowly-textarea" data-project-field="notes" data-project-id="' + project.id + '" placeholder="Proximo passo, observacoes...">' + notesValue + '</textarea></label>'
    +   '<label class="projects-modal-field"><span>Checklist padrao</span><textarea id="' + templateTextareaId + '" class="flowly-textarea" placeholder="Uma tarefa por linha">' + templateValue + '</textarea></label>'
    +   linkedTasksHtml
    + '</div>'
    + '<footer class="flowly-modal__footer">'
    +   '<button type="button" class="flowly-btn flowly-btn--danger" data-project-card-action="delete" data-project-id="' + project.id + '">Remover</button>'
    +   (project.status !== 'archived' ? '<button type="button" class="flowly-btn flowly-btn--ghost" data-project-card-action="archive" data-project-id="' + project.id + '">Arquivar</button>' : '')
    +   '<button type="button" class="flowly-btn flowly-btn--secondary" data-project-card-action="save-template" data-project-id="' + project.id + '" data-project-template-id="' + templateTextareaId + '">Salvar checklist</button>'
    +   '<button type="button" class="flowly-btn flowly-btn--primary" data-project-card-action="add-task" data-project-id="' + project.id + '">+ Tarefa</button>'
    + '</footer>';

  content.querySelectorAll('[data-project-field]').forEach((field) => {
    field.onchange = () => {
      const pid = field.dataset.projectId;
      const pfield = field.dataset.projectField;
      if (!pid || !pfield) return;
      const value = field.type === 'checkbox' ? field.checked : field.value;
      updateProjectField(pid, pfield, value);
    };
  });

  content.querySelectorAll('[data-project-card-action]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const action = btn.dataset.projectCardAction;
      const pid = btn.dataset.projectId;
      if (action === 'add-task' && pid) { addTaskInsideProject(pid); return; }
      if (action === 'archive' && pid) { archiveProject(pid); closeProjectDetailModal(); return; }
      if (action === 'delete' && pid) { deleteProject(pid); closeProjectDetailModal(); return; }
      if (action === 'save-template') {
        const textareaId = btn.dataset.projectTemplateId;
        if (pid && textareaId) saveProjectTemplateTasks(pid, textareaId);
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
