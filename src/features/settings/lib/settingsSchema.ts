export type SettingType = 'color' | 'number' | 'text' | 'select' | 'boolean';
export type SettingCategory = 'ai';

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
  ai: {
    label: 'AI & Commit-AI',
    icon: 'Sparkles',
    subcategories: ['API Keys & Providers', 'Model Configuration'],
  },
};

export const SETTINGS_SCHEMA: SettingDefinition[] = [
  // ==========================================
  // AI & COMMIT-AI
  // ==========================================
  {
    id: 'ai.active_api_key',
    label: 'Google Gemini API Key',
    description: 'Active Google Gemini API Key (AIza...) from aistudio.google.com used for AI commit analysis.',
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
    description: 'The Google Gemini model used for analyzing diffs and generating conventional commit messages.',
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
