import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { RepoStatus } from '../types/git';

// ─── Sync State ──────────────────────────────────────────────────────────────

export type GitSyncStatus =
  | 'loading'
  | 'up-to-date'
  | 'ahead'       // local has commits remote doesn't
  | 'behind'      // remote has commits local doesn't
  | 'diverged'    // both ahead and behind
  | 'no-upstream' // branch has never been pushed / no remote ref
  | 'detached';   // HEAD is detached

export interface SyncInfo {
  syncStatus: GitSyncStatus;
  ahead: number;
  behind: number;
  branch: string;
  isClean: boolean;
  hasConflicts: boolean;
}

/** Derive sync status from a RepoStatus object. */
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

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

  // Deduplication guard — prevents concurrent refreshes
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

  // ── Light local refresh — no network ──────────────────────────────────────
  const refreshLocal = useCallback(async () => {
    if (!activeRepoPath || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const res = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(res);
    } catch (err: any) {
      log().addLog('warning', 'Git', `Local refresh failed: ${err?.message || String(err)}`);
    } finally {
      refreshingRef.current = false;
    }
  }, [activeRepoPath, setStatus, log]);

  // ── Full sync refresh — fetch remote + status ──────────────────────────────
  const refreshSync = useCallback(async () => {
    if (!activeRepoPath || refreshingRef.current) return;
    refreshingRef.current = true;
    setIsFetching(true);
    log().addLog('info', 'Git', 'Refreshing repository state');
    try {
      await invoke('fetch_remote', { repoPath: activeRepoPath });
      log().addLog('info', 'Git', 'Fetched origin');

      const res = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(res);

      const derived = deriveSyncStatus(res);
      const labelMap: Record<GitSyncStatus, string> = {
        'ahead':      `Branch is ${res.ahead} commit(s) ahead — Push available`,
        'behind':     `Branch is ${res.behind} commit(s) behind — Pull available`,
        'diverged':   `Branch has diverged (${res.ahead}↑ ${res.behind}↓) — Sync needed`,
        'up-to-date': 'Branch is up to date with remote',
        'no-upstream':'Branch has no upstream — Publish to push',
        'detached':   'HEAD is detached',
        'loading':    '',
      };
      log().addLog('info', 'Git', labelMap[derived] || 'Repository state updated');
    } catch (err: any) {
      const msg: string = err?.message || String(err);
      if (msg.includes('Authentication') || msg.includes('Access Denied')) {
        setError({ code: 'AUTH_ERROR', message: msg });
      } else {
        log().addLog('warning', 'Git', `Unable to refresh remote state: ${msg}`);
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
      await invoke('push_to_remote', { repoPath: activeRepoPath, branch: status.current_branch });
      log().addLog('success', 'Git', `Pushed to origin/${status.current_branch}`);
      await refreshSync();
    } catch (err: any) {
      const msg: string = err?.message || String(err);
      setError({ code: 'GIT_PUSH_ERROR', message: msg });
      log().addLog('error', 'Git', `Push failed: ${msg}`);
    } finally {
      setIsPushing(false);
    }
  }, [activeRepoPath, status, setIsPushing, setError, refreshSync, log]);

  // ── Pull ──────────────────────────────────────────────────────────────────
  const executePull = useCallback(async () => {
    if (!activeRepoPath || !status) return;
    setIsPulling(true);
    log().addLog('info', 'Git', `Pulling ${status.behind} commit(s) from origin/${status.current_branch}`);
    try {
      const result = await invoke<{ success: boolean; conflicts: string[]; commits_pulled: number }>(
        'pull_from_remote',
        { repoPath: activeRepoPath, branch: status.current_branch }
      );
      if (!result.success && result.conflicts.length > 0) {
        setError({
          code: 'GIT_CONFLICT',
          message: `Merge conflicts in: ${result.conflicts.join(', ')}. Resolve conflicts before continuing.`,
        });
        log().addLog('error', 'Git', `Pull produced conflicts in ${result.conflicts.length} file(s)`);
      } else {
        log().addLog('success', 'Git', `Pulled from origin/${status.current_branch}`);
      }
      await refreshSync();
    } catch (err: any) {
      const msg: string = err?.message || String(err);
      setError({ code: 'GIT_PULL_ERROR', message: msg });
      log().addLog('error', 'Git', `Pull failed: ${msg}`);
    } finally {
      setIsPulling(false);
    }
  }, [activeRepoPath, status, setIsPulling, setError, refreshSync, log]);

  // ── Sync (diverged) — pull --no-rebase then push ──────────────────────────
  const executeSync = useCallback(async () => {
    if (!activeRepoPath || !status) return;
    log().addLog('info', 'Git', 'Syncing diverged branch (merge pull + push)');

    // Step 1: Pull (merge)
    setIsPulling(true);
    try {
      const result = await invoke<{ success: boolean; conflicts: string[]; commits_pulled: number }>(
        'pull_from_remote',
        { repoPath: activeRepoPath, branch: status.current_branch }
      );
      if (!result.success && result.conflicts.length > 0) {
        setError({
          code: 'GIT_CONFLICT',
          message: `Sync stopped — merge conflicts in: ${result.conflicts.join(', ')}. Resolve conflicts before pushing.`,
        });
        log().addLog('error', 'Git', `Sync aborted — conflicts in ${result.conflicts.length} file(s)`);
        await refreshSync();
        return;
      }
    } catch (err: any) {
      const msg: string = err?.message || String(err);
      setError({ code: 'GIT_SYNC_PULL_ERROR', message: msg });
      log().addLog('error', 'Git', `Sync pull step failed: ${msg}`);
      await refreshSync();
      return;
    } finally {
      setIsPulling(false);
    }

    // Step 2: Push
    setIsPushing(true);
    try {
      await invoke('push_to_remote', { repoPath: activeRepoPath, branch: status.current_branch });
      log().addLog('success', 'Git', `Sync complete — pushed to origin/${status.current_branch}`);
    } catch (err: any) {
      const msg: string = err?.message || String(err);
      setError({ code: 'GIT_SYNC_PUSH_ERROR', message: msg });
      log().addLog('error', 'Git', `Sync push step failed: ${msg}`);
    } finally {
      setIsPushing(false);
      await refreshSync();
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
