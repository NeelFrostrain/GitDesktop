export type SettingType = 'color' | 'number' | 'text' | 'select' | 'boolean';
export type SettingCategory = 'appearance' | 'ai';

export type SettingScope = 'app' | 'repo';

export interface SettingOption {
  label: string;
  value: string;
}

export interface SettingDefinition {
  id: string;
  label: string;
  description: string;
  category: SettingCategory;
  subcategory: string;
  type: SettingType;
  cssVar?: string;
  options?: SettingOption[];
  default: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  scope: SettingScope;
  commonlyUsed?: boolean;
}

export const CATEGORY_METADATA: Record<
  SettingCategory,
  { label: string; icon: string; subcategories: string[] }
> = {
  appearance: {
    label: 'Appearance & Themes',
    icon: 'Palette',
    subcategories: ['Color Theme', 'UI Scale', 'Fonts'],
  },
  ai: {
    label: 'AI & Commit-AI',
    icon: 'Sparkles',
    subcategories: ['API Keys & Providers', 'Model Configuration'],
  },
};

export const SETTINGS_SCHEMA: SettingDefinition[] = [
  // ==========================================
  // APPEARANCE & THEMES
  // ==========================================
  {
    id: 'app.theme',
    label: 'Color Theme',
    description: 'Choose your preferred visual theme for the application.',
    category: 'appearance',
    subcategory: 'Color Theme',
    type: 'select',
    options: [
      { label: '🔥 Commito Dark', value: 'commito-dark' },
      { label: '⚙️ Zinc Dark', value: 'neutral-dark' },
      { label: '💚 OLED Black', value: 'oled-pure' },
      { label: '🌙 Tokyo Night', value: 'tokyo-night' },
      { label: '❄️ Nordic Slate', value: 'nord-slate' },
      { label: '☀️ Paper Light', value: 'clean-light' },
      { label: '✨ Obsidian Spark', value: 'obsidian-spark' },
      { label: '🔥 Carbon Flame', value: 'carbon-orange' },
      { label: '🌅 Warm Terracotta', value: 'espresso-terracotta' },
      { label: '🐙 GitHub Dark', value: 'github-dark' },
      { label: '💫 Antigravity Studio', value: 'antigravity-dark' },
    ],
    default: 'commito-dark',
    scope: 'app',
    commonlyUsed: true,
  },
  {
    id: 'app.ui_scale',
    label: 'UI Scale',
    description: 'Adjust the overall UI density (100% = comfortable, 90% = compact).',
    category: 'appearance',
    subcategory: 'UI Scale',
    type: 'number',
    cssVar: '--app-ui-scale',
    min: 80,
    max: 120,
    step: 5,
    unit: '%',
    default: 100,
    scope: 'app',
  },
  {
    id: 'app.font_family',
    label: 'UI Font Family',
    description: 'Select the font family used throughout the interface.',
    category: 'appearance',
    subcategory: 'Fonts',
    type: 'select',
    cssVar: '--app-font-family',
    options: [
      { label: 'Inter (Default)', value: 'Inter' },
      { label: 'Segoe UI', value: 'Segoe UI' },
      { label: 'SF Pro Display', value: 'SF Pro Display' },
      { label: 'Roboto', value: 'Roboto' },
      { label: 'System Font Stack', value: 'system' },
    ],
    default: 'Inter',
    scope: 'app',
  },
  {
    id: 'app.terminal_font',
    label: 'Terminal Font Family',
    description: 'Monospace font used in terminal and code viewers.',
    category: 'appearance',
    subcategory: 'Fonts',
    type: 'select',
    cssVar: '--app-terminal-font-family',
    options: [
      { label: 'JetBrains Mono (Default)', value: 'JetBrains Mono' },
      { label: 'Fira Code', value: 'Fira Code' },
      { label: 'Cascadia Code', value: 'Cascadia Code' },
      { label: 'Monaco', value: 'Monaco' },
      { label: 'Menlo', value: 'Menlo' },
    ],
    default: 'JetBrains Mono',
    scope: 'app',
  },
  // ==========================================
  // AI & COMMIT-AI
  // ==========================================
  {
    id: 'ai.active_api_key',
    label: 'Google Gemini API Key',
    description:
      'Active Google Gemini API Key (AIza...) from aistudio.google.com used for AI commit analysis.',
    category: 'ai',
    subcategory: 'API Keys & Providers',
    type: 'text',
    default: '',
    scope: 'app',
    commonlyUsed: true,
  },
  {
    id: 'ai.gemini_api_keys',
    label: 'Google Gemini API Keys Pool',
    description: 'List of Google Gemini API keys for rotation.',
    category: 'ai',
    subcategory: 'API Keys & Providers',
    type: 'text',
    default: '',
    scope: 'app',
  },
  {
    id: 'ai.model',
    label: 'Commit-AI Model',
    description:
      'The Google Gemini model used for analyzing diffs and generating conventional commit messages.',
    category: 'ai',
    subcategory: 'Model Configuration',
    type: 'select',
    options: [
      { label: 'Gemini 2.5 Flash Lite (Recommended • Ultra Fast)', value: 'gemini-2.5-flash-lite' },
      { label: 'Gemini 3.5 Flash Lite (Experimental Next-Gen)', value: 'gemini-3.5-flash-lite' },
      { label: 'Gemini 3.1 Flash Lite (High-Speed Reasoning)', value: 'gemini-3.1-flash-lite' },
      { label: 'Gemini 2.0 Flash Lite (Ultra Low Latency)', value: 'gemini-2.0-flash-lite' },
      { label: 'Gemini 2.0 Flash (Next-Gen Multimodal & Reasoning)', value: 'gemini-2.0-flash' },
      { label: 'Gemini 1.5 Flash (Standard Flash)', value: 'gemini-1.5-flash' },
    ],
    default: 'gemini-2.5-flash-lite',
    scope: 'app',
    commonlyUsed: true,
  },
  {
    id: 'ai.temperature',
    label: 'Sampling Temperature',
    description: 'Controls creativity of the generated commit titles (0.0 to 1.0).',
    category: 'ai',
    subcategory: 'Model Configuration',
    type: 'number',
    min: 0.0,
    max: 1.0,
    step: 0.1,
    default: 0.7,
    scope: 'app',
  },
];
