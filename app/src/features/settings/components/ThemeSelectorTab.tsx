import React, { useState, useMemo } from 'react';
import { Check, Eye } from 'lucide-react';
import { useTheme, type ThemePresetId } from '../../../shared/theme/ThemeContext';
import { useSettingsStore } from '../store/useSettingsStore';

type ThemeFilter = 'all' | 'dark' | 'light';

export const ThemeSelectorTab: React.FC = () => {
  const { availableThemes, theme: activeTheme, setTheme } = useTheme();
  const { setSettingValue } = useSettingsStore();
  const [filter] = useState<ThemeFilter>('all');

  const handleThemeChange = (themeId: ThemePresetId) => {
    setTheme(themeId);
    setSettingValue('app.theme', themeId).catch(() => {});
  };

  const filteredThemes = useMemo(() => {
    if (filter === 'dark') return availableThemes.filter((t) => t.isDark);
    if (filter === 'light') return availableThemes.filter((t) => !t.isDark);
    return availableThemes;
  }, [availableThemes, filter]);

  const activeThemeDef = useMemo(
    () => availableThemes.find((t) => t.id === activeTheme) || availableThemes[0],
    [availableThemes, activeTheme]
  );

  return (
    <div className="space-y-5 select-none font-sans">
      {/* ── Top Header & Filter Toolbar ── */}

      {/* ── Theme Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredThemes.map((theme) => {
          const isActive = theme.id === activeTheme;
          const vars = theme.variables;
          const bgSurface = vars['--surface'] || '#181818';
          const bgSubtle = vars['--surface-subtle'] || '#131313';
          const bgElevated = vars['--surface-elevated'] || '#201e22';
          const borderColor = vars['--border'] || '#29272b';
          const textColor = vars['--text'] || '#e6e4e8';
          const accentColor = vars['--accent'] || '#e05638';

          return (
            <div
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className={`group relative rounded-sm border transition-all duration-150 cursor-pointer overflow-hidden p-3 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] ${
                isActive
                  ? 'border-commito-coral bg-base-1/90 shadow-[0_0_12px_rgba(224,86,56,0.15)] ring-1 ring-commito-coral/50'
                  : 'border-border/80 hover:border-border-strong bg-base-1/50 hover:bg-base-1/80'
              }`}
            >
              {/* Top Row: Mini Visual UI Preview Box */}
              <div
                className="w-full h-18 rounded-sm border p-1.5 flex gap-1.5 overflow-hidden transition-transform duration-200 group-hover:scale-[1.01]"
                style={{
                  backgroundColor: bgSubtle,
                  borderColor: borderColor,
                }}
              >
                {/* Mini Sidebar */}
                <div
                  className="w-1/4 h-full rounded-xs p-1 flex flex-col gap-1 shrink-0"
                  style={{ backgroundColor: bgElevated }}
                >
                  <div
                    className="w-2.5 h-1 rounded-full"
                    style={{ backgroundColor: accentColor }}
                  />
                  <div
                    className="w-full h-0.5 rounded-full opacity-30"
                    style={{ backgroundColor: textColor }}
                  />
                  <div
                    className="w-3/4 h-0.5 rounded-full opacity-20"
                    style={{ backgroundColor: textColor }}
                  />
                  <div
                    className="w-2/3 h-0.5 rounded-full opacity-20"
                    style={{ backgroundColor: textColor }}
                  />
                </div>

                {/* Mini Main Canvas */}
                <div
                  className="flex-1 h-full rounded-xs p-1.5 flex flex-col justify-between min-w-0"
                  style={{ backgroundColor: bgSurface }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div
                        className="w-8 h-1 rounded-full opacity-70"
                        style={{ backgroundColor: textColor }}
                      />
                      <div
                        className="w-3 h-1 rounded-full"
                        style={{ backgroundColor: accentColor }}
                      />
                    </div>
                    <div
                      className="w-full h-0.5 rounded-full opacity-20"
                      style={{ backgroundColor: textColor }}
                    />
                    <div
                      className="w-4/5 h-0.5 rounded-full opacity-15"
                      style={{ backgroundColor: textColor }}
                    />
                  </div>

                  {/* Mini Accent Action Pill */}
                  <div className="flex items-center justify-end">
                    <div
                      className="px-1.5 py-0.2 rounded-xs text-[7px] font-bold text-white shadow-xs"
                      style={{ backgroundColor: accentColor }}
                    >
                      Git
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Theme Info & Status */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-white/10"
                      style={{ backgroundColor: accentColor }}
                    />
                    <span className="text-xs font-semibold text-text-primary truncate">
                      {theme.name}
                    </span>
                  </div>

                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-commito-coral bg-commito-coral/10 px-1.5 py-0.2 rounded-full border border-commito-coral/30 shrink-0">
                      <Check className="w-2.5 h-2.5" />
                      Active
                    </span>
                  ) : (
                    <span className="text-[9.5px] font-mono text-text-muted px-1.5 py-0.2 rounded-sm bg-base-2 border border-border shrink-0">
                      {theme.isDark ? 'Dark' : 'Light'}
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-text-muted line-clamp-1 leading-tight">
                  {theme.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Active Theme Palette Live Inspector ── */}
      <div className="p-3.5 bg-base-1/40 border border-border/80 rounded-sm space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-text-primary">
            <Eye className="w-3.5 h-3.5 text-commito-coral" />
            <span>Active Theme Color Tokens ({activeThemeDef.name})</span>
          </div>
          <span className="text-[10.5px] text-text-muted font-mono">
            Persistent in local settings
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <div className="p-2 rounded-sm bg-base-2/60 border border-border space-y-1">
            <div className="text-[9.5px] font-mono text-text-muted">Canvas Surface</div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3.5 h-3.5 rounded-xs border border-border"
                style={{ backgroundColor: 'var(--surface)' }}
              />
              <span className="text-[10px] font-mono text-text-primary">Surface</span>
            </div>
          </div>

          <div className="p-2 rounded-sm bg-base-2/60 border border-border space-y-1">
            <div className="text-[9.5px] font-mono text-text-muted">Sidebar Surface</div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3.5 h-3.5 rounded-xs border border-border"
                style={{ backgroundColor: 'var(--surface-subtle)' }}
              />
              <span className="text-[10px] font-mono text-text-primary">Subtle</span>
            </div>
          </div>

          <div className="p-2 rounded-sm bg-base-2/60 border border-border space-y-1">
            <div className="text-[9.5px] font-mono text-text-muted">Elevated Card</div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3.5 h-3.5 rounded-xs border border-border"
                style={{ backgroundColor: 'var(--surface-elevated)' }}
              />
              <span className="text-[10px] font-mono text-text-primary">Elevated</span>
            </div>
          </div>

          <div className="p-2 rounded-sm bg-base-2/60 border border-border space-y-1">
            <div className="text-[9.5px] font-mono text-text-muted">Brand Accent</div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3.5 h-3.5 rounded-xs border border-border"
                style={{ backgroundColor: 'var(--accent)' }}
              />
              <span className="text-[10px] font-mono text-commito-coral font-bold">Accent</span>
            </div>
          </div>

          <div className="p-2 rounded-sm bg-base-2/60 border border-border space-y-1">
            <div className="text-[9.5px] font-mono text-text-muted">Git Added</div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3.5 h-3.5 rounded-xs border border-border"
                style={{ backgroundColor: 'var(--git-added)' }}
              />
              <span className="text-[10px] font-mono text-emerald-400 font-medium">Added</span>
            </div>
          </div>

          <div className="p-2 rounded-sm bg-base-2/60 border border-border space-y-1">
            <div className="text-[9.5px] font-mono text-text-muted">Git Modified</div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3.5 h-3.5 rounded-xs border border-border"
                style={{ backgroundColor: 'var(--git-modified)' }}
              />
              <span className="text-[10px] font-mono text-amber-400 font-medium">Modified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
