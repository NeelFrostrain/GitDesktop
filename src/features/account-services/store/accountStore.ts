import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ProviderAccount, AccountPatch } from '../types';
import { useGitStore } from '../../../store/useGitStore';
import { useLogStore } from '../../../store/useLogStore';
import { avatarCache } from '../../../services/accounts/avatarCacheService';

interface AccountServicesState {
  accounts: ProviderAccount[];
  activeAccount: ProviderAccount | null;
  isLoading: boolean;
  isModalOpen: boolean;
  activeTab: 'accounts' | 'add';

  setIsModalOpen: (open: boolean) => void;
  setActiveTab: (tab: 'accounts' | 'add') => void;
  openModalWithTab: (tab: 'accounts' | 'add') => void;

  loadAccounts: () => Promise<void>;
  setActiveAccount: (id: string) => Promise<void>;
  updateAccount: (id: string, patch: AccountPatch) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  startOAuth: (provider: string, instanceUrl?: string) => Promise<void>;
}

export const useAccountServicesStore = create<AccountServicesState>((set, get) => ({
  accounts: [],
  activeAccount: null,
  isLoading: false,
  isModalOpen: false,
  activeTab: 'accounts',

  setIsModalOpen: (open) => set({ isModalOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  openModalWithTab: (tab) => set({ isModalOpen: true, activeTab: tab }),

  loadAccounts: async () => {
    set({ isLoading: true });
    try {
      const accounts = await invoke<ProviderAccount[]>('accounts_list');
      const list = accounts || [];
      const active = list.find((a) => a.is_active) || list[0] || null;

      set({ accounts: list, activeAccount: active });

      // Pre-warm avatar cache for all connected accounts in background
      const prefetchUrls: string[] = [];
      for (const a of list) {
        if (a.avatar_url) prefetchUrls.push(a.avatar_url);
        const handle = (a.display_name || a.handle || '')
          .replace(/\s+/g, '')
          .replace(/^@+/, '')
          .toLowerCase();
        if (handle) {
          if (a.provider === 'github') {
            prefetchUrls.push(`https://github.com/${handle}.png`);
            prefetchUrls.push(`https://avatars.githubusercontent.com/${handle}`);
          } else if (a.provider === 'gitlab') {
            prefetchUrls.push(`https://gitlab.com/${handle}.png`);
          }
        }
      }
      if (prefetchUrls.length > 0) {
        avatarCache.prefetchAvatars(prefetchUrls).catch(() => {});
      }

      // Sync with global user store
      if (active) {
        useGitStore.getState().setUser({
          id: active.id,
          name: active.display_name,
          username: active.handle.replace(/^@/, ''),
          email: active.commit_email,
          avatar_url: active.avatar_url,
          provider: active.provider,
          server_url: active.instance_url,
          web_url: active.instance_url,
        });
      }

      // Sync contribution calendar with updated accounts
      import('../../../store/contributionsStore').then((m) => {
        m.useContributionsStore.getState().loadContributions().catch(() => {});
      });
    } catch (err: any) {
      console.warn('Failed to load accounts:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveAccount: async (id: string) => {
    try {
      const repoPath = useGitStore.getState().activeRepoPath;
      await invoke('accounts_set_active', {
        accountId: id,
        activeRepoPath: repoPath || null,
      });
      await get().loadAccounts();
      useLogStore.getState().addLog('info', 'Auth', `Switched active account to ${id}`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'Auth', `Failed to switch account: ${err?.message || err}`);
      throw err;
    }
  },

  updateAccount: async (id: string, patch: AccountPatch) => {
    try {
      await invoke('accounts_update', { accountId: id, patch });
      await get().loadAccounts();
      useLogStore.getState().addLog('info', 'Auth', `Updated account details for ${id}`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'Auth', `Failed to update account: ${err?.message || err}`);
      throw err;
    }
  },

  removeAccount: async (id: string) => {
    try {
      await invoke('accounts_remove', { accountId: id });
      await get().loadAccounts();
      useLogStore.getState().addLog('info', 'Auth', `Removed account ${id}`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'Auth', `Failed to remove account: ${err?.message || err}`);
      throw err;
    }
  },

  startOAuth: async (provider: string, instanceUrl?: string) => {
    try {
      await invoke('accounts_start_oauth', {
        provider,
        instanceUrl: instanceUrl?.trim() || null,
      });
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'Auth', `Failed to start OAuth: ${err?.message || err}`);
      throw err;
    }
  },
}));
