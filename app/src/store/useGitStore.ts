import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { UnifiedUser, SavedAccount } from '../types/gitlab';
import {
  RepoStatus,
  FileStatus,
  AppError,
  BranchInfo,
  LfsFile,
  LfsLock,
  WorktreeInfo,
  StashEntry,
  TagInfo,
  ReleaseInfo,
  BlameLine,
  SubmoduleInfo,
  HistoryOperation,
} from '../types/git';
import { GitService } from '../services/git/gitService';
import { getErrorMessage } from '../shared/utils/errorUtils';
import { useLogStore } from './useLogStore';
import { avatarCache } from '../services/accounts/avatarCacheService';
import { RepoCacheService } from '../services/git/repoCacheService';
import { useTaskStore } from '../features/task-manager';
import { useRemoteStore } from './remoteStore';

/**
 * Top-level application navigation views.
 */
export type NavView =
  | 'home'
  | 'workspace'
  | 'files'
  | 'changes'
  | 'history'
  | 'graph'
  | 'branches'
  | 'locks'
  | 'stashes'
  | 'tags'
  | 'submodules';

const getCachedUser = (): UnifiedUser | null => {
  try {
    const cached = localStorage.getItem('cached_user');
    const user = cached ? (JSON.parse(cached) as UnifiedUser) : null;
    if (user?.avatar_url) {
      avatarCache.prefetchAvatars([user.avatar_url]).catch(() => {});
    }
    return user;
  } catch {
    return null;
  }
};

const getCachedActiveRepoPath = (): string | null => {
  try {
    return localStorage.getItem('active_repo_path') || null;
  } catch {
    return null;
  }
};

const getCachedRecentRepos = (): string[] => {
  try {
    const cached = localStorage.getItem('recent_repos');
    return cached ? (JSON.parse(cached) as string[]) : [];
  } catch {
    return [];
  }
};

