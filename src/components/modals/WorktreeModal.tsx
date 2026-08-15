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
  RefreshCw 
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { WorktreeInfo } from '../../types/git';

export const WorktreeModal: React.FC = () => {
  const {
    activeRepoPath,
    isWorktreeModalOpen,
    setIsWorktreeModalOpen,
    setError
  } = useGitStore();

  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [newWorktreePath, setNewWorktreePath] = useState('');
  const [newWorktreeBranch, setNewWorktreeBranch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isWorktreeModalOpen || !activeRepoPath) return;
    loadWorktrees();
  }, [isWorktreeModalOpen, activeRepoPath]);

  const loadWorktrees = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);
    try {
      const res = await invoke<WorktreeInfo[]>('list_worktrees', { repoPath: activeRepoPath });
      setWorktrees(res || []);
    } catch {
      setWorktrees([]);
    } finally {
      setIsLoading(false);
    }
  };

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
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      setError({ code: 'WORKTREE_ERROR', message: errorMsg });
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
    } catch (err: any) {
      setError({ code: 'WORKTREE_ERROR', message: err.message || String(err) });
    }
  };

  if (!isWorktreeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-base-0 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-gitlab-teal/20 border border-gitlab-teal/40 text-gitlab-teal flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary leading-tight">
                Git Worktrees Manager
              </h2>
              <p className="text-[11px] text-text-muted">
                Manage multiple linked working trees for parallel branch checkouts
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsWorktreeModalOpen(false)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-base-2 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Create New Worktree Form */}
          <form onSubmit={handleCreateWorktree} className="p-4 bg-base-2 border border-border rounded-md space-y-3">
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
                  className="w-full px-3 py-1.5 bg-base-1 border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-commito-coral font-mono"
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
                  className="w-full px-3 py-1.5 bg-base-1 border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-commito-coral font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={!newWorktreePath.trim() || isSubmitting}
                className={`px-4 py-1.5 bg-commito-coral hover:bg-commito-coralHover text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-sm ${
                  !newWorktreePath.trim() || isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
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
                className="p-1 text-text-muted hover:text-text-primary"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-2">
              {worktrees.map((wt) => (
                <div
                  key={wt.path}
                  className="p-3 bg-base-2 border border-border rounded-md flex items-center justify-between hover:border-text-muted transition"
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
                      {wt.is_bare && <span className="text-amber-400 font-bold">[bare]</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openUrl(wt.path)}
                      className="px-2.5 py-1 bg-base-3 hover:bg-base-0 border border-border rounded-md text-xs font-semibold text-text-secondary transition"
                    >
                      Open
                    </button>
                    {!wt.path.endsWith('.git') && (
                      <button
                        onClick={() => handleRemoveWorktree(wt.path)}
                        className="p-1.5 text-text-muted hover:text-red-400 transition"
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
      </div>
    </div>
  );
};
