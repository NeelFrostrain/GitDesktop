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
    <div className="space-y-4">
      {/* Theme Selector Toolbar */}
      <div className="flex flex-col space-y-2">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
          <Palette className="inline w-3.5 h-3.5 mr-1" />
          Available Themes
        </label>
        
        {/* Compact Theme Button Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {themeGridItems.map(({ theme, isActive }) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleThemeChange(theme.id)}
              className={`relative px-3 py-2 rounded border text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'border-accent bg-accent/10 text-accent shadow-sm'
                  : 'border-border text-text-muted hover:border-text-muted hover:text-text-subtle bg-surface-subtle'
              }`}
              title={theme.description}
            >
              {/* Color Dot */}
              <div className="flex items-center gap-2 justify-center">
                <div
                  className="w-2 h-2 rounded-full border border-current opacity-70"
                  style={{
                    backgroundColor: theme.variables['--accent'] || '#e05638',
                  }}
                />
                <span className="truncate">{theme.name}</span>
                {isActive && <Check className="w-3 h-3 flex-shrink-0" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Info */}
      <div className="text-xs text-text-muted border-t border-border pt-3">
        💡 Theme preference is saved automatically and applied instantly across the app.
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
