function bindSettingsInteractions() {
  const notify = (message, level = 'warn') => window.FlowlyDialogs.notify(message, level);
  const themeSettingUpdaters = {
    fontMain: (current, value) => ({ ...current, fontMain: value }),
    fontDisplay: (current, value) => ({ ...current, fontDisplay: value }),
    radiusScale: (current, value) => ({ ...current, radiusScale: value }),
    pageWidth: (current, value) => ({ ...current, pageWidth: value }),
    panelStyle: (current, value) => ({ ...current, panelStyle: value }),
    bodyAccent: (current, value) => ({ ...current, bodyAccent: value }),
    shadowStyle: (current, value) => ({ ...current, shadowStyle: value }),
    borderStyle: (current, value) => ({ ...current, borderStyle: value })
  };

  const refreshThemeUi = (settings = getFlowlyThemeSettings()) => {
    const normalized = getFlowlyThemeSettings ? normalizeFlowlyThemeSettings(settings) : settings;
    const mainPreset = FLOWLY_FONT_PRESETS[normalized.fontMain] || FLOWLY_FONT_PRESETS.system;
    const displayPreset =
      FLOWLY_FONT_PRESETS[normalized.fontDisplay] || FLOWLY_FONT_PRESETS.system;
    const radiusPreset =
      FLOWLY_RADIUS_PRESETS[normalized.radiusScale] || FLOWLY_RADIUS_PRESETS.soft;
    const widthPreset =
      FLOWLY_PAGE_WIDTH_PRESETS[normalized.pageWidth] || FLOWLY_PAGE_WIDTH_PRESETS.wide;
    const panelPreset =
      FLOWLY_PANEL_PRESETS[normalized.panelStyle] || FLOWLY_PANEL_PRESETS.balanced;
    const bodyAccentPreset =
      FLOWLY_BODY_ACCENT_PRESETS[normalized.bodyAccent] || FLOWLY_BODY_ACCENT_PRESETS.subtle;
    const shadowPreset =
      FLOWLY_SHADOW_PRESETS[normalized.shadowStyle] || FLOWLY_SHADOW_PRESETS.soft;
    const borderPreset =
      FLOWLY_BORDER_PRESETS[normalized.borderStyle] || FLOWLY_BORDER_PRESETS.subtle;

    const primaryCode = document.getElementById('themePrimaryCode');
    const secondaryCode = document.getElementById('themeSecondaryCode');
    if (primaryCode) primaryCode.textContent = normalized.primaryColor;
    if (secondaryCode) secondaryCode.textContent = normalized.secondaryColor;

    const summaryMap = {
      themeSummaryFontMain: `${mainPreset.label} · ${mainPreset.hint || ''}`,
      themeSummaryFontDisplay: `${displayPreset.label} · ${displayPreset.hint || ''}`,
      themeSummaryRadius: `${radiusPreset.label} · ${radiusPreset.hint || ''}`,
      themeSummaryWidth: `${widthPreset.label} · ${widthPreset.hint || ''}`,
      themeSummaryPanel: `${panelPreset.label} · ${panelPreset.hint || ''}`,
      themeSummaryBodyAccent: `${bodyAccentPreset.label} · ${bodyAccentPreset.hint || ''}`,
      themeSummaryShadow: `${shadowPreset.label} · ${shadowPreset.hint || ''}`,
      themeSummaryBorder: `${borderPreset.label} · ${borderPreset.hint || ''}`
    };
    Object.entries(summaryMap).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });

    const previewTitle = document.getElementById('themeSidePreviewTitle');
    const previewCopy = document.getElementById('themeSidePreviewCopy');
    if (previewTitle) previewTitle.style.fontFamily = displayPreset.display;
    if (previewCopy) previewCopy.style.fontFamily = mainPreset.main;

    document.querySelectorAll('[data-theme-setting][data-theme-value]').forEach((btn) => {
      const isActive =
        btn.dataset.themeSetting &&
        normalized[btn.dataset.themeSetting] === (btn.dataset.themeValue || '');
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

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
      const next = saveFlowlyThemeSettings(updater(current, el.value));
      refreshThemeUi(next);
    };

    if (el.type === 'color') {
      el.oninput = function () {
        const current = getFlowlyThemeSettings();
        const next = saveFlowlyThemeSettings(updater(current, el.value));
        refreshThemeUi(next);
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
  bindThemeField('selectThemePageWidth', (current, value) => ({
    ...current,
    pageWidth: value
  }));
  bindThemeField('selectThemePanelStyle', (current, value) => ({
    ...current,
    panelStyle: value
  }));

  document.querySelectorAll('[data-theme-setting][data-theme-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fieldName = btn.dataset.themeSetting || '';
      const value = btn.dataset.themeValue || '';
      const updater = themeSettingUpdaters[fieldName];
      if (!updater) return;
      const current = getFlowlyThemeSettings();
      const next = saveFlowlyThemeSettings(updater(current, value));
      refreshThemeUi(next);
    });
  });

  const resetThemeBtn = document.getElementById('btnResetThemeSettings');
  if (resetThemeBtn) {
    resetThemeBtn.onclick = () => {
      const next = saveFlowlyThemeSettings(FLOWLY_THEME_DEFAULTS);
      refreshThemeUi(next);
    };
  }

  refreshThemeUi();

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

  bindAiField('inputAiModel', 'model');
  bindAiField('inputAiEndpoint', 'endpoint');
  bindAiField('inputAiSystemPrompt', 'systemPrompt');

  const aiProviderSelect = document.getElementById('selectAiProvider');
  if (aiProviderSelect) {
    aiProviderSelect.onchange = function () {
      const current = getFlowlyAISettings();
      let nextSettings = {
        ...current,
        provider: this.value
      };
      if (this.value === 'manifest' && typeof getFlowlyManifestAiPreset === 'function') {
        nextSettings = getFlowlyManifestAiPreset(current);
      } else if (this.value === 'local') {
        nextSettings = {
          ...current,
          enabled: false,
          provider: 'local',
          model: 'flowly-local-ops',
          endpoint: ''
        };
      }
      saveFlowlyAISettings(nextSettings);
      renderSettingsView();
    };
  }

  const aiPresetBtn = document.getElementById('btnApplyManifestPreset');
  if (aiPresetBtn) {
    aiPresetBtn.onclick = function () {
      const current = getFlowlyAISettings();
      const next =
        typeof getFlowlyManifestAiPreset === 'function'
          ? getFlowlyManifestAiPreset(current)
          : {
              ...current,
              enabled: true,
              provider: 'manifest',
              model: 'manifest/auto',
              endpoint: 'sexta-ai'
            };
      saveFlowlyAISettings(next);
      renderSettingsView();
    };
  }

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

  const getStoredTelegramState = () =>
    typeof getFlowlyTelegramLinkState === 'function'
      ? getFlowlyTelegramLinkState()
      : {
          linked: false,
          telegramUsername: '',
          chatIdMasked: '',
          code: '',
          expiresAt: '',
          webhookConfigured: false,
          webhookUrl: ''
        };

  const saveTelegramState = (state) =>
    typeof saveFlowlyTelegramLinkState === 'function' ? saveFlowlyTelegramLinkState(state) : state;

  const renderTelegramStatus = (state) => {
    const safeState = state || getStoredTelegramState();
    const statusEl = document.getElementById('telegramLinkStatusText');
    const webhookEl = document.getElementById('telegramWebhookStatusText');
    const codeEl = document.getElementById('telegramLinkCodeBox');
    if (statusEl) {
      statusEl.textContent = safeState.linked
        ? `Bot vinculado${safeState.telegramUsername ? ` com @${safeState.telegramUsername}` : ''}${safeState.chatIdMasked ? ` · chat ${safeState.chatIdMasked}` : ''}`
        : 'Bot ainda nao vinculado ao seu usuario.';
    }
    if (webhookEl) {
      webhookEl.textContent = safeState.webhookConfigured
        ? 'Webhook do Telegram registrado.'
        : 'Webhook ainda nao registrado no bot.';
    }
    if (codeEl) {
      codeEl.textContent = safeState.code
        ? `Codigo atual: ${safeState.code}${safeState.expiresAt ? ` · expira ${new Date(safeState.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}`
        : 'Gere um codigo temporario e envie no Telegram com /start CODIGO.';
    }
  };

  const invokeTelegramLink = async (action) => {
    const sessionResult = await supabaseClient.auth.getSession();
    const accessToken = sessionResult?.data?.session?.access_token || '';
    if (!accessToken) {
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    const result = await supabaseClient.functions.invoke('telegram-link', {
      body: { action },
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (result.error) {
      throw result.error;
    }
    const payload = result.data || {};
    const nextState = saveTelegramState(payload.status || payload);
    renderTelegramStatus(nextState);
    return payload;
  };

  const refreshTelegramStatus = async () => {
    if (!currentUser || !document.getElementById('telegramLinkStatusText')) return;
    try {
      await invokeTelegramLink('status');
    } catch (error) {
      notify(`Nao foi possivel carregar status do Telegram: ${error.message || error}`, 'warn');
    }
  };

  const generateTelegramCodeBtn = document.getElementById('btnGenerateTelegramCode');
  if (generateTelegramCodeBtn) {
    generateTelegramCodeBtn.onclick = async function () {
      if (!currentUser) {
        notify('Faca login para gerar o codigo do Telegram.', 'warn');
        return;
      }
      try {
        const payload = await invokeTelegramLink('generate_code');
        if (payload.code && navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(`/start ${payload.code}`);
          } catch (_) {}
        }
        notify('Codigo do Telegram gerado. O comando /start CODIGO foi copiado quando o navegador permitiu.', 'success');
      } catch (error) {
        notify(`Falha ao gerar codigo do Telegram: ${error.message || error}`, 'error');
      }
    };
  }

  const refreshTelegramStatusBtn = document.getElementById('btnRefreshTelegramStatus');
  if (refreshTelegramStatusBtn) {
    refreshTelegramStatusBtn.onclick = refreshTelegramStatus;
  }

  const registerTelegramWebhookBtn = document.getElementById('btnRegisterTelegramWebhook');
  if (registerTelegramWebhookBtn) {
    registerTelegramWebhookBtn.onclick = async function () {
      if (!currentUser) {
        notify('Faca login para registrar o webhook do Telegram.', 'warn');
        return;
      }
      try {
        await invokeTelegramLink('register_webhook');
        notify('Webhook do Telegram registrado.', 'success');
      } catch (error) {
        notify(`Falha ao registrar webhook do Telegram: ${error.message || error}`, 'error');
      }
    };
  }

  const disconnectTelegramBtn = document.getElementById('btnDisconnectTelegram');
  if (disconnectTelegramBtn) {
    disconnectTelegramBtn.onclick = async function () {
      if (!currentUser) {
        notify('Faca login para desconectar o Telegram.', 'warn');
        return;
      }
      try {
        await invokeTelegramLink('disconnect');
        notify('Telegram desconectado do Flowly.', 'success');
      } catch (error) {
        notify(`Falha ao desconectar Telegram: ${error.message || error}`, 'error');
      }
    };
  }

  renderTelegramStatus(getStoredTelegramState());
  refreshTelegramStatus();

  const nameInput = document.getElementById('inputDisplayName');
  if (nameInput) {
    nameInput.onchange = function () {
      localStorage.setItem('flowly_display_name', this.value);
    };
  }

  const toggleNotif = document.getElementById('toggleNotif');
  if (toggleNotif) {
    toggleNotif.onclick = async function () {
      if (!('Notification' in window)) {
        notify('Este navegador nao suporta notificacoes.', 'warn');
        return;
      }

      if (!window.isSecureContext) {
        notify('Notificacoes exigem HTTPS ou localhost. Se abriu por arquivo, rode via servidor local.', 'warn');
        return;
      }

      const cur = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
      const currentEnabled = cur.enabled === true;
      const nextEnabled = !currentEnabled;

      if (nextEnabled) {
        if (Notification.permission === 'denied') {
          notify('Permissao de notificacao bloqueada no navegador. Libere nas configuracoes do site.', 'warn');
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
      inputInactivityMinutes: ['inactivityThresholdMinutes', Math.max(30, Math.min(480, Number(value) || 150))],
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
    if (!el) return;
    el.onchange = async function () {
      await saveNotifField(id, this.value);
      if (id === 'inputInactivityMinutes') {
        this.value = String(Math.max(30, Math.min(480, Number(this.value) || 150)));
      }
    };
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

  renderSettingsInlineEditors();

  const weekSelect = document.getElementById('selectWeekStart');
  if (weekSelect) {
    weekSelect.onchange = function () {
      const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
      cur.weekStart = this.value;
      localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
      if (currentView === 'week') renderView();
    };
  }

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

  const toggleH = document.getElementById('toggleHaptics');
  if (toggleH) {
    toggleH.onclick = function () {
      const cur = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');
      cur.haptics = !(cur.haptics !== false);
      localStorage.setItem('flowly_view_settings', JSON.stringify(cur));
      renderSettingsView();
    };
  }

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
          notify('Backup importado com sucesso!', 'success');
        } catch (error) {
          notify('Erro ao importar backup: ' + error.message, 'error');
        }
      };
      reader.readAsText(file);
    };
  }

  const fixBtn = document.getElementById('btnFixDuplicates');
  if (fixBtn) {
    fixBtn.onclick = async () => {
      if (!currentUser) {
        notify('Faca login primeiro!', 'warn');
        return;
      }
      const confirmed = await window.FlowlyDialogs.confirm(
        'Remove duplicatas e tarefas corrompidas do banco. Continuar?',
        {
          title: 'Corrigir banco',
          confirmLabel: 'Corrigir'
        }
      );
      if (!confirmed) return;
      const btn = document.getElementById('btnFixDuplicates');
      const originalText =
        '<i data-lucide="wrench" class="transition-transform group-hover:scale-110" style="width:16px;height:16px;"></i><span class="text-xs font-semibold">Corrigir Banco</span>';
      btn.innerHTML = '<span class="text-xs font-semibold text-amber-200">Limpando...</span>';
      btn.disabled = true;
      try {
        const { data: allT } = await supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id);
        if (!allT) {
          notify('Erro ao buscar dados.', 'error');
          return;
        }
        const recurringTexts = new Set(allRecurringTasks.map((rt) => rt.text));
        const seen = new Map();
        const del = [];
        allT.forEach((t) => {
          const d = t.day || '';
          if (!d || !/^\\d{4}-\\d{2}-\\d{2}$/.test(d) || !t.period || !t.text || recurringTexts.has(t.text)) {
            del.push(t.id);
            return;
          }
          const k = `${d}| ${t.period}| ${t.text} `;
          seen.has(k) ? del.push(t.id) : seen.set(k, t.id);
        });
        for (let i = 0; i < del.length; i += 100) {
          await supabaseClient.from('tasks').delete().in('id', del.slice(i, i + 100));
        }
        allTasksData = {};
        localStorage.removeItem('allTasksData');
        await loadDataFromSupabase();
        renderView();
        notify(`${del.length} registros removidos.`, 'success');
      } catch (e) {
        notify('Erro: ' + e.message, 'error');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        lucide.createIcons();
      }
    };
  }

  const clearBtn = document.getElementById('btnClearAllSettings');
  if (clearBtn) {
    clearBtn.onclick = async () => {
      const confirmed = await window.FlowlyDialogs.confirm(
        'Apagar TODOS os dados? Isso nao pode ser desfeito!',
        {
          title: 'Limpar todos os dados',
          confirmLabel: 'Apagar tudo',
          tone: 'danger'
        }
      );
      if (!confirmed) return;
      const authKeys = Object.keys(localStorage).filter((k) => k.startsWith('sb-') || k === 'flowly_persist_session');
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

  const clearSyncLogBtn = document.getElementById('btnClearSyncLog');
  if (clearSyncLogBtn) {
    clearSyncLogBtn.onclick = () => {
      if (typeof clearRecentSyncEvents === 'function') {
        clearRecentSyncEvents();
      }
      renderSettingsView();
    };
  }
}

async function renderSettingsInlineEditors() {
  const priosList = document.getElementById('priosList');
  if (!priosList) return;

  if (customTaskPriorities.length === 0) {
    customTaskPriorities.push(...getTaskPriorities().map((p) => ({ ...p })));
  }
  ensureMoneyPriorityOption();

  const renderItem = (item, container, arr, dbTable) => {
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
        if (!item.id || item.id === item.name.toUpperCase().replace(/\\s+/g, '_')) {
          item.id = item.name.toUpperCase().replace(/\\s+/g, '_');
        }
        if (currentUser) {
          if (oldId && oldId !== item.id) {
            await supabaseClient.from(dbTable).delete().eq('id', oldId).eq('user_id', currentUser.id);
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
      const confirmed = await window.FlowlyDialogs.confirm('Excluir este item?', {
        title: 'Excluir item',
        confirmLabel: 'Excluir',
        tone: 'danger'
      });
      if (!confirmed) return;
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
  customTaskPriorities.forEach((priority) =>
    renderItem(priority, priosList, customTaskPriorities, 'task_priorities')
  );

  document.getElementById('btnAddPrio').onclick = async () => {
    const newItem = { id: `NOVA_PRIO_${Date.now()}`, name: 'Nova Prio', color: '#FFD60A' };
    customTaskPriorities.push(newItem);
    renderItem(newItem, priosList, customTaskPriorities, 'task_priorities');
    if (currentUser) {
      await supabaseClient.from('task_priorities').upsert({
        id: newItem.id,
        name: newItem.name,
        color: newItem.color,
        user_id: currentUser.id
      });
    }
    lucide.createIcons();
  };
}

window.FlowlySettingsBindings = {
  bindSettingsInteractions,
  renderSettingsInlineEditors
};
