import { invoke } from '@tauri-apps/api/core';
import {
  TerminalSessionInfo,
  HistoryEntry,
  LogSessionSummary,
  AutocompleteSuggestion,
} from '../types';

export const ptyBridge = {
  async open(repoId: string, repoPath: string): Promise<TerminalSessionInfo> {
    return invoke<TerminalSessionInfo>('terminal_open', { repoId, repoPath });
  },

  async write(repoId: string, data: string): Promise<void> {
    return invoke<void>('terminal_write', { repoId, data });
  },

  async resize(repoId: string, cols: number, rows: number): Promise<void> {
    return invoke<void>('terminal_resize', { repoId, cols, rows });
  },

  async kill(repoId: string): Promise<void> {
    return invoke<void>('terminal_kill', { repoId });
  },

  async getHistory(repoId: string, limit = 20, offset = 0): Promise<HistoryEntry[]> {
    return invoke<HistoryEntry[]>('terminal_get_history', { repoId, limit, offset });
  },

  async recordHistory(repoId: string, cmd: string, exitCode?: number | null): Promise<void> {
    return invoke<void>('terminal_record_history', { repoId, cmd, exitCode: exitCode ?? null });
  },

  async clearHistory(repoId: string): Promise<void> {
    return invoke<void>('terminal_clear_history', { repoId });
  },

  async listLogSessions(repoId: string): Promise<LogSessionSummary[]> {
    return invoke<LogSessionSummary[]>('terminal_list_log_sessions', { repoId });
  },

  async getLogSession(repoId: string, sessionId: string): Promise<string> {
    return invoke<string>('terminal_get_log_session', { repoId, sessionId });
  },

  async exportLogSession(repoId: string, sessionId: string, destPath: string): Promise<void> {
    return invoke<void>('terminal_export_log_session', { repoId, sessionId, destPath });
  },

  async autocompleteSuggest(
    repoPath: string,
    partialCommand: string,
    cursorPos: number
  ): Promise<AutocompleteSuggestion[]> {
    return invoke<AutocompleteSuggestion[]>('autocomplete_suggest', {
      repoPath,
      partialCommand,
      cursorPos,
    });
  },
};
