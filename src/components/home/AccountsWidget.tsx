import React from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useAccounts, ProviderAccount } from '../../features/account-services';
import { useGitStore } from '../../store/useGitStore';
import { UserAvatar } from '../common/UserAvatar';

export const AccountsWidget: React.FC = () => {
  const { accounts } = useAccounts();
  const { setIsUserConfigModalOpen } = useGitStore();

  const getStatusDot = (account: ProviderAccount) => {
    if (account.token_status === 'expired')
      return <span className="w-1.5 h-1.5 rounded-full bg-git-removed flex-shrink-0" title="Token expired" />;
    if (account.token_status === 'expiring_soon')
      return <span className="w-1.5 h-1.5 rounded-full bg-git-modified flex-shrink-0" title="Expiring soon" />;
    return <span className="w-1.5 h-1.5 rounded-full bg-git-added flex-shrink-0" title="Active" />;
  };

  const getCleanHost = (url: string) =>
    url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div className="space-y-2 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-text-faint uppercase tracking-widest">
          Connected Accounts
        </p>
        <button
          onClick={() => setIsUserConfigModalOpen(true)}
          className="flex items-center gap-1 text-[11px] text-text-faint hover:text-text-primary transition cursor-pointer"
          title="Configure Git Identity & Accounts"
        >
          <Plus className="w-3 h-3" />
          Configure
        </button>
      </div>

      {accounts.length > 0 ? (
        <div className="space-y-1">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              onClick={() => setIsUserConfigModalOpen(true)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-sm bg-base-1 border border-border hover:border-border-strong transition cursor-pointer group"
            >
              <div className="relative flex-shrink-0">
                <UserAvatar
                  url={acc.avatar_url}
                  name={acc.display_name || acc.handle}
                  provider={acc.provider}
                  className="w-6 h-6"
                  iconClassName="w-3 h-3"
                />
                <div className="absolute -bottom-0.5 -right-0.5">
                  {getStatusDot(acc)}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-text-primary truncate">{acc.display_name}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-text-faint bg-base-2 border border-border px-1 py-0.5 rounded-sm flex-shrink-0">
                    {acc.provider}
                  </span>
                </div>
                <p className="text-[10px] text-text-faint font-mono truncate mt-0.5">
                  {acc.handle} · {getCleanHost(acc.instance_url)}
                </p>
              </div>

              <ChevronRight className="w-3 h-3 text-text-faint opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-5 bg-base-1 border border-border rounded-sm text-center">
          <p className="text-[11px] text-text-muted">No accounts connected</p>
          <button
            type="button"
            onClick={() => openModalWithTab('add')}
            className="px-3 py-1.5 bg-commito-coral hover:bg-commito-coralHover text-white rounded-sm text-xs font-semibold transition cursor-pointer"
          >
            Connect Account
          </button>
        </div>
      )}
    </div>
  );
};
