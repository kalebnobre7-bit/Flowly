function createSettingsSectionCard(title, subtitle, icon, content) {
  return `
    <section class="settings-card-shell overflow-hidden">
      <header class="settings-card-head flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <span class="settings-card-icon inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-300">
          <i data-lucide="${icon}" style="width:16px;height:16px;"></i>
        </span>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-gray-100">${title}</h3>
          <p class="text-xs text-gray-400">${subtitle}</p>
        </div>
      </header>
      <div class="settings-card-body p-4">${content}</div>
    </section>
  `;
}

function createSettingsRow(icon, title, desc, control) {
  return `
    <div class="settings-row">
      <div class="settings-row-copy">
        <span class="settings-row-icon">
          <i data-lucide="${icon}" style="width:14px;height:14px;"></i>
        </span>
        <div class="min-w-0">
          <div class="text-sm font-medium text-gray-100">${title}</div>
          <div class="truncate text-xs text-gray-400">${desc}</div>
        </div>
      </div>
      <div class="flex-shrink-0">${control}</div>
    </div>
  `;
}

function createSettingsToggle(id, checked) {
  return `
    <button id="${id}" role="switch" aria-checked="${checked}" class="settings-switch${checked ? ' is-on' : ''}">
      <span class="settings-switch-thumb${checked ? ' is-on' : ''}"></span>
    </button>
  `;
}

function buildSettingsTabNav(settingsTab) {
  const settingsTabs = [
    { id: 'conta', label: 'Conta', icon: 'user-round' },
    { id: 'notificacoes', label: 'Notificações', icon: 'bell-ring' },
    { id: 'app', label: 'App', icon: 'sliders-horizontal' },
    { id: 'personalizacao', label: 'Personalização', icon: 'palette' },
    { id: 'ia', label: 'IA', icon: 'bot' },
    { id: 'operacao', label: 'Operação', icon: 'signal' },
    { id: 'dados', label: 'Dados', icon: 'database' }
  ];

  return settingsTabs
    .map(
      (tab) => `
        <button class="settings-tab-btn${settingsTab === tab.id ? ' is-active' : ''}" data-settings-tab="${tab.id}">
          <i data-lucide="${tab.icon}" style="width:14px;height:14px;"></i>
          <span>${tab.label}</span>
        </button>
      `
    )
    .join('');
}

