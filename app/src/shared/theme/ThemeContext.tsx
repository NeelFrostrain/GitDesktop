import React, { createContext, useContext, useMemo, useState } from 'react';

export type ThemePresetId =
  | 'commito-dark'
  | 'zinc-dark'
  | 'oled-pitch'
  | 'tokyo-night'
  | 'obsidian-emerald'
  | 'carbon-orange'
  | 'nord-slate'
  | 'dracula-classic'
  | 'github-dark'
  | 'clean-light';

export type ThemeCategory = 'dark' | 'oled' | 'light';

export interface ThemeDefinition {
  id: ThemePresetId;
  name: string;
  category: ThemeCategory;
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

// ── Curated Stepped Dark Themes (Redesigned with Commito Dark Depth) ─────
export const THEME_PRESETS: Record<ThemePresetId, ThemeDefinition> = {
  'commito-dark': {
    id: 'commito-dark',
    name: 'Commito Dark',
    category: 'dark',
    isDark: true,
    description: 'Warm coral accent with earthy obsidian surfaces (Default)',
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
      '--git-added': '#22c55e',
      '--git-modified': '#eab308',
      '--git-deleted': '#ef4444',
      '--git-branch': '#e05638',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.1)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.22)',
    },
  },

  'zinc-dark': {
    id: 'zinc-dark',
    name: 'Zinc Graphite',
    category: 'dark',
    isDark: true,
    description: 'Ultra sleek neutral zinc with electric sky blue accents',
    variables: {
      '--surface': '#121214',
      '--surface-subtle': '#0d0d0f',
      '--surface-elevated': '#1a1a1e',
      '--surface-hover': '#242429',
      '--surface-active': '#1e2433',
      '--border': '#26262c',
      '--border-subtle': '#1c1c21',
      '--border-strong': '#383842',
      '--text': '#f0f0f3',
      '--text-subtle': '#b8b8c2',
      '--text-muted': '#7a7a88',
      '--text-faint': '#525260',
      '--accent': '#38bdf8',
      '--accent-hover': '#60a5fa',
      '--accent-active': '#0284c7',
      '--focus-ring': '#38bdf8',
      '--brand-commito-coral': '#38bdf8',
      '--brand-commito-coral-hover': '#60a5fa',
      '--git-added': '#34d399',
      '--git-modified': '#fbbf24',
      '--git-deleted': '#f87171',
      '--git-branch': '#38bdf8',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.08)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.18)',
    },
  },

  'oled-pitch': {
    id: 'oled-pitch',
    name: 'OLED Pure Black',
    category: 'oled',
    isDark: true,
    description: 'Pitch absolute black with electric amethyst violet accents',
    variables: {
      '--surface': '#000000',
      '--surface-subtle': '#000000',
      '--surface-elevated': '#0d0d10',
      '--surface-hover': '#17171c',
      '--surface-active': '#221c30',
      '--border': '#1c1c22',
      '--border-subtle': '#121216',
      '--border-strong': '#2c2c36',
      '--text': '#f4f4f6',
      '--text-subtle': '#b0b0b8',
      '--text-muted': '#70707c',
      '--text-faint': '#454550',
      '--accent': '#8b5cf6',
      '--accent-hover': '#a78bfa',
      '--accent-active': '#7c3aed',
      '--focus-ring': '#8b5cf6',
      '--brand-commito-coral': '#8b5cf6',
      '--brand-commito-coral-hover': '#a78bfa',
      '--git-added': '#22c55e',
      '--git-modified': '#eab308',
      '--git-deleted': '#ef4444',
      '--git-branch': '#a78bfa',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.12)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.25)',
    },
  },

  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Midnight',
    category: 'dark',
    isDark: true,
    description: 'Deep ink midnight with subtle neon cyan & soft lavender glow',
    variables: {
      '--surface': '#13141f',
      '--surface-subtle': '#0e0f17',
      '--surface-elevated': '#1a1b2a',
      '--surface-hover': '#23253a',
      '--surface-active': '#1f2c4a',
      '--border': '#25273d',
      '--border-subtle': '#1c1d2e',
      '--border-strong': '#383b5c',
      '--text': '#e2e5f8',
      '--text-subtle': '#a9afce',
      '--text-muted': '#73799d',
      '--text-faint': '#4d5170',
      '--accent': '#70a5fd',
      '--accent-hover': '#8bb9fe',
      '--accent-active': '#4b8cfc',
      '--focus-ring': '#70a5fd',
      '--brand-commito-coral': '#70a5fd',
      '--brand-commito-coral-hover': '#8bb9fe',
      '--git-added': '#73daca',
      '--git-modified': '#e0af68',
      '--git-deleted': '#f7768e',
      '--git-branch': '#bb9af7',
      '--scrollbar-thumb': 'rgba(112, 165, 253, 0.12)',
      '--scrollbar-thumb-hover': 'rgba(112, 165, 253, 0.25)',
    },
  },

  'obsidian-emerald': {
    id: 'obsidian-emerald',
    name: 'Obsidian Emerald',
    category: 'dark',
    isDark: true,
    description: 'Volcanic obsidian slate with refined emerald phosphor accents',
    variables: {
      '--surface': '#101412',
      '--surface-subtle': '#0b0e0c',
      '--surface-elevated': '#171f1b',
      '--surface-hover': '#202c26',
      '--surface-active': '#1a3b2b',
      '--border': '#212e27',
      '--border-subtle': '#18221d',
      '--border-strong': '#31463a',
      '--text': '#e8f5ee',
      '--text-subtle': '#b4d4c2',
      '--text-muted': '#779b86',
      '--text-faint': '#4e6b5b',
      '--accent': '#10b981',
      '--accent-hover': '#34d399',
      '--accent-active': '#059669',
      '--focus-ring': '#10b981',
      '--brand-commito-coral': '#10b981',
      '--brand-commito-coral-hover': '#34d399',
      '--git-added': '#34d399',
      '--git-modified': '#fbbf24',
      '--git-deleted': '#f87171',
      '--git-branch': '#10b981',
      '--scrollbar-thumb': 'rgba(16, 185, 129, 0.12)',
      '--scrollbar-thumb-hover': 'rgba(16, 185, 129, 0.25)',
    },
  },

  'carbon-orange': {
    id: 'carbon-orange',
    name: 'Carbon Amber',
    category: 'dark',
    isDark: true,
    description: 'Carbon graphite with industrial warm amber orange accent',
    variables: {
      '--surface': '#151517',
      '--surface-subtle': '#101011',
      '--surface-elevated': '#1e1e21',
      '--surface-hover': '#27272b',
      '--surface-active': '#382319',
      '--border': '#29292e',
      '--border-subtle': '#1f1f23',
      '--border-strong': '#3e3e46',
      '--text': '#f2f2f4',
      '--text-subtle': '#b8b8c0',
      '--text-muted': '#7b7b86',
      '--text-faint': '#53535d',
      '--accent': '#f97316',
      '--accent-hover': '#fb923c',
      '--accent-active': '#ea580c',
      '--focus-ring': '#f97316',
      '--brand-commito-coral': '#f97316',
      '--brand-commito-coral-hover': '#fb923c',
      '--git-added': '#22c55e',
      '--git-modified': '#eab308',
      '--git-deleted': '#ef4444',
      '--git-branch': '#fb923c',
      '--scrollbar-thumb': 'rgba(249, 115, 22, 0.12)',
      '--scrollbar-thumb-hover': 'rgba(249, 115, 22, 0.25)',
    },
  },

  'nord-slate': {
    id: 'nord-slate',
    name: 'Nordic Slate',
    category: 'dark',
    isDark: true,
    description: 'Scandinavian arctic night with calming frost cyan accents',
    variables: {
      '--surface': '#1b2028',
      '--surface-subtle': '#151920',
      '--surface-elevated': '#242b35',
      '--surface-hover': '#2d3643',
      '--surface-active': '#273b50',
      '--border': '#2f3846',
      '--border-subtle': '#222933',
      '--border-strong': '#424e62',
      '--text': '#eceff4',
      '--text-subtle': '#c2c9d6',
      '--text-muted': '#7e8a9f',
      '--text-faint': '#535e72',
      '--accent': '#88c0d0',
      '--accent-hover': '#8fbcbb',
      '--accent-active': '#81a1c1',
      '--focus-ring': '#88c0d0',
      '--brand-commito-coral': '#88c0d0',
      '--brand-commito-coral-hover': '#8fbcbb',
      '--git-added': '#a3be8c',
      '--git-modified': '#ebcb8b',
      '--git-deleted': '#bf616a',
      '--git-branch': '#81a1c1',
      '--scrollbar-thumb': 'rgba(136, 192, 208, 0.12)',
      '--scrollbar-thumb-hover': 'rgba(136, 192, 208, 0.25)',
    },
  },

  'dracula-classic': {
    id: 'dracula-classic',
    name: 'Dracula Dark',
    category: 'dark',
    isDark: true,
    description: 'High-contrast vampire dark with iconic magenta pink & purple',
    variables: {
      '--surface': '#1c1c24',
      '--surface-subtle': '#15151c',
      '--surface-elevated': '#252531',
      '--surface-hover': '#2f2f3e',
      '--surface-active': '#3d2338',
      '--border': '#313141',
      '--border-subtle': '#232330',
      '--border-strong': '#49495f',
      '--text': '#f8f8f2',
      '--text-subtle': '#c5c5cf',
      '--text-muted': '#828296',
      '--text-faint': '#545468',
      '--accent': '#ff79c6',
      '--accent-hover': '#ff92d0',
      '--accent-active': '#e667b2',
      '--focus-ring': '#ff79c6',
      '--brand-commito-coral': '#ff79c6',
      '--brand-commito-coral-hover': '#ff92d0',
      '--git-added': '#50fa7b',
      '--git-modified': '#f1fa8c',
      '--git-deleted': '#ff5555',
      '--git-branch': '#bd93f9',
      '--scrollbar-thumb': 'rgba(255, 121, 198, 0.12)',
      '--scrollbar-thumb-hover': 'rgba(255, 121, 198, 0.25)',
    },
  },

  'github-dark': {
    id: 'github-dark',
    name: 'GitHub Dark',
    category: 'dark',
    isDark: true,
    description: 'Official GitHub dark dimmed style with crisp GitHub blue',
    variables: {
      '--surface': '#0d1117',
      '--surface-subtle': '#010409',
      '--surface-elevated': '#161b22',
      '--surface-hover': '#21262d',
      '--surface-active': '#1a2b4c',
      '--border': '#30363d',
      '--border-subtle': '#21262d',
      '--border-strong': '#484f58',
      '--text': '#e6edf3',
      '--text-subtle': '#b1bac4',
      '--text-muted': '#7d8590',
      '--text-faint': '#484f58',
      '--accent': '#2f81f7',
      '--accent-hover': '#58a6ff',
      '--accent-active': '#1f6feb',
      '--focus-ring': '#2f81f7',
      '--brand-commito-coral': '#2f81f7',
      '--brand-commito-coral-hover': '#58a6ff',
      '--git-added': '#3fb950',
      '--git-modified': '#d29922',
      '--git-deleted': '#f85149',
      '--git-branch': '#2f81f7',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.1)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.2)',
    },
  },

  'clean-light': {
    id: 'clean-light',
    name: 'Clean Minimal Light',
    category: 'light',
    isDark: false,
    description: 'Crisp modern light mode with high readability and refined slate surfaces',
    variables: {
      '--surface': '#ffffff',
      '--surface-subtle': '#f8fafc',
      '--surface-elevated': '#f1f5f9',
      '--surface-hover': '#e2e8f0',
      '--surface-active': '#e0e7ff',
      '--border': '#e2e8f0',
      '--border-subtle': '#f1f5f9',
      '--border-strong': '#cbd5e1',
      '--text': '#0f172a',
      '--text-subtle': '#334155',
      '--text-muted': '#64748b',
      '--text-faint': '#94a3b8',
      '--accent': '#4f46e5',
      '--accent-hover': '#6366f1',
      '--accent-active': '#4338ca',
      '--focus-ring': '#4f46e5',
      '--brand-commito-coral': '#4f46e5',
      '--brand-commito-coral-hover': '#6366f1',
      '--git-added': '#16a34a',
      '--git-modified': '#ca8a04',
      '--git-deleted': '#dc2626',
      '--git-branch': '#4f46e5',
      '--scrollbar-thumb': 'rgba(0, 0, 0, 0.12)',
      '--scrollbar-thumb-hover': 'rgba(0, 0, 0, 0.25)',
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
  const theme = THEME_PRESETS[themeId] || THEME_PRESETS['commito-dark'];
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
  const themeDefinition = THEME_PRESETS[theme] || THEME_PRESETS['commito-dark'];

  const isDark = themeDefinition.isDark;

  const setTheme = (themeId: ThemePresetId) => {
    if (!THEME_PRESETS[themeId]) return;
    setThemeState(themeId);
    applyTheme(themeId);
  };

  const setCustomToken = (name: string, value: string) => {
    if (typeof document !== 'undefined' && name) {
      document.documentElement.style.setProperty(name, value);
    }
  };

  const resetTheme = () => {
    setTheme('commito-dark');
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
    [theme, themeDefinition, isDark, availableThemes]
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
