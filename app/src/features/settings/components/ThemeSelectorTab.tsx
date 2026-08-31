import React, { useMemo } from 'react';
import { Palette } from 'lucide-react';
import { useTheme, type ThemePresetId } from '../../../shared/theme/ThemeContext';
import { useSettingsStore } from '../store/useSettingsStore';
import { Dropdown, type DropdownOption } from '../../../components/common/Dropdown';

export const ThemeSelectorTab: React.FC = () => {
  const { availableThemes, theme: activeTheme, setTheme } = useTheme();
  const { setSettingValue } = useSettingsStore();

  const handleThemeChange = (themeId: ThemePresetId) => {
    setTheme(themeId);
    setSettingValue('app.theme', themeId).catch(() => {});
  };

  const themeOptions = useMemo<DropdownOption<ThemePresetId>[]>(
    () =>
      availableThemes.map((t) => ({
        value: t.id,
        label: t.name,
        badge: t.isDark ? 'Dark' : 'Light',
        description: t.description,
        icon: (
          <span
            className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20 shrink-0 inline-block shadow-xs"
            style={{ backgroundColor: t.variables['--accent'] || '#e05638' }}
          />
        ),
      })),
    [availableThemes]
  );

  const activeThemeDef = useMemo(
    () => availableThemes.find((t) => t.id === activeTheme) || availableThemes[0],
    [availableThemes, activeTheme]
  );

  const vars = activeThemeDef.variables;
  const bgSurface = vars['--surface'] || '#181818';
  const bgSubtle = vars['--surface-subtle'] || '#131313';
  const bgElevated = vars['--surface-elevated'] || '#201e22';
  const borderColor = vars['--border'] || '#29272b';
  const textColor = vars['--text'] || '#e6e4e8';
  const accentColor = vars['--accent'] || '#e05638';

  return (
    <div className="space-y-4 select-none font-sans">
      {/* ── Theme Selection Row with Dropdown ── */}
      <div className="p-3.5 bg-base-1/60 border border-border rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-commito-coral" />
            <h3 className="text-xs font-semibold text-text-primary">Color Theme</h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xs bg-base-2 border border-border text-text-muted">
              {activeThemeDef.isDark ? 'Dark' : 'Light'}
            </span>
          </div>
          <p className="text-[11.5px] text-text-muted">
            {activeThemeDef.description}
          </p>
        </div>

        {/* Custom Styled Theme Dropdown */}
        <div className="shrink-0 w-60">
          <Dropdown<ThemePresetId>
            options={themeOptions}
            value={activeTheme}
            onChange={handleThemeChange}
            size="sm"
          />
        </div>
      </div>

      {/* ── Single Active Theme Preview Card ── */}
      <div className="p-3.5 bg-base-1/50 border border-border rounded-sm shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-primary">
              {activeThemeDef.name} Live Interface Preview
            </span>
          </div>
          <span className="text-[10.5px] font-mono text-commito-coral font-semibold">
            Active Theme
          </span>
        </div>

        {/* Mini Visual UI Preview Box */}
        <div
          className="w-full h-28 rounded-sm border flex gap-2 overflow-hidden shadow-inner"
          style={{
            backgroundColor: bgSubtle,
            borderColor: borderColor,
          }}
        >
          {/* Mini Sidebar */}
          <div
            className="w-1/4 h-full rounded-xs p-2 flex flex-col gap-1.5 shrink-0"
            style={{ backgroundColor: bgElevated }}
          >
            <div
              className="w-4 h-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <div
              className="w-full h-1 rounded-full opacity-35"
              style={{ backgroundColor: textColor }}
            />
            <div
              className="w-3/4 h-1 rounded-full opacity-20"
              style={{ backgroundColor: textColor }}
            />
            <div
              className="w-2/3 h-1 rounded-full opacity-20"
              style={{ backgroundColor: textColor }}
            />
          </div>

          {/* Mini Main Canvas */}
          <div
            className="flex-1 h-full rounded-xs p-2 flex flex-col justify-between min-w-0"
            style={{ backgroundColor: bgSurface }}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div
                  className="w-12 h-1.5 rounded-full opacity-70"
                  style={{ backgroundColor: textColor }}
                />
                <div
                  className="w-4 h-1.5 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
              <div
                className="w-full h-1 rounded-full opacity-25"
                style={{ backgroundColor: textColor }}
              />
              <div
                className="w-4/5 h-1 rounded-full opacity-15"
                style={{ backgroundColor: textColor }}
              />
            </div>

            {/* Mini Accent Action Pill */}
            <div className="flex items-center justify-between">
              <div
                className="w-8 h-1 rounded-full opacity-20"
                style={{ backgroundColor: textColor }}
              />
              <div
                className="px-2 py-0.5 rounded-xs text-[8px] font-bold text-white shadow-xs"
                style={{ backgroundColor: accentColor }}
              >
                Git Push
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Theme Palette Live Inspector ── */}
      <div className="p-3.5 bg-base-1/40 border border-border/80 rounded-sm space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-text-primary">
            {/* <Eye className="w-3.5 h-3.5 text-commito-coral" /> */}
            <span>Active Color Tokens</span>
          </div>
          <span className="text-[10px] text-text-muted font-mono">
            {activeThemeDef.id}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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
