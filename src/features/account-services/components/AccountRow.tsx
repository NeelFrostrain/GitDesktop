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
import { UserAvatar } from '../../../components/UserAvatar';

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
        className={`p-4 rounded-xl border transition-all duration-150 flex items-center justify-between gap-4 select-none ${
          account.is_active
            ? 'bg-base-2 border-[#fc6d26]/40 shadow-xs'
            : 'bg-base-2/50 border-border hover:border-border-strong hover:bg-base-2/80'
        }`}
      >
        {/* Left: Avatar & Info */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <UserAvatar
            url={account.avatar_url}
            name={account.display_name || account.handle}
            provider={account.provider}
            className="w-11 h-11 ring-1 ring-border/80 flex-shrink-0"
            iconClassName="w-5 h-5"
          />

          <div className="min-w-0 space-y-0.5 flex-1">
            {/* Row 1: Name + Provider Badge + Active Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-text-primary truncate">
                {account.display_name}
              </span>
              <ProviderBadge provider={account.provider} />

              {account.is_active && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-[10px] font-bold">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>Active</span>
                </span>
              )}
            </div>

            {/* Row 2: @handle • instance_url */}
            <div className="text-xs text-text-muted font-mono flex items-center gap-1.5 truncate">
              <span>{account.handle}</span>
              <span className="text-text-faint">•</span>
              <span className="text-text-faint truncate">{account.instance_url}</span>
            </div>

            {/* Row 3: Commit author email */}
            {account.commit_email && (
              <div className="text-[11px] text-text-faint font-mono truncate">
                Commit author: {account.commit_email}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Edit Info Button */}
          <button
            onClick={() => setIsEditOpen(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-base-3 transition flex items-center gap-1.5 cursor-pointer"
            title="Edit local nickname or commit author email override"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit Info</span>
          </button>

          {/* Switch to Account Button (if inactive) */}
          {!account.is_active && (
            <button
              onClick={handleSwitch}
              disabled={isSwitching}
              className="px-3.5 py-1.5 bg-base-3 hover:bg-base-2 border border-border hover:border-border-strong text-text-primary rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {isSwitching && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Switch to Account</span>
            </button>
          )}

          {/* Delete Icon */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
            title="Remove account and delete tokens"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
            ) : (
              <Trash2 className="w-4 h-4" />
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
