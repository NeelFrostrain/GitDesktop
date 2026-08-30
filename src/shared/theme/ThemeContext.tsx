import React, { createContext, useContext, useMemo, useState } from 'react';

export type ThemePresetId =
  | 'commito-dark'
  | 'neutral-dark'
  | 'oled-pure'
  | 'tokyo-night'
  | 'nord-slate'
  | 'clean-light'
  | 'obsidian-spark'
  | 'carbon-orange'
  | 'espresso-terracotta'
  | 'github-dark'
  | 'antigravity-dark'
  | 'codex-graphite';

export interface ThemeDefinition {
  id: ThemePresetId;
  name: string;
  isDark: boolean;
  description: string;
  variables: Record<string, string>;
}

interface ThemeContextType {
  theme: ThemePresetId;
  themeDefinition: ThemeDefinition;
  isDark: boolean;
  setTheme: (themeId: ThemePresetId) => void;
  setCustomToken: (name: string, value: string) => void;
  resetTheme: () => void;
  availableThemes: ThemeDefinition[];
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemePresetId;
}

// Theme Preset Definitions
const THEME_PRESETS: Record<ThemePresetId, ThemeDefinition> = {
  'commito-dark': {
    id: 'commito-dark',
    name: 'Commito Dark',
    isDark: true,
    description: 'Warm coral accent with earthy surfaces (default)',
    variables: {
      '--surface': '#181818',
      '--surface-subtle': '#131313',
      '--surface-elevated': '#201e22',
      '--surface-hover': '#2b292f',
      '--surface-active': '#382221',
      '--border': '#29272b',
      '--border-subtle': '#201e22',
      '--border-strong': '#3d3a42',
      '--text': '#e6e4e8',
      '--text-subtle': '#b3b0b8',
      '--text-muted': '#85818c',
      '--text-faint': '#5c5863',
      '--accent': '#e05638',
      '--accent-hover': '#f06344',
      '--accent-active': '#c74327',
      '--focus-ring': '#e05638',
      '--brand-commito-coral': '#e05638',
      '--brand-commito-coral-hover': '#f06344',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.1)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.22)',
    },
  },

  'neutral-dark': {
    id: 'neutral-dark',
    name: 'Zinc Dark',
    isDark: true,
    description: 'Clean, neutral-charcoal dark theme engineered for long coding sessions',
    variables: {
      '--surface': '#121214',
      '--surface-subtle': '#0c0c0e',
      '--surface-elevated': '#1a1a1e',
      '--surface-hover': '#242429',
      '--surface-active': '#2e2e34',
      '--border': '#27272a',
      '--border-subtle': '#1e1e22',
      '--border-strong': '#3f3f46',
      '--text': '#f4f4f5',
      '--text-subtle': '#d4d4d8',
      '--text-muted': '#a1a1aa',
      '--text-faint': '#71717a',
      '--accent': '#3b82f6',
      '--accent-hover': '#60a5fa',
      '--accent-active': '#2563eb',
      '--focus-ring': '#3b82f6',
      '--brand-commito-coral': '#3b82f6',
      '--brand-commito-coral-hover': '#60a5fa',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.12)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.24)',
    },
  },

  'oled-pure': {
    id: 'oled-pure',
    name: 'OLED Black',
    isDark: true,
    description: 'Pure black background with maximum contrast and vivid emerald accents',
    variables: {
      '--surface': '#000000',
      '--surface-subtle': '#050505',
      '--surface-elevated': '#0f0f11',
      '--surface-hover': '#17171a',
      '--surface-active': '#232328',
      '--border': '#1f1f23',
      '--border-subtle': '#141416',
      '--border-strong': '#333338',
      '--text': '#ffffff',
      '--text-subtle': '#e2e8f0',
      '--text-muted': '#94a3b8',
      '--text-faint': '#64748b',
      '--accent': '#10b981',
      '--accent-hover': '#34d399',
      '--accent-active': '#059669',
      '--focus-ring': '#10b981',
      '--brand-commito-coral': '#10b981',
      '--brand-commito-coral-hover': '#34d399',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.15)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.3)',
    },
  },

  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    isDark: true,
    description: 'Deep midnight blue with saturated violet and cyan developer tones',
    variables: {
      '--surface': '#1a1b26',
      '--surface-subtle': '#16161e',
      '--surface-elevated': '#24283b',
      '--surface-hover': '#2f354d',
      '--surface-active': '#3b4261',
      '--border': '#292e42',
      '--border-subtle': '#1f2335',
      '--border-strong': '#414868',
      '--text': '#c0caf5',
      '--text-subtle': '#a9b1d6',
      '--text-muted': '#7aa2f7',
      '--text-faint': '#565f89',
      '--accent': '#bb9af7',
      '--accent-hover': '#c0a3ff',
      '--accent-active': '#9d7cd8',
      '--focus-ring': '#bb9af7',
      '--brand-commito-coral': '#bb9af7',
      '--brand-commito-coral-hover': '#c0a3ff',
      '--scrollbar-thumb': 'rgba(122, 162, 247, 0.2)',
      '--scrollbar-thumb-hover': 'rgba(122, 162, 247, 0.35)',
    },
  },

  'nord-slate': {
    id: 'nord-slate',
    name: 'Nordic Slate',
    isDark: true,
    description: 'Calm arctic slate-gray paired with an electric frost cyan accent',
    variables: {
      '--surface': '#242933',
      '--surface-subtle': '#1e222a',
      '--surface-elevated': '#2e3440',
      '--surface-hover': '#3b4252',
      '--surface-active': '#434c5e',
      '--border': '#3b4252',
      '--border-subtle': '#2e3440',
      '--border-strong': '#4c566a',
      '--text': '#eceff4',
      '--text-subtle': '#e5e9f0',
      '--text-muted': '#d8dee9',
      '--text-faint': '#78839b',
      '--accent': '#88c0d0',
      '--accent-hover': '#8fbcbb',
      '--accent-active': '#81a1c1',
      '--focus-ring': '#88c0d0',
      '--brand-commito-coral': '#88c0d0',
      '--brand-commito-coral-hover': '#8fbcbb',
      '--scrollbar-thumb': 'rgba(216, 222, 233, 0.15)',
      '--scrollbar-thumb-hover': 'rgba(216, 222, 233, 0.3)',
    },
  },

  'clean-light': {
    id: 'clean-light',
    name: 'Paper Light',
    isDark: false,
    description: 'High-legibility crisp light theme with deep charcoal text and indigo accents',
    variables: {
      '--surface': '#ffffff',
      '--surface-subtle': '#f8fafc',
      '--surface-elevated': '#f1f5f9',
      '--surface-hover': '#e2e8f0',
      '--surface-active': '#cbd5e1',
      '--border': '#e2e8f0',
      '--border-subtle': '#f1f5f9',
      '--border-strong': '#cbd5e1',
      '--text': '#0f172a',
      '--text-subtle': '#334155',
      '--text-muted': '#64748b',
      '--text-faint': '#94a3b8',
      '--accent': '#6366f1',
      '--accent-hover': '#4f46e5',
      '--accent-active': '#4338ca',
      '--focus-ring': '#6366f1',
      '--brand-commito-coral': '#6366f1',
      '--brand-commito-coral-hover': '#4f46e5',
      '--scrollbar-thumb': 'rgba(15, 23, 42, 0.15)',
      '--scrollbar-thumb-hover': 'rgba(15, 23, 42, 0.28)',
    },
  },

  'obsidian-spark': {
    id: 'obsidian-spark',
    name: 'Obsidian Spark',
    isDark: true,
    description: 'Deep obsidian surfaces with subtle cool-blue accents',
    variables: {
      '--surface': '#131314',
      '--surface-subtle': '#0e0e0f',
      '--surface-elevated': '#1e1f20',
      '--surface-hover': '#282a2c',
      '--surface-active': '#333538',
      '--border': '#282a2c',
      '--border-subtle': '#1f2022',
      '--border-strong': '#3c4043',
      '--text': '#e3e3e3',
      '--text-subtle': '#c4c7c5',
      '--text-muted': '#8e918f',
      '--text-faint': '#5e6260',
      '--accent': '#7cacf8',
      '--accent-hover': '#a8c7fa',
      '--accent-active': '#4c8df6',
      '--focus-ring': '#7cacf8',
      '--brand-commito-coral': '#7cacf8',
      '--brand-commito-coral-hover': '#a8c7fa',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.1)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.22)',
    },
  },

  'carbon-orange': {
    id: 'carbon-orange',
    name: 'Carbon Flame',
    isDark: true,
    description: 'Matte dark carbon surfaces paired with sharp neon orange accents',
    variables: {
      '--surface': '#121214',
      '--surface-subtle': '#0c0c0e',
      '--surface-elevated': '#19191d',
      '--surface-hover': '#242429',
      '--surface-active': '#312722',
      '--border': '#26262b',
      '--border-subtle': '#1c1c20',
      '--border-strong': '#3f3f46',
      '--text': '#f4f4f5',
      '--text-subtle': '#d4d4d8',
      '--text-muted': '#a1a1aa',
      '--text-faint': '#71717a',
      '--accent': '#ff5a26',
      '--accent-hover': '#ff7347',
      '--accent-active': '#e04616',
      '--focus-ring': '#ff5a26',
      '--brand-commito-coral': '#ff5a26',
      '--brand-commito-coral-hover': '#ff7347',
      '--scrollbar-thumb': 'rgba(255, 90, 38, 0.2)',
      '--scrollbar-thumb-hover': 'rgba(255, 90, 38, 0.4)',
    },
  },

  'espresso-terracotta': {
    id: 'espresso-terracotta',
    name: 'Warm Terracotta',
    isDark: true,
    description: 'Earthy espresso-charcoal base with soft terracotta accents',
    variables: {
      '--surface': '#191816',
      '--surface-subtle': '#12110f',
      '--surface-elevated': '#22201d',
      '--surface-hover': '#2d2b27',
      '--surface-active': '#393631',
      '--border': '#2c2925',
      '--border-subtle': '#22201d',
      '--border-strong': '#443f39',
      '--text': '#f3f0ea',
      '--text-subtle': '#d8d4cb',
      '--text-muted': '#a39e93',
      '--text-faint': '#736e65',
      '--accent': '#d97757',
      '--accent-hover': '#e28b6d',
      '--accent-active': '#c06344',
      '--focus-ring': '#d97757',
      '--brand-commito-coral': '#d97757',
      '--brand-commito-coral-hover': '#e28b6d',
      '--scrollbar-thumb': 'rgba(217, 119, 87, 0.2)',
      '--scrollbar-thumb-hover': 'rgba(217, 119, 87, 0.35)',
    },
  },

  'github-dark': {
    id: 'github-dark',
    name: 'GitHub Dark',
    isDark: true,
    description: 'Classic GitHub Desktop charcoal with primer-blue controls and diff accents',
    variables: {
      '--surface': '#161b22',
      '--surface-subtle': '#0d1117',
      '--surface-elevated': '#21262d',
      '--surface-hover': '#30363d',
      '--surface-active': '#388bfd26',
      '--border': '#30363d',
      '--border-subtle': '#21262d',
      '--border-strong': '#6e7681',
      '--text': '#f0f6fc',
      '--text-subtle': '#c9d1d9',
      '--text-muted': '#8b949e',
      '--text-faint': '#484f58',
      '--accent': '#1f6feb',
      '--accent-hover': '#388bfd',
      '--accent-active': '#1158c7',
      '--focus-ring': '#388bfd',
      '--brand-commito-coral': '#1f6feb',
      '--brand-commito-coral-hover': '#388bfd',
      '--scrollbar-thumb': 'rgba(110, 118, 129, 0.25)',
      '--scrollbar-thumb-hover': 'rgba(110, 118, 129, 0.45)',
    },
  },

  'antigravity-dark': {
    id: 'antigravity-dark',
    name: 'Antigravity Studio',
    isDark: true,
    description: 'IDE dark matte slate matching terminal buffers and VS Code chrome',
    variables: {
      '--surface': '#18181b',
      '--surface-subtle': '#131313',
      '--surface-elevated': '#1f1f23',
      '--surface-hover': '#2a2a30',
      '--surface-active': '#382221',
      '--border': '#27272a',
      '--border-subtle': '#1e1e22',
      '--border-strong': '#3f3f46',
      '--text': '#e6e4e8',
      '--text-subtle': '#b3b0b8',
      '--text-muted': '#85818c',
      '--text-faint': '#5c5863',
      '--accent': '#38bdf8',
      '--accent-hover': '#7dd3fc',
      '--accent-active': '#0284c7',
      '--focus-ring': '#38bdf8',
      '--brand-commito-coral': '#e05638',
      '--brand-commito-coral-hover': '#f06344',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.12)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.25)',
    },
  },

  'codex-graphite': {
    id: 'codex-graphite',
    name: 'Codex Graphite',
    isDark: true,
    description:
      'Near-black graphite workspace with quiet gray hierarchy and a cool blue focus accent',
    variables: {
      '--surface': '#161616',
      '--surface-subtle': '#101010',
      '--surface-elevated': '#1d1d1d',
      '--surface-hover': '#272727',
      '--surface-active': '#2d2d2d',
      '--border': '#303030',
      '--border-subtle': '#242424',
      '--border-strong': '#454545',
      '--text': '#f0f0f0',
      '--text-subtle': '#c8c8c8',
      '--text-muted': '#969696',
      '--text-faint': '#646464',
      '--accent': '#6ea8fe',
      '--accent-hover': '#8bb9ff',
      '--accent-active': '#4f8de8',
      '--focus-ring': '#6ea8fe',
      '--brand-commito-coral': '#6ea8fe',
      '--brand-commito-coral-hover': '#8bb9ff',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.16)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.28)',
    },
  },
};

