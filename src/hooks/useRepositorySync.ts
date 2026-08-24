import { useCallback, useRef } from 'react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { RepoStatus } from '../types/git';
import { GitService } from '../services/git/gitService';
import { getErrorMessage } from '../shared/utils/errorUtils';

/**
 * Git repository branch synchronization state relative to upstream remote.
 */
export type GitSyncStatus =
  | 'loading'
  | 'up-to-date'
  | 'ahead'       // Local has commits remote doesn't
  | 'behind'      // Remote has commits local doesn't
  | 'diverged'    // Both ahead and behind
  | 'no-upstream' // Branch has never been pushed / no remote ref
  | 'detached';   // HEAD is detached

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
    try {
      await GitService.fetchRemote(activeRepoPath);
      log().addLog('info', 'Git', 'Fetched origin');

      const res = await GitService.getRepoStatus(activeRepoPath);
      setStatus(res);

      const derived = deriveSyncStatus(res);
      const labelMap: Record<GitSyncStatus, string> = {
        'ahead': `Branch is ${res.ahead} commit(s) ahead — Push available`,
        'behind': `Branch is ${res.behind} commit(s) behind — Pull available`,
        'diverged': `Branch has diverged (${res.ahead}↑ ${res.behind}↓) — Sync needed`,
        'up-to-date': 'Branch is up to date with remote',
        'no-upstream': 'Branch has no upstream — Publish to push',
        'detached': 'HEAD is detached',
        'loading': '',
      };
      log().addLog('info', 'Git', labelMap[derived] || 'Repository state updated');
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message.includes('Authentication') || message.includes('Access Denied')) {
        setError({ code: 'AUTH_ERROR', message });
      } else {
        log().addLog('warning', 'Git', `Unable to refresh remote state: ${message}`);
      }
    } finally {
      setIsFetching(false);
      refreshingRef.current = false;
    }
  }, [activeRepoPath, setStatus, setError, setIsFetching, log]);

  // ── Push ──────────────────────────────────────────────────────────────────
  const executePush = useCallback(async () => {
    if (!activeRepoPath || !status) return;
    setIsPushing(true);
    log().addLog('info', 'Git', `Pushing ${status.ahead} commit(s) to origin/${status.current_branch}`);
    try {
      await GitService.pushToRemote(activeRepoPath, status.current_branch);
      log().addLog('success', 'Git', `Pushed to origin/${status.current_branch}`);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
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
    log().addLog('info', 'Git', `Pulling ${status.behind} commit(s) from origin/${status.current_branch}`);
    try {
      const result = await GitService.pullFromRemote(activeRepoPath, status.current_branch);
      if (!result.success && result.conflicts.length > 0) {
        setError({
          code: 'GIT_CONFLICT',
          message: `Merge conflicts in: ${result.conflicts.join(', ')}. Resolve conflicts before continuing.`,
        });
        log().addLog('error', 'Git', `Pull produced conflicts in ${result.conflicts.length} file(s)`);
      } else {
        log().addLog('success', 'Git', `Pulled from origin/${status.current_branch}`);
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error);
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
    log().addLog('info', 'Git', 'Syncing diverged branch (merge pull + push)');

    // Step 1: Pull (merge)
    setIsPulling(true);
    try {
      const result = await GitService.pullFromRemote(activeRepoPath, status.current_branch);
      if (!result.success && result.conflicts.length > 0) {
        setError({
          code: 'GIT_CONFLICT',
          message: `Sync stopped — merge conflicts in: ${result.conflicts.join(', ')}. Resolve conflicts before pushing.`,
        });
        log().addLog('error', 'Git', `Sync aborted — conflicts in ${result.conflicts.length} file(s)`);
        return;
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setError({ code: 'GIT_SYNC_PULL_ERROR', message });
      log().addLog('error', 'Git', `Sync pull step failed: ${message}`);
      return;
    } finally {
      setIsPulling(false);
    }

    // Step 2: Push
    setIsPushing(true);
    try {
      await GitService.pushToRemote(activeRepoPath, status.current_branch);
      log().addLog('success', 'Git', `Sync complete — pushed to origin/${status.current_branch}`);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
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
    hasRepo: !!activeRepoPath,
  };
}
