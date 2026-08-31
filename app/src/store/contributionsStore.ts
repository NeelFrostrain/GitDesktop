import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ContributionCalendar, ContributionDay, CommitItem } from '../types/contributions';
import { ContributionsService } from '../services/contributions/contributionsService';
import { useRepoStore } from './repoStore';
import { useLogStore } from './useLogStore';
import { getErrorMessage } from '../shared/utils/errorUtils';

interface ContributionsState {
  calendar: ContributionCalendar | null;
  selectedAccountId: string; // 'all' | 'local' | specific account id
  selectedDate: string | null; // "YYYY-MM-DD"
  isLoading: boolean;
  error: string | null;

  // Actions
  setSelectedAccountId: (id: string) => Promise<void>;
  setSelectedDate: (date: string | null) => void;
  loadContributions: (accountId?: string) => Promise<void>;
  refresh: () => Promise<void>;

  // Derived helpers
  getSelectedDayData: () => ContributionDay | null;
  getRecentCommits: (limit?: number) => CommitItem[];
}

let inFlightLoadPromise: Promise<void> | null = null;
let inFlightTargetKey = '';
let lastCompletedTime = 0;
let lastCompletedKey = '';

export const useContributionsStore = create<ContributionsState>((set, get) => ({
  calendar: null,
  selectedAccountId: 'all',
  selectedDate: null,
  isLoading: false,
  error: null,

  setSelectedAccountId: async (id: string) => {
    set({ selectedAccountId: id, selectedDate: null });
    await get().loadContributions(id);
  },

  setSelectedDate: (date: string | null) => {
    set({ selectedDate: date });
  },

  loadContributions: async (accountIdParam?: string) => {
    const targetAccountId = accountIdParam !== undefined ? accountIdParam : get().selectedAccountId;
    const cacheKey = targetAccountId || 'all';

    // 1. In-flight request deduplication: reuse running request if targeting the same account
    if (inFlightLoadPromise && inFlightTargetKey === cacheKey) {
      return inFlightLoadPromise;
    }

    // 2. Short-interval debounce (throttle identical queries within 400ms)
    const now = Date.now();
    if (lastCompletedKey === cacheKey && now - lastCompletedTime < 400 && get().calendar !== null) {
      return;
    }

    inFlightTargetKey = cacheKey;
    set({ isLoading: true, error: null });

    inFlightLoadPromise = (async () => {
      try {
        const repos = useRepoStore.getState().repos;
        let repoPaths = repos.map((r) => r.path);

        if (repoPaths.length === 0) {
          try {
            if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
              const known = await invoke<Array<{ path: string }>>('list_known_repos_cmd');
              if (known && known.length > 0) {
                repoPaths = known.map((k: { path: string }) => k.path);
              }
            }
          } catch {
            // ignore
          }
        }

        // If 'all' or 'local', or specific account id
        const cal = await ContributionsService.getContributionsCalendar(
          targetAccountId === 'all'
            ? 'all'
            : targetAccountId === 'local'
              ? 'local'
              : targetAccountId,
          repoPaths
        );

        set({ calendar: cal });
        lastCompletedTime = Date.now();
        lastCompletedKey = cacheKey;
      } catch (err: unknown) {
        const msg = getErrorMessage(err);
        set({ error: msg });
        useLogStore
          .getState()
          .addLog('warning', 'System', `Failed to load contribution calendar: ${msg}`);
      } finally {
        inFlightLoadPromise = null;
        inFlightTargetKey = '';
        set({ isLoading: false });
      }
    })();

    return inFlightLoadPromise;
  },

  refresh: async () => {
    await get().loadContributions();
  },

  getSelectedDayData: () => {
    const { calendar, selectedDate } = get();
    if (!calendar || !selectedDate) return null;

    for (const week of calendar.weeks) {
      for (const day of week.days) {
        if (day.date === selectedDate) {
          return day;
        }
      }
    }
    return null;
  },

  getRecentCommits: (limit = 20) => {
    const { calendar, selectedDate } = get();
    if (!calendar) return [];

    // If a specific day is selected, return that day's commits
    if (selectedDate) {
      const dayData = get().getSelectedDayData();
      return dayData ? dayData.commits : [];
    }

    // Otherwise collect most recent commits across all weeks
    const allCommits: CommitItem[] = [];
    const seen = new Set<string>();

    // Traverse backwards from most recent week
    for (let w = calendar.weeks.length - 1; w >= 0; w--) {
      const week = calendar.weeks[w];
      for (let d = week.days.length - 1; d >= 0; d--) {
        const day = week.days[d];
        for (const c of day.commits) {
          if (!seen.has(c.sha)) {
            seen.add(c.sha);
            allCommits.push(c);
            if (allCommits.length >= limit) {
              return allCommits;
            }
          }
        }
      }
    }

    return allCommits;
  },
}));
