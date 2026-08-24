import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

export type ThemePresetId = 'commito-dark' | 'commito-light' | 'oled-dark' | 'github-dark' | 'gitlab-dark';

export interface ThemeDefinition {
  id: ThemePresetId;
  name: string;
  isDark: boolean;
  variables: Record<string, string>;
}

export const THEME_PRESETS: Record<ThemePresetId, ThemeDefinition> = {
  'commito-dark': {
    id: 'commito-dark',
    name: 'Commito Dark (Default)',
    isDark: true,
    variables: {
      '--surface': '#171619',
      '--surface-subtle': '#121113',
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
      '--text-disabled': '#5c5863',
      '--text-on-accent': '#ffffff',
      '--accent': '#e05638',
      '--accent-hover': '#f06344',
      '--accent-active': '#c74327',
      '--accent-muted': 'rgba(224, 86, 56, 0.15)',
      '--focus-ring': '#e05638',
      '--success': '#22c55e',
      '--warning': '#eab308',
      '--danger': '#ef4444',
      '--info': '#3b82f6',
      '--app-bg-primary': '#171619',
      '--app-bg-secondary': '#121113',
      '--app-bg-tertiary': '#201e22',
      '--app-bg-elevated': '#201e22',
      '--app-surface-hover': '#2b292f',
      '--app-surface-active': '#382221',
      '--app-border': '#29272b',
      '--app-border-subtle': '#201e22',
      '--app-border-strong': '#3d3a42',
      '--app-text-primary': '#e6e4e8',
      '--app-text-secondary': '#b3b0b8',
      '--app-text-muted': '#85818c',
      '--app-text-faint': '#5c5863',
      '--app-text-disabled': '#5c5863',
      '--app-text-on-accent': '#ffffff',
      '--app-accent': '#e05638',
      '--app-accent-hover': '#f06344',
      '--app-accent-active': '#c74327',
      '--app-accent-muted': 'rgba(224, 86, 56, 0.15)',
      '--app-focus-ring': '#e05638',
      '--brand-commito-coral': '#e05638',
      '--brand-commito-coral-hover': '#f06344',
      '--brand-commito-active-bg': '#382221',
      '--brand-commito-active-text': '#f5a494',
      '--scrollbar-thumb': '#36353d',
      '--scrollbar-thumb-hover': '#46454e',
      '--scrollbar-track': 'transparent',
      '--terminal-bg': '#121113',
      '--terminal-fg': '#e6e4e8',
    },
  },
  'oled-dark': {
    id: 'oled-dark',
    name: 'OLED Pure Black',
    isDark: true,
    variables: {
      '--surface': '#0a0a0a',
      '--surface-subtle': '#000000',
      '--surface-elevated': '#141414',
      '--surface-hover': '#1f1f1f',
      '--surface-active': '#2d1a19',
      '--border': '#202020',
      '--border-subtle': '#141414',
      '--border-strong': '#333333',
      '--text': '#f0f0f0',
      '--text-subtle': '#b0b0b0',
      '--text-muted': '#787878',
      '--text-faint': '#505050',
      '--text-disabled': '#505050',
      '--text-on-accent': '#ffffff',
      '--accent': '#e05638',
      '--accent-hover': '#f06344',
      '--accent-active': '#c74327',
      '--accent-muted': 'rgba(224, 86, 56, 0.15)',
      '--focus-ring': '#e05638',
      '--success': '#22c55e',
      '--warning': '#eab308',
      '--danger': '#ef4444',
      '--info': '#3b82f6',
      '--app-bg-primary': '#0a0a0a',
      '--app-bg-secondary': '#000000',
      '--app-bg-tertiary': '#141414',
      '--app-bg-elevated': '#141414',
      '--app-surface-hover': '#1f1f1f',
      '--app-surface-active': '#2d1a19',
      '--app-border': '#202020',
      '--app-border-subtle': '#141414',
      '--app-border-strong': '#333333',
      '--app-text-primary': '#f0f0f0',
      '--app-text-secondary': '#b0b0b0',
      '--app-text-muted': '#787878',
      '--app-text-faint': '#505050',
      '--app-text-disabled': '#505050',
      '--app-text-on-accent': '#ffffff',
      '--app-accent': '#e05638',
      '--app-accent-hover': '#f06344',
      '--app-accent-active': '#c74327',
      '--app-accent-muted': 'rgba(224, 86, 56, 0.15)',
      '--app-focus-ring': '#e05638',
      '--brand-commito-coral': '#e05638',
      '--brand-commito-coral-hover': '#f06344',
      '--brand-commito-active-bg': '#2d1a19',
      '--brand-commito-active-text': '#f5a494',
      '--scrollbar-thumb': '#282828',
      '--scrollbar-thumb-hover': '#383838',
      '--scrollbar-track': 'transparent',
      '--terminal-bg': '#000000',
      '--terminal-fg': '#f0f0f0',
    },
  },
  'commito-light': {
    id: 'commito-light',
    name: 'Commito Light',
    isDark: false,
    variables: {
      '--surface': '#ffffff',
      '--surface-subtle': '#f6f8fa',
      '--surface-elevated': '#ffffff',
      '--surface-hover': '#f1f3f5',
      '--surface-active': '#faebe7',
      '--border': '#d0d7de',
      '--border-subtle': '#e1e4e8',
      '--border-strong': '#afb8c1',
      '--text': '#1f2328',
      '--text-subtle': '#4b5563',
      '--text-muted': '#6e7781',
      '--text-faint': '#8c959f',
      '--text-disabled': '#8c959f',
      '--text-on-accent': '#ffffff',
      '--accent': '#e05638',
      '--accent-hover': '#cf4325',
      '--accent-active': '#b8381e',
      '--accent-muted': 'rgba(224, 86, 56, 0.12)',
      '--focus-ring': '#e05638',
      '--success': '#1a7f37',
      '--warning': '#9a6700',
      '--danger': '#cf222e',
      '--info': '#0969da',
      '--app-bg-primary': '#ffffff',
      '--app-bg-secondary': '#f6f8fa',
      '--app-bg-tertiary': '#eaeef2',
      '--app-bg-elevated': '#ffffff',
      '--app-surface-hover': '#f1f3f5',
      '--app-surface-active': '#faebe7',
      '--app-border': '#d0d7de',
      '--app-border-subtle': '#e1e4e8',
      '--app-border-strong': '#afb8c1',
      '--app-text-primary': '#1f2328',
      '--app-text-secondary': '#4b5563',
      '--app-text-muted': '#6e7781',
      '--app-text-faint': '#8c959f',
      '--app-text-disabled': '#8c959f',
      '--app-text-on-accent': '#ffffff',
      '--app-accent': '#e05638',
      '--app-accent-hover': '#cf4325',
      '--app-accent-active': '#b8381e',
      '--app-accent-muted': 'rgba(224, 86, 56, 0.12)',
      '--app-focus-ring': '#e05638',
      '--brand-commito-coral': '#e05638',
      '--brand-commito-coral-hover': '#cf4325',
      '--brand-commito-active-bg': '#faebe7',
      '--brand-commito-active-text': '#cf4325',
      '--scrollbar-thumb': '#c1c9d2',
      '--scrollbar-thumb-hover': '#a0abb6',
      '--scrollbar-track': '#f6f8fa',
      '--terminal-bg': '#1e1e24',
      '--terminal-fg': '#e6e4e8',
    },
  },
  'github-dark': {
    id: 'github-dark',
    name: 'GitHub Dark',
    isDark: true,
    variables: {
      '--surface': '#0d1117',
      '--surface-subtle': '#010409',
      '--surface-elevated': '#161b22',
      '--surface-hover': '#21262d',
      '--surface-active': '#1f2c3f',
      '--border': '#30363d',
      '--border-subtle': '#21262d',
      '--border-strong': '#484f58',
      '--text': '#e6edf3',
      '--text-subtle': '#8d96a0',
      '--text-muted': '#7d8590',
      '--text-faint': '#656c76',
      '--text-disabled': '#656c76',
      '--text-on-accent': '#ffffff',
      '--accent': '#1f75cb',
      '--accent-hover': '#388bfd',
      '--accent-active': '#1a65b0',
      '--accent-muted': 'rgba(31, 117, 203, 0.15)',
      '--focus-ring': '#1f75cb',
      '--success': '#238636',
      '--warning': '#d29922',
      '--danger': '#f85149',
      '--info': '#58a6ff',
      '--app-bg-primary': '#0d1117',
      '--app-bg-secondary': '#010409',
      '--app-bg-tertiary': '#161b22',
      '--app-bg-elevated': '#161b22',
      '--app-surface-hover': '#21262d',
      '--app-surface-active': '#1f2c3f',
      '--app-border': '#30363d',
      '--app-border-subtle': '#21262d',
      '--app-border-strong': '#484f58',
      '--app-text-primary': '#e6edf3',
      '--app-text-secondary': '#8d96a0',
      '--app-text-muted': '#7d8590',
      '--app-text-faint': '#656c76',
      '--app-text-disabled': '#656c76',
      '--app-text-on-accent': '#ffffff',
      '--app-accent': '#1f75cb',
      '--app-accent-hover': '#388bfd',
      '--app-accent-active': '#1a65b0',
      '--app-accent-muted': 'rgba(31, 117, 203, 0.15)',
      '--app-focus-ring': '#1f75cb',
      '--brand-commito-coral': '#1f75cb',
      '--brand-commito-coral-hover': '#388bfd',
      '--brand-commito-active-bg': '#1f2c3f',
      '--brand-commito-active-text': '#79c0ff',
      '--scrollbar-thumb': '#30363d',
      '--scrollbar-thumb-hover': '#484f58',
      '--scrollbar-track': 'transparent',
      '--terminal-bg': '#0d1117',
      '--terminal-fg': '#e6edf3',
    },
  },
  'gitlab-dark': {
    id: 'gitlab-dark',
    name: 'GitLab Dark',
    isDark: true,
    variables: {
      '--surface': '#18171d',
      '--surface-subtle': '#111015',
      '--surface-elevated': '#222129',
      '--surface-hover': '#2d2b37',
      '--surface-active': '#3e2825',
      '--border': '#2e2b3b',
      '--border-subtle': '#222129',
      '--border-strong': '#444055',
      '--text': '#ececef',
      '--text-subtle': '#a2a0ab',
      '--text-muted': '#797687',
      '--text-faint': '#585565',
      '--text-disabled': '#585565',
      '--text-on-accent': '#ffffff',
      '--accent': '#e24329',
      '--accent-hover': '#fc6d26',
      '--accent-active': '#c7351d',
      '--accent-muted': 'rgba(226, 67, 41, 0.15)',
      '--focus-ring': '#e24329',
      '--success': '#108548',
      '--warning': '#c17d10',
      '--danger': '#dd2b0e',
      '--info': '#1f75cb',
      '--app-bg-primary': '#18171d',
      '--app-bg-secondary': '#111015',
      '--app-bg-tertiary': '#222129',
      '--app-bg-elevated': '#222129',
      '--app-surface-hover': '#2d2b37',
      '--app-surface-active': '#3e2825',
      '--app-border': '#2e2b3b',
      '--app-border-subtle': '#222129',
      '--app-border-strong': '#444055',
      '--app-text-primary': '#ececef',
      '--app-text-secondary': '#a2a0ab',
      '--app-text-muted': '#797687',
      '--app-text-faint': '#585565',
      '--app-text-disabled': '#585565',
      '--app-text-on-accent': '#ffffff',
      '--app-accent': '#e24329',
      '--app-accent-hover': '#fc6d26',
      '--app-accent-active': '#c7351d',
      '--app-accent-muted': 'rgba(226, 67, 41, 0.15)',
      '--app-focus-ring': '#e24329',
      '--brand-commito-coral': '#e24329',
      '--brand-commito-coral-hover': '#fc6d26',
      '--brand-commito-active-bg': '#3e2825',
      '--brand-commito-active-text': '#fc8f58',
      '--scrollbar-thumb': '#363345',
      '--scrollbar-thumb-hover': '#4c4860',
      '--scrollbar-track': 'transparent',
      '--terminal-bg': '#111015',
      '--terminal-fg': '#ececef',
    },
  },
};

