import React, { useEffect, useMemo } from 'react';
import { useGitStore } from '../../store/useGitStore';
import { useRepoStore } from '../../store/repoStore';
import { useAccounts } from '../../features/account-services';
import { SystemService } from '../../services/system/systemService';
import { UserAvatar } from '../common/UserAvatar';
import { RepoList } from '../home/RepoList';
import { AccountsWidget } from '../home/AccountsWidget';
import { Button } from '../common/Button';
import {
  FolderGit2,
  FileEdit,
  Pin,
  PlusSquare,
  DownloadCloud,
  FolderOpen,
  Users,
} from 'lucide-react';

export const HomeDashboard: React.FC = () => {
  const { user, setIsCreateRepoModalOpen, setIsCloneRepoModalOpen, setIsUserConfigModalOpen } = useGitStore();
  const { repos, statuses, loadRepos, addRepo } = useRepoStore();
  const { accounts } = useAccounts();

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

  const handleOpenFolderDialog = async () => {
    try {
      const selectedPath = await SystemService.selectFolder();
      if (selectedPath) await addRepo(selectedPath);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 w-full bg-base-0 overflow-y-auto select-none font-sans">
      {/* 1. Hero & Header Workspace Overview */}
      <div className="px-6 py-5 border-b border-border bg-base-1/50 flex items-center justify-between gap-4 flex-wrap flex-shrink-0">
        {/* Left: User Identity & Greeting */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative flex-shrink-0">
            <UserAvatar
              url={user?.avatar_url}
              name={user?.name || user?.username}
              provider={user?.provider}
              className="w-10 h-10 rounded-full ring-1 ring-border shadow-xs"
              iconClassName="w-5 h-5"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-base-1 absolute -bottom-0.5 -right-0.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-bold text-text-primary/95 leading-tight">
                {user ? `${getGreeting()}, ${user.name || user.username}` : 'Welcome to Git Desktop'}
              </h1>
            </div>
            <p className="text-xs text-text-muted mt-0.5 leading-none">
              {user
                ? 'Manage your repositories, inspect active working trees, and sync latest changes.'
                : 'Connect an account or open a repository to get started.'}
            </p>
          </div>
        </div>

        {/* Right: Primary Fast Action Buttons & Metric Chips */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="coral"
              size="sm"
              onClick={() => setIsCreateRepoModalOpen(true)}
              leftIcon={<PlusSquare className="w-3.5 h-3.5" />}
            >
              New Repo
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCloneRepoModalOpen(true)}
              leftIcon={<DownloadCloud className="w-3.5 h-3.5" />}
            >
              Clone
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleOpenFolderDialog}
              leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
            >
              Open Local
            </Button>
          </div>

          {/* Vertical Divider */}
          <div className="hidden sm:block h-5 w-px bg-border my-auto" />

          {/* Metric Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-base-1 border border-border text-[11px] font-mono text-text-secondary shadow-2xs"
              title="Total active repositories"
            >
              <FolderGit2 className="w-3 h-3 text-text-muted" />
              <span>{metrics.total} Repos</span>
            </div>

            {metrics.dirtyCount > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-git-modified-bg border border-git-modified/30 text-[11px] font-mono text-git-modified font-semibold shadow-2xs"
                title="Repositories with uncommitted modifications"
              >
                <FileEdit className="w-3 h-3" />
                <span>{metrics.dirtyCount} changed</span>
              </div>
            )}

            {metrics.pinned > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-base-1 border border-border text-[11px] font-mono text-commito-coral shadow-2xs"
                title="Pinned favorites"
              >
                <Pin className="w-3 h-3 fill-commito-coral/30" />
                <span>{metrics.pinned} Pinned</span>
              </div>
            )}

            {accounts.length > 0 && (
              <button
                type="button"
                onClick={() => setIsUserConfigModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-base-1 hover:bg-base-2 border border-border text-[11px] font-mono text-text-secondary transition cursor-pointer shadow-2xs"
                title="Manage accounts and Git identities"
              >
                <Users className="w-3 h-3 text-text-muted" />
                <span>{accounts.length} Acc</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Workspace (Repositories Hub + Connected Accounts) */}
      <div className="p-4 lg:p-5 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
          {/* Main Left Section: Repositories Hub (8-9 Columns on desktop) */}
          <div className="lg:col-span-8 xl:col-span-9 2xl:col-span-9 space-y-4 min-w-0">
            <RepoList />
          </div>

          {/* Right Section: Connected Accounts Card (3-4 Columns on desktop) */}
          <div className="lg:col-span-4 xl:col-span-3 2xl:col-span-3 space-y-4 min-w-0">
            <div className="p-3.5 bg-base-1/60 border border-border rounded-sm shadow-2xs">
              <AccountsWidget />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
