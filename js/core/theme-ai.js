const FLOWLY_AI_STORAGE_KEY = 'flowly_ai_settings';
const FLOWLY_THEME_STORAGE_KEY = 'flowly_theme_settings';
const FLOWLY_SETTINGS_TAB_KEY = 'flowly_settings_tab';
const FLOWLY_TELEGRAM_LINK_STORAGE_KEY = 'flowly_telegram_link_state';
const FLOWLY_AI_DEFAULTS = {
  enabled: false,
  provider: 'local',
  model: 'flowly-local-ops',
  endpoint: '',
  apiKey: '',
  systemPrompt:
    'Voce e a Sexta, assistente operacional do Flowly. Responda com objetividade, priorizacao e foco em execucao.'
};
const FLOWLY_THEME_DEFAULTS = {
  primaryColor: '#0A84FF',
  secondaryColor: '#FF9F0A',
  fontMain: 'system',
  fontDisplay: 'system',
  radiusScale: 'soft',
  pageWidth: 'wide',
  panelStyle: 'balanced',
  bodyAccent: 'subtle',
  shadowStyle: 'soft',
  borderStyle: 'subtle'
};
const FLOWLY_FONT_PRESETS = {
  system: {
    label: 'Sistema',
    hint: 'Neutro e nativo',
    main: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    display:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    sample: 'Fluxo claro e direto'
  },
  humanist: {
    label: 'Humanista',
    hint: 'Mais quente e legível',
    main: '"Segoe UI", Candara, "Trebuchet MS", Verdana, sans-serif',
    display: '"Trebuchet MS", "Segoe UI", Candara, sans-serif',
    sample: 'Ritmo humano e macio'
  },
  geometric: {
    label: 'Geométrica',
    hint: 'Produto mais firme',
    main: '"Avenir Next", "Futura", "Trebuchet MS", sans-serif',
    display: '"Century Gothic", "Avenir Next", "Trebuchet MS", sans-serif',
    sample: 'Estrutura com precisão'
  },
  modern: {
    label: 'Moderna',
    hint: 'Mais limpa e silenciosa',
    main: '"Segoe UI Variable", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    display: '"Segoe UI Variable Display", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    sample: 'Clareza com menos ruído'
  },
  grotesk: {
    label: 'Grotesca',
    hint: 'SaaS mais editorial',
    main: '"Helvetica Neue", "Arial Narrow", Arial, sans-serif',
    display: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
    sample: 'Presença sem ornamento'
  },
  editorial: {
    label: 'Editorial',
    hint: 'Mais contraste e personalidade',
    main: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
    display: '"Iowan Old Style", Georgia, "Times New Roman", serif',
    sample: 'Peso e contraste na leitura'
  },
  mono: {
    label: 'Mono',
    hint: 'Operação técnica',
    main: 'Consolas, "Lucida Sans Unicode", "Segoe UI", sans-serif',
    display: 'Consolas, "SFMono-Regular", "Courier New", monospace',
    sample: 'Contexto, sistema, comando'
  },
  industrial: {
    label: 'Industrial',
    hint: 'Mais seco e objetivo',
    main: 'Tahoma, Verdana, "Segoe UI", sans-serif',
    display: '"Arial Black", Tahoma, sans-serif',
    sample: 'Direto ao ponto'
  }
};
const FLOWLY_RADIUS_PRESETS = {
  sharp: { label: 'Seco', hint: 'Mais reto e contido', lg: '10px', md: '6px', sm: '4px' },
  compact: { label: 'Compacto', hint: 'Técnico e discreto', lg: '14px', md: '9px', sm: '6px' },
  soft: { label: 'Suave', hint: 'Equilíbrio padrão', lg: '18px', md: '12px', sm: '8px' },
  rounded: { label: 'Arredondado', hint: 'Mais amigável e fluido', lg: '26px', md: '18px', sm: '12px' },
  organic: { label: 'Orgânico', hint: 'Curvas mais fortes', lg: '32px', md: '22px', sm: '14px' }
};
const FLOWLY_PAGE_WIDTH_PRESETS = {
  focused: { label: 'Focada', hint: 'Mais concentrada', base: '1100px', narrow: '980px', wide: '1200px' },
  compact: { label: 'Compacta', hint: 'Mais densa', base: '1180px', narrow: '1040px', wide: '1280px' },
  wide: { label: 'Equilibrada', hint: 'Padrão do app', base: '1280px', narrow: '1120px', wide: '1400px' },
  cinematic: { label: 'Ampla', hint: 'Respira mais', base: '1380px', narrow: '1200px', wide: '1520px' }
};
const FLOWLY_BODY_ACCENT_PRESETS = {
  none:   { label: 'Sem tint',  hint: 'Fundo totalmente neutro',       opacity: '0',    purple: '0'    },
  subtle: { label: 'Sutil',     hint: 'Toque mínimo de cor',           opacity: '0.03', purple: '0.02' },
  soft:   { label: 'Suave',     hint: 'Cor ambiente visível',          opacity: '0.05', purple: '0.03' },
  vivid:  { label: 'Vívido',    hint: 'Mais presença da cor no fundo', opacity: '0.09', purple: '0.05' }
};
const FLOWLY_SHADOW_PRESETS = {
  flat:  {
    label: 'Plano',   hint: 'Sem elevação — mais flat',
    card:        '0 0 0 1px rgba(255,255,255,0.04)',
    cardHover:   '0 0 0 1px rgba(255,255,255,0.07)',
    glow:        '0 0 0 rgba(0,0,0,0)'
  },
  soft:  {
    label: 'Suave',   hint: 'Elevação discreta',
    card:        '0 0 0 1px rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.32), 0 8px 20px rgba(0,0,0,0.18)',
    cardHover:   '0 0 0 1px rgba(255,255,255,0.07), 0 4px 10px rgba(0,0,0,0.36), 0 16px 36px rgba(0,0,0,0.24)',
    glow:        '0 0 36px rgba(var(--accent-primary-rgb), 0.07)'
  },
  float: {
    label: 'Flutuante', hint: 'Cards elevados com profundidade',
    card:        '0 0 0 1px rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.44), 0 18px 44px rgba(0,0,0,0.30)',
    cardHover:   '0 0 0 1px rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.50), 0 28px 64px rgba(0,0,0,0.38)',
    glow:        '0 0 48px rgba(var(--accent-primary-rgb), 0.12)'
  }
};
const FLOWLY_BORDER_PRESETS = {
  none:    { label: 'Invisível', hint: 'Bordas totalmente apagadas',  subtle: 'rgba(255,255,255,0.022)', active: 'rgba(var(--accent-primary-rgb), 0.12)' },
  subtle:  { label: 'Sutil',     hint: 'Bordas quase invisíveis',     subtle: 'rgba(255,255,255,0.055)', active: 'rgba(var(--accent-primary-rgb), 0.22)' },
  defined: { label: 'Definida',  hint: 'Bordas mais presentes',       subtle: 'rgba(255,255,255,0.09)',  active: 'rgba(var(--accent-primary-rgb), 0.35)' },
  bold:    { label: 'Marcada',   hint: 'Bordas claramente visíveis',   subtle: 'rgba(255,255,255,0.14)',  active: 'rgba(var(--accent-primary-rgb), 0.50)' }
};
const FLOWLY_PANEL_PRESETS = {
  flat: {
    label: 'Plano',
    hint: 'Minimalista e leve',
    panel: 'rgba(255,255,255,0.014)',
    panelStrong: 'rgba(255,255,255,0.022)',
    panelElevated: 'rgba(255,255,255,0.032)',
    border: 'rgba(255,255,255,0.05)',
    shadow: '0 10px 24px rgba(0,0,0,0.12)',
    blur: '8px'
  },
  soft: {
    label: 'Suave',
    hint: 'Mais leve e translúcido',
    panel: 'rgba(255,255,255,0.024)',
    panelStrong: 'rgba(255,255,255,0.038)',
    panelElevated: 'rgba(255,255,255,0.055)',
    border: 'rgba(255,255,255,0.055)',
    shadow: '0 16px 34px rgba(0,0,0,0.18)',
    blur: '16px'
  },
  balanced: {
    label: 'Equilibrado',
    hint: 'Contraste médio',
    panel: 'rgba(255,255,255,0.03)',
    panelStrong: 'rgba(255,255,255,0.05)',
    panelElevated: 'rgba(255,255,255,0.075)',
    border: 'rgba(255,255,255,0.075)',
    shadow: '0 18px 44px rgba(0,0,0,0.22)',
    blur: '20px'
  },
  crisp: {
    label: 'Marcado',
    hint: 'Mais sólido e definido',
    panel: 'rgba(13,14,20,0.82)',
    panelStrong: 'rgba(18,20,28,0.94)',
    panelElevated: 'rgba(24,26,36,0.98)',
    border: 'rgba(255,255,255,0.11)',
    shadow: '0 22px 56px rgba(0,0,0,0.28)',
    blur: '24px'
  }
};

