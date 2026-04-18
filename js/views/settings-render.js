function createSettingsSectionCard(title, subtitle, icon, content) {
  return `
    <section class="settings-card-shell">
      <header class="settings-card-head">
        <span class="settings-card-icon">
          <i data-lucide="${icon}" style="width:16px;height:16px;"></i>
        </span>
        <div>
          <h3>${title}</h3>
          <p>${subtitle}</p>
        </div>
      </header>
      <div class="settings-card-body">${content}</div>
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
        <div>
          <div class="settings-row-title">${title}</div>
          <div class="settings-row-desc">${desc}</div>
        </div>
      </div>
      <div>${control}</div>
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

function escapeSettingsHtml(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createThemeChoiceGroup(fieldName, currentValue, options, groupClass = '') {
  return `
    <div class="settings-theme-choice-grid${groupClass ? ` ${groupClass}` : ''}">
      ${options
        .map((option) => {
          const isActive = currentValue === option.value;
          const previewStyle = option.previewStyle
            ? ` style="${escapeSettingsHtml(option.previewStyle)}"`
            : '';
          return `
            <button
              type="button"
              class="settings-theme-choice${isActive ? ' is-active' : ''}"
              data-theme-setting="${escapeSettingsHtml(fieldName)}"
              data-theme-value="${escapeSettingsHtml(option.value)}"
            >
              <span class="settings-theme-choice-head">
                <strong>${escapeSettingsHtml(option.label)}</strong>
                ${option.hint ? `<span>${escapeSettingsHtml(option.hint)}</span>` : ''}
              </span>
              ${
                option.sample
                  ? `<span class="settings-theme-choice-sample"${previewStyle}>${escapeSettingsHtml(option.sample)}</span>`
                  : ''
              }
            </button>
          `;
        })
        .join('')}
    </div>
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
    telegramLinkState,
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

  const fontMainPreset = FLOWLY_FONT_PRESETS[themeSettings.fontMain] || FLOWLY_FONT_PRESETS.system;
  const fontDisplayPreset =
    FLOWLY_FONT_PRESETS[themeSettings.fontDisplay] || FLOWLY_FONT_PRESETS.system;
  const radiusPreset =
    FLOWLY_RADIUS_PRESETS[themeSettings.radiusScale] || FLOWLY_RADIUS_PRESETS.soft;
  const widthPreset =
    FLOWLY_PAGE_WIDTH_PRESETS[themeSettings.pageWidth] || FLOWLY_PAGE_WIDTH_PRESETS.wide;
  const panelPreset =
    FLOWLY_PANEL_PRESETS[themeSettings.panelStyle] || FLOWLY_PANEL_PRESETS.balanced;
  const bodyAccentPreset =
    FLOWLY_BODY_ACCENT_PRESETS[themeSettings.bodyAccent] || FLOWLY_BODY_ACCENT_PRESETS.subtle;
  const shadowPreset =
    FLOWLY_SHADOW_PRESETS[themeSettings.shadowStyle] || FLOWLY_SHADOW_PRESETS.soft;
  const borderPreset =
    FLOWLY_BORDER_PRESETS[themeSettings.borderStyle] || FLOWLY_BORDER_PRESETS.subtle;
  const fontMainChoiceGrid = createThemeChoiceGroup(
    'fontMain',
    themeSettings.fontMain,
    Object.entries(FLOWLY_FONT_PRESETS).map(([key, preset]) => ({
      value: key,
      label: preset.label,
      hint: preset.hint,
      sample: preset.sample || 'Preview',
      previewStyle: `font-family:${preset.main};`
    }))
  );
  const fontDisplayChoiceGrid = createThemeChoiceGroup(
    'fontDisplay',
    themeSettings.fontDisplay,
    Object.entries(FLOWLY_FONT_PRESETS).map(([key, preset]) => ({
      value: key,
      label: preset.label,
      hint: preset.hint,
      sample: preset.sample || 'Preview',
      previewStyle: `font-family:${preset.display};`
    }))
  );
  const radiusChoiceGrid = createThemeChoiceGroup(
    'radiusScale',
    themeSettings.radiusScale,
    Object.entries(FLOWLY_RADIUS_PRESETS).map(([key, preset]) => ({
      value: key,
      label: preset.label,
      hint: preset.hint,
      sample: `Cards em ${preset.lg}`
    })),
    'settings-theme-choice-grid--compact'
  );
  const widthChoiceGrid = createThemeChoiceGroup(
    'pageWidth',
    themeSettings.pageWidth,
    Object.entries(FLOWLY_PAGE_WIDTH_PRESETS).map(([key, preset]) => ({
      value: key,
      label: preset.label,
      hint: preset.hint,
      sample: `Base ${preset.base}`
    })),
    'settings-theme-choice-grid--compact'
  );
  const panelChoiceGrid = createThemeChoiceGroup(
    'panelStyle',
    themeSettings.panelStyle,
    Object.entries(FLOWLY_PANEL_PRESETS).map(([key, preset]) => ({
      value: key,
      label: preset.label,
      hint: preset.hint,
      sample: 'Superfícies e contraste'
    })),
    'settings-theme-choice-grid--compact'
  );
  const bodyAccentChoiceGrid = createThemeChoiceGroup(
    'bodyAccent',
    themeSettings.bodyAccent,
    Object.entries(FLOWLY_BODY_ACCENT_PRESETS).map(([key, preset]) => ({
      value: key,
      label: preset.label,
      hint: preset.hint,
      sample: 'Fundo e ambiente'
    })),
    'settings-theme-choice-grid--compact'
  );
  const shadowChoiceGrid = createThemeChoiceGroup(
    'shadowStyle',
    themeSettings.shadowStyle,
    Object.entries(FLOWLY_SHADOW_PRESETS).map(([key, preset]) => ({
      value: key,
      label: preset.label,
      hint: preset.hint,
      sample: 'Profundidade visual'
    })),
    'settings-theme-choice-grid--compact'
  );
  const borderChoiceGrid = createThemeChoiceGroup(
    'borderStyle',
    themeSettings.borderStyle,
    Object.entries(FLOWLY_BORDER_PRESETS).map(([key, preset]) => ({
      value: key,
      label: preset.label,
      hint: preset.hint,
      sample: 'Contorno dos elementos'
    })),
    'settings-theme-choice-grid--compact'
  );

  const profileSection = createSettingsSectionCard(
    'Perfil',
    'Dados básicos e conta conectada',
    'user-round',
    `
      <div style="display:flex;align-items:center;gap:14px;background:var(--ds-bg-glass);border:1px solid var(--ds-border);border-radius:var(--ds-r-lg);padding:14px">
        <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0A84FF,#5E5CE6);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;flex-shrink:0">
          ${displayName.charAt(0).toUpperCase()}
        </div>
        <div style="flex:1;min-width:0">
          <label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--ds-text-muted);display:block;margin-bottom:5px" for="inputDisplayName">Nome de exibição</label>
          <input id="inputDisplayName" type="text" value="${displayName}" placeholder="Seu nome" class="finance-input" />
        </div>
      </div>
      <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--ds-bg-glass);border:1px solid var(--ds-border);border-radius:var(--ds-r-md);padding:10px 14px;font-size:12px">
        <span style="color:var(--ds-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${currentUser ? `Conectado como ${currentUser.email}` : 'Sem conta conectada'}</span>
        ${
          currentUser
            ? '<span style="color:var(--ds-success);font-weight:600;font-size:11px">Conta ativa</span>'
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
      <div style="display:flex;flex-direction:column;gap:0">
        ${createSettingsRow('bell', 'Ativar notificações', 'Liga ou desliga alertas do app', createSettingsToggle('toggleNotif', notifEnabled))}
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0">
          <label class="projects-config-field">
            <span>Manhã</span>
            <input id="inputMorningTime" type="time" value="${morningTime}" class="finance-input" />
          </label>
          <label class="projects-config-field">
            <span>Meio-dia</span>
            <input id="inputMiddayTime" type="time" value="${middayTime}" class="finance-input" />
          </label>
          <label class="projects-config-field">
            <span>Noite</span>
            <input id="inputEveningTime" type="time" value="${eveningTime}" class="finance-input" />
          </label>
        </div>
        ${createSettingsRow('timer-reset', 'Inatividade', 'Alerta se não concluir tarefa', createSettingsToggle('toggleInactivityNotif', inactivityEnabled))}
        <label class="projects-config-field" style="margin:8px 0">
          <span>Limite inatividade (min)</span>
          <input id="inputInactivityMinutes" type="number" min="30" max="480" step="10" value="${inactivityThresholdMinutes}" class="finance-input" />
        </label>
        ${createSettingsRow('gauge', 'Notificação de progresso', 'Notifica a cada tarefa concluída', createSettingsToggle('toggleProgressNotif', progressEnabled))}
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
          <label class="projects-config-field">
            <span>Template manhã</span>
            <input id="inputMorningTemplate" type="text" value="${morningTemplate}" class="finance-input" />
          </label>
          <label class="projects-config-field">
            <span>Template meio-dia</span>
            <input id="inputMiddayTemplate" type="text" value="${middayTemplate}" class="finance-input" />
          </label>
          <label class="projects-config-field">
            <span>Template noite</span>
            <input id="inputNightTemplate" type="text" value="${nightTemplate}" class="finance-input" />
          </label>
          <label class="projects-config-field">
            <span>Template inatividade</span>
            <input id="inputInactivityTemplate" type="text" value="${inactivityTemplate}" class="finance-input" />
          </label>
          <label class="projects-config-field">
            <span>Template progresso</span>
            <input id="inputProgressTemplate" type="text" value="${progressTemplate}" class="finance-input" />
          </label>
          <p style="font-size:11px;color:var(--ds-text-muted)">Variáveis: {completed}, {total}, {pending}, {percentage}, {avgDuration}, {totalDuration}, {bestPeriod}.</p>
        </div>
      </div>
    `
  );

  const notificationStatusCard = createSettingsSectionCard(
    'Status',
    'Permissão e teste rápido',
    'shield-check',
    `
      <div style="display:flex;flex-direction:column;gap:0">
        <div class="settings-row">
          <span class="settings-row-title">Permissão</span>
          ${permBadge}
        </div>
        <p style="font-size:12px;color:var(--ds-text-muted);padding:6px 0">${notifStatusText}</p>
        <p style="font-size:12px;color:${notifSecureContext ? 'var(--ds-success)' : 'var(--ds-warning)'};padding-bottom:10px">${secureContextText}</p>
        <button id="btnTestNotification" class="flowly-accent-btn flowly-accent-btn--secondary">
          <i data-lucide="send" style="width:14px;height:14px;"></i>
          Enviar notificação de teste
        </button>
        <div id="notifTestFeedback" style="font-size:11px;color:var(--ds-text-muted);margin-top:6px"></div>
      </div>
    `
  );

  const appSection = createSettingsSectionCard(
    'Visual e interação',
    'Preferências de exibição e feedback',
    'sliders-horizontal',
    `
      <div style="display:flex;flex-direction:column;gap:0">
        <label class="projects-config-field" style="padding:12px 0;border-bottom:1px solid var(--ds-border)">
          <span>Início da semana</span>
          <select id="selectWeekStart" class="finance-input">
            <option value="sun" ${weekStart === 'sun' ? 'selected' : ''}>Domingo</option>
            <option value="mon" ${weekStart === 'mon' ? 'selected' : ''}>Segunda</option>
          </select>
        </label>
        ${createSettingsRow('calendar-range', 'Fins de semana', 'Exibe sábado e domingo na semana', createSettingsToggle('toggleWeekends', showWeekends))}
        ${createSettingsRow('vibrate', 'Feedback háptico', 'Vibração em interações suportadas', createSettingsToggle('toggleHaptics', hapticsEnabled))}
        ${createSettingsRow('sparkles', 'Animação hover semanal', 'Destaque visual ao passar o mouse', createSettingsToggle('toggleWeekHover', enableWeekHoverAnimation))}
      </div>
    `
  );

  const personalizationSection = createSettingsSectionCard(
    'Personalização',
    'Tema vivo, com escolhas mais previsíveis',
    'palette',
    `
      <div class="settings-theme-grid">
        <label class="settings-theme-field">
          <span>Cor primária</span>
          <div class="settings-theme-input-wrap">
            <input id="inputThemePrimaryColor" type="color" value="${themeSettings.primaryColor}" />
            <code id="themePrimaryCode">${themeSettings.primaryColor}</code>
          </div>
        </label>
        <label class="settings-theme-field">
          <span>Cor secundária</span>
          <div class="settings-theme-input-wrap">
            <input id="inputThemeSecondaryColor" type="color" value="${themeSettings.secondaryColor}" />
            <code id="themeSecondaryCode">${themeSettings.secondaryColor}</code>
          </div>
        </label>
        <section class="settings-theme-field settings-theme-field--wide">
          <span>Fonte base</span>
          <p class="settings-theme-field-copy">Define o ritmo de leitura do app inteiro.</p>
          ${fontMainChoiceGrid}
        </section>
        <section class="settings-theme-field settings-theme-field--wide">
          <span>Fonte de destaque</span>
          <p class="settings-theme-field-copy">Afeta títulos, números e cabeçalhos principais.</p>
          ${fontDisplayChoiceGrid}
        </section>
        <section class="settings-theme-field settings-theme-field--wide">
          <span>Arredondamento</span>
          <p class="settings-theme-field-copy">Muda o desenho dos cards, inputs e painéis.</p>
          ${radiusChoiceGrid}
        </section>
        <section class="settings-theme-field">
          <span>Largura da app</span>
          <p class="settings-theme-field-copy">Mais denso ou com mais respiro.</p>
          ${widthChoiceGrid}
        </section>
        <section class="settings-theme-field">
          <span>Estilo dos painéis</span>
          <p class="settings-theme-field-copy">Controla contraste, vidro e peso das superfícies.</p>
          ${panelChoiceGrid}
        </section>
        <section class="settings-theme-field">
          <span>Fundo do app</span>
          <p class="settings-theme-field-copy">Intensidade da cor no gradiente do fundo.</p>
          ${bodyAccentChoiceGrid}
        </section>
        <section class="settings-theme-field">
          <span>Sombras</span>
          <p class="settings-theme-field-copy">Nível de elevação e profundidade dos cards.</p>
          ${shadowChoiceGrid}
        </section>
        <section class="settings-theme-field">
          <span>Bordas</span>
          <p class="settings-theme-field-copy">Visibilidade dos contornos em todo o app.</p>
          ${borderChoiceGrid}
        </section>
      </div>
      <div class="settings-theme-preview">
        <div class="settings-theme-preview-card">
          <div class="settings-theme-preview-kicker">Preview ativo</div>
          <strong id="themePreviewTitle">Flowly do seu jeito</strong>
          <p id="themePreviewCopy">Esse preview agora herda largura, contraste, destaque e hierarquia da interface real.</p>
          <div class="settings-theme-preview-actions">
            <span class="settings-theme-preview-primary">Primária</span>
            <span class="settings-theme-preview-secondary">Secundária</span>
          </div>
        </div>
        <button id="btnResetThemeSettings" class="settings-theme-reset">Restaurar visual padrão</button>
      </div>
    `
  );
  const personalizationStatusCard = createSettingsSectionCard(
    'Tema ativo',
    'Leitura rápida do que já está aplicado',
    'sparkles',
    `
      <div class="settings-guide-list settings-guide-list--theme">
        <div><strong>Fonte base</strong><span id="themeSummaryFontMain">${escapeSettingsHtml(fontMainPreset.label)} · ${escapeSettingsHtml(fontMainPreset.hint || '')}</span></div>
        <div><strong>Fonte de destaque</strong><span id="themeSummaryFontDisplay">${escapeSettingsHtml(fontDisplayPreset.label)} · ${escapeSettingsHtml(fontDisplayPreset.hint || '')}</span></div>
        <div><strong>Arredondamento</strong><span id="themeSummaryRadius">${escapeSettingsHtml(radiusPreset.label)} · ${escapeSettingsHtml(radiusPreset.hint || '')}</span></div>
        <div><strong>Largura</strong><span id="themeSummaryWidth">${escapeSettingsHtml(widthPreset.label)} · ${escapeSettingsHtml(widthPreset.hint || '')}</span></div>
        <div><strong>Painéis</strong><span id="themeSummaryPanel">${escapeSettingsHtml(panelPreset.label)} · ${escapeSettingsHtml(panelPreset.hint || '')}</span></div>
        <div><strong>Fundo</strong><span id="themeSummaryBodyAccent">${escapeSettingsHtml(bodyAccentPreset.label)} · ${escapeSettingsHtml(bodyAccentPreset.hint || '')}</span></div>
        <div><strong>Sombras</strong><span id="themeSummaryShadow">${escapeSettingsHtml(shadowPreset.label)} · ${escapeSettingsHtml(shadowPreset.hint || '')}</span></div>
        <div><strong>Bordas</strong><span id="themeSummaryBorder">${escapeSettingsHtml(borderPreset.label)} · ${escapeSettingsHtml(borderPreset.hint || '')}</span></div>
      </div>
      <div class="settings-theme-preview settings-theme-preview--side">
        <div class="settings-theme-preview-card">
          <div class="settings-theme-preview-kicker">Sample</div>
          <strong id="themeSidePreviewTitle" style="font-family:${escapeSettingsHtml(fontDisplayPreset.display)};">Configura do seu jeito</strong>
          <p id="themeSidePreviewCopy" style="font-family:${escapeSettingsHtml(fontMainPreset.main)};">Agora a personalização usa presets mais claros e controles do próprio app, em vez de depender do select nativo.</p>
        </div>
      </div>
    `
  );

  const aiSection = createSettingsSectionCard(
    'Conexão de IA',
    'Liga a Sexta ao backend seguro do Flowly sem expor chave no navegador',
    'bot',
    `
      <div class="space-y-3">
        ${createSettingsRow('bot', 'Ativar conector externo', 'Mantém a configuração de IA pronta para backend seguro', createSettingsToggle('toggleAiEnabled', aiSettings.enabled === true))}
        <div class="flex flex-wrap gap-2">
          <button id="btnApplyManifestPreset" class="flowly-accent-btn">
            <i data-lucide="sparkles" style="width:14px;height:14px;"></i>
            Usar preset Manifest
          </button>
        </div>
        <div class="settings-ai-grid">
          <label class="settings-theme-field">
            <span>Provedor</span>
            <select id="selectAiProvider" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none">
              <option value="local" ${aiSettings.provider === 'local' ? 'selected' : ''}>Local Flowly</option>
              <option value="manifest" ${aiSettings.provider === 'manifest' ? 'selected' : ''}>Manifest</option>
              <option value="custom" ${aiSettings.provider === 'custom' ? 'selected' : ''}>Custom</option>
            </select>
          </label>
          <label class="settings-theme-field">
            <span>Modelo</span>
            <input id="inputAiModel" type="text" value="${escapeProjectHtml(aiSettings.model)}" placeholder="Ex.: manifest/auto" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
          </label>
          <label class="settings-theme-field settings-theme-field--wide">
            <span>Endpoint / Edge Function</span>
            <input id="inputAiEndpoint" type="text" value="${escapeProjectHtml(aiSettings.endpoint)}" placeholder="sexta-ai ou https://.../functions/v1/sexta-ai" class="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none" />
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

  const telegramCodeText = telegramLinkState.code
    ? `Codigo atual: ${telegramLinkState.code}${telegramLinkState.expiresAt ? ` · expira ${new Date(telegramLinkState.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}`
    : 'Gere um codigo temporario e envie no Telegram com /start CODIGO.';
  const telegramStatusText = currentUser
    ? telegramLinkState.linked
      ? `Bot vinculado${telegramLinkState.telegramUsername ? ` com @${escapeSettingsHtml(telegramLinkState.telegramUsername)}` : ''}${telegramLinkState.chatIdMasked ? ` · chat ${escapeSettingsHtml(telegramLinkState.chatIdMasked)}` : ''}`
      : 'Bot ainda nao vinculado ao seu usuario.'
    : 'Faca login no Flowly para vincular o bot ao seu usuario.';
  const telegramWebhookText = telegramLinkState.webhookConfigured
    ? 'Webhook do Telegram registrado.'
    : 'Webhook ainda nao registrado no bot.';
  const telegramStatusCard = createSettingsSectionCard(
    'Telegram',
    'Vinculo do bot com seu usuario do Flowly',
    'message-circle',
    `
      <div class="space-y-3">
        <div class="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <div class="text-xs uppercase tracking-wide text-gray-400">Status atual</div>
          <div class="mt-1 text-sm font-semibold text-white" id="telegramLinkStatusText">${telegramStatusText}</div>
          <p class="mt-2 text-xs text-gray-400" id="telegramWebhookStatusText">${telegramWebhookText}</p>
          <div class="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300" id="telegramLinkCodeBox">${telegramCodeText}</div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button id="btnGenerateTelegramCode" class="flowly-accent-btn flowly-accent-btn--secondary" ${currentUser ? '' : 'disabled'}>
              <i data-lucide="link-2" style="width:14px;height:14px;"></i>
              Gerar codigo
            </button>
            <button id="btnRefreshTelegramStatus" class="flowly-accent-btn flowly-accent-btn--secondary" ${currentUser ? '' : 'disabled'}>
              <i data-lucide="refresh-cw" style="width:14px;height:14px;"></i>
              Atualizar status
            </button>
            <button id="btnRegisterTelegramWebhook" class="flowly-accent-btn flowly-accent-btn--secondary" ${currentUser ? '' : 'disabled'}>
              <i data-lucide="bot" style="width:14px;height:14px;"></i>
              Registrar webhook
            </button>
            <button id="btnDisconnectTelegram" class="flowly-accent-btn flowly-accent-btn--secondary" ${currentUser ? '' : 'disabled'}>
              <i data-lucide="unlink" style="width:14px;height:14px;"></i>
              Desconectar
            </button>
          </div>
        </div>
        <div class="settings-guide-list">
          <div><strong>1. Preset Manifest</strong><span>modelo <code>manifest/auto</code> no <code>sexta-ai</code></span></div>
          <div><strong>2. Registrar webhook</strong><span>liga o bot do Telegram na Edge Function</span></div>
          <div><strong>3. Gerar codigo</strong><span>enviar <code>/start CODIGO</code> no bot para vincular</span></div>
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
      <div class="settings-data-grid">
        <button id="btnExportSettings" class="settings-data-btn settings-data-btn--export">
          <i data-lucide="download" style="width:18px;height:18px;"></i>
          Exportar Backup
        </button>
        <label class="settings-data-btn settings-data-btn--import" style="cursor:pointer">
          <i data-lucide="upload" style="width:18px;height:18px;"></i>
          Importar Backup
          <input id="fileImportSettings" type="file" accept="application/json" style="display:none" />
        </label>
        <button id="btnFixDuplicates" class="settings-data-btn settings-data-btn--repair">
          <i data-lucide="wrench" style="width:18px;height:18px;"></i>
          Corrigir Banco
        </button>
        <button id="btnClearAllSettings" class="settings-data-btn settings-data-btn--danger">
          <i data-lucide="trash-2" style="width:18px;height:18px;"></i>
          Limpar Tudo
        </button>
      </div>
      <p style="margin-top:12px;font-size:11px;color:var(--ds-text-muted)">A limpeza remove dados locais e remotos. Use com cuidado.</p>
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
    personalizacao: { main: [personalizationSection], side: [personalizationStatusCard] },
    ia: { main: [aiSection], side: [aiStatusCard, telegramStatusCard] },
    operacao: { main: [prioritiesSection], side: [quickGuideCard] },
    dados: { main: [dataSection], side: [syncLogSection, quickGuideCard] }
  };

  const currentTabPanels = tabPanels[settingsTab] || tabPanels.conta;

  return `
    <div class="flowly-shell flowly-shell--wide settings-shell">
      <div class="flowly-page-header">
        <div class="flowly-page-header-left">
          <div class="flowly-page-kicker">Centro de ajustes</div>
          <h2 class="flowly-page-title">Configurações</h2>
          <p class="flowly-page-subtitle">Visual, comportamento e integrações no mesmo padrão do app.</p>
        </div>
        <div class="flowly-page-actions">
          <div class="settings-page-badge">
            <div class="settings-page-badge-title">FLOWLY v1.2</div>
            <div class="settings-page-badge-sub">Sincronizado via Supabase</div>
          </div>
        </div>
      </div>

      <div class="settings-toolbar-card">
        <span class="settings-toolbar-label">Área</span>
        <div class="settings-tabs" role="tablist">
          ${buildSettingsTabNav(settingsTab)}
        </div>
      </div>

      <div class="settings-panels">
        <div class="settings-main-stack">${currentTabPanels.main.join('')}</div>
        <aside class="settings-side-stack">${currentTabPanels.side.join('')}</aside>
      </div>
    </div>
  `;
}

window.FlowlySettingsView = {
  buildSettingsMarkup
};
