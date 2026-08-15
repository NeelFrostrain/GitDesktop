import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { RepoEntry, RepoDashboardStatus } from '../types/home';
import { useGitStore } from './useGitStore';
import { useLogStore } from './useLogStore';

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

export const useRepoStore = create<RepoStoreState>((set, get) => ({
  repos: [],
  statuses: {},
  isLoading: false,

  loadRepos: async () => {
    set({ isLoading: true });
    try {
      const repos = await invoke<RepoEntry[]>('list_known_repos_cmd');
      set({ repos: repos || [] });

      // Fetch statuses in parallel (fast, local git2)
      if (repos && repos.length > 0) {
        repos.forEach((repo) => {
          get().refreshStatus(repo.path);
        });
      }
    } catch (err: any) {
      console.warn('Failed to list known repos:', err);
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
    } catch (err: any) {
      console.warn(`Failed to get status for '${path}':`, err);
    }
  },

  addRepo: async (path: string) => {
    set({ isLoading: true });
    try {
      const entry = await invoke<RepoEntry>('add_repo_to_registry_cmd', { path });
      await get().loadRepos();
      useLogStore.getState().addLog('info', 'Repo', `Added repository '${entry.name}' (${path})`);
      return entry;
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'Repo', `Failed to add repo: ${err?.message || err}`);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  removeRepo: async (id: string) => {
    try {
      await invoke('remove_repo_from_registry_cmd', { id });
      await get().loadRepos();
      useLogStore.getState().addLog('info', 'Repo', `Removed repository from dashboard`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'Repo', `Failed to remove repo: ${err?.message || err}`);
      throw err;
    }
  },

  pinRepo: async (id: string, pinned: boolean) => {
    try {
      await invoke('pin_repo_cmd', { id, pinned });
      await get().loadRepos();
    } catch (err: any) {
      console.warn('Failed to pin repo:', err);
    }
  },

  openRepo: async (path: string) => {
    const gitStore = useGitStore.getState();
    gitStore.setActiveRepoPath(path);
    gitStore.setCurrentNavView('changes');
    // Also touch last_opened_at in registry
    invoke('add_repo_to_registry_cmd', { path }).catch(() => {});
  },
}));
