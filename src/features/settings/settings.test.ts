import { describe, it, expect, beforeEach } from 'vitest';
import { SETTINGS_SCHEMA, CATEGORY_METADATA } from './lib/settingsSchema';
import { applySettingToDom, applyAllOverrides } from './lib/applyCssVar';
import { searchSettings } from './lib/fuzzySearch';
import { useSettingsStore } from './store/useSettingsStore';

describe('Settings Schema & Token Coverage', () => {
  it('contains definitions for all essential design tokens with non-empty defaults', () => {
    expect(SETTINGS_SCHEMA.length).toBeGreaterThanOrEqual(40);

    const cssVars = SETTINGS_SCHEMA.map((s) => s.cssVar).filter(Boolean);
    expect(cssVars).toContain('--app-bg-primary');
    expect(cssVars).toContain('--app-bg-secondary');
    expect(cssVars).toContain('--app-accent');
    expect(cssVars).toContain('--app-font-size');
    expect(cssVars).toContain('--app-radius-md');
    expect(cssVars).toContain('--git-added');
    expect(cssVars).toContain('--git-removed');
    expect(cssVars).toContain('--terminal-bg');
    expect(cssVars).toContain('--terminal-ansi-red');
    expect(cssVars).toContain('--terminal-ansi-bright-blue');
    expect(cssVars).toContain('--log-error');
  });

  it('ensures every setting category is valid and documented in metadata', () => {
    const validCategories = Object.keys(CATEGORY_METADATA);

    for (const setting of SETTINGS_SCHEMA) {
      expect(validCategories).toContain(setting.category);
      expect(setting.id).toBeTruthy();
      expect(setting.label).toBeTruthy();
      expect(setting.description).toBeTruthy();
      expect(setting.default).toBeDefined();
    }
  });

  it('includes 16 ANSI colors in terminal subcategory', () => {
    const ansiSettings = SETTINGS_SCHEMA.filter(
      (s) => s.category === 'terminal' && s.subcategory === 'ANSI Colors'
    );
    expect(ansiSettings.length).toBe(16);
  });
});

describe('Live CSS DOM Application (applySettingToDom)', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
  });

  it('writes custom properties directly to document.documentElement', () => {
    applySettingToDom('--app-accent', '#10b981');
    expect(document.documentElement.style.getPropertyValue('--app-accent')).toBe('#10b981');
  });

  it('applies unit suffixes for numeric dimensions', () => {
    const fontDef = SETTINGS_SCHEMA.find((s) => s.id === 'typography.fontSize');
    applySettingToDom('--app-font-size', 16, fontDef);
    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('16px');
  });

  it('handles density preset switching (compact vs comfortable)', () => {
    applySettingToDom('--app-density', 'compact');
    expect(document.documentElement.style.getPropertyValue('--app-row-height')).toBe('32px');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');

    applySettingToDom('--app-density', 'comfortable');
    expect(document.documentElement.style.getPropertyValue('--app-row-height')).toBe('38px');
    expect(document.documentElement.getAttribute('data-density')).toBe('comfortable');
  });

  it('batch applies overrides on app load', () => {
    applyAllOverrides({
      'colors.accent': '#9333ea',
      'shape.radiusMd': 10,
    });
    expect(document.documentElement.style.getPropertyValue('--app-accent')).toBe('#9333ea');
    expect(document.documentElement.style.getPropertyValue('--app-radius-md')).toBe('10px');
  });
});

describe('Fuzzy Search Engine (searchSettings)', () => {
  it('returns exact and partial keyword matches across labels, categories, and CSS vars', () => {
    const results = searchSettings('accent');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.setting.id === 'colors.accent')).toBe(true);

    const diffResults = searchSettings('git-added');
    expect(diffResults.length).toBeGreaterThan(0);
    expect(diffResults[0].setting.cssVar).toBe('--git-added');
    expect(diffResults[0].breadcrumbs).toContain('Colors');
  });

  it('returns empty array when query is blank or no match', () => {
    expect(searchSettings('')).toEqual([]);
    expect(searchSettings('non_existent_token_xyz_12345')).toEqual([]);
  });
});

describe('useSettingsStore State Management', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      isOpen: false,
      activeScope: 'app',
      selectedCategory: 'commonly_used',
      appOverrides: {},
      repoOverrides: {},
    });
  });

  it('tracks modifications and returns effective values', async () => {
    const store = useSettingsStore.getState();
    expect(store.isModified('colors.accent')).toBe(false);
    expect(store.getEffectiveValue('colors.accent')).toBe('#e05638');

    await store.setSettingValue('colors.accent', '#3b82f6');
    expect(useSettingsStore.getState().isModified('colors.accent')).toBe(true);
    expect(useSettingsStore.getState().getEffectiveValue('colors.accent')).toBe('#3b82f6');

    await store.resetSettingValue('colors.accent');
    expect(useSettingsStore.getState().isModified('colors.accent')).toBe(false);
    expect(useSettingsStore.getState().getEffectiveValue('colors.accent')).toBe('#e05638');
  });

  it('opens and closes modal with category selection', () => {
    const store = useSettingsStore.getState();
    store.openSettings('terminal');
    expect(useSettingsStore.getState().isOpen).toBe(true);
    expect(useSettingsStore.getState().selectedCategory).toBe('terminal');

    store.closeSettings();
    expect(useSettingsStore.getState().isOpen).toBe(false);
  });
});
