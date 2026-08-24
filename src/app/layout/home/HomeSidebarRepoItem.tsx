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

  const handleClick = () => openRepo(repo.path);

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
      className={`w-full px-2 py-1.5 rounded-sm text-left flex items-center justify-between gap-2 group/repo cursor-pointer select-none transition ${
        isActive
          ? 'bg-base-2 text-text-primary'
          : 'text-text-muted hover:bg-base-1 hover:text-text-primary'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Repo name + branch in one row */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <FolderGit2 className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-commito-coral' : 'text-text-faint group-hover/repo:text-text-muted'}`} />
            <span className="text-[11px] font-medium text-text-primary truncate leading-none">
              {repo.name}
            </span>
            {hasDirtyFiles && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-git-dirty flex-shrink-0"
                title={`${status?.dirty_files} changes`}
              />
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5 ml-5">
            <GitBranch className="w-2.5 h-2.5 text-text-faint flex-shrink-0" />
            <span className="text-[10px] text-text-faint font-mono truncate">{branchName}</span>
          </div>
        </div>
      </div>

      {/* Pin button — only visible on hover or when pinned */}
      <button
        type="button"
        onClick={handlePinToggle}
        title={repo.pinned ? 'Unpin' : 'Pin to top'}
        className={`p-0.5 rounded-sm text-text-faint hover:text-text-muted transition flex-shrink-0 cursor-pointer ${
          repo.pinned ? 'opacity-100 text-commito-coral' : 'opacity-0 group-hover/repo:opacity-100'
        }`}
      >
        <Pin className={`w-2.5 h-2.5 ${repo.pinned ? 'fill-commito-coral/30' : ''}`} />
      </button>
    </div>
  );
};
