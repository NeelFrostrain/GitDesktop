import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  GitBranch,
  GitPullRequest,
  Search,
  Plus,
  Check,
  ChevronDown,
  ChevronRight,
  X,
  Globe,
  Loader2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { useRemoteStore } from '../../store/remoteStore';
import { GitService } from '../../services/git/gitService';
import { PullRequestService, parseRemoteRepoInfo } from '../../services/git/pullRequestService';
import { RepoCacheService } from '../../services/git/repoCacheService';
import { BranchInfo, UnifiedMergeRequest } from '../../types/git';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { BranchCheckoutModal } from '../modals/BranchCheckoutModal';
import { Tabs } from '../common/Tabs';
import { Button } from '../common/Button';
import { useTaskStore } from '../../features/task-manager';

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const diffSeconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSeconds < 60) return 'just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

interface LocalBranchRowProps {
  branchItem: BranchInfo & { remoteTracking: string | null; remotePrefix: string | null };
  isCurrent: boolean;
  onSelect: (name: string) => void;
}

const LocalBranchRow = React.memo<LocalBranchRowProps>(({ branchItem, isCurrent, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(branchItem.name)}
      className={`group relative flex items-center justify-between gap-2 px-3 py-1.5 border-l-2 cursor-pointer transition-colors select-none ${
        isCurrent
          ? 'bg-base-2 border-l-commito-coral text-text-primary font-semibold shadow-2xs'
          : 'border-l-transparent text-text-muted hover:text-text-primary hover:bg-base-1/70'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          className={`w-5 h-5 rounded-xs flex items-center justify-center shrink-0 transition-colors ${
            isCurrent
              ? 'bg-commito-coral text-white shadow-xs'
              : 'bg-base-3 text-text-muted group-hover:bg-base-3/80 group-hover:text-text-primary'
          }`}
        >
          <GitBranch className="w-3 h-3" />
        </div>
        <div className="min-w-0 truncate font-mono text-xs">
          <span className="truncate block font-semibold leading-tight text-text-primary">
            {branchItem.name}
          </span>
          {branchItem.remoteTracking && (
            <span className="truncate block text-[9.5px] text-text-muted font-normal leading-tight">
              tracks {branchItem.remoteTracking}
            </span>
          )}
        </div>
      </div>

      {isCurrent ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded-xs bg-commito-coral text-white tracking-wider leading-none shadow-2xs select-none">
            CURRENT
          </span>
          <Check className="w-3.5 h-3.5 text-commito-coral shrink-0" />
        </div>
      ) : (
        <span className="text-[10.5px] font-sans font-semibold text-commito-coral opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-commito-coral/15 px-1.5 py-0.5 rounded-xs">
          <span>Switch</span>
          <ArrowRight className="w-2.5 h-2.5" />
        </span>
      )}
    </div>
  );
});

interface RemoteBranchRowProps {
  branchItem: BranchInfo;
  onSelect: (name: string) => void;
}

const RemoteBranchRow = React.memo<RemoteBranchRowProps>(({ branchItem, onSelect }) => {
  const slashIdx = branchItem.name.indexOf('/');
  const prefix = slashIdx !== -1 ? branchItem.name.slice(0, slashIdx + 1) : '';
  const nameWithoutPrefix =
    slashIdx !== -1 ? branchItem.name.slice(slashIdx + 1) : branchItem.name;

  return (
    <div
      onClick={() => onSelect(branchItem.name)}
      className="group relative flex items-center justify-between gap-2 px-3 py-1.5 border-l-2 border-l-transparent hover:bg-base-1/70 text-text-muted hover:text-text-primary cursor-pointer transition-colors select-none"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="w-5 h-5 rounded-xs bg-gitlab-blue/10 text-gitlab-blue flex items-center justify-center shrink-0 group-hover:bg-gitlab-blue/20 transition-colors">
          <Globe className="w-3 h-3" />
        </div>
        <div className="min-w-0 truncate font-mono text-xs">
          {prefix && (
            <span className="text-text-muted text-[11px] font-normal">
              {prefix}
            </span>
          )}
          <span className="text-text group-hover:text-text-primary font-semibold transition-colors">
            {nameWithoutPrefix}
          </span>
        </div>
      </div>

      <span className="text-[10px] font-sans font-medium text-gitlab-blue opacity-0 group-hover:opacity-100 transition-opacity bg-gitlab-blue/10 border border-gitlab-blue/30 px-1.5 py-0.5 rounded-xs">
        Checkout
      </span>
    </div>
  );
});

interface PullRequestRowProps {
  pr: UnifiedMergeRequest;
  isCurrent: boolean;
  provider?: string;
  onSelect: (pr: UnifiedMergeRequest) => void;
  onOpenBrowser: (url: string, e: React.MouseEvent) => void;
}

const PullRequestRow = React.memo<PullRequestRowProps>(
  ({ pr, isCurrent, provider, onSelect, onOpenBrowser }) => {
    const prNumber = pr.iid || pr.id;
    const numberPrefix = provider === 'github' ? '#' : '!';
    const isDraft =
      pr.is_draft ||
      pr.title.toLowerCase().startsWith('draft:') ||
      pr.title.toLowerCase().startsWith('wip:') ||
      pr.title.toLowerCase().startsWith('spec:');

    return (
      <div
        onClick={() => onSelect(pr)}
        className="group relative flex items-center justify-between gap-2.5 px-3 py-2 border-l-2 border-l-transparent hover:bg-base-1/70 text-text-muted hover:text-text-primary cursor-pointer transition-colors select-none"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`w-5 h-5 rounded-xs flex items-center justify-center shrink-0 ${
              isDraft
                ? 'bg-base-3 text-text-muted'
                : 'bg-git-added-bg text-git-added border border-git-added/30'
            }`}
          >
            <GitPullRequest className="w-3 h-3" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-mono text-xs font-semibold text-text-muted group-hover:text-commito-coral transition-colors shrink-0">
                {numberPrefix}
                {prNumber}
              </span>
              <span className="font-sans text-xs font-semibold text-text-primary truncate">
                {pr.title}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-text-faint mt-0.5 font-mono truncate">
              <span className="text-text-muted truncate max-w-[120px]">
                {pr.source_branch}
              </span>
              <span>→</span>
              <span className="text-text-muted truncate max-w-[120px]">
                {pr.target_branch}
              </span>
              {pr.author_name && (
                <>
                  <span>•</span>
                  <span className="text-text-muted truncate">
                    {pr.author_name}
                  </span>
                </>
              )}
              {pr.created_at && (
                <>
                  <span>•</span>
                  <span>{formatRelativeTime(pr.created_at)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isCurrent && (
            <span className="px-1.5 py-0.5 rounded-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-mono font-bold flex items-center gap-0.5">
              <span>CURRENT</span>
              <Check className="w-2.5 h-2.5" />
            </span>
          )}
          {pr.web_url && pr.web_url !== '#' && (
            <button
              type="button"
              onClick={(e) => onOpenBrowser(pr.web_url, e)}
              className="p-1 text-text-muted hover:text-text-primary rounded-sm hover:bg-base-2 transition opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Open in browser"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }
);

/**
 * Dropdown component displaying current branch, Branches vs. Pull Requests tabs,
 * search filtering, smooth branch checkout, and inline PR inspection.
 */
export const BranchDropdown: React.FC = () => {
  const {
    activeRepoPath,
    status,
    branches,
    setBranches,
    setError,
    setIsMergeRequestModalOpen,
    openMergeRequestModal,
    user,
  } = useGitStore(
    useShallow((s) => ({
      activeRepoPath: s.activeRepoPath,
      status: s.status,
      branches: s.branches,
      setBranches: s.setBranches,
      setError: s.setError,
      setIsMergeRequestModalOpen: s.setIsMergeRequestModalOpen,
      openMergeRequestModal: s.openMergeRequestModal,
      user: s.user,
    }))
  );
  const { remotes, activeRemote, loadRemotes } = useRemoteStore(
    useShallow((s) => ({
      remotes: s.remotes,
      activeRemote: s.activeRemote,
      loadRemotes: s.loadRemotes,
    }))
  );

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'branches' | 'pull-requests'>('branches');
  const [filterQuery, setFilterQuery] = useState('');
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingPRs, setIsLoadingPRs] = useState(false);
  const [pullRequests, setPullRequests] = useState<UnifiedMergeRequest[]>(() => {
    if (activeRepoPath) {
      const cached = RepoCacheService.getPullRequests(activeRepoPath);
      if (cached && cached.prs) return cached.prs;
    }
    return [];
  });
  const [prError, setPrError] = useState<string | null>(null);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  // New branch modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Pending target branch for safe checkout with uncommitted changes
  const [pendingTargetBranch, setPendingTargetBranch] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingBranchName, setSwitchingBranchName] = useState<string | null>(null);

  // Collapsible sections state (with persistence)
  const [isLocalCollapsed, setIsLocalCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('branch_dropdown_local_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isRemoteCollapsed, setIsRemoteCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('branch_dropdown_remote_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleLocalCollapsed = () => {
    setIsLocalCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('branch_dropdown_local_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const toggleRemoteCollapsed = () => {
    setIsRemoteCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('branch_dropdown_remote_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentBranch = status?.current_branch || 'main';
  const uncommittedFilesCount = status?.files?.length || 0;

  const currentPR = useMemo(() => {
    return pullRequests.find((pr) => pr.source_branch === currentBranch);
  }, [pullRequests, currentBranch]);

  const activeProjectPath = useMemo(() => {
    const remote = remotes.find((r) => r.name === activeRemote) || remotes[0];
    return parseRemoteRepoInfo(remote?.url || remote?.push_url)?.projectPath;
  }, [remotes, activeRemote]);

  const loadBranches = async () => {
    if (!activeRepoPath) return;
    const cached = RepoCacheService.getBranches(activeRepoPath);
    if (cached && cached.length > 0) {
      setBranches(cached);
      setIsLoadingBranches(false);
    } else if (branches.length === 0) {
      setIsLoadingBranches(true);
    }
    try {
      const res = await GitService.listBranches(activeRepoPath);
      if (res && res.length > 0) {
        RepoCacheService.setBranches(activeRepoPath, res);
        setBranches(res);
      }
    } catch {
      // Silently ignore background branch fetch errors
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const loadPullRequests = async () => {
    if (!activeRepoPath) return;
    const cached = RepoCacheService.getPullRequests(activeRepoPath);
    if (cached?.prs && cached.prs.length > 0) {
      setPullRequests(cached.prs);
      setIsLoadingPRs(false);
    } else if (pullRequests.length === 0) {
      setIsLoadingPRs(true);
    }
    setPrError(null);
    try {
      let currentRemotes = useRemoteStore.getState().remotes;
      if (currentRemotes.length === 0) {
        try {
          const direct = await GitService.listRemotes(activeRepoPath);
          if (direct && direct.length > 0) {
            currentRemotes = direct;
            useRemoteStore.setState({ remotes: direct });
          }
        } catch {}
      }

      if (currentRemotes.length === 0) {
        await loadRemotes(activeRepoPath);
        currentRemotes = useRemoteStore.getState().remotes;
      }

      const upstream = currentRemotes.find((r) => r.name.toLowerCase() === 'upstream');
      const origin = currentRemotes.find((r) => r.name.toLowerCase() === 'origin');
      const primaryRemote = upstream || currentRemotes.find((r) => r.name === activeRemote) || origin || currentRemotes[0];
      const primaryInfo = parseRemoteRepoInfo(primaryRemote?.url || primaryRemote?.push_url);

      if (!primaryInfo?.projectPath) {
        setPullRequests([]);
        return;
      }

      const projectPath = primaryInfo.projectPath;
      const serverUrl = primaryInfo.serverUrl;
      const provider =
        primaryInfo.provider !== 'unknown' ? primaryInfo.provider : user?.provider || 'github';

      const res = await PullRequestService.listOpenPullRequests(projectPath, serverUrl, provider);
      let combinedPRs = res || [];

      // If user also has another remote (e.g. origin fork vs upstream parent)
      const secondaryRemote = upstream ? (origin && origin !== upstream ? origin : null) : null;
      if (secondaryRemote) {
        const secInfo = parseRemoteRepoInfo(secondaryRemote.url || secondaryRemote.push_url);
        if (secInfo?.projectPath && secInfo.projectPath.toLowerCase() !== projectPath.toLowerCase()) {
          try {
            const secRes = await PullRequestService.listOpenPullRequests(
              secInfo.projectPath,
              secInfo.serverUrl,
              secInfo.provider !== 'unknown' ? secInfo.provider : provider
            );
            if (secRes && secRes.length > 0) {
              const existingIds = new Set(combinedPRs.map((p) => p.id));
              for (const p of secRes) {
                if (!existingIds.has(p.id)) {
                  combinedPRs.push(p);
                }
              }
            }
          } catch {}
        }
      }

      combinedPRs.sort((a, b) => Number(b.iid || b.id || 0) - Number(a.iid || a.id || 0));
      RepoCacheService.setPullRequests(activeRepoPath, combinedPRs);
      setPullRequests(combinedPRs);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      console.error('Error fetching pull requests:', err);
      setPrError(msg);
      if (pullRequests.length === 0) setPullRequests([]);
    } finally {
      setIsLoadingPRs(false);
    }
  };

  const [visibleLocalCount, setVisibleLocalCount] = useState(60);
  const [visibleRemoteCount, setVisibleRemoteCount] = useState(60);
  const [visiblePRCount, setVisiblePRCount] = useState(40);

  // Subscribe to background RepoCacheService updates for 0ms reactivity
  useEffect(() => {
    const unsubscribe = RepoCacheService.subscribe((repoPath, type, data) => {
      if (repoPath === activeRepoPath) {
        if (type === 'prs') {
          const prData = data as { prs: UnifiedMergeRequest[]; totalCount: number };
          setPullRequests(prData.prs);
          setIsLoadingPRs(false);
        } else if (type === 'branches') {
          setBranches(data as BranchInfo[]);
          setIsLoadingBranches(false);
        }
      }
    });
    return unsubscribe;
  }, [activeRepoPath, setBranches]);

  useEffect(() => {
    if (activeRepoPath) {
      const cachedPRs = RepoCacheService.getPullRequests(activeRepoPath);
      if (cachedPRs?.prs) {
        setPullRequests(cachedPRs.prs);
        setIsLoadingPRs(false);
      }
      const cachedBranches = RepoCacheService.getBranches(activeRepoPath);
      if (cachedBranches && cachedBranches.length > 0) {
        setBranches(cachedBranches);
        setIsLoadingBranches(false);
      }
    }
  }, [activeRepoPath, setBranches]);

  useEffect(() => {
    if (isOpen && activeRepoPath) {
      const cachedBranches = RepoCacheService.getBranches(activeRepoPath);
      if (!cachedBranches && branches.length === 0) {
        loadBranches();
      }
      const cachedPRs = RepoCacheService.getPullRequests(activeRepoPath);
      if (!cachedPRs && pullRequests.length === 0) {
        loadPullRequests();
      }
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, activeRepoPath, activeTab]);

  // Reset pagination when search query or tab changes
  useEffect(() => {
    setVisibleLocalCount(60);
    setVisibleRemoteCount(60);
    setVisiblePRCount(40);
  }, [filterQuery, activeTab]);

  const handleBranchListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      if (visibleRemoteCount < remoteOnlyBranches.length) {
        setVisibleRemoteCount((prev) => Math.min(prev + 60, remoteOnlyBranches.length));
      }
      if (visibleLocalCount < localBranches.length) {
        setVisibleLocalCount((prev) => Math.min(prev + 60, localBranches.length));
      }
    }
  };

  // Handle click outside to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => {
    if (triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  const handleSelectBranch = (branchName: string) => {
    setIsOpen(false);
    // If it's a remote branch name like 'origin/feat', target the clean branch name
    const cleanBranch =
      branchName.includes('/') && !localBranchNames.has(branchName)
        ? getCleanRemoteBranchName(branchName)
        : branchName;

    if (cleanBranch === currentBranch) return;

    if (uncommittedFilesCount > 0) {
      setPendingTargetBranch(cleanBranch);
    } else {
      executeDirectCheckout(cleanBranch);
    }
  };

  const handleSelectPullRequest = (pr: UnifiedMergeRequest) => {
    setIsOpen(false);
    openMergeRequestModal('list', String(pr.id));
  };

  const executeDirectCheckout = async (branchName: string) => {
    if (!activeRepoPath) return;
    setIsSwitching(true);
    setSwitchingBranchName(branchName);

    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';
    const taskId = useTaskStore.getState().addTask({
      type: 'checkout',
      title: `Switch to ${branchName}`,
      repoName,
      localPath: activeRepoPath,
      cancellable: false,
    });

    try {
      useTaskStore.getState().updateTaskProgress(taskId, {
        stage: 'Checking out',
        percent: 35,
        detail: `Resolving ref & checking out ${branchName}...`,
      });

      await GitService.checkoutBranch(activeRepoPath, branchName);

      useTaskStore.getState().updateTaskProgress(taskId, {
        stage: 'Finalizing',
        percent: 90,
        detail: 'Syncing repository state...',
      });

      useLogStore.getState().addLog('success', 'Git', `Checked out branch '${branchName}'`);

      await useGitStore.getState().reloadActiveRepo();

      useTaskStore.getState().completeTask(taskId);
    } catch (error: unknown) {
      const errMsg = getErrorMessage(error);
      useTaskStore.getState().failTask(taskId, errMsg);
      setError(toAppError(error, 'CHECKOUT_ERROR'));
    } finally {
      setIsSwitching(false);
      setSwitchingBranchName(null);
    }
  };

  const handleCreateBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !newBranchName.trim()) return;
    setIsCreating(true);

    try {
      await GitService.createBranch(activeRepoPath, newBranchName.trim());
      useLogStore
        .getState()
        .addLog('success', 'Git', `Created branch '${newBranchName.trim()}' and checked out`);
      setNewBranchName('');
      setShowCreateModal(false);

      await useGitStore.getState().reloadActiveRepo();
    } catch (error: unknown) {
      setError(toAppError(error, 'CREATE_BRANCH_ERROR'));
    } finally {
      setIsCreating(false);
    }
  };

  // Branch Filtering & Deduplication helpers
  const getCleanRemoteBranchName = (remoteBranchName: string): string => {
    const slashIdx = remoteBranchName.indexOf('/');
    return slashIdx !== -1 ? remoteBranchName.slice(slashIdx + 1) : remoteBranchName;
  };

  const queryLower = filterQuery.trim().toLowerCase();

  // 1. All valid remote branches (excluding symbolic refs like origin/HEAD)
  const validRemoteBranches = useMemo(() => {
    return branches.filter((b: BranchInfo) => b.is_remote && !b.name.endsWith('/HEAD'));
  }, [branches]);

  // 2. Fast O(1) Map for remote branch names -> clean name and prefix
  const remoteBranchMap = useMemo(() => {
    const map = new Map<string, { fullName: string; prefix: string }>();
    for (let i = 0; i < validRemoteBranches.length; i++) {
      const b = validRemoteBranches[i];
      const slashIdx = b.name.indexOf('/');
      const clean = slashIdx !== -1 ? b.name.slice(slashIdx + 1) : b.name;
      const prefix = slashIdx !== -1 ? b.name.slice(0, slashIdx) : 'origin';
      if (!map.has(clean)) {
        map.set(clean, { fullName: b.name, prefix });
      }
    }
    return map;
  }, [validRemoteBranches]);

  // 3. Set of local branch names
  const localBranchNames = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < branches.length; i++) {
      if (!branches[i].is_remote) set.add(branches[i].name);
    }
    return set;
  }, [branches]);

  // 4. Local branches with O(1) remote tracking lookup
  const localBranches = useMemo(() => {
    const list: (BranchInfo & { remoteTracking: string | null; remotePrefix: string | null })[] = [];
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i];
      if (b.is_remote) continue;
      if (queryLower && !b.name.toLowerCase().includes(queryLower)) continue;

      const remoteMeta = remoteBranchMap.get(b.name);
      list.push({
        ...b,
        remoteTracking: remoteMeta ? remoteMeta.fullName : null,
        remotePrefix: remoteMeta ? remoteMeta.prefix : null,
      });
    }
    return list;
  }, [branches, remoteBranchMap, queryLower]);

  // 5. Remote-only branches (remote branches that do not exist locally) with O(1) check
  const remoteOnlyBranches = useMemo(() => {
    const list: BranchInfo[] = [];
    for (let i = 0; i < validRemoteBranches.length; i++) {
      const b = validRemoteBranches[i];
      const slashIdx = b.name.indexOf('/');
      const clean = slashIdx !== -1 ? b.name.slice(slashIdx + 1) : b.name;
      if (localBranchNames.has(clean)) continue;
      if (queryLower && !b.name.toLowerCase().includes(queryLower)) continue;
      list.push(b);
    }
    return list;
  }, [validRemoteBranches, localBranchNames, queryLower]);

  const displayedLocalBranches = useMemo(() => {
    return localBranches.slice(0, visibleLocalCount);
  }, [localBranches, visibleLocalCount]);

  const displayedRemoteBranches = useMemo(() => {
    return remoteOnlyBranches.slice(0, visibleRemoteCount);
  }, [remoteOnlyBranches, visibleRemoteCount]);

  // Pull Requests Filtering
  const filteredPullRequests = useMemo(() => {
    if (!queryLower) return pullRequests;
    return pullRequests.filter((pr) => {
      const idStr = String(pr.iid || pr.id || '');
      return (
        pr.title.toLowerCase().includes(queryLower) ||
        idStr.includes(queryLower) ||
        pr.source_branch.toLowerCase().includes(queryLower) ||
        pr.target_branch.toLowerCase().includes(queryLower) ||
        pr.author_name.toLowerCase().includes(queryLower)
      );
    });
  }, [pullRequests, queryLower]);

  const displayedPullRequests = useMemo(() => {
    return filteredPullRequests.slice(0, visiblePRCount);
  }, [filteredPullRequests, visiblePRCount]);

  const handlePRListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 100) {
      if (visiblePRCount < filteredPullRequests.length) {
        setVisiblePRCount((prev) => Math.min(prev + 40, filteredPullRequests.length));
      }
    }
  };

  const totalOpenPRCount = useMemo(() => {
    return pullRequests[0]?.total_count || pullRequests.length;
  }, [pullRequests]);

  const resolvedPRRepoName = useMemo(() => {
    return pullRequests[0]?.repo_full_name || activeProjectPath || 'repository';
  }, [pullRequests, activeProjectPath]);

  const menuWidth = 390;
  const leftPos = triggerRect
    ? Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - 12)
    : 0;
  const topPos = triggerRect ? triggerRect.bottom + 6 : 0;

  const isCurrentPR = (sourceBranch: string) => sourceBranch === currentBranch;

  return (
    <>
      {/* Trigger Button */}
      {isSwitching ? (
        <div
          className="h-6.5 px-2 rounded-xs bg-base-2 border border-border text-text-primary inline-flex items-center gap-1.5 select-none leading-none max-w-[220px]"
          title={`Switching to branch ${switchingBranchName || ''}`}
        >
          <Loader2 className="w-3.5 h-3.5 text-commito-coral animate-spin shrink-0" />
          <span className="text-[11px] text-text-muted shrink-0 font-medium font-sans">Switching:</span>
          <span className="truncate font-mono text-xs font-semibold text-text-primary">
            {switchingBranchName || '...'}
          </span>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          className={`h-6.5 px-2 rounded-xs transition-colors duration-150 flex items-center gap-1.5 cursor-pointer select-none group ${
            isOpen
              ? 'bg-base-2 text-text-primary font-semibold'
              : 'text-text-secondary hover:text-text-primary hover:bg-base-2'
          }`}
          title={`Current branch: ${currentBranch}`}
        >
          <GitBranch className="w-3.5 h-3.5 text-commito-coral shrink-0" />
          <span className="truncate max-w-[130px] font-mono text-xs font-semibold text-zinc-100 group-hover:text-commito-coral transition-colors">
            {currentBranch}
          </span>

          {currentPR && (
            <span className="inline-flex items-center gap-1 text-[9.5px] font-mono font-semibold px-1 py-0.2 rounded-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 leading-none">
              <span>#{currentPR.iid || currentPR.id}</span>
              <Check className="w-2.5 h-2.5 text-emerald-400" />
            </span>
          )}

          <ChevronDown
            className={`w-3 h-3 text-zinc-400 group-hover:text-zinc-200 transition-transform duration-150 shrink-0 ${
              isOpen ? 'rotate-180 text-commito-coral' : ''
            }`}
          />
        </button>
      )}

      {/* Dropdown Menu Portal */}
      {isOpen &&
        triggerRect &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              left: `${leftPos}px`,
              top: `${topPos}px`,
              width: `${menuWidth}px`,
            }}
            className="fixed z-[9999] bg-base-0 border border-border-strong/90 rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[520px] text-xs font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100 select-none ring-1 ring-black/40"
          >
            {/* Header: Segmented Tabs & Action Button */}
            <div className="p-2.5 border-b border-border/70 bg-base-0 flex items-center justify-between gap-2 shrink-0">
              {/* Segmented Tab Pill */}
              <div className="flex-1">
                <Tabs<'branches' | 'pull-requests'>
                  tabs={[
                    {
                      id: 'branches',
                      label: 'Branches',
                      icon: (
                        <GitBranch
                          className={`w-3.5 h-3.5 shrink-0 ${
                            activeTab === 'branches' ? 'text-commito-coral' : 'text-text-muted'
                          }`}
                        />
                      ),
                      badge: isLoadingBranches ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-commito-coral" />
                      ) : (
                        branches.filter((b) => !b.is_remote).length
                      ),
                      badgeVariant: 'coral',
                    },
                    {
                      id: 'pull-requests',
                      label: 'Pull requests',
                      icon: (
                        <GitPullRequest
                          className={`w-3.5 h-3.5 shrink-0 ${
                            activeTab === 'pull-requests' ? 'text-emerald-400' : 'text-text-muted'
                          }`}
                        />
                      ),
                      badge: isLoadingPRs ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-emerald-400" />
                      ) : totalOpenPRCount > 0 ? (
                        totalOpenPRCount
                      ) : undefined,
                      badgeVariant: 'emerald',
                    },
                  ]}
                  activeTab={activeTab}
                  onChange={(tab) => {
                    setActiveTab(tab);
                    setFilterQuery('');
                    if (tab === 'pull-requests' && pullRequests.length === 0) loadPullRequests();
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  fullWidth
                  size="sm"
                  ariaLabel="Branch and Pull Request navigation tabs"
                />
              </div>

              {/* Action Button: New Branch vs. New PR */}
              {activeTab === 'branches' ? (
                <Button
                  type="button"
                  variant="coral"
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  title="Create new branch from HEAD"
                >
                  New
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="coral"
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                    setIsMergeRequestModalOpen(true);
                  }}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  title="Create Pull Request / Merge Request"
                >
                  New PR
                </Button>
              )}
            </div>

            {/* Clean Filter Search Bar */}
            <div className="p-2.5 border-b border-border/50 bg-base-0 flex items-center gap-1.5 shrink-0">
              <div className="relative flex items-center flex-1">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={
                    activeTab === 'branches' ? 'Filter branches...' : 'Filter pull requests...'
                  }
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-7 bg-base-1/70 hover:bg-base-1 focus:bg-base-1 border border-border/60 hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text placeholder:text-text-muted focus:outline-none font-sans transition-all shadow-xs"
                />
                {filterQuery && (
                  <button
                    type="button"
                    onClick={() => setFilterQuery('')}
                    className="absolute right-2 p-0.5 text-text-muted hover:text-text hover:bg-base-2 rounded-sm transition cursor-pointer"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {activeTab === 'pull-requests' && (
                <button
                  type="button"
                  onClick={loadPullRequests}
                  disabled={isLoadingPRs}
                  className="h-8 w-8 flex items-center justify-center rounded-sm bg-base-1/70 hover:bg-base-2 border border-border/60 hover:border-border-strong text-text-muted hover:text-text transition shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                  title="Refresh pull requests"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoadingPRs ? 'animate-spin text-emerald-400' : ''}`}
                  />
                </button>
              )}
            </div>

            {/* Tab Body: Branches View */}
            {activeTab === 'branches' && (
              <div
                onScroll={handleBranchListScroll}
                className="flex-1 overflow-y-auto p-2 space-y-2.5 min-h-0 scrollbar-thin"
              >
                {/* Local Branches Section */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={toggleLocalCollapsed}
                    className="px-1.5 py-1 w-full flex items-center justify-between select-none rounded-sm hover:bg-base-1/80 transition-colors cursor-pointer group"
                    title={
                      isLocalCollapsed && !filterQuery
                        ? 'Expand Local Branches'
                        : 'Collapse Local Branches'
                    }
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted/80 group-hover:text-text-primary flex items-center gap-1.5 transition-colors">
                      <ChevronRight
                        className={`w-3 h-3 text-text-muted group-hover:text-commito-coral transition-transform duration-150 ${
                          !isLocalCollapsed || filterQuery ? 'rotate-90 text-commito-coral' : ''
                        }`}
                      />
                      <GitBranch className="w-3 h-3 text-text-faint" />
                      <span>Local Branches</span>
                    </span>
                    <span className="text-[9.5px] font-mono font-medium px-1.5 py-0.2 rounded-sm bg-base-2 text-text-muted border border-border/50">
                      {localBranches.length}
                    </span>
                  </button>

                  {(!isLocalCollapsed || Boolean(filterQuery.trim())) &&
                    (localBranches.length === 0 ? (
                      <div className="py-4 px-3 text-center text-text-muted text-xs italic bg-base-1/40 rounded-sm border border-border/40">
                        {filterQuery
                          ? `No local branches match "${filterQuery}"`
                          : 'No local branches.'}
                      </div>
                    ) : (
                      <div className="flex flex-col -mx-2">
                        {displayedLocalBranches.map((branchItem) => (
                          <LocalBranchRow
                            key={branchItem.name}
                            branchItem={branchItem}
                            isCurrent={branchItem.name === currentBranch}
                            onSelect={handleSelectBranch}
                          />
                        ))}
                        {localBranches.length > visibleLocalCount && (
                          <button
                            type="button"
                            onClick={() =>
                              setVisibleLocalCount((c) => Math.min(c + 60, localBranches.length))
                            }
                            className="w-full py-1.5 text-center text-[10.5px] font-mono text-commito-coral hover:bg-base-1/80 rounded-sm cursor-pointer transition select-none"
                          >
                            Show more ({localBranches.length - visibleLocalCount} remaining)...
                          </button>
                        )}
                      </div>
                    ))}
                </div>

                {/* Remote Branches Section */}
                <div className="space-y-1 pt-2 border-t border-border/50">
                  <button
                    type="button"
                    onClick={toggleRemoteCollapsed}
                    className="px-1.5 py-1 w-full flex items-center justify-between select-none rounded-sm hover:bg-base-1/80 transition-colors cursor-pointer group"
                    title={
                      isRemoteCollapsed && !filterQuery
                        ? 'Expand Remote Branches'
                        : 'Collapse Remote Branches'
                    }
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted/80 group-hover:text-text-primary flex items-center gap-1.5 transition-colors">
                      <ChevronRight
                        className={`w-3 h-3 text-text-muted group-hover:text-gitlab-blue transition-transform duration-150 ${
                          !isRemoteCollapsed || filterQuery ? 'rotate-90 text-gitlab-blue' : ''
                        }`}
                      />
                      <Globe className="w-3 h-3 text-gitlab-blue/70" />
                      <span>Remote Branches</span>
                    </span>
                    <span className="text-[9.5px] font-mono font-medium px-1.5 py-0.2 rounded-sm bg-base-2 text-text-muted border border-border/50">
                      {remoteOnlyBranches.length}
                    </span>
                  </button>

                  {(!isRemoteCollapsed || Boolean(filterQuery.trim())) &&
                    (remoteOnlyBranches.length === 0 ? (
                      <div className="py-2.5 px-3 text-center text-text-muted text-[11px] bg-base-1/30 rounded-sm border border-border/30 flex items-center justify-center gap-1.5 font-sans select-none">
                        {filterQuery ? (
                          <span>No remote-only branches match "{filterQuery}"</span>
                        ) : (
                          <>
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>All remote branches are tracked locally</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col -mx-2">
                        {displayedRemoteBranches.map((remoteBranchItem: BranchInfo) => (
                          <RemoteBranchRow
                            key={remoteBranchItem.name}
                            branchItem={remoteBranchItem}
                            onSelect={handleSelectBranch}
                          />
                        ))}
                        {remoteOnlyBranches.length > visibleRemoteCount && (
                          <button
                            type="button"
                            onClick={() =>
                              setVisibleRemoteCount((c) =>
                                Math.min(c + 60, remoteOnlyBranches.length)
                              )
                            }
                            className="w-full py-1.5 text-center text-[10.5px] font-mono text-gitlab-blue hover:bg-base-1/80 rounded-sm cursor-pointer transition select-none"
                          >
                            Show more ({remoteOnlyBranches.length - visibleRemoteCount} remaining)...
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Tab Body: Pull Requests View */}
            {activeTab === 'pull-requests' && (
              <div
                onScroll={handlePRListScroll}
                className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0 scrollbar-thin"
              >
                {isLoadingPRs && pullRequests.length === 0 ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-text-muted">
                    <Loader2 className="w-5 h-5 animate-spin text-commito-coral" />
                    <span className="text-[11.5px] font-medium text-text-secondary">
                      Loading open pull requests...
                    </span>
                  </div>
                ) : prError ? (
                  <div className="py-6 px-3 bg-base-1/50 rounded border border-border text-center space-y-2 select-none">
                    <AlertCircle className="w-6 h-6 text-amber-400 mx-auto opacity-80" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-text-primary">
                        {prError.includes('Not Found') || prError.includes('404')
                          ? 'Repository Not Found or Private'
                          : 'Unable to Load Pull Requests'}
                      </p>
                      <p className="text-[11px] text-text-muted max-w-[270px] mx-auto leading-relaxed">
                        {prError}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={loadPullRequests}
                      className="px-2.5 py-1 bg-base-2 hover:bg-base-3 border border-border rounded text-[11px] font-semibold text-text-primary inline-flex items-center gap-1 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  </div>
                ) : filteredPullRequests.length === 0 ? (
                  <div className="py-8 px-3 text-center space-y-2 select-none">
                    <div className="w-8 h-8 rounded-full bg-base-2 border border-border flex items-center justify-center mx-auto text-text-muted">
                      <GitPullRequest className="w-4 h-4 opacity-50" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-text-primary">
                        {filterQuery ? 'No matching pull requests' : 'No Open Pull Requests'}
                      </p>
                      <p className="text-[11px] text-text-muted max-w-[270px] mx-auto leading-relaxed">
                        {filterQuery
                          ? `No open pull requests matching "${filterQuery}"`
                          : 'There are no open pull requests or merge requests found for this remote.'}
                      </p>
                    </div>
                    {!filterQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          setIsMergeRequestModalOpen(true);
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-commito-coral/15 hover:bg-commito-coral border border-commito-coral/40 text-commito-coral hover:text-white rounded-sm text-xs font-semibold shadow-xs transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Pull Request</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Section Header with dynamic Count and resolved parent repository */}
                    <div className="px-1.5 pt-0.5 pb-1 flex items-center justify-between text-[10.5px] font-semibold text-text-muted select-none">
                      <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
                        <span className="shrink-0">Pull requests in</span>
                        <span
                          className="text-text-primary font-mono truncate"
                          title={resolvedPRRepoName}
                        >
                          {resolvedPRRepoName}
                        </span>
                      </div>
                      <span className="font-mono text-[9.5px] px-1.5 py-0.2 rounded-xs bg-base-2 text-text-muted border border-border/50 shrink-0 ml-2">
                        {filterQuery
                          ? `${filteredPullRequests.length} of ${totalOpenPRCount}`
                          : `${totalOpenPRCount} open`}
                      </span>
                    </div>

                    <div className="space-y-1.5 p-0.5">
                      {displayedPullRequests.map((pr) => (
                        <PullRequestRow
                          key={pr.id}
                          pr={pr}
                          isCurrent={isCurrentPR(pr.source_branch)}
                          provider={user?.provider || 'github'}
                          onSelect={handleSelectPullRequest}
                          onOpenBrowser={(url, e) => {
                            e.stopPropagation();
                            openUrl(url).catch(() => {});
                          }}
                        />
                      ))}

                      {filteredPullRequests.length > visiblePRCount && (
                        <button
                          type="button"
                          onClick={() =>
                            setVisiblePRCount((c) => Math.min(c + 40, filteredPullRequests.length))
                          }
                          className="w-full py-1.5 text-center text-[10.5px] font-mono text-commito-coral hover:bg-base-1/80 rounded-sm cursor-pointer transition select-none"
                        >
                          Show more ({filteredPullRequests.length - visiblePRCount} remaining)...
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body
        )}

      {/* Create New Branch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-10000 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
          <form
            onSubmit={handleCreateBranchSubmit}
            className="bg-base-0 border border-border-strong rounded-sm shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/40"
          >
            {/* Compact 1-Row Header */}
            <div className="px-3.5 py-2 bg-base-1 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0">
                  <GitBranch className="w-3 h-3" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="text-xs font-bold text-text-primary leading-none">
                    Create Branch
                  </h3>
                  <span className="text-border">•</span>
                  <span className="text-[10.5px] text-text-muted font-mono truncate">
                    from <span className="text-commito-coral font-semibold">{currentBranch}</span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-sm hover:bg-base-2 transition cursor-pointer shrink-0"
                title="Close (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Compact Body */}
            <div className="p-3.5 space-y-2">
              <div>
                <label className="text-[11px] font-semibold text-text-primary block mb-1">
                  Branch Name
                </label>
                <div className="relative flex items-center">
                  <GitBranch className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. feature/new-workflow"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="w-full h-7.5 pl-8 pr-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none transition font-mono shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Slim Footer */}
            <div className="px-3.5 py-1.5 min-h-[38px] bg-base-1/50 border-t border-border flex items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="coral"
                size="sm"
                disabled={!newBranchName.trim() || isCreating}
                isLoading={isCreating}
              >
                Create & Checkout
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Uncommitted Changes Checkout Modal */}
      {pendingTargetBranch && (
        <BranchCheckoutModal
          isOpen={Boolean(pendingTargetBranch)}
          targetBranch={pendingTargetBranch}
          currentBranch={currentBranch}
          uncommittedCount={uncommittedFilesCount}
          onClose={() => setPendingTargetBranch(null)}
          onSuccess={() => {
            setPendingTargetBranch(null);
            loadBranches();
          }}
        />
      )}
    </>
  );
};
