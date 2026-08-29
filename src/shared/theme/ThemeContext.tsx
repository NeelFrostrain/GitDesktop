import React, { createContext, useContext, useMemo } from 'react';

export type ThemePresetId =
  'commito-dark' | 'commito-light' | 'oled-dark' | 'github-dark' | 'gitlab-dark';

export interface ThemeDefinition {
  id: ThemePresetId;
  name: string;
  isDark: boolean;
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

export function ThemeProvider({ children }: ThemeProviderProps) {
  const isDark = true;
  const theme: ThemePresetId = 'commito-dark';

  const themeDefinition: ThemeDefinition = useMemo(
    () => ({
      id: 'commito-dark',
      name: 'Default Theme',
      isDark: true,
      variables: {},
    }),
    []
  );

  const setTheme = () => {};
  const setCustomToken = (name: string, value: string) => {
    if (typeof document !== 'undefined' && name) {
      document.documentElement.style.setProperty(name, value);
    }
  };
  const resetTheme = () => {};
  const availableThemes = useMemo(() => [themeDefinition], [themeDefinition]);

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
    [themeDefinition, availableThemes]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
