import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Lock, 
  Unlock, 
  FileText, 
  Plus, 
  Trash2, 
  RefreshCw,
  Layers,
  AlertTriangle
} from 'lucide-react';

import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { LfsFile, LfsLock } from '../types/git';

export const LfsView: React.FC = () => {
  const { activeRepoPath, setError } = useGitStore();

  const [isLfsInstalled, setIsLfsInstalled] = useState<boolean>(true);
  const [lfsFiles, setLfsFiles] = useState<LfsFile[]>([]);
  const [lfsLocks, setLfsLocks] = useState<LfsLock[]>([]);
  const [trackPattern, setTrackPattern] = useState('');
  const [lockFilePath, setLockFilePath] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!activeRepoPath) return;

    // Check if LFS is installed
    invoke<boolean>('check_lfs_installed')
      .then((installed) => setIsLfsInstalled(installed))
      .catch(() => setIsLfsInstalled(false));

    loadLfsData();
  }, [activeRepoPath]);

  const loadLfsData = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);

    try {
      const files = await invoke<LfsFile[]>('list_lfs_files', { repoPath: activeRepoPath });
      setLfsFiles(files || []);
    } catch {
      setLfsFiles([]);
    }

    try {
      const locks = await invoke<LfsLock[]>('list_lfs_locks', { repoPath: activeRepoPath });
      setLfsLocks(locks || []);
    } catch {
      setLfsLocks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrackPattern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !trackPattern.trim()) return;

    try {
      await invoke('track_lfs_pattern', { repoPath: activeRepoPath, pattern: trackPattern.trim() });
      useLogStore.getState().addLog('success', 'Git LFS', `Tracking pattern '${trackPattern.trim()}' with LFS`);
      setTrackPattern('');
      loadLfsData();
    } catch (err: any) {
      setError({ code: 'LFS_ERROR', message: err.message || String(err) });
    }
  };

  const handleUntrackPattern = async (pattern: string) => {
    if (!activeRepoPath) return;

    try {
      await invoke('untrack_lfs_pattern', { repoPath: activeRepoPath, pattern });
      useLogStore.getState().addLog('info', 'Git LFS', `Untracked LFS pattern '${pattern}'`);
      loadLfsData();
    } catch (err: any) {
      setError({ code: 'LFS_ERROR', message: err.message || String(err) });
    }
  };

  const handleLockFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !lockFilePath.trim()) return;

    try {
      await invoke('lock_lfs_file', { repoPath: activeRepoPath, path: lockFilePath.trim() });
      useLogStore.getState().addLog('success', 'Git LFS', `Locked LFS file '${lockFilePath.trim()}'`);
      setLockFilePath('');
      loadLfsData();
    } catch (err: any) {
      setError({ code: 'LFS_ERROR', message: err.message || String(err) });
    }
  };

  const handleUnlockFile = async (path: string) => {
    if (!activeRepoPath) return;

    try {
      await invoke('unlock_lfs_file', { repoPath: activeRepoPath, path, force: false });
      useLogStore.getState().addLog('info', 'Git LFS', `Unlocked LFS file '${path}'`);
      loadLfsData();
    } catch (err: any) {
      setError({ code: 'LFS_ERROR', message: err.message || String(err) });
    }
  };

  return (
    <div className="flex-1 h-full bg-base-1 overflow-y-auto p-6 select-none space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-text-primary flex items-center gap-2">
            <Lock className="w-5 h-5 text-commito-coral" />
            <span>Git LFS & File Locks</span>
          </h2>
          <p className="text-xs text-text-muted">
            Manage Large File Storage tracking patterns and exclusive file locks
          </p>
        </div>

        <button
          onClick={loadLfsData}
          disabled={isLoading}
          className="px-3 py-1.5 bg-base-2 hover:bg-base-3 border border-border rounded-lg text-xs font-semibold text-text-primary flex items-center gap-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-text-muted ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {!isLfsInstalled && (
        <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>
            Git LFS CLI was not detected on your system environment PATH. Install Git LFS to utilize binary file locking.
          </span>
        </div>
      )}

      {/* Grid layout for Track Patterns & Lock Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: LFS Tracking Patterns */}
        <div className="bg-base-2 border border-border rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-gitlab-teal" />
              <span>Track Large File Patterns</span>
            </h3>
            <span className="text-[10px] text-text-muted font-mono">{lfsFiles.length} tracked</span>
          </div>

          <form onSubmit={handleTrackPattern} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. *.psd, *.fbx, *.bin"
              value={trackPattern}
              onChange={(e) => setTrackPattern(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-base-1 border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-commito-coral font-mono"
            />
            <button
              type="submit"
              disabled={!trackPattern.trim()}
              className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralHover text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Track</span>
            </button>
          </form>

          {/* List of tracked files */}
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {lfsFiles.length === 0 ? (
              <p className="text-xs text-text-muted italic p-4 text-center">
                No files tracked with Git LFS in current repository
              </p>
            ) : (
              lfsFiles.map((file) => (
                <div
                  key={file.oid + file.path}
                  className="p-2.5 bg-base-1 border border-border rounded-lg flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <FileText className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    <span className="truncate text-text-primary">{file.path}</span>
                  </div>
                  <button
                    onClick={() => handleUntrackPattern(file.path)}
                    className="p-1 text-text-muted hover:text-red-400 transition"
                    title="Untrack pattern"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 2: Exclusive LFS File Locks */}
        <div className="bg-base-2 border border-border rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
              <Lock className="w-4 h-4 text-commito-coral" />
              <span>Exclusive File Locks</span>
            </h3>
            <span className="text-[10px] text-text-muted font-mono">{lfsLocks.length} locked</span>
          </div>

          <form onSubmit={handleLockFile} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. assets/textures/character.png"
              value={lockFilePath}
              onChange={(e) => setLockFilePath(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-base-1 border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-commito-coral font-mono"
            />
            <button
              type="submit"
              disabled={!lockFilePath.trim()}
              className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralHover text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock</span>
            </button>
          </form>

          {/* List of active locks */}
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {lfsLocks.length === 0 ? (
              <p className="text-xs text-text-muted italic p-4 text-center">
                No active file locks recorded on remote
              </p>
            ) : (
              lfsLocks.map((lock) => (
                <div
                  key={lock.id}
                  className="p-2.5 bg-base-1 border border-border rounded-lg flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 truncate">
                    <div className="font-mono font-bold text-text-primary truncate">
                      {lock.path}
                    </div>
                    <div className="text-[10px] text-text-muted">
                      Locked by {lock.owner}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlockFile(lock.path)}
                    className="px-2 py-1 bg-base-3 hover:bg-base-0 border border-border text-text-secondary rounded text-[11px] font-semibold flex items-center gap-1 transition"
                  >
                    <Unlock className="w-3 h-3 text-emerald-400" />
                    <span>Unlock</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
