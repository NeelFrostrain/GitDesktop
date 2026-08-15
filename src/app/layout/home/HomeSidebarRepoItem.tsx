import React from 'react';
import { GitBranch, FolderGit2, Pin } from 'lucide-react';
import { RepoEntry, RepoDashboardStatus } from '../../../types/home';
import { openRepo, useRepoStore } from '../../../features/repos';

interface HomeSidebarRepoItemProps {
  repo: RepoEntry;
  status?: RepoDashboardStatus;
  isActive?: boolean;
}

export const HomeSidebarRepoItem: React.FC<HomeSidebarRepoItemProps> = ({
  repo,
  status,
  isActive = false,
}) => {
  const pinRepo = useRepoStore((s) => s.pinRepo);

  const handleClick = () => {
    openRepo(repo.path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openRepo(repo.path);
    }
  };

  const handlePinToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    pinRepo(repo.id, !repo.pinned);
  };

  const hasDirtyFiles = Boolean(status && status.dirty_files > 0);
  const branchName = status?.current_branch || 'main';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`w-full p-2 rounded-lg text-left transition flex items-center justify-between gap-2 group/repo cursor-pointer select-none border ${
        isActive
          ? 'bg-commito-card border-commito-coral/40 shadow-xs text-text-primary'
          : 'bg-base-2/40 hover:bg-base-2 text-text-secondary hover:text-text-primary border-border/50 hover:border-border-strong'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Repo Icon */}
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border ${
            repo.pinned
              ? 'bg-amber-950/40 text-amber-400 border-amber-800/40'
              : 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
          }`}
        >
          {repo.pinned ? (
            <Pin className="w-3 h-3 rotate-45" />
          ) : (
            <FolderGit2 className="w-3 h-3" />
          )}
        </div>

        {/* Repo Name & Branch */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-text-primary truncate">
              {repo.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-base-3 text-[10px] font-mono text-text-muted border border-border/70 max-w-[120px] truncate">
              <GitBranch className="w-2.5 h-2.5 text-commito-coral flex-shrink-0" />
              <span className="truncate">{branchName}</span>
            </span>

            {hasDirtyFiles && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"
                title={`${status?.dirty_files} uncommitted change(s)`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Pin toggle button on hover or active */}
      <button
        type="button"
        onClick={handlePinToggle}
        title={repo.pinned ? 'Unpin repository' : 'Pin repository to top'}
        className={`p-1 rounded text-text-muted hover:text-amber-400 hover:bg-base-3 transition flex-shrink-0 cursor-pointer ${
          repo.pinned ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover/repo:opacity-100'
        }`}
      >
        <Pin className={`w-3 h-3 ${repo.pinned ? 'rotate-45 fill-amber-400/20' : ''}`} />
      </button>
    </div>
  );
};