const getCachedAliases = (): Record<string, string> => {
  try {
    const cached = localStorage.getItem('repo_aliases');
    return cached ? (JSON.parse(cached) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

/**
 * Flags controlling commit creation behavior.
 */
export interface CommitOptions {
  bypassHooks: boolean;
  signOff: boolean;
  allowEmpty: boolean;
}

/**
 * Main application state interface for Git workspace and navigation.
 */
export interface GitState {
  activeRepoPath: string | null;
  recentRepos: string[];
  repoAliases: Record<string, string>;
  user: UnifiedUser | null;
  accounts: SavedAccount[];
  status: RepoStatus | null;
  branches: BranchInfo[];
  lfsFiles: LfsFile[];
  lfsLocks: LfsLock[];
  isLfsInstalled: boolean;
  worktrees: WorktreeInfo[];
  stashes: StashEntry[];
  currentBranchStash: StashEntry | null;
  stashFiles: FileStatus[];
  isViewingStashedChanges: boolean;
  selectedStashFile: string | null;
  tags: TagInfo[];
  releases: ReleaseInfo[];
  submodules: SubmoduleInfo[];
  blameFile: string | null;
  blameLines: BlameLine[];
  selectedFile: string | null;
  stagedFiles: string[];
  hasInitializedStaging: boolean;
  statusVersion: number;
  selectedCommitSha: string | null;
  commitSummary: string;
  commitDescription: string;
  activeTab: 'changes' | 'history';
  diffViewMode: 'unified' | 'split' | 'edit';
  currentNavView: NavView;

  // Modal dialog visibility states
  isRepoModalOpen: boolean;
  isCreateRepoModalOpen: boolean;
  isMergeRequestModalOpen: boolean;
  selectedMergeRequestId: string | null;
  mergeRequestModalTab: 'create' | 'list' | 'edit';
  setSelectedMergeRequestId: (id: string | null) => void;
  setMergeRequestModalTab: (tab: 'create' | 'list' | 'edit') => void;
  openMergeRequestModal: (tab?: 'create' | 'list' | 'edit', prId?: string | null) => void;
  isWorktreeModalOpen: boolean;
  worktreeModalInitialBranch: string | null;
  openWorktreeModal: (branch?: string | null) => void;
  isRebaseModalOpen: boolean;
  isCherryPickModalOpen: boolean;
  isBlameModalOpen: boolean;
  isReflogModalOpen: boolean;
  isConflictResolverModalOpen: boolean;
  isPatchModalOpen: boolean;
  isConfigModalOpen: boolean;
  isHooksModalOpen: boolean;
  isRewriteModalOpen: boolean;
  isCreateTagModalOpen: boolean;
  tagModalTargetCommitSha: string | null;
  isCreateReleaseModalOpen: boolean;
  editingRelease: ReleaseInfo | null;
  isAddSubmoduleModalOpen: boolean;
  pendingHistoryOp: HistoryOperation | null;
  isUserConfigModalOpen: boolean;
  pendingCommitData: { summary: string; description?: string } | null;

  activeModalTab: 'accounts' | 'login' | 'repos';

  // Remote network action states
  isFetching: boolean;
  isPushing: boolean;
  isPulling: boolean;
  lastFetchedTimestamp: number | null;
  error: AppError | null;

  // Action methods
  setActiveRepoPath: (path: string | null) => void;
  addRecentRepo: (path: string) => void;
  removeRecentRepo: (path: string) => void;
  setRepoAlias: (path: string, alias: string) => void;
  setUser: (user: UnifiedUser | null) => void;
  setAccounts: (accounts: SavedAccount[]) => void;
  setStatus: (status: RepoStatus | null) => void;
  setBranches: (branches: BranchInfo[]) => void;
  setLfsFiles: (files: LfsFile[]) => void;
  setLfsLocks: (locks: LfsLock[]) => void;
  setIsLfsInstalled: (installed: boolean) => void;
  setWorktrees: (worktrees: WorktreeInfo[]) => void;
  setStashes: (stashes: StashEntry[]) => void;
  setCurrentBranchStash: (stash: StashEntry | null) => void;
  setStashFiles: (files: FileStatus[]) => void;
  setIsViewingStashedChanges: (viewing: boolean) => void;
  setSelectedStashFile: (file: string | null) => void;
  loadBranchStashes: () => Promise<void>;
  loadStashFiles: () => Promise<void>;
  restoreCurrentBranchStash: () => Promise<void>;
  discardCurrentBranchStash: () => Promise<void>;
  setTags: (tags: TagInfo[]) => void;
  setReleases: (releases: ReleaseInfo[]) => void;
  setSubmodules: (submodules: SubmoduleInfo[]) => void;
  setBlameFile: (file: string | null) => void;
  setBlameLines: (lines: BlameLine[]) => void;
  setSelectedFile: (file: string | null) => void;
  toggleStageFile: (file: string) => Promise<void>;
  toggleStageFiles: (files: string[], stage?: boolean) => Promise<void>;
  setAllStaged: (staged: boolean) => Promise<void>;
  setSelectedCommitSha: (sha: string | null) => void;
  setCommitSummary: (summary: string) => void;
  setCommitDescription: (desc: string) => void;
  commitOptions: CommitOptions;
  setCommitOptions: (opts: Partial<CommitOptions>) => void;
  resetCommitOptions: () => void;
  setActiveTab: (tab: 'changes' | 'history') => void;
  setDiffViewMode: (mode: 'unified' | 'split' | 'edit') => void;
  setCurrentNavView: (view: NavView) => void;
  repoSyncCounter: number;
  reloadActiveRepo: (full?: boolean) => Promise<void>;

  isMissingRepoModalOpen: boolean;
  missingRepoPath: string | null;
  missingRepoReason: string | null;
  setIsMissingRepoModalOpen: (open: boolean, path?: string | null, reason?: string | null) => void;
  setIsRepoModalOpen: (open: boolean) => void;
  setIsCreateRepoModalOpen: (open: boolean) => void;
  isPublishRepoModalOpen: boolean;
  setIsPublishRepoModalOpen: (open: boolean) => void;
  isRemoteNotFoundModalOpen: boolean;
  setIsRemoteNotFoundModalOpen: (open: boolean) => void;
  isCloneRepoModalOpen: boolean;
  cloneModalInitialUrl: string;
  setIsCloneRepoModalOpen: (open: boolean, initialUrl?: string) => void;
  setIsMergeRequestModalOpen: (open: boolean) => void;
  setIsWorktreeModalOpen: (open: boolean) => void;
  setIsRebaseModalOpen: (open: boolean) => void;
  setIsCherryPickModalOpen: (open: boolean) => void;
  setIsBlameModalOpen: (open: boolean) => void;
  setIsReflogModalOpen: (open: boolean) => void;
  setIsConflictResolverModalOpen: (open: boolean) => void;
  setIsPatchModalOpen: (open: boolean) => void;
  setIsConfigModalOpen: (open: boolean) => void;
  setIsHooksModalOpen: (open: boolean) => void;
  setIsRewriteModalOpen: (open: boolean) => void;
  setIsCreateTagModalOpen: (open: boolean) => void;
  setTagModalTargetCommitSha: (sha: string | null) => void;
  setIsCreateReleaseModalOpen: (open: boolean) => void;
  setEditingRelease: (release: ReleaseInfo | null) => void;
  setIsAddSubmoduleModalOpen: (open: boolean) => void;
  setPendingHistoryOp: (op: HistoryOperation | null) => void;
  setIsUserConfigModalOpen: (open: boolean) => void;
  setPendingCommitData: (data: { summary: string; description?: string } | null) => void;
  setActiveModalTab: (tab: 'accounts' | 'login' | 'repos') => void;

  setIsFetching: (fetching: boolean) => void;
  setIsPushing: (pushing: boolean) => void;
  setIsPulling: (pulling: boolean) => void;
  setLastFetchedTimestamp: (time: number | null) => void;
  setError: (error: AppError | null) => void;
}

/**
 * Primary Zustand store managing repository state, modals, active user, and navigation.
 */
export const useGitStore = create<GitState>((set, get) => ({
  activeRepoPath: getCachedActiveRepoPath(),
  recentRepos: getCachedRecentRepos(),
  repoAliases: getCachedAliases(),
  user: getCachedUser(),
  accounts: [],
  status: null,
  branches: [],
  lfsFiles: [],
  lfsLocks: [],
  isLfsInstalled: true,
  worktrees: [],
  stashes: [],
  currentBranchStash: null,
  stashFiles: [],
  isViewingStashedChanges: false,
  selectedStashFile: null,
  tags: [],
  releases: [],
  submodules: [],
  blameFile: null,
  blameLines: [],
  selectedFile: null,
  stagedFiles: [],
  hasInitializedStaging: false,
  statusVersion: 0,
  selectedCommitSha: null,
  commitSummary: '',
  commitDescription: '',
  commitOptions: {
    bypassHooks: false,
    signOff: false,
    allowEmpty: false,
  },
  activeTab: 'changes',
  diffViewMode: 'unified',
  currentNavView: 'home',

  isMissingRepoModalOpen: false,
  missingRepoPath: null,
  missingRepoReason: null,
  setIsMissingRepoModalOpen: (open, path = null, reason = null) =>
    set({
      isMissingRepoModalOpen: open,
      missingRepoPath: open ? (path ?? get().activeRepoPath) : null,
      missingRepoReason: open ? reason : null,
    }),
  isRepoModalOpen: false,
  isCreateRepoModalOpen: false,
  isPublishRepoModalOpen: false,
  isRemoteNotFoundModalOpen: false,
  isCloneRepoModalOpen: false,
  cloneModalInitialUrl: '',
  isMergeRequestModalOpen: false,
  selectedMergeRequestId: null,
  mergeRequestModalTab: 'create',
  isWorktreeModalOpen: false,
  worktreeModalInitialBranch: null,
  isRebaseModalOpen: false,
  isCherryPickModalOpen: false,
  isBlameModalOpen: false,
  isReflogModalOpen: false,
  isConflictResolverModalOpen: false,
  isPatchModalOpen: false,
  isConfigModalOpen: false,
  isHooksModalOpen: false,
  isRewriteModalOpen: false,
  isCreateTagModalOpen: false,
  tagModalTargetCommitSha: null,
  isCreateReleaseModalOpen: false,
  editingRelease: null,
  isAddSubmoduleModalOpen: false,
  pendingHistoryOp: null,
  isUserConfigModalOpen: false,
  pendingCommitData: null,

  activeModalTab: 'accounts',
  isFetching: false,
  isPushing: false,
  isPulling: false,
  lastFetchedTimestamp: null,
  error: null,
  repoSyncCounter: 0,

  reloadActiveRepo: async (full = false) => {
    const { activeRepoPath } = get();
    if (!activeRepoPath) return;

    try {
      if (full) {
        await GitService.fetchRemote(activeRepoPath).catch(() => {});
      }

      const res = await GitService.getRepoStatus(activeRepoPath);
      get().setStatus(res);

      const [branches, tags, submodules] = await Promise.all([
        GitService.listBranches(activeRepoPath).catch(() => []),
        GitService.listTags(activeRepoPath).catch(() => []),
        GitService.listSubmodules(activeRepoPath).catch(() => []),
      ]);

      if (branches && branches.length > 0) get().setBranches(branches);
      if (tags) get().setTags(tags);
      if (submodules) get().setSubmodules(submodules);

      await get().loadBranchStashes();

      // Trigger reactive components (History, Graph, Diff)
      set((s) => ({ repoSyncCounter: s.repoSyncCounter + 1 }));

      // Adjust selectedFile if no longer valid
      const currentFiles = res.files || [];
      const currentSelected = get().selectedFile;
      if (currentSelected && !currentFiles.some((f) => f.path === currentSelected)) {
        set({ selectedFile: currentFiles.length > 0 ? currentFiles[0].path : null });
      }
    } catch (err) {
      useLogStore
        .getState()
        .addLog('warning', 'Git', `Failed to sync repo state: ${getErrorMessage(err)}`);
    }
  },

  setActiveRepoPath: (path) => {
    if (!path) {
      try {
        localStorage.removeItem('active_repo_path');
      } catch {
        // Ignore localStorage errors
      }
      useLogStore.getState().addLog('info', 'Repo', 'Closed active repository');
      set((state) => ({
        activeRepoPath: null,
        status: null,
        branches: [],
        tags: [],
        releases: [],
        submodules: [],
        stashes: [],
        lfsFiles: [],
        lfsLocks: [],
        selectedFile: null,
        stagedFiles: [],
        hasInitializedStaging: false,
        selectedCommitSha: null,
        currentBranchStash: null,
        isViewingStashedChanges: false,
        selectedStashFile: null,
        blameFile: null,
        blameLines: [],
        commitSummary: '',
        commitDescription: '',
        currentNavView: 'home',
        repoSyncCounter: state.repoSyncCounter + 1,
      }));
      useRemoteStore.setState({ remotes: [] });
      return;
    }

    try {
      localStorage.setItem('active_repo_path', path);
    } catch {
      // Ignore localStorage quota errors
    }
    get().addRecentRepo(path);
    useLogStore.getState().addLog('info', 'Repo', `Opened repository at '${path}'`);

    // 1. Immediately wipe previous repository state to prevent any stale data flashing
    set((state) => ({
      activeRepoPath: path,
      status: null,
      branches: [],
      tags: [],
      releases: [],
      submodules: [],
      stashes: [],
      lfsFiles: [],
      lfsLocks: [],
      selectedFile: null,
      stagedFiles: [],
      hasInitializedStaging: false,
      selectedCommitSha: null,
      currentBranchStash: null,
      isViewingStashedChanges: false,
      selectedStashFile: null,
      blameFile: null,
      blameLines: [],
      commitSummary: '',
      commitDescription: '',
      currentNavView: 'changes',
      repoSyncCounter: state.repoSyncCounter + 1,
    }));
    useRemoteStore.setState({ remotes: [] });

    // 2. Concurrently load all local Git metadata in parallel using ultra-fast local libgit2
    (async () => {
      try {
        // Fast path validation check
        const validation = await GitService.validateRepoPath(path).catch(() => null);
        if (validation && validation.is_valid === false) {
          if (get().activeRepoPath === path) {
            get().setIsMissingRepoModalOpen(
              true,
              path,
              validation.error_message || 'Active repository folder or .git structure is missing'
            );
          }
          return;
        }

        const [statusRes, branchesRes, tagsRes, remotesRes, submodulesRes] = await Promise.all([
          GitService.getRepoStatus(path).catch(() => null),
          GitService.listBranches(path).catch(() => []),
          GitService.listTags(path).catch(() => []),
          GitService.listRemotes(path).catch(() => []),
          GitService.listSubmodules(path).catch(() => []),
        ]);

        // Guard against race conditions if user switched repos while loading
        if (get().activeRepoPath !== path) return;

        if (statusRes) {
          get().setStatus(statusRes);
          if (statusRes.files && statusRes.files.length > 0) {
            get().setSelectedFile(statusRes.files[0].path);
          }
        }
        if (branchesRes && branchesRes.length > 0) {
          get().setBranches(branchesRes);
        }
        if (tagsRes) {
          get().setTags(tagsRes);
        }
        if (submodulesRes) {
          get().setSubmodules(submodulesRes);
        }
        if (remotesRes && remotesRes.length > 0) {
          useRemoteStore.setState({ remotes: remotesRes });
          const currentActive = useRemoteStore.getState().activeRemote;
          if (!remotesRes.some((r) => r.name === currentActive)) {
            useRemoteStore.setState({ activeRemote: remotesRes[0].name });
          }
        }

        // Touch backend registry
        invoke('add_repo_to_registry_cmd', { path }).catch(() => {});

        // Stashes
        get().loadBranchStashes().catch(() => {});

        // Signal components to re-render fresh
        set((s) => ({ repoSyncCounter: s.repoSyncCounter + 1 }));

        // Non-blocking background pre-fetch (PRs, releases)
        RepoCacheService.precacheRepository(path).catch(() => {});
      } catch (err) {
        useLogStore
          .getState()
          .addLog('warning', 'Git', `Failed to open repository '${path}': ${getErrorMessage(err)}`);
      }
    })();
  },

  addRecentRepo: (path) => {
    if (!path) return;
    const { recentRepos } = get();
    const normalized = path.replace(/\\/g, '/');
    const updated = [
      normalized,
      ...recentRepos.filter((r) => r.replace(/\\/g, '/') !== normalized),
    ].slice(0, 20);
    try {
      localStorage.setItem('recent_repos', JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
    set({ recentRepos: updated });
  },

  removeRecentRepo: (path) => {
    const { recentRepos, activeRepoPath } = get();
    const normalized = path.replace(/\\/g, '/');
    const updated = recentRepos.filter((r) => r.replace(/\\/g, '/') !== normalized);
    try {
      localStorage.setItem('recent_repos', JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
    useLogStore
      .getState()
      .addLog('info', 'Repo', `Removed repository '${normalized}' from recent list`);

    const isActive = activeRepoPath && activeRepoPath.replace(/\\/g, '/') === normalized;
    if (isActive) {
      get().setActiveRepoPath(updated.length > 0 ? updated[0] : null);
    } else {
      set({ recentRepos: updated });
    }
  },

  setRepoAlias: (path, alias) => {
    const { repoAliases } = get();
    const normalized = path.replace(/\\/g, '/');
    const updated = { ...repoAliases, [normalized]: alias.trim() };
    try {
      localStorage.setItem('repo_aliases', JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
    set({ repoAliases: updated });
  },

  setUser: (user) => {
    if (user) {
      try {
        localStorage.setItem('cached_user', JSON.stringify(user));
      } catch {
        // Ignore localStorage errors
      }
      if (user.avatar_url) {
        avatarCache.prefetchAvatars([user.avatar_url]).catch(() => {});
      }
      useLogStore
        .getState()
        .addLog(
          'info',
          'Auth',
          `Active session user set to @${user.username} (${user.name}) [${user.provider}]`
        );
    } else {
      try {
        localStorage.removeItem('cached_user');
      } catch {
        // Ignore localStorage errors
      }
      useLogStore.getState().addLog('info', 'Auth', 'User session logged out');
    }
    set((state) => ({ user, error: user ? null : state.error }));
  },

  setAccounts: (accounts) => set({ accounts }),

  setStatus: (status) => {
    const prevStatus = get().status;
    const { stagedFiles: currentStaged, hasInitializedStaging } = get();

    // Fast fingerprint check: build a single string from all file paths/statuses and compare.
    // This is O(N) but uses a single string join + one comparison, avoiding per-file object access.
    if (hasInitializedStaging && prevStatus && status) {
      const prevBranch = prevStatus.current_branch;
      const nextBranch = status.current_branch;
      const branchSame = prevBranch === nextBranch;
      const metaSame =
        prevStatus.ahead === status.ahead &&
        prevStatus.behind === status.behind &&
        prevStatus.is_clean === status.is_clean &&
        prevStatus.has_conflicts === status.has_conflicts;

      if (branchSame && metaSame && prevStatus.files.length === status.files.length) {
        // Zero-allocation early-exit comparison loop
        let filesIdentical = true;
        for (let i = 0; i < status.files.length; i++) {
          const pf = prevStatus.files[i];
          const nf = status.files[i];
          if (pf.path !== nf.path || pf.status !== nf.status || pf.staged !== nf.staged) {
            filesIdentical = false;
            break;
          }
        }
        if (filesIdentical) return;
      }
    }

    const allFilePaths = status ? status.files.map((f) => f.path) : [];

    let nextStaged: string[];
    if (!hasInitializedStaging) {
      // First status load for newly opened repo: default-select all files
      nextStaged = allFilePaths;
    } else {
      // Preserve whatever the user has selected, drop files that no longer exist,
      // and add any files that became git-staged externally (e.g. git add in terminal)
      const gitStagedPaths = status ? status.files.filter((f) => f.staged).map((f) => f.path) : [];
      const stillExist = new Set(allFilePaths);
      nextStaged = [
        ...new Set([...currentStaged.filter((p) => stillExist.has(p)), ...gitStagedPaths]),
      ];
    }

    const currentSelected = get().selectedFile;
    let nextSelected = currentSelected;
    if (currentSelected && !allFilePaths.includes(currentSelected)) {
      nextSelected = allFilePaths.length > 0 ? allFilePaths[0] : null;
    } else if (!currentSelected && allFilePaths.length > 0) {
      nextSelected = allFilePaths[0];
    } else if (allFilePaths.length === 0) {
      nextSelected = null;
    }

    set((state) => ({
      status,
      stagedFiles: nextStaged,
      selectedFile: nextSelected,
      hasInitializedStaging: true,
      statusVersion: state.statusVersion + 1,
    }));

    // Only reload branch stashes when the branch itself has changed — avoids a Git IPC
    // call on every poll cycle when the user is sitting on the same branch.
    const prevBranch = prevStatus?.current_branch;
    const nextBranch = status?.current_branch;
    if (prevBranch !== nextBranch) {
      get()
        .loadBranchStashes()
        .catch(() => {});
    }
  },

  setBranches: (branches) => set({ branches }),
  setLfsFiles: (lfsFiles) => set({ lfsFiles }),
  setLfsLocks: (lfsLocks) => set({ lfsLocks }),
  setIsLfsInstalled: (isLfsInstalled) => set({ isLfsInstalled }),
  setWorktrees: (worktrees) => set({ worktrees }),
  setStashes: (stashes) => set({ stashes }),
  setCurrentBranchStash: (currentBranchStash) => set({ currentBranchStash }),
  setStashFiles: (stashFiles) => set({ stashFiles }),
  setIsViewingStashedChanges: (isViewingStashedChanges) => {
    set({ isViewingStashedChanges });
    if (isViewingStashedChanges) {
      get()
        .loadStashFiles()
        .catch(() => {});
    }
  },
  setSelectedStashFile: (selectedStashFile) => set({ selectedStashFile }),

  loadStashFiles: async () => {
    const { activeRepoPath, currentBranchStash, selectedStashFile } = get();
    if (!activeRepoPath || !currentBranchStash) {
      set({ stashFiles: [], selectedStashFile: null });
      return;
    }
    try {
      const files = await GitService.getStashFiles(activeRepoPath, currentBranchStash.index);
      const list = files || [];
      let nextSelected = selectedStashFile;
      if (!nextSelected || !list.some((f) => f.path === nextSelected)) {
        nextSelected = list.length > 0 ? list[0].path : null;
      }
      set({ stashFiles: list, selectedStashFile: nextSelected });
    } catch {
      set({ stashFiles: [], selectedStashFile: null });
    }
  },

  loadBranchStashes: async () => {
    const { activeRepoPath, status } = get();
    if (!activeRepoPath || !status?.current_branch) {
      set({ currentBranchStash: null, stashFiles: [], isViewingStashedChanges: false });
      return;
    }
    try {
      const allStashes = await GitService.listStashes(activeRepoPath);
      set({ stashes: allStashes || [] });
      const currentBranch = status.current_branch.trim();
      const branchStash =
        (allStashes || []).find((s) => {
          if (s.branch === currentBranch) return true;
          if (s.message.includes(`Saved changes on ${currentBranch}`)) return true;
          if (s.message.includes(`on ${currentBranch}:`)) return true;
          if (s.message.includes(`WIP on ${currentBranch}`)) return true;
          return false;
        }) || null;

      set((state) => ({
        currentBranchStash: branchStash,
        isViewingStashedChanges: branchStash ? state.isViewingStashedChanges : false,
      }));

      if (branchStash) {
        get()
          .loadStashFiles()
          .catch(() => {});
      }
    } catch {
      set({ currentBranchStash: null, stashFiles: [], isViewingStashedChanges: false });
    }
  },

  restoreCurrentBranchStash: async () => {
    const { activeRepoPath, currentBranchStash, setStatus } = get();
    if (!activeRepoPath || !currentBranchStash) return;

    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';
    const taskId = useTaskStore.getState().addTask({
      type: 'stash',
      title: `Restore stash on ${currentBranchStash.branch}`,
      repoName,
      localPath: activeRepoPath,
      cancellable: false,
    });

    try {
      await GitService.popStash(activeRepoPath, currentBranchStash.index);
      useLogStore
        .getState()
        .addLog('success', 'Git', `Restored stashed changes to working directory`);
      set({ isViewingStashedChanges: false, currentBranchStash: null, selectedStashFile: null });
      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      get()
        .loadBranchStashes()
        .catch(() => {});
      useTaskStore.getState().completeTask(taskId);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useTaskStore.getState().failTask(taskId, msg);
      useLogStore.getState().addLog('error', 'Git', `Failed to restore stash: ${msg}`);
      throw error;
    }
  },

  discardCurrentBranchStash: async () => {
    const { activeRepoPath, currentBranchStash } = get();
    if (!activeRepoPath || !currentBranchStash) return;

    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';
    const taskId = useTaskStore.getState().addTask({
      type: 'stash',
      title: `Discard stash on ${currentBranchStash.branch}`,
      repoName,
      localPath: activeRepoPath,
      cancellable: false,
    });

    try {
      await GitService.dropStash(activeRepoPath, currentBranchStash.index);
      useLogStore.getState().addLog('info', 'Git', `Discarded stashed changes`);
      set({ isViewingStashedChanges: false, currentBranchStash: null, selectedStashFile: null });
      get()
        .loadBranchStashes()
        .catch(() => {});
      useTaskStore.getState().completeTask(taskId);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useTaskStore.getState().failTask(taskId, msg);
      useLogStore.getState().addLog('error', 'Git', `Failed to discard stash: ${msg}`);
      throw error;
    }
  },
  setTags: (tags) => set({ tags }),
  setReleases: (releases) => set({ releases }),
  setSubmodules: (submodules) => set({ submodules }),
  setBlameFile: (blameFile) => set({ blameFile }),
  setBlameLines: (blameLines) => set({ blameLines }),

  setSelectedFile: (file) => {
    if (file) {
      useLogStore.getState().addLog('info', 'Git', `Selected file '${file}' for diff inspection`);
    }
    set({ selectedFile: file });
  },

  toggleStageFile: async (file) => {
    const { activeRepoPath, stagedFiles, setStatus } = get();
    const isStaged = stagedFiles.includes(file);
    if (isStaged) {
      useLogStore.getState().addLog('info', 'Git', `Unstaged file '${file}'`);
      set({ stagedFiles: stagedFiles.filter((f) => f !== file), hasInitializedStaging: true });
      if (activeRepoPath) {
        try {
          await GitService.unstageFiles(activeRepoPath, [file]);
          const newStatus = await GitService.getRepoStatus(activeRepoPath);
          setStatus(newStatus);
        } catch (error: unknown) {
          useLogStore
            .getState()
            .addLog('error', 'Git', `Failed to unstage file '${file}': ${getErrorMessage(error)}`);
        }
      }
    } else {
      useLogStore.getState().addLog('info', 'Git', `Staged file '${file}'`);
      set({ stagedFiles: [...stagedFiles, file], hasInitializedStaging: true });
      if (activeRepoPath) {
        try {
          await GitService.stageFiles(activeRepoPath, [file]);
          const newStatus = await GitService.getRepoStatus(activeRepoPath);
          setStatus(newStatus);
        } catch (error: unknown) {
          useLogStore
            .getState()
            .addLog('error', 'Git', `Failed to stage file '${file}': ${getErrorMessage(error)}`);
        }
      }
    }
  },

  toggleStageFiles: async (files, stage) => {
    if (!files || files.length === 0) return;
    const { activeRepoPath, stagedFiles, setStatus } = get();
    const shouldStage = stage !== undefined ? stage : !files.every((f) => stagedFiles.includes(f));

    let nextStaged: string[];
    if (shouldStage) {
      nextStaged = Array.from(new Set([...stagedFiles, ...files]));
      useLogStore.getState().addLog('info', 'Git', `Staged ${files.length} file(s)`);
      set({ stagedFiles: nextStaged, hasInitializedStaging: true });
      if (activeRepoPath) {
        try {
          await GitService.stageFiles(activeRepoPath, files);
          const newStatus = await GitService.getRepoStatus(activeRepoPath);
          setStatus(newStatus);
        } catch (error: unknown) {
          useLogStore
            .getState()
            .addLog('error', 'Git', `Failed to stage files: ${getErrorMessage(error)}`);
        }
      }
    } else {
      const filesSet = new Set(files);
      nextStaged = stagedFiles.filter((f) => !filesSet.has(f));
      useLogStore.getState().addLog('info', 'Git', `Unstaged ${files.length} file(s)`);
      set({ stagedFiles: nextStaged, hasInitializedStaging: true });
      if (activeRepoPath) {
        try {
          await GitService.unstageFiles(activeRepoPath, files);
          const newStatus = await GitService.getRepoStatus(activeRepoPath);
          setStatus(newStatus);
        } catch (error: unknown) {
          useLogStore
            .getState()
            .addLog('error', 'Git', `Failed to unstage files: ${getErrorMessage(error)}`);
        }
      }
    }
  },

  setAllStaged: async (staged) => {
    const { activeRepoPath, status, setStatus } = get();
    if (!status) return;

    if (staged) {
      useLogStore
        .getState()
        .addLog('info', 'Git', `Staged all ${status.files.length} modified file(s)`);
      set({ stagedFiles: status.files.map((f) => f.path), hasInitializedStaging: true });
      if (activeRepoPath) {
        try {
          await GitService.stageFiles(activeRepoPath, []);
          const newStatus = await GitService.getRepoStatus(activeRepoPath);
          setStatus(newStatus);
        } catch (error: unknown) {
          useLogStore
            .getState()
            .addLog('error', 'Git', `Failed to stage all files: ${getErrorMessage(error)}`);
        }
      }
    } else {
      useLogStore.getState().addLog('info', 'Git', 'Unstaged all files');
      const allPaths = status.files.map((f) => f.path);
      set({ stagedFiles: [], hasInitializedStaging: true });
      if (activeRepoPath) {
        try {
          await GitService.unstageFiles(activeRepoPath, allPaths);
          const newStatus = await GitService.getRepoStatus(activeRepoPath);
          setStatus(newStatus);
        } catch (error: unknown) {
          useLogStore
            .getState()
            .addLog('error', 'Git', `Failed to unstage all files: ${getErrorMessage(error)}`);
        }
      }
    }
  },

  setSelectedCommitSha: (sha) => {
    if (sha) {
      useLogStore
        .getState()
        .addLog('info', 'Git', `Inspecting details for commit ${sha.slice(0, 8)}`);
    }
    set({ selectedCommitSha: sha });
  },

  setCommitSummary: (commitSummary) => set({ commitSummary }),
  setCommitDescription: (commitDescription) => set({ commitDescription }),
  setCommitOptions: (opts) =>
    set((state) => ({ commitOptions: { ...state.commitOptions, ...opts } })),
  resetCommitOptions: () =>
    set({ commitOptions: { bypassHooks: false, signOff: false, allowEmpty: false } }),

  setActiveTab: (activeTab) => {
    useLogStore.getState().addLog('info', 'System', `Switched workspace tab to '${activeTab}'`);
    set({ activeTab });
  },

  setDiffViewMode: (diffViewMode) => {
    useLogStore
      .getState()
      .addLog('info', 'System', `Changed diff layout view to '${diffViewMode}' mode`);
    set({ diffViewMode });
  },

  setCurrentNavView: (currentNavView) => {
    useLogStore.getState().addLog('info', 'System', `Navigated to view '${currentNavView}'`);
    set({ currentNavView });
  },

  setIsRepoModalOpen: (isRepoModalOpen) => set({ isRepoModalOpen }),
  setIsCreateRepoModalOpen: (isCreateRepoModalOpen) => set({ isCreateRepoModalOpen }),
  setIsPublishRepoModalOpen: (isPublishRepoModalOpen) => set({ isPublishRepoModalOpen }),
  setIsRemoteNotFoundModalOpen: (isRemoteNotFoundModalOpen) => set({ isRemoteNotFoundModalOpen }),
  setIsCloneRepoModalOpen: (isCloneRepoModalOpen, initialUrl) =>
    set({
      isCloneRepoModalOpen,
      cloneModalInitialUrl: initialUrl !== undefined ? initialUrl : get().cloneModalInitialUrl,
    }),
  setIsMergeRequestModalOpen: (isMergeRequestModalOpen) => set({ isMergeRequestModalOpen }),
  setSelectedMergeRequestId: (selectedMergeRequestId) => set({ selectedMergeRequestId }),
  setMergeRequestModalTab: (mergeRequestModalTab) => set({ mergeRequestModalTab }),
  openMergeRequestModal: (tab = 'create', prId = null) =>
    set({
      isMergeRequestModalOpen: true,
      mergeRequestModalTab: tab,
      selectedMergeRequestId: prId,
    }),
  setIsWorktreeModalOpen: (isWorktreeModalOpen) =>
    set({
      isWorktreeModalOpen,
      worktreeModalInitialBranch: isWorktreeModalOpen ? get().worktreeModalInitialBranch : null,
    }),
  openWorktreeModal: (branch = null) =>
    set({
      isWorktreeModalOpen: true,
      worktreeModalInitialBranch: branch || null,
    }),
  setIsRebaseModalOpen: (isRebaseModalOpen) => set({ isRebaseModalOpen }),
  setIsCherryPickModalOpen: (isCherryPickModalOpen) => set({ isCherryPickModalOpen }),
  setIsBlameModalOpen: (isBlameModalOpen) => set({ isBlameModalOpen }),
  setIsReflogModalOpen: (isReflogModalOpen) => set({ isReflogModalOpen }),
  setIsConflictResolverModalOpen: (isConflictResolverModalOpen) =>
    set({ isConflictResolverModalOpen }),
  setIsPatchModalOpen: (isPatchModalOpen) => set({ isPatchModalOpen }),
  setIsConfigModalOpen: (isConfigModalOpen) => set({ isConfigModalOpen }),
  setIsHooksModalOpen: (isHooksModalOpen) => set({ isHooksModalOpen }),
  setIsRewriteModalOpen: (isRewriteModalOpen) => set({ isRewriteModalOpen }),
  setIsCreateTagModalOpen: (isCreateTagModalOpen) => set({ isCreateTagModalOpen }),
  setTagModalTargetCommitSha: (tagModalTargetCommitSha) => set({ tagModalTargetCommitSha }),
  setIsCreateReleaseModalOpen: (isCreateReleaseModalOpen) => set({ isCreateReleaseModalOpen }),
  setEditingRelease: (editingRelease) => set({ editingRelease }),
  setIsAddSubmoduleModalOpen: (isAddSubmoduleModalOpen) => set({ isAddSubmoduleModalOpen }),
  setPendingHistoryOp: (pendingHistoryOp) => set({ pendingHistoryOp }),
  setIsUserConfigModalOpen: (isUserConfigModalOpen) => set({ isUserConfigModalOpen }),
  setPendingCommitData: (pendingCommitData) => set({ pendingCommitData }),
  setActiveModalTab: (activeModalTab) => set({ activeModalTab }),

  setIsFetching: (isFetching) => set({ isFetching }),
  setIsPushing: (isPushing) => set({ isPushing }),
  setIsPulling: (isPulling) => set({ isPulling }),
  setLastFetchedTimestamp: (lastFetchedTimestamp) => set({ lastFetchedTimestamp }),
  setError: (error) => {
    if (error) {
      useLogStore
        .getState()
        .addLog('error', 'System', `Error [${error.code}]: ${error.message}`, error.message);
    }
    set({ error });
  },
}));
