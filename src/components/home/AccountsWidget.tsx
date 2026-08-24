import React from 'react';
import {
  User,
  Plus,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { useAccounts, useAccountServicesStore, ProviderAccount } from '../../features/account-services';
import { UserAvatar } from '../common/UserAvatar';

export const AccountsWidget: React.FC = () => {
  const { accounts } = useAccounts();
  const { openModalWithTab } = useAccountServicesStore();

  const getHealthDot = (account: ProviderAccount) => {
    if (account.token_status === 'expired') {
      return (
        <span
          className="w-2 h-2 rounded-full bg-git-removed ring-2 ring-git-removed/20 flex-shrink-0"
          title="Token expired - re-authentication required"
        />
      );
    }
    if (account.token_status === 'expiring_soon') {
      return (
        <span
          className="w-2 h-2 rounded-full bg-git-modified ring-2 ring-git-modified/20 flex-shrink-0"
          title="Token expiring soon"
        />
      );
    }
    return (
      <span
        className="w-2 h-2 rounded-full bg-git-added ring-2 ring-git-added/20 flex-shrink-0"
        title="Token active"
      />
    );
  };

  const getCleanHost = (url: string) => {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  };

  return (
    <div className="bg-base-2/60 border border-border rounded-md p-4 space-y-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-commito-coral" />
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Connected Accounts ({accounts.length})
          </h3>
        </div>
        <button
          onClick={() => openModalWithTab('add')}
          className="p-1 rounded-md text-text-muted hover:text-commito-coral hover:bg-base-3 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
          title="Connect new account"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>

      {/* Accounts List */}
      {accounts.length > 0 ? (
        <div className="space-y-1.5">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              onClick={() => openModalWithTab('accounts')}
              className="p-2 rounded-md bg-base-1 border border-border/80 hover:border-commito-coral/50 hover:bg-base-1/80 transition flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative">
                  <UserAvatar
                    url={acc.avatar_url}
                    name={acc.display_name || acc.handle}
                    provider={acc.provider}
                    className="w-7 h-7"
                    iconClassName="w-3.5 h-3.5"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5">
                    {getHealthDot(acc)}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-bold text-text-primary truncate flex items-center gap-1.5">
                    <span>{acc.display_name}</span>
                    <span className="px-1 py-0.2 bg-base-3 text-text-muted rounded text-[9px] font-mono uppercase font-bold">
                      {acc.provider}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted font-mono truncate">
                    {acc.handle} • {getCleanHost(acc.instance_url)}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-4 bg-base-1 border border-border rounded-md text-center space-y-2">
          <p className="text-[11px] text-text-muted">
            No remote accounts connected yet.
          </p>
          <button
            type="button"
            onClick={() => openModalWithTab('add')}
            className="px-3 py-1.5 bg-commito-coral hover:bg-commito-coralHover text-text-on-accent rounded-md text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 w-full cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Connect Account</span>
          </button>
        </div>
      )}
    </div>
  );
};
