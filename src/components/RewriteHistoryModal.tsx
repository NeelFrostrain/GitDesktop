import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  X, 
  AlertTriangle, 
  ArrowUpDown, 
  GitMerge, 
  Info,
  Play
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { RepoStatus } from '../types/git';
import { UserAvatar } from './UserAvatar';

export const RewriteHistoryModal: React.FC = () => {
  const {
    activeRepoPath,
    status,
    setStatus,
    setError,
    isRewriteModalOpen,
    setIsRewriteModalOpen,
    pendingHistoryOp,
    setPendingHistoryOp,
    setSelectedCommitSha,
  } = useGitStore();

  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!pendingHistoryOp) return;
    if (pendingHistoryOp.type === 'merge') {
      const msg = `${pendingHistoryOp.targetCommit.message}\n\n${pendingHistoryOp.sourceCommit.message}`;
      setNewMessage(msg);
    } else {
      setNewMessage('');
    }
  }, [pendingHistoryOp]);

  if (!isRewriteModalOpen || !pendingHistoryOp) return null;

  const hasUncommittedChanges = (status?.files.length ?? 0) > 0;
  const isPushedToRemote = (status?.ahead ?? 0) > 0;

  const handleClose = () => {
    setIsRewriteModalOpen(false);
    setPendingHistoryOp(null);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || hasUncommittedChanges) return;

    setIsSubmitting(true);

    try {
      let payload: any;
      if (pendingHistoryOp.type === 'reorder') {
        payload = {
          type: 'reorder',
          sourceSha: pendingHistoryOp.sourceCommit.sha,
          targetSha: pendingHistoryOp.targetCommit.sha,
          position: pendingHistoryOp.position,
        };
      } else if (pendingHistoryOp.type === 'merge') {
        payload = {
          type: 'merge',
          sourceSha: pendingHistoryOp.sourceCommit.sha,
          targetSha: pendingHistoryOp.targetCommit.sha,
          newMessage: newMessage.trim(),
        };
      } else {
        throw new Error('Unsupported operation type');
      }

      await invoke('rewrite_history_cmd', {
        repoPath: activeRepoPath,
        operation: payload,
      });

      useLogStore.getState().addLog(
        'success',
        'Git',
        pendingHistoryOp.type === 'reorder'
          ? `Reordered commit ${pendingHistoryOp.sourceCommit.short_sha} ${pendingHistoryOp.position} ${pendingHistoryOp.targetCommit.short_sha}`
          : `Merged commits ${pendingHistoryOp.sourceCommit.short_sha} into ${pendingHistoryOp.targetCommit.short_sha}`
      );

      // Refresh repository status
      const updatedStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(updatedStatus);

      // Update selected commit SHA if available
      if (pendingHistoryOp.type === 'merge') {
        setSelectedCommitSha(pendingHistoryOp.targetCommit.sha);
      }

      handleClose();
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      setError({ code: 'HISTORY_REWRITE_ERROR', message: errorMsg });

      // Refresh status on failure as well
      try {
        const refreshedStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
        setStatus(refreshedStatus);
      } catch {}

      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-base-0 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-commito-coral/20 border border-commito-coral/40 text-commito-coral flex items-center justify-center">
              {pendingHistoryOp.type === 'reorder' ? (
                <ArrowUpDown className="w-4 h-4" />
              ) : (
                <GitMerge className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary leading-tight">
                {pendingHistoryOp.type === 'reorder'
                  ? 'Reorder Commit History'
                  : 'Merge Commits'}
              </h2>
              <p className="text-[11px] text-text-muted">
                Rewriting Git history on branch <span className="font-mono text-commito-coral font-bold">{status?.current_branch || 'HEAD'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-base-2 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleConfirm} className="p-5 space-y-4 overflow-y-auto">
          {/* Uncommitted changes blocking alert */}
          {hasUncommittedChanges && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-md flex items-start gap-2.5 text-xs text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-red-300 block mb-0.5">Uncommitted changes detected</strong>
                Your working directory contains uncommitted changes. Please commit or stash your changes before rewriting Git history to avoid loss of uncommitted work.
              </div>
            </div>
          )}

          {/* Remote branch warning */}
          {!hasUncommittedChanges && isPushedToRemote && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-md flex items-start gap-2.5 text-xs text-amber-200">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-300 block mb-0.5">Remote Branch Sync Notice</strong>
                Rewriting history changes commit hashes. Updating a remote branch will require a manual force push (the application will not force push automatically).
              </div>
            </div>
          )}

          {/* Reorder Details */}
          {pendingHistoryOp.type === 'reorder' && (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary">
                You are moving the commit:
              </p>

              {/* Source Commit Preview */}
              <div className="p-3 bg-base-2 border border-commito-coral/50 rounded-md space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-text-primary truncate">
                    {pendingHistoryOp.sourceCommit.message}
                  </span>
                  <span className="px-1.5 py-0.2 bg-base-3 border border-border rounded font-mono text-[10px] text-text-muted">
                    {pendingHistoryOp.sourceCommit.short_sha}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <div className="flex items-center gap-1.5">
                    <UserAvatar name={pendingHistoryOp.sourceCommit.author_name} className="w-3.5 h-3.5" iconClassName="w-2 h-2" />
                    <span>{pendingHistoryOp.sourceCommit.author_name}</span>
                  </div>
                  <span>{pendingHistoryOp.sourceCommit.relative_date}</span>
                </div>
              </div>

              <div className="text-center text-xs font-bold text-commito-coral uppercase tracking-wider">
                ↓ Move {pendingHistoryOp.position} ↓
              </div>

              {/* Target Commit Preview */}
              <div className="p-3 bg-base-2 border border-border rounded-md space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-text-primary truncate">
                    {pendingHistoryOp.targetCommit.message}
                  </span>
                  <span className="px-1.5 py-0.2 bg-base-3 border border-border rounded font-mono text-[10px] text-text-muted">
                    {pendingHistoryOp.targetCommit.short_sha}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <div className="flex items-center gap-1.5">
                    <UserAvatar name={pendingHistoryOp.targetCommit.author_name} className="w-3.5 h-3.5" iconClassName="w-2 h-2" />
                    <span>{pendingHistoryOp.targetCommit.author_name}</span>
                  </div>
                  <span>{pendingHistoryOp.targetCommit.relative_date}</span>
                </div>
              </div>
            </div>
          )}

          {/* Merge Details */}
          {pendingHistoryOp.type === 'merge' && (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary">
                The following two commits will be merged into a single commit:
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Target (Base) Commit */}
                <div className="p-3 bg-base-2 border border-border rounded-md space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">First Commit (Target)</span>
                  <h4 className="text-xs font-bold text-text-primary truncate">{pendingHistoryOp.targetCommit.message}</h4>
                  <span className="inline-block px-1.5 py-0.2 bg-base-3 border border-border rounded font-mono text-[10px] text-text-muted">
                    {pendingHistoryOp.targetCommit.short_sha}
                  </span>
                </div>

                {/* Source Commit */}
                <div className="p-3 bg-base-2 border border-border rounded-md space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-commito-coral block">Second Commit (Source)</span>
                  <h4 className="text-xs font-bold text-text-primary truncate">{pendingHistoryOp.sourceCommit.message}</h4>
                  <span className="inline-block px-1.5 py-0.2 bg-base-3 border border-border rounded font-mono text-[10px] text-text-muted">
                    {pendingHistoryOp.sourceCommit.short_sha}
                  </span>
                </div>
              </div>

              {/* Editable New Message */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-text-primary block">
                  New Commit Message:
                </label>
                <textarea
                  rows={4}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Enter combined commit message..."
                  className="w-full px-3 py-2 bg-base-0 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 resize-y font-sans leading-relaxed"
                  required
                />
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-base-2 hover:bg-base-3 border border-border rounded-md text-xs font-semibold text-text-secondary transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || hasUncommittedChanges || (pendingHistoryOp.type === 'merge' && !newMessage.trim())}
              className={`px-5 py-2 rounded-md text-xs font-bold flex items-center gap-2 transition shadow-sm ${
                hasUncommittedChanges
                  ? 'bg-base-2 text-text-muted border border-border cursor-not-allowed'
                  : 'bg-commito-coral hover:bg-commito-coralHover text-white cursor-pointer'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {isSubmitting
                  ? 'Rewriting History...'
                  : pendingHistoryOp.type === 'reorder'
                  ? 'Execute Reorder'
                  : 'Merge Commits'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
