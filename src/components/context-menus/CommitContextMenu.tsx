import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  Edit3,
  RotateCcw,
  GitCommit,
  Undo2,
  GitBranch,
  Tag,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { CommitInfo } from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';

interface CommitContextMenuProps {
  commit: CommitInfo;
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Context menu for historical commit entries offering undo/soft-reset, amend,
 * checkout, revert, branching, tagging, cherry-picking, and remote web inspection.
 */
export const CommitContextMenu: React.FC<CommitContextMenuProps> = ({ commit, x, y, onClose }) => {
  const {
    activeRepoPath,
    setStatus,
    setError,
    setCommitSummary,
    setActiveTab,
    setIsCherryPickModalOpen,
    setIsCreateTagModalOpen,
    setTagModalTargetCommitSha,
    user,
  } = useGitStore();

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // 0. Undo commit (Soft Reset HEAD~1)
  const handleUndoCommit = async () => {
    if (!activeRepoPath) return;
    try {
      const undoneMsg = await invoke<string>('undo_commit_cmd', { repoPath: activeRepoPath });
      setCommitSummary(undoneMsg || commit.message);
      setActiveTab('changes');
      useLogStore
        .getState()
        .addLog(
          'success',
          'Git',
          `Undone commit '${undoneMsg || commit.message}' — changes preserved in working directory`
        );
      const res = await GitService.getRepoStatus(activeRepoPath);
      setStatus(res);
    } catch (error: unknown) {
      setError(toAppError(error, 'UNDO_COMMIT_ERROR'));
    }
    onClose();
  };

  // 1. Amend commit...
  const handleAmendCommit = () => {
    setCommitSummary(commit.message);
    setActiveTab('changes');
    useLogStore
      .getState()
      .addLog('info', 'Git', `Prepared summary for commit amend: '${commit.message}'`);
    onClose();
  };

  // 2. Reset to commit...
  const handleResetToCommit = async () => {
    if (!activeRepoPath) return;

    if (
      confirm(`Reset repository branch HEAD to commit ${commit.short_sha}? (${commit.message})`)
    ) {
      try {
        await invoke('restore_reflog_target_cmd', {
          repoPath: activeRepoPath,
          sha: commit.sha,
          force: false,
        });

        useLogStore
          .getState()
          .addLog('success', 'Git', `Reset branch HEAD to commit ${commit.short_sha}`);
        const res = await GitService.getRepoStatus(activeRepoPath);
        setStatus(res);
      } catch (error: unknown) {
        setError(toAppError(error, 'RESET_ERROR'));
      }
    }
    onClose();
  };

  // 3. Checkout commit
  const handleCheckoutCommit = async () => {
    if (!activeRepoPath) return;

    try {
      await GitService.checkoutBranch(activeRepoPath, commit.sha);
      useLogStore
        .getState()
        .addLog('info', 'Git', `Checked out commit ${commit.short_sha} (Detached HEAD)`);
      await useGitStore.getState().reloadActiveRepo();
    } catch (error: unknown) {
      setError(toAppError(error, 'CHECKOUT_ERROR'));
    }
    onClose();
  };

  // 4. Revert changes in commit
  const handleRevertCommit = async () => {
    if (!activeRepoPath) return;

    const repoStatus = useGitStore.getState().status;
    const isDirty = Boolean(
      repoStatus && (!repoStatus.is_clean || (repoStatus.files && repoStatus.files.length > 0))
    );

    if (isDirty) {
      const shouldStash = confirm(
        `Cannot revert commit '${commit.short_sha}' with uncommitted changes in your working directory.\n\nWould you like to STASH your working changes now and proceed with the revert?`
      );
      if (!shouldStash) {
        onClose();
        return;
      }

      try {
        await invoke('create_stash_cmd', {
          repoPath: activeRepoPath,
          message: `Auto-stash before reverting ${commit.short_sha}`,
          includeUntracked: true,
        });
        useLogStore.getState().addLog('info', 'Git', `Stashed uncommitted changes before revert`);

        await invoke('revert_commit_cmd', {
          repoPath: activeRepoPath,
          sha: commit.sha,
        });

        useLogStore.getState().addLog('success', 'Git', `Reverted commit ${commit.short_sha}`);
        const res = await GitService.getRepoStatus(activeRepoPath);
        setStatus(res);
      } catch (error: unknown) {
        setError(toAppError(error, 'REVERT_ERROR'));
      }
      onClose();
      return;
    }

    if (confirm(`Revert commit ${commit.short_sha}? This will create a new reverting commit.`)) {
      try {
        await invoke('revert_commit_cmd', {
          repoPath: activeRepoPath,
          sha: commit.sha,
        });

        useLogStore.getState().addLog('success', 'Git', `Reverted commit ${commit.short_sha}`);
        const res = await GitService.getRepoStatus(activeRepoPath);
        setStatus(res);
      } catch (error: unknown) {
        setError(toAppError(error, 'REVERT_ERROR'));
      }
    }
    onClose();
  };

  // 5. Create branch from commit
  const handleCreateBranchFromCommit = async () => {
    if (!activeRepoPath) return;

    const branchName = prompt(`Enter new branch name to create from commit ${commit.short_sha}:`);
    if (branchName && branchName.trim()) {
      try {
        await GitService.createBranch(activeRepoPath, branchName.trim(), commit.sha);
        useLogStore
          .getState()
          .addLog(
            'success',
            'Git',
            `Created branch '${branchName.trim()}' from commit ${commit.short_sha}`
          );
        const res = await GitService.getRepoStatus(activeRepoPath);
        setStatus(res);
      } catch (error: unknown) {
        setError(toAppError(error, 'BRANCH_CREATE_ERROR'));
      }
    }
    onClose();
  };

  // 6. Create Tag...
  const handleCreateTag = () => {
    setTagModalTargetCommitSha(commit.sha);
    setIsCreateTagModalOpen(true);
    onClose();
  };

  // 7. Cherry-pick commit...
  const handleCherryPickCommit = () => {
    setIsCherryPickModalOpen(true);
    onClose();
  };

  // 8. Copy SHA
  const handleCopySha = () => {
    navigator.clipboard.writeText(commit.sha);
    useLogStore
      .getState()
      .addLog('info', 'System', `Copied commit SHA '${commit.sha}' to clipboard`);
    onClose();
  };

  // 9. Copy message
  const handleCopyTag = () => {
    navigator.clipboard.writeText(commit.message);
    useLogStore.getState().addLog('info', 'System', `Copied commit message to clipboard`);
    onClose();
  };

  // 10. View on GitHub / GitLab
  const handleViewOnRemote = async () => {
    if (!activeRepoPath) return;
    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'repo';
    const provider = user?.provider === 'github' ? 'github.com' : 'gitlab.com';
    const commitUrl =
      user?.provider === 'github'
        ? `https://${provider}/${repoName}/commit/${commit.sha}`
        : `https://${provider}/${repoName}/-/commit/${commit.sha}`;

    try {
      await openUrl(commitUrl);
    } catch {
      useLogStore.getState().addLog('warning', 'Remote', `Could not open URL '${commitUrl}'`);
    }
    onClose();
  };

  const adjustedX = Math.min(x, window.innerWidth - 250);
  const adjustedY = Math.min(y, window.innerHeight - 390);

  return (
    <>
      {createPortal(
        <div
          ref={menuRef}
          style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
          className="fixed z-[9999] w-60 bg-base-1 border border-border rounded-sm shadow-2xl py-1.5 text-xs select-none font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Group 1: Commit Modifications */}
          <div className="p-1 space-y-0.5">
            <button
              onClick={handleUndoCommit}
              className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left font-bold cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5 text-commito-coral" />
              <span>Undo commit (Soft Reset)</span>
            </button>

            <button
              onClick={handleAmendCommit}
              className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-commito-coral" />
              <span>Amend commit...</span>
            </button>

            <button
              onClick={handleRevertCommit}
              className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-git-removed" />
              <span>Revert commit</span>
            </button>
          </div>

          <div className="h-px bg-border my-1" />

          {/* Group 2: Branching & Navigation */}
          <div className="p-1 space-y-0.5">
            <button
              onClick={handleCheckoutCommit}
              className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
            >
              <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
              <span>Checkout commit</span>
            </button>

            <button
              onClick={handleResetToCommit}
              className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset HEAD to commit...</span>
            </button>

            <button
              onClick={handleCreateBranchFromCommit}
              className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5 text-commito-coral" />
              <span>Create branch from commit</span>
            </button>

            <button
              onClick={handleCreateTag}
              className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Create Tag...</span>
            </button>

            <button
              onClick={handleCherryPickCommit}
              className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
            >
              <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cherry-pick commit...</span>
            </button>
          </div>

          <div className="h-px bg-border my-1" />

          {/* Group 3: Copying & Web View */}
          <div className="p-1 space-y-0.5">
            <button
              onClick={handleCopySha}
              className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-text-muted" />
              <span>Copy SHA</span>
            </button>

            <button
              onClick={handleCopyTag}
              className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-text-muted" />
              <span>Copy commit message</span>
            </button>

            <button
              onClick={handleViewOnRemote}
              className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-github-dark-accent" />
              <span>Open in remote</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
