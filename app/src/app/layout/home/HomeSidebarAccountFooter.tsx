import React from 'react';
import { Users, Plus } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { useAccountServicesStore } from '../../../features/account-services/store/accountStore';
import { UserAvatar } from '../../../components/common/UserAvatar';

export const HomeSidebarAccountFooter: React.FC = () => {
  const { user } = useGitStore();
  const { accounts, openModalWithTab } = useAccountServicesStore();

  const activeAccount = accounts.find((a) => a.is_active) || accounts[0];
  const displayName =
    activeAccount?.display_name || user?.name || user?.username || 'Connect Account';
  const handle =
    activeAccount?.handle || (user?.username ? `@${user.username}` : 'Click to add account');

  return (
    <div className="flex-shrink-0 border-t border-border px-2.5 py-2">
      <button
        type="button"
        onClick={() => openModalWithTab(accounts.length > 0 ? 'accounts' : 'add')}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-base-1 transition text-left cursor-pointer group"
        title="Manage Connected Git Accounts"
      >
        <UserAvatar
          url={activeAccount?.avatar_url || user?.avatar_url}
          name={activeAccount?.display_name || user?.name || user?.username}
          handle={activeAccount?.handle || user?.username}
          provider={activeAccount?.provider || user?.provider}
          className="w-6 h-6 flex-shrink-0 ring-1 ring-border/60"
          iconClassName="w-3 h-3"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-medium text-text-primary truncate leading-none">
              {displayName}
            </p>
            {activeAccount?.provider && (
              <span className="text-[8.5px] font-mono uppercase font-bold text-text-faint">
                {activeAccount.provider}
              </span>
            )}
          </div>
          <p className="text-[10px] text-text-faint truncate font-mono mt-0.5">{handle}</p>
        </div>
        {accounts.length > 1 ? (
          <span className="text-[9.5px] font-mono px-1.5 py-0.2 bg-base-2 border border-border text-text-muted rounded-xs flex items-center gap-1">
            <Users className="w-2.5 h-2.5" />
            <span>{accounts.length}</span>
          </span>
        ) : (
          <Plus className="w-3 h-3 text-text-faint opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
        )}
      </button>
    </div>
  );
};
