import React, { useEffect } from 'react';
import { useGitStore } from '../../store/useGitStore';
import { useRepoStore } from '../../store/repoStore';
import { useAccounts } from '../../features/account-services';
import { SystemService } from '../../services/system/systemService';
import { UserAvatar } from '../common/UserAvatar';
import { RepoList } from '../home/RepoList';
import { Button } from '../common/Button';
import { Plus, DownloadCloud, FolderOpen } from 'lucide-react';

export const HomeDashboard: React.FC = () => {
  const { user, setIsCreateRepoModalOpen, setIsCloneRepoModalOpen } = useGitStore();
  const loadRepos = useRepoStore((s) => s.loadRepos);
  const addRepo = useRepoStore((s) => s.addRepo);
  const { accounts } = useAccounts();

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  const handleOpenFolderDialog = async () => {
    try {
      const selectedPath = await SystemService.selectFolder();
      if (selectedPath) await addRepo(selectedPath);
    } catch {
      // ignore
    }
  };

  const activeAccount = accounts.find((a) => a.is_active) || accounts[0];
  const displayName = user?.name || user?.username || activeAccount?.display_name || 'Workspace';
  const handleOrEmail =
    user?.email ||
    activeAccount?.commit_email ||
    (user?.username ? `@${user.username}` : 'Local Workspace');
  const provider = user?.provider || activeAccount?.provider;

  return (
    <div className="flex-1 w-full bg-base-0 overflow-y-auto select-none font-sans">
      {/* ── Clean Dashboard Header ── */}
      <header className="px-6 py-3.5 bg-base-0 border-b border-border flex items-center justify-between gap-4 shrink-0 select-none sticky top-0 z-20">
        {/* Left: User Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0 flex items-center">
            <UserAvatar
              url={user?.avatar_url || activeAccount?.avatar_url}
              name={displayName}
              handle={user?.username || activeAccount?.handle}
              provider={provider}
              email={user?.email || activeAccount?.commit_email}
              className="w-9 h-9 rounded-full ring-1 ring-border shadow-xs"
              iconClassName="w-4 h-4"
            />
            <span
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-base-0 absolute bottom-0 right-0 shadow-xs"
              title="Online"
            />
          </div>

          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-text-primary tracking-tight truncate">
                {displayName}
              </h2>
              {provider && (
                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs bg-base-1 border border-border text-text-muted">
                  {provider}
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted truncate font-mono">{handleOrEmail}</p>
          </div>
        </div>

        {/* Right: Standardized Glossy Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleOpenFolderDialog}
            leftIcon={<FolderOpen className="w-3.5 h-3.5 text-text-muted" />}
            title="Open local Git repository folder"
          >
            Open
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsCloneRepoModalOpen(true)}
            leftIcon={<DownloadCloud className="w-3.5 h-3.5 text-text-muted" />}
            title="Clone repository from remote URL or account"
          >
            Clone
          </Button>

          <Button
            type="button"
            variant="coral"
            size="sm"
            onClick={() => setIsCreateRepoModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
            title="Create a new Git repository locally"
          >
            New Repository
          </Button>
        </div>
      </header>

      {/* ── Main Repositories View ── */}
      <main className="p-4 sm:p-5 lg:p-6 w-full mx-auto">
        <RepoList />
      </main>
    </div>
  );
};
