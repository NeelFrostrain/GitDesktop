import React from 'react';
import {
  GitBranch,
  ArrowUpRight,
  ArrowDownLeft,
  Pin,
  Clock,
  CircleDot,
  FileEdit,
  FolderGit2,
  Trash2,
} from 'lucide-react';
import { RepoEntry, RepoDashboardStatus } from '../../types/home';
import { useRepoStore } from '../../store/repoStore';

interface RepoCardProps {
  repo: RepoEntry;
  status?: RepoDashboardStatus;
}

export const RepoCard: React.FC<RepoCardProps> = ({ repo, status }) => {
  const { openRepo, pinRepo, removeRepo } = useRepoStore();

  const handleCardClick = () => {
    openRepo(repo.path);
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    pinRepo(repo.id, !repo.pinned);
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remove '${repo.name}' from your known repositories list? (Local files will not be deleted)`)) {
      removeRepo(repo.id);
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    if (!timestamp) return 'No commits';
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    const dt = new Date(timestamp * 1000);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const renderProviderIcon = () => {
    if (status?.remote_provider === 'gitlab') {
      return (
        <span className="px-1.5 py-0.2 bg-commito-coral/20 text-commito-coral border border-commito-coral/30 rounded text-[9px] font-mono font-bold uppercase">
          GitLab
        </span>
      );
    }
    if (status?.remote_provider === 'github') {
      return (
        <span className="px-1.5 py-0.2 bg-purple-950/40 text-purple-300 border border-purple-800/40 rounded text-[9px] font-mono font-bold uppercase">
          GitHub
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.2 bg-base-3 text-text-muted border border-border rounded text-[9px] font-mono font-bold uppercase">
        Git
      </span>
    );
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group p-3.5 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col justify-between select-none relative ${
        repo.pinned
          ? 'bg-base-2 border-commito-coral/40 shadow-xs hover:border-commito-coral hover:shadow-md'
          : 'bg-base-2/60 border-border hover:border-border-strong hover:bg-base-2 hover:shadow-sm'
      }`}
    >
      {/* Top Header */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FolderGit2 className="w-4 h-4 text-commito-coral flex-shrink-0" />
            <h3
              className="text-xs font-bold text-text-primary group-hover:text-commito-coral transition truncate"
              title={repo.name}
            >
              {repo.name}
            </h3>
            {renderProviderIcon()}
          </div>

          {/* Pin & Actions */}
          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition flex-shrink-0">
            <button
              onClick={handlePinClick}
              className={`p-1 rounded hover:bg-base-3 transition cursor-pointer ${
                repo.pinned ? 'text-commito-coral' : 'text-text-muted hover:text-text-primary'
              }`}
              title={repo.pinned ? 'Unpin repository' : 'Pin to top'}
            >
              <Pin className={`w-3.5 h-3.5 ${repo.pinned ? 'fill-commito-coral' : ''}`} />
            </button>
            <button
              onClick={handleRemoveClick}
              className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
              title="Remove from list"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Path preview */}
        <p
          className="text-[11px] text-text-muted font-mono truncate leading-tight"
          title={repo.path}
        >
          {repo.path}
        </p>
      </div>

      {/* Center status tags */}
      <div className="my-3 flex flex-wrap items-center gap-1.5">
        {/* Branch Chip */}
        <div className="flex items-center gap-1 px-2 py-0.5 bg-base-1 border border-border rounded-md text-[11px] font-mono text-text-secondary font-medium">
          <GitBranch className="w-3 h-3 text-commito-coral" />
          <span className="truncate max-w-[120px]">{status?.current_branch || 'main'}</span>
        </div>

        {/* Ahead / Behind Indicator */}
        {status && (status.ahead > 0 || status.behind > 0) && (
          <div className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 bg-base-1 border border-border rounded-md text-text-muted">
            {status.ahead > 0 && (
              <span className="flex items-center gap-0.5 text-commito-coral font-bold">
                <ArrowUpRight className="w-3 h-3" />
                {status.ahead}
              </span>
            )}
            {status.behind > 0 && (
              <span className="flex items-center gap-0.5 text-gitlab-blue font-bold">
                <ArrowDownLeft className="w-3 h-3" />
                {status.behind}
              </span>
            )}
          </div>
        )}

        {/* Dirty files count badge */}
        {status && status.dirty_files > 0 ? (
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-950/40 border border-amber-800/40 rounded-md text-[10px] font-mono text-amber-400 font-bold">
            <FileEdit className="w-3 h-3" />
            <span>{status.dirty_files} modified</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400/80 px-1.5 py-0.5 bg-emerald-950/20 rounded">
            <CircleDot className="w-2.5 h-2.5" />
            <span>Clean</span>
          </div>
        )}
      </div>

      {/* Footer: Last Commit & Timestamp */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted">
        <span
          className="truncate max-w-[180px] font-medium text-text-muted group-hover:text-text-secondary transition"
          title={status?.last_commit_summary}
        >
          {status?.last_commit_summary || 'Loading status...'}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-mono text-text-faint flex-shrink-0">
          <Clock className="w-3 h-3" />
          {formatRelativeTime(status?.last_commit_at || 0)}
        </span>
      </div>
    </div>
  );
};
