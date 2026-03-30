const FLOWLY_AI_STORAGE_KEY = 'flowly_ai_settings';
const FLOWLY_THEME_STORAGE_KEY = 'flowly_theme_settings';
const FLOWLY_SETTINGS_TAB_KEY = 'flowly_settings_tab';
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
  radiusScale: 'soft'
};
const FLOWLY_FONT_PRESETS = {
  system: {
    label: 'Sistema',
    main: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    display:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  geometric: {
    label: 'Geometrica',
    main: '"Avenir Next", "Futura", "Trebuchet MS", sans-serif',
    display: '"Avenir Next", "Futura", "Trebuchet MS", sans-serif'
  },
  editorial: {
    label: 'Editorial',
    main: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    display: '"Georgia", "Times New Roman", serif'
  },
  mono: {
    label: 'Mono',
    main: '"IBM Plex Sans", "Segoe UI", Arial, sans-serif',
    display: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace'
  }
};
const FLOWLY_RADIUS_PRESETS = {
  compact: { label: 'Compacto', lg: '12px', md: '8px' },
  soft: { label: 'Suave', lg: '16px', md: '10px' },
  rounded: { label: 'Arredondado', lg: '24px', md: '16px' }
};

function normalizeFlowlyThemeSettings(rawSettings = {}) {
  const base = { ...FLOWLY_THEME_DEFAULTS, ...(rawSettings || {}) };
  if (!FLOWLY_FONT_PRESETS[base.fontMain]) base.fontMain = FLOWLY_THEME_DEFAULTS.fontMain;
  if (!FLOWLY_FONT_PRESETS[base.fontDisplay]) base.fontDisplay = FLOWLY_THEME_DEFAULTS.fontDisplay;
  if (!FLOWLY_RADIUS_PRESETS[base.radiusScale]) base.radiusScale = FLOWLY_THEME_DEFAULTS.radiusScale;
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

  root.style.setProperty('--accent-blue', normalized.primaryColor);
  root.style.setProperty('--accent-orange', normalized.secondaryColor);
  root.style.setProperty('--font-main', mainFont.main);
  root.style.setProperty('--font-display', displayFont.display);
  root.style.setProperty('--radius-lg', radius.lg);
  root.style.setProperty('--radius-md', radius.md);

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', normalized.primaryColor);
  }
}
