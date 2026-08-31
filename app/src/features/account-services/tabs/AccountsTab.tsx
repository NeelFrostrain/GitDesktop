import React from 'react';
import { Plus, Users } from 'lucide-react';
import { AccountRow } from '../components/AccountRow';
import { useAccountServicesStore } from '../store/accountStore';
import { Button } from '../../../components/common/Button';

export const AccountsTab: React.FC = () => {
  const { accounts, setActiveTab } = useAccountServicesStore();

  return (
    <div className="space-y-3.5 select-none font-sans">
      {/* Content Header */}
      <div className="flex items-center justify-between gap-3 pb-1">
        <div className="space-y-0.5 min-w-0">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Saved Accounts & Identities
          </h3>
          <p className="text-[11px] text-text-muted">
            Switch active account to change default commit author and remote sync identity.
          </p>
        </div>

        <Button
          type="button"
          variant="coral"
          size="sm"
          onClick={() => setActiveTab('add')}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Add Account
        </Button>
      </div>

      {/* List of Accounts */}
      {accounts.length > 0 ? (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <AccountRow key={acc.id} account={acc} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="py-10 px-4 border border-dashed border-border rounded-sm bg-base-1/30 text-center space-y-3">
          <div className="w-10 h-10 rounded-sm bg-base-2 border border-border flex items-center justify-center mx-auto text-text-muted">
            <Users className="w-4.5 h-4.5 text-commito-coral" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-text-primary">No Accounts Connected</div>
            <p className="text-[11px] text-text-muted max-w-xs mx-auto">
              Connect your GitHub, GitLab, or Bitbucket account to sync repositories and commit
              seamlessly.
            </p>
          </div>
          <Button
            type="button"
            variant="coral"
            size="sm"
            onClick={() => setActiveTab('add')}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Connect Account
          </Button>
        </div>
      )}
    </div>
  );
};
