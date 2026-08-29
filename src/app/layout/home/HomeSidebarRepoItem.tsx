import React from 'react';
import {
  GitBranch,
  FolderGit2,
  Pin,
  FileEdit,
  GitCommit,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
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

  const formatRelativeTime = (ts?: number) => {
    if (!ts) return '—';
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
      className={`group mx-2 my-1.5 p-2.5 rounded-sm border transition-all duration-150 cursor-pointer flex flex-col justify-between gap-2 select-none shadow-2xs ${
        isActive
          ? 'bg-base-2 border-border-strong shadow-xs'
          : repo.pinned
            ? 'bg-base-1/80 border-border-strong'
            : 'bg-base-1/50 border-border/60 hover:border-border-strong hover:bg-base-2/70'
      }`}
    >
      <div className="space-y-1.5">
        {/* Header Row: Icon + Name + Provider + Branch + Pin */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FolderGit2
              className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                isActive ? 'text-commito-coral' : 'text-text-muted group-hover:text-commito-coral'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-xs truncate leading-none font-mono ${
                    isActive
                      ? 'font-bold text-commito-coral'
                      : 'font-semibold text-text-primary group-hover:text-commito-coral'
                  }`}
                  title={repo.name}
                >
                  {repo.name}
                </span>
                {renderProvider(status?.remote_provider)}
                <div className="h-4 px-1 inline-flex items-center gap-0.5 bg-base-0 border border-border/70 rounded-xs text-[9.5px] font-mono text-text-muted">
                  <GitBranch className="w-2.5 h-2.5 text-commito-coral flex-shrink-0" />
                  <span className="truncate max-w-[90px]">{branchName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pin toggle button */}
          <button
            type="button"
            onClick={handlePinToggle}
            title={repo.pinned ? 'Unpin' : 'Pin to top'}
            className={`p-0.5 rounded-xs transition flex-shrink-0 cursor-pointer ${
              repo.pinned
                ? 'text-commito-coral hover:bg-base-3'
                : 'opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary hover:bg-base-3'
            }`}
          >
            <Pin className={`w-3 h-3 ${repo.pinned ? 'fill-commito-coral/30' : ''}`} />
          </button>
        </div>

        {/* Path */}
        <p
          className="text-[10px] text-text-muted/70 font-mono truncate leading-tight"
          title={repo.path}
        >
          {repo.path}
        </p>

        {/* Commit Summary (Middle) */}
        {status?.last_commit_summary && (
          <div className="flex items-center gap-1 text-[10.5px] text-text-muted/80 font-mono truncate pt-0.5">
            <GitCommit className="w-3 h-3 text-text-muted shrink-0" />
            <span className="truncate" title={status.last_commit_summary}>
              {status.last_commit_summary}
            </span>
          </div>
        )}
      </div>

      {/* Footer Row: Status chips + Timestamp */}
      <div className="pt-1.5 border-t border-border/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {status && (status.ahead > 0 || status.behind > 0) && (
            <div className="inline-flex items-center gap-1 text-[9px] font-mono px-1 py-0.2 bg-base-0 border border-border/70 rounded-xs">
              {status.ahead > 0 && (
                <span className="flex items-center gap-0.5 text-git-added font-semibold">
                  <ArrowUpRight className="w-2.5 h-2.5" />
                  {status.ahead}
                </span>
              )}
              {status.behind > 0 && (
                <span className="flex items-center gap-0.5 text-git-renamed font-semibold">
                  <ArrowDownLeft className="w-2.5 h-2.5" />
                  {status.behind}
                </span>
              )}
            </div>
          )}

          {hasDirtyFiles ? (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-git-modified-bg border border-git-modified/40 text-git-modified rounded-xs text-[9.5px] font-mono font-semibold"
              title={`${status?.dirty_files} uncommitted changes`}
            >
              <FileEdit className="w-2.5 h-2.5" />
              <span>{status?.dirty_files} modified</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[9.5px] font-mono text-git-clean px-1.5 py-0.2 bg-git-added-bg border border-git-added/30 rounded-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-git-added" />
              <span>Clean</span>
            </span>
          )}
        </div>

        {/* Timestamp */}
        <span className="flex items-center gap-1 text-[10px] text-text-muted/70 font-mono shrink-0">
          <Clock className="w-2.5 h-2.5" />
          {formatRelativeTime(status?.last_commit_at)}
        </span>
      </div>
    </div>
  );
};