function buildSettingsMarkup(ctx) {
  const {
    notifEnabled,
    morningTime,
    middayTime,
    eveningTime,
    inactivityEnabled,
    inactivityThresholdMinutes,
    progressEnabled,
    morningTemplate,
    middayTemplate,
    nightTemplate,
    inactivityTemplate,
    progressTemplate,
    notifPerm,
    notifSecureContext,
    weekStart,
    showWeekends,
    hapticsEnabled,
    displayName,
    aiSettings,
    themeSettings,
    settingsTab,
    currentUser,
    enableWeekHoverAnimation
  } = ctx;

  const permBadge =
    notifPerm === 'granted'
      ? '<span class="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Ativo</span>'
      : '<span class="inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">Inativo</span>';

  const notifStatusText =
    notifPerm === 'granted'
      ? 'Permissão concedida.'
      : notifPerm === 'denied'
        ? 'Permissão bloqueada no navegador.'
        : notifPerm === 'default'
          ? 'Permissão ainda não solicitada.'
          : 'Navegador sem suporte a notificações.';

  const secureContextText = notifSecureContext
    ? 'Ambiente seguro detectado (HTTPS/localhost).'
    : 'Para ativar notificações, abra por HTTPS ou localhost.';

  const fontMainOptions = Object.entries(FLOWLY_FONT_PRESETS)
    .map(
      ([key, preset]) =>
        `<option value="${key}" ${themeSettings.fontMain === key ? 'selected' : ''}>${preset.label}</option>`
    )
    .join('');

  const fontDisplayOptions = Object.entries(FLOWLY_FONT_PRESETS)
    .map(
      ([key, preset]) =>
        `<option value="${key}" ${themeSettings.fontDisplay === key ? 'selected' : ''}>${preset.label}</option>`
    )
    .join('');

  const radiusOptions = Object.entries(FLOWLY_RADIUS_PRESETS)
    .map(
      ([key, preset]) =>
        `<option value="${key}" ${themeSettings.radiusScale === key ? 'selected' : ''}>${preset.label}</option>`
    )
    .join('');
  const widthOptions = Object.entries(FLOWLY_PAGE_WIDTH_PRESETS)
    .map(
      ([key, preset]) =>
        `<option value="${key}" ${themeSettings.pageWidth === key ? 'selected' : ''}>${preset.label}</option>`
    )
    .join('');
  const panelOptions = Object.entries(FLOWLY_PANEL_PRESETS)
    .map(
      ([key, preset]) =>
        `<option value="${key}" ${themeSettings.panelStyle === key ? 'selected' : ''}>${preset.label}</option>`
    )
    .join('');

  const profileSection = createSettingsSectionCard(
    'Perfil',
    'Dados básicos e conta conectada',
    'user-round',
    `
      <div class="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
        <div class="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-lg font-bold text-white">
          ${displayName.charAt(0).toUpperCase()}
        </div>
        <div class="min-w-0 flex-1">
          <label class="mb-1 block text-xs uppercase tracking-wide text-gray-400" for="inputDisplayName">Nome de exibição</label>
          <input id="inputDisplayName" type="text" value="${displayName}" placeholder="Seu nome" class="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500/70" />
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
        <span class="truncate">${currentUser ? `Conectado como ${currentUser.email}` : 'Sem conta conectada'}</span>
        ${
          currentUser
            ? '<span class="text-emerald-300">Conta ativa</span>'
            : '<button type="button" data-auth-modal="open" class="flowly-accent-btn">Entrar / Criar conta</button>'
        }
      </div>
    `
  );

  const notificationsSection = createSettingsSectionCard(
    'Notificações',
    'Alertas, horários e mensagens',
    'bell-ring',
    `
      <div class="space-y-3">
        ${createSettingsRow('bell', 'Ativar notificações', 'Liga ou desliga alertas do app', createSettingsToggle('toggleNotif', notifEnabled))}
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Horário manhã</span>
            <input id="inputMorningTime" type="time" value="${morningTime}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Horário meio-dia</span>
            <input id="inputMiddayTime" type="time" value="${middayTime}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Horário noite</span>
            <input id="inputEveningTime" type="time" value="${eveningTime}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
        </div>
        <div class="space-y-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          ${createSettingsRow('timer-reset', 'Lembrete por inatividade', 'Se ficar muito tempo sem concluir tarefa', createSettingsToggle('toggleInactivityNotif', inactivityEnabled))}
          <label class="block text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Limite inatividade (min)</span>
            <input id="inputInactivityMinutes" type="number" min="30" max="480" step="10" value="${inactivityThresholdMinutes}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          ${createSettingsRow('gauge', 'Notificação de progresso', 'Notifica a cada tarefa concluída', createSettingsToggle('toggleProgressNotif', progressEnabled))}
        </div>
        <div class="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <label class="text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Template manhã</span>
            <input id="inputMorningTemplate" type="text" value="${morningTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Template meio-dia</span>
            <input id="inputMiddayTemplate" type="text" value="${middayTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Template noite</span>
            <input id="inputNightTemplate" type="text" value="${nightTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Template inatividade</span>
            <input id="inputInactivityTemplate" type="text" value="${inactivityTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Template progresso</span>
            <input id="inputProgressTemplate" type="text" value="${progressTemplate}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <p class="text-[11px] text-gray-500">Use variáveis: {completed}, {total}, {pending}, {percentage}, {avgDuration}, {totalDuration}, {bestPeriod}.</p>
        </div>
      </div>
    `
  );

  const notificationStatusCard = createSettingsSectionCard(
    'Status',
    'Permissão e teste rápido',
    'shield-check',
    `
      <div class="space-y-3">
        <div class="mb-2 flex items-center justify-between gap-2 text-xs text-gray-300">
          <span>Status da permissão</span>
          ${permBadge}
        </div>
        <p class="text-xs text-gray-400">${notifStatusText}</p>
        <p class="text-xs ${notifSecureContext ? 'text-emerald-300' : 'text-amber-300'}">${secureContextText}</p>
        <button id="btnTestNotification" class="flowly-accent-btn flowly-accent-btn--secondary mt-2">
          <i data-lucide="send" style="width:14px;height:14px;"></i>
          Enviar notificação de teste
        </button>
        <div id="notifTestFeedback" class="min-h-[16px] text-xs text-gray-400"></div>
      </div>
    `
  );

  const appSection = createSettingsSectionCard(
    'Visual e interação',
    'Preferências de exibição e feedback',
    'sliders-horizontal',
    `
      <div class="space-y-3">
        <label class="block rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
          <span class="mb-1 block uppercase tracking-wide text-gray-400">Inicio da semana</span>
          <select id="selectWeekStart" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">
            <option value="sun" ${weekStart === 'sun' ? 'selected' : ''}>Domingo</option>
            <option value="mon" ${weekStart === 'mon' ? 'selected' : ''}>Segunda</option>
          </select>
        </label>
        ${createSettingsRow('calendar-range', 'Mostrar fins de semana', 'Exibe sábado e domingo na semana', createSettingsToggle('toggleWeekends', showWeekends))}
        ${createSettingsRow('vibrate', 'Feedback háptico', 'Vibração em interações suportadas', createSettingsToggle('toggleHaptics', hapticsEnabled))}
        ${createSettingsRow('sparkles', 'Animação no hover semanal', 'Destaque visual ao passar o mouse na semana', createSettingsToggle('toggleWeekHover', enableWeekHoverAnimation))}
      </div>
    `
  );

  const personalizationSection = createSettingsSectionCard(
    'Personalização',
    'Cores, fontes, largura e painéis',
    'palette',
    `
      <div class="settings-theme-grid">
        <label class="settings-theme-field">
          <span>Cor primária</span>
          <div class="settings-theme-input-wrap">
            <input id="inputThemePrimaryColor" type="color" value="${themeSettings.primaryColor}" />
            <code>${themeSettings.primaryColor}</code>
          </div>
        </label>
        <label class="settings-theme-field">
          <span>Cor secundária</span>
          <div class="settings-theme-input-wrap">
            <input id="inputThemeSecondaryColor" type="color" value="${themeSettings.secondaryColor}" />
            <code>${themeSettings.secondaryColor}</code>
          </div>
        </label>
        <label class="settings-theme-field">
          <span>Fonte base</span>
          <select id="selectThemeFontMain" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">${fontMainOptions}</select>
        </label>
        <label class="settings-theme-field">
          <span>Fonte de destaque</span>
          <select id="selectThemeFontDisplay" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">${fontDisplayOptions}</select>
        </label>
        <label class="settings-theme-field settings-theme-field--wide">
          <span>Arredondamento</span>
          <select id="selectThemeRadiusScale" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">${radiusOptions}</select>
        </label>
        <label class="settings-theme-field">
          <span>Largura da app</span>
          <select id="selectThemePageWidth" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">${widthOptions}</select>
        </label>
        <label class="settings-theme-field">
          <span>Estilo dos painéis</span>
          <select id="selectThemePanelStyle" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">${panelOptions}</select>
        </label>
      </div>
      <div class="settings-theme-preview">
        <div class="settings-theme-preview-card">
          <div class="settings-theme-preview-kicker">Preview ativo</div>
          <strong>Flowly do seu jeito</strong>
          <p>Esse preview agora herda largura, contraste, destaque e hierarquia da interface real.</p>
          <div class="settings-theme-preview-actions">
            <span class="settings-theme-preview-primary">Primária</span>
            <span class="settings-theme-preview-secondary">Secundária</span>
          </div>
        </div>
        <button id="btnResetThemeSettings" class="settings-theme-reset">Restaurar visual padrão</button>
      </div>
    `
  );

  const aiSection = createSettingsSectionCard(
    'Conexão de IA',
    'Deixa a Sexta pronta para conversar com provedores externos',
    'bot',
    `
      <div class="space-y-3">
        ${createSettingsRow('bot', 'Ativar conector externo', 'Mantém a configuração de IA pronta para backend seguro', createSettingsToggle('toggleAiEnabled', aiSettings.enabled === true))}
        <div class="settings-ai-grid">
          <label class="settings-theme-field">
            <span>Provedor</span>
            <select id="selectAiProvider" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">
              <option value="local" ${aiSettings.provider === 'local' ? 'selected' : ''}>Local Flowly</option>
              <option value="minimax" ${aiSettings.provider === 'minimax' ? 'selected' : ''}>MiniMax</option>
              <option value="openai" ${aiSettings.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
              <option value="custom" ${aiSettings.provider === 'custom' ? 'selected' : ''}>Custom</option>
            </select>
          </label>
          <label class="settings-theme-field">
            <span>Modelo</span>
            <input id="inputAiModel" type="text" value="${escapeProjectHtml(aiSettings.model)}" placeholder="Ex.: minimax-text-01" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="settings-theme-field settings-theme-field--wide">
            <span>Endpoint / Edge Function</span>
            <input id="inputAiEndpoint" type="text" value="${escapeProjectHtml(aiSettings.endpoint)}" placeholder="https://.../functions/v1/ask-flowly" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="settings-theme-field settings-theme-field--wide">
            <span>API key</span>
            <input id="inputAiApiKey" type="password" value="${escapeProjectHtml(aiSettings.apiKey)}" placeholder="Cole a chave aqui se quiser testar localmente" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
        </div>
        <label class="settings-theme-field settings-theme-field--wide">
          <span>Prompt base da Sexta</span>
          <textarea id="inputAiSystemPrompt" rows="4" class="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none">${escapeProjectHtml(aiSettings.systemPrompt)}</textarea>
        </label>
        <p class="text-[11px] text-gray-500">Hoje a Sexta já responde localmente com base nos dados do Flowly. Essa aba deixa o conector pronto para você plugar MiniMax, OpenAI ou outro backend depois.</p>
      </div>
    `
  );

  const aiStatusCard = createSettingsSectionCard(
    'Status da Sexta',
    'Leitura do que já está ativo',
    'sparkles',
    `
      <div class="space-y-3">
        <div class="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <div class="text-xs uppercase tracking-wide text-gray-400">Modo atual</div>
          <div class="mt-1 text-sm font-semibold text-white">${aiSettings.enabled && aiSettings.provider !== 'local' ? escapeProjectHtml(`${aiSettings.provider} · ${aiSettings.model}`) : 'Local Flowly'}</div>
          <p class="mt-2 text-xs text-gray-400">${aiSettings.enabled && aiSettings.provider !== 'local' ? 'Conector salvo. O passo seguinte é ligar esse endpoint a uma Edge Function segura.' : 'Aba Sexta operando no modo local com leitura de tarefas, projetos e contexto.'}</p>
        </div>
        <div class="settings-guide-list">
          <div><strong>1. Salvar provedor</strong><span>MiniMax, OpenAI ou endpoint custom</span></div>
          <div><strong>2. Ligar backend</strong><span>Ideal via Supabase Edge Function</span></div>
          <div><strong>3. Conversar na Sexta</strong><span>usar o chat já dentro do Flowly</span></div>
        </div>
      </div>
    `
  );

  const syncLogItems =
    typeof getRecentSyncEvents === 'function' ? getRecentSyncEvents().slice(0, 8) : [];
  const syncLogSection = createSettingsSectionCard(
    'Histórico de sync',
    'Últimos eventos de sincronização entre dispositivo e nuvem',
    'activity',
    `
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs uppercase tracking-wide text-gray-400">Eventos recentes</span>
          <button id="btnClearSyncLog" class="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-gray-200 hover:bg-white/10">Limpar log</button>
        </div>
        <div class="space-y-2">
          ${
            syncLogItems.length > 0
              ? syncLogItems
                  .map(
                    (item) => `
                <div class="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                  <div class="flex items-center justify-between gap-3">
                    <strong class="text-xs uppercase tracking-wide text-gray-200">${item.type || 'sync'}</strong>
                    <span class="text-[11px] text-gray-500">${new Date(item.at).toLocaleString('pt-BR')}</span>
                  </div>
                  <div class="mt-1 text-sm text-gray-200">${item.message || ''}</div>
                  ${
                    item.meta && (item.meta.error || item.meta.to || item.meta.delay != null)
                      ? `<div class="mt-1 text-[11px] text-gray-500">${item.meta.error || item.meta.to || `delay ${item.meta.delay}ms`}</div>`
                      : ''
                  }
                </div>
              `
                  )
                  .join('')
              : '<div class="rounded-xl border border-white/8 bg-black/20 px-3 py-4 text-sm text-gray-400">Ainda sem eventos de sync registrados.</div>'
          }
        </div>
      </div>
    `
  );

  const prioritiesSection = createSettingsSectionCard(
    'Prioridades',
    'Edite as prioridades personalizadas da sua operação',
    'signal',
    `
      <div class="space-y-3">
        <div>
          <div class="mb-2 flex items-center justify-between gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Prioridades</span>
            <button id="btnAddPrio" class="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-gray-200 hover:bg-white/10">Adicionar</button>
          </div>
          <div id="priosList" class="space-y-2"></div>
        </div>
      </div>
    `
  );

  const dataSection = createSettingsSectionCard(
    'Dados e manutenção',
    'Backup, reparo e limpeza',
    'database',
    `
      <div class="grid grid-cols-2 gap-2">
        <button id="btnExportSettings" class="group flex flex-col items-center justify-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-emerald-200 hover:bg-emerald-500/20">
          <i data-lucide="download" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i>
          <span class="text-xs font-semibold">Exportar Backup</span>
        </button>
        <label class="group flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-3 text-blue-200 hover:bg-blue-500/20">
          <i data-lucide="upload" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i>
          <span class="text-xs font-semibold">Importar Backup</span>
          <input id="fileImportSettings" type="file" accept="application/json" class="hidden" />
        </label>
        <button id="btnFixDuplicates" class="group flex flex-col items-center justify-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-amber-200 hover:bg-amber-500/20">
          <i data-lucide="wrench" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i>
          <span class="text-xs font-semibold">Corrigir Banco</span>
        </button>
        <button id="btnClearAllSettings" class="group flex flex-col items-center justify-center gap-1 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-3 text-rose-200 hover:bg-rose-500/20">
          <i data-lucide="trash-2" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i>
          <span class="text-xs font-semibold">Limpar Tudo</span>
        </button>
      </div>
      <p class="mt-3 text-[11px] text-gray-500">A limpeza remove dados locais e remotos da sua conta. Use com cuidado.</p>
    `
  );

  const quickGuideCard = createSettingsSectionCard(
    'Leitura rápida',
    'Tudo agora está separado por contexto',
    'folders',
    `
      <div class="settings-guide-list">
        <div><strong>Conta</strong><span>nome, login e identidade</span></div>
        <div><strong>Notificações</strong><span>horários, templates e permissão</span></div>
        <div><strong>App</strong><span>semana, hover e feedback</span></div>
        <div><strong>Personalização</strong><span>cores, fontes, largura e painéis</span></div>
        <div><strong>IA</strong><span>provedor, modelo e endpoint da Sexta</span></div>
        <div><strong>Operação</strong><span>prioridades e sinais</span></div>
        <div><strong>Dados</strong><span>backup, reparo e limpeza</span></div>
      </div>
    `
  );

  const tabPanels = {
    conta: { main: [profileSection], side: [quickGuideCard] },
    notificacoes: { main: [notificationsSection], side: [notificationStatusCard] },
    app: { main: [appSection], side: [quickGuideCard] },
    personalizacao: { main: [personalizationSection], side: [quickGuideCard] },
    ia: { main: [aiSection], side: [aiStatusCard] },
    operacao: { main: [prioritiesSection], side: [quickGuideCard] },
    dados: { main: [dataSection], side: [syncLogSection, quickGuideCard] }
  };

  const currentTabPanels = tabPanels[settingsTab] || tabPanels.conta;

  return `
    <div class="flowly-shell flowly-shell--narrow settings-shell">
      <div class="settings-topbar flowly-page-header">
        <div>
          <h2 class="flowly-page-title flex items-center gap-3 text-2xl font-bold text-white">
            <span class="settings-topbar-mark">
              <i data-lucide="settings-2" style="width:20px;height:20px;"></i>
            </span>
            Configurações
          </h2>
          <p class="flowly-page-subtitle mt-1 text-sm text-gray-400">Agora separado por abas para você ajustar uma área por vez.</p>
        </div>
        <div class="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-300">
          <div class="font-semibold text-gray-200">FLOWLY v1.2</div>
          <div class="text-gray-400">Sincronizado via Supabase</div>
        </div>
      </div>

      <div class="settings-tabs" role="tablist">
        ${buildSettingsTabNav(settingsTab)}
      </div>

      <div class="settings-panels">
        <div class="space-y-4">${currentTabPanels.main.join('')}</div>
        <div class="space-y-4">${currentTabPanels.side.join('')}</div>
      </div>
    </div>
  `;
}

window.FlowlySettingsView = {
  buildSettingsMarkup
};
