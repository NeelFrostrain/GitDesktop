import React, { useState } from 'react';
import {
  Check,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { ProviderAccount } from '../types';
import { ProviderBadge } from './ProviderBadge';
import { EditAccountDialog } from './EditAccountDialog';
import { useAccountServicesStore } from '../store/accountStore';
import { UserAvatar } from '../../../components/common/UserAvatar';

interface AccountRowProps {
  account: ProviderAccount;
}

export const AccountRow: React.FC<AccountRowProps> = ({ account }) => {
  const { setActiveAccount, removeAccount } = useAccountServicesStore();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSwitch = async () => {
    setIsSwitching(true);
    try {
      await setActiveAccount(account.id);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Remove '${account.handle}' from Git Desktop? Tokens will be deleted from your OS keyring.`)) {
      setIsDeleting(true);
      try {
        await removeAccount(account.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <>
      <div
        className={`p-3.5 rounded-sm border transition-all duration-150 flex items-center justify-between gap-4 select-none ${
          account.is_active
            ? 'bg-base-1 border-commito-coral/50 shadow-xs ring-1 ring-commito-coral/20'
            : 'bg-base-1/50 border-border hover:border-border-strong hover:bg-base-1/90'
        }`}
      >
        {/* Left: Avatar & Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <UserAvatar
            url={account.avatar_url}
            name={account.display_name || account.handle}
            provider={account.provider}
            className="w-10 h-10 rounded-sm ring-1 ring-border flex-shrink-0"
            iconClassName="w-5 h-5"
          />

          <div className="min-w-0 space-y-0.5 flex-1">
            {/* Row 1: Name + Provider Badge + Active Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-xs text-text-primary/95 truncate">
                {account.display_name}
              </span>
              <ProviderBadge provider={account.provider} />

              {account.is_active && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs bg-git-added-bg border border-git-added/30 text-git-added text-[10px] font-mono font-bold">
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  <span>Active</span>
                </span>
              )}
            </div>

            {/* Row 2: @handle • instance_url */}
            <div className="text-[11px] text-text-muted font-mono flex items-center gap-1.5 truncate">
              <span>{account.handle}</span>
              <span className="text-text-muted/50">•</span>
              <span className="text-text-muted/70 truncate">{account.instance_url}</span>
            </div>

            {/* Row 3: Commit author email */}
            {account.commit_email && (
              <div className="text-[10.5px] text-text-muted/60 font-mono truncate">
                Author: {account.commit_email}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Edit Info Button */}
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="px-2 py-1 rounded-sm text-xs font-medium text-text-muted hover:text-text-primary hover:bg-base-2 transition flex items-center gap-1.5 cursor-pointer"
            title="Edit local nickname or commit author email override"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          {/* Switch to Account Button (if inactive) */}
          {!account.is_active && (
            <button
              type="button"
              onClick={handleSwitch}
              disabled={isSwitching}
              className="px-3 py-1 bg-base-2 hover:bg-base-3 border border-border text-text-primary rounded-sm text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {isSwitching && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Set Active</span>
            </button>
          )}

          {/* Delete Icon */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1 rounded-sm text-text-muted hover:text-git-removed hover:bg-git-removed-bg transition cursor-pointer"
            title="Remove account and delete tokens"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-git-removed" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Edit Account Modal */}
      <EditAccountDialog
        account={account}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />
    </>
  );
};
