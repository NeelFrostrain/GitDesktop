import { useState, useRef, useEffect } from 'react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { GitService } from '../services/git/gitService';
import { toAppError } from '../shared/utils/errorUtils';
import { useTaskStore } from '../features/task-manager';

/**
 * Hook providing form state, identity checks, and execution dispatch for creating Git commits.
 */
export function useCommitForm() {
  const {
    activeRepoPath,
    setStatus,
    stagedFiles,
    commitSummary,
    setCommitSummary,
    commitDescription,
    setCommitDescription,
    commitOptions,
    setCommitOptions,
    setError,
    setIsUserConfigModalOpen,
    setPendingCommitData,
  } = useGitStore();

  const [isCommitting, setIsCommitting] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setIsOptionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveOptions = Boolean(
    commitOptions.bypassHooks || commitOptions.signOff || commitOptions.allowEmpty
  );

  const canCommit = Boolean(commitSummary.trim() && stagedFiles.length > 0);

  const handleCommit = async () => {
    if (!activeRepoPath || !commitSummary.trim() || stagedFiles.length === 0) return;

    // Verify Git author identity is configured before committing
    const identity = await GitService.getUserIdentity(activeRepoPath);
    if (!identity?.name || !identity?.email || !identity.name.trim() || !identity.email.trim()) {
      setPendingCommitData({
        summary: commitSummary,
        description: commitDescription,
      });
      setIsUserConfigModalOpen(true);
      return;
    }

    setIsCommitting(true);
    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';
    const taskId = useTaskStore.getState().addTask({
      type: 'commit',
      title: `Commit: ${commitSummary}`,
      repoName,
      localPath: activeRepoPath,
      cancellable: false,
    });

    useTaskStore.getState().updateTaskProgress(taskId, {
      stage: 'Staging & Committing',
      percent: 45,
      detail: `Committing changes to branch...`,
    });

    try {
      if (stagedFiles.length > 0) {
        await GitService.stageFiles(activeRepoPath, stagedFiles);
      }
      await GitService.commit({
        repoPath: activeRepoPath,
        summary: commitSummary,
        description: commitDescription,
        noVerify: commitOptions.bypassHooks,
        signOff: commitOptions.signOff,
        allowEmpty: commitOptions.allowEmpty,
      });

      setCommitSummary('');
      setCommitDescription('');
      useLogStore.getState().addLog('success', 'Git', `Committed: ${commitSummary}`);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);

      useTaskStore.getState().updateTaskProgress(taskId, {
        stage: 'Completed',
        percent: 100,
        detail: `Committed: ${commitSummary}`,
      });
      useTaskStore.getState().completeTask(taskId);
    } catch (error: unknown) {
      const errMsg = toAppError(error, 'GIT_ERROR').message;
      useTaskStore.getState().failTask(taskId, errMsg);
      setError(toAppError(error, 'GIT_ERROR'));
    } finally {
      setIsCommitting(false);
    }
  };

  const clearForm = () => {
    setCommitSummary('');
    setCommitDescription('');
  };

  return {
    commitSummary,
    setCommitSummary,
    commitDescription,
    setCommitDescription,
    commitOptions,
    setCommitOptions,
    isCommitting,
    isOptionsMenuOpen,
    setIsOptionsMenuOpen,
    optionsMenuRef,
    hasActiveOptions,
    canCommit,
    handleCommit,
    clearForm,
  };
}
