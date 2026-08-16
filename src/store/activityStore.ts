import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ActivityEvent } from '../types/home';
import { getErrorMessage } from '../shared/utils/errorUtils';
import { useRepoStore } from './repoStore';
import { useAccountStore } from './accountStore';
import { useLogStore } from './useLogStore';

/**
 * State and actions for the global activity feed on the Home dashboard.
 */
interface ActivityStoreState {
  events: ActivityEvent[];
  isLoadingLocal: boolean;
  isLoadingRemote: boolean;

  loadLocal: (limit?: number) => Promise<void>;
  loadRemote: (limit?: number) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Zustand store managing aggregated local and remote activity event streams.
 */
export const useActivityStore = create<ActivityStoreState>((set, get) => ({
  events: [],
  isLoadingLocal: false,
  isLoadingRemote: false,

  loadLocal: async (limit = 30) => {
    set({ isLoadingLocal: true });
    try {
      const repos = useRepoStore.getState().repos;
      const repoPaths = repos.map((r) => r.path);

      if (repoPaths.length === 0) {
        return;
      }

      const localEvents = await invoke<ActivityEvent[]>('get_local_activity_cmd', {
        repoPaths,
        limit,
      });

      // Merge with existing remote events, sorted descending by timestamp
      set((state) => {
        const remoteEvents = state.events.filter((e) => e.id.startsWith('gl-'));
        const combined = [...localEvents, ...remoteEvents];
        combined.sort((a, b) => b.at - a.at);
        return { events: combined };
      });
    } catch (error: unknown) {
      useLogStore.getState().addLog('warning', 'System', `Failed to load local activity: ${getErrorMessage(error)}`);
    } finally {
      set({ isLoadingLocal: false });
    }
  },

  loadRemote: async (limit = 20) => {
    set({ isLoadingRemote: true });
    try {
      const { activeAccount } = useAccountStore.getState();
      const repos = useRepoStore.getState().repos;

      if (!activeAccount || activeAccount.provider !== 'gitlab') {
        return;
      }

      // Collect project paths from repo names/paths
      const projectPaths = repos.map((r) => r.name);

      const glEvents = await invoke<ActivityEvent[]>('get_gitlab_activity_cmd', {
        accountId: activeAccount.id,
        projectPaths,
        limit,
      });

      if (glEvents && glEvents.length > 0) {
        set((state) => {
          const localEvents = state.events.filter((e) => !e.id.startsWith('gl-'));
          const combined = [...localEvents, ...glEvents];
          combined.sort((a, b) => b.at - a.at);
          return { events: combined };
        });
      }
    } catch (error: unknown) {
      useLogStore.getState().addLog('warning', 'System', `Failed to load remote GitLab activity: ${getErrorMessage(error)}`);
    } finally {
      set({ isLoadingRemote: false });
    }
  },

  refresh: async () => {
    // 1. Instant local load
    await get().loadLocal();
    // 2. Async remote load in background
    get().loadRemote().catch(() => {});
  },
}));
