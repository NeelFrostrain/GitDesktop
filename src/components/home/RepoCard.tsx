import React from 'react';
import {
  GitBranch,
  ArrowUpRight,
  ArrowDownLeft,
  Pin,
  Clock,
  FileEdit,
  FolderGit2,
  Trash2,
} from 'lucide-react';
import { RepoEntry, RepoDashboardStatus } from '../../types/home';
import { useRepoStore, openRepo } from '../../features/repos';

export interface RepoCardProps {
  repo: RepoEntry;
  status?: RepoDashboardStatus;
  viewMode?: 'grid' | 'list';
}

export const RepoCard: React.FC<RepoCardProps> = ({ repo, status, viewMode = 'grid' }) => {
  const { pinRepo, removeRepo } = useRepoStore();

  const handleCardClick = () => openRepo(repo.path);

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    pinRepo(repo.id, !repo.pinned);
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remove '${repo.name}' from your list? (Files won't be deleted)`)) {
      removeRepo(repo.id);
    }
  };

  const formatRelativeTime = (ts: number) => {
    if (!ts) return '—';
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const renderProvider = () => {
    if (status?.remote_provider === 'gitlab')
      return (
        <span className="text-[9px] font-mono font-bold uppercase text-commito-coral bg-commito-coral/10 border border-commito-coral/20 px-1.5 py-0.5 rounded-sm">
          GitLab
        </span>
      );
    if (status?.remote_provider === 'github')
      return (
        <span className="text-[9px] font-mono font-bold uppercase text-purple-400 bg-purple-900/30 border border-purple-700/30 px-1.5 py-0.5 rounded-sm">
          GitHub
        </span>
      );
    return null;
  };

  const isDirty = Boolean(status && status.dirty_files > 0);

  if (viewMode === 'list') {
    return (
      <div
        onClick={handleCardClick}
        className={`group px-4 py-2.5 bg-base-1 border border-border hover:border-border-strong rounded-sm hover:bg-base-2 transition-all duration-150 ease-out hover:translate-x-0.5 active:scale-[0.998] cursor-pointer flex items-center justify-between gap-4 sm:gap-6 select-none animate-in fade-in duration-150 ${
          repo.pinned ? 'border-border-strong bg-base-2/40' : ''
        }`}
      >
        {/* Left: Icon + Name + Provider + Branch + Path */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <FolderGit2 className="w-4 h-4 text-text-faint flex-shrink-0 group-hover:text-commito-coral transition-colors duration-150" />
          <div className="min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="text-xs font-semibold text-text-primary truncate group-hover:text-commito-coral transition-colors duration-150"
                title={repo.name}
              >
                {repo.name}
              </h3>
              {renderProvider()}
              <div className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-base-0 border border-border rounded-sm text-[10px] font-mono text-text-muted">
                <GitBranch className="w-2.5 h-2.5 text-commito-coral" />
                <span className="truncate max-w-[120px]">{status?.current_branch || 'main'}</span>
              </div>
            </div>
            <p className="text-[10px] text-text-faint font-mono truncate" title={repo.path}>
              {repo.path}
            </p>
          </div>
        </div>

        {/* Middle: Last commit message */}
        <div className="hidden md:flex items-center gap-2 max-w-[280px] lg:max-w-[380px] flex-shrink-0 text-left min-w-0">
          <span className="text-[11px] text-text-faint truncate" title={status?.last_commit_summary}>
            {status?.last_commit_summary || '—'}
          </span>
        </div>

        {/* Right Section: Time -> Modified files badge -> Actions */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Timestamp */}
          <span className="hidden sm:flex items-center gap-1 text-[10px] text-text-faint font-mono">
            <Clock className="w-2.5 h-2.5" />
            {formatRelativeTime(status?.last_commit_at || 0)}
          </span>

          {/* Status chips (Modified / Clean, Ahead / Behind) */}
          <div className="flex items-center gap-1.5">
            {status && (status.ahead > 0 || status.behind > 0) && (
              <div className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 bg-base-0 border border-border rounded-sm">
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

            {isDirty ? (
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-git-modified-bg border border-git-modified/30 rounded-sm text-[10px] font-mono text-git-modified font-semibold">
                <FileEdit className="w-2.5 h-2.5" />
                {status!.dirty_files} modified
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 text-[10px] font-mono text-git-clean px-1.5 py-0.5 bg-git-added-bg border border-git-added/20 rounded-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-git-added" />
                Clean
              </div>
            )}
          </div>

          {/* Actions: Smooth appearance */}
          {repo.pinned && (
            <button
              onClick={handlePinClick}
              className="group-hover:hidden p-1 rounded-sm text-commito-coral hover:bg-base-3 transition-transform active:scale-90 cursor-pointer"
              title="Unpin"
            >
              <Pin className="w-3 h-3 fill-commito-coral/30" />
            </button>
          )}

          <div className="hidden group-hover:flex items-center gap-0.5 animate-in fade-in duration-100">
            <button
              onClick={handlePinClick}
              className={`p-1 rounded-sm hover:bg-base-3 transition-all duration-150 active:scale-90 cursor-pointer ${
                repo.pinned ? 'text-commito-coral' : 'text-text-faint hover:text-text-muted'
              }`}
              title={repo.pinned ? 'Unpin' : 'Pin to top'}
            >
              <Pin className={`w-3 h-3 ${repo.pinned ? 'fill-commito-coral/30' : ''}`} />
            </button>
            <button
              onClick={handleRemoveClick}
              className="p-1 rounded-sm text-text-faint hover:text-git-removed hover:bg-git-removed-bg transition-all duration-150 active:scale-90 cursor-pointer"
              title="Remove"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleCardClick}
      className={`group p-3 rounded-sm border transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer flex flex-col gap-2.5 select-none animate-in fade-in duration-150 ${
        repo.pinned
          ? 'bg-base-1 border-border-strong hover:border-commito-coral/40 shadow-xs hover:shadow-md'
          : 'bg-base-1 border-border hover:border-border-strong shadow-xs hover:shadow-md'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <FolderGit2 className="w-3.5 h-3.5 text-text-faint flex-shrink-0 group-hover:text-commito-coral transition-colors" />
          <h3
            className="text-xs font-semibold text-text-primary truncate group-hover:text-commito-coral transition-colors"
            title={repo.name}
          >
            {repo.name}
          </h3>
          {renderProvider()}
        </div>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={handlePinClick}
            className={`p-1 rounded-sm hover:bg-base-2 transition-all active:scale-90 cursor-pointer ${
              repo.pinned ? 'text-commito-coral' : 'text-text-faint hover:text-text-muted'
            }`}
            title={repo.pinned ? 'Unpin' : 'Pin to top'}
          >
            <Pin className={`w-3 h-3 ${repo.pinned ? 'fill-commito-coral/30' : ''}`} />
          </button>
          <button
            onClick={handleRemoveClick}
            className="p-1 rounded-sm text-text-faint hover:text-git-removed hover:bg-git-removed-bg transition-all active:scale-90 cursor-pointer"
            title="Remove"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Path */}
      <p className="text-[10px] text-text-faint font-mono truncate -mt-1.5" title={repo.path}>
        {repo.path}
      </p>

      {/* Status chips */}
      <div className="flex items-center flex-wrap gap-1">
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-base-0 border border-border rounded-sm text-[10px] font-mono text-text-muted">
          <GitBranch className="w-2.5 h-2.5 text-commito-coral" />
          <span className="truncate max-w-[100px]">{status?.current_branch || 'main'}</span>
        </div>

        {status && (status.ahead > 0 || status.behind > 0) && (
          <div className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 bg-base-0 border border-border rounded-sm">
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

        {isDirty ? (
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-git-modified-bg border border-git-modified/30 rounded-sm text-[10px] font-mono text-git-modified font-semibold">
            <FileEdit className="w-2.5 h-2.5" />
            {status!.dirty_files} modified
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 text-[10px] font-mono text-git-clean px-1.5 py-0.5 bg-git-added-bg border border-git-added/20 rounded-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-git-added" />
            Clean
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-text-faint truncate" title={status?.last_commit_summary}>
          {status?.last_commit_summary || '—'}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-text-faint flex-shrink-0 font-mono">
          <Clock className="w-2.5 h-2.5" />
          {formatRelativeTime(status?.last_commit_at || 0)}
        </span>
      </div>
    </div>
  );
};
