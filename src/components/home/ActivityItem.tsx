import React from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  GitCommit,
  Upload,
  GitPullRequest,
  CheckCircle,
  XCircle,
  PlayCircle,
  Clock,
  ExternalLink,
  FolderGit2,
} from 'lucide-react';
import { ActivityEvent } from '../../types/home';
import { useGitStore } from '../../store/useGitStore';

interface ActivityItemProps {
  event: ActivityEvent;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({ event }) => {
  const { setActiveRepoPath, setSelectedCommitSha, setCurrentNavView } = useGitStore();

  const handleItemClick = () => {
    if (event.kind.type === 'Commit') {
      setActiveRepoPath(event.repo_path);
      setSelectedCommitSha(event.kind.sha);
      setCurrentNavView('history');
    } else if (event.kind.type === 'MergeRequest' && event.kind.url) {
      openUrl(event.kind.url).catch(() => {});
    } else if (event.kind.type === 'Pipeline' && event.kind.url) {
      openUrl(event.kind.url).catch(() => {});
    } else if (event.kind.type === 'Push') {
      setActiveRepoPath(event.repo_path);
      setCurrentNavView('history');
    }
  };

  const renderIconAndBadge = () => {
    switch (event.kind.type) {
      case 'Commit':
        return (
          <div className="w-6 h-6 rounded-full bg-commito-coral/15 text-commito-coral flex items-center justify-center flex-shrink-0">
            <GitCommit className="w-3.5 h-3.5" />
          </div>
        );
      case 'Push':
        return (
          <div className="w-6 h-6 rounded-full bg-gitlab-blue/15 text-gitlab-blue flex items-center justify-center flex-shrink-0">
            <Upload className="w-3.5 h-3.5" />
          </div>
        );
      case 'MergeRequest':
        return (
          <div className="w-6 h-6 rounded-full bg-purple-950/40 text-purple-300 flex items-center justify-center flex-shrink-0">
            <GitPullRequest className="w-3.5 h-3.5" />
          </div>
        );
      case 'Pipeline':
        if (event.kind.status === 'success') {
          return (
            <div className="w-6 h-6 rounded-full bg-emerald-950/40 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
          );
        }
        if (event.kind.status === 'failed') {
          return (
            <div className="w-6 h-6 rounded-full bg-red-950/40 text-red-400 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          );
        }
        return (
          <div className="w-6 h-6 rounded-full bg-amber-950/40 text-amber-400 flex items-center justify-center flex-shrink-0">
            <PlayCircle className="w-3.5 h-3.5" />
          </div>
        );
    }
  };

  const renderContent = () => {
    switch (event.kind.type) {
      case 'Commit':
        return (
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-text-primary font-medium">
              <span className="truncate" title={event.kind.summary}>
                {event.kind.summary}
              </span>
              <span className="font-mono text-[10px] text-text-muted bg-base-1 border border-border px-1 py-0.2 rounded flex-shrink-0">
                {event.kind.short_sha}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              <span>{event.kind.author}</span>
              <span>•</span>
              <span className="text-text-faint font-mono">{event.repo_name}</span>
            </div>
          </div>
        );

      case 'Push':
        return (
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-text-primary font-medium">
              <span>Pushed {event.kind.commit_count} commit(s) to</span>
              <span className="font-mono text-commito-coral font-bold">{event.kind.branch}</span>
            </div>
            <div className="text-[10px] text-text-muted font-mono">
              {event.repo_name}
            </div>
          </div>
        );

      case 'MergeRequest':
        return (
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-text-primary font-medium">
              <span className="truncate" title={event.kind.title}>
                {event.kind.title}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase flex-shrink-0 ${
                  event.kind.state === 'merged'
                    ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60'
                    : event.kind.state === 'closed'
                    ? 'bg-red-950/60 text-red-300 border border-red-800/60'
                    : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                }`}
              >
                {event.kind.state}
              </span>
              <ExternalLink className="w-3 h-3 text-text-muted flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              <span>@{event.kind.author}</span>
              <span>•</span>
              <span className="text-text-faint font-mono">{event.repo_name}</span>
            </div>
          </div>
        );

      case 'Pipeline':
        return (
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-text-primary font-medium">
              <span>Pipeline on</span>
              <span className="font-mono text-commito-coral font-bold">{event.kind.branch}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase flex-shrink-0 ${
                  event.kind.status === 'success'
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                    : event.kind.status === 'failed'
                    ? 'bg-red-950/60 text-red-300 border border-red-800/60'
                    : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                }`}
              >
                {event.kind.status}
              </span>
              <ExternalLink className="w-3 h-3 text-text-muted flex-shrink-0" />
            </div>
            <div className="text-[10px] text-text-muted font-mono">
              {event.repo_name}
            </div>
          </div>
        );
    }
  };

  return (
    <div
      onClick={handleItemClick}
      className="p-2.5 rounded-lg bg-base-1 border border-border/80 hover:border-commito-coral/50 hover:bg-base-1/80 transition flex items-start gap-2.5 cursor-pointer group"
    >
      {renderIconAndBadge()}
      {renderContent()}
      <span className="text-[10px] font-mono text-text-faint flex-shrink-0 pt-0.5">
        {event.relative_date}
      </span>
    </div>
  );
};
