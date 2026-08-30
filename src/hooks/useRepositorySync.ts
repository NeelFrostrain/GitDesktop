import { useCallback, useRef, useEffect } from 'react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { RepoStatus } from '../types/git';
import { GitService } from '../services/git/gitService';
import { getErrorMessage } from '../shared/utils/errorUtils';
import { useTaskStore } from '../features/task-manager';

/**
 * Git repository branch synchronization state relative to upstream remote.
 */
export type GitSyncStatus =
  | 'loading'
  | 'no-remote' // No remote origin configured -> Publish Repository
  | 'up-to-date'
  | 'ahead' // Local has commits remote doesn't
  | 'behind' // Remote has commits local doesn't
  | 'diverged' // Both ahead and behind
  | 'no-upstream' // Branch has never been pushed / no remote ref
  | 'detached'; // HEAD is detached

/**
 * Computed synchronization metrics for the active branch.
 */
export interface SyncInfo {
  syncStatus: GitSyncStatus;
  ahead: number;
  behind: number;
  branch: string;
  isClean: boolean;
  hasConflicts: boolean;
}

/**
 * Derives user-facing sync status from a repository status model.
 *
 * @param status - The repository status object.
 * @returns The derived GitSyncStatus category.
 */
export function deriveSyncStatus(status: RepoStatus): GitSyncStatus {
  const branch = status.current_branch;
  if (branch === 'HEAD' || branch.startsWith('(HEAD detached')) {
    return 'detached';
  }
  if (status.has_remote === false) {
    return 'no-remote';
  }
  const { ahead, behind } = status;
  if (ahead > 0 && behind > 0) return 'diverged';
  if (ahead > 0) return 'ahead';
  if (behind > 0) return 'behind';
  return 'up-to-date';
}

/**
 * Custom hook providing smart Git sync operations (push, pull, merge-sync) and deduplicated status refreshing.
 */
