import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';
import { LogCategory, LogEntry, LogFilter, LogLevel } from './types';

interface LogStoreState {
  recentLogs: LogEntry[];
  filter: LogFilter;
  isLoading: boolean;
  autoScroll: boolean;

  setFilter: (filter: Partial<LogFilter>) => void;
  resetFilter: () => void;
  setAutoScroll: (auto: boolean) => void;
  addEntryToBuffer: (entry: LogEntry) => void;

  addLog: (
    level: LogLevel,
    category: LogCategory,
    message: string,
    repoId?: string,
    metadata?: Record<string, any>
  ) => Promise<LogEntry | null>;

  queryLogs: (filter?: LogFilter, limit?: number, offset?: number) => Promise<LogEntry[]>;
  exportLogsDialog: (filter?: LogFilter) => Promise<boolean>;
  clearLogs: (repoId?: string) => Promise<void>;
  initEventListener: () => Promise<UnlistenFn>;
}

const DEFAULT_FILTER: LogFilter = {
  categories: [],
  levels: [],
  search: '',
  this_repo_only: false,
};

export const useAppLogStore = create<LogStoreState>((set, get) => ({
  recentLogs: [],
  filter: DEFAULT_FILTER,
  isLoading: false,
  autoScroll: true,

  setFilter: (patch) => {
    set((state) => ({
      filter: { ...state.filter, ...patch },
    }));
  },

  resetFilter: () => {
    set({ filter: DEFAULT_FILTER });
  },

  setAutoScroll: (autoScroll) => set({ autoScroll }),

  addEntryToBuffer: (entry) => {
    set((state) => ({
      recentLogs: [entry, ...state.recentLogs].slice(0, 500),
    }));
  },

  addLog: async (level, category, message, repoId, metadata) => {
    try {
      const entry = await invoke<LogEntry>('logs_add', {
        level,
        category,
        message,
        repoId: repoId || null,
        metadata: metadata || null,
      });
      return entry;
    } catch (err) {
      console.error('[Logging] Failed to log entry to backend:', err);
      return null;
    }
  },

  queryLogs: async (filter, limit = 100, offset = 0) => {
    set({ isLoading: true });
    try {
      const activeFilter = filter ?? get().filter;
      const entries = await invoke<LogEntry[]>('logs_query', {
        filter: {
          categories: activeFilter.categories && activeFilter.categories.length > 0 ? activeFilter.categories : null,
          levels: activeFilter.levels && activeFilter.levels.length > 0 ? activeFilter.levels : null,
          repo_id: activeFilter.repo_id || null,
          search: activeFilter.search ? activeFilter.search.trim() : null,
          this_repo_only: activeFilter.this_repo_only ?? false,
        },
        limit,
        offset,
      });
      return entries;
    } catch (err) {
      console.error('[Logging] Failed to query logs:', err);
      return [];
    } finally {
      set({ isLoading: false });
    }
  },

  exportLogsDialog: async (filter) => {
    try {
      const activeFilter = filter ?? get().filter;
      const filePath = await save({
        filters: [
          { name: 'Plain Text Log', extensions: ['log', 'txt'] },
          { name: 'JSON Lines Log', extensions: ['jsonl', 'json'] },
        ],
        defaultPath: `git-desktop-log-${new Date().toISOString().slice(0, 10)}.log`,
      });

      if (!filePath) return false;

      await invoke('logs_export', {
        filter: {
          categories: activeFilter.categories && activeFilter.categories.length > 0 ? activeFilter.categories : null,
          levels: activeFilter.levels && activeFilter.levels.length > 0 ? activeFilter.levels : null,
          repo_id: activeFilter.repo_id || null,
          search: activeFilter.search ? activeFilter.search.trim() : null,
          this_repo_only: activeFilter.this_repo_only ?? false,
        },
        destPath: filePath,
      });

      return true;
    } catch (err) {
      console.error('[Logging] Failed to export logs:', err);
      return false;
    }
  },

  clearLogs: async (repoId) => {
    try {
      await invoke('logs_clear', { repoId: repoId || null });
      if (repoId) {
        set((state) => ({
          recentLogs: state.recentLogs.filter((e) => e.repo_id !== repoId),
        }));
      } else {
        set({ recentLogs: [] });
      }
    } catch (err) {
      console.error('[Logging] Failed to clear logs:', err);
    }
  },

  initEventListener: async () => {
    const unlisten = await listen<LogEntry>('app:log', (event) => {
      get().addEntryToBuffer(event.payload);
    });
    return unlisten;
  },
}));