const THEME_STORAGE_KEY = 'git-desktop-theme-preset';

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

export function ThemeProvider({ children, defaultTheme = 'commito-dark' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemePresetId>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemePresetId;
        if (stored && THEME_PRESETS[stored]) {
          return stored;
        }
      } catch {
        // LocalStorage access may fail in private contexts
      }
    }
    return defaultTheme;
  });

  const applyThemeVariables = useCallback((themeId: ThemePresetId) => {
    if (typeof document === 'undefined') return;

    const preset = THEME_PRESETS[themeId] || THEME_PRESETS['commito-dark'];
    const root = document.documentElement;

    Object.entries(preset.variables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    root.setAttribute('data-theme', themeId);
    root.setAttribute('data-color-scheme', preset.isDark ? 'dark' : 'light');
  }, []);

  const setTheme = useCallback((themeId: ThemePresetId) => {
    if (!THEME_PRESETS[themeId]) return;
    setThemeState(themeId);
    applyThemeVariables(themeId);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch {
      // Ignore storage errors
    }
  }, [applyThemeVariables]);

  const setCustomToken = useCallback((name: string, value: string) => {
    if (typeof document === 'undefined' || !name) return;
    document.documentElement.style.setProperty(name, value);
  }, []);

  const resetTheme = useCallback(() => {
    setTheme('commito-dark');
  }, [setTheme]);

  // Apply on mount and theme change
  useEffect(() => {
    applyThemeVariables(theme);
  }, [theme, applyThemeVariables]);

  const themeDefinition = useMemo(() => THEME_PRESETS[theme] || THEME_PRESETS['commito-dark'], [theme]);
  const availableThemes = useMemo(() => Object.values(THEME_PRESETS), []);

  const value = useMemo<ThemeContextType>(() => ({
    theme,
    themeDefinition,
    isDark: themeDefinition.isDark,
    setTheme,
    setCustomToken,
    resetTheme,
    availableThemes,
  }), [theme, themeDefinition, setTheme, setCustomToken, resetTheme, availableThemes]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
