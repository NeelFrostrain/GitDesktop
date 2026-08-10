import React from 'react';
import { 
  GitPullRequest,
  AlertCircle,
  X,
  RotateCcw,
  History,
  FileCode,
  Settings,
  GitCommit,
  RefreshCw
} from 'lucide-react';

import { useGitStore } from '../store/useGitStore';
import { SmartGitActionButton } from './SmartGitActionButton';
import { useRepositorySync } from '../hooks/useRepositorySync';

export const Header: React.FC = () => {
  const {
    activeRepoPath,
    error,
    setError,
    setIsMergeRequestModalOpen,
    setIsRebaseModalOpen,
    setIsCherryPickModalOpen,
    setIsReflogModalOpen,
    setIsPatchModalOpen,
    setIsConfigModalOpen,
  } = useGitStore();

  const { refreshSync, isFetching } = useRepositorySync();

  return (
    <header className="h-10 bg-base-0 border-b border-border px-4 flex items-center justify-between flex-shrink-0 select-none">
      {/* Left: Compact Action Tools Group */}
      <div className="flex items-center gap-1.5">
        {/* Fetch/Refresh Status */}
        <button
          onClick={refreshSync}
          disabled={isFetching || !activeRepoPath}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-md border border-border transition cursor-pointer"
          title="Refresh Repository Status"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-commito-coral ${isFetching ? 'animate-spin' : ''}`} />
        </button>

        {/* Rebase Tool */}
        <button
          onClick={() => setIsRebaseModalOpen(true)}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-md border border-border transition cursor-pointer"
          title="Interactive Rebase"
        >
          <RotateCcw className="w-3.5 h-3.5 text-text-muted hover:text-commito-coral" />
        </button>

        {/* Cherry Pick Tool */}
        <button
          onClick={() => setIsCherryPickModalOpen(true)}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-md border border-border transition cursor-pointer"
          title="Cherry-Pick Commits"
        >
          <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
        </button>

        {/* Reflog Tool */}
        <button
          onClick={() => setIsReflogModalOpen(true)}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-md border border-border transition cursor-pointer"
          title="Reflog Safety Net"
        >
          <History className="w-3.5 h-3.5 text-gitlab-teal" />
        </button>

        {/* Patch Studio */}
        <button
          onClick={() => setIsPatchModalOpen(true)}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-md border border-border transition cursor-pointer"
          title="Export / Apply Patch"
        >
          <FileCode className="w-3.5 h-3.5 text-amber-400" />
        </button>

        {/* Git Config */}
        <button
          onClick={() => setIsConfigModalOpen(true)}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-md border border-border transition cursor-pointer"
          title="Repo Config & .gitignore"
        >
          <Settings className="w-3.5 h-3.5 text-text-secondary" />
        </button>
      </div>

      {/* Right: Sync, Push & PR Action Group */}
      <div className="flex items-center gap-2">
        {error && !error.message?.includes('No remote configured') && !error.message?.includes('Not authenticated') && (
          <div className="flex items-center gap-1 text-[11px] text-red-300 bg-red-950/60 border border-red-800/60 px-2 py-0.5 rounded-md max-w-xs truncate" title={error.message}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{error.message}</span>
            <button onClick={() => setError(null)} className="ml-1 text-red-400 hover:text-white cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Smart Git Action Button */}
        <SmartGitActionButton />

        {/* PR / Merge Button */}
        <button
          onClick={() => setIsMergeRequestModalOpen(true)}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-md border border-border transition cursor-pointer"
          title="Create Merge / Pull Request"
        >
          <GitPullRequest className="w-4 h-4 text-commito-coral" />
        </button>
      </div>
    </header>
  );
};
