export type SettingType = 'color' | 'number' | 'text' | 'select' | 'boolean';
export type SettingCategory = 'general' | 'appearance' | 'ai' | 'about' | 'legal';

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
  general: {
    label: 'General',
    icon: 'Settings',
    subcategories: ['Git & Workflow', 'Initialization Options'],
  },
  appearance: {
    label: 'Appearance & Themes',
    icon: 'Palette',
    subcategories: ['Color Theme', 'UI Scale'],
  },
  ai: {
    label: 'AI & Commit-AI',
    icon: 'Sparkles',
    subcategories: ['API Keys & Providers', 'Model Configuration'],
  },
  about: {
    label: 'About & Updates',
    icon: 'Info',
    subcategories: ['App Information', 'Software Updates'],
  },
  legal: {
    label: 'Legal',
    icon: 'FileText',
    subcategories: ['Terms of Service', 'Privacy Policy'],
  },
};

export const SETTINGS_SCHEMA: SettingDefinition[] = [
  // ==========================================
  // GENERAL & WORKFLOW
  // ==========================================
  {
    id: 'git.auto_push',
    label: 'Auto-push after commit',
    description: 'Automatically push commits to the remote branch immediately after committing.',
    category: 'general',
    subcategory: 'Git & Workflow',
    type: 'boolean',
    default: false,
    scope: 'app',
    commonlyUsed: true,
  },
  {
    id: 'git.init_readme',
    label: 'Initialize with README.md',
    description: 'Creates an initial README file to document the repository.',
    category: 'general',
    subcategory: 'Initialization Options',
    type: 'boolean',
    default: true,
    scope: 'app',
    commonlyUsed: true,
  },
  {
    id: 'git.auto_fetch',
    label: 'Background Auto-Fetch',
    description: 'Periodically fetch remote branches in the background to keep tracking status updated.',
    category: 'general',
    subcategory: 'Git & Workflow',
    type: 'boolean',
    default: true,
    scope: 'app',
  },
  {
    id: 'git.prune_on_fetch',
    label: 'Prune remote branches on fetch',
    description: 'Automatically remove remote-tracking references that no longer exist on the remote.',
    category: 'general',
    subcategory: 'Git & Workflow',
    type: 'boolean',
    default: false,
    scope: 'app',
  },
  {
    id: 'git.confirm_discard',
    label: 'Confirm before discarding changes',
    description: 'Show a confirmation dialog before discarding uncommitted file changes.',
    category: 'general',
    subcategory: 'Git & Workflow',
    type: 'boolean',
    default: true,
    scope: 'app',
  },

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
      { label: '🔥 Commito Dark (Default)', value: 'commito-dark' },
      { label: '⚡ Zinc Graphite (Sky Blue)', value: 'zinc-dark' },
      { label: '🖤 OLED Pure Black (Violet)', value: 'oled-pitch' },
      { label: '🌃 Tokyo Midnight (Cyan)', value: 'tokyo-night' },
      { label: '🌲 Obsidian Emerald (Green)', value: 'obsidian-emerald' },
      { label: '🟠 Carbon Amber (Orange)', value: 'carbon-orange' },
      { label: '❄️ Nordic Slate (Frost Blue)', value: 'nord-slate' },
      { label: '🧛 Dracula Dark (Magenta)', value: 'dracula-classic' },
      { label: '🐙 GitHub Dark (Blue)', value: 'github-dark' },
      { label: '📄 Clean Minimal Light', value: 'clean-light' },
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
      {
        label: '⚡ Gemini 3.5 Flash Lite (Recommended • Ultra Fast)',
        value: 'gemini-3.5-flash-lite',
      },
      {
        label: '🚀 Gemini 3.6 Flash (Flagship Next-Gen Multimodal)',
        value: 'gemini-3.6-flash',
      },
      {
        label: '⚡ Gemini 3.5 Flash (High-Speed Multimodal)',
        value: 'gemini-3.5-flash',
      },
      {
        label: '🏎️ Gemini 3.1 Flash Lite (High-Speed Reasoning)',
        value: 'gemini-3.1-flash-lite',
      },
      {
        label: '🧠 Gemini 3.7 Flash (State-of-the-Art • Deep Reasoning)',
        value: 'gemini-3.7-flash',
      },
    ],
    default: 'gemini-3.5-flash-lite',
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
  // ==========================================
  // ABOUT & UPDATES
  // ==========================================
  {
    id: 'app.auto_update',
    label: 'Automatically check for updates',
    description: 'Check for new releases in the background and notify when an update is available.',
    category: 'about',
    subcategory: 'Software Updates',
    type: 'boolean',
    default: true,
    scope: 'app',
    commonlyUsed: true,
  },
  {
    id: 'app.beta_channel',
    label: 'Include pre-release beta builds',
    description: 'Receive early preview updates with cutting-edge features and experimental optimizations.',
    category: 'about',
    subcategory: 'Software Updates',
    type: 'boolean',
    default: false,
    scope: 'app',
  },
];
