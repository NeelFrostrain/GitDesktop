import { invoke } from '@tauri-apps/api/core';
import { SavedAccount, TokenInfo, GitLabUser, GitHubUser, UnifiedRepo, PagedResult } from '../../types/gitlab';
import { ProviderAccount, AccountPatch, RemoteInfo } from '../../features/account-services/types';

/**
 * Typed client service for user account, authentication, and remote repo provider interactions.
 */
export class AccountService {
  /**
   * Fetches saved accounts list (legacy/unified format).
   */
  static async listSavedAccounts(): Promise<SavedAccount[]> {
    return invoke<SavedAccount[]>('list_accounts_cmd');
  }

  /**
   * Switches the active account to the specified account ID.
   */
  static async switchAccount(accountId: string): Promise<GitLabUser | null> {
    return invoke<GitLabUser | null>('switch_account_cmd', { accountId });
  }

  /**
   * Removes a saved account.
   */
  static async removeAccount(accountId: string): Promise<void> {
    return invoke('remove_account_cmd', { accountId });
  }

  /**
   * Updates display name or email for a saved account.
   */
  static async updateAccountInfo(accountId: string, name: string, email: string | null): Promise<void> {
    return invoke('update_account_info_cmd', { accountId, name, email });
  }

  /**
   * Logs out the current GitLab session.
   */
  static async logoutGitLab(): Promise<void> {
    return invoke('logout_gitlab');
  }

  /**
   * Fetches the current logged in GitLab user.
   */
  static async getCurrentGitLabUser(): Promise<GitLabUser | null> {
    return invoke<GitLabUser | null>('get_current_user');
  }

  /**
   * Fetches the current logged in GitHub user.
   */
  static async getGitHubUser(): Promise<GitHubUser | null> {
    return invoke<GitHubUser | null>('get_github_user');
  }

  /**
   * Retrieves token validity and expiration metadata.
   */
  static async getTokenInfo(accountId: string): Promise<TokenInfo> {
    return invoke<TokenInfo>('gitlab_get_token_info_cmd', { accountId });
  }

  /**
   * Refreshes OAuth token for an account if expiring.
   */
  static async ensureFreshToken(accountId: string): Promise<string> {
    return invoke<string>('gitlab_ensure_fresh_token', { accountId });
  }

  /**
   * Fetches user repositories from connected cloud provider (GitLab or GitHub).
   */
  static async fetchUserRepositories(page = 1, perPage = 20, search = ''): Promise<PagedResult<UnifiedRepo>> {
    return invoke<PagedResult<UnifiedRepo>>('fetch_user_repositories', {
      page,
      perPage,
      search: search || null,
    });
  }

  /**
   * Clones a remote repository to local destination directory.
   */
  static async cloneRepository(url: string, targetPath: string): Promise<string> {
    return invoke<string>('clone_repository', { url, targetPath });
  }

  // ── Multi-Provider Account Services ──────────────────────────────────────────

  /**
   * Lists all provider accounts.
   */
  static async listProviderAccounts(): Promise<ProviderAccount[]> {
    return invoke<ProviderAccount[]>('accounts_list');
  }

  /**
   * Sets active provider account, optionally scoping to the active repository path.
   */
  static async setActiveProviderAccount(accountId: string, activeRepoPath?: string | null): Promise<void> {
    return invoke('accounts_set_active', {
      accountId,
      activeRepoPath: activeRepoPath || null,
    });
  }

  /**
   * Updates a provider account's configuration patch.
   */
  static async updateProviderAccount(accountId: string, patch: AccountPatch): Promise<void> {
    return invoke('accounts_update', { accountId, patch });
  }

  /**
   * Removes a provider account.
   */
  static async removeProviderAccount(accountId: string): Promise<void> {
    return invoke('accounts_remove', { accountId });
  }

  /**
   * Initiates browser OAuth flow for a provider.
   */
  static async startProviderOAuth(provider: string, instanceUrl?: string | null): Promise<void> {
    return invoke('accounts_start_oauth', {
      provider,
      instanceUrl: instanceUrl?.trim() || null,
    });
  }

  /**
   * Lists remote repositories for a provider account.
   */
  static async listProviderRemotes(accountId: string, page = 1, perPage = 20, search = ''): Promise<RemoteInfo[]> {
    return invoke<RemoteInfo[]>('remotes_list', {
      accountId,
      page,
      perPage,
      search: search || null,
    });
  }
}
