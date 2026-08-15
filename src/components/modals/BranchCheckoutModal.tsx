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
import { RepoStatus } from '../../types/git';

interface BranchCheckoutModalProps {
  isOpen: boolean;
  targetBranch: string;
  currentBranch: string;
  uncommittedCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

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
    const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
    setStatus(newStatus);
  };

  // Option 1: Bring Changes (Stash -> Checkout -> Pop)
  const handleBringChanges = async () => {
    if (!activeRepoPath) return;
    setIsProcessing(true);
    try {
      // 1. Create stash with untracked files
      await invoke('create_stash_cmd', {
        repoPath: activeRepoPath,
        message: `Auto-stash before checkout to ${targetBranch}`,
        includeUntracked: true,
      });

      // 2. Checkout target branch
      await invoke('checkout_branch', {
        repoPath: activeRepoPath,
        branch: targetBranch,
      });

      // 3. Pop stash
      try {
        await invoke('pop_stash_cmd', {
          repoPath: activeRepoPath,
          index: 0,
        });
        useLogStore.getState().addLog('success', 'Git', `Switched to '${targetBranch}' and brought changes along`);
      } catch (popErr: any) {
        useLogStore.getState().addLog('warning', 'Git', `Switched to '${targetBranch}', but stash pop had conflicts: ${popErr.message || String(popErr)}`);
      }

      await refreshRepoStatus();
      onSuccess();
    } catch (err: any) {
      setError({ code: 'CHECKOUT_ERROR', message: err.message || String(err) });
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
      // 1. Create stash
      await invoke('create_stash_cmd', {
        repoPath: activeRepoPath,
        message: `Saved changes on ${currentBranch} before checkout`,
        includeUntracked: true,
      });

      // 2. Checkout target branch
      await invoke('checkout_branch', {
        repoPath: activeRepoPath,
        branch: targetBranch,
      });

      useLogStore.getState().addLog('info', 'Git', `Stashed changes on '${currentBranch}' and switched to '${targetBranch}'`);
      await refreshRepoStatus();
      onSuccess();
    } catch (err: any) {
      setError({ code: 'CHECKOUT_ERROR', message: err.message || String(err) });
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
      await invoke('checkout_branch', {
        repoPath: activeRepoPath,
        branch: targetBranch,
      });

      useLogStore.getState().addLog('warning', 'Git', `Force checked out '${targetBranch}'`);
      await refreshRepoStatus();
      onSuccess();
    } catch (err: any) {
      setError({ code: 'CHECKOUT_ERROR', message: err.message || String(err) });
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-amber-950/40 border-b border-amber-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary leading-tight">
                Uncommitted Changes Detected
              </h2>
              <p className="text-[11px] text-text-muted">
                Switching branch from <span className="font-mono text-amber-400">{currentBranch}</span> to <span className="font-mono text-commito-coral">{targetBranch}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-text-muted hover:text-text-primary p-1 rounded-md transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3">
          <p className="text-xs text-text-secondary leading-relaxed">
            You have <span className="font-extrabold text-amber-400 font-mono">{uncommittedCount}</span> uncommitted change{uncommittedCount === 1 ? '' : 's'} in your working directory. How would you like to proceed?
          </p>

          <div className="space-y-2 pt-1">
            {/* Option 1: Bring Changes */}
            <button
              type="button"
              onClick={handleBringChanges}
              disabled={isProcessing}
              className="w-full text-left p-3 rounded-md bg-base-2 hover:bg-commito-activeBg border border-border hover:border-commito-coral/40 group transition cursor-pointer flex items-start gap-3"
            >
              <div className="w-7 h-7 rounded bg-commito-coral/15 border border-commito-coral/30 text-commito-coral flex items-center justify-center flex-shrink-0 mt-0.5">
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary group-hover:text-commito-coral transition">
                    Bring Changes to '{targetBranch}'
                  </span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-commito-coral/20 text-commito-coral border border-commito-coral/30 uppercase">
                    Smart Checkout
                  </span>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Stash changes temporarily, checkout '{targetBranch}', and automatically re-apply them.
                </p>
              </div>
            </button>

            {/* Option 2: Leave Changes */}
            <button
              type="button"
              onClick={handleLeaveChanges}
              disabled={isProcessing}
              className="w-full text-left p-3 rounded-md bg-base-2 hover:bg-base-3 border border-border hover:border-border-strong group transition cursor-pointer flex items-start gap-3"
            >
              <div className="w-7 h-7 rounded bg-gitlab-blue/15 border border-gitlab-blue/30 text-gitlab-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                <Archive className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-text-primary group-hover:text-gitlab-blue transition">
                  Leave Changes on '{currentBranch}'
                </span>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Save your changes into a stash entry on '{currentBranch}' and switch with a clean working tree.
                </p>
              </div>
            </button>

            {/* Option 3: Discard Changes */}
            <button
              type="button"
              onClick={handleForceCheckout}
              disabled={isProcessing}
              className="w-full text-left p-3 rounded-md bg-base-2 hover:bg-red-950/40 border border-border hover:border-red-800/40 group transition cursor-pointer flex items-start gap-3"
            >
              <div className="w-7 h-7 rounded bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Trash2 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-text-primary group-hover:text-red-400 transition">
                  Discard Local Changes
                </span>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Permanently drop uncommitted changes and force checkout '{targetBranch}'.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-base-0 border-t border-border flex items-center justify-between">
          {isProcessing ? (
            <div className="flex items-center gap-2 text-xs text-text-muted animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral" />
              <span>Switching branch...</span>
            </div>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-md bg-base-2 hover:bg-base-3 border border-border text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
