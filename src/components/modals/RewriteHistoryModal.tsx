import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  AlertTriangle,
  ArrowUpDown,
  GitMerge,
  Info,
  Play,
  Loader2,
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
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 border border-commito-coral/30">
              {pendingHistoryOp.type === 'reorder' ? (
                <ArrowUpDown className="w-3.5 h-3.5" />
              ) : (
                <GitMerge className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-bold text-text-primary leading-none truncate">
                {pendingHistoryOp.type === 'reorder'
                  ? 'Reorder Commit History'
                  : 'Merge Commits'}
              </h3>
              {status?.current_branch && (
                <>
                  <span className="text-border hidden sm:inline">•</span>
                  <span className="text-[11px] text-text-muted truncate hidden sm:inline font-mono">
                    {status.current_branch}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer disabled:opacity-50"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <form id="rewrite-history-form" onSubmit={handleConfirm} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
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
                {pendingHistoryOp.position === 'before'
                  ? 'To immediately before commit:'
                  : 'To immediately after commit:'}
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
                Combining 2 commits into 1 single commit:
              </p>

              <div className="space-y-1.5">
                <div className="p-2.5 bg-base-2 border border-border rounded-sm text-xs font-bold text-text-primary">
                  1. {pendingHistoryOp.sourceCommit.message}
                </div>
                <div className="p-2.5 bg-base-2 border border-border rounded-sm text-xs font-bold text-text-primary">
                  2. {pendingHistoryOp.targetCommit.message}
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-text-primary block">
                  New Combined Commit Message
                </label>
                <textarea
                  rows={3}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Enter combined commit message..."
                  className="w-full px-3 py-2 bg-base-0 border border-border hover:border-border-strong rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-border-strong resize-y font-sans leading-relaxed"
                  required
                />
              </div>
            </div>
          )}
        </form>

        {/* Pinned Bottom Footer Controls */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border bg-base-1 shrink-0 select-none">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="h-7.5 px-3.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer shadow-2xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="rewrite-history-form"
            disabled={isSubmitting || hasUncommittedChanges || (pendingHistoryOp.type === 'merge' && !newMessage.trim())}
            className={`h-7.5 px-4 rounded-sm text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
              hasUncommittedChanges
                ? 'bg-base-2 text-text-muted border border-border cursor-not-allowed opacity-60'
                : 'bg-commito-coral hover:bg-commito-coralLight text-white active:scale-98 disabled:opacity-60'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>
              {isSubmitting
                ? 'Rewriting History...'
                : pendingHistoryOp.type === 'reorder'
                ? 'Execute Reorder'
                : 'Merge Commits'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
