import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Upload, 
  Download,
  Bell, 
  GitPullRequest,
  AlertCircle,
  X
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
    setIsRepoModalOpen,
    setActiveModalTab,
    currentNavView,
  } = useGitStore();

  const [isPushing, setIsPushing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const getPageTitle = () => {
    switch (currentNavView) {
      case 'files':
        return { title: 'Files', subtitle: 'Browse the working copy' };
      case 'changes':
        return { title: 'Changes', subtitle: 'Inspect uncommitted working copy changes' };
      case 'history':
        return { title: 'History', subtitle: 'View repository commit history log' };
      case 'branches':
        return { title: 'Branches', subtitle: 'Manage local and remote branch heads' };
      case 'locks':
        return { title: 'Locks', subtitle: 'LFS and file lock management' };
      case 'reviews':
        return { title: 'Reviews', subtitle: 'Code reviews and merge requests' };
      case 'overview':
      default:
        return { title: 'Overview', subtitle: 'Project workspace overview' };
    }
  };

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

  const page = getPageTitle();

  return (
    <header className="h-16 bg-base-0 border-b border-border px-6 flex items-center justify-between flex-shrink-0 select-none">
      {/* Left: Page Title & Subtitle */}
      <div>
        <h1 className="text-xl font-extrabold text-text-primary tracking-tight leading-none mb-1">
          {page.title}
        </h1>
        <p className="text-xs text-text-muted font-sans">{page.subtitle}</p>
      </div>

      {/* Right: Action Toolbar */}
      <div className="flex items-center gap-3">
        {error && !error.message?.includes('No remote configured') && !(user && error.message?.includes('Not authenticated')) && (
          <div className="flex items-center gap-1.5 text-[11px] text-red-300 bg-red-950/60 border border-red-800/60 px-2.5 py-1 rounded-lg max-w-xs truncate" title={error.message}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{error.message}</span>
            <button onClick={() => setError(null)} className="ml-1 text-red-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Notifications Bell */}
        <button
          className="p-2 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-md border border-border transition"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={isFetching || !activeRepoPath}
          className={`px-3.5 py-1.5 rounded-md border border-border bg-base-2 hover:bg-base-3 text-text-primary text-xs font-semibold flex items-center gap-2 transition shadow-sm ${
            isFetching || !activeRepoPath ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          title="Sync repository with remote origin"
        >
          <Download className={`w-3.5 h-3.5 text-text-muted ${isFetching ? 'animate-spin' : ''}`} />
          <span>Sync</span>
        </button>

        {/* Push Button (Vibrant Coral Action Button) */}
        <button
          onClick={handlePush}
          disabled={isPushing || !activeRepoPath}
          className={`px-4 py-1.5 rounded-md bg-commito-coral hover:bg-commito-coralHover text-white text-xs font-bold flex items-center gap-2 transition shadow-md ${
            isPushing || !activeRepoPath ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          title="Push local commits to origin"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{isPushing ? 'Pushing...' : 'Push'}</span>
        </button>

        {/* PR / Merge Button */}
        <button
          onClick={() => {
            setActiveModalTab('repos');
            setIsRepoModalOpen(true);
          }}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-md border border-border transition"
          title="Create Merge / Pull Request"
        >
          <GitPullRequest className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
