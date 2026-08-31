import { useState, useRef, useEffect } from 'react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { useSettingsStore } from '../features/settings/store/useSettingsStore';
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

      const committedSummary = commitSummary;
      setCommitSummary('');
      setCommitDescription('');
      useLogStore.getState().addLog('success', 'Git', `Committed: ${committedSummary}`);

      let newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);

      // Auto-push to remote branch if git.auto_push is enabled in General settings
      const autoPush = Boolean(useSettingsStore.getState().getEffectiveValue('git.auto_push'));
      if (autoPush) {
        useTaskStore.getState().updateTaskProgress(taskId, {
          stage: 'Auto-Pushing',
          percent: 85,
          detail: 'Auto-pushing commit to remote branch...',
        });
        try {
          const branchToPush = useGitStore.getState().status?.current_branch || 'HEAD';
          await GitService.pushToRemote(activeRepoPath, branchToPush);
          useLogStore.getState().addLog('success', 'Git', `Auto-pushed commits to ${branchToPush}`);
          newStatus = await GitService.getRepoStatus(activeRepoPath);
          setStatus(newStatus);
        } catch (pushErr: unknown) {
          const pushMsg = toAppError(pushErr, 'GIT_ERROR').message;
          useLogStore.getState().addLog('warning', 'Git', `Auto-push skipped/failed: ${pushMsg}`);
        }
      }

      useTaskStore.getState().updateTaskProgress(taskId, {
        stage: 'Completed',
        percent: 100,
        detail: `Committed: ${committedSummary}`,
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
