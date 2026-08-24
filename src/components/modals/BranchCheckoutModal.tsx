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
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-git-modified-bg border-b border-git-modified/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-git-modified-bg border border-git-modified/40 text-git-modified flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary leading-tight">
                Uncommitted Changes Detected
              </h2>
              <p className="text-[11px] text-text-muted">
                Switching branch from <span className="font-mono text-git-modified">{currentBranch}</span> to{' '}
                <span className="font-mono text-commito-coral">{targetBranch}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body with 3 Action Choices */}
        <div className="p-5 space-y-3">
          <p className="text-xs text-text-secondary">
            You have <span className="font-bold text-text-primary">{uncommittedCount}</span> uncommitted file change
            {uncommittedCount === 1 ? '' : 's'}. Choose how you would like to handle them before switching branches:
          </p>

          {/* Option 1: Bring Changes */}
          <button
            type="button"
            onClick={handleBringChanges}
            disabled={isProcessing}
            className="w-full p-3.5 bg-base-2 hover:bg-base-3 border border-border hover:border-commito-coral/50 rounded-md text-left transition flex items-start gap-3 group cursor-pointer"
          >
            <div className="w-7 h-7 rounded bg-commito-coral/15 border border-commito-coral/30 text-commito-coral flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <span>Bring Changes Along</span>
                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-commito-coral/20 text-commito-coral border border-commito-coral/30">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                Stashes your modifications, checks out <span className="font-mono text-text-secondary">{targetBranch}</span>, and reapplies them immediately.
              </p>
            </div>
          </button>

          {/* Option 2: Leave Changes */}
          <button
            type="button"
            onClick={handleLeaveChanges}
            disabled={isProcessing}
            className="w-full p-3.5 bg-base-2 hover:bg-base-3 border border-border hover:border-text-muted rounded-md text-left transition flex items-start gap-3 group cursor-pointer"
          >
            <div className="w-7 h-7 rounded bg-gitlab-blue/15 border border-gitlab-blue/30 text-gitlab-blue flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <Archive className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-text-primary">
                Leave Changes on {currentBranch}
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                Saves your changes in a stash associated with <span className="font-mono text-text-secondary">{currentBranch}</span> so you can resume later.
              </p>
            </div>
          </button>

          {/* Option 3: Discard / Force */}
          <button
            type="button"
            onClick={handleForceCheckout}
            disabled={isProcessing}
            className="w-full p-3.5 bg-base-2 hover:bg-git-removed-bg border border-border hover:border-git-removed/40 rounded-md text-left transition flex items-start gap-3 group cursor-pointer"
          >
            <div className="w-7 h-7 rounded bg-git-removed-bg border border-git-removed/40 text-git-removed flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <Trash2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-git-removed">
                Discard Changes & Force Checkout
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                Permanently overwrites and discards local modifications when switching to <span className="font-mono text-text-secondary">{targetBranch}</span>.
              </p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-base-0 border-t border-border flex items-center justify-between">
          <div className="text-[11px] text-text-muted">
            {isProcessing && (
              <span className="flex items-center gap-1 text-commito-coral">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing checkout...
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-1.5 bg-base-2 hover:bg-base-3 border border-border rounded text-xs font-semibold text-text-secondary transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
