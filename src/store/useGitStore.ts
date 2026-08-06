import { create } from 'zustand';
import { GitLabUser } from '../types/gitlab';
import { RepoStatus, AppError } from '../types/git';

export type NavView = 'home' | 'projects' | 'groups' | 'work-items' | 'merge-requests' | 'todos' | 'workspace';

const getCachedUser = (): GitLabUser | null => {
  try {
    const cached = localStorage.getItem('cached_gitlab_user');
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

export interface GitState {
  activeRepoPath: string | null;
  user: GitLabUser | null;
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
  activeModalTab: 'login' | 'repos';
  isFetching: boolean;
  isPushing: boolean;
  isPulling: boolean;
  lastFetchedTimestamp: number | null;
  error: AppError | null;

  setActiveRepoPath: (path: string | null) => void;
  setUser: (user: GitLabUser | null) => void;
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
  setActiveModalTab: (tab: 'login' | 'repos') => void;
  setIsFetching: (fetching: boolean) => void;
  setIsPushing: (pushing: boolean) => void;
  setIsPulling: (pulling: boolean) => void;
  setLastFetchedTimestamp: (time: number | null) => void;
  setError: (error: AppError | null) => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  activeRepoPath: null,
  user: getCachedUser(),
  status: null,
  selectedFile: null,
  stagedFiles: [],
  selectedCommitSha: null,
  commitSummary: '',
  commitDescription: '',
  activeTab: 'changes',
  diffViewMode: 'unified',
  currentNavView: 'home',
  isRepoModalOpen: false,
  activeModalTab: 'login',
  isFetching: false,
  isPushing: false,
  isPulling: false,
  lastFetchedTimestamp: null,
  error: null,

  setActiveRepoPath: (path) => set({ 
    activeRepoPath: path,
    selectedFile: null,
    selectedCommitSha: null,
    stagedFiles: [],
    currentNavView: path ? 'workspace' : 'home'
  }),
  setUser: (user) => {
    if (user) {
      try {
        localStorage.setItem('cached_gitlab_user', JSON.stringify(user));
      } catch {}
    } else {
      try {
        localStorage.removeItem('cached_gitlab_user');
      } catch {}
    }
    set((state) => ({ user, error: user ? null : state.error }));
  },
  setStatus: (status) => {
    const currentStaged = status ? status.files.filter(f => f.staged).map(f => f.path) : [];
    set({ status, stagedFiles: currentStaged });
  },
  setSelectedFile: (file) => set({ selectedFile: file }),
  toggleStageFile: (file) => {
    const { stagedFiles } = get();
    if (stagedFiles.includes(file)) {
      set({ stagedFiles: stagedFiles.filter(f => f !== file) });
    } else {
      set({ stagedFiles: [...stagedFiles, file] });
    }
  },
  setAllStaged: (staged) => {
    const { status } = get();
    if (!status) return;
    set({ stagedFiles: staged ? status.files.map(f => f.path) : [] });
  },
  setSelectedCommitSha: (sha) => set({ selectedCommitSha: sha }),
  setCommitSummary: (commitSummary) => set({ commitSummary }),
  setCommitDescription: (commitDescription) => set({ commitDescription }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setDiffViewMode: (diffViewMode) => set({ diffViewMode }),
  setCurrentNavView: (currentNavView) => set({ currentNavView }),
  setIsRepoModalOpen: (isRepoModalOpen) => set({ isRepoModalOpen }),
  setActiveModalTab: (activeModalTab) => set({ activeModalTab }),
  setIsFetching: (isFetching) => set({ isFetching }),
  setIsPushing: (isPushing) => set({ isPushing }),
  setIsPulling: (isPulling) => set({ isPulling }),
  setLastFetchedTimestamp: (lastFetchedTimestamp) => set({ lastFetchedTimestamp }),
  setError: (error) => set({ error }),
}));
