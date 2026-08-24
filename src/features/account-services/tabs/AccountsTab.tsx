import React from 'react';
import { Plus, Users } from 'lucide-react';
import { AccountRow } from '../components/AccountRow';
import { useAccountServicesStore } from '../store/accountStore';

export const AccountsTab: React.FC = () => {
  const { accounts, setActiveTab } = useAccountServicesStore();

  return (
    <div className="space-y-4 select-none">
      {/* Tab Header Row matching screenshot */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-text-primary tracking-wider uppercase">
            SAVED ACCOUNTS
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Switch between accounts to use their identity for commits and pushes.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('add')}
          className="px-4 py-2 bg-gitlab-orange hover:bg-commito-coral-hover text-white rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md flex-shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Account</span>
        </button>
      </div>

      {/* List of Accounts */}
      {accounts.length > 0 ? (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <AccountRow key={acc.id} account={acc} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-10 border border-dashed border-border rounded-md bg-base-2/20 text-center space-y-3">
          <div className="w-12 h-12 rounded-md bg-base-3 flex items-center justify-center mx-auto text-text-muted">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-text-primary">No Accounts Connected</div>
            <p className="text-[11px] text-text-muted max-w-xs mx-auto">
              Connect your GitLab or GitHub account to sync repositories and commit with verified identity.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('add')}
            className="px-4 py-2 bg-gitlab-orange hover:bg-commito-coral-hover text-white rounded-md text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Connect Account</span>
          </button>
        </div>
      )}
    </div>
  );
};
