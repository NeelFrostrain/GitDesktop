import React, { useEffect, useMemo } from "react";
import { useGitStore } from "../../store/useGitStore";
import { useRepoStore } from "../../store/repoStore";
import { useAccounts } from "../../features/account-services";
import { SystemService } from "../../services/system/systemService";
import { UserAvatar } from "../common/UserAvatar";
import { RepoList } from "../home/RepoList";
import { AccountsWidget } from "../home/AccountsWidget";
import { ContributionHeatmap } from "../home/ContributionHeatmap";
import { ContributionActivityRadar } from "../home/ContributionActivityRadar";
import {
  FolderGit2,
  Pin,
  Plus,
  DownloadCloud,
  FolderOpen,
  Users,
} from "lucide-react";

export const HomeDashboard: React.FC = () => {
  const {
    user,
    setIsCreateRepoModalOpen,
    setIsCloneRepoModalOpen,
    setIsUserConfigModalOpen,
  } = useGitStore();
  const repos = useRepoStore((s) => s.repos);
  const statuses = useRepoStore((s) => s.statuses);
  const loadRepos = useRepoStore((s) => s.loadRepos);
  const addRepo = useRepoStore((s) => s.addRepo);
  const { accounts } = useAccounts();

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
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
      {/* ── Dashboard Header ── */}
      <header className="px-5 py-3.5 bg-base-0 border-b border-border/80 flex items-center justify-between gap-4 shrink-0 select-none sticky top-0 z-20">
        {/* Left Side: User Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0 flex items-center">
            <UserAvatar
              url={user?.avatar_url}
              name={user?.name || user?.username}
              provider={user?.provider}
              className="w-9 h-9 rounded-sm ring-1 ring-border shadow-xs"
              iconClassName="w-4.5 h-4.5"
            />
            <span
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-base-0 absolute -bottom-0.5 -right-0.5 shadow-xs"
              title="Active Workspace Session"
            />
          </div>

          <div className="min-w-0 flex flex-col items-baseline gap-0.5 truncate">
            <span className="text-xs text-text-muted font-normal shrink-0">
              {getGreeting()},
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-text-primary tracking-tight truncate">
                {user ? user.name || user.username : "Workspace"}
              </span>
              {user?.provider && (
                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs bg-base-1 border border-border text-text-muted">
                  {user.provider}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Quick Stats & Primary Action Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Quick Metrics Badges */}
          <div className="hidden md:flex h-full items-center gap-2 text-xs text-text-muted select-none bg-base-1 border border-border rounded-sm px-2.5 py-1">
            <span className="flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5 text-text-muted" />
              <span className="font-semibold text-text-primary">
                {metrics.total}
              </span>{" "}
              Repos
            </span>

            {metrics.dirtyCount > 0 && (
              <>
                <span className="text-border text-[10px]">·</span>
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>{metrics.dirtyCount} Changed</span>
                </span>
              </>
            )}

            {metrics.pinned > 0 && (
              <>
                <span className="text-border text-[10px]">·</span>
                <span className="flex items-center gap-1 text-commito-coral">
                  <Pin className="w-3 h-3 fill-commito-coral/20" />
                  <span className="font-semibold text-text-primary">
                    {metrics.pinned}
                  </span>{" "}
                  Pinned
                </span>
              </>
            )}

            {accounts.length > 0 && (
              <>
                <span className="text-border text-[10px]">·</span>
                <button
                  type="button"
                  onClick={() => setIsUserConfigModalOpen(true)}
                  className="flex items-center gap-1 text-text-muted hover:text-text-primary transition cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="font-semibold text-text-primary">
                    {accounts.length}
                  </span>{" "}
                  Accounts
                </button>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Open Folder */}
            <button
              type="button"
              onClick={handleOpenFolderDialog}
              className="h-8 px-3 bg-base-1 hover:bg-base-2 active:bg-base-2/80 border border-border hover:border-border-strong text-text-secondary hover:text-text-primary rounded-sm text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-[0.98] focus:outline-none"
              title="Open local Git repository folder"
            >
              <FolderOpen className="w-3.5 h-3.5 text-text-muted" />
              <span>Open</span>
            </button>

            {/* Clone Button */}
            <button
              type="button"
              onClick={() => setIsCloneRepoModalOpen(true)}
              className="h-8 px-3 bg-base-1 hover:bg-base-2 active:bg-base-2/80 border border-border hover:border-border-strong text-text-secondary hover:text-text-primary rounded-sm text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-[0.98] focus:outline-none"
              title="Clone repository from remote URL or account"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-text-muted" />
              <span>Clone</span>
            </button>

            {/* New Repository Button */}
            <button
              type="button"
              onClick={() => setIsCreateRepoModalOpen(true)}
              className="h-8 px-3.5 bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-[0.98] focus:outline-none"
              title="Create a new Git repository locally"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Repository</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Workspace Bento Grid ── */}
      <main className="p-4 sm:p-5 lg:p-6 w-full mx-auto space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
          {/* Main Left Section: Repositories Hub + Contribution Heatmap */}
          <div className="lg:col-span-8 xl:col-span-8 2xl:col-span-8 space-y-4 min-w-0">
            <RepoList />
            <ContributionHeatmap />
          </div>

          {/* Right Sidebar Section: Connected Accounts + Activity Radar Overview */}
          <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-4 space-y-4 min-w-0">
            <AccountsWidget />
            <ContributionActivityRadar />
          </div>
        </div>
      </main>
    </div>
  );
};
