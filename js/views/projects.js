// renderProjectsView — redesign Kanban/Trello com padrão Flowly DS
function renderProjectsView() {
  const view = document.getElementById('projectsView');
  if (!view) return;

  const analytics = buildProjectsAnalytics();
  const formatBRL = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const taskCandidates = collectProjectTaskCandidates({ includeLinked: false, max: 10 });
  const taskBacklogCount = collectProjectTaskCandidates({ includeLinked: false, max: 999 }).length;
  const draftTemplates = getProjectOptions().filter((p) => p.isDraft || p.status === 'draft');
  const today = localDateStr();
  const allProjects = analytics.projects;
  const filteredProjects = filterProjects(allProjects, projectsFilter, today);
  const boardSections = buildProjectsBoardSections(filteredProjects, projectsFilter, today);
  const activeCount = allProjects.filter((p) => !p.isDraft && !p.completionDate && p.status !== 'archived').length;
  const lateCount = allProjects.filter((p) => !p.completionDate && p.deadline && p.deadline < today && !p.isDraft).length;
  const draftCount = allProjects.filter((p) => p.isDraft || p.status === 'draft').length;
  const doneCount = allProjects.filter((p) => !!p.completionDate).length;
  const archivedCount = allProjects.filter((p) => p.status === 'archived').length;
  const paidCount = allProjects.filter((p) => p.isPaid).length;
  const unpaidCount = allProjects.filter((p) => !p.isPaid && !p.isDraft).length;
  const totalRevenue = allProjects.reduce((sum, p) => sum + (p.expectedValue || 0), 0);
  const deliveredUnpaidCount = allProjects.filter((p) => p.completionDate && !p.isPaid).length;
  const focusProject = sortProjectsForBoard(allProjects, today)[0] || null;
  const focusProgress = focusProject ? getProjectProgressRate(focusProject.id) : null;
  const focusHint = focusProject ? getProjectActionHint(focusProject, focusProgress, today) : null;
  const suggestionCount = Number(analytics.suggestionTasks.length || 0) + Number(analytics.suggestionTransactions.length || 0);
  const urgentProjects = getUrgentProjects(allProjects, 5);

  const filterTabs = [
    { id: 'all', label: 'Todos', count: filteredProjects.length },
    { id: 'active', label: 'Ativos', count: activeCount },
    { id: 'late', label: 'Atrasados', count: lateCount },
    { id: 'paid', label: 'Pagos', count: paidCount },
    { id: 'unpaid', label: 'Não pagos', count: unpaidCount },
    { id: 'done', label: 'Concluídos', count: doneCount },
    { id: 'draft', label: 'Templates', count: draftCount },
    { id: 'archived', label: 'Arquivados', count: archivedCount }
  ];

  const heroInsight = (() => {
    if (lateCount > 0) return `${lateCount} projeto(s) em atraso — precisam de resposta.`;
    if (deliveredUnpaidCount > 0) return `${deliveredUnpaidCount} entrega(s) concluídas aguardando pagamento.`;
    if (urgentProjects.length > 0) return `${urgentProjects.length} projeto(s) vencem nos próximos 5 dias.`;
    if (taskBacklogCount > 0) return `${taskBacklogCount} tarefa(s) soltas podem virar projeto.`;
    return 'Operação sob controle. Organize as próximas entregas.';
  })();

  // Lane theme mapping
  const laneThemes = {
    attention: { themeClass: 'projects-lane--attention', priorityBar: 'projects-card-priority-bar--urgent' },
    execution: { themeClass: 'projects-lane--execution', priorityBar: 'projects-card-priority-bar--active' },
    closed: { themeClass: 'projects-lane--closed', priorityBar: 'projects-card-priority-bar--done' },
    library: { themeClass: 'projects-lane--library', priorityBar: 'projects-card-priority-bar--library' },
    active: { themeClass: 'projects-lane--execution', priorityBar: 'projects-card-priority-bar--active' },
    late: { themeClass: 'projects-lane--attention', priorityBar: 'projects-card-priority-bar--urgent' },
    paid: { themeClass: 'projects-lane--closed', priorityBar: 'projects-card-priority-bar--done' },
    unpaid: { themeClass: 'projects-lane--attention', priorityBar: 'projects-card-priority-bar--moderate' },
    done: { themeClass: 'projects-lane--closed', priorityBar: 'projects-card-priority-bar--done' },
    draft: { themeClass: 'projects-lane--library', priorityBar: 'projects-card-priority-bar--library' },
    archived: { themeClass: 'projects-lane--library', priorityBar: 'projects-card-priority-bar--library' }
  };

  // ---- Project card builder ----
  const renderProjectCard = (project, sectionKey) => {
    const linkedTasks = collectProjectTaskCandidates({ includeLinked: true, max: 8, projectId: project.id });
    const templateTextareaId = `projectTemplate_${project.id}`;
    const statusBadge = getProjectStatus(project, today);
    const progress = getProjectProgressRate(project.id);
    const actionHint = getProjectActionHint(project, progress, today);
    const deadlineDiff = getProjectDeadlineDiff(project.deadline, today);
    const progressPct = progress ? progress.pct : 0;
    const progressDone = progress ? progress.done : 0;
    const progressTotal = progress ? progress.total : 0;
    const progressColor = progressPct === 100 ? '#30D158' : progressPct >= 55 ? '#F27405' : '#FF9F0A';

    const deadlineText = (() => {
      if (project.completionDate) return `Fechado ${formatProjectDateShort(project.completionDate)}`;
      if (deadlineDiff === null) return 'Sem prazo';
      if (deadlineDiff < 0) return `${Math.abs(deadlineDiff)}d atraso`;
      if (deadlineDiff === 0) return 'Hoje';
      if (deadlineDiff === 1) return 'Amanhã';
      return `${deadlineDiff}d`;
    })();

    const notesValue = escapeProjectHtml(project.notes || '');
    const templateValue = escapeProjectHtml((project.templateTasks || []).join('\n'));
    const safeName = escapeProjectHtml(project.name);
    const safeClient = escapeProjectHtml(project.clientName || '');
    const safeType = escapeProjectHtml(project.serviceType || '');
    const amountLabel = project.closedValue > 0 ? formatBRL(project.closedValue) : formatBRL(project.expectedValue || 0);
    const amountCaption = project.closedValue > 0 ? 'Fechado' : 'Previsto';
    const laneTheme = laneThemes[sectionKey] || laneThemes.execution;

    // Avatar tokens (up to 2)
    const avatarSources = [project.clientName, project.serviceType].filter(Boolean).slice(0, 2);
    const avatarTokens = avatarSources.map((label, i) => {
      const initials = String(label).trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase();
      return `<span class="projects-card-avatar projects-card-avatar--${i + 1}">${escapeProjectHtml(initials || '?')}</span>`;
    }).join('');

    return `
      <div class="projects-card" data-project-card-id="${project.id}">
        <div class="projects-card-priority-bar ${laneTheme.priorityBar}"></div>
        <div class="projects-card-body">
          <div class="projects-card-tags">
            <span class="projects-badge ${statusBadge.cls}">${statusBadge.label}</span>
            ${project.serviceType ? `<span class="projects-badge">${safeType}</span>` : ''}
            <span class="projects-badge ${project.isPaid ? 'projects-badge--paid' : 'projects-badge--unpaid'}">${project.isPaid ? 'Pago' : 'Aberto'}</span>
          </div>
          <div class="projects-card-name">${safeName}</div>
          <div class="projects-card-detail">${escapeProjectHtml(actionHint.detail || `${safeClient ? safeClient + ' · ' : ''}${deadlineText}`)}</div>
        </div>

        ${progressTotal > 0 ? `
          <div class="projects-card-progress">
            <div class="projects-card-progress-track">
              <div class="projects-card-progress-fill" style="width:${progressPct}%;background:${progressColor}"></div>
            </div>
          </div>
        ` : ''}

        <div class="projects-card-footer">
          <div class="projects-card-avatars">
            ${avatarTokens || '<span class="projects-card-avatar projects-card-avatar--1">FL</span>'}
          </div>
          <div class="projects-card-stats">
            <span class="projects-card-stat">${linkedTasks.length} tarefas</span>
            <span class="projects-card-stat" style="color:${progressColor}">${progressTotal > 0 ? `${progressPct}%` : '—'}</span>
            <span class="projects-card-stat">${deadlineText}</span>
          </div>
          <span class="projects-card-amount">${amountLabel}</span>
        </div>

        <!-- Expand panel -->
        <div class="projects-card-expand">
          <div class="projects-config-grid">
            <label class="projects-config-field">
              <span>Nome</span>
              <input class="finance-input" type="text" value="${safeName}" data-project-field="name" data-project-id="${project.id}">
            </label>
            <label class="projects-config-field">
              <span>Cliente</span>
              <input class="finance-input" type="text" value="${safeClient}" placeholder="Nome do cliente" data-project-field="clientName" data-project-id="${project.id}">
            </label>
            <label class="projects-config-field">
              <span>Tipo</span>
              <input class="finance-input" type="text" value="${safeType}" placeholder="LP, Shopify, etc" data-project-field="serviceType" data-project-id="${project.id}">
            </label>
            <label class="projects-config-field">
              <span>Valor previsto</span>
              <input class="finance-input" type="number" min="0" step="0.01" value="${Number(project.expectedValue || 0)}" data-project-field="expectedValue" data-project-id="${project.id}">
            </label>
            <label class="projects-config-field">
              <span>Prazo</span>
              <input class="finance-input" type="date" value="${project.deadline || ''}" data-project-field="deadline" data-project-id="${project.id}">
            </label>
            <label class="projects-config-field">
              <span>Início</span>
              <input class="finance-input" type="date" value="${project.startDate || ''}" data-project-field="startDate" data-project-id="${project.id}">
            </label>
          </div>

          <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
              <input type="checkbox" ${project.isPaid ? 'checked' : ''} data-project-field="isPaid" data-project-id="${project.id}">
              <span style="color:var(--ds-text-secondary)">Pago</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
              <input type="checkbox" ${project.isDraft ? 'checked' : ''} data-project-field="isDraft" data-project-id="${project.id}">
              <span style="color:var(--ds-text-secondary)">Template</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
              <input type="checkbox" ${project.collapseSubtasks !== false ? 'checked' : ''} data-project-field="collapseSubtasks" data-project-id="${project.id}">
              <span style="color:var(--ds-text-secondary)">Recolher subtarefas</span>
            </label>
          </div>

          <label class="projects-config-field" style="width:100%;margin-bottom:10px">
            <span>Notas operacionais</span>
            <textarea class="finance-input projects-note-textarea" data-project-field="notes" data-project-id="${project.id}" placeholder="Próximo passo, observações...">${notesValue}</textarea>
          </label>

          <label class="projects-config-field" style="width:100%;margin-bottom:10px">
            <span>Checklist padrão</span>
            <textarea id="${templateTextareaId}" class="finance-input projects-note-textarea" placeholder="Uma tarefa por linha">${templateValue}</textarea>
          </label>

          ${linkedTasks.length > 0 ? `
            <div style="margin-bottom:10px">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--ds-text-muted);margin-bottom:6px">Tarefas vinculadas</div>
              <div class="projects-linked-list">
                ${linkedTasks.map((item) => `
                  <div class="projects-linked-item">
                    <div>
                      <strong>${escapeProjectHtml(item.task.text)}</strong>
                      <p>${item.dateStr} · ${item.period}${item.task.completed ? ' · concluída' : ''}</p>
                    </div>
                    <button type="button" class="btn-secondary projects-btn-inline" data-project-card-action="unlink-task" data-project-task-date="${item.dateStr}" data-project-task-period="${item.period}" data-project-task-index="${item.index}">Desvincular</button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="projects-expand-actions">
            <button type="button" class="btn-primary projects-btn-inline" data-project-card-action="add-task" data-project-id="${project.id}">+ Tarefa</button>
            <button type="button" class="btn-secondary projects-btn-inline" data-project-card-action="save-template" data-project-id="${project.id}" data-project-template-id="${templateTextareaId}">Salvar checklist</button>
            ${project.status !== 'archived' ? `<button type="button" class="btn-secondary projects-btn-inline" data-project-card-action="archive" data-project-id="${project.id}">Arquivar</button>` : ''}
            <button type="button" class="btn-secondary projects-btn-inline" style="color:var(--ds-danger);border-color:rgba(239,68,68,0.22)" data-project-card-action="delete" data-project-id="${project.id}">Remover</button>
          </div>
        </div>
      </div>
    `;
  };

  // ---- Kanban board builder ----
  const boardHTML = boardSections.length > 0
    ? boardSections.map((section) => {
        const laneTheme = laneThemes[section.key] || laneThemes.execution;
        return `
          <div class="projects-lane ${laneTheme.themeClass}">
            <div class="projects-lane-head">
              <div>
                <div class="projects-lane-title-row">
                  <span class="projects-lane-accent-bar"></span>
                  <span class="projects-lane-title">${section.title}</span>
                </div>
                <div class="projects-lane-subtitle">${section.subtitle}</div>
              </div>
              <span class="projects-lane-count">${section.items.length}</span>
            </div>
            <div class="projects-lane-list">
              ${section.items.length > 0
                ? section.items.map((project) => renderProjectCard(project, section.key)).join('')
                : '<div class="projects-lane-empty">Nenhum projeto nesta etapa.</div>'}
            </div>
          </div>
        `;
      }).join('')
    : `<div class="projects-lane-empty" style="width:280px;padding:32px 20px;text-align:center">
        <strong style="color:var(--ds-text-primary)">Nenhum projeto nessa visão.</strong>
        <p style="font-size:12px;color:var(--ds-text-muted);margin-top:6px">Crie um projeto ou mude o filtro.</p>
      </div>`;

  // ---- New project form ----
  const newProjectForm = `
    <div class="finance-quick-card">
      <div class="finance-card-head">
        <div><h3>Novo projeto</h3><p>Essencial agora, detalhes depois.</p></div>
      </div>
      <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px">
        <input id="projectQuickName" class="finance-input" type="text" placeholder="Nome do projeto">
        <input id="projectQuickClient" class="finance-input" type="text" placeholder="Cliente (opcional)">
        <input id="projectQuickServiceType" class="finance-input" type="text" placeholder="Tipo: LP, Site, etc.">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <input id="projectQuickDeadline" class="finance-input" type="date" title="Prazo">
          <input id="projectQuickExpectedValue" class="finance-input" type="number" min="0" step="0.01" placeholder="Valor R$">
        </div>
        ${draftTemplates.length > 0 ? `
          <select id="projectTemplateSource" class="finance-input">
            <option value="">Sem template</option>
            ${draftTemplates.map((p) => `<option value="${p.id}">${escapeProjectHtml(p.name)}${p.templateTasks?.length ? ` · ${p.templateTasks.length} tarefas` : ''}</option>`).join('')}
          </select>
        ` : ''}
        <div style="display:flex;gap:8px">
          <button type="button" class="btn-primary btn-inline" data-projects-action="create-linked" style="flex:1">Criar projeto</button>
          <button type="button" class="btn-secondary btn-inline" data-projects-action="create-quick">Rápido</button>
        </div>
      </div>
    </div>
  `;

  // ---- Sidebar stats ----
  const sidebarStats = `
    <div class="finance-quick-card">
      <div class="finance-card-head">
        <div><h3>Leitura rápida</h3><p>Sinais da operação agora.</p></div>
      </div>
      <div class="finance-data-row">
        <span class="finance-data-row-label">Ativos</span>
        <span class="finance-data-row-value">${activeCount}</span>
      </div>
      <div class="finance-data-row">
        <span class="finance-data-row-label">Atrasados</span>
        <span class="finance-data-row-value finance-data-row-value--${lateCount > 0 ? 'red' : ''}">${lateCount}</span>
      </div>
      <div class="finance-data-row">
        <span class="finance-data-row-label">Não pagos</span>
        <span class="finance-data-row-value finance-data-row-value--${unpaidCount > 0 ? 'red' : ''}">${unpaidCount}</span>
      </div>
      <div class="finance-data-row">
        <span class="finance-data-row-label">Receita prevista</span>
        <span class="finance-data-row-value">${formatBRL(totalRevenue)}</span>
      </div>
      <div class="finance-data-row">
        <span class="finance-data-row-label">Entregue sem pagar</span>
        <span class="finance-data-row-value finance-data-row-value--${deliveredUnpaidCount > 0 ? 'red' : ''}">${deliveredUnpaidCount}</span>
      </div>
      <div class="finance-data-row">
        <span class="finance-data-row-label">Tarefas sem contexto</span>
        <span class="finance-data-row-value">${taskBacklogCount}</span>
      </div>
    </div>
  `;

  view.innerHTML = `
    <div class="flowly-shell flowly-shell--wide projects-shell">

      <!-- PAGE HEADER + FOCUS CARD -->
      <div class="projects-masthead">
        <div class="projects-masthead-copy">
          <div class="flowly-page-kicker">Central de projetos</div>
          <h2 class="flowly-page-title">Projetos</h2>
          <p class="flowly-page-subtitle">${heroInsight}</p>
          <div class="flowly-inline-pills">
            <button type="button" class="btn-primary" data-projects-action="open-quick-modal">Novo projeto</button>
            <span class="flowly-soft-pill">${activeCount} ativos</span>
            <span class="flowly-soft-pill flowly-soft-pill--accent">${taskBacklogCount} sem projeto</span>
          </div>
        </div>

        ${focusProject ? `
          <div class="projects-focus-card flowly-panel">
            <div class="projects-focus-head">
              <div>
                <div class="projects-suggest-title">Projeto em foco</div>
                <strong>${escapeProjectHtml(focusProject.name)}</strong>
              </div>
              <span class="projects-badge ${focusHint ? focusHint.cls : 'projects-badge--active'}">${focusHint ? focusHint.label : 'Operando'}</span>
            </div>
            <p>${focusHint ? focusHint.detail : 'Sem alerta ativo.'}</p>
            <div class="projects-row-badges">
              <span class="projects-badge">${focusProject.deadline ? formatProjectDateShort(focusProject.deadline) : 'Sem prazo'}</span>
              <span class="projects-badge ${focusProject.isPaid ? 'projects-badge--paid' : 'projects-badge--unpaid'}">${focusProject.isPaid ? 'Pago' : 'Aberto'}</span>
              <span class="projects-badge projects-badge--focus">${focusProgress ? `${focusProgress.done}/${focusProgress.total} tarefas` : 'Sem tarefas'}</span>
            </div>
          </div>
        ` : ''}
      </div>

      ${urgentProjects.length > 0 ? `
        <div class="projects-urgent-strip">
          <span class="projects-urgent-label">Radar de prazo</span>
          <div class="projects-urgent-list">
            ${urgentProjects.slice(0, 5).map((p) => `
              <span class="projects-urgent-chip">
                ${escapeProjectHtml(p.name)}
                <em>${formatProjectDateShort(p.deadline)}</em>
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- FILTER TOOLBAR -->
      <div class="projects-toolbar">
        <div class="projects-filters">
          ${filterTabs.map((item) => `
            <button type="button" class="projects-filter-chip ${projectsFilter === item.id ? 'is-active' : ''}" data-projects-filter="${item.id}">
              ${item.label}
              <small>${item.count}</small>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- KANBAN + SIDEBAR -->
      <div style="display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start">

        <!-- KANBAN BOARD -->
        <div>
          <div class="projects-kanban-wrap">
            <div class="projects-board">
              ${boardHTML}
            </div>
          </div>
        </div>

        <!-- SIDEBAR -->
        <div style="display:flex;flex-direction:column;gap:16px">
          ${sidebarStats}
          ${newProjectForm}
          ${analytics.suggestionTasks.length > 0 || analytics.suggestionTransactions.length > 0 ? `
            <div class="finance-quick-card">
              <div class="finance-card-head">
                <div><h3>Sugestões</h3><p>Vínculos que fazem sentido.</p></div>
              </div>
              ${analytics.suggestionTasks.slice(0, 3).map((item) => `
                <div class="finance-data-row">
                  <span class="finance-data-row-label" style="font-size:12px">${escapeProjectHtml(item.text)}</span>
                  <button type="button" class="btn-secondary projects-btn-inline" style="font-size:11px" data-projects-apply-task-date="${item.dateStr}" data-projects-apply-task-period="${item.period}" data-projects-apply-task-index="${item.index}" data-projects-suggestion="${item.suggestion.id}">Aplicar</button>
                </div>
              `).join('')}
              ${analytics.suggestionTransactions.slice(0, 3).map((item) => `
                <div class="finance-data-row">
                  <span class="finance-data-row-label" style="font-size:12px">${escapeProjectHtml(item.transaction.description)}</span>
                  <button type="button" class="btn-secondary projects-btn-inline" style="font-size:11px" data-projects-apply-transaction="${item.transaction.id}" data-projects-suggestion="${item.suggestion.id}">Aplicar</button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

      </div>
    </div>
  `;

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
      if (dateStr && period && Number.isFinite(index) && suggestionId)
        applySuggestedTaskProject(dateStr, period, index, suggestionId);
    };
  });

  view.querySelectorAll('[data-project-field]').forEach((field) => {
    field.onchange = () => {
      const projectId = field.dataset.projectId;
      const projectField = field.dataset.projectField;
      if (!projectId || !projectField) return;
      const value = field.type === 'checkbox' ? field.checked : field.value;
      updateProjectField(projectId, projectField, value);
    };
  });

  view.querySelectorAll('[data-project-card-action]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const action = btn.dataset.projectCardAction;
      if (action === 'add-task') {
        const projectId = btn.dataset.projectId;
        if (projectId) addTaskInsideProject(projectId);
        return;
      }
      if (action === 'archive') {
        const projectId = btn.dataset.projectId;
        if (projectId) archiveProject(projectId);
        return;
      }
      if (action === 'delete') {
        const projectId = btn.dataset.projectId;
        if (projectId) deleteProject(projectId);
        return;
      }
      if (action === 'save-template') {
        const projectId = btn.dataset.projectId;
        const textareaId = btn.dataset.projectTemplateId;
        if (projectId && textareaId) saveProjectTemplateTasks(projectId, textareaId);
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

  // Toggle card expand on click
  view.querySelectorAll('.projects-card').forEach((card) => {
    const body = card.querySelector('.projects-card-body');
    if (body) {
      body.addEventListener('click', (e) => {
        if (e.target.closest('input,button,textarea,select,label')) return;
        card.classList.toggle('is-open');
      });
    }
    const footer = card.querySelector('.projects-card-footer');
    if (footer) {
      footer.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        card.classList.toggle('is-open');
      });
    }
  });
}
