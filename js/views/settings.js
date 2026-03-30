// renderSettingsView movido de js/app.js

function renderSettingsView() {
  const view = document.getElementById('settingsView');
  if (!view) return;

  const notifSettings = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
  const notifEnabled = notifSettings.enabled === true;
  const morningTime = notifSettings.morningTime || '08:30';
  const middayTime = notifSettings.middayTime || '12:30';
  const eveningTime = notifSettings.eveningTime || '23:00';
  const inactivityEnabled = notifSettings.inactivityEnabled !== false;
  const inactivityThresholdMinutes = Number(notifSettings.inactivityThresholdMinutes || 150);
  const progressEnabled = notifSettings.progressEnabled !== false;
  const morningTemplate =
    notifSettings.morningTemplate || 'Bom dia. Hoje voce tem {total} tarefas planejadas.';
  const middayTemplate =
    notifSettings.middayTemplate || 'Como estamos de produtividade? {completed}/{total} ({percentage}%).';
  const nightTemplate =
    notifSettings.nightTemplate ||
    'Resumo do dia: {completed}/{total} ({percentage}%). Tempo total {totalDuration}. Hora de descansar.';
  const inactivityTemplate =
    notifSettings.inactivityTemplate || 'Bem, o que andou fazendo nas ultimas 3h?';
  const progressTemplate =
    notifSettings.progressTemplate || 'Estamos no caminho, {completed}/{total}';
  const notifPerm = 'Notification' in window ? Notification.permission : 'unsupported';
  const notifSecureContext = window.isSecureContext === true;

  const viewSettings = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
  const weekStart = viewSettings.weekStart || 'mon';
  const showWeekends = viewSettings.showWeekends !== false;
  const hapticsEnabled = viewSettings.haptics !== false;

  const displayName =
    localStorage.getItem('flowly_display_name') ||
    (currentUser ? currentUser.email.split('@')[0] : 'Usuario');
  const aiSettings = getFlowlyAISettings();
  const themeSettings = getFlowlyThemeSettings();
  const settingsTab = localStorage.getItem(FLOWLY_SETTINGS_TAB_KEY) || 'conta';

  const permBadge =
    notifPerm === 'granted'
      ? '<span class="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Ativo</span>'
      : '<span class="inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">Inativo</span>';

  const sectionCard = (title, subtitle, icon, content) => `
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

  const settingRow = (icon, title, desc, control) => `
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

  const toggle = (id, checked) => `
    <button id="${id}" role="switch" aria-checked="${checked}" class="relative h-6 w-11 rounded-full border border-white/20 transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-700'}">
      <span class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}"></span>
    </button>
  `;

  const settingsTabs = [
    { id: 'conta', label: 'Conta', icon: 'user-round' },
    { id: 'notificacoes', label: 'Notificacoes', icon: 'bell-ring' },
    { id: 'app', label: 'App', icon: 'sliders-horizontal' },
    { id: 'personalizacao', label: 'Personalizacao', icon: 'palette' },
    { id: 'ia', label: 'IA', icon: 'bot' },
    { id: 'operacao', label: 'Operacao', icon: 'signal' },
    { id: 'dados', label: 'Dados', icon: 'database' }
  ];
  const settingsTabNav = settingsTabs
    .map(
      (tab) => `
        <button class="settings-tab-btn${settingsTab === tab.id ? ' is-active' : ''}" data-settings-tab="${tab.id}">
          <i data-lucide="${tab.icon}" style="width:14px;height:14px;"></i>
          <span>${tab.label}</span>
        </button>
      `
    )
    .join('');
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

  const profileSection = sectionCard(
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

  const notificationsSection = sectionCard(
    'Notificacoes',
    'Alertas, horarios e mensagens',
    'bell-ring',
    `
      <div class="space-y-3">
        ${settingRow('bell', 'Ativar notificacoes', 'Liga ou desliga alertas do app', toggle('toggleNotif', notifEnabled))}
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
          ${settingRow('timer-reset', 'Lembrete por inatividade', 'Se ficar muito tempo sem concluir tarefa', toggle('toggleInactivityNotif', inactivityEnabled))}
          <label class="block text-xs text-gray-300">
            <span class="mb-1 block uppercase tracking-wide text-gray-400">Limite inatividade (min)</span>
            <input id="inputInactivityMinutes" type="number" min="30" max="480" step="10" value="${inactivityThresholdMinutes}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          ${settingRow('gauge', 'Notificacao de progresso', 'Notifica a cada tarefa concluida', toggle('toggleProgressNotif', progressEnabled))}
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

  const notificationStatusCard = sectionCard(
    'Status',
    'Permissao e teste rapido',
    'shield-check',
    `
      <div class="space-y-3">
        <div class="mb-2 flex items-center justify-between gap-2 text-xs text-gray-300">
          <span>Status da permissao</span>
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

  const appSection = sectionCard(
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
        ${settingRow('calendar-range', 'Mostrar fins de semana', 'Exibe Sabado e Domingo na semana', toggle('toggleWeekends', showWeekends))}
        ${settingRow('vibrate', 'Feedback haptico', 'Vibracao em interacoes suportadas', toggle('toggleHaptics', hapticsEnabled))}
        ${settingRow('sparkles', 'Animacao no hover semanal', 'Destaque visual ao passar mouse na semana', toggle('toggleWeekHover', dbUserSettings.enable_week_hover_animation !== false))}
      </div>
    `
  );

  const personalizationSection = sectionCard(
    'Personalizacao',
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

  const aiSection = sectionCard(
    'Conexao de IA',
    'Deixa a Sexta pronta para conversar com provedores externos',
    'bot',
    `
      <div class="space-y-3">
        ${settingRow('bot', 'Ativar conector externo', 'Mantem a configuracao de IA pronta para backend seguro', toggle('toggleAiEnabled', aiSettings.enabled === true))}
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

  const aiStatusCard = sectionCard(
    'Status da Sexta',
    'Leitura do que ja esta ativo',
    'sparkles',
    `
      <div class="space-y-3">
        <div class="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <div class="text-xs uppercase tracking-wide text-gray-400">Modo atual</div>
          <div class="mt-1 text-sm font-semibold text-white">${aiSettings.enabled && aiSettings.provider !== 'local' ? escapeProjectHtml(aiSettings.provider + ' · ' + aiSettings.model) : 'Local Flowly'}</div>
          <p class="mt-2 text-xs text-gray-400">${aiSettings.enabled && aiSettings.provider !== 'local' ? 'Conector salvo. O passo seguinte e ligar esse endpoint a uma Edge Function segura.' : 'Aba Sexta operando no modo local com leitura de tarefas, projetos e contexto.'}</p>
        </div>
        <div class="settings-guide-list">
          <div><strong>1. Salvar provedor</strong><span>MiniMax, OpenAI ou endpoint custom</span></div>
          <div><strong>2. Ligar backend</strong><span>Ideal via Supabase Edge Function</span></div>
          <div><strong>3. Conversar na Sexta</strong><span>usar o chat ja dentro do Flowly</span></div>
        </div>
      </div>
    `
  );

  const prioritiesSection = sectionCard(
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

  const dataSection = sectionCard(
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

  const quickGuideCard = sectionCard(
    'Leitura rapida',
    'Tudo agora esta separado por contexto',
    'folders',
    `
      <div class="settings-guide-list">
        <div><strong>Conta</strong><span>nome, login e identidade</span></div>
        <div><strong>Notificacoes</strong><span>horarios, templates e permissao</span></div>
        <div><strong>App</strong><span>semana, hover e feedback</span></div>
        <div><strong>Personalizacao</strong><span>cores, fontes e arredondamento</span></div>
        <div><strong>IA</strong><span>provedor, modelo e endpoint da Sexta</span></div>
        <div><strong>Operacao</strong><span>prioridades e sinais</span></div>
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

  view.innerHTML = `
    <div class="flowly-shell flowly-shell--narrow settings-shell">
      <div class="settings-topbar">
        <div>
          <h2 class="flex items-center gap-3 text-2xl font-bold text-white">
            <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-900/25">
              <i data-lucide="settings-2" style="width:20px;height:20px;"></i>
            </span>
            Configuracoes
          </h2>
          <p class="mt-1 text-sm text-gray-400">Agora separado por abas para voce ajustar uma area por vez.</p>
        </div>
        <div class="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-300">
          <div class="font-semibold text-gray-200">FLOWLY v1.2</div>
          <div class="text-gray-400">Sincronizado via Supabase</div>
        </div>
      </div>

      <div class="settings-tabs" role="tablist">
        ${settingsTabNav}
      </div>

      <div class="settings-panels">
        <div class="space-y-4">${currentTabPanels.main.join('')}</div>
        <div class="space-y-4">${currentTabPanels.side.join('')}</div>
      </div>
    </div>
  `;

  if (false) view.innerHTML = `
    <div class="flowly-shell flowly-shell--narrow">
      <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="flex items-center gap-3 text-2xl font-bold text-white">
            <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-900/25">
              <i data-lucide="settings-2" style="width:20px;height:20px;"></i>
            </span>
            Configuracoes
          </h2>
          <p class="mt-1 text-sm text-gray-400">Central unica para conta, notificacoes, personalizacao e dados.</p>
        </div>
        <div class="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-300">
          <div class="font-semibold text-gray-200">FLOWLY v1.2</div>
          <div class="text-gray-400">Sincronizado via Supabase</div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div class="space-y-4">
          ${sectionCard(
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
          )}

          ${sectionCard(
            'Notificacoes',
            'Alertas de tarefas e teste rapido',
            'bell-ring',
            `
              <div class="space-y-3">
                ${settingRow('bell', 'Ativar notificacoes', 'Liga ou desliga alertas do app', toggle('toggleNotif', notifEnabled))}
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
                  ${settingRow('timer-reset', 'Lembrete por inatividade', 'Se ficar muito tempo sem concluir tarefa', toggle('toggleInactivityNotif', inactivityEnabled))}
                  <label class="block text-xs text-gray-300">
                    <span class="mb-1 block uppercase tracking-wide text-gray-400">Limite inatividade (min)</span>
                    <input id="inputInactivityMinutes" type="number" min="30" max="480" step="10" value="${inactivityThresholdMinutes}" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
                  </label>
                  ${settingRow('gauge', 'Notificacao de progresso', 'Notifica a cada tarefa concluida', toggle('toggleProgressNotif', progressEnabled))}
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
                  <div class="mb-2 flex items-center justify-between gap-2 text-xs text-gray-300">
                    <span>Status da permissao</span>
                    ${permBadge}
                  </div>
                  <p class="text-xs text-gray-400">${notifStatusText}</p>
                  <p class="mt-1 text-xs ${notifSecureContext ? 'text-emerald-300' : 'text-amber-300'}">${secureContextText}</p>
                  <button id="btnTestNotification" class="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan-500/45 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25">
                    <i data-lucide="send" style="width:14px;height:14px;"></i>
                    Enviar notificacao de teste
                  </button>
                  <div id="notifTestFeedback" class="mt-2 min-h-[16px] text-xs text-gray-400"></div>
                </div>
              </div>
            `
          )}

          ${sectionCard(
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
                ${settingRow('calendar-range', 'Mostrar fins de semana', 'Exibe Sabado e Domingo na semana', toggle('toggleWeekends', showWeekends))}
                ${settingRow('vibrate', 'Feedback haptico', 'Vibracao em interacoes suportadas', toggle('toggleHaptics', hapticsEnabled))}
                ${settingRow('sparkles', 'Animacao no hover semanal', 'Destaque visual ao passar mouse na semana', toggle('toggleWeekHover', dbUserSettings.enable_week_hover_animation !== false))}
              </div>
            `
          )}
        </div>

        <div class="space-y-4">
          ${sectionCard(
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
          )}

          ${sectionCard(
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
          )}
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    lucide.createIcons();

    document.querySelectorAll('[data-settings-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        localStorage.setItem(FLOWLY_SETTINGS_TAB_KEY, btn.dataset.settingsTab || 'conta');
        renderSettingsView();
      });
    });

    const bindThemeField = (id, updater) => {
      const el = document.getElementById(id);
      if (!el) return;
      const commit = () => {
        const current = getFlowlyThemeSettings();
        saveFlowlyThemeSettings(updater(current, el.value));
        renderSettingsView();
      };
      if (el.type === 'color') {
        el.oninput = function () {
          const current = getFlowlyThemeSettings();
          saveFlowlyThemeSettings(updater(current, el.value));
        };
        el.onchange = commit;
        return;
      }
      el.onchange = commit;
    };

    bindThemeField('inputThemePrimaryColor', (current, value) => ({ ...current, primaryColor: value }));
    bindThemeField('inputThemeSecondaryColor', (current, value) => ({
      ...current,
      secondaryColor: value
    }));
    bindThemeField('selectThemeFontMain', (current, value) => ({ ...current, fontMain: value }));
    bindThemeField('selectThemeFontDisplay', (current, value) => ({
      ...current,
      fontDisplay: value
    }));
    bindThemeField('selectThemeRadiusScale', (current, value) => ({
      ...current,
      radiusScale: value
    }));

    const resetThemeBtn = document.getElementById('btnResetThemeSettings');
    if (resetThemeBtn) {
      resetThemeBtn.onclick = () => {
        saveFlowlyThemeSettings(FLOWLY_THEME_DEFAULTS);
        renderSettingsView();
      };
    }

    const bindAiField = (id, fieldName) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.onchange = function () {
        const current = getFlowlyAISettings();
        saveFlowlyAISettings({
          ...current,
          [fieldName]: this.value
        });
        renderSettingsView();
      };
    };

    bindAiField('selectAiProvider', 'provider');
    bindAiField('inputAiModel', 'model');
    bindAiField('inputAiEndpoint', 'endpoint');
    bindAiField('inputAiApiKey', 'apiKey');
    bindAiField('inputAiSystemPrompt', 'systemPrompt');

    const toggleAiEnabled = document.getElementById('toggleAiEnabled');
    if (toggleAiEnabled) {
      toggleAiEnabled.onclick = function () {
        const current = getFlowlyAISettings();
        saveFlowlyAISettings({
          ...current,
          enabled: !(current.enabled === true)
        });
        renderSettingsView();
      };
    }

    // Name Change
    const nameInput = document.getElementById('inputDisplayName');
    if (nameInput) {
      nameInput.onchange = function () {
        localStorage.setItem('flowly_display_name', this.value);
      };
    }

    // Toggle Notificacoes
    const toggleNotif = document.getElementById('toggleNotif');
    if (toggleNotif) {
      toggleNotif.onclick = async function () {
        if (!('Notification' in window)) {
          alert('Este navegador nao suporta notificacoes.');
          return;
        }

        if (!window.isSecureContext) {
          alert(
            'Notificacoes exigem HTTPS ou localhost. Se abriu por arquivo, rode via servidor local.'
          );
          return;
        }

        const cur = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
        const currentEnabled = cur.enabled === true;
        const nextEnabled = !currentEnabled;

        if (nextEnabled) {
          if (Notification.permission === 'denied') {
            alert(
              'Permissao de notificacao bloqueada no navegador. Libere nas configuracoes do site.'
            );
            renderSettingsView();
            return;
          }

          await requestNotificationPermission();
          if (Notification.permission !== 'granted') {
            renderSettingsView();
            return;
          }
        }

        cur.enabled = nextEnabled;
        localStorage.setItem('flowly_notif_settings', JSON.stringify(cur));
        await saveNotifSettingsToSupabase();
        renderSettingsView();
      };
    }

    const btnTestNotification = document.getElementById('btnTestNotification');
    if (btnTestNotification) {
      btnTestNotification.onclick = async function () {
        const feedbackEl = document.getElementById('notifTestFeedback');
        this.disabled = true;
        this.classList.add('opacity-70', 'cursor-not-allowed');

        if (!('Notification' in window)) {
          if (feedbackEl) {
            feedbackEl.className = 'text-xs text-red-400 mt-2 min-h-[16px]';
            feedbackEl.textContent = 'Seu navegador nao suporta notificacoes.';
          }
          this.disabled = false;
          this.classList.remove('opacity-70', 'cursor-not-allowed');
          return;
        }

        if (Notification.permission !== 'granted') {
          await requestNotificationPermission();
        }

        const result = await sendTestNotification();

        if (feedbackEl) {
          if (result && result.ok) {
            feedbackEl.className = 'text-xs text-green-400 mt-2 min-h-[16px]';
            feedbackEl.textContent = 'Notificacao de teste enviada com sucesso.';
          } else if (result && result.reason === 'permission') {
            feedbackEl.className = 'text-xs text-red-400 mt-2 min-h-[16px]';
            feedbackEl.textContent = 'Permissao negada. Libere nas configuracoes do navegador.';
          } else if (result && result.reason === 'unsupported') {
            feedbackEl.className = 'text-xs text-red-400 mt-2 min-h-[16px]';
            feedbackEl.textContent = 'Seu navegador nao suporta notificacoes.';
          } else {
            feedbackEl.className = 'text-xs text-red-400 mt-2 min-h-[16px]';
            feedbackEl.textContent = 'Nao foi possivel enviar a notificacao de teste.';
          }
        }

        this.disabled = false;
        this.classList.remove('opacity-70', 'cursor-not-allowed');
      };
    }

    const saveNotifField = async (id, value) => {
      const cur = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
      const valueById = {
        inputMorningTime: ['morningTime', value],
        inputMiddayTime: ['middayTime', value],
        inputEveningTime: ['eveningTime', value],
        inputInactivityMinutes: [
          'inactivityThresholdMinutes',
          Math.max(30, Math.min(480, Number(value) || 150))
        ],
        inputMorningTemplate: ['morningTemplate', value],
        inputMiddayTemplate: ['middayTemplate', value],
        inputNightTemplate: ['nightTemplate', value],
        inputInactivityTemplate: ['inactivityTemplate', value],
        inputProgressTemplate: ['progressTemplate', value]
      };

      const config = valueById[id];
      if (!config) return;
      cur[config[0]] = config[1];
      localStorage.setItem('flowly_notif_settings', JSON.stringify(cur));
      await saveNotifSettingsToSupabase();
    };

    // Inputs de notificacoes
    [
      'inputMorningTime',
      'inputMiddayTime',
      'inputEveningTime',
      'inputInactivityMinutes',
      'inputMorningTemplate',
      'inputMiddayTemplate',
      'inputNightTemplate',
      'inputInactivityTemplate',
      'inputProgressTemplate'
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.onchange = async function () {
          await saveNotifField(id, this.value);
          if (id === 'inputInactivityMinutes') {
            this.value = String(Math.max(30, Math.min(480, Number(this.value) || 150)));
          }
        };
      }
    });

    const bindNotifToggle = (id, fieldName) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.onclick = async function () {
        const cur = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
        cur[fieldName] = !(cur[fieldName] !== false);
        localStorage.setItem('flowly_notif_settings', JSON.stringify(cur));
        await saveNotifSettingsToSupabase();
        renderSettingsView();
      };
    };

    bindNotifToggle('toggleInactivityNotif', 'inactivityEnabled');
    bindNotifToggle('toggleProgressNotif', 'progressEnabled');

    // Week Hover Toggle
    const toggleWH = document.getElementById('toggleWeekHover');
    if (toggleWH) {
      toggleWH.onclick = async function () {
        dbUserSettings.enable_week_hover_animation = !dbUserSettings.enable_week_hover_animation;
        if (!dbUserSettings.enable_week_hover_animation) {
          document.body.classList.add('no-week-hover');
        } else {
          document.body.classList.remove('no-week-hover');
        }
        renderSettingsView();
        if (currentUser) {
          await supabaseClient.from('user_settings').upsert(
            {
              user_id: currentUser.id,
              enable_week_hover_animation: dbUserSettings.enable_week_hover_animation
            },
            { onConflict: 'user_id' }
          );
        }
      };
    }

    // Inline Editors for Types and Priorities
    renderInlineEditors();

    // Week Start
    const weekSelect = document.getElementById('selectWeekStart');
    if (weekSelect) {
      weekSelect.onchange = function () {
        const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
        cur.weekStart = this.value;
        localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
        if (currentView === 'week') renderView();
      };
    }

    // Weekends Toggle
    const toggleW = document.getElementById('toggleWeekends');
    if (toggleW) {
      toggleW.onclick = function () {
        const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
        cur.showWeekends = !(cur.showWeekends !== false);
        localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
        renderSettingsView();
        if (currentView === 'week') renderView();
      };
    }

    // Haptics Toggle
    const toggleH = document.getElementById('toggleHaptics');
    if (toggleH) {
      toggleH.onclick = function () {
        const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
        cur.haptics = !(cur.haptics !== false);
        localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
        renderSettingsView();
      };
    }

    // Export
    const exportBtn = document.getElementById('btnExportSettings');
    if (exportBtn) {
      exportBtn.onclick = () => {
        const backup = {
          allTasksData,
          allRecurringTasks,
          weeklyRecurringTasks,
          dailyRoutine,
          habitsHistory,
          exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flowly-backup-${localDateStr()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };
    }

    // Import
    const importInput = document.getElementById('fileImportSettings');
    if (importInput) {
      importInput.onchange = function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (data.allTasksData) {
              allTasksData = data.allTasksData;
              localStorage.setItem('allTasksData', JSON.stringify(allTasksData));
            }
            if (data.allRecurringTasks) {
              allRecurringTasks = data.allRecurringTasks;
              localStorage.setItem('allRecurringTasks', JSON.stringify(allRecurringTasks));
            }
            if (data.habitsHistory) {
              habitsHistory = data.habitsHistory;
              localStorage.setItem('habitsHistory', JSON.stringify(habitsHistory));
            }
            renderView();
            alert('Backup importado com sucesso!');
          } catch (error) {
            alert('Erro ao importar backup: ' + error.message);
          }
        };
        reader.readAsText(file);
      };
    }

    // Fix
    const fixBtn = document.getElementById('btnFixDuplicates');
    if (fixBtn) {
      fixBtn.onclick = async () => {
        if (!currentUser) {
          alert('Faca login primeiro!');
          return;
        }
        if (!confirm('Remove duplicatas e tarefas corrompidas do banco. Continuar?')) return;
        const btn = document.getElementById('btnFixDuplicates');
        const originalText =
          '<i data-lucide="wrench" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i><span class="text-xs font-semibold">Corrigir Banco</span>';
        btn.innerHTML = '<span class="text-xs font-semibold text-amber-200">Limpando...</span>';
        btn.disabled = true;
        try {
          const { data: allT } = await supabaseClient
            .from('tasks')
            .select('*')
            .eq('user_id', currentUser.id);
          if (!allT) {
            alert('Erro ao buscar dados.');
            return;
          }
          const recurringTexts = new Set(allRecurringTasks.map((rt) => rt.text));
          const seen = new Map();
          const del = [];
          allT.forEach((t) => {
            const d = t.day || '';
            if (
              !d ||
              !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
              !t.period ||
              !t.text ||
              recurringTexts.has(t.text)
            ) {
              del.push(t.id);
              return;
            }
            const k = `${d}| ${t.period}| ${t.text} `;
            seen.has(k) ? del.push(t.id) : seen.set(k, t.id);
          });
          for (let i = 0; i < del.length; i += 100) {
            await supabaseClient
              .from('tasks')
              .delete()
              .in('id', del.slice(i, i + 100));
          }
          allTasksData = {};
          localStorage.removeItem('allTasksData');
          await loadDataFromSupabase();
          renderView();
          alert(`${del.length} registros removidos.`);
        } catch (e) {
          alert('Erro: ' + e.message);
        } finally {
          btn.innerHTML = originalText;
          btn.disabled = false;
          lucide.createIcons();
        }
      };
    }

    // Clear
    const clearBtn = document.getElementById('btnClearAllSettings');
    if (clearBtn) {
      clearBtn.onclick = async () => {
        if (!confirm('Apagar TODOS os dados? Isso nao pode ser desfeito!')) return;
        const authKeys = Object.keys(localStorage).filter(
          (k) => k.startsWith('sb-') || k === 'flowly_persist_session'
        );
        const authData = {};
        authKeys.forEach((k) => (authData[k] = localStorage.getItem(k)));
        if (currentUser) {
          await supabaseClient.from('tasks').delete().eq('user_id', currentUser.id);
          await supabaseClient.from('habits_history').delete().eq('user_id', currentUser.id);
        }
        Object.keys(weekData).forEach((d) => (weekData[d] = {}));
        allTasksData = {};
        habitsHistory = {};
        localStorage.clear();
        Object.entries(authData).forEach(([k, v]) => localStorage.setItem(k, v));
        saveToLocalStorage();
        location.reload();
      };
    }
  }, 50);
}

async function renderInlineEditors() {
  const priosList = document.getElementById('priosList');
  if (!priosList) return;

  if (customTaskPriorities.length === 0) {
    customTaskPriorities.push(...getTaskPriorities().map((p) => ({ ...p })));
  }
  ensureMoneyPriorityOption();

  const renderItem = (item, type, container, arr, dbTable) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 group';

    const inputName = document.createElement('input');
    inputName.type = 'text';
    inputName.value = item.name || '';
    inputName.className =
      'bg-black/30 border border-white/10 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none flex-1 transition-colors';

    const inputColor = document.createElement('input');
    inputColor.type = 'color';
    inputColor.value = item.color || '#ffffff';
    inputColor.className = 'w-6 h-6 rounded border-0 bg-transparent cursor-pointer flex-shrink-0';

    let pendingUpdate = null;
    const triggerUpdate = () => {
      clearTimeout(pendingUpdate);
      pendingUpdate = setTimeout(async () => {
        const oldId = item.id;
        item.name = inputName.value;
        item.color = inputColor.value;
        if (!item.id || item.id === item.name.toUpperCase().replace(/\s+/g, '_')) {
          item.id = item.name.toUpperCase().replace(/\s+/g, '_');
        }
        if (currentUser) {
          if (oldId && oldId !== item.id) {
            await supabaseClient
              .from(dbTable)
              .delete()
              .eq('id', oldId)
              .eq('user_id', currentUser.id);
          }
          await supabaseClient
            .from(dbTable)
            .upsert({ id: item.id, name: item.name, color: item.color, user_id: currentUser.id });
        }
      }, 800);
    };

    inputName.oninput = triggerUpdate;
    inputColor.oninput = triggerUpdate;

    const btnDelete = document.createElement('button');
    btnDelete.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
    btnDelete.className =
      'text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1';
    btnDelete.onclick = async () => {
      if (!confirm('Excluir este item?')) return;
      const idx = arr.indexOf(item);
      if (idx > -1) arr.splice(idx, 1);
      row.remove();
      if (currentUser && item.id) {
        await supabaseClient.from(dbTable).delete().eq('id', item.id).eq('user_id', currentUser.id);
      }
    };

    row.appendChild(inputColor);
    row.appendChild(inputName);
    row.appendChild(btnDelete);
    container.appendChild(row);
  };

  priosList.innerHTML = '';
  customTaskPriorities.forEach((p) =>
    renderItem(p, 'priority', priosList, customTaskPriorities, 'task_priorities')
  );

  document.getElementById('btnAddPrio').onclick = async () => {
    const newItem = { id: 'NOVA_PRIO_' + Date.now(), name: 'Nova Prio', color: '#FFD60A' };
    customTaskPriorities.push(newItem);
    renderItem(newItem, 'priority', priosList, customTaskPriorities, 'task_priorities');
    if (currentUser)
      await supabaseClient.from('task_priorities').upsert({
        id: newItem.id,
        name: newItem.name,
        color: newItem.color,
        user_id: currentUser.id
      });
    lucide.createIcons();
  };
}

