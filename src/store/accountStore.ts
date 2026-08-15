import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { SavedAccount, TokenInfo, gitLabUserToUnified } from '../types/gitlab';
import { useGitStore } from './useGitStore';
import { useLogStore } from './useLogStore';

interface AccountState {
  accounts: SavedAccount[];
  activeAccount: SavedAccount | null;
  tokenInfo: TokenInfo | null;
  isLoading: boolean;
  isAccountPanelOpen: boolean;
  isSignInModalOpen: boolean;

  setIsAccountPanelOpen: (open: boolean) => void;
  setIsSignInModalOpen: (open: boolean) => void;
  fetchAccounts: () => Promise<void>;
  fetchTokenInfo: (accountId: string) => Promise<void>;
  switchAccount: (accountId: string) => Promise<void>;
  signOut: (accountId: string) => Promise<void>;
  refreshToken: (accountId: string) => Promise<void>;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  activeAccount: null,
  tokenInfo: null,
  isLoading: false,
  isAccountPanelOpen: false,
  isSignInModalOpen: false,

  setIsAccountPanelOpen: (isAccountPanelOpen) => set({ isAccountPanelOpen }),
  setIsSignInModalOpen: (isSignInModalOpen) => set({ isSignInModalOpen }),

  fetchAccounts: async () => {
    set({ isLoading: true });
    try {
      const accounts = await invoke<SavedAccount[]>('list_accounts_cmd');
      const active = accounts.find((a) => a.is_active) || accounts[0] || null;
      set({ accounts: accounts || [], activeAccount: active });
      if (active) {
        get().fetchTokenInfo(active.id);
      }
    } catch (err: any) {
      console.warn('Failed to fetch accounts:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTokenInfo: async (accountId: string) => {
    try {
      const info = await invoke<TokenInfo>('gitlab_get_token_info_cmd', { accountId });
      set({ tokenInfo: info });
    } catch {
      set({ tokenInfo: null });
    }
  },

  switchAccount: async (accountId: string) => {
    set({ isLoading: true });
    try {
      const glUser = await invoke<any>('switch_account_cmd', { accountId });
      await get().fetchAccounts();
      if (glUser) {
        useGitStore.getState().setUser(gitLabUserToUnified(glUser));
      }
      useLogStore.getState().addLog('info', 'Auth', `Switched active account to '${accountId}'`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'Auth', `Failed to switch account: ${err?.message || err}`);
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async (accountId: string) => {
    set({ isLoading: true });
    try {
      await invoke('remove_account_cmd', { accountId });
      await get().fetchAccounts();
      const { accounts } = get();
      if (accounts.length === 0) {
        useGitStore.getState().setUser(null);
      }
      useLogStore.getState().addLog('info', 'Auth', `Signed out account '${accountId}'`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'Auth', `Failed to sign out: ${err?.message || err}`);
    } finally {
      set({ isLoading: false });
    }
  },

  refreshToken: async (accountId: string) => {
    set({ isLoading: true });
    try {
      await invoke<string>('gitlab_ensure_fresh_token', { accountId });
      await get().fetchAccounts();
      useLogStore.getState().addLog('info', 'Auth', `Refreshed token for '${accountId}'`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'Auth', `Failed to refresh token: ${err?.message || err}`);
    } finally {
      set({ isLoading: false });
    }
  },
}));
