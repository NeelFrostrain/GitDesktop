import { create } from 'zustand';
import { UnifiedUser, SavedAccount } from '../types/gitlab';
import {
  RepoStatus,
  AppError,
  BranchInfo,
  LfsFile,
  LfsLock,
  WorktreeInfo,
  StashEntry,
  TagInfo,
  BlameLine,
  SubmoduleInfo,
  HistoryOperation,
} from '../types/git';
import { GitService } from '../services/git/gitService';
import { getErrorMessage } from '../shared/utils/errorUtils';
import { useLogStore } from './useLogStore';

/**
 * Top-level application navigation views.
 */
export type NavView =
  | 'home'
  | 'workspace'
  | 'files'
  | 'changes'
  | 'history'
  | 'branches'
  | 'locks'
  | 'stashes'
  | 'tags'
  | 'submodules';

const getCachedUser = (): UnifiedUser | null => {
  try {
    const cached = localStorage.getItem('cached_user');
    return cached ? (JSON.parse(cached) as UnifiedUser) : null;
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
  tags: TagInfo[];
  submodules: SubmoduleInfo[];
  blameFile: string | null;
  blameLines: BlameLine[];
  selectedFile: string | null;
  stagedFiles: string[];
  hasInitializedStaging: boolean;
  selectedCommitSha: string | null;
  commitSummary: string;
  commitDescription: string;
  activeTab: 'changes' | 'history';
  diffViewMode: 'unified' | 'split';
  currentNavView: NavView;

  // Modal dialog visibility states
  isRepoModalOpen: boolean;
  isCreateRepoModalOpen: boolean;
  isMergeRequestModalOpen: boolean;
  isWorktreeModalOpen: boolean;
  isRebaseModalOpen: boolean;
  isCherryPickModalOpen: boolean;
  isBlameModalOpen: boolean;
  isReflogModalOpen: boolean;
  isConflictResolverModalOpen: boolean;
  isPatchModalOpen: boolean;
  isConfigModalOpen: boolean;
  isRewriteModalOpen: boolean;
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
  setTags: (tags: TagInfo[]) => void;
  setSubmodules: (submodules: SubmoduleInfo[]) => void;
  setBlameFile: (file: string | null) => void;
  setBlameLines: (lines: BlameLine[]) => void;
  setSelectedFile: (file: string | null) => void;
  toggleStageFile: (file: string) => Promise<void>;
  setAllStaged: (staged: boolean) => Promise<void>;
  setSelectedCommitSha: (sha: string | null) => void;
  setCommitSummary: (summary: string) => void;
  setCommitDescription: (desc: string) => void;
  commitOptions: CommitOptions;
  setCommitOptions: (opts: Partial<CommitOptions>) => void;
  resetCommitOptions: () => void;
  setActiveTab: (tab: 'changes' | 'history') => void;
  setDiffViewMode: (mode: 'unified' | 'split') => void;
  setCurrentNavView: (view: NavView) => void;

  setIsRepoModalOpen: (open: boolean) => void;
  setIsCreateRepoModalOpen: (open: boolean) => void;
  setIsMergeRequestModalOpen: (open: boolean) => void;
  setIsWorktreeModalOpen: (open: boolean) => void;
  setIsRebaseModalOpen: (open: boolean) => void;
  setIsCherryPickModalOpen: (open: boolean) => void;
  setIsBlameModalOpen: (open: boolean) => void;
  setIsReflogModalOpen: (open: boolean) => void;
  setIsConflictResolverModalOpen: (open: boolean) => void;
  setIsPatchModalOpen: (open: boolean) => void;
  setIsConfigModalOpen: (open: boolean) => void;
  setIsRewriteModalOpen: (open: boolean) => void;
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
  tags: [],
  submodules: [],
  blameFile: null,
  blameLines: [],
  selectedFile: null,
  stagedFiles: [],
  hasInitializedStaging: false,
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

  isRepoModalOpen: false,
  isCreateRepoModalOpen: false,
  isMergeRequestModalOpen: false,
  isWorktreeModalOpen: false,
  isRebaseModalOpen: false,
  isCherryPickModalOpen: false,
  isBlameModalOpen: false,
  isReflogModalOpen: false,
  isConflictResolverModalOpen: false,
  isPatchModalOpen: false,
  isConfigModalOpen: false,
  isRewriteModalOpen: false,
  pendingHistoryOp: null,
  isUserConfigModalOpen: false,
  pendingCommitData: null,

  activeModalTab: 'accounts',
  isFetching: false,
  isPushing: false,
  isPulling: false,
  lastFetchedTimestamp: null,
  error: null,

  setActiveRepoPath: (path) => {
    if (path) {
      try {
        localStorage.setItem('active_repo_path', path);
      } catch {
        // Ignore localStorage quota errors
      }
      get().addRecentRepo(path);
      useLogStore.getState().addLog('info', 'Repo', `Opened repository at '${path}'`);
    } else {
      try {
        localStorage.removeItem('active_repo_path');
      } catch {
        // Ignore localStorage errors
      }
      useLogStore.getState().addLog('info', 'Repo', 'Closed active repository');
    }

    set({
      activeRepoPath: path,
      selectedFile: null,
      selectedCommitSha: null,
      stagedFiles: [],
      hasInitializedStaging: false,
      currentNavView: path ? 'workspace' : 'home',
    });
  },

  addRecentRepo: (path) => {
    if (!path) return;
    const { recentRepos } = get();
    const normalized = path.replace(/\\/g, '/');
    const updated = [normalized, ...recentRepos.filter((r) => r.replace(/\\/g, '/') !== normalized)].slice(0, 20);
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
    useLogStore.getState().addLog('info', 'Repo', `Removed repository '${normalized}' from recent list`);

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
      useLogStore.getState().addLog('info', 'Auth', `Active session user set to @${user.username} (${user.name}) [${user.provider}]`);
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
    const allFilePaths = status ? status.files.map((f) => f.path) : [];
    const { stagedFiles: currentStaged, hasInitializedStaging } = get();

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
        ...new Set([
          ...currentStaged.filter((p) => stillExist.has(p)),
          ...gitStagedPaths,
        ]),
      ];
    }

    set({ status, stagedFiles: nextStaged, hasInitializedStaging: true });
  },

  setBranches: (branches) => set({ branches }),
  setLfsFiles: (lfsFiles) => set({ lfsFiles }),
  setLfsLocks: (lfsLocks) => set({ lfsLocks }),
  setIsLfsInstalled: (isLfsInstalled) => set({ isLfsInstalled }),
  setWorktrees: (worktrees) => set({ worktrees }),
  setStashes: (stashes) => set({ stashes }),
  setTags: (tags) => set({ tags }),
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
          useLogStore.getState().addLog('error', 'Git', `Failed to unstage file '${file}': ${getErrorMessage(error)}`);
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
          useLogStore.getState().addLog('error', 'Git', `Failed to stage file '${file}': ${getErrorMessage(error)}`);
        }
      }
    }
  },

  setAllStaged: async (staged) => {
    const { activeRepoPath, status, setStatus } = get();
    if (!status) return;

    if (staged) {
      useLogStore.getState().addLog('info', 'Git', `Staged all ${status.files.length} modified file(s)`);
      set({ stagedFiles: status.files.map((f) => f.path), hasInitializedStaging: true });
      if (activeRepoPath) {
        try {
          await GitService.stageFiles(activeRepoPath, []);
          const newStatus = await GitService.getRepoStatus(activeRepoPath);
          setStatus(newStatus);
        } catch (error: unknown) {
          useLogStore.getState().addLog('error', 'Git', `Failed to stage all files: ${getErrorMessage(error)}`);
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
          useLogStore.getState().addLog('error', 'Git', `Failed to unstage all files: ${getErrorMessage(error)}`);
        }
      }
    }
  },

  setSelectedCommitSha: (sha) => {
    if (sha) {
      useLogStore.getState().addLog('info', 'Git', `Inspecting details for commit ${sha.slice(0, 8)}`);
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
    useLogStore.getState().addLog('info', 'System', `Changed diff layout view to '${diffViewMode}' mode`);
    set({ diffViewMode });
  },

  setCurrentNavView: (currentNavView) => {
    useLogStore.getState().addLog('info', 'System', `Navigated to view '${currentNavView}'`);
    set({ currentNavView });
  },

  setIsRepoModalOpen: (isRepoModalOpen) => set({ isRepoModalOpen }),
  setIsCreateRepoModalOpen: (isCreateRepoModalOpen) => set({ isCreateRepoModalOpen }),
  setIsMergeRequestModalOpen: (isMergeRequestModalOpen) => set({ isMergeRequestModalOpen }),
  setIsWorktreeModalOpen: (isWorktreeModalOpen) => set({ isWorktreeModalOpen }),
  setIsRebaseModalOpen: (isRebaseModalOpen) => set({ isRebaseModalOpen }),
  setIsCherryPickModalOpen: (isCherryPickModalOpen) => set({ isCherryPickModalOpen }),
  setIsBlameModalOpen: (isBlameModalOpen) => set({ isBlameModalOpen }),
  setIsReflogModalOpen: (isReflogModalOpen) => set({ isReflogModalOpen }),
  setIsConflictResolverModalOpen: (isConflictResolverModalOpen) => set({ isConflictResolverModalOpen }),
  setIsPatchModalOpen: (isPatchModalOpen) => set({ isPatchModalOpen }),
  setIsConfigModalOpen: (isConfigModalOpen) => set({ isConfigModalOpen }),
  setIsRewriteModalOpen: (isRewriteModalOpen) => set({ isRewriteModalOpen }),
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
      useLogStore.getState().addLog('error', 'System', `Error [${error.code}]: ${error.message}`, error.message);
    }
    set({ error });
  },
}));
