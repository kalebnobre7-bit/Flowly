// renderSettingsView movido de js/app.js

function renderSettingsView() {
  const view = document.getElementById('settingsView');
  if (!view) return;

  const notifSettings = JSON.parse(localStorage.getItem('flowly_notif_settings') || '{}');
  const viewSettings = JSON.parse(localStorage.getItem('flowly_view_settings') || '{}');

  const settingsContext = {
    notifEnabled: notifSettings.enabled === true,
    morningTime: notifSettings.morningTime || '08:30',
    middayTime: notifSettings.middayTime || '12:30',
    eveningTime: notifSettings.eveningTime || '23:00',
    inactivityEnabled: notifSettings.inactivityEnabled !== false,
    inactivityThresholdMinutes: Number(notifSettings.inactivityThresholdMinutes || 150),
    progressEnabled: notifSettings.progressEnabled !== false,
    morningTemplate:
      notifSettings.morningTemplate || 'Bom dia. Hoje voce tem {total} tarefas planejadas.',
    middayTemplate:
      notifSettings.middayTemplate || 'Como estamos de produtividade? {completed}/{total} ({percentage}%).',
    nightTemplate:
      notifSettings.nightTemplate ||
      'Resumo do dia: {completed}/{total} ({percentage}%). Tempo total {totalDuration}. Hora de descansar.',
    inactivityTemplate:
      notifSettings.inactivityTemplate || 'Bem, o que andou fazendo nas ultimas 3h?',
    progressTemplate:
      notifSettings.progressTemplate || 'Estamos no caminho, {completed}/{total}',
    notifPerm: 'Notification' in window ? Notification.permission : 'unsupported',
    notifSecureContext: window.isSecureContext === true,
    weekStart: viewSettings.weekStart || 'mon',
    showWeekends: viewSettings.showWeekends !== false,
    hapticsEnabled: viewSettings.haptics !== false,
    displayName:
      localStorage.getItem('flowly_display_name') ||
      (currentUser ? currentUser.email.split('@')[0] : 'Usuario'),
    aiSettings: getFlowlyAISettings(),
    themeSettings: getFlowlyThemeSettings(),
    settingsTab: localStorage.getItem(FLOWLY_SETTINGS_TAB_KEY) || 'conta',
    currentUser,
    enableWeekHoverAnimation: dbUserSettings.enable_week_hover_animation !== false
  };

  const settingsRenderer = window.FlowlySettingsView;
  if (!settingsRenderer || typeof settingsRenderer.buildSettingsMarkup !== 'function') {
    return;
  }

  view.innerHTML = settingsRenderer.buildSettingsMarkup(settingsContext);

  setTimeout(() => {
    if (window.lucide) {
      lucide.createIcons();
    }
    if (window.FlowlySettingsBindings) {
      window.FlowlySettingsBindings.bindSettingsInteractions();
    }
  }, 50);
}
