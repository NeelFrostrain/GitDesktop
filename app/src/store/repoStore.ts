import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { RepoEntry, RepoDashboardStatus } from '../types/home';
import { getErrorMessage } from '../shared/utils/errorUtils';
import { useGitStore } from './useGitStore';
import { useLogStore } from './useLogStore';
import { useContributionsStore } from './contributionsStore';
import { GitService } from '../services/git/gitService';
import { RepoCacheService } from '../services/git/repoCacheService';

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
  relocateRepo: (oldPath: string, newPath: string) => Promise<RepoEntry>;
  removeInvalidRepos: () => Promise<string[]>;
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

      // Trigger contribution calendar sync
      useContributionsStore
        .getState()
        .loadContributions()
        .catch(() => {});

      // Fetch statuses in parallel (fast local git2 inspection)
      if (repos && repos.length > 0) {
        repos.forEach((repo) => {
          get().refreshStatus(repo.path);
        });
      }
    } catch (error: unknown) {
      useLogStore
        .getState()
        .addLog('warning', 'Repo', `Failed to list known repos: ${getErrorMessage(error)}`);
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
      useLogStore
        .getState()
        .addLog('warning', 'Repo', `Failed to get status for '${path}': ${getErrorMessage(error)}`);
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

  relocateRepo: async (oldPath: string, newPath: string) => {
    try {
      const updated = await GitService.relocateRepo(oldPath, newPath);
      await get().loadRepos();
      useLogStore.getState().addLog('info', 'Repo', `Relocated repository to '${newPath}'`);
      return updated;
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Repo', `Failed to relocate repo: ${msg}`);
      throw new Error(msg);
    }
  },

  removeInvalidRepos: async () => {
    try {
      const removed = await GitService.removeInvalidRepos();
      await get().loadRepos();
      useLogStore
        .getState()
        .addLog(
          'info',
          'Repo',
          `Cleaned up ${removed.length} missing/invalid repositories from workspace`
        );
      return removed;
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Repo', `Failed to clean invalid repos: ${msg}`);
      throw new Error(msg);
    }
  },

  pinRepo: async (id: string, pinned: boolean) => {
    try {
      await invoke('pin_repo_cmd', { id, pinned });
      await get().loadRepos();
    } catch (error: unknown) {
      useLogStore
        .getState()
        .addLog('warning', 'Repo', `Failed to pin repo: ${getErrorMessage(error)}`);
    }
  },

  openRepo: async (path: string) => {
    if (!path) return;
    const gitStore = useGitStore.getState();

    // 1. If already known to be invalid from dashboard status inspection, block immediately
    const knownStatus = get().statuses[path];
    if (knownStatus && knownStatus.is_valid === false) {
      gitStore.setIsMissingRepoModalOpen(
        true,
        path,
        knownStatus.error_message || 'Directory or .git metadata missing'
      );
      return;
    }

    gitStore.setActiveRepoPath(path);
    gitStore.setCurrentNavView('changes');

    // 2. Validate path asynchronously
    GitService.validateRepoPath(path)
      .then((validation) => {
        if (validation && validation.is_valid === false) {
          get().refreshStatus(path);
          gitStore.setIsMissingRepoModalOpen(
            true,
            path,
            validation.error_message || 'Directory or .git metadata missing'
          );
        }
      })
      .catch(() => {});

    try {
      const res = await GitService.getRepoStatus(path);
      gitStore.setStatus(res);
      if (res.files.length > 0) {
        gitStore.setSelectedFile(res.files[0].path);
      }

      // Background remote existence verification
      if (res.has_remote) {
        GitService.fetchRemote(path).catch((fetchErr: unknown) => {
          const msg = getErrorMessage(fetchErr).toLowerCase();
          if (
            msg.includes('not found') ||
            msg.includes('deleted') ||
            msg.includes('could not read from remote') ||
            msg.includes('does not appear to be a git repository')
          ) {
            gitStore.setStatus({
              ...res,
              has_remote: false,
              remote_url: null,
            });
            useLogStore
              .getState()
              .addLog(
                'warning',
                'Remote',
                'Remote repository was not found on server (it may have been deleted). You can now Publish this repository to link a new remote.'
              );
          }
        });
      }
    } catch (error: unknown) {
      useLogStore
        .getState()
        .addLog('warning', 'Git', `Could not inspect repo on open: ${getErrorMessage(error)}`);
    }

    // Touch last_opened_at timestamp in backend registry
    invoke('add_repo_to_registry_cmd', { path }).catch(() => {});

    // Pre-cache all cloud and local repository metadata in background
    RepoCacheService.precacheRepository(path).catch(() => {});
  },
}));
