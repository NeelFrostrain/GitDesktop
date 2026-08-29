import React, { useMemo } from 'react';
import { Check, Palette } from 'lucide-react';
import { useTheme, type ThemePresetId } from '../../../shared/theme/ThemeContext';
import { useSettingsStore } from '../store/useSettingsStore';

/**
 * Theme selector component displaying all available theme variants
 * with live preview and persistence.
 */
export const ThemeSelectorTab: React.FC = () => {
  const { availableThemes, theme: activeTheme, setTheme } = useTheme();
  const { setSettingValue } = useSettingsStore();

  const handleThemeChange = (themeId: ThemePresetId) => {
    setTheme(themeId);
    setSettingValue('app.theme', themeId).catch(() => {});
  };

  const themeGridItems = useMemo(
    () =>
      availableThemes.map((theme) => ({
        theme,
        isActive: theme.id === activeTheme,
      })),
    [availableThemes, activeTheme]
  );

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-commito-coral" />
          <h3 className="text-sm font-semibold text-text-primary">Color Themes</h3>
        </div>
        <p className="text-xs text-text-muted">
          Select a theme to customize the app appearance. Changes apply instantly.
        </p>
      </div>

      {/* Theme Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {themeGridItems.map(({ theme, isActive }) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => handleThemeChange(theme.id)}
            className={`relative p-4 rounded-sm border-2 transition-all cursor-pointer group ${
              isActive
                ? 'border-commito-coral bg-base-2/50 shadow-lg'
                : 'border-border hover:border-border-strong bg-base-1 hover:bg-base-2'
            }`}
          >
            {/* Theme Preview Swatch */}
            <div className="flex gap-2 mb-3">
              <div
                className="w-6 h-6 rounded-sm border border-border"
                style={{
                  backgroundColor:
                    theme.variables['--surface'] ||
                    theme.variables['--surface'] ||
                    '#181818',
                }}
                title="Surface color"
              />
              <div
                className="w-6 h-6 rounded-sm border border-border"
                style={{
                  backgroundColor:
                    theme.variables['--accent'] || theme.variables['--accent'] || '#e05638',
                }}
                title="Accent color"
              />
              <div
                className="w-6 h-6 rounded-sm border border-border"
                style={{
                  backgroundColor:
                    theme.variables['--text'] || theme.variables['--text'] || '#e6e4e8',
                }}
                title="Text color"
              />
            </div>

            {/* Theme Info */}
            <div className="text-left space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-text-primary">{theme.name}</h4>
                {isActive && (
                  <Check className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-text-muted leading-tight">{theme.description}</p>
            </div>

            {/* Badge */}
            <div className="mt-2 flex items-center gap-1">
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-xs ${
                  theme.isDark
                    ? 'bg-base-3 text-text-muted'
                    : 'bg-yellow-300/20 text-yellow-100'
                }`}
              >
                {theme.isDark ? '🌙 Dark' : '☀️ Light'}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Info Box */}
      <div className="p-3 rounded-sm border border-border/50 bg-base-1/30 space-y-2">
        <p className="text-xs text-text-muted">
          <strong>💡 Tip:</strong> Your theme preference is saved automatically. Try OLED Dark for
          maximum power savings on OLED displays.
        </p>
      </div>

      {/* Live Preview Section */}
      <div className="space-y-3 pt-4 border-t border-border">
        <h4 className="text-xs font-semibold text-text-primary">Preview</h4>

        <div className="grid grid-cols-2 gap-3">
          {/* Sample Button */}
          <div className="space-y-2">
            <p className="text-[10px] text-text-muted uppercase font-semibold">Button Styles</p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                className="h-7 px-2 rounded-sm bg-commito-coral hover:bg-commito-coral-hover text-text-on-accent text-xs font-semibold transition"
              >
                Primary
              </button>
              <button
                type="button"
                className="h-7 px-2 rounded-sm bg-base-2 hover:bg-base-3 border border-border text-text-primary text-xs font-semibold transition"
              >
                Secondary
              </button>
            </div>
          </div>

          {/* Sample Cards */}
          <div className="space-y-2">
            <p className="text-[10px] text-text-muted uppercase font-semibold">Card Surfaces</p>
            <div className="flex flex-col gap-1.5">
              <div className="h-7 px-2 rounded-sm bg-base-1 border border-border flex items-center text-[10px] text-text-primary">
                Elevated
              </div>
              <div className="h-7 px-2 rounded-sm bg-surface border border-border flex items-center text-[10px] text-text-muted">
                Base Surface
              </div>
            </div>
          </div>
        </div>

        {/* Color Palette */}
        <div className="space-y-2">
          <p className="text-[10px] text-text-muted uppercase font-semibold">Semantic Colors</p>
          <div className="flex gap-1.5">
            <div
              className="h-6 w-6 rounded-sm border border-border"
              title="Success"
              style={{ backgroundColor: 'var(--success)' }}
            />
            <div
              className="h-6 w-6 rounded-sm border border-border"
              title="Warning"
              style={{ backgroundColor: 'var(--warning)' }}
            />
            <div
              className="h-6 w-6 rounded-sm border border-border"
              title="Danger"
              style={{ backgroundColor: 'var(--danger)' }}
            />
            <div
              className="h-6 w-6 rounded-sm border border-border"
              title="Info"
              style={{ backgroundColor: 'var(--info)' }}
            />
            <div
              className="h-6 w-6 rounded-sm border border-border"
              title="Git Added"
              style={{ backgroundColor: 'var(--git-added)' }}
            />
            <div
              className="h-6 w-6 rounded-sm border border-border"
              title="Git Removed"
              style={{ backgroundColor: 'var(--git-removed)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
