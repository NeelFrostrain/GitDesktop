import React from 'react';
import { Plus, ChevronRight, Users } from 'lucide-react';
import { useAccounts, ProviderAccount, useAccountServicesStore } from '../../features/account-services';
import { UserAvatar } from '../common/UserAvatar';
import { Button } from '../common/Button';

export const AccountsWidget: React.FC = () => {
  const { accounts } = useAccounts();
  const { openModalWithTab } = useAccountServicesStore();

  const getStatusDot = (account: ProviderAccount) => {
    if (account.token_status === 'expired')
      return <span className="w-2 h-2 rounded-full bg-git-removed ring-1 ring-base-1 flex-shrink-0" title="Token expired" />;
    if (account.token_status === 'expiring_soon')
      return <span className="w-2 h-2 rounded-full bg-git-modified ring-1 ring-base-1 flex-shrink-0" title="Expiring soon" />;
    return <span className="w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-base-1 flex-shrink-0" title="Active" />;
  };

  const getCleanHost = (url: string) =>
    url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div className="space-y-3 select-none font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-subtle">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span>Connected Accounts</span>
        </div>
        <button
          type="button"
          onClick={() => openModalWithTab('accounts')}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary transition cursor-pointer font-medium"
          title="Configure Git Identity & Accounts"
        >
          <Plus className="w-3 h-3" />
          Configure
        </button>
      </div>

      {accounts.length > 0 ? (
        <div className="space-y-1.5">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              onClick={() => openModalWithTab('accounts')}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border/75 hover:border-border-strong transition cursor-pointer group shadow-xs"
            >
              <div className="relative flex-shrink-0">
                <UserAvatar
                  url={acc.avatar_url}
                  name={acc.display_name}
                  handle={acc.handle}
                  email={acc.commit_email}
                  provider={acc.provider}
                  className="w-7 h-7 rounded-full ring-1 ring-border/80"
                  iconClassName="w-3.5 h-3.5"
                />
                <div className="absolute -bottom-0.5 -right-0.5">
                  {getStatusDot(acc)}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-text-primary truncate">{acc.display_name}</span>
                  <span
                    className={`text-[10px] font-medium uppercase px-1.5 py-0.2 rounded border flex-shrink-0 ${
                      acc.provider === 'github'
                        ? 'text-purple-300/90 bg-purple-500/10 border-purple-500/20'
                        : acc.provider === 'bitbucket'
                        ? 'text-blue-300/90 bg-blue-500/10 border-blue-500/20'
                        : acc.provider === 'custom'
                        ? 'text-emerald-300/90 bg-emerald-500/10 border-emerald-500/20'
                        : 'text-orange-400/90 bg-orange-500/10 border-orange-500/20'
                    }`}
                  >
                    {acc.provider}
                  </span>
                </div>
                <p className="text-[10.5px] text-text-muted font-mono truncate mt-0.5">
                  {acc.handle.startsWith('@') ? acc.handle : `@${acc.handle}`} · {getCleanHost(acc.instance_url)}
                </p>
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2.5 py-6 rounded-sm text-center">
          <p className="text-xs text-text-muted">No accounts connected</p>
          <Button
            type="button"
            variant="coral"
            size="sm"
            onClick={() => openModalWithTab('add')}
          >
            Connect Account
          </Button>
        </div>
      )}
    </div>
  );
};
