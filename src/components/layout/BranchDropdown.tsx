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
  User,
  GitFork,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { useRemoteStore } from '../../store/remoteStore';
import { GitService } from '../../services/git/gitService';
import { PullRequestService, parseRemoteRepoInfo } from '../../services/git/pullRequestService';
import { BranchInfo, UnifiedMergeRequest } from '../../types/git';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { BranchCheckoutModal } from '../modals/BranchCheckoutModal';
import { Tabs } from '../common/Tabs';
import { Button } from '../common/Button';

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

/**
 * Dropdown component displaying current branch, Branches vs. Pull Requests tabs,
 * search filtering, smooth branch checkout, and inline PR inspection.
 */
export const BranchDropdown: React.FC = () => {
  const {
    activeRepoPath,
    status,
    setStatus,
    branches,
    setBranches,
    setError,
    setIsMergeRequestModalOpen,
    openMergeRequestModal,
    user,
  } = useGitStore();
  const { remotes, activeRemote, loadRemotes } = useRemoteStore();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'branches' | 'pull-requests'>('branches');
  const [filterQuery, setFilterQuery] = useState('');
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingPRs, setIsLoadingPRs] = useState(false);
  const [pullRequests, setPullRequests] = useState<UnifiedMergeRequest[]>([]);
  const [prError, setPrError] = useState<string | null>(null);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  // New branch modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Pending target branch for safe checkout with uncommitted changes
  const [pendingTargetBranch, setPendingTargetBranch] = useState<string | null>(null);

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
    setIsLoadingBranches(true);
    try {
      const res = await GitService.listBranches(activeRepoPath);
      setBranches(res || []);
    } catch {
      // Silently ignore background branch fetch errors
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const loadPullRequests = async () => {
    if (!activeRepoPath) return;
    setIsLoadingPRs(true);
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

      const remote = currentRemotes.find((r) => r.name === activeRemote) || currentRemotes[0];
      const remoteInfo = parseRemoteRepoInfo(remote?.url || remote?.push_url);

      if (!remoteInfo?.projectPath) {
        setPullRequests([]);
        return;
      }

      const projectPath = remoteInfo.projectPath;
      const serverUrl = remoteInfo.serverUrl;
      const provider = remoteInfo.provider !== 'unknown' ? remoteInfo.provider : user?.provider || 'github';

      const res = await PullRequestService.listOpenPullRequests(projectPath, serverUrl, provider);
      setPullRequests(res || []);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      console.error('Error fetching pull requests:', err);
      setPrError(msg);
      setPullRequests([]);
    } finally {
      setIsLoadingPRs(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeRepoPath) {
      loadBranches();
      loadPullRequests();
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, activeRepoPath]);

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
    const cleanBranch = branchName.includes('/') && !localBranchNames.has(branchName)
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
    try {
      await GitService.checkoutBranch(activeRepoPath, branchName);
      useLogStore.getState().addLog('success', 'Git', `Checked out branch '${branchName}'`);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      loadBranches();
    } catch (error: unknown) {
      setError(toAppError(error, 'CHECKOUT_ERROR'));
    }
  };

  const handleCreateBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !newBranchName.trim()) return;
    setIsCreating(true);

    try {
      await GitService.createBranch(activeRepoPath, newBranchName.trim());
      useLogStore.getState().addLog('success', 'Git', `Created branch '${newBranchName.trim()}' and checked out`);
      setNewBranchName('');
      setShowCreateModal(false);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      loadBranches();
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

  const getRemotePrefix = (remoteBranchName: string): string => {
    const slashIdx = remoteBranchName.indexOf('/');
    return slashIdx !== -1 ? remoteBranchName.slice(0, slashIdx) : 'origin';
  };

  const queryLower = filterQuery.trim().toLowerCase();

  // 1. All valid remote branches (excluding symbolic refs like origin/HEAD)
  const validRemoteBranches = useMemo(() => {
    return branches.filter((b: BranchInfo) => b.is_remote && !b.name.endsWith('/HEAD'));
  }, [branches]);

  // 2. Set of local branch names
  const localBranchNames = useMemo(() => {
    return new Set(
      branches
        .filter((b: BranchInfo) => !b.is_remote)
        .map((b: BranchInfo) => b.name)
    );
  }, [branches]);

  // 3. Local branches merged with remote tracking indicator
  const localBranches = useMemo(() => {
    return branches
      .filter((b: BranchInfo) => !b.is_remote)
      .filter((b: BranchInfo) => b.name.toLowerCase().includes(queryLower))
      .map((b: BranchInfo) => {
        const matchingRemote = validRemoteBranches.find((r: BranchInfo) => {
          return getCleanRemoteBranchName(r.name) === b.name;
        });

        return {
          ...b,
          remoteTracking: matchingRemote ? matchingRemote.name : null,
          remotePrefix: matchingRemote ? getRemotePrefix(matchingRemote.name) : null,
        };
      });
  }, [branches, validRemoteBranches, queryLower]);

  // 4. Remote-only branches (remote branches that do not exist locally)
  const remoteOnlyBranches = useMemo(() => {
    return validRemoteBranches
      .filter((b: BranchInfo) => {
        const clean = getCleanRemoteBranchName(b.name);
        return !localBranchNames.has(clean);
      })
      .filter((b: BranchInfo) => b.name.toLowerCase().includes(queryLower));
  }, [validRemoteBranches, localBranchNames, queryLower]);

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

  const menuWidth = 390;
  const leftPos = triggerRect
    ? Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - 12)
    : 0;
  const topPos = triggerRect ? triggerRect.bottom + 6 : 0;

  const isCurrentPR = (sourceBranch: string) => sourceBranch === currentBranch;

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={`h-7.5 px-2.5 rounded-sm border transition-all duration-150 flex items-center gap-1.5 cursor-pointer select-none shadow-2xs active:scale-95 group ${
          isOpen
            ? 'bg-base-2 border-commito-coral text-text-primary ring-1 ring-commito-coral/20'
            : 'bg-base-1 hover:bg-base-2 active:bg-base-3 border-border hover:border-border-strong text-text-primary'
        }`}
        title={`Current branch: ${currentBranch}`}
      >
        <GitBranch className="w-3.5 h-3.5 text-commito-coral shrink-0 group-hover:scale-105 transition-transform" />
        <span className="truncate max-w-[130px] font-mono text-xs font-semibold text-zinc-100 group-hover:text-commito-coral transition-colors">
          {currentBranch}
        </span>

        {currentPR && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 leading-none">
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
                      ) : pullRequests.length > 0 ? (
                        pullRequests.length
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
                    activeTab === 'branches'
                      ? 'Filter branches...'
                      : 'Filter pull requests...'
                  }
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-7 bg-base-1/70 hover:bg-base-1 focus:bg-base-1 border border-border/60 hover:border-border-strong focus:border-commito-coral/70 focus:ring-1 focus:ring-commito-coral/20 rounded-sm text-xs text-text placeholder:text-text-muted focus:outline-none font-sans transition-all shadow-xs"
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
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPRs ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              )}
            </div>

            {/* Tab Body: Branches View */}
            {activeTab === 'branches' && (
              <div className="flex-1 overflow-y-auto p-2 space-y-2.5 min-h-0 scrollbar-thin">
                {/* Local Branches Section */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={toggleLocalCollapsed}
                    className="px-1.5 py-1 w-full flex items-center justify-between select-none rounded-sm hover:bg-base-1/80 transition-colors cursor-pointer group"
                    title={isLocalCollapsed && !filterQuery ? 'Expand Local Branches' : 'Collapse Local Branches'}
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

                  {(!isLocalCollapsed || Boolean(filterQuery.trim())) && (
                    localBranches.length === 0 ? (
                      <div className="py-4 px-3 text-center text-text-muted text-xs italic bg-base-1/40 rounded-sm border border-border/40">
                        {filterQuery ? `No local branches match "${filterQuery}"` : 'No local branches.'}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {localBranches.map((branchItem) => {
                          const isCurrent = branchItem.name === currentBranch;
                          return (
                            <div
                              key={branchItem.name}
                              onClick={() => handleSelectBranch(branchItem.name)}
                              className={`group relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-sm cursor-pointer transition-all duration-150 select-none ${
                                isCurrent
                                  ? 'bg-commito-coral/10 hover:bg-commito-coral/15 border border-commito-coral/30 shadow-xs'
                                  : 'bg-base-0 hover:bg-base-1/90 border border-transparent hover:border-border/60 hover:shadow-xs'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div
                                  className={`w-5 h-5 rounded-sm flex items-center justify-center shrink-0 transition-colors ${
                                    isCurrent
                                      ? 'bg-commito-coral/20 text-commito-coral'
                                      : 'bg-base-2 text-text-muted group-hover:text-commito-coral group-hover:bg-commito-coral/10'
                                  }`}
                                >
                                  <GitBranch className="w-3 h-3" />
                                </div>

                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  <span
                                    className={`truncate text-xs font-mono transition-colors ${
                                      isCurrent
                                        ? 'font-bold text-commito-coral'
                                        : 'font-medium text-text group-hover:text-text-primary'
                                    }`}
                                  >
                                    {branchItem.name}
                                  </span>

                                  {branchItem.remoteTracking && (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs bg-gitlab-blue/10 text-gitlab-blue border border-gitlab-blue/20 text-[9.5px] font-mono flex-shrink-0"
                                      title={`Tracks remote '${branchItem.remoteTracking}'`}
                                    >
                                      <Globe className="w-2.5 h-2.5 flex-shrink-0" />
                                      <span className="truncate max-w-[70px]">{branchItem.remotePrefix || 'origin'}</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {isCurrent ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-xs bg-commito-coral/20 text-commito-coral border border-commito-coral/35 tracking-wider">
                                    CURRENT
                                  </span>
                                  <Check className="w-3.5 h-3.5 text-commito-coral shrink-0" />
                                </div>
                              ) : (
                                <span className="text-[10.5px] font-sans font-medium text-commito-coral opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-commito-coral/10 border border-commito-coral/25 px-1.5 py-0.5 rounded-xs">
                                  <span>Switch</span>
                                  <ArrowRight className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>

                {/* Remote Branches Section */}
                <div className="space-y-1 pt-2 border-t border-border/50">
                  <button
                    type="button"
                    onClick={toggleRemoteCollapsed}
                    className="px-1.5 py-1 w-full flex items-center justify-between select-none rounded-sm hover:bg-base-1/80 transition-colors cursor-pointer group"
                    title={isRemoteCollapsed && !filterQuery ? 'Expand Remote Branches' : 'Collapse Remote Branches'}
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

                  {(!isRemoteCollapsed || Boolean(filterQuery.trim())) && (
                    remoteOnlyBranches.length === 0 ? (
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
                      <div className="space-y-1">
                        {remoteOnlyBranches.map((remoteBranchItem: BranchInfo) => {
                          const slashIdx = remoteBranchItem.name.indexOf('/');
                          const prefix = slashIdx !== -1 ? remoteBranchItem.name.slice(0, slashIdx + 1) : '';
                          const nameWithoutPrefix = slashIdx !== -1 ? remoteBranchItem.name.slice(slashIdx + 1) : remoteBranchItem.name;

                          return (
                            <div
                              key={remoteBranchItem.name}
                              onClick={() => handleSelectBranch(remoteBranchItem.name)}
                              className="group relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-sm bg-base-0 hover:bg-base-1/90 border border-transparent hover:border-border/60 hover:shadow-xs cursor-pointer transition-all duration-150 select-none"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-5 h-5 rounded-sm bg-gitlab-blue/10 text-gitlab-blue flex items-center justify-center shrink-0 group-hover:bg-gitlab-blue/20 transition-colors">
                                  <Globe className="w-3 h-3" />
                                </div>
                                <div className="min-w-0 truncate font-mono text-xs">
                                  {prefix && (
                                    <span className="text-text-muted text-[11px] font-normal">{prefix}</span>
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
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Tab Body: Pull Requests View */}
            {activeTab === 'pull-requests' && (
              <div className="flex-1 overflow-y-auto p-2 min-h-0 scrollbar-thin">
                {isLoadingPRs && pullRequests.length === 0 ? (
                  <div className="py-12 px-4 flex flex-col items-center justify-center gap-2.5 text-text-muted text-xs">
                    <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                    <span className="text-[11.5px] font-medium text-text-secondary">Loading open pull requests...</span>
                  </div>
                ) : prError ? (
                  <div className="py-8 px-4 text-center space-y-3">
                    <div className="w-9 h-9 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xs">
                      <AlertCircle className="w-4.5 h-4.5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-text-primary">
                        {prError.includes('Not Found') || prError.includes('404')
                          ? 'Private Repository Authentication'
                          : 'Unable to Load Pull Requests'}
                      </p>
                      <p className="text-[11px] text-text-muted max-w-[280px] mx-auto leading-relaxed">
                        {prError.includes('Not Found') || prError.includes('404')
                          ? 'This repository is private. Please ensure you are logged into your account in Accounts settings.'
                          : prError}
                      </p>
                    </div>
                    <div className="pt-1 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={loadPullRequests}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-base-2 hover:bg-base-3 border border-border/80 text-text-primary rounded-sm text-xs font-semibold transition cursor-pointer shadow-xs active:scale-95"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    </div>
                  </div>
                ) : filteredPullRequests.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-3">
                    <div className="w-9 h-9 mx-auto rounded-full bg-base-1 border border-border/70 flex items-center justify-center text-text-muted shadow-xs">
                      <GitPullRequest className="w-4.5 h-4.5 opacity-70 text-emerald-400" />
                    </div>
                    <div className="space-y-1">
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
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            setIsMergeRequestModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-commito-coral/15 hover:bg-commito-coral border border-commito-coral/40 text-commito-coral hover:text-white rounded-sm text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Pull Request</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Section Header */}
                    {activeProjectPath && (
                      <div className="px-1.5 pt-0.5 pb-1 text-[10.5px] font-semibold text-text-muted select-none truncate">
                        Pull requests in <span className="text-text-primary font-mono">{activeProjectPath}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {filteredPullRequests.map((pr) => {
                        const isCurrent = isCurrentPR(pr.source_branch);
                        const prNumber = pr.iid || pr.id;
                        const numberPrefix = user?.provider === 'github' ? '#' : '!';

                        return (
                          <div
                            key={pr.id}
                            onClick={() => handleSelectPullRequest(pr)}
                            className={`group flex items-start justify-between gap-2.5 p-2.5 rounded-sm cursor-pointer transition-all duration-150 border ${
                              isCurrent
                                ? 'bg-commito-coral/10 border-commito-coral/30 shadow-xs'
                                : 'bg-base-0 hover:bg-base-1/90 border-transparent hover:border-border/60 hover:shadow-xs'
                            }`}
                            title={`Open Pull Request ${numberPrefix}${prNumber} in Git Desktop`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div className="w-5 h-5 rounded-sm bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                <GitPullRequest className="w-3 h-3" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="text-xs font-semibold text-text-primary truncate leading-tight group-hover:text-commito-coral transition-colors">
                                  {pr.title}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap text-[10.5px] text-text-muted">
                                  <span className="font-mono font-bold text-commito-coral bg-commito-coral/10 border border-commito-coral/25 px-1 py-0.2 rounded-xs">
                                    {numberPrefix}{prNumber}
                                  </span>

                                  <div className="flex items-center gap-1 font-mono text-[10px] text-text-muted bg-base-1 px-1.5 py-0.2 rounded-xs border border-border/50">
                                    <GitFork className="w-2.5 h-2.5 text-text-faint" />
                                    <span className="truncate max-w-[90px]">{pr.source_branch}</span>
                                    <ArrowRight className="w-2 h-2 text-text-faint" />
                                    <span className="truncate max-w-[90px]">{pr.target_branch}</span>
                                  </div>

                                  <span className="truncate flex items-center gap-1">
                                    <User className="w-2.5 h-2.5 text-text-faint" />
                                    <span>{pr.author_name}</span>
                                  </span>

                                  <span>• {formatRelativeTime(pr.created_at)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Checkmark if current, plus external link */}
                            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-mono font-bold flex items-center gap-0.5">
                                  <span>CURRENT</span>
                                  <Check className="w-2.5 h-2.5" />
                                </span>
                              )}
                              {pr.web_url && pr.web_url !== '#' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openUrl(pr.web_url).catch(() => {});
                                  }}
                                  className="p-1 text-text-muted hover:text-text-primary rounded-sm hover:bg-base-2 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                                  title="Open in browser"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
                  <h3 className="text-xs font-bold text-text-primary leading-none">Create Branch</h3>
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
                    className="w-full h-7.5 pl-8 pr-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none transition font-mono shadow-2xs"
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
