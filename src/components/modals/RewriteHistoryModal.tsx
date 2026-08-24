import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  AlertTriangle,
  ArrowUpDown,
  GitMerge,
  Info,
  Play,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';

/**
 * Modal dialogue for confirming and executing history rewrite operations triggered by drag-and-drop
 * reordering or commit squashing/merging.
 */
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
      let payload: Record<string, unknown>;
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

      const updatedStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(updatedStatus);

      if (pendingHistoryOp.type === 'merge') {
        setSelectedCommitSha(pendingHistoryOp.targetCommit.sha);
      }

      handleClose();
    } catch (error: unknown) {
      setError(toAppError(error, 'HISTORY_REWRITE_ERROR'));

      try {
        const refreshedStatus = await GitService.getRepoStatus(activeRepoPath);
        setStatus(refreshedStatus);
      } catch {
        // Silently ignore secondary status fetch failure
      }

      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-sm shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-base-0 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-commito-coral/20 border border-commito-coral/40 text-commito-coral flex items-center justify-center">
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
            className="p-1.5 text-text-muted hover:text-text-primary rounded-sm hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleConfirm} className="p-5 space-y-4 overflow-y-auto">
          {/* Uncommitted changes blocking alert */}
          {hasUncommittedChanges && (
            <div className="p-3 bg-git-removed-bg border border-git-removed/40 rounded-sm flex items-start gap-2.5 text-xs text-git-removed">
              <AlertTriangle className="w-4 h-4 text-git-removed flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-git-removed block mb-0.5">Uncommitted changes detected</strong>
                Your working directory contains uncommitted changes. Please commit or stash your changes before rewriting Git history to avoid loss of uncommitted work.
              </div>
            </div>
          )}

          {/* Remote branch warning */}
          {!hasUncommittedChanges && isPushedToRemote && (
            <div className="p-3 bg-git-modified-bg border border-git-modified/40 rounded-sm flex items-start gap-2.5 text-xs text-git-modified">
              <Info className="w-4 h-4 text-git-modified flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-git-modified block mb-0.5">Remote Branch Sync Notice</strong>
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

              <div className="p-3 bg-base-2 border border-border rounded-sm space-y-1">
                <h4 className="text-xs font-bold text-text-primary">{pendingHistoryOp.sourceCommit.message}</h4>
                <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono">
                  <span>{pendingHistoryOp.sourceCommit.short_sha}</span>
                  <span>•</span>
                  <span>{pendingHistoryOp.sourceCommit.author_name}</span>
                </div>
              </div>

              <p className="text-xs text-text-secondary">
                To position <strong className="text-text-primary uppercase">{pendingHistoryOp.position}</strong> commit:
              </p>

              <div className="p-3 bg-base-2 border border-border rounded-sm space-y-1">
                <h4 className="text-xs font-bold text-text-primary">{pendingHistoryOp.targetCommit.message}</h4>
                <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono">
                  <span>{pendingHistoryOp.targetCommit.short_sha}</span>
                  <span>•</span>
                  <span>{pendingHistoryOp.targetCommit.author_name}</span>
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
                <div className="p-3 bg-base-2 border border-border rounded-sm space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-git-added block">First Commit (Target)</span>
                  <h4 className="text-xs font-bold text-text-primary truncate">{pendingHistoryOp.targetCommit.message}</h4>
                  <span className="inline-block px-1.5 py-0.2 bg-base-3 border border-border rounded font-mono text-[10px] text-text-muted">
                    {pendingHistoryOp.targetCommit.short_sha}
                  </span>
                </div>

                {/* Source Commit */}
                <div className="p-3 bg-base-2 border border-border rounded-sm space-y-1">
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
                  className="w-full px-3 py-2 bg-base-0 border border-border rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 resize-y font-sans leading-relaxed"
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
              className="px-4 py-2 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-xs font-semibold text-text-secondary transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || hasUncommittedChanges || (pendingHistoryOp.type === 'merge' && !newMessage.trim())}
              className={`px-5 py-2 rounded-sm text-xs font-bold flex items-center gap-2 transition shadow-xs ${
                hasUncommittedChanges
                  ? 'bg-base-2 text-text-muted border border-border cursor-not-allowed'
                  : 'bg-commito-coral hover:bg-commito-coralLight text-white cursor-pointer'
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
