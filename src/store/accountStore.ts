import { create } from 'zustand';
import { SavedAccount, TokenInfo, gitLabUserToUnified } from '../types/gitlab';
import { AccountService } from '../services/accounts/accountService';
import { getErrorMessage } from '../shared/utils/errorUtils';
import { useGitStore } from './useGitStore';
import { useLogStore } from './useLogStore';

/**
 * State and actions for legacy account credentials and OAuth token persistence.
 */
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

/**
 * Zustand store for managing authenticated accounts and OAuth token lifetimes.
 */
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
      const accounts = await AccountService.listSavedAccounts();
      const active = accounts.find((a) => a.is_active) || accounts[0] || null;
      set({ accounts: accounts || [], activeAccount: active });
      if (active) {
        get().fetchTokenInfo(active.id);
      }
    } catch (error: unknown) {
      useLogStore
        .getState()
        .addLog('warning', 'Auth', `Failed to fetch accounts: ${getErrorMessage(error)}`);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTokenInfo: async (accountId: string) => {
    try {
      const info = await AccountService.getTokenInfo(accountId);
      set({ tokenInfo: info });
    } catch {
      set({ tokenInfo: null });
    }
  },

  switchAccount: async (accountId: string) => {
    set({ isLoading: true });
    try {
      const gitLabUser = await AccountService.switchAccount(accountId);
      await get().fetchAccounts();
      if (gitLabUser) {
        useGitStore.getState().setUser(gitLabUserToUnified(gitLabUser));
      }
      useLogStore.getState().addLog('info', 'Auth', `Switched active account to '${accountId}'`);
    } catch (error: unknown) {
      useLogStore
        .getState()
        .addLog('error', 'Auth', `Failed to switch account: ${getErrorMessage(error)}`);
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async (accountId: string) => {
    set({ isLoading: true });
    try {
      await AccountService.removeAccount(accountId);
      await get().fetchAccounts();
      const { accounts } = get();
      if (accounts.length === 0) {
        useGitStore.getState().setUser(null);
      }
      useLogStore.getState().addLog('info', 'Auth', `Signed out account '${accountId}'`);
    } catch (error: unknown) {
      useLogStore
        .getState()
        .addLog('error', 'Auth', `Failed to sign out: ${getErrorMessage(error)}`);
    } finally {
      set({ isLoading: false });
    }
  },

  refreshToken: async (accountId: string) => {
    set({ isLoading: true });
    try {
      await AccountService.ensureFreshToken(accountId);
      await get().fetchAccounts();
      useLogStore.getState().addLog('info', 'Auth', `Refreshed token for '${accountId}'`);
    } catch (error: unknown) {
      useLogStore
        .getState()
        .addLog('error', 'Auth', `Failed to refresh token: ${getErrorMessage(error)}`);
    } finally {
      set({ isLoading: false });
    }
  },
}));
