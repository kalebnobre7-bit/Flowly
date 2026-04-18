// renderProjectsView — redesign 2026 (grid de cards + modal de detalhes).
// Lógica de dados preservada (mesmos data-* attributes do runtime).

function renderProjectsView() {
  const view = document.getElementById('projectsView');
  if (!view) return;

  const analytics = buildProjectsAnalytics();
  const formatBRL = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const taskBacklogCount = collectProjectTaskCandidates({ includeLinked: false, max: 999 }).length;
  const draftTemplates = getProjectOptions().filter((p) => p.isDraft || p.status === 'draft');
  const today = localDateStr();
  const allProjects = analytics.projects;
  const filteredProjects = sortProjectsForBoard(filterProjects(allProjects, projectsFilter, today), today);
  const activeCount = allProjects.filter((p) => !p.isDraft && !p.completionDate && p.status !== 'archived').length;
  const lateCount = allProjects.filter((p) => !p.completionDate && p.deadline && p.deadline < today && !p.isDraft).length;
  const draftCount = allProjects.filter((p) => p.isDraft || p.status === 'draft').length;
  const doneCount = allProjects.filter((p) => !!p.completionDate).length;
  const archivedCount = allProjects.filter((p) => p.status === 'archived').length;
  const paidCount = allProjects.filter((p) => p.isPaid).length;
  const unpaidCount = allProjects.filter((p) => !p.isPaid && !p.isDraft).length;
  const totalRevenue = allProjects.reduce((sum, p) => sum + (p.expectedValue || 0), 0);
  const deliveredUnpaidCount = allProjects.filter((p) => p.completionDate && !p.isPaid).length;

  const heroInsight = (() => {
    if (lateCount > 0) return lateCount + ' projeto(s) em atraso. Precisam de resposta.';
    if (deliveredUnpaidCount > 0) return deliveredUnpaidCount + ' entrega(s) concluidas aguardando pagamento.';
    if (taskBacklogCount > 0) return taskBacklogCount + ' tarefa(s) soltas podem virar projeto.';
    return 'Operacao sob controle. Organize as proximas entregas.';
  })();

  const filterTabs = [
    { id: 'all', label: 'Todos', count: allProjects.length },
    { id: 'active', label: 'Ativos', count: activeCount },
    { id: 'late', label: 'Atrasados', count: lateCount },
    { id: 'unpaid', label: 'Nao pagos', count: unpaidCount },
    { id: 'done', label: 'Concluidos', count: doneCount },
    { id: 'draft', label: 'Templates', count: draftCount },
    { id: 'archived', label: 'Arquivados', count: archivedCount }
  ];

  const renderProjectCard = (project) => {
    const progress = getProjectProgressRate(project.id);
    const statusBadge = getProjectStatus(project, today);
    const deadlineDiff = getProjectDeadlineDiff(project.deadline, today);
    const progressPct = progress ? progress.pct : 0;
    const progressTotal = progress ? progress.total : 0;

    const deadlineText = (() => {
      if (project.completionDate) return 'Fechado ' + formatProjectDateShort(project.completionDate);
      if (deadlineDiff === null) return 'Sem prazo';
      if (deadlineDiff < 0) return Math.abs(deadlineDiff) + 'd atraso';
      if (deadlineDiff === 0) return 'Hoje';
      if (deadlineDiff === 1) return 'Amanha';
      return 'em ' + deadlineDiff + 'd';
    })();

    const isLate = !project.completionDate && deadlineDiff !== null && deadlineDiff < 0;
    const isDone = !!project.completionDate;
    const progressVariant = isDone ? 'flowly-progress--success'
      : isLate ? 'flowly-progress--danger'
      : progressPct >= 60 ? ''
      : 'flowly-progress--warning';

    const palette = [
      'linear-gradient(135deg, #22c55e, #0A84FF)',
      'linear-gradient(135deg, #a855f7, #ec4899)',
      'linear-gradient(135deg, #FF9F0A, #FF5C4D)'
    ];
    const avatarSources = [project.clientName, project.serviceType].filter(Boolean).slice(0, 2);
    const avatarTokens = avatarSources.length > 0
      ? avatarSources.map((label, i) => {
          const initials = String(label).trim().split(/\s+/).slice(0, 2)
            .map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase();
          return '<span class="flowly-avatar flowly-avatar--sm" style="background:' + palette[i % palette.length] + '">' + escapeProjectHtml(initials || '?') + '</span>';
        }).join('')
      : '<span class="flowly-avatar flowly-avatar--sm" style="background:' + palette[0] + '">FL</span>';

    const amountLabel = project.closedValue > 0
      ? formatBRL(project.closedValue)
      : formatBRL(project.expectedValue || 0);
    const amountCaption = project.closedValue > 0 ? 'Fechado' : 'Previsto';
    const safeName = escapeProjectHtml(project.name);
    const safeClient = escapeProjectHtml(project.clientName || '');
    const safeType = escapeProjectHtml(project.serviceType || '');

    const badgeVariant = isDone ? 'flowly-pill--success'
      : isLate ? 'flowly-pill--danger'
      : project.isDraft ? 'flowly-pill'
      : 'flowly-pill--primary';

    const metaBits = [];
    metaBits.push('<span class="projects-card-v2__deadline' + (isLate ? ' is-late' : '') + '">' + deadlineText + '</span>');
    metaBits.push('<span class="projects-card-v2__divider">·</span>');
    metaBits.push('<span>' + (progressTotal > 0 ? progress.done + '/' + progressTotal + ' tarefas' : 'Sem tarefas') + '</span>');
    if (project.isPaid) {
      metaBits.push('<span class="flowly-pill flowly-pill--success" style="margin-left:auto">Pago</span>');
    } else if (!project.isDraft) {
      metaBits.push('<span class="flowly-pill" style="margin-left:auto">Em aberto</span>');
    }

    return '<article class="projects-card-v2 flowly-panel" data-project-card-id="' + project.id + '" data-project-id="' + project.id + '">'
      + '<header class="projects-card-v2__head">'
      +   '<div class="projects-card-v2__title">'
      +     '<h3>' + safeName + '</h3>'
      +     ((safeClient || safeType) ? '<p>' + [safeClient, safeType].filter(Boolean).join(' · ') + '</p>' : '')
      +   '</div>'
      +   '<span class="flowly-pill ' + badgeVariant + '">' + statusBadge.label + '</span>'
      + '</header>'
      + '<div class="projects-card-v2__meta">' + metaBits.join('') + '</div>'
      + (progressTotal > 0
          ? '<div class="flowly-progress ' + progressVariant + '" style="margin-bottom:var(--flowly-space-4)"><div class="flowly-progress__fill" style="width:' + progressPct + '%"></div></div>'
          : '<div style="height:var(--flowly-space-4)"></div>')
      + '<footer class="projects-card-v2__foot">'
      +   '<div class="flowly-avatar-group">' + avatarTokens + '</div>'
      +   '<div class="projects-card-v2__amount">'
      +     '<span class="projects-card-v2__amount-value">' + amountLabel + '</span>'
      +     '<span class="projects-card-v2__amount-caption">' + amountCaption + '</span>'
      +   '</div>'
      +   '<button type="button" class="flowly-btn flowly-btn--ghost flowly-btn--sm" data-project-card-action="open-detail" data-project-id="' + project.id + '">Detalhes</button>'
      + '</footer>'
      + '</article>';
  };

  const sidebarStats = '<section class="flowly-panel">'
    + '<header style="margin-bottom:var(--flowly-space-4)">'
    +   '<h3 style="font-size:var(--flowly-text-base);font-weight:600;color:var(--flowly-text-primary);margin-bottom:var(--flowly-space-1)">Leitura rapida</h3>'
    +   '<p style="font-size:var(--flowly-text-xs);color:var(--flowly-text-secondary)">Sinais da operacao agora.</p>'
    + '</header>'
    + '<div class="projects-stat-list">'
    +   '<div class="projects-stat-row"><span>Ativos</span><strong>' + activeCount + '</strong></div>'
    +   '<div class="projects-stat-row"><span>Atrasados</span><strong style="color:' + (lateCount > 0 ? 'var(--flowly-accent-danger)' : 'var(--flowly-text-primary)') + '">' + lateCount + '</strong></div>'
    +   '<div class="projects-stat-row"><span>Nao pagos</span><strong style="color:' + (unpaidCount > 0 ? 'var(--flowly-accent-warning)' : 'var(--flowly-text-primary)') + '">' + unpaidCount + '</strong></div>'
    +   '<div class="projects-stat-row"><span>Receita prevista</span><strong>' + formatBRL(totalRevenue) + '</strong></div>'
    +   '<div class="projects-stat-row"><span>Entregue sem pagar</span><strong style="color:' + (deliveredUnpaidCount > 0 ? 'var(--flowly-accent-danger)' : 'var(--flowly-text-primary)') + '">' + deliveredUnpaidCount + '</strong></div>'
    +   '<div class="projects-stat-row"><span>Tarefas sem contexto</span><strong>' + taskBacklogCount + '</strong></div>'
    + '</div>'
    + '</section>';

  const draftOptionsHtml = draftTemplates.length > 0
    ? '<select id="projectTemplateSource" class="flowly-select"><option value="">Sem template</option>'
      + draftTemplates.map((p) => '<option value="' + p.id + '">' + escapeProjectHtml(p.name) + (p.templateTasks && p.templateTasks.length ? ' · ' + p.templateTasks.length + ' tarefas' : '') + '</option>').join('')
      + '</select>'
    : '';

  const newProjectForm = '<section class="flowly-panel">'
    + '<header style="margin-bottom:var(--flowly-space-4)">'
    +   '<h3 style="font-size:var(--flowly-text-base);font-weight:600;color:var(--flowly-text-primary);margin-bottom:var(--flowly-space-1)">Novo projeto</h3>'
    +   '<p style="font-size:var(--flowly-text-xs);color:var(--flowly-text-secondary)">Essencial agora, detalhes depois.</p>'
    + '</header>'
    + '<div style="display:flex;flex-direction:column;gap:var(--flowly-space-2)">'
    +   '<input id="projectQuickName" class="flowly-input" type="text" placeholder="Nome do projeto">'
    +   '<input id="projectQuickClient" class="flowly-input" type="text" placeholder="Cliente (opcional)">'
    +   '<input id="projectQuickServiceType" class="flowly-input" type="text" placeholder="Tipo: LP, Site, etc.">'
    +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--flowly-space-2)">'
    +     '<input id="projectQuickDeadline" class="flowly-input" type="date" title="Prazo">'
    +     '<input id="projectQuickExpectedValue" class="flowly-input" type="number" min="0" step="0.01" placeholder="Valor R$">'
    +   '</div>'
    +   draftOptionsHtml
    +   '<div style="display:flex;gap:var(--flowly-space-2);margin-top:var(--flowly-space-2)">'
    +     '<button type="button" class="flowly-btn flowly-btn--primary" data-projects-action="create-linked" style="flex:1">Criar projeto</button>'
    +     '<button type="button" class="flowly-btn flowly-btn--secondary" data-projects-action="create-quick">Rapido</button>'
    +   '</div>'
    + '</div>'
    + '</section>';

  const suggestionsPanel = (analytics.suggestionTasks.length > 0 || analytics.suggestionTransactions.length > 0)
    ? '<section class="flowly-panel">'
      + '<header style="margin-bottom:var(--flowly-space-4)">'
      +   '<h3 style="font-size:var(--flowly-text-base);font-weight:600;color:var(--flowly-text-primary);margin-bottom:var(--flowly-space-1)">Sugestoes</h3>'
      +   '<p style="font-size:var(--flowly-text-xs);color:var(--flowly-text-secondary)">Vinculos que fazem sentido.</p>'
      + '</header>'
      + '<div style="display:flex;flex-direction:column;gap:var(--flowly-space-2)">'
      + analytics.suggestionTasks.slice(0, 3).map((item) => '<div class="projects-suggestion-row"><span>' + escapeProjectHtml(item.text) + '</span><button type="button" class="flowly-btn flowly-btn--ghost flowly-btn--sm" data-projects-apply-task-date="' + item.dateStr + '" data-projects-apply-task-period="' + item.period + '" data-projects-apply-task-index="' + item.index + '" data-projects-suggestion="' + item.suggestion.id + '">Aplicar</button></div>').join('')
      + analytics.suggestionTransactions.slice(0, 3).map((item) => '<div class="projects-suggestion-row"><span>' + escapeProjectHtml(item.transaction.description) + '</span><button type="button" class="flowly-btn flowly-btn--ghost flowly-btn--sm" data-projects-apply-transaction="' + item.transaction.id + '" data-projects-suggestion="' + item.suggestion.id + '">Aplicar</button></div>').join('')
      + '</div>'
      + '</section>'
    : '';

  const emptyState = '<div class="flowly-dotted" style="padding:var(--flowly-space-12) var(--flowly-space-6);display:grid;place-items:center;text-align:center;min-height:280px">'
    + '<div>'
    +   '<h3 style="font-size:var(--flowly-text-lg);font-weight:600;color:var(--flowly-text-primary);margin-bottom:var(--flowly-space-2)">Nenhum projeto nessa visao</h3>'
    +   '<p style="font-size:var(--flowly-text-sm);color:var(--flowly-text-secondary);margin-bottom:var(--flowly-space-4)">Crie um projeto na coluna ao lado ou mude o filtro.</p>'
    +   '<button type="button" class="flowly-btn flowly-btn--secondary flowly-btn--sm" data-projects-filter="all">Ver todos</button>'
    + '</div>'
    + '</div>';

  view.innerHTML = '<div class="flowly-shell flowly-shell--wide projects-shell-v2">'
    + '<header class="flowly-page-header">'
    +   '<div class="flowly-page-header__title"><h1>Projetos</h1><p class="flowly-page-header__subtitle">' + heroInsight + '</p></div>'
    +   '<div class="flowly-page-header__actions">'
    +     '<button type="button" class="flowly-btn flowly-btn--primary" data-projects-action="focus-new">'
    +       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>'
    +       '<span>Novo projeto</span>'
    +     '</button>'
    +   '</div>'
    + '</header>'
    + '<nav class="flowly-segmented projects-filters-v2" role="tablist" style="margin-bottom:var(--flowly-space-5);flex-wrap:wrap">'
    +   filterTabs.map((item) => '<button type="button" class="flowly-segmented__item' + (projectsFilter === item.id ? ' is-active' : '') + '" data-projects-filter="' + item.id + '">' + item.label + '<span style="opacity:0.6;margin-left:6px;font-size:var(--flowly-text-xs)">' + item.count + '</span></button>').join('')
    + '</nav>'
    + '<div class="projects-layout-v2">'
    +   '<main class="projects-grid-v2">' + (filteredProjects.length > 0 ? filteredProjects.map(renderProjectCard).join('') : emptyState) + '</main>'
    +   '<aside class="projects-aside-v2">' + sidebarStats + newProjectForm + suggestionsPanel + '</aside>'
    + '</div>'
    + '</div>'
    + '<div class="flowly-modal" id="projectDetailModal" role="dialog" aria-modal="true">'
    +   '<div class="flowly-modal__backdrop" data-project-modal-close></div>'
    +   '<div class="flowly-modal__content" style="max-width:640px" id="projectDetailModalContent"></div>'
    + '</div>';

  if (window.lucide) lucide.createIcons();

  // --- Event listeners ---
  view.querySelectorAll('[data-projects-filter]').forEach((btn) => {
    btn.onclick = () => setProjectsFilter(btn.dataset.projectsFilter || 'all');
  });

  view.querySelectorAll('[data-projects-action]').forEach((btn) => {
    btn.onclick = () => {
      const action = btn.dataset.projectsAction;
      if (action === 'open-quick-modal') openQuickProjectModal();
      if (action === 'create-quick') createProjectQuick();
      if (action === 'create-linked') createProjectWithLinks();
      if (action === 'focus-new') {
        const target = document.getElementById('projectQuickName');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => target.focus(), 300);
        }
      }
    };
  });

  view.querySelectorAll('[data-projects-apply-transaction]').forEach((btn) => {
    btn.onclick = () => {
      const transactionId = btn.dataset.projectsApplyTransaction;
      const suggestionId = btn.dataset.projectsSuggestion;
      if (transactionId && suggestionId) applySuggestedTransactionProject(transactionId, suggestionId);
    };
  });
  view.querySelectorAll('[data-projects-apply-task-date]').forEach((btn) => {
    btn.onclick = () => {
      const dateStr = btn.dataset.projectsApplyTaskDate;
      const period = btn.dataset.projectsApplyTaskPeriod;
      const index = Number(btn.dataset.projectsApplyTaskIndex);
      const suggestionId = btn.dataset.projectsSuggestion;
      if (dateStr && period && Number.isFinite(index) && suggestionId) {
        applySuggestedTaskProject(dateStr, period, index, suggestionId);
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
  view.querySelectorAll('[data-project-card-action="open-detail"]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const pid = btn.dataset.projectId;
      if (pid) openProjectDetailModal(pid);
    };
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
    + '<header style="margin-bottom:var(--flowly-space-5)">'
    +   '<div style="font-size:var(--flowly-text-2xs);text-transform:uppercase;letter-spacing:0.08em;color:var(--flowly-text-tertiary);margin-bottom:var(--flowly-space-1)">Detalhes do projeto</div>'
    +   '<h2 style="font-family:var(--flowly-font-display);font-size:var(--flowly-text-2xl);font-weight:700;color:var(--flowly-text-primary);letter-spacing:-0.02em">' + safeName + '</h2>'
    + '</header>'
    + '<div class="projects-modal-form">'
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
    +   '<footer class="projects-modal-actions-v2">'
    +     '<button type="button" class="flowly-btn flowly-btn--primary" data-project-card-action="add-task" data-project-id="' + project.id + '">+ Tarefa</button>'
    +     '<button type="button" class="flowly-btn flowly-btn--secondary" data-project-card-action="save-template" data-project-id="' + project.id + '" data-project-template-id="' + templateTextareaId + '">Salvar checklist</button>'
    +     (project.status !== 'archived' ? '<button type="button" class="flowly-btn flowly-btn--ghost" data-project-card-action="archive" data-project-id="' + project.id + '">Arquivar</button>' : '')
    +     '<button type="button" class="flowly-btn flowly-btn--danger" data-project-card-action="delete" data-project-id="' + project.id + '">Remover</button>'
    +   '</footer>'
    + '</div>';

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
