import React from 'react';
import { Settings } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { useAccountServicesStore } from '../../../features/account-services';
import { UserAvatar } from '../../../components/common/UserAvatar';

export const HomeSidebarAccountFooter: React.FC = () => {
  const { user } = useGitStore();
  const openModalWithTab = useAccountServicesStore((s) => s.openModalWithTab);

  const displayName = user?.name || user?.username || 'No Account';
  const handle = user?.username ? `@${user.username}` : 'Click to connect';

  return (
    <div className="flex-shrink-0 border-t border-border px-2.5 py-2">
      <button
        type="button"
        onClick={() => openModalWithTab('accounts')}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-base-1 transition text-left cursor-pointer group"
        title="Manage accounts"
      >
        <UserAvatar
          url={user?.avatar_url}
          name={user?.name || user?.username}
          provider={user?.provider}
          className="w-6 h-6 flex-shrink-0 ring-1 ring-border/60"
          iconClassName="w-3 h-3"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-text-primary truncate leading-none">{displayName}</p>
          <p className="text-[10px] text-text-faint truncate font-mono mt-0.5">{handle}</p>
        </div>
        <Settings className="w-3 h-3 text-text-faint opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
      </button>
    </div>
  );
};
