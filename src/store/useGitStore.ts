import { create } from 'zustand';
import { UnifiedUser, SavedAccount } from '../types/gitlab';
import { RepoStatus, AppError } from '../types/git';
import { useLogStore } from './useLogStore';

export type NavView = 'home' | 'projects' | 'groups' | 'work-items' | 'merge-requests' | 'todos' | 'workspace';

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

export interface GitState {
  activeRepoPath: string | null;
  recentRepos: string[];
  user: UnifiedUser | null;
  accounts: SavedAccount[];
  status: RepoStatus | null;
  selectedFile: string | null;
  stagedFiles: string[];
  selectedCommitSha: string | null;
  commitSummary: string;
  commitDescription: string;
  activeTab: 'changes' | 'history';
  diffViewMode: 'unified' | 'split';
  currentNavView: NavView;
  isRepoModalOpen: boolean;
  activeModalTab: 'accounts' | 'login' | 'repos';
  isFetching: boolean;
  isPushing: boolean;
  isPulling: boolean;
  lastFetchedTimestamp: number | null;
  error: AppError | null;

  setActiveRepoPath: (path: string | null) => void;
  addRecentRepo: (path: string) => void;
  removeRecentRepo: (path: string) => void;
  setUser: (user: UnifiedUser | null) => void;
  setAccounts: (accounts: SavedAccount[]) => void;
  setStatus: (status: RepoStatus | null) => void;
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
  user: getCachedUser(),
  accounts: [],
  status: null,
  selectedFile: null,
  stagedFiles: [],
  selectedCommitSha: null,
  commitSummary: '',
  commitDescription: '',
  activeTab: 'changes',
  diffViewMode: 'unified',
  currentNavView: getCachedActiveRepoPath() ? 'workspace' : 'home',
  isRepoModalOpen: false,
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
