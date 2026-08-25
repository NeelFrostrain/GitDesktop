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
  X,
  Globe,
  Loader2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { useRemoteStore } from '../../store/remoteStore';
import { GitService } from '../../services/git/gitService';
import { PullRequestService, parseRemoteRepoInfo } from '../../services/git/pullRequestService';
import { BranchInfo, UnifiedMergeRequest } from '../../types/git';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { BranchCheckoutModal } from '../modals/BranchCheckoutModal';

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
 * Dropdown component displaying current branch, Branches vs. Pull Requests tabs (matching GitHub Desktop),
 * search filtering, branch checkout, and inline PR inspection.
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
      // 1. Fetch remotes directly from git to guarantee up-to-date config
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
    if (branchName === currentBranch) return;

    if (uncommittedFilesCount > 0) {
      setPendingTargetBranch(branchName);
    } else {
      executeDirectCheckout(branchName);
    }
  };

  const handleSelectPullRequest = (pr: UnifiedMergeRequest) => {
    if (!pr.source_branch) return;
    handleSelectBranch(pr.source_branch);
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

  // Branch Filtering
  const queryLower = filterQuery.trim().toLowerCase();

  const localBranches = useMemo(() => {
    return branches
      .filter((b: BranchInfo) => !b.is_remote)
      .filter((b: BranchInfo) => b.name.toLowerCase().includes(queryLower));
  }, [branches, queryLower]);

  const remoteBranches = useMemo(() => {
    return branches
      .filter((b: BranchInfo) => b.is_remote)
      .filter((b: BranchInfo) => b.name.toLowerCase().includes(queryLower));
  }, [branches, queryLower]);

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

  const menuWidth = 380;
  const leftPos = triggerRect
    ? Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - 12)
    : 0;
  const topPos = triggerRect ? triggerRect.bottom + 6 : 0;

  const isCurrentPR = (sourceBranch: string) => sourceBranch === currentBranch;

  return (
    <>
      {/* Trigger Button (GitHub Desktop Style) */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="h-7 px-2.5 rounded-sm bg-base-2 hover:bg-base-3 border border-border text-text-primary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer select-none shadow-2xs"
        title={`Current branch: ${currentBranch}`}
      >
        <GitBranch className="w-3.5 h-3.5 text-commito-coral shrink-0" />
        <span className="truncate max-w-[120px] font-mono">{currentBranch}</span>
        {currentPR && (
          <span className="flex items-center gap-0.5 text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span>#{currentPR.iid || currentPR.id}</span>
            <Check className="w-2.5 h-2.5" />
          </span>
        )}
        <ChevronDown className={`w-3 h-3 text-text-muted shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
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
            className="fixed z-[9999] bg-base-0 border border-border-strong rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[500px] text-xs font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100 select-none"
          >
            {/* Header: Segmented Tabs & Action Button (GitHub Desktop Style) */}
            <div className="p-2.5 border-b border-border bg-base-1 shrink-0 flex items-center justify-between gap-2">
              {/* Segmented Tab Pill */}
              <div className="flex items-center gap-0.5 bg-base-2/80 p-0.5 rounded-sm border border-border/80 flex-1">
                {/* Branches Tab Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('branches');
                    setFilterQuery('');
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-xs text-[11px] font-medium transition cursor-pointer ${
                    activeTab === 'branches'
                      ? 'bg-base-0 text-text-primary shadow-xs border border-border/80 font-bold'
                      : 'text-text-muted hover:text-text-primary hover:bg-base-1/50'
                  }`}
                >
                  <GitBranch
                    className={`w-3.5 h-3.5 shrink-0 ${
                      activeTab === 'branches' ? 'text-commito-coral' : 'text-text-muted'
                    }`}
                  />
                  <span>Branches</span>
                  {isLoadingBranches ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin text-commito-coral ml-0.5" />
                  ) : (
                    <span className="text-[9.5px] font-mono text-text-muted ml-0.5">
                      ({branches.filter((b) => !b.is_remote).length})
                    </span>
                  )}
                </button>

                {/* Pull Requests Tab Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('pull-requests');
                    setFilterQuery('');
                    if (pullRequests.length === 0) loadPullRequests();
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-xs text-[11px] font-medium transition cursor-pointer ${
                    activeTab === 'pull-requests'
                      ? 'bg-base-0 text-text-primary shadow-xs border border-border/80 font-bold'
                      : 'text-text-muted hover:text-text-primary hover:bg-base-1/50'
                  }`}
                >
                  <GitPullRequest
                    className={`w-3.5 h-3.5 shrink-0 ${
                      activeTab === 'pull-requests' ? 'text-emerald-400' : 'text-text-muted'
                    }`}
                  />
                  <span>Pull requests</span>
                  {isLoadingPRs ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin text-emerald-400 ml-0.5" />
                  ) : pullRequests.length > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-xs bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold">
                      {pullRequests.length}
                    </span>
                  ) : null}
                </button>
              </div>

              {/* Action Button: New Branch vs. New PR */}
              {activeTab === 'branches' ? (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="h-7 px-2.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs shrink-0 active:scale-95"
                  title="Create new branch"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsMergeRequestModalOpen(true);
                  }}
                  className="h-7 px-2.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs shrink-0 active:scale-95"
                  title="Create Pull Request / Merge Request"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New PR</span>
                </button>
              )}
            </div>

            {/* Search Bar */}
            <div className="p-2 border-b border-border/80 bg-base-0 shrink-0 flex items-center gap-1.5">
              <div className="relative flex items-center flex-1">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={
                    activeTab === 'branches'
                      ? 'Filter branches...'
                      : 'Filter'
                  }
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full h-7.5 pl-8 pr-7 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none transition font-mono shadow-inner"
                />
                {filterQuery && (
                  <button
                    type="button"
                    onClick={() => setFilterQuery('')}
                    className="absolute right-2 text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer"
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
                  className="h-7.5 w-7.5 flex items-center justify-center rounded-sm bg-base-1 hover:bg-base-2 border border-border text-text-muted hover:text-text-primary transition cursor-pointer disabled:opacity-50 shrink-0"
                  title="Refresh pull requests"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPRs ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              )}
            </div>

            {/* Tab Body: Branches View */}
            {activeTab === 'branches' && (
              <div className="flex-1 overflow-y-auto py-1.5 space-y-2 min-h-0">
                {/* Local Branches Section */}
                <div>
                  <div className="px-3 pt-1 pb-1 select-none flex items-center justify-between">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint">
                      LOCAL BRANCHES
                    </span>
                    <span className="text-[9.5px] font-mono text-text-muted bg-base-1 px-1.5 py-0.2 rounded-xs border border-border">
                      {localBranches.length}
                    </span>
                  </div>

                  {localBranches.length === 0 ? (
                    <div className="px-3 py-2 text-text-muted text-[11px] italic">
                      {filterQuery ? 'No local branches match search.' : 'No local branches.'}
                    </div>
                  ) : (
                    <div className="space-y-0.5 px-1.5">
                      {localBranches.map((branchItem: BranchInfo) => {
                        const isCurrent = branchItem.name === currentBranch;
                        return (
                          <div
                            key={branchItem.name}
                            onClick={() => handleSelectBranch(branchItem.name)}
                            className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm cursor-pointer transition ${
                              isCurrent
                                ? 'bg-commito-coral/15 text-commito-coral font-semibold border border-commito-coral/30 shadow-2xs'
                                : 'hover:bg-base-1 text-text-primary'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <GitBranch
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isCurrent ? 'text-commito-coral' : 'text-text-muted group-hover:text-text-secondary'
                                }`}
                              />
                              <span className="truncate text-xs font-mono">{branchItem.name}</span>
                            </div>

                            {isCurrent && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-xs bg-commito-coral/20 text-commito-coral border border-commito-coral/40">
                                  CURRENT
                                </span>
                                <Check className="w-3.5 h-3.5 text-commito-coral" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Remote Branches Section */}
                {remoteBranches.length > 0 && (
                  <div className="pt-1.5 border-t border-border/60">
                    <div className="px-3 pt-1 pb-1 select-none flex items-center justify-between">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint">
                        REMOTE BRANCHES
                      </span>
                      <span className="text-[9.5px] font-mono text-text-muted bg-base-1 px-1.5 py-0.2 rounded-xs border border-border">
                        {remoteBranches.length}
                      </span>
                    </div>

                    <div className="space-y-0.5 px-1.5">
                      {remoteBranches.map((remoteBranchItem: BranchInfo) => (
                        <div
                          key={remoteBranchItem.name}
                          onClick={() => handleSelectBranch(remoteBranchItem.name)}
                          className="group flex items-center gap-2 px-2.5 py-1.5 rounded-sm hover:bg-base-1 text-text-secondary hover:text-text-primary cursor-pointer transition font-mono"
                        >
                          <Globe className="w-3.5 h-3.5 text-gitlab-blue shrink-0" />
                          <span className="truncate text-xs">{remoteBranchItem.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab Body: Pull Requests View (Matching GitHub Desktop) */}
            {activeTab === 'pull-requests' && (
              <div className="flex-1 overflow-y-auto py-1.5 min-h-0">
                {isLoadingPRs && pullRequests.length === 0 ? (
                  <div className="py-8 px-4 flex flex-col items-center justify-center gap-2 text-text-muted text-xs">
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span className="text-[11px]">Loading open pull requests...</span>
                  </div>
                ) : prError ? (
                  <div className="py-6 px-4 text-center space-y-2.5">
                    <div className="w-8 h-8 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-text-primary">
                        {prError.includes('Not Found') || prError.includes('404')
                          ? 'Private Repository Authentication'
                          : 'Unable to Load Pull Requests'}
                      </p>
                      <p className="text-[11px] text-text-muted max-w-[280px] mx-auto leading-normal">
                        {prError.includes('Not Found') || prError.includes('404')
                          ? 'This repository is private. Please ensure you are logged into your GitHub account in Accounts.'
                          : prError}
                      </p>
                    </div>
                    <div className="pt-1 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={loadPullRequests}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-base-2 hover:bg-base-3 border border-border text-text-primary rounded-sm text-xs font-medium transition cursor-pointer shadow-2xs active:scale-95"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    </div>
                  </div>
                ) : filteredPullRequests.length === 0 ? (
                  <div className="py-6 px-4 text-center space-y-2.5">
                    <div className="w-8 h-8 mx-auto rounded-full bg-base-1 border border-border flex items-center justify-center text-text-muted">
                      <GitPullRequest className="w-4 h-4 opacity-70 text-emerald-400" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-text-primary">
                        {filterQuery ? 'No matching pull requests' : 'No Open Pull Requests'}
                      </p>
                      <p className="text-[11px] text-text-muted max-w-[260px] mx-auto leading-normal">
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-commito-coral/15 hover:bg-commito-coral border border-commito-coral/40 text-commito-coral hover:text-white rounded-sm text-xs font-semibold shadow-2xs transition cursor-pointer active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Pull Request</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5 px-1.5">
                    {/* Section Header: Pull requests in owner/repo */}
                    {activeProjectPath && (
                      <div className="px-2 pt-1 pb-0.5 text-[11px] font-semibold text-text-muted select-none truncate">
                        Pull requests in <span className="text-text-primary font-mono">{activeProjectPath}</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      {filteredPullRequests.map((pr) => {
                        const isCurrent = isCurrentPR(pr.source_branch);
                        const prNumber = pr.iid || pr.id;
                        const numberPrefix = user?.provider === 'github' ? '#' : '!';

                        return (
                          <div
                            key={pr.id}
                            onClick={() => handleSelectPullRequest(pr)}
                            className={`group flex items-start justify-between gap-2.5 p-2.5 rounded-sm cursor-pointer transition border ${
                              isCurrent
                                ? 'bg-commito-coral/10 border-commito-coral/30 shadow-2xs'
                                : 'bg-base-0 hover:bg-base-1 border-transparent hover:border-border'
                            }`}
                            title={`Checkout branch '${pr.source_branch}' for PR ${numberPrefix}${prNumber}`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div className="mt-0.5 shrink-0 text-emerald-400">
                                <GitPullRequest className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="text-xs font-semibold text-text-primary truncate leading-tight group-hover:text-commito-coral transition-colors">
                                  {pr.title}
                                </div>
                                <div className="text-[11px] text-text-muted font-mono flex items-center gap-1.5">
                                  <span className="font-bold text-commito-coral">{numberPrefix}{prNumber}</span>
                                  <span>opened {formatRelativeTime(pr.created_at)} by {pr.author_name}</span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Checkmark if current, plus external link */}
                            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                              {isCurrent && (
                                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                              )}
                              {pr.web_url && pr.web_url !== '#' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openUrl(pr.web_url).catch(() => {});
                                  }}
                                  className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-base-2 transition opacity-0 group-hover:opacity-100 cursor-pointer"
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
        <div className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans">
          <form
            onSubmit={handleCreateBranchSubmit}
            className="bg-base-0 border border-border-strong rounded-sm shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-4 py-3 bg-base-1 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-commito-coral" />
                <h3 className="text-xs font-bold text-text-primary">Create Branch</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-text-primary block mb-1">Branch Name</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="feature/new-feature"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full h-8 px-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none transition font-mono shadow-inner"
                />
              </div>
            </div>

            <div className="px-4 py-3 bg-base-1 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="h-7.5 px-3 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary transition cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newBranchName.trim() || isCreating}
                className="h-7.5 px-3.5 bg-commito-coral hover:bg-commito-coralLight disabled:opacity-50 text-white rounded-sm text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Create & Checkout</span>
              </button>
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
