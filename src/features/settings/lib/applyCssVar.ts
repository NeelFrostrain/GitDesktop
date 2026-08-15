import { SETTINGS_SCHEMA, SettingDefinition } from './settingsSchema';

/**
 * Format raw setting values into valid CSS custom property strings.
 */
export function formatCssValue(definition: SettingDefinition | undefined, value: any): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'number') {
    if (definition?.unit) {
      return `${value}${definition.unit}`;
    }
    return String(value);
  }

  return String(value);
}

/**
 * Apply a single setting or CSS custom property directly to the DOM at runtime.
 */
export function applySettingToDom(cssVar: string, value: any, definition?: SettingDefinition): void {
  if (!cssVar || typeof document === 'undefined') return;

  const formatted = formatCssValue(definition, value);
  document.documentElement.style.setProperty(cssVar, formatted);

  // Handle density preset scaling
  if (cssVar === '--app-density') {
    if (value === 'compact') {
      document.documentElement.style.setProperty('--app-row-height', '32px');
      document.documentElement.style.setProperty('--app-spacing-unit', '3px');
      document.documentElement.style.setProperty('--app-font-size', '12px');
      document.documentElement.setAttribute('data-density', 'compact');
    } else {
      document.documentElement.style.setProperty('--app-row-height', '38px');
      document.documentElement.style.setProperty('--app-spacing-unit', '4px');
      document.documentElement.style.setProperty('--app-font-size', '13px');
      document.documentElement.setAttribute('data-density', 'comfortable');
    }
  }
}

/**
 * Revert a CSS custom property to its schema default value.
 */
export function removeSettingFromDom(cssVar: string, defaultVal: any, definition?: SettingDefinition): void {
  if (!cssVar || typeof document === 'undefined') return;

  if (defaultVal !== undefined) {
    applySettingToDom(cssVar, defaultVal, definition);
  } else {
    document.documentElement.style.removeProperty(cssVar);
  }
}

/**
 * Apply all saved overrides on app startup.
 */
export function applyAllOverrides(overrides: Record<string, any>): void {
  if (!overrides || typeof document === 'undefined') return;

  const defsById = new Map<string, SettingDefinition>();
  SETTINGS_SCHEMA.forEach((s) => defsById.set(s.id, s));

  Object.entries(overrides).forEach(([id, val]) => {
    const def = defsById.get(id);
    if (def && def.cssVar) {
      applySettingToDom(def.cssVar, val, def);
    }
  });
}