function getSavedTheme(): ThemePresetId {
  if (typeof localStorage === 'undefined') return 'commito-dark';
  try {
    const saved = localStorage.getItem('app_theme');
    if (saved && saved in THEME_PRESETS) return saved as ThemePresetId;
  } catch {}
  return 'commito-dark';
}

function applyTheme(themeId: ThemePresetId) {
  const theme = THEME_PRESETS[themeId];
  if (!theme) return;

  // Apply CSS variables to root element
  Object.entries(theme.variables).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });

  // Update color-scheme and data attribute
  document.documentElement.style.colorScheme = theme.isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', themeId);

  // Save to localStorage
  try {
    localStorage.setItem('app_theme', themeId);
  } catch {}
}

export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
  const savedTheme = getSavedTheme();
  const [theme, setThemeState] = useState<ThemePresetId>(defaultTheme || savedTheme);
  const themeDefinition = THEME_PRESETS[theme];

  const isDark = themeDefinition.isDark;

  const setTheme = (themeId: ThemePresetId) => {
    setThemeState(themeId);
    applyTheme(themeId);
  };

  const setCustomToken = (name: string, value: string) => {
    if (typeof document !== 'undefined' && name) {
      document.documentElement.style.setProperty(name, value);
    }
  };

  const resetTheme = () => {
    setTheme(theme);
  };

  const availableThemes = useMemo(() => Object.values(THEME_PRESETS), []);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      themeDefinition,
      isDark,
      setTheme,
      setCustomToken,
      resetTheme,
      availableThemes,
    }),
    [theme, themeDefinition, isDark]
  );

  // Apply theme on mount
  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
