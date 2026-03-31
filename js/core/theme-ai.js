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
  radiusScale: 'soft',
  pageWidth: 'wide',
  panelStyle: 'balanced'
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
const FLOWLY_PAGE_WIDTH_PRESETS = {
  compact: { label: 'Compacta', base: '1180px', narrow: '1040px', wide: '1280px' },
  wide: { label: 'Equilibrada', base: '1280px', narrow: '1120px', wide: '1400px' },
  cinematic: { label: 'Ampla', base: '1380px', narrow: '1200px', wide: '1520px' }
};
const FLOWLY_PANEL_PRESETS = {
  soft: {
    label: 'Suave',
    panel: 'rgba(255,255,255,0.024)',
    panelStrong: 'rgba(255,255,255,0.038)',
    panelElevated: 'rgba(255,255,255,0.055)',
    border: 'rgba(255,255,255,0.055)',
    shadow: '0 16px 34px rgba(0,0,0,0.18)',
    blur: '16px'
  },
  balanced: {
    label: 'Equilibrado',
    panel: 'rgba(255,255,255,0.03)',
    panelStrong: 'rgba(255,255,255,0.05)',
    panelElevated: 'rgba(255,255,255,0.075)',
    border: 'rgba(255,255,255,0.075)',
    shadow: '0 18px 44px rgba(0,0,0,0.22)',
    blur: '20px'
  },
  crisp: {
    label: 'Marcado',
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
  const pageWidth = FLOWLY_PAGE_WIDTH_PRESETS[normalized.pageWidth] || FLOWLY_PAGE_WIDTH_PRESETS.wide;
  const panelStyle = FLOWLY_PANEL_PRESETS[normalized.panelStyle] || FLOWLY_PANEL_PRESETS.balanced;
  const primaryRgb = hexToRgbString(normalized.primaryColor, '10 132 255');
  const secondaryRgb = hexToRgbString(normalized.secondaryColor, '255 159 10');

  root.style.setProperty('--accent-blue', normalized.primaryColor);
  root.style.setProperty('--accent-orange', normalized.secondaryColor);
  root.style.setProperty('--accent-primary-rgb', primaryRgb);
  root.style.setProperty('--accent-secondary-rgb', secondaryRgb);
  root.style.setProperty('--font-main', mainFont.main);
  root.style.setProperty('--font-display', displayFont.display);
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

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', normalized.primaryColor);
  }
}

applyFlowlyThemeSettings();
