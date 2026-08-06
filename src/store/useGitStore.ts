import { create } from 'zustand';
import { RepoStatus, AppError } from '../types/git';
import { GitLabUser } from '../types/gitlab';

export type NavView = 'home' | 'projects' | 'groups' | 'work-items' | 'merge-requests' | 'todos' | 'workspace';

interface GitState {
  activeRepoPath: string | null;
  user: GitLabUser | null;
  status: RepoStatus | null;
  selectedFile: string | null;
  stagedFiles: string[];
  selectedCommitSha: string | null;
  commitSummary: string;
  commitDescription: string;
  activeTab: 'changes' | 'history';
  diffViewMode: 'split' | 'unified';
  currentNavView: NavView;
  isRepoModalOpen: boolean;
  isFetching: boolean;
  isPushing: boolean;
  isPulling: boolean;
  lastFetchedTimestamp: number | null;
  error: AppError | null;

  // Actions
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
  setDiffViewMode: (mode: 'split' | 'unified') => void;
  setCurrentNavView: (view: NavView) => void;
  setIsRepoModalOpen: (open: boolean) => void;
  setIsFetching: (fetching: boolean) => void;
  setIsPushing: (pushing: boolean) => void;
  setIsPulling: (pulling: boolean) => void;
  setLastFetchedTimestamp: (time: number | null) => void;
  setError: (error: AppError | null) => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  activeRepoPath: null,
  user: null,
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
  setUser: (user) => set({ user }),
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
  setIsFetching: (isFetching) => set({ isFetching }),
  setIsPushing: (isPushing) => set({ isPushing }),
  setIsPulling: (isPulling) => set({ isPulling }),
  setLastFetchedTimestamp: (lastFetchedTimestamp) => set({ lastFetchedTimestamp }),
  setError: (error) => set({ error }),
}));
