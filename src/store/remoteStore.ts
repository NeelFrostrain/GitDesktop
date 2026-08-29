import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { RemoteInfo, PullResult } from '../types/git';
import { getErrorMessage } from '../shared/utils/errorUtils';
import { useGitStore } from './useGitStore';
import { useLogStore } from './useLogStore';

/**
 * State and actions for managing Git remotes (origin, upstream, forks) for active repository.
 */
interface RemoteState {
  remotes: RemoteInfo[];
  activeRemote: string;
  isLoading: boolean;
  isRemoteManagerOpen: boolean;

  setIsRemoteManagerOpen: (open: boolean) => void;
  setActiveRemote: (remote: string) => void;
  loadRemotes: (repoPath: string) => Promise<void>;
  addRemote: (repoPath: string, name: string, url: string) => Promise<void>;
  removeRemote: (repoPath: string, name: string) => Promise<void>;
  renameRemote: (repoPath: string, oldName: string, newName: string) => Promise<void>;
  setRemoteUrl: (repoPath: string, name: string, url: string, isPush: boolean) => Promise<void>;
  fetchRemote: (repoPath: string, remoteName?: string) => Promise<void>;
  pushRemote: (
    repoPath: string,
    remoteName: string,
    branchName: string,
    force?: boolean
  ) => Promise<void>;
  pullRemote: (repoPath: string, remoteName: string, branchName: string) => Promise<PullResult>;
}

/**
 * Zustand store managing configured Git remotes for the local repository.
 */
export const useRemoteStore = create<RemoteState>((set, get) => ({
  remotes: [],
  activeRemote: 'origin',
  isLoading: false,
  isRemoteManagerOpen: false,

  setIsRemoteManagerOpen: (isRemoteManagerOpen) => set({ isRemoteManagerOpen }),
  setActiveRemote: (activeRemote) => set({ activeRemote }),

  loadRemotes: async (repoPath: string) => {
    if (!repoPath) return;
    set({ isLoading: true });
    try {
      const remotes = await invoke<RemoteInfo[]>('list_remotes_cmd', { repoPath });
      set({ remotes: remotes || [] });
      const currentActive = get().activeRemote;
      if (remotes && remotes.length > 0 && !remotes.some((r) => r.name === currentActive)) {
        set({ activeRemote: remotes[0].name });
      }
    } catch (error: unknown) {
      useLogStore
        .getState()
        .addLog('warning', 'Git', `Failed to load remotes: ${getErrorMessage(error)}`);
    } finally {
      set({ isLoading: false });
    }
  },

  addRemote: async (repoPath: string, name: string, url: string) => {
    set({ isLoading: true });
    try {
      await invoke('add_remote_cmd', { repoPath, name, url });
      await get().loadRemotes(repoPath);
      set({ activeRemote: name });
      useLogStore.getState().addLog('info', 'Git', `Added remote '${name}' (${url})`);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Git', `Failed to add remote: ${msg}`);
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  removeRemote: async (repoPath: string, name: string) => {
    set({ isLoading: true });
    try {
      await invoke('remove_remote_cmd', { repoPath, name });
      await get().loadRemotes(repoPath);
      useLogStore.getState().addLog('info', 'Git', `Removed remote '${name}'`);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Git', `Failed to remove remote: ${msg}`);
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  renameRemote: async (repoPath: string, oldName: string, newName: string) => {
    set({ isLoading: true });
    try {
      await invoke('rename_remote_cmd', { repoPath, oldName, newName });
      await get().loadRemotes(repoPath);
      if (get().activeRemote === oldName) {
        set({ activeRemote: newName });
      }
      useLogStore.getState().addLog('info', 'Git', `Renamed remote '${oldName}' to '${newName}'`);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Git', `Failed to rename remote: ${msg}`);
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  setRemoteUrl: async (repoPath: string, name: string, url: string, isPush: boolean) => {
    set({ isLoading: true });
    try {
      await invoke('set_remote_url_cmd', { repoPath, name, url, isPush });
      await get().loadRemotes(repoPath);
      useLogStore
        .getState()
        .addLog('info', 'Git', `Updated ${isPush ? 'push ' : ''}URL for remote '${name}'`);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Git', `Failed to set remote URL: ${msg}`);
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRemote: async (repoPath: string, remoteName?: string) => {
    const target = remoteName || get().activeRemote;
    useGitStore.getState().setIsFetching(true);
    try {
      await invoke('fetch_specific_remote_cmd', { repoPath, remoteName: target || '' });
      await get().loadRemotes(repoPath);
      useLogStore
        .getState()
        .addLog('info', 'Git', `Fetched changes from remote '${target || 'all'}'`);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Git', `Failed to fetch remote: ${msg}`);
      throw new Error(msg);
    } finally {
      useGitStore.getState().setIsFetching(false);
    }
  },

  pushRemote: async (repoPath: string, remoteName: string, branchName: string, force = false) => {
    useGitStore.getState().setIsPushing(true);
    try {
      await invoke('push_specific_remote_cmd', { repoPath, remoteName, branchName, force });
      await get().loadRemotes(repoPath);
      useLogStore
        .getState()
        .addLog('info', 'Git', `Pushed branch '${branchName}' to remote '${remoteName}'`);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Git', `Failed to push: ${msg}`);
      throw new Error(msg);
    } finally {
      useGitStore.getState().setIsPushing(false);
    }
  },

  pullRemote: async (repoPath: string, remoteName: string, branchName: string) => {
    useGitStore.getState().setIsPulling(true);
    try {
      const result = await invoke<PullResult>('pull_specific_remote_cmd', {
        repoPath,
        remoteName,
        branchName,
      });
      await get().loadRemotes(repoPath);
      useLogStore
        .getState()
        .addLog(
          'info',
          'Git',
          `Pulled ${result.commits_pulled} commit(s) from '${remoteName}/${branchName}'`
        );
      return result;
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Git', `Failed to pull: ${msg}`);
      throw new Error(msg);
    } finally {
      useGitStore.getState().setIsPulling(false);
    }
  },
}));
