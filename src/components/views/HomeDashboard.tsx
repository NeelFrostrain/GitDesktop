import React, { useEffect, useMemo } from 'react';
import { useGitStore } from '../../store/useGitStore';
import { useRepoStore } from '../../store/repoStore';
import { UserAvatar } from '../common/UserAvatar';
import { RepoList } from '../home/RepoList';
import { FolderGit2, FileEdit, Pin } from 'lucide-react';

export const HomeDashboard: React.FC = () => {
  const { user } = useGitStore();
  const { repos, statuses, loadRepos } = useRepoStore();

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const metrics = useMemo(() => {
    const total = repos.length;
    const pinned = repos.filter((r) => r.pinned).length;
    let dirtyCount = 0;
    Object.values(statuses).forEach((s) => {
      if (s && s.dirty_files > 0) dirtyCount += 1;
    });
    return { total, pinned, dirtyCount };
  }, [repos, statuses]);

  return (
    <div className="flex-1 w-full bg-base-0 overflow-y-auto select-none font-sans">
      {/* Welcome Banner */}
      <div className="px-6 py-4.5 border-b border-border bg-base-1/40 flex items-center justify-between gap-4 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar
            url={user?.avatar_url}
            name={user?.name || user?.username}
            provider={user?.provider}
            className="w-9 h-9 rounded-sm ring-1 ring-border flex-shrink-0"
            iconClassName="w-4.5 h-4.5"
          />
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-text-primary leading-tight">
              {user ? `${getGreeting()}, ${user.name || user.username}` : 'Welcome to Git Desktop'}
            </h1>
            <p className="text-[11px] text-text-muted mt-0.5 leading-none">
              {user ? 'Review your active repositories and sync latest changes.' : 'Connect an account or open a repository to get started.'}
            </p>
          </div>
        </div>

        {/* Quick Workspace Stats */}
        {repos.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-base-1 border border-border text-[11px] font-mono text-text-muted shadow-2xs">
              <FolderGit2 className="w-3 h-3 text-text-faint" />
              <span>{metrics.total} Repos</span>
            </div>

            {metrics.dirtyCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-git-modified-bg border border-git-modified/30 text-[11px] font-mono text-git-modified font-semibold shadow-2xs">
                <FileEdit className="w-3 h-3" />
                <span>{metrics.dirtyCount} with changes</span>
              </div>
            )}

            {metrics.pinned > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-base-1 border border-border text-[11px] font-mono text-commito-coral shadow-2xs">
                <Pin className="w-3 h-3 fill-commito-coral/30" />
                <span>{metrics.pinned} Pinned</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <RepoList />
      </div>
    </div>
  );
};
