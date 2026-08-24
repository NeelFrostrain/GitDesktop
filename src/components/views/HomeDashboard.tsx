import React, { useEffect } from 'react';
import { useGitStore } from '../../store/useGitStore';
import { useRepoStore } from '../../store/repoStore';
import { UserAvatar } from '../common/UserAvatar';
import { RepoList } from '../home/RepoList';

export const HomeDashboard: React.FC = () => {
  const { user } = useGitStore();
  const { loadRepos } = useRepoStore();

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex-1 w-full bg-base-0 overflow-y-auto select-none">
      {/* Welcome strip */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-3 flex-shrink-0">
        <UserAvatar
          url={user?.avatar_url}
          name={user?.name || user?.username}
          provider={user?.provider}
          className="w-8 h-8 ring-1 ring-border/60 flex-shrink-0"
          iconClassName="w-4 h-4"
        />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-text-primary leading-tight">
            {user ? `${getGreeting()}, ${user.name || user.username}` : 'Welcome to Git Desktop'}
          </h1>
          <p className="text-[11px] text-text-muted mt-0.5 leading-none">
            {user ? 'Review your repositories and sync latest changes.' : 'Connect an account to get started.'}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="p-6 space-y-6">
        {/* 2-column layout */}
        <div className="space-y-3">
            <p className="text-[10px] font-semibold text-text-faint uppercase tracking-widest">
              Your Repositories
            </p>
            <RepoList />
          </div>
      </div>
    </div>
  );
};
