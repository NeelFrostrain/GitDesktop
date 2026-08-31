import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { GpgKeyInfo, SshKeyInfo, SigningConfig, VerifyResult } from '../types/git';
import { getErrorMessage } from '../shared/utils/errorUtils';
import { useLogStore } from './useLogStore';

/**
 * State and actions for GPG and SSH commit cryptographic signing.
 */
interface SigningState {
  gpgKeys: GpgKeyInfo[];
  sshKeys: SshKeyInfo[];
  config: SigningConfig | null;
  verifiedCommits: Record<string, VerifyResult>;
  isLoading: boolean;
  isSigningSettingsOpen: boolean;

  setIsSigningSettingsOpen: (open: boolean) => void;
  loadKeys: () => Promise<void>;
  loadConfig: (repoPath: string) => Promise<void>;
  saveConfig: (repoPath: string, config: SigningConfig) => Promise<void>;
  verifyCommit: (repoPath: string, sha: string) => Promise<VerifyResult>;
}

/**
 * Zustand store managing commit signing configuration and verification cache.
 */
export const useSigningStore = create<SigningState>((set, get) => ({
  gpgKeys: [],
  sshKeys: [],
  config: null,
  verifiedCommits: {},
  isLoading: false,
  isSigningSettingsOpen: false,

  setIsSigningSettingsOpen: (isSigningSettingsOpen) => set({ isSigningSettingsOpen }),

  loadKeys: async () => {
    set({ isLoading: true });
    try {
      const [gpg, ssh] = await Promise.all([
        invoke<GpgKeyInfo[]>('signing_list_gpg_keys_cmd').catch(() => []),
        invoke<SshKeyInfo[]>('signing_list_ssh_keys_cmd').catch(() => []),
      ]);
      set({ gpgKeys: gpg || [], sshKeys: ssh || [] });
    } catch (error: unknown) {
      useLogStore
        .getState()
        .addLog('warning', 'Git', `Failed to load signing keys: ${getErrorMessage(error)}`);
    } finally {
      set({ isLoading: false });
    }
  },

  loadConfig: async (repoPath: string) => {
    if (!repoPath) return;
    try {
      const config = await invoke<SigningConfig>('signing_get_config_cmd', { repoPath });
      set({ config });
    } catch (error: unknown) {
      useLogStore
        .getState()
        .addLog('warning', 'Git', `Failed to load signing config: ${getErrorMessage(error)}`);
    }
  },

  saveConfig: async (repoPath: string, config: SigningConfig) => {
    set({ isLoading: true });
    try {
      await invoke('signing_set_config_cmd', { repoPath, config });
      set({ config });
      useLogStore
        .getState()
        .addLog(
          'info',
          'Git',
          `Commit signing ${config.enabled ? 'enabled' : 'disabled'} (${config.method.toUpperCase()}, ${config.scope} scope)`
        );
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Git', `Failed to save signing config: ${msg}`);
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  verifyCommit: async (repoPath: string, sha: string) => {
    if (!sha || !repoPath) return { status: 'NoSignature' };
    const cached = get().verifiedCommits[sha];
    if (cached) return cached;

    try {
      const result = await invoke<VerifyResult>('signing_verify_commit_cmd', { repoPath, sha });
      set((state) => ({
        verifiedCommits: { ...state.verifiedCommits, [sha]: result },
      }));
      return result;
    } catch {
      const fallback: VerifyResult = { status: 'NoSignature' };
      set((state) => ({
        verifiedCommits: { ...state.verifiedCommits, [sha]: fallback },
      }));
      return fallback;
    }
  },
}));
