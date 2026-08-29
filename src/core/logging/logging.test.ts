import { describe, it, expect, vi } from 'vitest';
import {
  LOG_LEVEL_TERMINAL_COLOR,
  LOG_LEVEL_TERMINAL_TAG,
} from './colorMap';
import { LogEntry, LogLevel } from './types';
import { useAppLogStore, printLogToConsole } from './logStore';

describe('colorMap', () => {
  it('defines terminal-specific colors for all 5 log levels', () => {
    const levels: LogLevel[] = ['Debug', 'Info', 'Success', 'Warn', 'Error'];
    for (const lvl of levels) {
      expect(LOG_LEVEL_TERMINAL_COLOR[lvl]).toBeDefined();
      expect(LOG_LEVEL_TERMINAL_TAG[lvl]).toBeDefined();
      expect(LOG_LEVEL_TERMINAL_COLOR[lvl]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('matches required terminal color mappings', () => {
    expect(LOG_LEVEL_TERMINAL_COLOR.Debug).toBe('#6b7280');
    expect(LOG_LEVEL_TERMINAL_COLOR.Info).toBe('#60a5fa');
    expect(LOG_LEVEL_TERMINAL_COLOR.Success).toBe('#4ade80');
    expect(LOG_LEVEL_TERMINAL_COLOR.Warn).toBe('#facc15');
    expect(LOG_LEVEL_TERMINAL_COLOR.Error).toBe('#f87171');
  });
});

describe('logStore', () => {
  it('adds entries to in-memory buffer up to capacity', () => {
    const store = useAppLogStore.getState();

    const sampleEntry: LogEntry = {
      id: 'test-1',
      at: new Date().toISOString(),
      level: 'Success',
      category: 'Git',
      message: 'Committed changes',
      repo_id: 'test-repo',
    };

    store.addEntryToBuffer(sampleEntry);
    expect(useAppLogStore.getState().recentLogs).toContainEqual(sampleEntry);
  });

  it('updates and resets filter correctly', () => {
    const store = useAppLogStore.getState();

    store.setFilter({
      categories: ['Git', 'Remote'],
      levels: ['Error', 'Warn'],
      search: 'failed',
    });

    const filter = useAppLogStore.getState().filter;
    expect(filter.categories).toEqual(['Git', 'Remote']);
    expect(filter.levels).toEqual(['Error', 'Warn']);
    expect(filter.search).toBe('failed');

    store.resetFilter();
    const resetFilter = useAppLogStore.getState().filter;
    expect(resetFilter.categories).toEqual([]);
    expect(resetFilter.levels).toEqual([]);
    expect(resetFilter.search).toBe('');
  });

  it('prints formatted logs to browser console', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    printLogToConsole({
      id: 'test-info',
      at: new Date().toISOString(),
      level: 'Info',
      category: 'Git',
      message: 'Fetched latest refs',
    });
    expect(infoSpy).toHaveBeenCalled();

    printLogToConsole({
      id: 'test-err',
      at: new Date().toISOString(),
      level: 'Error',
      category: 'Account',
      message: 'Token expired',
    });
    expect(errorSpy).toHaveBeenCalled();

    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
