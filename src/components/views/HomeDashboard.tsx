import React, { useEffect } from 'react';
import { useGitStore } from '../../store/useGitStore';
import { useRepoStore } from '../../store/repoStore';
import { useAccountStore } from '../../store/accountStore';
import { useActivityStore } from '../../store/activityStore';
import { UserAvatar } from '../common/UserAvatar';
import { RepoList } from '../home/RepoList';
import { AccountsWidget } from '../home/AccountsWidget';
import { ActivityFeed } from '../home/ActivityFeed';

export const HomeDashboard: React.FC = () => {
  const { user } = useGitStore();
  const { loadRepos } = useRepoStore();
  const { fetchAccounts } = useAccountStore();
  const { refresh: refreshActivity } = useActivityStore();

  useEffect(() => {
    loadRepos();
    fetchAccounts();
    refreshActivity();
  }, [loadRepos, fetchAccounts, refreshActivity]);

  const getDayGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good morning. Ready to build something great today?';
    if (hours < 18) return 'Good afternoon. Keep up the great coding momentum.';
    return 'Good evening. Review your repositories and sync latest changes.';
  };

  return (
    <div className="flex-1 bg-base-0 overflow-y-auto p-6 space-y-6 select-none">
      {/* Top Welcome Banner */}
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div className="flex items-center gap-3.5">
          <UserAvatar
            url={user?.avatar_url}
            name={user?.name || user?.username}
            provider={user?.provider}
            className="w-11 h-11 ring-2 ring-border/80 shadow-sm"
            iconClassName="w-5 h-5"
          />
          <div>
            <h1 className="text-base font-bold text-text-primary leading-tight">
              {user ? `Welcome back, ${user.name || user.username}` : 'Welcome to Git Desktop'}
            </h1>
            <p className="text-xs text-text-muted mt-0.5">{getDayGreeting()}</p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Responsive Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2/3 width on large screens): Repositories List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Your Repositories
            </h2>
          </div>
          <RepoList />
        </div>

        {/* Right Column (1/3 width): Accounts Widget + Activity Feed */}
        <div className="space-y-5">
          <AccountsWidget />
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
};
