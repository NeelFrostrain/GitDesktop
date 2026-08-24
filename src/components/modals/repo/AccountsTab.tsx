import React, { useState } from 'react';
import { User, Check, Edit2, Trash2, Save, X } from 'lucide-react';
import { SavedAccount, gitHubUserToUnified, gitLabUserToUnified } from '../../../types/gitlab';
import { useGitStore } from '../../../store/useGitStore';
import { useLogStore } from '../../../store/useLogStore';
import { AccountService } from '../../../services/accounts/accountService';
import { UserAvatar } from '../../common/UserAvatar';
import { getErrorMessage, toAppError } from '../../../shared/utils/errorUtils';
import { invoke } from '@tauri-apps/api/core';

interface AccountsTabProps {
  accounts: SavedAccount[];
  onRefreshAccounts: () => Promise<void>;
}

/**
 * Accounts management tab inside the Repository / Account manager modal.
 */
export const AccountsTab: React.FC<AccountsTabProps> = ({ accounts, onRefreshAccounts }) => {
  const { user, setUser, activeRepoPath, setError } = useGitStore();
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const handleStartEdit = (account: SavedAccount) => {
    setEditingAccountId(account.id);
    setEditName(account.name);
    setEditEmail(account.email || '');
  };

  const handleSaveAccountInfo = async (accountId: string) => {
    try {
      await AccountService.updateAccountInfo(accountId, editName, editEmail || null);
      setEditingAccountId(null);
      await onRefreshAccounts();

      // Refresh active user state
      const refreshedAccounts = await AccountService.listSavedAccounts();
      const active = refreshedAccounts?.find((a) => a.is_active);
      if (active?.provider === 'github') {
        const u = await AccountService.getGitHubUser();
        if (u) setUser(gitHubUserToUnified(u));
      } else {
        const u = await AccountService.getCurrentGitLabUser();
        if (u) setUser(gitLabUserToUnified(u));
      }
      useLogStore.getState().addLog('success', 'Auth', `Updated profile info for account '${accountId}'.`);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      setError(toAppError(error, 'AUTH_ERROR'));
      useLogStore.getState().addLog('error', 'Auth', `Failed to update account info: ${msg}`, msg);
    }
  };

  const handleSwitchAccount = async (accountId: string) => {
    useLogStore.getState().addLog('info', 'Auth', `Switching active account to '${accountId}'...`);
    try {
      const currentAccounts = await AccountService.listSavedAccounts();
      const target = currentAccounts?.find((a) => a.id === accountId);
      await AccountService.switchAccount(accountId);

      if (activeRepoPath) {
        await invoke('set_repo_account_cmd', { repoPath: activeRepoPath, accountId });
      }

      await onRefreshAccounts();

      if (target?.provider === 'github') {
        const u = await AccountService.getGitHubUser();
        if (u) setUser(gitHubUserToUnified(u));
      } else {
        const u = await AccountService.getCurrentGitLabUser();
        if (u) setUser(gitLabUserToUnified(u));
      }
      useLogStore.getState().addLog('success', 'Auth', `Switched active account to '${accountId}'.`);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      setError(toAppError(error, 'AUTH_ERROR'));
      useLogStore.getState().addLog('error', 'Auth', `Failed to switch account: ${msg}`, msg);
    }
  };

  const handleRemoveAccount = async (accountId: string) => {
    useLogStore.getState().addLog('info', 'Auth', `Removing account '${accountId}'...`);
    try {
      await AccountService.removeAccount(accountId);
      await onRefreshAccounts();

      const remainingAccounts = await AccountService.listSavedAccounts();
      const active = remainingAccounts?.find((a) => a.is_active);
      if (active?.provider === 'github') {
        const u = await AccountService.getGitHubUser();
        setUser(u ? gitHubUserToUnified(u) : null);
      } else {
        const u = await AccountService.getCurrentGitLabUser();
        setUser(u ? gitLabUserToUnified(u) : null);
      }
      useLogStore.getState().addLog('success', 'Auth', `Removed account '${accountId}'.`);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      setError(toAppError(error, 'AUTH_ERROR'));
      useLogStore.getState().addLog('error', 'Auth', `Failed to remove account: ${msg}`, msg);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-sm bg-base-1">
        <User className="w-12 h-12 text-text-muted mb-3 opacity-40" />
        <h4 className="text-sm font-semibold text-text-primary mb-1">No Accounts Connected</h4>
        <p className="text-xs text-text-muted max-w-sm mb-4">
          Add a GitLab or GitHub account to clone repositories, view merge requests, and manage remotes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => {
        const isActive = account.is_active || (user && String(user.id) === String(account.id));
        const isEditing = editingAccountId === account.id;

        return (
          <div
            key={account.id}
            className={`p-3.5 rounded-sm border transition-all ${
              isActive
                ? 'bg-base-2 border-commito-coral/40 shadow-sm ring-1 ring-commito-coral/20'
                : 'bg-base-1 border-border hover:border-text-muted/30'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar
                  name={account.name}
                  email={account.email || undefined}
                  url={account.avatar_url}
                  provider={account.provider}
                  className="w-9 h-9"
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-text-primary truncate">
                      {account.name || account.username}
                    </span>
                    <span className="text-xs text-text-muted">@{account.username}</span>

                    {/* Provider badge */}
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        account.provider === 'github'
                          ? 'bg-purple-950/60 text-purple-300 border border-purple-800/40'
                          : 'bg-orange-950/60 text-orange-300 border border-orange-800/40'
                      }`}
                    >
                      {account.provider === 'github' ? 'GitHub' : 'GitLab'}
                    </span>

                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-commito-coral/15 text-commito-coral px-1.5 py-0.5 rounded font-medium border border-commito-coral/20">
                        <Check className="w-2.5 h-2.5" />
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                    {account.email && <span>{account.email}</span>}
                    {account.server_url && (
                      <span className="text-[11px] opacity-70 font-mono">
                        {account.server_url.replace(/^https?:\/\//, '')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {!isActive && (
                  <button
                    onClick={() => handleSwitchAccount(account.id)}
                    className="text-xs px-2.5 py-1 rounded bg-base-2 hover:bg-base-3 border border-border text-text-secondary hover:text-text-primary transition cursor-pointer"
                  >
                    Switch to
                  </button>
                )}

                <button
                  onClick={() => handleStartEdit(account)}
                  className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded transition cursor-pointer"
                  title="Edit display name / email"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleRemoveAccount(account.id)}
                  className="p-1 text-text-muted hover:text-git-removed hover:bg-git-removed-bg rounded transition cursor-pointer"
                  title="Remove account"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Inline edit details drawer */}
            {isEditing && (
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Display Name"
                  className="flex-1 bg-base-0 border border-border rounded px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-commito-coral"
                />
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email"
                  className="flex-1 bg-base-0 border border-border rounded px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-commito-coral"
                />
                <button
                  onClick={() => handleSaveAccountInfo(account.id)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-commito-coral text-white hover:bg-commito-coralLight transition cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  Save
                </button>
                <button
                  onClick={() => setEditingAccountId(null)}
                  className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
