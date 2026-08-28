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

  const getCleanHost = (url: string) =>
    url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <>
      <div
        className={`relative px-4 py-3.5 flex items-center justify-between gap-4 transition-colors duration-150 group select-none ${
          account.is_active
            ? 'bg-commito-coral/[0.04] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-commito-coral before:rounded-r-full'
            : 'hover:bg-surface-hover/60'
        }`}
      >
        {/* Left: Avatar & Identity Metadata */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <UserAvatar
            url={account.avatar_url}
            name={account.display_name}
            handle={account.handle}
            email={account.commit_email}
            provider={account.provider}
            className="w-10 h-10 rounded-md ring-1 ring-border-subtle flex-shrink-0"
            iconClassName="w-5 h-5"
          />

          <div className="min-w-0 flex-1 space-y-0.5">
            {/* Row 1: Account Display Name + Provider Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[13.5px] text-text leading-tight truncate">
                {account.display_name || account.handle.replace(/^@+/, '')}
              </span>
              <ProviderBadge provider={account.provider} />
            </div>

            {/* Row 2: @handle · instance_url */}
            <div className="text-[11.5px] text-text-muted font-mono flex items-center gap-1.5 truncate">
              <span>{account.handle.startsWith('@') ? account.handle : `@${account.handle}`}</span>
              <span className="text-text-faint/60">·</span>
              <span className="text-text-muted/70 truncate">{getCleanHost(account.instance_url)}</span>
            </div>

            {/* Row 3: Author Email Metadata */}
            {account.commit_email && (
              <div className="text-[11px] text-text-muted/70 font-mono truncate flex items-center gap-1">
                <span className="text-text-faint">Author:</span>
                <span className="text-text-muted truncate">{account.commit_email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions & Status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Active status indicator or Set Active CTA */}
          {account.is_active ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-mono font-medium shadow-2xs select-none"
              title="Currently active sync & commit identity"
            >
              <Check className="w-3 h-3 stroke-[2.5]" />
              <span>Active</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSwitch}
              disabled={isSwitching}
              className="px-2.5 py-1 bg-surface hover:bg-surface-hover border border-border-subtle hover:border-border text-text-subtle hover:text-text rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              title="Switch to this identity for Git commits and sync"
            >
              {isSwitching && <Loader2 className="w-3 h-3 animate-spin text-text-muted" />}
              <span>Set Active</span>
            </button>
          )}

          {/* Edit Info Button */}
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface border border-transparent hover:border-border-subtle transition-colors cursor-pointer"
            title="Edit display name or author email"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {/* Delete Account Button */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
            title="Remove account and credentials"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
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
