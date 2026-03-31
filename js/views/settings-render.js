function createSettingsSectionCard(title, subtitle, icon, content) {
  return `
    <section class="rounded-2xl border border-white/10 bg-[#141417] shadow-[0_12px_30px_rgba(0,0,0,0.28)] overflow-hidden">
      <header class="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-gradient-to-r from-white/[0.03] to-white/[0.01]">
        <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-gray-300">
          <i data-lucide="${icon}" style="width:16px;height:16px;"></i>
        </span>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-gray-100">${title}</h3>
          <p class="text-xs text-gray-400">${subtitle}</p>
        </div>
      </header>
      <div class="p-4">${content}</div>
    </section>
  `;
}

function createSettingsRow(icon, title, desc, control) {
  return `
    <div class="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-3">
      <div class="flex min-w-0 items-center gap-3">
        <span class="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-gray-400">
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
    <button id="${id}" role="switch" aria-checked="${checked}" class="relative h-6 w-11 rounded-full border border-white/20 transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-700'}">
      <span class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}"></span>
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
      ? 'Permissao concedida.'
      : notifPerm === 'denied'
        ? 'Permissao bloqueada no navegador.'
        : notifPerm === 'default'
          ? 'Permissao ainda nao solicitada.'
          : 'Navegador sem suporte a notificacoes.';

  const secureContextText = notifSecureContext
    ? 'Ambiente seguro detectado (HTTPS/localhost).'
    : 'Para ativar notificacoes, abra por HTTPS ou localhost.';

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

  const profileSection = createSettingsSectionCard(
    'Perfil',
    'Dados basicos e conta conectada',
    'user-round',
    `
      <div class="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
        <div class="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-lg font-bold text-white">
          ${displayName.charAt(0).toUpperCase()}
        </div>
        <div class="min-w-0 flex-1">
          <label class="mb-1 block text-xs uppercase tracking-wide text-gray-400" for="inputDisplayName">Nome de exibicao</label>
          <input id="inputDisplayName" type="text" value="${displayName}" placeholder="Seu nome" class="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500/70" />
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
        <span class="truncate">${currentUser ? `Conectado como ${currentUser.email}` : 'Sem conta conectada'}</span>
        ${
          currentUser
            ? '<span class="text-emerald-300">Conta ativa</span>'
            : '<button onclick="document.getElementById(\'authModal\').classList.add(\'show\')" class="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-500">Entrar / Criar Conta</button>'
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
        ${createSettingsRow('bell', 'Ativar notificacoes', 'Liga ou desliga alertas do app', createSettingsToggle('toggleNotif', notifEnabled))}
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Horario Manha</span>
            <input id="inputMorningTime" type="time" value="${morningTime}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Horario Meio-dia</span>
            <input id="inputMiddayTime" type="time" value="${middayTime}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Horario Noite</span>
            <input id="inputEveningTime" type="time" value="${eveningTime}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
        </div>
        <div class="space-y-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          ${createSettingsRow('timer-reset', 'Lembrete por inatividade', 'Se ficar muito tempo sem concluir tarefa', createSettingsToggle('toggleInactivityNotif', inactivityEnabled))}
          <label class="block text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Limite inatividade (min)</span>
            <input id="inputInactivityMinutes" type="number" min="30" max="480" step="10" value="${inactivityThresholdMinutes}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          ${createSettingsRow('gauge', 'Notificacao de progresso', 'Notifica a cada tarefa concluida', createSettingsToggle('toggleProgressNotif', progressEnabled))}
        </div>
        <div class="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <label class="text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Template manha</span>
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
          <p class="text-[11px] text-gray-500">Use variaveis: {completed}, {total}, {pending}, {percentage}, {avgDuration}, {totalDuration}, {bestPeriod}.</p>
        </div>
      </div>
    `
  );

  const notificationStatusCard = createSettingsSectionCard(
    'Status',
    'Permissao e teste rapido',
    'shield-check',
    `
      <div class="space-y-3">
        <div class="mb-2 flex items-center justify-between gap-2 text-xs text-gray-300">
          <span>Status da permissão</span>
          ${permBadge}
        </div>
        <p class="text-xs text-gray-400">${notifStatusText}</p>
        <p class="text-xs ${notifSecureContext ? 'text-emerald-300' : 'text-amber-300'}">${secureContextText}</p>
        <button id="btnTestNotification" class="mt-2 inline-flex items-center gap-2 rounded-lg border border-cyan-500/45 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25">
          <i data-lucide="send" style="width:14px;height:14px;"></i>
          Enviar notificacao de teste
        </button>
        <div id="notifTestFeedback" class="min-h-[16px] text-xs text-gray-400"></div>
      </div>
    `
  );

  const appSection = createSettingsSectionCard(
    'Visual e interacao',
    'Preferencias de exibicao e feedback',
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
        ${createSettingsRow('calendar-range', 'Mostrar fins de semana', 'Exibe Sabado e Domingo na semana', createSettingsToggle('toggleWeekends', showWeekends))}
        ${createSettingsRow('vibrate', 'Feedback haptico', 'Vibracao em interacoes suportadas', createSettingsToggle('toggleHaptics', hapticsEnabled))}
        ${createSettingsRow('sparkles', 'Animacao no hover semanal', 'Destaque visual ao passar mouse na semana', createSettingsToggle('toggleWeekHover', enableWeekHoverAnimation))}
      </div>
    `
  );

  const personalizationSection = createSettingsSectionCard(
    'Personalização',
    'Cores, fontes e bordas',
    'palette',
    `
      <div class="settings-theme-grid">
        <label class="settings-theme-field">
          <span>Cor primaria</span>
          <div class="settings-theme-input-wrap">
            <input id="inputThemePrimaryColor" type="color" value="${themeSettings.primaryColor}" />
            <code>${themeSettings.primaryColor}</code>
          </div>
        </label>
        <label class="settings-theme-field">
          <span>Cor secundaria</span>
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
          <span>Fonte destaque</span>
          <select id="selectThemeFontDisplay" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">${fontDisplayOptions}</select>
        </label>
        <label class="settings-theme-field settings-theme-field--wide">
          <span>Arredondamento</span>
          <select id="selectThemeRadiusScale" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">${radiusOptions}</select>
        </label>
      </div>
      <div class="settings-theme-preview">
        <div class="settings-theme-preview-card">
          <div class="settings-theme-preview-kicker">Preview</div>
          <strong>Flowly do seu jeito</strong>
          <p>Teste o visual antes de voltar para o resto da app.</p>
          <div class="settings-theme-preview-actions">
            <span class="settings-theme-preview-primary">Primaria</span>
            <span class="settings-theme-preview-secondary">Secundaria</span>
          </div>
        </div>
        <button id="btnResetThemeSettings" class="settings-theme-reset">Restaurar visual padrao</button>
      </div>
    `
  );

  const aiSection = createSettingsSectionCard(
    'Conexao de IA',
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
        <p class="text-[11px] text-gray-500">Hoje a Sexta ja responde localmente com base nos dados do Flowly. Essa aba deixa o conector pronto para voce plugar MiniMax, OpenAI ou outro backend depois.</p>
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
          <div><strong>3. Conversar na Sexta</strong><span>usar o chat ja dentro do Flowly</span></div>
        </div>
      </div>
    `
  );

  const prioritiesSection = createSettingsSectionCard(
    'Prioridades',
    'Edite as prioridades personalizadas da sua operacao',
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
    'Dados e manutencao',
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
    'Leitura rapida',
    'Tudo agora esta separado por contexto',
    'folders',
    `
      <div class="settings-guide-list">
        <div><strong>Conta</strong><span>nome, login e identidade</span></div>
        <div><strong>Notificações</strong><span>horários, templates e permissão</span></div>
        <div><strong>App</strong><span>semana, hover e feedback</span></div>
        <div><strong>Personalização</strong><span>cores, fontes e arredondamento</span></div>
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
    dados: { main: [dataSection], side: [quickGuideCard] }
  };

  const currentTabPanels = tabPanels[settingsTab] || tabPanels.conta;

  return `
    <div class="flowly-shell flowly-shell--narrow settings-shell">
      <div class="settings-topbar">
        <div>
          <h2 class="flex items-center gap-3 text-2xl font-bold text-white">
            <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-900/25">
              <i data-lucide="settings-2" style="width:20px;height:20px;"></i>
            </span>
            Configurações
          </h2>
          <p class="mt-1 text-sm text-gray-400">Agora separado por abas para você ajustar uma área por vez.</p>
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
