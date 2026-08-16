import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { RepoEntry, RepoDashboardStatus } from '../types/home';
import { getErrorMessage } from '../shared/utils/errorUtils';
import { useGitStore } from './useGitStore';
import { useLogStore } from './useLogStore';

/**
 * State and actions for managing the local repository registry and dashboard summaries.
 */
interface RepoStoreState {
  repos: RepoEntry[];
  statuses: Record<string, RepoDashboardStatus>;
  isLoading: boolean;

  loadRepos: () => Promise<void>;
  refreshStatus: (path: string) => Promise<void>;
  addRepo: (path: string) => Promise<RepoEntry>;
  removeRepo: (id: string) => Promise<void>;
  pinRepo: (id: string, pinned: boolean) => Promise<void>;
  openRepo: (path: string) => Promise<void>;
}

/**
 * Zustand store managing known repositories registry and dashboard quick-status summaries.
 */
export const useRepoStore = create<RepoStoreState>((set, get) => ({
  repos: [],
  statuses: {},
  isLoading: false,

  loadRepos: async () => {
    set({ isLoading: true });
    try {
      const repos = await invoke<RepoEntry[]>('list_known_repos_cmd');
      set({ repos: repos || [] });

      // Fetch statuses in parallel (fast local git2 inspection)
      if (repos && repos.length > 0) {
        repos.forEach((repo) => {
          get().refreshStatus(repo.path);
        });
      }
    } catch (error: unknown) {
      useLogStore.getState().addLog('warning', 'Repo', `Failed to list known repos: ${getErrorMessage(error)}`);
    } finally {
      set({ isLoading: false });
    }
  },

  refreshStatus: async (path: string) => {
    if (!path) return;
    try {
      const status = await invoke<RepoDashboardStatus>('get_repo_dashboard_status_cmd', { path });
      set((state) => ({
        statuses: { ...state.statuses, [path]: status },
      }));
    } catch (error: unknown) {
      useLogStore.getState().addLog('warning', 'Repo', `Failed to get status for '${path}': ${getErrorMessage(error)}`);
    }
  },

  addRepo: async (path: string) => {
    set({ isLoading: true });
    try {
      const entry = await invoke<RepoEntry>('add_repo_to_registry_cmd', { path });
      await get().loadRepos();
      useLogStore.getState().addLog('info', 'Repo', `Added repository '${entry.name}' (${path})`);
      return entry;
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Repo', `Failed to add repo: ${msg}`);
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  removeRepo: async (id: string) => {
    try {
      await invoke('remove_repo_from_registry_cmd', { id });
      await get().loadRepos();
      useLogStore.getState().addLog('info', 'Repo', 'Removed repository from dashboard');
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Repo', `Failed to remove repo: ${msg}`);
      throw new Error(msg);
    }
  },

  pinRepo: async (id: string, pinned: boolean) => {
    try {
      await invoke('pin_repo_cmd', { id, pinned });
      await get().loadRepos();
    } catch (error: unknown) {
      useLogStore.getState().addLog('warning', 'Repo', `Failed to pin repo: ${getErrorMessage(error)}`);
    }
  },

  openRepo: async (path: string) => {
    const gitStore = useGitStore.getState();
    gitStore.setActiveRepoPath(path);
    gitStore.setCurrentNavView('changes');
    // Touch last_opened_at timestamp in backend registry
    invoke('add_repo_to_registry_cmd', { path }).catch(() => {});
  },
}));
