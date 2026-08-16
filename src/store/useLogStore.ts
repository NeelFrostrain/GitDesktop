import { create } from 'zustand';
import { useAppLogStore, LogLevel as CoreLogLevel, LogCategory as CoreLogCategory } from '../core/logging';

/**
 * Log severity levels.
 */
export type LogLevel = 'info' | 'success' | 'warning' | 'error';

/**
 * Functional subsystem categories for log events.
 */
export type LogCategory =
  | 'Git'
  | 'Auth'
  | 'Repo'
  | 'System'
  | 'Git LFS'
  | 'Merge Request'
  | 'Worktree'
  | 'Remote';

/**
 * User-visible structured log entry.
 */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: string;
}

/**
 * State and actions for the log console modal.
 */
interface LogState {
  logs: LogEntry[];
  isLogModalOpen: boolean;
  filterLevel: 'all' | LogLevel;
  filterCategory: 'all' | LogCategory;
  searchQuery: string;

  addLog: (level: LogLevel, category: LogCategory, message: string, details?: string) => void;
  clearLogs: () => void;
  setIsLogModalOpen: (open: boolean) => void;
  setFilterLevel: (level: 'all' | LogLevel) => void;
  setFilterCategory: (category: 'all' | LogCategory) => void;
  setSearchQuery: (query: string) => void;
}

function mapToCoreLevel(level: LogLevel): CoreLogLevel {
  switch (level) {
    case 'success':
      return 'Success';
    case 'warning':
      return 'Warn';
    case 'error':
      return 'Error';
    default:
      return 'Info';
  }
}

function mapToCoreCategory(category: LogCategory): CoreLogCategory {
  switch (category) {
    case 'Auth':
      return 'Account';
    case 'Remote':
      return 'Remote';
    case 'Repo':
      return 'Repo';
    default:
      return 'Git';
  }
}

/**
 * Zustand store for collecting, filtering, and persisting user-facing log streams.
 */
export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  isLogModalOpen: false,
  filterLevel: 'all',
  filterCategory: 'all',
  searchQuery: '',

  addLog: (level, category, message, details) => {
    const newEntry: LogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      category,
      message,
      details,
    };

    // Forward to central app logging bus
    const coreLevel = mapToCoreLevel(level);
    const coreCategory = mapToCoreCategory(category);
    useAppLogStore.getState().addLog(
      coreLevel,
      coreCategory,
      message,
      undefined,
      details ? { details } : undefined
    );

    const updated = [newEntry, ...get().logs].slice(0, 200);
    set({ logs: updated });
  },

  clearLogs: () => {
    useAppLogStore.getState().clearLogs();
    set({ logs: [] });
  },

  setIsLogModalOpen: (isLogModalOpen) => set({ isLogModalOpen }),
  setFilterLevel: (filterLevel) => set({ filterLevel }),
  setFilterCategory: (filterCategory) => set({ filterCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
