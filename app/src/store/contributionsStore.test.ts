import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useContributionsStore } from './contributionsStore';
import { ContributionsService } from '../services/contributions/contributionsService';
import { ContributionCalendar } from '../types/contributions';

const mockCalendar: ContributionCalendar = {
  total_contributions: 42,
  start_date: '2025-08-25',
  end_date: '2026-08-29',
  provider: 'all',
  account_handle: 'All Accounts',
  account_name: 'All Workspaces',
  account_avatar: '',
  active_days_count: 12,
  longest_streak: 5,
  current_streak: 2,
  weeks: [
    {
      first_day: '2026-08-23',
      month_label: 'Aug',
      days: [
        {
          date: '2026-08-23',
          count: 0,
          level: 0,
          weekday: 0,
          is_future: false,
          commits: [],
        },
        {
          date: '2026-08-24',
          count: 3,
          level: 2,
          weekday: 1,
          is_future: false,
          commits: [
            {
              id: 'commit-1',
              repo_name: 'gitlab-desktop',
              message: 'feat: add contribution heatmap',
              sha: 'abc123456789',
              short_sha: 'abc1234',
              timestamp: 1787930000,
              author_name: 'NeelFrostrain',
              author_email: 'neel@example.com',
              relative_date: 'yesterday',
            },
          ],
        },
        {
          date: '2026-08-25',
          count: 58,
          level: 4,
          weekday: 2,
          is_future: false,
          commits: [
            {
              id: 'commit-2',
              repo_name: 'gitlab-desktop',
              message: 'fix: optimize commit scanning',
              sha: 'def987654321',
              short_sha: 'def9876',
              timestamp: 1787940000,
              author_name: 'NeelFrostrain',
              author_email: 'neel@example.com',
              relative_date: 'today',
            },
          ],
        },
      ],
    },
  ],
};

describe('useContributionsStore', () => {
  beforeEach(() => {
    useContributionsStore.setState({
      calendar: null,
      selectedAccountId: 'all',
      selectedDate: null,
      isLoading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  it('initializes with default state', () => {
    const state = useContributionsStore.getState();
    expect(state.calendar).toBeNull();
    expect(state.selectedAccountId).toBe('all');
    expect(state.selectedDate).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('updates selectedAccountId and triggers load', async () => {
    vi.spyOn(ContributionsService, 'getContributionsCalendar').mockResolvedValue(mockCalendar);

    await useContributionsStore.getState().setSelectedAccountId('github-123');

    const state = useContributionsStore.getState();
    expect(state.selectedAccountId).toBe('github-123');
    expect(state.calendar).toEqual(mockCalendar);
  });

  it('selects and deselects dates properly', () => {
    useContributionsStore.setState({ calendar: mockCalendar });

    useContributionsStore.getState().setSelectedDate('2026-08-25');
    expect(useContributionsStore.getState().selectedDate).toBe('2026-08-25');

    const dayData = useContributionsStore.getState().getSelectedDayData();
    expect(dayData).not.toBeNull();
    expect(dayData?.count).toBe(58);
    expect(dayData?.level).toBe(4);

    const commits = useContributionsStore.getState().getRecentCommits();
    expect(commits.length).toBe(1);
    expect(commits[0].sha).toBe('def987654321');

    useContributionsStore.getState().setSelectedDate(null);
    expect(useContributionsStore.getState().selectedDate).toBeNull();
  });
});
