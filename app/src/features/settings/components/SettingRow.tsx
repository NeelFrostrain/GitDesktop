import React from 'react';
import { SettingDefinition } from '../lib/settingsSchema';
import { useSettingsStore } from '../store/useSettingsStore';
import { RotateCcw, Minus, Plus } from 'lucide-react';
import { Tabs } from '../../../components/common/Tabs';
import { Button } from '../../../components/common/Button';
import { Dropdown, type DropdownOption } from '../../../components/common/Dropdown';

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
        const min = setting.min ?? 80;
        const max = setting.max ?? 120;
        const step = setting.step ?? 5;

        const presets = isUiScale
          ? [
              { id: '80', label: '80%' },
              { id: '90', label: '90%' },
              { id: '100', label: '100%' },
              { id: '110', label: '110%' },
              { id: '120', label: '120%' },
            ]
          : null;

        const handleStep = (delta: number) => {
          const next = Math.max(min, Math.min(max, num + delta));
          setSettingValue(setting.id, next);
        };

        return (
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Custom Segmented Presets */}
            {presets && (
              <div className="shrink-0">
                <Tabs
                  tabs={presets}
                  activeTab={String(Math.round(num))}
                  onChange={(val) => setSettingValue(setting.id, parseInt(val, 10))}
                  size="xs"
                  variant="segmented"
                />
              </div>
            )}

            {/* Stepper Controls */}
            <div className="flex items-center gap-1.5 bg-base-1 border border-border rounded-sm p-1 shadow-2xs">
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                disabled={num <= min}
                onClick={() => handleStep(-step)}
                title={`Decrease (${-step}${setting.unit || ''})`}
              >
                <Minus className="w-3 h-3 text-text-muted" />
              </Button>

              {/* Value Badge */}
              <span className="min-w-[42px] px-2 py-0.5 rounded-xs bg-base-0 border border-border text-center font-mono text-[11px] font-bold text-commito-coral select-none shadow-xs">
                {Math.round(num)}{setting.unit || ''}
              </span>

              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                disabled={num >= max}
                onClick={() => handleStep(step)}
                title={`Increase (+${step}${setting.unit || ''})`}
              >
                <Plus className="w-3 h-3 text-text-muted" />
              </Button>
            </div>
          </div>
        );
      }

      case 'select': {
        const selectOptions: DropdownOption[] = (setting.options || []).map((opt) => ({
          value: String(opt.value),
          label: opt.label,
        }));
        return (
          <div className="w-52">
            <Dropdown
              options={selectOptions}
              value={String(value ?? setting.default)}
              onChange={(val) => setSettingValue(setting.id, val)}
              size="sm"
            />
          </div>
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
