import React, { createContext, useContext, useMemo, useState } from 'react';

export type ThemePresetId = 'commito-dark' | 'oled-dark' | 'github-dark' | 'gitlab-dark' | 'light';

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
    description: 'Default dark theme with coral accent (default)',
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
  'oled-dark': {
    id: 'oled-dark',
    name: 'OLED Dark',
    isDark: true,
    description: 'Pure black with minimal UI for OLED screens',
    variables: {
      '--surface': '#000000',
      '--surface-subtle': '#050505',
      '--surface-elevated': '#0a0a0a',
      '--surface-hover': '#1a1a1a',
      '--surface-active': '#2a1a1a',
      '--border': '#1a1a1a',
      '--border-subtle': '#0a0a0a',
      '--border-strong': '#2a2a2a',
      '--text': '#ffffff',
      '--text-subtle': '#c0c0c0',
      '--text-muted': '#808080',
      '--text-faint': '#505050',
      '--accent': '#ff6b35',
      '--accent-hover': '#ff7c4d',
      '--accent-active': '#e05020',
      '--focus-ring': '#ff6b35',
      '--brand-commito-coral': '#ff6b35',
      '--brand-commito-coral-hover': '#ff7c4d',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.15)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.3)',
    },
  },
  'github-dark': {
    id: 'github-dark',
    name: 'GitHub Dark',
    isDark: true,
    description: 'GitHub\'s native dark theme aesthetic',
    variables: {
      '--surface': '#0d1117',
      '--surface-subtle': '#010409',
      '--surface-elevated': '#161b22',
      '--surface-hover': '#21262d',
      '--surface-active': '#30363d',
      '--border': '#30363d',
      '--border-subtle': '#1f6feb',
      '--border-strong': '#58a6ff',
      '--text': '#e6edf3',
      '--text-subtle': '#8b949e',
      '--text-muted': '#6e7681',
      '--text-faint': '#484f58',
      '--accent': '#2da44e',
      '--accent-hover': '#30a46c',
      '--accent-active': '#238636',
      '--focus-ring': '#1f6feb',
      '--brand-github-dark-accent': '#1f75cb',
      '--brand-github-dark-success': '#238636',
      '--scrollbar-thumb': 'rgba(110, 118, 129, 0.4)',
      '--scrollbar-thumb-hover': 'rgba(110, 118, 129, 0.6)',
    },
  },
  'gitlab-dark': {
    id: 'gitlab-dark',
    name: 'GitLab Dark',
    isDark: true,
    description: 'GitLab\'s branded dark theme',
    variables: {
      '--surface': '#1f1f1f',
      '--surface-subtle': '#17191c',
      '--surface-elevated': '#2a2a2a',
      '--surface-hover': '#35353a',
      '--surface-active': '#403a45',
      '--border': '#2a2a2a',
      '--border-subtle': '#35353a',
      '--border-strong': '#404040',
      '--text': '#e4e4e7',
      '--text-subtle': '#a1a1a6',
      '--text-muted': '#757580',
      '--text-faint': '#5a5a61',
      '--accent': '#1f75cb',
      '--accent-hover': '#2d86de',
      '--accent-active': '#1560a8',
      '--focus-ring': '#1f75cb',
      '--brand-gitlab-blue': '#1f75cb',
      '--brand-gitlab-orange': '#e05638',
      '--scrollbar-thumb': 'rgba(255, 255, 255, 0.12)',
      '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.24)',
    },
  },
  light: {
    id: 'light',
    name: 'Light',
    isDark: false,
    description: 'Clean light theme for daytime use',
    variables: {
      '--surface': '#ffffff',
      '--surface-subtle': '#f8f8f8',
      '--surface-elevated': '#f0f0f0',
      '--surface-hover': '#e8e8e8',
      '--surface-active': '#dcdcdc',
      '--border': '#d0d0d0',
      '--border-subtle': '#e5e5e5',
      '--border-strong': '#b8b8b8',
      '--text': '#1a1a1a',
      '--text-subtle': '#505050',
      '--text-muted': '#808080',
      '--text-faint': '#a8a8a8',
      '--accent': '#e05638',
      '--accent-hover': '#f06344',
      '--accent-active': '#c74327',
      '--focus-ring': '#e05638',
      '--brand-commito-coral': '#e05638',
      '--brand-commito-coral-hover': '#f06344',
      '--scrollbar-thumb': 'rgba(0, 0, 0, 0.2)',
      '--scrollbar-thumb-hover': 'rgba(0, 0, 0, 0.35)',
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
