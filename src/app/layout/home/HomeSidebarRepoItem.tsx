import React from 'react';
import { GitBranch, FolderGit2, Pin, FileEdit, CheckCircle2 } from 'lucide-react';
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

  const renderProvider = (provider?: string | null) => {
    if (!provider) return null;
    if (provider === 'github') {
      return (
        <span className="px-1.5 py-0.2 rounded-xs bg-purple-950/40 border border-purple-500/40 text-[9px] font-mono font-bold text-purple-300 tracking-wider">
          GITHUB
        </span>
      );
    }
    if (provider === 'gitlab') {
      return (
        <span className="px-1.5 py-0.2 rounded-xs bg-orange-950/40 border border-[#e24329]/40 text-[9px] font-mono font-bold text-[#fc6d26] tracking-wider">
          GITLAB
        </span>
      );
    }
    return null;
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2.5 group/repo cursor-pointer select-none transition border-l-2 ${
        isActive
          ? 'bg-base-2 border-l-commito-coral text-text-primary font-semibold'
          : 'border-l-transparent text-text-muted hover:text-text-primary hover:bg-base-1/70'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Repo Icon */}
        <FolderGit2
          className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
            isActive ? 'text-commito-coral' : 'text-text-muted group-hover/repo:text-commito-coral'
          }`}
        />

        {/* Repo name + branch + path */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-xs truncate leading-tight font-mono ${
                isActive ? 'font-bold text-text-primary' : 'font-medium'
              }`}
            >
              {repo.name}
            </span>

            {renderProvider(status?.remote_provider)}

            {/* Branch pill badge */}
            <div className="h-4 px-1 inline-flex items-center gap-0.5 bg-base-0 border border-border/70 rounded-xs text-[9.5px] font-mono text-text-muted">
              <GitBranch className="w-2.5 h-2.5 text-commito-coral flex-shrink-0" />
              <span className="truncate max-w-[100px]">{branchName}</span>
            </div>
          </div>

          {/* Path */}
          <p className="text-[10px] text-text-muted/70 font-mono truncate mt-0.5 leading-tight" title={repo.path}>
            {repo.path}
          </p>
        </div>
      </div>

      {/* Right Side: Dirty Files Status Icon + Pin Button */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {hasDirtyFiles ? (
          <span
            className="text-git-modified shrink-0 flex items-center gap-1"
            title={`${status?.dirty_files} uncommitted changes`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px] font-bold">{status?.dirty_files}</span>
          </span>
        ) : (
          <span className="text-git-added shrink-0" title="Clean repository">
            <CheckCircle2 className="w-3.5 h-3.5 text-git-added/70" />
          </span>
        )}

        {/* Pin button */}
        <button
          type="button"
          onClick={handlePinToggle}
          title={repo.pinned ? 'Unpin' : 'Pin to top'}
          className={`p-1 rounded-sm transition flex-shrink-0 cursor-pointer ${
            repo.pinned
              ? 'opacity-100 text-commito-coral hover:bg-base-3'
              : 'opacity-0 group-hover/repo:opacity-100 text-text-muted hover:text-text-primary hover:bg-base-3'
          }`}
        >
          <Pin className={`w-3 h-3 ${repo.pinned ? 'fill-commito-coral/30' : ''}`} />
        </button>
      </div>
    </div>
  );
};
