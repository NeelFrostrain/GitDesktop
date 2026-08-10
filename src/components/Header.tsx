import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Upload, 
  Download,
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
import { useLogStore } from '../store/useLogStore';
import { RepoStatus } from '../types/git';

export const Header: React.FC = () => {
  const {
    activeRepoPath,
    setStatus,
    user,
    error,
    setError,
    setIsMergeRequestModalOpen,
    setIsRebaseModalOpen,
    setIsCherryPickModalOpen,
    setIsReflogModalOpen,
    setIsPatchModalOpen,
    setIsConfigModalOpen,
  } = useGitStore();

  const [isPushing, setIsPushing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const handleSync = async () => {
    if (!activeRepoPath) return;
    setIsFetching(true);
    try {
      await invoke('fetch_remote_cmd', { repoPath: activeRepoPath });
      const res = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(res);
      useLogStore.getState().addLog('success', 'Git', 'Fetched latest changes from origin');
    } catch (err: any) {
      setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) });
    } finally {
      setIsFetching(false);
    }
  };

  const handlePush = async () => {
    if (!activeRepoPath) return;
    setIsPushing(true);
    try {
      await invoke('push_to_remote_cmd', { repoPath: activeRepoPath, force: false });
      const res = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(res);
      useLogStore.getState().addLog('success', 'Git', 'Pushed commits to remote origin');
    } catch (err: any) {
      setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <header className="h-10 bg-base-0 border-b border-border px-4 flex items-center justify-between flex-shrink-0 select-none">
      {/* Left: Compact Action Tools Group */}
      <div className="flex items-center gap-1.5">
        {/* Fetch/Refresh Status */}
        <button
          onClick={handleSync}
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
        {error && !error.message?.includes('No remote configured') && !(user && error.message?.includes('Not authenticated')) && (
          <div className="flex items-center gap-1 text-[11px] text-red-300 bg-red-950/60 border border-red-800/60 px-2 py-0.5 rounded-md max-w-xs truncate" title={error.message}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{error.message}</span>
            <button onClick={() => setError(null)} className="ml-1 text-red-400 hover:text-white cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={isFetching || !activeRepoPath}
          className={`px-2.5 py-1 rounded-md border border-border bg-base-2 hover:bg-base-3 text-text-primary text-xs font-semibold flex items-center gap-1.5 transition shadow-xs ${
            isFetching || !activeRepoPath ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          title="Sync repository with remote origin"
        >
          <Download className={`w-3.5 h-3.5 text-text-muted ${isFetching ? 'animate-spin' : ''}`} />
          <span>Sync</span>
        </button>

        {/* Push Button */}
        <button
          onClick={handlePush}
          disabled={isPushing || !activeRepoPath}
          className={`px-3 py-1 rounded-md bg-commito-coral hover:bg-commito-coralHover text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs ${
            isPushing || !activeRepoPath ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          title="Push local commits to origin"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{isPushing ? 'Pushing...' : 'Push'}</span>
        </button>

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
