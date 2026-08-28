import React from 'react';
import { Plus, Users } from 'lucide-react';
import { AccountRow } from '../components/AccountRow';
import { useAccountServicesStore } from '../store/accountStore';

export const AccountsTab: React.FC = () => {
  const { accounts, setActiveTab } = useAccountServicesStore();

  return (
    <div className="space-y-4 select-none font-sans">
      {/* Content Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5 min-w-0">
          <h3 className="text-[13px] font-semibold text-text tracking-normal">
            Saved Accounts & Identities
          </h3>
          <p className="text-xs text-text-muted">
            Switch active account to change default commit author and remote sync identity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('add')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-commito-coral hover:bg-commito-coral-hover text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Unified Connected Accounts List Container */}
      {accounts.length > 0 ? (
        <div className="rounded-lg border border-border-subtle bg-surface-elevated/50 overflow-hidden divide-y divide-border-subtle/80 shadow-xs">
          {accounts.map((acc) => (
            <AccountRow key={acc.id} account={acc} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="py-12 px-6 border border-dashed border-border-subtle rounded-lg bg-surface-elevated/20 text-center space-y-3">
          <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-border-subtle flex items-center justify-center mx-auto text-commito-coral shadow-2xs">
            <Users className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-text">No Accounts Connected</h4>
            <p className="text-[11.5px] text-text-muted max-w-sm mx-auto">
              Connect your GitHub, GitLab, or Bitbucket account to sync repositories and commit seamlessly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-commito-coral hover:bg-commito-coral-hover text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer mt-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Account</span>
          </button>
        </div>
      )}
    </div>
  );
};
