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
            <div className="relative flex-shrink-0">
              <input
                type="color"
                value={hex.startsWith('#') ? hex : '#ffffff'}
                onChange={(e) => setSettingValue(setting.id, e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
              />
              <div
                style={{ backgroundColor: hex }}
                className="w-6 h-6 rounded-xs border border-border/80 shadow-xs cursor-pointer transition hover:scale-105"
                title={`Click to pick color: ${hex}`}
              />
            </div>
            <input
              type="text"
              value={hex}
              onChange={(e) => setSettingValue(setting.id, e.target.value)}
              className="w-24 h-7 px-2 bg-base-2 border border-border/70 hover:border-border-strong rounded-xs text-[11.5px] font-mono text-text-primary focus:outline-none focus:border-border-strong transition"
              placeholder="#000000"
            />
          </div>
        );
      }

      case 'number': {
        const num = typeof value === 'number' ? value : Number(setting.default);
        const isUiScale = setting.id === 'app.ui_scale';
        const presets = isUiScale ? [80, 90, 100, 110, 120] : null;

        return (
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2.5">
            {presets && (
              <div className="flex items-center gap-0.5 bg-base-2/80 p-0.5 rounded-sm border border-border/70">
                {presets.map((preset) => {
                  const isSelected = Math.round(num) === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSettingValue(setting.id, preset)}
                      className={`px-2 py-0.5 rounded-xs text-[10.5px] font-mono font-medium transition cursor-pointer ${
                        isSelected
                          ? 'bg-commito-coral text-white font-bold shadow-xs'
                          : 'text-text-muted hover:text-text-primary hover:bg-base-3'
                      }`}
                    >
                      {preset}%
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2.5 w-44">
              <input
                type="range"
                min={setting.min ?? 0}
                max={setting.max ?? 100}
                step={setting.step ?? 1}
                value={num}
                onChange={(e) => setSettingValue(setting.id, parseFloat(e.target.value))}
                className="flex-1 accent-commito-coral cursor-pointer h-1.5 bg-base-2 rounded-xs"
              />
              <div className="flex items-center gap-1 min-w-[48px] justify-end">
                <input
                  type="number"
                  min={setting.min}
                  max={setting.max}
                  step={setting.step}
                  value={num}
                  onChange={(e) => setSettingValue(setting.id, parseFloat(e.target.value) || 0)}
                  className="w-12 h-7 px-1.5 bg-base-2 border border-border/70 hover:border-border-strong rounded-xs text-[11.5px] font-mono text-text-primary text-right focus:outline-none focus:border-border-strong"
                />
                {setting.unit && (
                  <span className="text-[10.5px] font-mono text-text-muted select-none">
                    {setting.unit}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'select': {
        return (
          <select
            value={String(value ?? setting.default)}
            onChange={(e) => setSettingValue(setting.id, e.target.value)}
            className="h-7 px-2.5 bg-base-2 border border-border/70 hover:border-border-strong rounded-xs text-xs text-text-primary focus:outline-none focus:border-border-strong cursor-pointer max-w-[240px]"
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
            className={`w-9 h-4.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
              checked ? 'bg-commito-coral' : 'bg-base-3 border border-border/80'
            }`}
          >
            <div
              className={`bg-white w-3.5 h-3.5 rounded-full shadow-sm transform transition-transform ${
                checked ? 'translate-x-4.5' : 'translate-x-0'
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
            className="w-64 h-7 px-2.5 bg-base-2 border border-border/70 hover:border-border-strong rounded-xs text-xs text-text-primary font-mono focus:outline-none focus:border-border-strong"
          />
        );
      }
    }
  };

  return (
    <div
      className={`p-3 mb-2 rounded-sm border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 group ${
        modified
          ? 'bg-base-1/90 border-border-strong shadow-xs'
          : 'bg-base-1/40 border-border/50 hover:border-border/80 hover:bg-base-1/70'
      }`}
    >
      {/* Left: Label, Description, Badges */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-xs text-text-primary">{setting.label}</span>

          {modified && (
            <span className="px-1.5 py-0.2 bg-commito-coral/15 text-commito-coral text-[9px] font-mono font-bold rounded-xs uppercase tracking-wider">
              Modified
            </span>
          )}

          {setting.cssVar && (
            <code className="text-[9.5px] font-mono text-text-faint bg-base-2/60 px-1 py-0.2 rounded-xs border border-border/40">
              {setting.cssVar}
            </code>
          )}
        </div>

        <p className="text-[11.5px] text-text-muted mt-0.5 leading-relaxed">
          {setting.description}
        </p>
      </div>

      {/* Right: Control Widget & Reset Button */}
      <div className="flex items-center gap-2 self-start md:self-center flex-shrink-0">
        {renderControl()}

        {modified && (
          <button
            type="button"
            onClick={() => resetSettingValue(setting.id)}
            className="p-1.5 text-text-muted hover:text-commito-coral hover:bg-base-2 rounded-xs transition cursor-pointer"
            title={`Reset "${setting.label}" to default (${setting.default})`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
