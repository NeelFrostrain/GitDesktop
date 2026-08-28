import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertTriangle,
  ArrowRightLeft,
  Archive,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';

interface BranchCheckoutModalProps {
  isOpen: boolean;
  targetBranch: string;
  currentBranch: string;
  uncommittedCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal dialogue displayed when switching branches while working tree has dirty/uncommitted modifications.
 * Offers options to Bring Changes (auto-stash/pop), Leave Changes (stash and leave), or Discard/Force checkout.
 */
export const BranchCheckoutModal: React.FC<BranchCheckoutModalProps> = ({
  isOpen,
  targetBranch,
  currentBranch,
  uncommittedCount,
  onClose,
  onSuccess,
}) => {
  const { activeRepoPath, setStatus, setError } = useGitStore();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const refreshRepoStatus = async () => {
    if (!activeRepoPath) return;
    const newStatus = await GitService.getRepoStatus(activeRepoPath);
    setStatus(newStatus);
  };

  // Option 1: Bring Changes (Stash -> Checkout -> Pop)
  const handleBringChanges = async () => {
    if (!activeRepoPath) return;
    setIsProcessing(true);
    try {
      await invoke('create_stash_cmd', {
        repoPath: activeRepoPath,
        message: `Auto-stash before checkout to ${targetBranch}`,
        includeUntracked: true,
      });

      await GitService.checkoutBranch(activeRepoPath, targetBranch);

      try {
        await invoke('pop_stash_cmd', {
          repoPath: activeRepoPath,
          index: 0,
        });
        useLogStore.getState().addLog('success', 'Git', `Switched to '${targetBranch}' and brought changes along`);
      } catch (popErr: unknown) {
        const popMsg = getErrorMessage(popErr);
        useLogStore
          .getState()
          .addLog(
            'warning',
            'Git',
            `Switched to '${targetBranch}', but stash pop had conflicts: ${popMsg}`
          );
      }

      await refreshRepoStatus();
      onSuccess();
    } catch (error: unknown) {
      setError(toAppError(error, 'CHECKOUT_ERROR'));
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  // Option 2: Leave Changes (Stash & Leave on current branch -> Checkout)
  const handleLeaveChanges = async () => {
    if (!activeRepoPath) return;
    setIsProcessing(true);
    try {
      await invoke('create_stash_cmd', {
        repoPath: activeRepoPath,
        message: `Saved changes on ${currentBranch} before checkout`,
        includeUntracked: true,
      });

      await GitService.checkoutBranch(activeRepoPath, targetBranch);

      useLogStore
        .getState()
        .addLog('info', 'Git', `Stashed changes on '${currentBranch}' and switched to '${targetBranch}'`);
      await refreshRepoStatus();
      onSuccess();
    } catch (error: unknown) {
      setError(toAppError(error, 'CHECKOUT_ERROR'));
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  // Option 3: Force Checkout (Discard Local Changes)
  const handleForceCheckout = async () => {
    if (!activeRepoPath) return;
    setIsProcessing(true);
    try {
      await GitService.checkoutBranch(activeRepoPath, targetBranch);

      useLogStore.getState().addLog('warning', 'Git', `Force checked out '${targetBranch}'`);
      await refreshRepoStatus();
      onSuccess();
    } catch (error: unknown) {
      setError(toAppError(error, 'CHECKOUT_ERROR'));
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans animate-in fade-in duration-100">
      <div className="bg-base-0 border border-border-strong rounded-sm shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-git-modified-bg border border-git-modified/40 text-git-modified flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-bold text-text-primary leading-none truncate">
                Uncommitted Changes
              </h3>
              <span className="text-border hidden sm:inline">•</span>
              <span className="text-[11px] text-text-muted truncate hidden sm:inline font-mono">
                <span className="text-text-secondary">{currentBranch}</span> <span className="text-text-muted">→</span> <span className="text-commito-coral font-bold">{targetBranch}</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer disabled:opacity-50"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body with 3 Action Choices */}
        <div className="p-4 sm:p-5 space-y-3 bg-base-0 overflow-y-auto">
          <p className="text-xs text-text-secondary leading-relaxed">
            You have <span className="font-bold text-text-primary">{uncommittedCount}</span> uncommitted file change
            {uncommittedCount === 1 ? '' : 's'}. Choose how to handle them:
          </p>

          {/* Option 1: Bring Changes */}
          <button
            type="button"
            onClick={handleBringChanges}
            disabled={isProcessing}
            className="w-full p-3.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-left transition flex items-start gap-3 group cursor-pointer shadow-xs"
          >
            <div className="w-7 h-7 rounded-sm bg-commito-coral/15 border border-border-strong text-commito-coral flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-text-primary flex items-center gap-2">
                <span>Bring Changes Along</span>
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-xs bg-commito-coral/15 text-commito-coral border border-border-strong leading-none">
                  Recommended
                </span>
              </div>
              <p className="text-[11.5px] text-text-muted mt-1 leading-relaxed">
                Stashes your modifications, checks out <span className="font-mono text-text-primary font-semibold px-1 py-0.2 bg-base-2 border border-border rounded-xs text-[11px]">{targetBranch}</span>, and reapplies them immediately.
              </p>
            </div>
          </button>

          {/* Option 2: Leave Changes */}
          <button
            type="button"
            onClick={handleLeaveChanges}
            disabled={isProcessing}
            className="w-full p-3.5 bg-base-1 hover:bg-base-2 border border-border hover:border-gitlab-blue/50 rounded-sm text-left transition flex items-start gap-3 group cursor-pointer shadow-xs"
          >
            <div className="w-7 h-7 rounded-sm bg-gitlab-blue/15 border border-gitlab-blue/30 text-gitlab-blue flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <Archive className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-text-primary">
                Leave Changes on {currentBranch}
              </div>
              <p className="text-[11.5px] text-text-muted mt-1 leading-relaxed">
                Saves your changes in a stash associated with <span className="font-mono text-text-primary font-semibold px-1 py-0.2 bg-base-2 border border-border rounded-xs text-[11px]">{currentBranch}</span> so you can resume later.
              </p>
            </div>
          </button>

          {/* Option 3: Discard / Force */}
          <button
            type="button"
            onClick={handleForceCheckout}
            disabled={isProcessing}
            className="w-full p-3.5 bg-base-1 hover:bg-git-removed-bg/25 border border-border hover:border-git-removed/50 rounded-sm text-left transition flex items-start gap-3 group cursor-pointer shadow-xs"
          >
            <div className="w-7 h-7 rounded-sm bg-git-removed-bg border border-git-removed/40 text-git-removed flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <Trash2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-git-removed">
                Discard Changes & Force Checkout
              </div>
              <p className="text-[11.5px] text-text-muted mt-1 leading-relaxed">
                Permanently overwrites and discards local modifications when switching to <span className="font-mono text-text-primary font-semibold px-1 py-0.2 bg-base-2 border border-border rounded-xs text-[11px]">{targetBranch}</span>.
              </p>
            </div>
          </button>
        </div>

        {/* Pinned Bottom Footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-border bg-base-1 shrink-0 font-sans select-none">
          <div className="text-[11px] text-text-muted">
            {isProcessing && (
              <span className="flex items-center gap-1.5 text-commito-coral font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Processing checkout...</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="h-7.5 px-3.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer shadow-2xs disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