export function useRepositorySync() {
  const {
    activeRepoPath,
    status,
    setStatus,
    setError,
    isFetching,
    isPushing,
    isPulling,
    setIsFetching,
    setIsPushing,
    setIsPulling,
  } = useGitStore();

  const log = useLogStore.getState;

  // Deduplication guard — prevents concurrent refreshes from overlapping
  const refreshingRef = useRef(false);

  // ── Derived sync info ──────────────────────────────────────────────────────
  const syncInfo: SyncInfo = status
    ? {
        syncStatus: deriveSyncStatus(status),
        ahead: status.ahead,
        behind: status.behind,
        branch: status.current_branch,
        isClean: status.is_clean,
        hasConflicts: status.has_conflicts,
      }
    : {
        syncStatus: 'loading',
        ahead: 0,
        behind: 0,
        branch: '',
        isClean: true,
        hasConflicts: false,
      };

  // ── Auto-validate remote origin existence when active repo changes ──────
  useEffect(() => {
    if (!activeRepoPath) return;

    let isMounted = true;
    GitService.validateRemoteOrigin(activeRepoPath)
      .then((validation) => {
        if (!isMounted) return;
        // Only override has_remote when the remote is confirmed deleted/missing on the server.
        // Do NOT override on transient network/auth failures (is_valid=false but is_deleted_or_missing=false)
        // because that would stomp over fresh status set immediately after a successful publish.
        if (!validation.has_remote) {
          // No remote configured locally at all
          const current = useGitStore.getState().status;
          if (current && current.has_remote) {
            setStatus({
              ...current,
              has_remote: false,
              remote_url: null,
            });
          }
        } else if (validation.is_deleted_or_missing) {
          // Remote is configured but has been deleted from the server
          const current = useGitStore.getState().status;
          if (current) {
            setStatus({
              ...current,
              has_remote: false,
              remote_url: null,
            });
            log().addLog(
              'warning',
              'Remote',
              "Remote repository was not found on the server (it may have been deleted or renamed). Click 'Publish repository' to reconnect or re-publish."
            );
          }
        }
        // If is_valid=false but NOT is_deleted_or_missing, it's a transient probe failure
        // (auth/network issue). Silently ignore — don't mutate the current status.
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [activeRepoPath, setStatus, log]);

  // ── Light local refresh — fast, no network ────────────────────────────────
  const refreshLocal = useCallback(async () => {
    if (!activeRepoPath || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const res = await GitService.getRepoStatus(activeRepoPath);
      setStatus(res);
    } catch (error: unknown) {
      log().addLog('warning', 'Git', `Local refresh failed: ${getErrorMessage(error)}`);
    } finally {
      refreshingRef.current = false;
    }
  }, [activeRepoPath, setStatus, log]);

  // ── Full sync refresh — fetch remote + read status ─────────────────────────
  const refreshSync = useCallback(async () => {
    if (!activeRepoPath || refreshingRef.current) return;
    refreshingRef.current = true;
    setIsFetching(true);
    log().addLog('info', 'Git', 'Refreshing repository state');

    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';
    const taskId = useTaskStore.getState().addTask({
      type: 'fetch',
      title: `Fetch origin (${repoName})`,
      repoName,
      localPath: activeRepoPath,
      cancellable: false,
    });

    try {
      useTaskStore.getState().updateTaskProgress(taskId, {
        stage: 'Fetching',
        percent: 30,
        detail: 'Contacting remote origin...',
      });

      // 1. Probe remote validity first
      const validation = await GitService.validateRemoteOrigin(activeRepoPath).catch(() => null);
      if (validation && validation.has_remote && validation.is_deleted_or_missing) {
        useGitStore.getState().setIsRemoteNotFoundModalOpen(true);
        log().addLog(
          'warning',
          'Remote',
          'Remote repository was not found on the server (it may have been deleted or renamed).'
        );
        useTaskStore.getState().failTask(taskId, 'Remote repository not found on server');
        return;
      }

      await GitService.fetchRemote(activeRepoPath);
      log().addLog('info', 'Git', 'Fetched origin');

      useTaskStore.getState().updateTaskProgress(taskId, {
        stage: 'Reading status',
        percent: 85,
        detail: 'Reading repository status & branches...',
      });

      const res = await GitService.getRepoStatus(activeRepoPath);
      setStatus(res);

      const derived = deriveSyncStatus(res);
      const labelMap: Record<GitSyncStatus, string> = {
        ahead: `Branch is ${res.ahead} commit(s) ahead — Push available`,
        behind: `Branch is ${res.behind} commit(s) behind — Pull available`,
        diverged: `Branch has diverged (${res.ahead}↑ ${res.behind}↓) — Sync needed`,
        'up-to-date': 'Branch is up to date with remote',
        'no-upstream': 'Branch has no upstream — Publish to push',
        'no-remote': 'No remote configured — Publish to share',
        detached: 'HEAD is detached',
        loading: '',
      };
      log().addLog('info', 'Git', labelMap[derived] || 'Repository state updated');
      useTaskStore.getState().completeTask(taskId);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const isRemoteNotFound =
        message.toLowerCase().includes('not found') ||
        message.toLowerCase().includes('deleted') ||
        message.toLowerCase().includes('could not read from remote') ||
        message.toLowerCase().includes('does not appear to be a git repository');

      if (isRemoteNotFound) {
        useGitStore.getState().setIsRemoteNotFoundModalOpen(true);
        log().addLog(
          'warning',
          'Remote',
          'Remote repository was not found on server (it may have been deleted or renamed).'
        );
      } else if (message.includes('Authentication') || message.includes('Access Denied')) {
        setError({ code: 'AUTH_ERROR', message });
      } else {
        log().addLog('warning', 'Git', `Unable to refresh remote state: ${message}`);
      }
      useTaskStore.getState().failTask(taskId, message);
    } finally {
      setIsFetching(false);
      refreshingRef.current = false;
    }
  }, [activeRepoPath, setStatus, setError, setIsFetching, log]);

  const withTimeout = <T>(
    promise: Promise<T>,
    timeoutMs = 25000,
    errorMsg = 'Git operation timed out'
  ): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs)),
    ]);
  };

  const resetBusyState = useCallback(() => {
    setIsPushing(false);
    setIsPulling(false);
    setIsFetching(false);
    refreshingRef.current = false;
  }, [setIsPushing, setIsPulling, setIsFetching]);

  // ── Push ──────────────────────────────────────────────────────────────────
  const executePush = useCallback(async () => {
    if (!activeRepoPath || !status) return;
    setIsPushing(true);
    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';
    const pushTitle =
      status.ahead > 0
        ? `Push ${status.ahead} commit${status.ahead === 1 ? '' : 's'} to origin/${status.current_branch}`
        : `Push to origin/${status.current_branch}`;

    const taskId = useTaskStore.getState().addTask({
      type: 'push',
      title: pushTitle,
      repoName,
      localPath: activeRepoPath,
      cancellable: false,
    });

    useTaskStore.getState().updateTaskProgress(taskId, {
      stage: 'Pushing commits',
      percent: 35,
      detail: `Pushing to origin/${status.current_branch}...`,
    });

    log().addLog(
      'info',
      'Git',
      `Pushing ${status.ahead} commit(s) to origin/${status.current_branch}`
    );
    try {
      await withTimeout(
        GitService.pushToRemote(activeRepoPath, status.current_branch),
        30000,
        'Push timed out. Check network connection or remote credentials.'
      );
      useTaskStore.getState().updateTaskProgress(taskId, {
        stage: 'Completed',
        percent: 100,
        detail: `Successfully pushed to origin/${status.current_branch}`,
      });
      useTaskStore.getState().completeTask(taskId);
      log().addLog('success', 'Git', `Pushed to origin/${status.current_branch}`);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      useTaskStore.getState().failTask(taskId, message);
      setError({ code: 'GIT_PUSH_ERROR', message });
      log().addLog('error', 'Git', `Push failed: ${message}`);
    } finally {
      setIsPushing(false);
      refreshSync().catch(() => {});
    }
  }, [activeRepoPath, status, setIsPushing, setError, refreshSync, log]);

  // ── Pull ──────────────────────────────────────────────────────────────────
  const executePull = useCallback(async () => {
    if (!activeRepoPath || !status) return;
    setIsPulling(true);
    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';
    const pullTitle =
      status.behind > 0
        ? `Pull ${status.behind} commit${status.behind === 1 ? '' : 's'} from origin/${status.current_branch}`
        : `Pull from origin/${status.current_branch}`;

    const taskId = useTaskStore.getState().addTask({
      type: 'pull',
      title: pullTitle,
      repoName,
      localPath: activeRepoPath,
      cancellable: false,
    });

    useTaskStore.getState().updateTaskProgress(taskId, {
      stage: 'Pulling changes',
      percent: 35,
      detail: `Pulling from origin/${status.current_branch}...`,
    });

    log().addLog(
      'info',
      'Git',
      `Pulling ${status.behind} commit(s) from origin/${status.current_branch}`
    );
    try {
      const result = await withTimeout(
        GitService.pullFromRemote(activeRepoPath, status.current_branch),
        30000,
        'Pull timed out. Check network connection or remote credentials.'
      );
      if (!result.success && result.conflicts.length > 0) {
        const conflictMsg = `Merge conflicts in: ${result.conflicts.join(', ')}. Resolve conflicts before continuing.`;
        useTaskStore.getState().failTask(taskId, conflictMsg);
        setError({
          code: 'GIT_CONFLICT',
          message: conflictMsg,
        });
        log().addLog(
          'error',
          'Git',
          `Pull produced conflicts in ${result.conflicts.length} file(s)`
        );
      } else {
        useTaskStore.getState().updateTaskProgress(taskId, {
          stage: 'Completed',
          percent: 100,
          detail: `Successfully pulled from origin/${status.current_branch}`,
        });
        useTaskStore.getState().completeTask(taskId);
        log().addLog('success', 'Git', `Pulled from origin/${status.current_branch}`);
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      useTaskStore.getState().failTask(taskId, message);
      setError({ code: 'GIT_PULL_ERROR', message });
      log().addLog('error', 'Git', `Pull failed: ${message}`);
    } finally {
      setIsPulling(false);
      refreshSync().catch(() => {});
    }
  }, [activeRepoPath, status, setIsPulling, setError, refreshSync, log]);

  // ── Sync (diverged) — merge pull then push ────────────────────────────────
  const executeSync = useCallback(async () => {
    if (!activeRepoPath || !status) return;
    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';
    const taskId = useTaskStore.getState().addTask({
      type: 'push',
      title: `Sync origin/${status.current_branch}`,
      repoName,
      localPath: activeRepoPath,
      cancellable: false,
    });

    useTaskStore.getState().updateTaskProgress(taskId, {
      stage: 'Pulling upstream',
      percent: 30,
      detail: 'Pulling upstream changes before push...',
    });

    log().addLog('info', 'Git', 'Syncing diverged branch (merge pull + push)');

    // Step 1: Pull (merge)
    setIsPulling(true);
    try {
      const result = await GitService.pullFromRemote(activeRepoPath, status.current_branch);
      if (!result.success && result.conflicts.length > 0) {
        const conflictMsg = `Sync stopped — merge conflicts in: ${result.conflicts.join(', ')}. Resolve conflicts before pushing.`;
        useTaskStore.getState().failTask(taskId, conflictMsg);
        setError({
          code: 'GIT_CONFLICT',
          message: conflictMsg,
        });
        log().addLog(
          'error',
          'Git',
          `Sync aborted — conflicts in ${result.conflicts.length} file(s)`
        );
        return;
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      useTaskStore.getState().failTask(taskId, message);
      setError({ code: 'GIT_SYNC_PULL_ERROR', message });
      log().addLog('error', 'Git', `Sync pull step failed: ${message}`);
      return;
    } finally {
      setIsPulling(false);
    }

    // Step 2: Push
    setIsPushing(true);
    useTaskStore.getState().updateTaskProgress(taskId, {
      stage: 'Pushing local',
      percent: 75,
      detail: `Pushing local commits to origin/${status.current_branch}...`,
    });

    try {
      await GitService.pushToRemote(activeRepoPath, status.current_branch);
      useTaskStore.getState().updateTaskProgress(taskId, {
        stage: 'Completed',
        percent: 100,
        detail: `Sync complete — pushed to origin/${status.current_branch}`,
      });
      useTaskStore.getState().completeTask(taskId);
      log().addLog('success', 'Git', `Sync complete — pushed to origin/${status.current_branch}`);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      useTaskStore.getState().failTask(taskId, message);
      setError({ code: 'GIT_SYNC_PUSH_ERROR', message });
      log().addLog('error', 'Git', `Sync push step failed: ${message}`);
    } finally {
      setIsPushing(false);
      refreshSync().catch(() => {});
    }
  }, [activeRepoPath, status, setIsPulling, setIsPushing, setError, refreshSync, log]);

  // ── Main action dispatcher ─────────────────────────────────────────────────
  const executeAction = useCallback(async () => {
    switch (syncInfo.syncStatus) {
      case 'no-remote':
        useGitStore.getState().setIsPublishRepoModalOpen(true);
        break;
      case 'ahead':
      case 'no-upstream':
        await executePush();
        break;
      case 'behind':
        await executePull();
        break;
      case 'diverged':
        await executeSync();
        break;
      default:
        break;
    }
  }, [syncInfo.syncStatus, executePush, executePull, executeSync]);

  return {
    syncInfo,
    isBusy: isFetching || isPushing || isPulling,
    isFetching,
    isPushing,
    isPulling,
    refreshSync,
    refreshLocal,
    executeAction,
    executePush,
    executePull,
    resetBusyState,
    hasRepo: !!activeRepoPath,
  };
}