function hexToRgbString(value, fallback) {
  const hex = String(value || fallback || '').replace('#', '').trim();
  if (![3, 6].includes(hex.length)) return fallback || '10 132 255';
  const expanded = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
  const int = Number.parseInt(expanded, 16);
  if (Number.isNaN(int)) return fallback || '10 132 255';
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `${r} ${g} ${b}`;
}

function normalizeFlowlyThemeSettings(rawSettings = {}) {
  const base = { ...FLOWLY_THEME_DEFAULTS, ...(rawSettings || {}) };
  if (!FLOWLY_FONT_PRESETS[base.fontMain]) base.fontMain = FLOWLY_THEME_DEFAULTS.fontMain;
  if (!FLOWLY_FONT_PRESETS[base.fontDisplay]) base.fontDisplay = FLOWLY_THEME_DEFAULTS.fontDisplay;
  if (!FLOWLY_RADIUS_PRESETS[base.radiusScale]) base.radiusScale = FLOWLY_THEME_DEFAULTS.radiusScale;
  if (!FLOWLY_PAGE_WIDTH_PRESETS[base.pageWidth]) base.pageWidth = FLOWLY_THEME_DEFAULTS.pageWidth;
  if (!FLOWLY_PANEL_PRESETS[base.panelStyle]) base.panelStyle = FLOWLY_THEME_DEFAULTS.panelStyle;
  if (!FLOWLY_BODY_ACCENT_PRESETS[base.bodyAccent]) base.bodyAccent = FLOWLY_THEME_DEFAULTS.bodyAccent;
  if (!FLOWLY_SHADOW_PRESETS[base.shadowStyle]) base.shadowStyle = FLOWLY_THEME_DEFAULTS.shadowStyle;
  if (!FLOWLY_BORDER_PRESETS[base.borderStyle]) base.borderStyle = FLOWLY_THEME_DEFAULTS.borderStyle;
  return base;
}

