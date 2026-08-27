import React, { useEffect } from 'react';
import { X, Users, Plus, FolderGit2 } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { AccountService } from '../../services/accounts/accountService';
import { AccountsTab } from './repo/AccountsTab';
import { AddAccountTab } from './repo/AddAccountTab';
import { RemoteReposTab } from './repo/RemoteReposTab';

/**
 * Top-level Account & Remote Repository Modal orchestrator.
 * Decomposed into focused tabs for Accounts management, Authentication, and Remote browsing.
 */
export const RepoModal: React.FC = () => {
  const {
    accounts,
    setAccounts,
    isRepoModalOpen,
    setIsRepoModalOpen,
    activeModalTab,
    setActiveModalTab,
  } = useGitStore();

  const loadAccounts = async () => {
    try {
      const accs = await AccountService.listSavedAccounts();
      setAccounts(Array.isArray(accs) ? accs : []);
    } catch {
      setAccounts([]);
    }
  };

  useEffect(() => {
    if (isRepoModalOpen) {
      loadAccounts();
    }
  }, [isRepoModalOpen]);

  if (!isRepoModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-base-0 border border-border rounded-sm shadow-2xl w-[620px] max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 border border-commito-coral/30">
              <FolderGit2 className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-bold text-text-primary leading-none truncate">
                Accounts & Remote Repositories
              </h3>
              <span className="text-border hidden sm:inline">•</span>
              <span className="text-[11px] text-text-muted truncate hidden sm:inline font-mono">
                {accounts.length} linked account{accounts.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsRepoModalOpen(false)}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border px-5 bg-base-1/50 gap-4">
          <button
            type="button"
            onClick={() => setActiveModalTab('accounts')}
            className={`flex items-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeModalTab === 'accounts'
                ? 'border-commito-coral text-commito-coral'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Accounts ({accounts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveModalTab('login')}
            className={`flex items-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeModalTab === 'login'
                ? 'border-commito-coral text-commito-coral'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Account
          </button>

          <button
            type="button"
            onClick={() => setActiveModalTab('repos')}
            className={`flex items-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeModalTab === 'repos'
                ? 'border-commito-coral text-commito-coral'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            Browse Remote Repos
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {activeModalTab === 'accounts' && (
            <AccountsTab accounts={accounts} onRefreshAccounts={loadAccounts} />
          )}

          {activeModalTab === 'login' && <AddAccountTab onAccountAdded={loadAccounts} />}

          {activeModalTab === 'repos' && <RemoteReposTab />}
        </div>
      </div>
    </div>
  );
};
