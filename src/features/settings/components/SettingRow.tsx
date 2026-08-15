import React from 'react';
import { SettingDefinition } from '../lib/settingsSchema';
import { useSettingsStore } from '../store/useSettingsStore';
import { RotateCcw } from 'lucide-react';

interface SettingRowProps {
  setting: SettingDefinition;
}

export const SettingRow: React.FC<SettingRowProps> = ({ setting }) => {
  const { getEffectiveValue, setSettingValue, resetSettingValue, isModified } = useSettingsStore();

  const value = getEffectiveValue(setting.id);
  const modified = isModified(setting.id);

  const renderControl = () => {
    switch (setting.type) {
      case 'color': {
        const hex = String(value || setting.default);
        return (
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="color"
                value={hex.startsWith('#') ? hex : '#ffffff'}
                onChange={(e) => setSettingValue(setting.id, e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
              />
              <div
                style={{ backgroundColor: hex }}
                className="w-7 h-7 rounded-md border border-border shadow-xs cursor-pointer transition transform hover:scale-105"
                title={`Click to pick color: ${hex}`}
              />
            </div>
            <input
              type="text"
              value={hex}
              onChange={(e) => setSettingValue(setting.id, e.target.value)}
              className="w-28 px-2.5 py-1 bg-base-2 border border-border rounded-md text-xs font-mono text-text-primary focus:outline-none focus:border-commito-coral"
              placeholder="#000000"
            />
          </div>
        );
      }

      case 'number': {
        const num = typeof value === 'number' ? value : Number(setting.default);
        return (
          <div className="flex items-center gap-3 w-48">
            <input
              type="range"
              min={setting.min ?? 0}
              max={setting.max ?? 100}
              step={setting.step ?? 1}
              value={num}
              onChange={(e) => setSettingValue(setting.id, parseFloat(e.target.value))}
              className="flex-1 accent-commito-coral cursor-pointer h-1.5 bg-base-3 rounded-md"
            />
            <div className="flex items-center gap-1 min-w-[50px] justify-end">
              <input
                type="number"
                min={setting.min}
                max={setting.max}
                step={setting.step}
                value={num}
                onChange={(e) => setSettingValue(setting.id, parseFloat(e.target.value) || 0)}
                className="w-14 px-1.5 py-1 bg-base-2 border border-border rounded-md text-xs font-mono text-text-primary text-right focus:outline-none focus:border-commito-coral"
              />
              {setting.unit && (
                <span className="text-[11px] font-mono text-text-muted select-none">
                  {setting.unit}
                </span>
              )}
            </div>
          </div>
        );
      }

      case 'select': {
        return (
          <select
            value={String(value ?? setting.default)}
            onChange={(e) => setSettingValue(setting.id, e.target.value)}
            className="px-3 py-1.5 bg-base-2 border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-commito-coral cursor-pointer max-w-[220px]"
          >
            {setting.options?.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-base-2 text-text-primary">
                {opt.label}
              </option>
            ))}
          </select>
        );
      }

      case 'boolean': {
        const checked = Boolean(value ?? setting.default);
        return (
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => setSettingValue(setting.id, !checked)}
            className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${checked ? 'bg-commito-coral' : 'bg-base-3 border border-border'
              }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'
                }`}
            />
          </button>
        );
      }

      case 'text':
      default: {
        return (
          <input
            type="text"
            value={String(value ?? setting.default)}
            onChange={(e) => setSettingValue(setting.id, e.target.value)}
            className="w-64 px-2.5 py-1 bg-base-2 border border-border rounded-md text-xs text-text-primary font-mono focus:outline-none focus:border-commito-coral"
          />
        );
      }
    }
  };

  return (
    <div
      className={`p-3.5 rounded-md border transition flex flex-col md:flex-row md:items-center justify-between gap-4 group ${modified
        ? 'bg-base-1/90 border-commito-coral/30 shadow-xs'
        : 'bg-base-1/60 border-border hover:border-border-strong hover:bg-base-1/90'
        }`}
    >
      {/* Left: Label, Description, Badges */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-xs text-text-primary">
            {setting.label}
          </span>

          {modified && (
            <span className="px-1.5 py-0.2 bg-commito-coral/20 text-commito-coral text-[9px] font-semibold rounded uppercase tracking-wider">
              Modified
            </span>
          )}

          {setting.scope === 'repo' && (
            <span className="px-1.5 py-0.2 bg-base-3 text-text-muted text-[9px] font-medium rounded uppercase tracking-wider border border-border">
              Repo
            </span>
          )}

          {setting.cssVar && (
            <code className="text-[10px] font-mono text-text-muted/80 bg-base-2 px-1 rounded border border-border/50">
              {setting.cssVar}
            </code>
          )}
        </div>

        <p className="text-xs text-text-muted mt-1 leading-relaxed">
          {setting.description}
        </p>
      </div>

      {/* Right: Control Widget & Reset Button */}
      <div className="flex items-center gap-2.5 self-start md:self-center flex-shrink-0">
        {renderControl()}

        {modified && (
          <button
            type="button"
            onClick={() => resetSettingValue(setting.id)}
            className="p-1.5 text-text-muted hover:text-commito-coral hover:bg-base-2 rounded-md border border-transparent hover:border-border transition cursor-pointer"
            title={`Reset "${setting.label}" to default (${setting.default})`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