function normalizeFlowlyAISettings(rawSettings = {}) {
  const base = { ...FLOWLY_AI_DEFAULTS, ...(rawSettings || {}) };
  base.enabled = base.enabled === true;
  base.provider = String(base.provider || 'local').trim() || 'local';
  base.model = String(base.model || FLOWLY_AI_DEFAULTS.model).trim() || FLOWLY_AI_DEFAULTS.model;
  base.endpoint = String(base.endpoint || '').trim();
  base.apiKey = String(base.apiKey || '').trim();
  base.systemPrompt =
    String(base.systemPrompt || FLOWLY_AI_DEFAULTS.systemPrompt).trim() ||
    FLOWLY_AI_DEFAULTS.systemPrompt;
  return base;
}

function getFlowlyAISettings() {
  return normalizeFlowlyAISettings(
    safeJSONParse(localStorage.getItem(FLOWLY_AI_STORAGE_KEY), FLOWLY_AI_DEFAULTS)
  );
}

function saveFlowlyAISettings(nextSettings) {
  const normalized = normalizeFlowlyAISettings(nextSettings);
  localStorage.setItem(FLOWLY_AI_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function getFlowlyManifestAiPreset(currentSettings = {}) {
  return normalizeFlowlyAISettings({
    ...currentSettings,
    enabled: true,
    provider: 'manifest',
    model: 'manifest/auto',
    endpoint: 'sexta-ai',
    apiKey: ''
  });
}

function normalizeFlowlyTelegramLinkState(rawState = {}) {
  const base = {
    linked: false,
    telegramUsername: '',
    chatIdMasked: '',
    code: '',
    expiresAt: '',
    webhookConfigured: false,
    webhookUrl: ''
  };
  const next = { ...base, ...(rawState || {}) };
  next.linked = next.linked === true;
  next.telegramUsername = String(next.telegramUsername || '').trim();
  next.chatIdMasked = String(next.chatIdMasked || '').trim();
  next.code = String(next.code || '').trim().toUpperCase();
  next.expiresAt = String(next.expiresAt || '').trim();
  next.webhookConfigured = next.webhookConfigured === true;
  next.webhookUrl = String(next.webhookUrl || '').trim();
  return next;
}

function getFlowlyTelegramLinkState() {
  return normalizeFlowlyTelegramLinkState(
    safeJSONParse(localStorage.getItem(FLOWLY_TELEGRAM_LINK_STORAGE_KEY), {})
  );
}

function saveFlowlyTelegramLinkState(nextState) {
  const normalized = normalizeFlowlyTelegramLinkState(nextState);
  localStorage.setItem(FLOWLY_TELEGRAM_LINK_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function getFlowlyThemeSettings() {
  return normalizeFlowlyThemeSettings(
    safeJSONParse(localStorage.getItem(FLOWLY_THEME_STORAGE_KEY), FLOWLY_THEME_DEFAULTS)
  );
}

function saveFlowlyThemeSettings(nextSettings) {
  const normalized = normalizeFlowlyThemeSettings(nextSettings);
  localStorage.setItem(FLOWLY_THEME_STORAGE_KEY, JSON.stringify(normalized));
  applyFlowlyThemeSettings(normalized);
  return normalized;
}

function applyFlowlyThemeSettings(settings = getFlowlyThemeSettings()) {
  const normalized = normalizeFlowlyThemeSettings(settings);
  const root = document.documentElement;
  const mainFont = FLOWLY_FONT_PRESETS[normalized.fontMain] || FLOWLY_FONT_PRESETS.system;
  const displayFont = FLOWLY_FONT_PRESETS[normalized.fontDisplay] || FLOWLY_FONT_PRESETS.system;
  const radius = FLOWLY_RADIUS_PRESETS[normalized.radiusScale] || FLOWLY_RADIUS_PRESETS.soft;
  const pageWidth = FLOWLY_PAGE_WIDTH_PRESETS[normalized.pageWidth] || FLOWLY_PAGE_WIDTH_PRESETS.wide;
  const panelStyle = FLOWLY_PANEL_PRESETS[normalized.panelStyle] || FLOWLY_PANEL_PRESETS.balanced;
  const bodyAccent = FLOWLY_BODY_ACCENT_PRESETS[normalized.bodyAccent] || FLOWLY_BODY_ACCENT_PRESETS.subtle;
  const shadowStyle = FLOWLY_SHADOW_PRESETS[normalized.shadowStyle] || FLOWLY_SHADOW_PRESETS.soft;
  const borderStyle = FLOWLY_BORDER_PRESETS[normalized.borderStyle] || FLOWLY_BORDER_PRESETS.subtle;
  const primaryRgb = hexToRgbString(normalized.primaryColor, '10 132 255');
  const secondaryRgb = hexToRgbString(normalized.secondaryColor, '255 159 10');

  root.style.setProperty('--accent-blue', normalized.primaryColor);
  root.style.setProperty('--accent-orange', normalized.secondaryColor);
  root.style.setProperty('--accent-primary-rgb', primaryRgb);
  root.style.setProperty('--accent-secondary-rgb', secondaryRgb);
  root.style.setProperty('--font-main', mainFont.main);
  root.style.setProperty('--font-display', displayFont.display);
  root.style.setProperty('--radius-sm', radius.sm || radius.md);
  root.style.setProperty('--radius-lg', radius.lg);
  root.style.setProperty('--radius-md', radius.md);
  root.style.setProperty('--shell-max-width', pageWidth.base);
  root.style.setProperty('--shell-max-width-narrow', pageWidth.narrow);
  root.style.setProperty('--shell-max-width-wide', pageWidth.wide);
  root.style.setProperty('--surface-panel', panelStyle.panel);
  root.style.setProperty('--surface-panel-strong', panelStyle.panelStrong);
  root.style.setProperty('--surface-panel-elevated', panelStyle.panelElevated);
  root.style.setProperty('--border-panel', panelStyle.border);
  root.style.setProperty('--shadow-panel', panelStyle.shadow);
  root.style.setProperty('--panel-blur', panelStyle.blur);

  /* --- novos controles visuais --- */
  root.style.setProperty('--body-accent-opacity', bodyAccent.opacity);
  root.style.setProperty('--body-accent-purple', bodyAccent.purple);
  root.style.setProperty('--shadow-card', shadowStyle.card);
  root.style.setProperty('--shadow-card-hover', shadowStyle.cardHover);
  root.style.setProperty('--shadow-glow-blue', shadowStyle.glow);
  root.style.setProperty('--border-subtle', borderStyle.subtle);
  root.style.setProperty('--border-active', borderStyle.active);

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', normalized.primaryColor);
  }
}

applyFlowlyThemeSettings();
