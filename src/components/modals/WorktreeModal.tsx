import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  X,
  Layers,
  Plus,
  Trash2,
  FolderOpen,
  GitBranch,
  RefreshCw,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { WorktreeInfo } from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';

/**
 * Modal dialogue for listing, creating, and removing linked Git worktrees for concurrent branch working copies.
 */
export const WorktreeModal: React.FC = () => {
  const {
    activeRepoPath,
    isWorktreeModalOpen,
    setIsWorktreeModalOpen,
    setError,
  } = useGitStore();

  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [newWorktreePath, setNewWorktreePath] = useState('');
  const [newWorktreeBranch, setNewWorktreeBranch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadWorktrees = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);
    try {
      const res = await GitService.listWorktrees(activeRepoPath);
      setWorktrees(res || []);
    } catch {
      setWorktrees([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isWorktreeModalOpen || !activeRepoPath) return;
    loadWorktrees();
  }, [isWorktreeModalOpen, activeRepoPath]);

  const handleCreateWorktree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !newWorktreePath.trim()) return;

    setIsSubmitting(true);
    try {
      await invoke('create_worktree', {
        repoPath: activeRepoPath,
        path: newWorktreePath.trim(),
        branch: newWorktreeBranch.trim() || null,
      });

      useLogStore.getState().addLog('success', 'Worktree', `Created worktree at '${newWorktreePath.trim()}'`);
      setNewWorktreePath('');
      setNewWorktreeBranch('');
      loadWorktrees();
    } catch (error: unknown) {
      setError(toAppError(error, 'WORKTREE_ERROR'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveWorktree = async (path: string) => {
    if (!activeRepoPath) return;

    try {
      await invoke('remove_worktree', { repoPath: activeRepoPath, path, force: false });
      useLogStore.getState().addLog('info', 'Worktree', `Removed worktree '${path}'`);
      loadWorktrees();
    } catch (error: unknown) {
      setError(toAppError(error, 'WORKTREE_ERROR'));
    }
  };

  if (!isWorktreeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans animate-in fade-in duration-100">
      <div className="bg-base-0 border border-border-strong rounded-md shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 border border-commito-coral/30">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-bold text-text-primary leading-none truncate">
                Git Worktrees Manager
              </h3>
              <span className="text-border hidden sm:inline">•</span>
              <span className="text-[11px] text-text-muted truncate hidden sm:inline font-mono">
                {worktrees.length} active worktree{worktrees.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsWorktreeModalOpen(false)}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-base-0">
          {/* Create New Worktree Form */}
          <form onSubmit={handleCreateWorktree} className="p-4 bg-base-1 border border-border rounded-md space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-commito-coral" />
              <span>Add New Worktree</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-text-secondary mb-1 block">
                  Worktree Path (Required)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ../my-repo-hotfix"
                  value={newWorktreePath}
                  onChange={(e) => setNewWorktreePath(e.target.value)}
                  className="w-full px-3 py-1.5 bg-base-0 border border-border rounded-sm text-xs text-text-primary focus:outline-none focus:border-commito-coral font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-secondary mb-1 block">
                  Branch Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. hotfix/patch-v1.1"
                  value={newWorktreeBranch}
                  onChange={(e) => setNewWorktreeBranch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-base-0 border border-border rounded-sm text-xs text-text-primary focus:outline-none focus:border-commito-coral font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={!newWorktreePath.trim() || isSubmitting}
                className="h-7.5 px-4 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Adding...' : 'Add Worktree'}</span>
              </button>
            </div>
          </form>

          {/* Worktree List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <span className="text-xs font-bold text-text-primary">
                Active Worktrees ({worktrees.length})
              </span>
              <button
                onClick={loadWorktrees}
                disabled={isLoading}
                className="p-1 text-text-muted hover:text-text-primary cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-2">
              {worktrees.map((wt) => (
                <div
                  key={wt.path}
                  className="p-3 bg-base-1 border border-border hover:border-border-strong rounded-md flex items-center justify-between transition shadow-xs"
                >
                  <div className="min-w-0 truncate pr-3">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-text-primary truncate">
                      <FolderOpen className="w-3.5 h-3.5 text-gitlab-teal flex-shrink-0" />
                      <span className="truncate">{wt.path}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-text-muted font-mono mt-1">
                      <GitBranch className="w-3 h-3 text-commito-coral" />
                      <span>{wt.branch || 'detached'}</span>
                      {wt.head_sha && <span>({wt.head_sha.slice(0, 7)})</span>}
                      {wt.is_bare && <span className="text-git-modified font-bold">[bare]</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openUrl(wt.path)}
                      className="px-2.5 py-1 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-semibold text-text-secondary transition cursor-pointer"
                    >
                      Open
                    </button>
                    {!wt.path.endsWith('.git') && (
                      <button
                        type="button"
                        onClick={() => handleRemoveWorktree(wt.path)}
                        className="p-1.5 text-text-muted hover:text-git-removed transition cursor-pointer"
                        title="Remove worktree"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-4 py-2.5 border-t border-border bg-base-1 shrink-0 font-sans select-none">
          <button
            type="button"
            onClick={() => setIsWorktreeModalOpen(false)}
            className="h-7.5 px-3.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
