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
  SubmoduleInfo
} from '../types/git';

import { useLogStore } from './useLogStore';

export type NavView = 
  | 'overview' 
  | 'files' 
  | 'changes' 
  | 'history' 
  | 'branches' 
  | 'locks' 
  | 'reviews' 
  | 'home' 
  | 'projects' 
  | 'groups' 
  | 'work-items' 
  | 'merge-requests' 
  | 'todos' 
  | 'workspace'
  | 'stashes'
  | 'tags'
  | 'submodules';

const getCachedUser = (): UnifiedUser | null => {
  try {
    const cached = localStorage.getItem('cached_user');
    return cached ? JSON.parse(cached) : null;
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
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
};

const getCachedAliases = (): Record<string, string> => {
  try {
    const cached = localStorage.getItem('repo_aliases');
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
};

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
  selectedCommitSha: string | null;
  commitSummary: string;
  commitDescription: string;
  activeTab: 'changes' | 'history';
  diffViewMode: 'unified' | 'split';
  currentNavView: NavView;

  // Modals
  isRepoModalOpen: boolean;
  isCreateRepoModalOpen: boolean;
  isMergeRequestModalOpen: boolean;

  isWorktreeModalOpen: boolean;
  isRebaseModalOpen: boolean;
  isCherryPickModalOpen: boolean;
  isStashModalOpen: boolean;
  isTagsModalOpen: boolean;
  isBlameModalOpen: boolean;
  isReflogModalOpen: boolean;
  isConflictResolverModalOpen: boolean;
  isPatchModalOpen: boolean;
  isConfigModalOpen: boolean;
  isSubmodulesModalOpen: boolean;

  activeModalTab: 'accounts' | 'login' | 'repos';
  isFetching: boolean;
  isPushing: boolean;
  isPulling: boolean;
  lastFetchedTimestamp: number | null;
  error: AppError | null;

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
  toggleStageFile: (file: string) => void;
  setAllStaged: (staged: boolean) => void;
  setSelectedCommitSha: (sha: string | null) => void;
  setCommitSummary: (summary: string) => void;
  setCommitDescription: (desc: string) => void;
  setActiveTab: (tab: 'changes' | 'history') => void;
  setDiffViewMode: (mode: 'unified' | 'split') => void;
  setCurrentNavView: (view: NavView) => void;

  setIsRepoModalOpen: (open: boolean) => void;
  setIsCreateRepoModalOpen: (open: boolean) => void;
  setIsMergeRequestModalOpen: (open: boolean) => void;

  setIsWorktreeModalOpen: (open: boolean) => void;
  setIsRebaseModalOpen: (open: boolean) => void;
  setIsCherryPickModalOpen: (open: boolean) => void;
  setIsStashModalOpen: (open: boolean) => void;
  setIsTagsModalOpen: (open: boolean) => void;
  setIsBlameModalOpen: (open: boolean) => void;
  setIsReflogModalOpen: (open: boolean) => void;
  setIsConflictResolverModalOpen: (open: boolean) => void;
  setIsPatchModalOpen: (open: boolean) => void;
  setIsConfigModalOpen: (open: boolean) => void;
  setIsSubmodulesModalOpen: (open: boolean) => void;

  setActiveModalTab: (tab: 'accounts' | 'login' | 'repos') => void;
  setIsFetching: (fetching: boolean) => void;
  setIsPushing: (pushing: boolean) => void;
  setIsPulling: (pushing: boolean) => void;
  setLastFetchedTimestamp: (time: number | null) => void;
  setError: (error: AppError | null) => void;
}

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
  selectedCommitSha: null,
  commitSummary: '',
  commitDescription: '',
  activeTab: 'changes',
  diffViewMode: 'unified',
  currentNavView: getCachedActiveRepoPath() ? 'workspace' : 'home',

  isRepoModalOpen: false,
  isCreateRepoModalOpen: false,
  isMergeRequestModalOpen: false,

  isWorktreeModalOpen: false,
  isRebaseModalOpen: false,
  isCherryPickModalOpen: false,
  isStashModalOpen: false,
  isTagsModalOpen: false,
  isBlameModalOpen: false,
  isReflogModalOpen: false,
  isConflictResolverModalOpen: false,
  isPatchModalOpen: false,
  isConfigModalOpen: false,
  isSubmodulesModalOpen: false,

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
      } catch {}
      get().addRecentRepo(path);
      useLogStore.getState().addLog('info', 'Repo', `Opened repository at '${path}'`);
    } else {
      try {
        localStorage.removeItem('active_repo_path');
      } catch {}
      useLogStore.getState().addLog('info', 'Repo', `Closed active repository`);
    }

    set({ 
      activeRepoPath: path,
      selectedFile: null,
      selectedCommitSha: null,
      stagedFiles: [],
      currentNavView: path ? 'workspace' : 'home'
    });
  },

  addRecentRepo: (path) => {
    if (!path) return;
    const { recentRepos } = get();
    const normalized = path.replace(/\\/g, '/');
    const updated = [normalized, ...recentRepos.filter((r) => r.replace(/\\/g, '/') !== normalized)].slice(0, 20);
    try {
      localStorage.setItem('recent_repos', JSON.stringify(updated));
    } catch {}
    set({ recentRepos: updated });
  },

  removeRecentRepo: (path) => {
    const { recentRepos, activeRepoPath } = get();
    const normalized = path.replace(/\\/g, '/');
    const updated = recentRepos.filter((r) => r.replace(/\\/g, '/') !== normalized);
    try {
      localStorage.setItem('recent_repos', JSON.stringify(updated));
    } catch {}
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
    } catch {}
    set({ repoAliases: updated });
  },

  setUser: (user) => {
    if (user) {
      try {
        localStorage.setItem('cached_user', JSON.stringify(user));
      } catch {}
      useLogStore.getState().addLog('info', 'Auth', `Active session user set to @${user.username} (${user.name}) [${user.provider}]`);
    } else {
      try {
        localStorage.removeItem('cached_user');
      } catch {}
      useLogStore.getState().addLog('info', 'Auth', `User session logged out`);
    }
    set((state) => ({ user, error: user ? null : state.error }));
  },
  setAccounts: (accounts) => set({ accounts }),
  setStatus: (status) => {
    const currentStaged = status ? status.files.filter(f => f.staged).map(f => f.path) : [];
    set({ status, stagedFiles: currentStaged });
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
  toggleStageFile: (file) => {
    const { stagedFiles } = get();
    const isStaged = stagedFiles.includes(file);
    if (isStaged) {
      useLogStore.getState().addLog('info', 'Git', `Unstaged file '${file}'`);
      set({ stagedFiles: stagedFiles.filter(f => f !== file) });
    } else {
      useLogStore.getState().addLog('info', 'Git', `Staged file '${file}'`);
      set({ stagedFiles: [...stagedFiles, file] });
    }
  },
  setAllStaged: (staged) => {
    const { status } = get();
    if (!status) return;
    if (staged) {
      useLogStore.getState().addLog('info', 'Git', `Staged all ${status.files.length} modified file(s)`);
    } else {
      useLogStore.getState().addLog('info', 'Git', `Unstaged all files`);
    }
    set({ stagedFiles: staged ? status.files.map(f => f.path) : [] });
  },
  setSelectedCommitSha: (sha) => {
    if (sha) {
      useLogStore.getState().addLog('info', 'Git', `Inspecting details for commit ${sha.slice(0, 8)}`);
    }
    set({ selectedCommitSha: sha });
  },
  setCommitSummary: (commitSummary) => set({ commitSummary }),
  setCommitDescription: (commitDescription) => set({ commitDescription }),
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
  setIsStashModalOpen: (isStashModalOpen) => set({ isStashModalOpen }),
  setIsTagsModalOpen: (isTagsModalOpen) => set({ isTagsModalOpen }),
  setIsBlameModalOpen: (isBlameModalOpen) => set({ isBlameModalOpen }),
  setIsReflogModalOpen: (isReflogModalOpen) => set({ isReflogModalOpen }),
  setIsConflictResolverModalOpen: (isConflictResolverModalOpen) => set({ isConflictResolverModalOpen }),
  setIsPatchModalOpen: (isPatchModalOpen) => set({ isPatchModalOpen }),
  setIsConfigModalOpen: (isConfigModalOpen) => set({ isConfigModalOpen }),
  setIsSubmodulesModalOpen: (isSubmodulesModalOpen) => set({ isSubmodulesModalOpen }),

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
