export { SettingsPanel } from './SettingsPanel';
export { useSettingsStore } from './store/useSettingsStore';
export { SETTINGS_SCHEMA, CATEGORY_METADATA } from './lib/settingsSchema';
export { applySettingToDom, applyAllOverrides, removeSettingFromDom } from './lib/applyCssVar';
export { searchSettings } from './lib/fuzzySearch';
export type {
  SettingDefinition,
  SettingCategory,
  SettingType,
  SettingScope,
} from './lib/settingsSchema';
