import { describe, it, expect, beforeEach } from 'vitest';
import { SETTINGS_SCHEMA, CATEGORY_METADATA } from './lib/settingsSchema';
import { searchSettings } from './lib/fuzzySearch';
import { useSettingsStore } from './store/useSettingsStore';

describe('Settings Schema & Token Coverage', () => {
  it('contains AI & Commit-AI category with valid metadata', () => {
    expect(CATEGORY_METADATA.ai).toBeDefined();
    expect(CATEGORY_METADATA.ai.label).toBe('AI & Commit-AI');
    expect(CATEGORY_METADATA.ai.subcategories).toContain('API Keys & Providers');
    expect(CATEGORY_METADATA.ai.subcategories).toContain('Model Configuration');
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

  it('includes AI model and API key definitions', () => {
    const aiIds = SETTINGS_SCHEMA.map((s) => s.id);
    expect(aiIds).toContain('ai.active_api_key');
    expect(aiIds).toContain('ai.model');
    expect(aiIds).toContain('ai.temperature');
  });
});

describe('Fuzzy Search Engine (searchSettings)', () => {
  it('returns exact and partial keyword matches across labels and categories', () => {
    const results = searchSettings('Gemini');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.setting.id === 'ai.active_api_key')).toBe(true);

    const modelResults = searchSettings('model');
    expect(modelResults.length).toBeGreaterThan(0);
    expect(modelResults[0].breadcrumbs).toContain('AI & Commit-AI');
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
      selectedCategory: 'ai',
      appOverrides: {},
      repoOverrides: {},
    });
  });

  it('tracks modifications and returns effective values', async () => {
    const store = useSettingsStore.getState();
    expect(store.isModified('ai.model')).toBe(false);
    expect(store.getEffectiveValue('ai.model')).toBe('gemini-3.5-flash-lite');

    await store.setSettingValue('ai.model', 'gemini-3.1-flash-lite');
    expect(useSettingsStore.getState().isModified('ai.model')).toBe(true);
    expect(useSettingsStore.getState().getEffectiveValue('ai.model')).toBe('gemini-3.1-flash-lite');

    await store.resetSettingValue('ai.model');
    expect(useSettingsStore.getState().isModified('ai.model')).toBe(false);
    expect(useSettingsStore.getState().getEffectiveValue('ai.model')).toBe('gemini-3.5-flash-lite');
  });

  it('handles UI scale setting value updates and DOM zoom scaling', async () => {
    const store = useSettingsStore.getState();
    expect(store.isModified('app.ui_scale')).toBe(false);
    expect(store.getEffectiveValue('app.ui_scale')).toBe(100);

    await store.setSettingValue('app.ui_scale', 90);
    expect(useSettingsStore.getState().isModified('app.ui_scale')).toBe(true);
    expect(useSettingsStore.getState().getEffectiveValue('app.ui_scale')).toBe(90);
    expect(document.documentElement.getAttribute('data-ui-scale')).toBe('90');
    expect(document.documentElement.style.getPropertyValue('--app-ui-scale-value')).toBe('0.9');

    await store.resetSettingValue('app.ui_scale');
    expect(useSettingsStore.getState().isModified('app.ui_scale')).toBe(false);
    expect(useSettingsStore.getState().getEffectiveValue('app.ui_scale')).toBe(100);
    expect(document.documentElement.getAttribute('data-ui-scale')).toBe('100');
    expect(document.documentElement.style.getPropertyValue('--app-ui-scale-value')).toBe('1');
  });

  it('opens and closes modal with category selection', () => {
    const store = useSettingsStore.getState();
    store.openSettings('ai');
    expect(useSettingsStore.getState().isOpen).toBe(true);
    expect(useSettingsStore.getState().selectedCategory).toBe('ai');

    store.closeSettings();
    expect(useSettingsStore.getState().isOpen).toBe(false);
  });
});
