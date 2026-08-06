import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';
export type LogCategory = 'Git' | 'Auth' | 'Repo' | 'System';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: string;
}

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

const getStoredLogs = (): LogEntry[] => {
  try {
    const cached = localStorage.getItem('git_desktop_activity_logs');
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
};

const saveLogs = (logs: LogEntry[]) => {
  try {
    localStorage.setItem('git_desktop_activity_logs', JSON.stringify(logs.slice(0, 300)));
  } catch {}
};

export const useLogStore = create<LogState>((set, get) => ({
  logs: getStoredLogs(),
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

    // Output to developer console
    const logPrefix = `[GitDesktop] [${newEntry.timestamp}] [${category}] ${message}`;
    if (level === 'error') {
      console.error(logPrefix, details || '');
    } else if (level === 'warning') {
      console.warn(logPrefix, details || '');
    } else if (level === 'success') {
      console.log(`%c${logPrefix}`, 'color: #10b981; font-weight: bold;', details || '');
    } else {
      console.info(logPrefix, details || '');
    }

    // Print directly to terminal output running Tauri
    invoke('log_action_cmd', {
      level,
      category,
      message,
      details: details || null,
    }).catch(() => {});

    const updated = [newEntry, ...get().logs].slice(0, 500);
    saveLogs(updated);
    set({ logs: updated });
  },

  clearLogs: () => {
    saveLogs([]);
    set({ logs: [] });
  },

  setIsLogModalOpen: (isLogModalOpen) => set({ isLogModalOpen }),
  setFilterLevel: (filterLevel) => set({ filterLevel }),
  setFilterCategory: (filterCategory) => set({ filterCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
