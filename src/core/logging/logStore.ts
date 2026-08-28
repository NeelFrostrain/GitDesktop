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

/**
 * Emits beautifully styled log records to the browser console.
 */
export function printLogToConsole(entry: LogEntry): void {
  const normLevel = String(entry.level).toLowerCase();
  const d = new Date(entry.at || Date.now());
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const formattedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  const prefix = `[${formattedTime}] [${entry.category}]`;
  const message = entry.message;
  const meta = entry.metadata && Object.keys(entry.metadata).length > 0 ? entry.metadata : undefined;

  switch (normLevel) {
    case 'error':
      if (meta) {
        console.error(`%c${prefix} ${message}`, 'color: #f87171; font-weight: bold;', meta);
      } else {
        console.error(`%c${prefix} ${message}`, 'color: #f87171; font-weight: bold;');
      }
      break;
    case 'warn':
    case 'warning':
      if (meta) {
        console.warn(`%c${prefix} ${message}`, 'color: #fbbf24; font-weight: bold;', meta);
      } else {
        console.warn(`%c${prefix} ${message}`, 'color: #fbbf24; font-weight: bold;');
      }
      break;
    case 'success':
      if (meta) {
        console.log(`%c${prefix} ${message}`, 'color: #34d399; font-weight: bold;', meta);
      } else {
        console.log(`%c${prefix} ${message}`, 'color: #34d399; font-weight: bold;');
      }
      break;
    case 'debug':
      if (meta) {
        console.debug(`%c${prefix} ${message}`, 'color: #94a3b8;', meta);
      } else {
        console.debug(`%c${prefix} ${message}`, 'color: #94a3b8;');
      }
      break;
    default:
      if (meta) {
        console.info(`%c${prefix} ${message}`, 'color: #60a5fa; font-weight: 500;', meta);
      } else {
        console.info(`%c${prefix} ${message}`, 'color: #60a5fa; font-weight: 500;');
      }
      break;
  }
}

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
    // Print to browser console
    printLogToConsole(entry);

    set((state) => {
      const isDuplicate = state.recentLogs.some(
        (e) =>
          e.id === entry.id ||
          (e.message === entry.message &&
            e.level === entry.level &&
            e.category === entry.category &&
            Math.abs(new Date(e.at).getTime() - new Date(entry.at).getTime()) < 2000)
      );
      if (isDuplicate) return state;

      return {
        recentLogs: [entry, ...state.recentLogs].slice(0, 500),
      };
    });
  },

  addLog: async (level, category, message, repoId, metadata) => {
    try {
      const backendEntry = await invoke<LogEntry>('logs_add', {
        level,
        category,
        message,
        repoId: repoId || null,
        metadata: metadata || null,
      });
      if (backendEntry) {
        get().addEntryToBuffer(backendEntry);
        return backendEntry;
      }
    } catch (err) {
      console.warn('[Logging] Backend log invoke error (buffered locally):', err);
      const fallbackEntry: LogEntry = {
        id: `live_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        at: new Date().toISOString(),
        level,
        category,
        message,
        repo_id: repoId || undefined,
        metadata: metadata || undefined,
      };
      get().addEntryToBuffer(fallbackEntry);
      return fallbackEntry;
    }
    return null;
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
