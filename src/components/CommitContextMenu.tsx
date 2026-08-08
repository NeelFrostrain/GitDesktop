import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { 
  Edit3, 
  RotateCcw, 
  GitCommit, 
  ArrowUpDown, 
  Undo2, 
  GitBranch, 
  Tag, 
  Copy, 
  ExternalLink 
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { CommitInfo, RepoStatus } from '../types/git';

interface CommitContextMenuProps {
  commit: CommitInfo;
  x: number;
  y: number;
  onClose: () => void;
}

export const CommitContextMenu: React.FC<CommitContextMenuProps> = ({
  commit,
  x,
  y,
  onClose,
}) => {
  const {
    activeRepoPath,
    setStatus,
    setError,
    setCommitSummary,
    setActiveTab,
    setIsRebaseModalOpen,
    setIsCherryPickModalOpen,
    user
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

  // 1. Amend commit...
  const handleAmendCommit = () => {
    setCommitSummary(commit.message);
    setActiveTab('changes');
    useLogStore.getState().addLog('info', 'Git', `Prepared summary for commit amend: '${commit.message}'`);
    onClose();
  };

  // 2. Reset to commit...
  const handleResetToCommit = async () => {
    if (!activeRepoPath) return;

    if (confirm(`Reset repository branch HEAD to commit ${commit.short_sha}? (${commit.message})`)) {
      try {
        await invoke('restore_reflog_target_cmd', {
          repoPath: activeRepoPath,
          sha: commit.sha,
          force: false,
        });

        useLogStore.getState().addLog('success', 'Git', `Reset branch HEAD to commit ${commit.short_sha}`);
        const res = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
        setStatus(res);
      } catch (err: any) {
        setError({ code: 'RESET_ERROR', message: err.message || String(err) });
      }
    }
    onClose();
  };

  // 3. Checkout commit
  const handleCheckoutCommit = async () => {
    if (!activeRepoPath) return;

    try {
      await invoke('checkout_branch', {
        repoPath: activeRepoPath,
        name: commit.sha,
      });

      useLogStore.getState().addLog('info', 'Git', `Checked out commit ${commit.short_sha} (Detached HEAD)`);
      const res = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(res);
    } catch (err: any) {
      setError({ code: 'CHECKOUT_ERROR', message: err.message || String(err) });
    }
    onClose();
  };

  // 4. Reorder commit
  const handleReorderCommit = () => {
    setIsRebaseModalOpen(true);
    onClose();
  };

  // 5. Revert changes in commit
  const handleRevertCommit = async () => {
    if (!activeRepoPath) return;

    if (confirm(`Revert commit ${commit.short_sha}? This will create a new reverting commit.`)) {
      try {
        await invoke('revert_commit_cmd', {
          repoPath: activeRepoPath,
          sha: commit.sha,
        });

        useLogStore.getState().addLog('success', 'Git', `Reverted commit ${commit.short_sha}`);
        const res = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
        setStatus(res);
      } catch (err: any) {
        setError({ code: 'REVERT_ERROR', message: err.message || String(err) });
      }
    }
    onClose();
  };

  // 6. Create branch from commit
  const handleCreateBranchFromCommit = async () => {
    if (!activeRepoPath) return;

    const branchName = prompt(`Enter new branch name to create from commit ${commit.short_sha}:`);
    if (branchName && branchName.trim()) {
      try {
        await invoke('create_branch', {
          repoPath: activeRepoPath,
          name: branchName.trim(),
          startPoint: commit.sha,
        });

        useLogStore.getState().addLog('success', 'Git', `Created branch '${branchName.trim()}' from commit ${commit.short_sha}`);
        const res = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
        setStatus(res);
      } catch (err: any) {
        setError({ code: 'BRANCH_CREATE_ERROR', message: err.message || String(err) });
      }
    }
    onClose();
  };

  // 7. Create Tag...
  const handleCreateTag = async () => {
    if (!activeRepoPath) return;

    const tagName = prompt(`Enter tag name for commit ${commit.short_sha} (e.g. v1.0.1):`);
    if (tagName && tagName.trim()) {
      try {
        await invoke('create_tag_cmd', {
          repoPath: activeRepoPath,
          name: tagName.trim(),
          message: `Release ${tagName.trim()}`,
          targetSha: commit.sha,
        });

        useLogStore.getState().addLog('success', 'Git', `Created tag '${tagName.trim()}' at commit ${commit.short_sha}`);
      } catch (err: any) {
        setError({ code: 'TAG_ERROR', message: err.message || String(err) });
      }
    }
    onClose();
  };

  // 8. Cherry-pick commit...
  const handleCherryPickCommit = () => {
    setIsCherryPickModalOpen(true);
    onClose();
  };

  // 9. Copy SHA
  const handleCopySha = () => {
    navigator.clipboard.writeText(commit.sha);
    useLogStore.getState().addLog('info', 'System', `Copied commit SHA '${commit.sha}' to clipboard`);
    onClose();
  };

  // 10. Copy tag / message
  const handleCopyTag = () => {
    navigator.clipboard.writeText(commit.message);
    useLogStore.getState().addLog('info', 'System', `Copied commit message to clipboard`);
    onClose();
  };

  // 11. View on GitHub / GitLab
  const handleViewOnRemote = async () => {
    if (!activeRepoPath) return;
    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'repo';
    const provider = user?.provider === 'github' ? 'github.com' : 'gitlab.com';
    const commitUrl = user?.provider === 'github'
      ? `https://${provider}/${repoName}/commit/${commit.sha}`
      : `https://${provider}/${repoName}/-/commit/${commit.sha}`;

    try {
      await openUrl(commitUrl);
    } catch {
      useLogStore.getState().addLog('warning', 'Remote', `Could not open URL '${commitUrl}'`);
    }
    onClose();
  };

  // Prevent menu overflow off-screen
  const adjustedX = Math.min(x, window.innerWidth - 250);
  const adjustedY = Math.min(y, window.innerHeight - 390);

  return createPortal(
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-[9999] w-60 bg-base-1/95 backdrop-blur-md border border-border rounded-md shadow-2xl py-1.5 text-xs select-none font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100"
    >

      {/* Group 1: Commit Transformations */}
      <div className="p-1 space-y-0.5">
        <button
          onClick={handleAmendCommit}
          className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <Edit3 className="w-3.5 h-3.5 text-commito-coral" />
          <span>Amend commit...</span>
        </button>

        <button
          onClick={handleResetToCommit}
          className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          <span>Reset to commit...</span>
        </button>

        <button
          onClick={handleCheckoutCommit}
          className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
          <span>Checkout commit</span>
        </button>

        <button
          onClick={handleReorderCommit}
          className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-gitlab-teal" />
          <span>Reorder commit</span>
        </button>

        <button
          onClick={handleRevertCommit}
          className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <Undo2 className="w-3.5 h-3.5 text-red-400" />
          <span>Revert changes in commit</span>
        </button>
      </div>

      <div className="h-px bg-border my-1" />

      {/* Group 2: Branching & Tagging */}
      <div className="p-1 space-y-0.5">
        <button
          onClick={handleCreateBranchFromCommit}
          className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <GitBranch className="w-3.5 h-3.5 text-commito-coral" />
          <span>Create branch from commit</span>
        </button>

        <button
          onClick={handleCreateTag}
          className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <Tag className="w-3.5 h-3.5 text-amber-400" />
          <span>Create Tag...</span>
        </button>

        <button
          onClick={handleCherryPickCommit}
          className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
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
          className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <Copy className="w-3.5 h-3.5 text-text-muted" />
          <span>Copy SHA</span>
        </button>

        <button
          onClick={handleCopyTag}
          className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <Copy className="w-3.5 h-3.5 text-text-muted" />
          <span>Copy tag</span>
        </button>

        <button
          onClick={handleViewOnRemote}
          className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <ExternalLink className="w-3.5 h-3.5 text-github-dark-accent" />
          <span>Open in remote</span>
        </button>
      </div>

    </div>,
    document.body
  );
};

