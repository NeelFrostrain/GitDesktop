import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { useAccountServicesStore } from '../../../features/account-services';
import { UserAvatar } from '../../../components/common/UserAvatar';

export const HomeSidebarAccountFooter: React.FC = () => {
  const { user } = useGitStore();
  const openModalWithTab = useAccountServicesStore((s) => s.openModalWithTab);

  const handleClick = () => {
    openModalWithTab('accounts');
  };

  const displayName = user?.name || user?.username || 'No Account Connected';
  const handle = user?.username ? `@${user.username}` : '';
  const provider = user?.provider || 'gitlab';

  return (
    <div className="p-2.5 border-t border-border bg-base-1/60 flex-shrink-0 select-none">
      <button
        type="button"
        onClick={handleClick}
        className="w-full p-2 rounded-md bg-base-2/40 hover:bg-base-2 border border-border/60 hover:border-border-strong flex items-center justify-between gap-2.5 transition text-left cursor-pointer group"
        title="Manage linked accounts and services"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <UserAvatar
            url={user?.avatar_url}
            name={user?.name || user?.username}
            provider={user?.provider}
            className="w-7 h-7 ring-1 ring-border/80 flex-shrink-0"
            iconClassName="w-3.5 h-3.5"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-text-primary truncate">
                {displayName}
              </span>
              <span className="px-1 py-0.2 rounded bg-base-3 border border-border text-[9px] font-mono font-bold uppercase text-text-muted flex-shrink-0">
                {provider}
              </span>
            </div>

            {handle && (
              <p className="text-[10px] text-text-muted truncate font-mono">
                {handle}
              </p>
            )}
          </div>
        </div>

        <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition flex-shrink-0" />
      </button>
    </div>
  );
};
