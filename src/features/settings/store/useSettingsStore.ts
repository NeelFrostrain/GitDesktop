import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { SETTINGS_SCHEMA, SettingCategory, SettingDefinition, SettingScope } from '../lib/settingsSchema';
import { applySettingToDom, removeSettingFromDom, applyAllOverrides } from '../lib/applyCssVar';

interface SettingsState {
  isOpen: boolean;
  activeScope: SettingScope;
  selectedCategory: SettingCategory;
  selectedSubcategory: string | null;
  searchQuery: string;
  appOverrides: Record<string, any>;
  repoOverrides: Record<string, any>;
  activeRepoPath: string | null;
  isLoading: boolean;

  // Actions
  openSettings: (category?: SettingCategory, subcategory?: string) => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  setActiveScope: (scope: SettingScope) => void;
  setSelectedCategory: (category: SettingCategory) => void;
  setSelectedSubcategory: (subcategory: string | null) => void;
  setSearchQuery: (query: string) => void;

  loadSettings: (repoPath?: string | null) => Promise<void>;
  setSettingValue: (id: string, value: any) => Promise<void>;
  resetSettingValue: (id: string) => Promise<void>;
  resetAllSettings: () => Promise<void>;

  getEffectiveValue: (id: string) => any;
  isModified: (id: string) => boolean;
}

const defsMap = new Map<string, SettingDefinition>();
SETTINGS_SCHEMA.forEach((s) => defsMap.set(s.id, s));

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isOpen: false,
  activeScope: 'app',
  selectedCategory: 'ai',
  selectedSubcategory: null,
  searchQuery: '',
  appOverrides: {},
  repoOverrides: {},
  activeRepoPath: null,
  isLoading: false,

  openSettings: (category = 'ai', subcategory?: string) => {
    set({
      isOpen: true,
      selectedCategory: category,
      selectedSubcategory: subcategory || null,
    });
  },

  closeSettings: () => {
    set({ isOpen: false, searchQuery: '' });
  },

  toggleSettings: () => {
    set((state) => ({ isOpen: !state.isOpen, searchQuery: '' }));
  },

  setActiveScope: (activeScope) => set({ activeScope }),
  setSelectedCategory: (selectedCategory) =>
    set({ selectedCategory, selectedSubcategory: null, searchQuery: '' }),
  setSelectedSubcategory: (selectedSubcategory) => set({ selectedSubcategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  loadSettings: async (repoPath = null) => {
    set({ isLoading: true, activeRepoPath: repoPath });
    try {
      // 1. Load app-scoped overrides from Tauri backend
      let appOverrides: Record<string, any> = {};
      try {
        appOverrides = await invoke<Record<string, any>>('settings_get_all');
      } catch (err) {
        console.warn('[Settings] Failed to fetch app settings from backend, using local:', err);
      }

      // 2. Load repo-scoped overrides if repoPath is set
      let repoOverrides: Record<string, any> = {};
      if (repoPath) {
        try {
          repoOverrides = await invoke<Record<string, any>>('settings_get_repo', {
            repoPath,
          });
        } catch {}
      }

      set({ appOverrides, repoOverrides, isLoading: false });

      // 3. Immediately apply all CSS custom property overrides to document
      applyAllOverrides(appOverrides);
    } catch (e) {
      set({ isLoading: false });
    }
  },

  setSettingValue: async (id: string, value: any) => {
    const { activeScope, activeRepoPath, appOverrides, repoOverrides } = get();
    const def = defsMap.get(id);
    if (!def) return;

    const isApp = def.scope === 'app' || activeScope === 'app' || !activeRepoPath;

    // Apply live to DOM if setting has a CSS Custom Property
    if (def.cssVar) {
      applySettingToDom(def.cssVar, value, def);
    }

    if (isApp) {
      const next = { ...appOverrides, [id]: value };
      set({ appOverrides: next });
      try {
        await invoke('settings_save_value', { key: id, value });
      } catch (e) {
        console.error('[Settings] Failed to save setting to backend:', e);
      }
    } else {
      const next = { ...repoOverrides, [id]: value };
      set({ repoOverrides: next });
      if (activeRepoPath) {
        try {
          await invoke('settings_save_repo_value', {
            repoPath: activeRepoPath,
            key: id,
            value,
          });
        } catch (e) {
          console.error('[Settings] Failed to save repo setting to backend:', e);
        }
      }
    }
  },

  resetSettingValue: async (id: string) => {
    const { activeScope, activeRepoPath, appOverrides, repoOverrides } = get();
    const def = defsMap.get(id);
    if (!def) return;

    const isApp = def.scope === 'app' || activeScope === 'app' || !activeRepoPath;

    // Revert CSS custom property to default
    if (def.cssVar) {
      removeSettingFromDom(def.cssVar, def.default, def);
    }

    if (isApp) {
      const next = { ...appOverrides };
      delete next[id];
      set({ appOverrides: next });
      try {
        await invoke('settings_reset_value', { key: id });
      } catch {}
    } else {
      const next = { ...repoOverrides };
      delete next[id];
      set({ repoOverrides: next });
      if (activeRepoPath) {
        try {
          await invoke('settings_reset_repo_value', {
            repoPath: activeRepoPath,
            key: id,
          });
        } catch {}
      }
    }
  },

  resetAllSettings: async () => {
    const { appOverrides } = get();

    // Revert all CSS variables to schema defaults
    Object.keys(appOverrides).forEach((id) => {
      const def = defsMap.get(id);
      if (def?.cssVar) {
        removeSettingFromDom(def.cssVar, def.default, def);
      }
    });

    set({ appOverrides: {}, repoOverrides: {} });
    try {
      await invoke('settings_reset_all');
    } catch {}
  },

  getEffectiveValue: (id: string) => {
    const { activeScope, appOverrides, repoOverrides } = get();
    const def = defsMap.get(id);
    if (!def) return undefined;

    if (def.scope === 'repo' || activeScope === 'repo') {
      if (repoOverrides[id] !== undefined) return repoOverrides[id];
    }

    if (appOverrides[id] !== undefined) return appOverrides[id];

    return def.default;
  },

  isModified: (id: string) => {
    const { activeScope, appOverrides, repoOverrides } = get();
    const def = defsMap.get(id);
    if (!def) return false;

    if (def.scope === 'repo' || activeScope === 'repo') {
      return repoOverrides[id] !== undefined && repoOverrides[id] !== def.default;
    }

    return appOverrides[id] !== undefined && appOverrides[id] !== def.default;
  },
}));
