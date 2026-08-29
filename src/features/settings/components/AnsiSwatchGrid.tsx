import React from 'react';
import { SETTINGS_SCHEMA, SettingDefinition } from '../lib/settingsSchema';
import { useSettingsStore } from '../store/useSettingsStore';
import { RotateCcw } from 'lucide-react';

export const AnsiSwatchGrid: React.FC = () => {
  const { getEffectiveValue, setSettingValue, resetSettingValue, isModified } = useSettingsStore();

  const standardAnsi = SETTINGS_SCHEMA.filter(
    (s) =>
      (s.category as string) === 'terminal' &&
      s.subcategory === 'ANSI Colors' &&
      !s.id.includes('Bright')
  );

  const brightAnsi = SETTINGS_SCHEMA.filter(
    (s) =>
      (s.category as string) === 'terminal' &&
      s.subcategory === 'ANSI Colors' &&
      s.id.includes('Bright')
  );

  const renderSwatchRow = (title: string, items: SettingDefinition[]) => {
    return (
      <div className="space-y-2">
        <span className="text-xs font-semibold text-text-secondary tracking-wider uppercase">
          {title}
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {items.map((item) => {
            const val = getEffectiveValue(item.id) || item.default;
            const modified = isModified(item.id);

            return (
              <div
                key={item.id}
                className={`relative p-2 rounded-sm border bg-base-2/80 transition flex items-center justify-between gap-2 group ${modified ? 'border-commito-coral/50 shadow-xs' : 'border-border/80 hover:border-border-strong'
                  }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative flex-shrink-0">
                    <input
                      type="color"
                      value={String(val)}
                      onChange={(e) => setSettingValue(item.id, e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    />
                    <div
                      style={{ backgroundColor: String(val) }}
                      className="w-5 h-5 rounded-sm border border-white/20 shadow-xs cursor-pointer transition transform hover:scale-105"
                      title={`Click to pick color: ${val}`}
                    />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-text-primary truncate">
                      {item.label.replace('ANSI ', '')}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted truncate">
                      {String(val)}
                    </span>
                  </div>
                </div>

                {modified && (
                  <button
                    type="button"
                    onClick={() => resetSettingValue(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-commito-coral hover:bg-base-3 rounded transition cursor-pointer flex-shrink-0"
                    title="Reset color to default"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 bg-base-1 rounded-sm border border-border space-y-5">
      <div>
        <h4 className="text-sm font-semibold text-text-primary">
          Terminal ANSI Color Palette
        </h4>
        <p className="text-xs text-text-muted mt-0.5">
          Customizable 16-color ANSI spectrum applied across terminal commands, Git CLI output, and shell sessions.
        </p>
      </div>

      {renderSwatchRow('Standard 8 Colors', standardAnsi)}
      {renderSwatchRow('Bright 8 Colors', brightAnsi)}
    </div>
  );
};
