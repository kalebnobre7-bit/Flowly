// renderProjectsView movido de js/app.js

function renderProjectsView() {
  const view = document.getElementById('projectsView');
  if (!view) return;

  const analytics = buildProjectsAnalytics();
  const formatBRL = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      Number(value || 0)
    );
  const taskCandidates = collectProjectTaskCandidates({ includeLinked: false, max: 10 });
  const taskBacklogCount = collectProjectTaskCandidates({ includeLinked: false, max: 999 }).length;
  const draftTemplates = getProjectOptions().filter(
    (project) => project.isDraft || project.status === 'draft'
  );
  const today = localDateStr();
  const allProjects = analytics.projects;
  const urgentProjects = getUrgentProjects(allProjects, 5);
  const filteredProjects = filterProjects(allProjects, projectsFilter, today);
  const boardSections = buildProjectsBoardSections(filteredProjects, projectsFilter, today);
  const starterTasks = taskCandidates.slice(0, 4);
  const starterTransactionSuggestions = analytics.suggestionTransactions.slice(0, 3);
  const activeCount = allProjects.filter(
    (p) => !p.isDraft && !p.completionDate && p.status !== 'archived'
  ).length;
  const lateCount = allProjects.filter(
    (p) => !p.completionDate && p.deadline && p.deadline < today && !p.isDraft
  ).length;
  const draftCount = allProjects.filter((p) => p.isDraft || p.status === 'draft').length;
  const doneCount = allProjects.filter((p) => !!p.completionDate).length;
  const archivedCount = allProjects.filter((p) => p.status === 'archived').length;
  const paidCount = allProjects.filter((p) => p.isPaid).length;
  const unpaidCount = allProjects.filter((p) => !p.isPaid && !p.isDraft).length;
  const totalRevenue = allProjects.reduce(
    (sum, project) => sum + (project.expectedValue || 0),
    0
  );
  const deliveredUnpaidCount = allProjects.filter((p) => p.completionDate && !p.isPaid).length;
  const suggestionCount =
    Number(analytics.suggestionTasks.length || 0) +
    Number(analytics.suggestionTransactions.length || 0);
  const focusProject = sortProjectsForBoard(allProjects, today)[0] || null;
  const focusProgress = focusProject ? getProjectProgressRate(focusProject.id) : null;
  const focusHint = focusProject
    ? getProjectActionHint(focusProject, focusProgress, today)
    : null;
  const heroStats = [
    { label: 'Ativos', value: activeCount },
    { label: 'Sem projeto', value: taskBacklogCount },
    { label: 'Receita prevista', value: formatBRL(totalRevenue) },
    { label: 'Não pagos', value: unpaidCount }
  ];

  const heroInsight = (() => {
    if (lateCount > 0) return `${lateCount} projeto(s) estão em atraso e pedem resposta hoje.`;
    if (deliveredUnpaidCount > 0) {
      return `${deliveredUnpaidCount} entrega(s) concluida(s) ainda nao viraram caixa.`;
    }
    if (urgentProjects.length > 0) {
      return `${urgentProjects.length} projeto(s) vencem nos próximos 5 dias.`;
    }
    if (taskBacklogCount > 0) {
      return `${taskBacklogCount} tarefa(s) ainda estão soltas e podem virar projeto.`;
    }
    return 'Operação sob controle. Agora vale organizar melhor as próximas entregas.';
  })();

  const renderProjectCard = (project, sectionKey, index) => {
    const linkedTasks = collectProjectTaskCandidates({
      includeLinked: true,
      max: 8,
      projectId: project.id
    });
    const templateTextareaId = `projectTemplate_${project.id}`;
    const statusBadge = getProjectStatus(project, today);
    const progress = getProjectProgressRate(project.id);
    const actionHint = getProjectActionHint(project, progress, today);
    const deadlineDiff = getProjectDeadlineDiff(project.deadline, today);
    const shouldOpen = index === 0 && (sectionKey === 'attention' || boardSections.length === 1);
    const progressPct = progress ? progress.pct : 0;
    const progressDone = progress ? progress.done : 0;
    const progressTotal = progress ? progress.total : 0;
    const progressColor =
      progressPct === 100 ? '#30D158' : progressPct >= 55 ? '#4D6BFE' : '#fb923c';
    const deadlineText = (() => {
      if (project.completionDate) {
        return `Fechado em ${formatProjectDateShort(project.completionDate)}`;
      }
      if (deadlineDiff === null) return 'Sem prazo definido';
      if (deadlineDiff < 0) return `${Math.abs(deadlineDiff)}d atrasado`;
      if (deadlineDiff === 0) return 'Entrega hoje';
      if (deadlineDiff === 1) return 'Entrega amanha';
      return `Entrega em ${deadlineDiff} dias`;
    })();
    const notesValue = escapeProjectHtml(project.notes || '');
    const templateValue = escapeProjectHtml((project.templateTasks || []).join('\n'));
    const safeName = escapeProjectHtml(project.name);
    const safeClient = escapeProjectHtml(project.clientName || '');
    const safeType = escapeProjectHtml(project.serviceType || '');
    const summaryMeta = [safeClient || null, safeType || null, deadlineText].filter(Boolean).join(' • ');
    const amountLabel = project.closedValue > 0 ? formatBRL(project.closedValue || 0) : formatBRL(project.expectedValue || 0);
    const amountCaption = project.closedValue > 0 ? 'Fechado' : 'Previsto';
    const summaryMetaLabel = summaryMeta.replaceAll('â€¢', '•');

    return `
      <details class="projects-item projects-item--board ${project.isDraft ? 'projects-item--draft' : ''}" ${
        shouldOpen ? 'open' : ''
      }>
        <summary class="projects-item-summary projects-item-summary--board">
          <div class="projects-item-main projects-item-main--board">
            <div class="projects-row-badges">
              <span class="projects-badge ${statusBadge.cls}">${statusBadge.label}</span>
              ${project.serviceType ? `<span class="projects-badge">${safeType}</span>` : ''}
              <span class="projects-badge ${
                project.isPaid ? 'projects-badge--paid' : 'projects-badge--unpaid'
              }">${project.isPaid ? 'Pago' : 'Aberto'}</span>
            </div>
            <div class="projects-item-kicker">${summaryMetaLabel || 'Sem cliente ou prazo definido'}</div>
            <div class="projects-item-title-row">
              <strong>${safeName}</strong>
              <div class="projects-item-value">
                <span>${amountCaption}</span>
                <strong>${amountLabel}</strong>
              </div>
            </div>
            <div class="projects-item-summary-note">${actionHint.detail}</div>
            <p>${safeClient || 'Sem cliente definido'} • ${deadlineText}</p>
          </div>
          <div class="projects-item-side projects-item-side--board">
            <div class="projects-item-side-top">
              <span class="projects-item-side-label">Progresso</span>
              <strong style="color:${progressColor}">${progressTotal > 0 ? `${progressPct}%` : '0%'}</strong>
            </div>
            <div class="projects-progress-track projects-progress-track--summary">
              <div class="projects-progress-fill" style="width:${progressTotal > 0 ? progressPct : 0}%;background:${progressColor}"></div>
            </div>
            <small class="projects-item-side-note">${progressTotal > 0 ? `${progressDone}/${progressTotal} tarefas concluidas` : 'Nenhuma tarefa ligada ainda'}</small>
            <span class="projects-metric">${formatBRL(project.expectedValue || 0)}</span>
            <small>${actionHint.detail}</small>
          </div>
        </summary>

        <div class="projects-item-body">
          <div class="projects-progress-block projects-progress-block--compact">
            <div class="projects-progress-meta">
              <span>Progresso real</span>
              <strong style="color:${progressColor}">${
                progressTotal > 0
                  ? `${progressPct}% (${progressDone}/${progressTotal})`
                  : 'Sem tarefas ligadas'
              }</strong>
            </div>
            <div class="projects-progress-track">
              <div class="projects-progress-fill" style="width:${
                progressTotal > 0 ? progressPct : 0
              }%;background:${progressColor}"></div>
            </div>
          </div>

          <div class="projects-health-grid projects-health-grid--compact">
            <div class="projects-health-card">
              <span>Tarefas ligadas</span>
              <strong>${linkedTasks.length}</strong>
            </div>
            <div class="projects-health-card">
              <span>Fluxo financeiro</span>
              <strong>${formatBRL(project.income || 0)}</strong>
            </div>
            <div class="projects-health-card">
              <span>Lucro atual</span>
              <strong>${formatBRL(project.profit || 0)}</strong>
            </div>
          </div>

          <details class="projects-inline-group" open>
            <summary>Dados do projeto</summary>
            <div class="projects-config-grid projects-config-grid--tight">
            <label class="projects-config-field">
              <span>Nome</span>
              <input class="finance-input" type="text" value="${safeName}" onchange="updateProjectField('${project.id}','name',this.value)">
            </label>
            <label class="projects-config-field">
              <span>Cliente</span>
              <input class="finance-input" type="text" value="${safeClient}" placeholder="Nome do cliente" onchange="updateProjectField('${project.id}','clientName',this.value)">
            </label>
            <label class="projects-config-field">
              <span>Tipo</span>
              <input class="finance-input" type="text" value="${safeType}" placeholder="LP, Shopify, etc" onchange="updateProjectField('${project.id}','serviceType',this.value)">
            </label>
            <label class="projects-config-field">
              <span>Valor previsto</span>
              <input class="finance-input" type="number" min="0" step="0.01" value="${Number(project.expectedValue || 0)}" onchange="updateProjectField('${project.id}','expectedValue',this.value)">
            </label>
            <label class="projects-config-field">
              <span>Inicio</span>
              <input class="finance-input" type="date" value="${project.startDate || ''}" onchange="updateProjectField('${project.id}','startDate',this.value)">
            </label>
            <label class="projects-config-field">
              <span>Prazo</span>
              <input class="finance-input" type="date" value="${project.deadline || ''}" onchange="updateProjectField('${project.id}','deadline',this.value)">
            </label>
            <label class="projects-config-field">
              <span>Conclusao real</span>
              <input class="finance-input" type="date" value="${project.completionDate || ''}" onchange="updateProjectField('${project.id}','completionDate',this.value)">
            </label>
            <label class="projects-toggle-pill projects-toggle-pill--field">
              <input type="checkbox" ${
                project.isPaid ? 'checked' : ''
              } onchange="updateProjectField('${project.id}','isPaid',this.checked)">
              <span>Pago</span>
            </label>
            <label class="projects-toggle-pill projects-toggle-pill--field">
              <input type="checkbox" ${
                project.isDraft ? 'checked' : ''
              } onchange="updateProjectField('${project.id}','isDraft',this.checked)">
              <span>Template</span>
            </label>
            <label class="projects-toggle-pill projects-toggle-pill--field">
              <input type="checkbox" ${
                project.collapseSubtasks !== false ? 'checked' : ''
              } onchange="updateProjectField('${project.id}','collapseSubtasks',this.checked)">
              <span>Recolher subtarefas</span>
            </label>
            </div>
          </details>

          <details class="projects-inline-group">
            <summary>Notas, tarefas e checklist</summary>
            <label class="projects-config-field projects-config-field--full">
            <span>Notas operacionais</span>
            <textarea class="finance-input projects-note-textarea" onchange="updateProjectField('${project.id}','notes',this.value)" placeholder="Resumo rápido, próximo passo, observacoes de cliente...">${notesValue}</textarea>
            </label>

            <div class="projects-row-actions">
            <button class="btn-secondary projects-btn-inline" onclick="addTaskInsideProject('${project.id}')">Adicionar tarefa</button>
            ${
              project.status !== 'archived'
                ? `<button class="btn-secondary projects-btn-inline" onclick="archiveProject('${project.id}')">Arquivar</button>`
                : ''
            }
            <button class="btn-secondary projects-btn-inline" onclick="deleteProject('${project.id}')">Remover</button>
            </div>

            <div class="projects-item-sections projects-item-sections--stacked">
            <div class="projects-template-block">
              <div class="projects-linked-header">Checklist padrao</div>
              <textarea id="${templateTextareaId}" class="finance-input projects-template-textarea" placeholder="Uma tarefa por linha">${templateValue}</textarea>
              <div class="projects-template-actions">
                <button class="btn-secondary projects-btn-inline" onclick="saveProjectTemplateTasks('${project.id}','${templateTextareaId}')">Salvar checklist</button>
              </div>
            </div>

            <div class="projects-linked-block">
              <div class="projects-linked-header">Tarefas vinculadas</div>
              ${
                linkedTasks.length > 0
                  ? `
                    <div class="projects-linked-list">
                      ${linkedTasks
                        .map(
                          (item) => `
                            <div class="projects-linked-item">
                              <div>
                                <strong>${escapeProjectHtml(item.task.text)}</strong>
                                <p>${item.dateStr} • ${item.period}${
                            item.task.completed ? ' • concluida' : ''
                          }</p>
                              </div>
                              <button class="btn-secondary projects-btn-inline" onclick="unlinkTaskFromProject('${item.dateStr}','${item.period}',${item.index})">Desvincular</button>
                            </div>
                          `
                        )
                        .join('')}
                    </div>
                  `
                  : '<div class="finance-empty">Nenhuma tarefa ligada ainda.</div>'
              }
            </div>
            </div>
          </details>
        </div>
      </details>
    `;
  };

  view.innerHTML = `
    <div class="flowly-shell flowly-shell--wide projects-shell projects-shell--rebuilt">
      <section class="projects-hero">
        <div class="projects-hero-main">
          <div class="finance-kicker">Projects OS</div>
          <h2>Projetos organizados pela operação</h2>
          <p>${heroInsight}</p>
          <div class="projects-hero-actions">
            <button onclick="openQuickProjectModal()" class="btn-primary projects-hero-cta projects-btn-inline">
              Novo projeto
            </button>
            <span class="projects-hero-pill">${filteredProjects.length} na visão</span>
            <span class="projects-hero-pill">${suggestionCount} sinais</span>
            <span class="projects-hero-pill">${taskBacklogCount} tarefa(s) sem projeto</span>
          </div>
        </div>
        <div class="projects-hero-panel projects-hero-panel--compact">
          <div class="projects-hero-stats">
            ${heroStats
              .map(
                (item) => `
                  <div class="projects-hero-stat">
                    <span>${item.label}</span>
                    <strong>${item.value}</strong>
                  </div>
                `
              )
              .join('')}
          </div>
          ${
            focusProject
              ? `
                <div class="projects-hero-focus">
                  <div class="projects-suggest-title">Projeto mais sensivel agora</div>
                  <strong>${escapeProjectHtml(focusProject.name)}</strong>
                  <p>${focusHint ? focusHint.detail : 'Sem alerta ativo.'}</p>
                  <div class="projects-row-badges">
                    <span class="projects-badge ${
                      focusHint ? focusHint.cls : 'projects-badge--active'
                    }">${focusHint ? focusHint.label : 'Operando'}</span>
                    ${
                      focusProject.deadline
                        ? `<span class="projects-badge">${formatProjectDateShort(
                            focusProject.deadline
                          )}</span>`
                        : '<span class="projects-badge">Sem prazo</span>'
                    }
                    <span class="projects-badge ${
                      focusProject.isPaid ? 'projects-badge--paid' : 'projects-badge--unpaid'
                    }">${focusProject.isPaid ? 'Pago' : 'Aberto'}</span>
                  </div>
                </div>
              `
              : `
                <div class="projects-hero-focus">
                  <div class="projects-suggest-title">Sem projetos ainda</div>
                  <strong>Comece com uma operação limpa</strong>
                  <p>Crie um projeto, puxe tarefas para dentro e use esse painel como base de execução.</p>
                </div>
              `
          }
        </div>
      </section>

      ${
        urgentProjects.length > 0
          ? `
            <section class="projects-urgent-strip">
              <span class="projects-urgent-label">Radar de prazo</span>
              <div class="projects-urgent-list">
                ${urgentProjects
                  .slice(0, 6)
                  .map(
                    (project) => `
                      <span class="projects-urgent-chip">
                        ${escapeProjectHtml(project.name)}
                        <em>${formatProjectDateShort(project.deadline)}</em>
                      </span>
                    `
                  )
                  .join('')}
              </div>
            </section>
          `
          : ''
      }

      <section class="projects-filters-bar projects-filters-bar--rebuilt">
        <button class="projects-filter-chip ${
          projectsFilter === 'all' ? 'is-active' : ''
        }" onclick="setProjectsFilter('all')">Todos</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'active' ? 'is-active' : ''
        }" onclick="setProjectsFilter('active')">Ativos (${activeCount})</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'late' ? 'is-active' : ''
        }" onclick="setProjectsFilter('late')">Atrasados (${lateCount})</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'paid' ? 'is-active' : ''
        }" onclick="setProjectsFilter('paid')">Pagos (${paidCount})</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'unpaid' ? 'is-active' : ''
        }" onclick="setProjectsFilter('unpaid')">Não pagos (${unpaidCount})</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'done' ? 'is-active' : ''
        }" onclick="setProjectsFilter('done')">Concluídos (${doneCount})</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'draft' ? 'is-active' : ''
        }" onclick="setProjectsFilter('draft')">Templates (${draftCount})</button>
        <button class="projects-filter-chip ${
          projectsFilter === 'archived' ? 'is-active' : ''
        }" onclick="setProjectsFilter('archived')">Arquivados (${archivedCount})</button>
      </section>

      <section class="projects-layout">
        <div class="projects-main">
          ${
            boardSections.length > 0
              ? boardSections
                  .map(
                    (section) => `
                      <section class="finance-card projects-board-section">
                        <div class="projects-board-header">
                          <div>
                            <div class="projects-suggest-title">${section.title}</div>
                            <h3>${section.title}</h3>
                            <p>${section.subtitle}</p>
                          </div>
                          <span class="projects-board-count">${section.items.length}</span>
                        </div>
                        <div class="projects-board-list">
                          ${section.items
                            .map((project, index) => renderProjectCard(project, section.key, index))
                            .join('')}
                        </div>
                      </section>
                    `
                  )
                  .join('')
              : projectsFilter === 'all'
                ? `
                  <section class="finance-card projects-board-section projects-board-section--starter">
                    <div class="projects-board-header">
                      <div>
                        <div class="projects-suggest-title">Comeco guiado</div>
                        <h3>Transforme esse vazio em operação</h3>
                        <p>O lado esquerdo agora te ajuda a criar contexto, nao fica parado esperando projeto aparecer.</p>
                      </div>
                    </div>
                    <div class="projects-starter-grid">
                      <article class="projects-starter-card">
                        <span class="projects-starter-step">01</span>
                        <strong>Crie o container do trabalho</strong>
                        <p>Defina nome, cliente, prazo e valor. So isso ja organiza melhor o resto do Flowly.</p>
                      </article>
                      <article class="projects-starter-card">
                        <span class="projects-starter-step">02</span>
                        <strong>Puxe as tarefas que ja existem</strong>
                        <p>${taskBacklogCount} tarefa(s) estão sem projeto e podem virar contexto operacional agora.</p>
                      </article>
                      <article class="projects-starter-card">
                        <span class="projects-starter-step">03</span>
                        <strong>Feche o ciclo com receita</strong>
                        <p>${suggestionCount} sugestão(ões) podem ligar entrega, recebimento e cliente na mesma visão.</p>
                      </article>
                    </div>
                  </section>

                  <section class="finance-card projects-board-section">
                    <div class="projects-board-header">
                      <div>
                        <div class="projects-suggest-title">Tarefas mais prontas</div>
                        <h3>O que ja da para transformar em projeto</h3>
                        <p>Essas tarefas estão mais próximas de virarem um card real na operação.</p>
                      </div>
                      <span class="projects-board-count">${taskBacklogCount}</span>
                    </div>
                    ${
                      starterTasks.length > 0
                        ? `
                          <div class="projects-starter-list">
                            ${starterTasks
                              .map(
                                (item) => `
                                  <div class="projects-linked-item projects-linked-item--starter">
                                    <div>
                                      <strong>${escapeProjectHtml(item.task.text)}</strong>
                                      <p>${item.dateStr} • ${item.period}${item.task.completed ? ' • concluida' : ''}</p>
                                    </div>
                                    <span class="projects-badge projects-badge--focus">Pronta</span>
                                  </div>
                                `
                              )
                              .join('')}
                          </div>
                        `
                        : '<div class="projects-empty-state"><strong>Nenhuma tarefa avulsa agora.</strong><p>Quando houver tarefas sem contexto de cliente, elas aparecem aqui.</p></div>'
                    }
                  </section>

                  <section class="finance-card projects-board-section">
                    <div class="projects-board-header">
                      <div>
                        <div class="projects-suggest-title">Sinais financeiros</div>
                        <h3>Receitas que pedem contexto</h3>
                        <p>Use isso para nao deixar entrada de dinheiro solta, sem amarrar ao projeto certo.</p>
                      </div>
                      <span class="projects-board-count">${starterTransactionSuggestions.length}</span>
                    </div>
                    ${
                      starterTransactionSuggestions.length > 0
                        ? `
                          <div class="projects-starter-list">
                            ${starterTransactionSuggestions
                              .map(
                                (item) => `
                                  <div class="projects-linked-item projects-linked-item--starter">
                                    <div>
                                      <strong>${escapeProjectHtml(item.transaction.description)}</strong>
                                      <p>${formatBRL(item.transaction.amount)} • sugestao: ${escapeProjectHtml(item.suggestion.name)}</p>
                                    </div>
                                    <button class="btn-secondary projects-btn-inline" onclick="applySuggestedTransactionProject('${item.transaction.id}','${item.suggestion.id}')">Aplicar</button>
                                  </div>
                                `
                              )
                              .join('')}
                          </div>
                        `
                        : '<div class="projects-empty-state"><strong>Nenhuma receita pendente de vinculo.</strong><p>Quando existir ambiguidade entre receita e projeto, o Flowly destaca aqui.</p></div>'
                    }
                  </section>
                `
              : `
                <section class="finance-card projects-board-section">
                  <div class="projects-empty-state">
                    <strong>Nada nessa visao agora.</strong>
                    <p>Mude o filtro ou crie um novo projeto para comecar essa area com mais estrutura.</p>
                  </div>
                </section>
              `
          }
        </div>

        <aside class="projects-sidebar">
          <section class="finance-card projects-create-card">
            <div class="finance-card-head finance-card-head--dense">
              <div>
                <h3>Novo projeto</h3>
                <p>Comece limpo e abra o resto so quando precisar.</p>
              </div>
            </div>
            <div class="projects-create-form projects-create-form--nested">
              <div class="projects-form-row">
                <input id="projectQuickName" class="finance-input" type="text" placeholder="Nome do projeto">
                <input id="projectQuickClient" class="finance-input" type="text" placeholder="Cliente">
              </div>
              <div class="projects-form-row">
                <input id="projectQuickServiceType" class="finance-input" type="text" placeholder="Tipo de projeto">
                <input id="projectQuickDeadline" class="finance-input" type="date" placeholder="Prazo">
              </div>
              <details class="projects-collapsible projects-collapsible--soft">
                <summary>Mais detalhes</summary>
              <div class="projects-form-row">
                <input id="projectQuickStartDate" class="finance-input" type="date" placeholder="Inicio">
                <input id="projectQuickCompletionDate" class="finance-input" type="date" placeholder="Conclusao">
              </div>
              <div class="projects-form-row">
                <input id="projectQuickExpectedValue" class="finance-input" type="number" min="0" step="0.01" placeholder="Valor previsto">
                <label class="projects-toggle-pill projects-toggle-pill--field">
                  <input id="projectQuickIsPaid" type="checkbox">
                  <span>Pago</span>
                </label>
              </div>
              <div class="projects-form-row">
                <select id="projectTemplateSource" class="finance-input finance-input--full">
                  <option value="">Sem template</option>
                  ${draftTemplates
                    .map(
                      (project) => `
                        <option value="${project.id}">
                          ${escapeProjectHtml(project.name)}${
                        project.templateTasks?.length
                          ? ` • ${project.templateTasks.length} tarefas`
                          : ''
                      }
                        </option>
                      `
                    )
                    .join('')}
                </select>
              </div>
              </details>

              <details class="projects-collapsible projects-collapsible--soft">
                <summary>Tarefas para puxar agora ${
                  taskBacklogCount > 0 ? `<span>${taskBacklogCount}</span>` : ''
                }</summary>
                ${
                  taskCandidates.length > 0
                    ? `
                      <div class="projects-task-list">
                        ${taskCandidates
                          .map(
                            (item) => `
                              <label class="projects-task-option">
                                <input type="checkbox" class="project-create-task-check" data-date="${item.dateStr}" data-period="${item.period}" data-index="${item.index}">
                                <div>
                                  <strong>${escapeProjectHtml(item.task.text)}</strong>
                                  <p>${item.dateStr} • ${item.period}${
                                item.task.completed ? ' • concluida' : ''
                              }</p>
                                </div>
                              </label>
                            `
                          )
                          .join('')}
                      </div>
                    `
                    : '<div class="finance-empty">Nenhuma tarefa solta disponivel agora.</div>'
                }
              </details>

              <div class="projects-create-actions">
                <button class="btn-secondary projects-btn-inline" onclick="createProjectQuick()">Criar rapido</button>
                <button class="btn-primary projects-btn-inline" onclick="createProjectWithLinks()">Criar projeto</button>
              </div>
            </div>
          </section>

          <section class="finance-card projects-command-card">
            <div class="finance-card-head finance-card-head--dense">
              <div>
                <h3>Centro de comando</h3>
                <p>O que esta pedindo acao na operação.</p>
              </div>
            </div>
            <div class="projects-sidebar-list">
              <div class="projects-linked-item">
                <div>
                  <strong>Atrasos ativos</strong>
                  <p>${
                    lateCount > 0
                      ? `${lateCount} projeto(s) fora do prazo.`
                      : 'Nenhum atraso ativo agora.'
                  }</p>
                </div>
                <span class="projects-board-count">${lateCount}</span>
              </div>
              <div class="projects-linked-item">
                <div>
                  <strong>Entregue e nao pago</strong>
                  <p>${
                    deliveredUnpaidCount > 0
                      ? 'Hora de cobrar e fechar o ciclo.'
                      : 'Nenhuma entrega aguardando pagamento.'
                  }</p>
                </div>
                <span class="projects-board-count">${deliveredUnpaidCount}</span>
              </div>
              <div class="projects-linked-item">
                <div>
                  <strong>Tarefas sem projeto</strong>
                  <p>${
                    taskBacklogCount > 0
                      ? 'Vale transformar essas tarefas em contexto de cliente.'
                      : 'Tudo já está contextualizado.'
                  }</p>
                </div>
                <span class="projects-board-count">${taskBacklogCount}</span>
              </div>
              <div class="projects-linked-item">
                <div>
                  <strong>Templates prontos</strong>
                  <p>${
                    draftCount > 0
                      ? 'Base pronta para duplicar processos repetidos.'
                      : 'Ainda nao ha templates prontos.'
                  }</p>
                </div>
                <span class="projects-board-count">${draftCount}</span>
              </div>
            </div>
          </section>

          <section class="finance-card projects-suggestions-card">
            <div class="finance-card-head finance-card-head--dense">
              <div>
                <h3>Sugestoes inteligentes</h3>
                <p>Vinculos que o Flowly acha que fazem sentido.</p>
              </div>
            </div>
            <div class="projects-suggestions">
              <div>
                <div class="projects-suggest-title">Tarefas</div>
                ${
                  analytics.suggestionTasks.length > 0
                    ? analytics.suggestionTasks
                        .slice(0, 4)
                        .map(
                          (item) => `
                            <div class="projects-suggest-item">
                              <div>
                                <strong>${escapeProjectHtml(item.text)}</strong>
                                <p>${escapeProjectHtml(item.suggestion.name)}</p>
                              </div>
                              <button class="btn-secondary projects-btn-inline" onclick="applySuggestedTaskProject('${item.dateStr}','${item.period}',${item.index},'${item.suggestion.id}')">Aplicar</button>
                            </div>
                          `
                        )
                        .join('')
                    : '<div class="finance-empty">Nada para sugerir em tarefas.</div>'
                }
              </div>
              <div>
                <div class="projects-suggest-title">Receitas</div>
                ${
                  analytics.suggestionTransactions.length > 0
                    ? analytics.suggestionTransactions
                        .slice(0, 4)
                        .map(
                          (item) => `
                            <div class="projects-suggest-item">
                              <div>
                                <strong>${escapeProjectHtml(item.transaction.description)}</strong>
                                <p>${formatBRL(item.transaction.amount)} • ${escapeProjectHtml(
                            item.suggestion.name
                          )}</p>
                              </div>
                              <button class="btn-secondary projects-btn-inline" onclick="applySuggestedTransactionProject('${item.transaction.id}','${item.suggestion.id}')">Aplicar</button>
                            </div>
                          `
                        )
                        .join('')
                    : '<div class="finance-empty">Nada para sugerir em receitas.</div>'
                }
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>`;
}

