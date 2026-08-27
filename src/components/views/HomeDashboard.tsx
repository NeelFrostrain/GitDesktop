import React, { useEffect, useMemo } from 'react';
import { useGitStore } from '../../store/useGitStore';
import { useRepoStore } from '../../store/repoStore';
import { useAccounts } from '../../features/account-services';
import { SystemService } from '../../services/system/systemService';
import { UserAvatar } from '../common/UserAvatar';
import { RepoList } from '../home/RepoList';
import { AccountsWidget } from '../home/AccountsWidget';
import {
  FolderGit2,
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
      <div className="px-5 py-3 border-b border-border/80 bg-base-0/90 backdrop-blur-xs flex items-center justify-between gap-4 flex-wrap shrink-0">
        {/* Left: User Identity & Greeting */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <UserAvatar
              url={user?.avatar_url}
              name={user?.name || user?.username}
              provider={user?.provider}
              className="w-8 h-8 rounded-full ring-1 ring-border/70 shadow-xs"
              iconClassName="w-4 h-4"
            />
            <span
              className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-base-0 absolute -bottom-0.5 -right-0.5 shadow-2xs"
              title="Active Session"
            />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <h1 className="text-xs font-semibold text-text-primary tracking-tight leading-tight truncate">
              {user ? (
                <>
                  <span className="text-text-muted font-normal">{getGreeting()}, </span>
                  <span className="font-semibold text-text-primary">{user.name || user.username}</span>
                </>
              ) : (
                'Welcome to Git Desktop'
              )}
            </h1>
            <p className="text-[11px] text-text-muted leading-tight mt-0.5 truncate">
              {user
                ? 'Manage repositories, inspect active working trees, and sync changes.'
                : 'Connect an account or open a local repository to get started.'}
            </p>
          </div>
        </div>

        {/* Right: Primary Action, Secondary Actions, and Streamlined Stats Strip */}
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Action Button Group */}
          <div className="flex items-center gap-1.5">
            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => setIsCreateRepoModalOpen(true)}
              className="h-7.5 px-3 bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white rounded-sm text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98] focus:outline-none focus:ring-1 focus:ring-commito-coral/50"
            >
              <PlusSquare className="w-3.5 h-3.5" />
              <span>New Repo</span>
            </button>

            {/* Secondary Actions */}
            <button
              type="button"
              onClick={() => setIsCloneRepoModalOpen(true)}
              className="h-7.5 px-2.5 bg-base-1/80 hover:bg-base-2 hover:text-text-primary active:bg-base-2/80 border border-border/80 hover:border-border-strong text-text-secondary rounded-sm text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-[0.98] focus:outline-none"
              title="Clone from URL or cloud provider"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-text-muted" />
              <span>Clone</span>
            </button>
            <button
              type="button"
              onClick={handleOpenFolderDialog}
              className="h-7.5 px-2.5 bg-base-1/80 hover:bg-base-2 hover:text-text-primary active:bg-base-2/80 border border-border/80 hover:border-border-strong text-text-secondary rounded-sm text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-[0.98] focus:outline-none"
              title="Open local Git repository folder"
            >
              <FolderOpen className="w-3.5 h-3.5 text-text-muted" />
              <span>Open Local</span>
            </button>
          </div>

          {/* Subtle Vertical Divider */}
          <div className="hidden md:block h-4.5 w-px bg-border/80 my-auto" />

          {/* Streamlined Stats Indicator Strip */}
          <div className="flex items-center gap-2 bg-base-1/60 border border-border/70 rounded-sm px-2.5 py-1 text-xs text-text-muted shadow-2xs select-none">
            {/* Total Repos */}
            <div className="flex items-center gap-1.5 text-[11px] font-sans font-medium text-text-secondary" title="Total active repositories">
              <FolderGit2 className="w-3.5 h-3.5 text-text-muted" />
              <span className="font-semibold text-text-primary">{metrics.total}</span>
              <span className="text-text-muted hidden sm:inline">Repos</span>
            </div>

            {/* Changed Count (Strong visual emphasis for actionable modifications) */}
            {metrics.dirtyCount > 0 && (
              <>
                <span className="text-border/80 text-[10px] select-none">•</span>
                <div
                  className="flex items-center gap-1 text-[11px] font-sans font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-xs border border-amber-500/25 shadow-2xs"
                  title="Repositories with uncommitted modifications"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span>{metrics.dirtyCount} changed</span>
                </div>
              </>
            )}

            {/* Pinned Repos */}
            {metrics.pinned > 0 && (
              <>
                <span className="text-border/80 text-[10px] select-none">•</span>
                <div
                  className="flex items-center gap-1 text-[11px] font-sans font-medium text-commito-coral"
                  title="Pinned favorites"
                >
                  <Pin className="w-3 h-3 fill-commito-coral/30 text-commito-coral shrink-0" />
                  <span className="font-semibold">{metrics.pinned}</span>
                  <span className="text-text-muted hidden sm:inline">Pinned</span>
                </div>
              </>
            )}

            {/* Accounts */}
            {accounts.length > 0 && (
              <>
                <span className="text-border/80 text-[10px] select-none">•</span>
                <button
                  type="button"
                  onClick={() => setIsUserConfigModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-sans text-text-secondary hover:text-text-primary transition cursor-pointer"
                  title="Manage accounts and Git identities"
                >
                  <Users className="w-3 h-3 text-text-muted shrink-0" />
                  <span className="font-semibold">{accounts.length}</span>
                  <span className="text-text-muted hidden sm:inline">Acc</span>
                </button>
              </>
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
            <div className="p-3.5 bg-base-1/50 border border-border rounded-sm shadow-2xs">
              <AccountsWidget />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
