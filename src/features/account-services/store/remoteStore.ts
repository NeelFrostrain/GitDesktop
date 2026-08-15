import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { RemoteInfo } from '../types';
import { useLogStore } from '../../../store/useLogStore';

interface RemoteServicesState {
  remotes: RemoteInfo[];
  activeRemote: string;
  isLoading: boolean;

  loadRemotes: (repoPath: string) => Promise<void>;
  addRemote: (repoPath: string, name: string, url: string) => Promise<void>;
  removeRemote: (repoPath: string, name: string) => Promise<void>;
  setRemoteUrl: (repoPath: string, name: string, url: string) => Promise<void>;
  setDefaultRemote: (repoPath: string, name: string) => Promise<void>;
}

export const useRemoteServicesStore = create<RemoteServicesState>((set, get) => ({
  remotes: [],
  activeRemote: 'origin',
  isLoading: false,

  loadRemotes: async (repoPath: string) => {
    if (!repoPath) return;
    set({ isLoading: true });
    try {
      const remotes = await invoke<RemoteInfo[]>('remotes_list', { repoPath });
      const list = remotes || [];
      const defaultRemote = list.find((r) => r.is_default)?.name || list[0]?.name || 'origin';
      set({ remotes: list, activeRemote: defaultRemote });
    } catch (err: any) {
      console.warn('Failed to load remotes:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  addRemote: async (repoPath: string, name: string, url: string) => {
    try {
      await invoke('remotes_add', { repoPath, name, url });
      await get().loadRemotes(repoPath);
      useLogStore.getState().addLog('info', 'Remote', `Added remote '${name}' -> ${url}`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'Remote', `Failed to add remote: ${err?.message || err}`);
      throw err;
    }
  },

  removeRemote: async (repoPath: string, name: string) => {
    try {
      await invoke('remotes_remove', { repoPath, name });
      await get().loadRemotes(repoPath);
      useLogStore.getState().addLog('info', 'Remote', `Removed remote '${name}'`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'Remote', `Failed to remove remote: ${err?.message || err}`);
      throw err;
    }
  },

  setRemoteUrl: async (repoPath: string, name: string, url: string) => {
    try {
      await invoke('remotes_set_url', { repoPath, name, url });
      await get().loadRemotes(repoPath);
      useLogStore.getState().addLog('info', 'Remote', `Updated URL for remote '${name}' -> ${url}`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'Remote', `Failed to set remote URL: ${err?.message || err}`);
      throw err;
    }
  },

  setDefaultRemote: async (repoPath: string, name: string) => {
    try {
      await invoke('remotes_set_default', { repoPath, name });
      await get().loadRemotes(repoPath);
    } catch (err: any) {
      console.warn('Failed to set default remote:', err);
    }
  },
}));
