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
export function applySettingToDom(
  cssVar: string,
  value: any,
  definition?: SettingDefinition
): void {
  if (!cssVar || typeof document === 'undefined') return;

  const formatted = formatCssValue(definition, value);
  document.documentElement.style.setProperty(cssVar, formatted);

  // Handle UI Scale - apply native zoom scaling without viewport shrinking or black borders
  if (cssVar === '--app-ui-scale') {
    const rawVal = typeof value === 'number' ? value : parseFloat(String(value)) || 100;
    const scale = rawVal / 100;
    document.documentElement.style.setProperty('--app-ui-scale-value', String(scale));
    (document.documentElement.style as any).zoom = String(scale);
    document.documentElement.setAttribute('data-ui-scale', String(rawVal));
  }

  // Handle font family - apply to body with proper fallbacks
  if (cssVar === '--app-font-family') {
    const fontMap: Record<string, string> = {
      Inter: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
      'Segoe UI': '"Segoe UI", sans-serif',
      'SF Pro Display': "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      Roboto: "'Roboto', sans-serif",
      system: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    };
    const fontStack = fontMap[String(value)] || fontMap['Inter'];
    document.documentElement.style.fontFamily = fontStack;
  }

  // Handle terminal font family
  if (cssVar === '--app-terminal-font-family') {
    const terminalFontMap: Record<string, string> = {
      'JetBrains Mono': "'JetBrains Mono', monospace",
      'Fira Code': "'Fira Code', monospace",
      'Cascadia Code': "'Cascadia Code', monospace",
      Monaco: "'Monaco', monospace",
      Menlo: "'Menlo', monospace",
    };
    const terminalFontStack = terminalFontMap[String(value)] || terminalFontMap['JetBrains Mono'];
    document.documentElement.style.setProperty('--font-mono', terminalFontStack);
  }

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
export function removeSettingFromDom(
  cssVar: string,
  defaultVal: any,
  definition?: SettingDefinition
): void {
  if (!cssVar || typeof document === 'undefined') return;

  if (defaultVal !== undefined) {
    applySettingToDom(cssVar, defaultVal, definition);
  } else {
    document.documentElement.style.removeProperty(cssVar);
    if (cssVar === '--app-ui-scale') {
      document.documentElement.style.setProperty('--app-ui-scale-value', '1');
      (document.documentElement.style as any).zoom = '1';
      document.documentElement.setAttribute('data-ui-scale', '100');
    }
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
