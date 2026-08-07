import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { 
  GitBranch, 
  FolderGit2, 
  RefreshCw, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  ChevronDown, 
  User, 
  Check, 
  GitPullRequest,
  AlertCircle,
  Lock,
  Globe,
  Upload,
  X,
  LogOut,
  ExternalLink,
  Search,
  Users,
  UserPlus,
  Settings
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { BranchInfo, RepoStatus, PullResult } from '../types/git';
import { GitLabProject } from '../types/gitlab';

export const Header: React.FC = () => {
  const {
    activeRepoPath,
    setActiveRepoPath,
    recentRepos,
    status,
    setStatus,
    user,
    setUser,
    setIsRepoModalOpen,
    setActiveModalTab,
    isFetching,
    setIsFetching,
    isPushing,
    setIsPushing,
    isPulling,
    setIsPulling,
    lastFetchedTimestamp,
    setLastFetchedTimestamp,
    setError,
    error,
    setCurrentNavView,
  } = useGitStore();

  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

  // Publish Repository Modal State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishName, setPublishName] = useState('');
  const [publishIsPrivate, setPublishIsPrivate] = useState(true);
  const [publishDescription, setPublishDescription] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Fetch branches when active repo changes
  useEffect(() => {
    if (!activeRepoPath) return;
    invoke<BranchInfo[]>('list_branches', { repoPath: activeRepoPath })
      .then(setBranches)
      .catch((err) => setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) }));
  }, [activeRepoPath, status?.current_branch]);



  const repoName = activeRepoPath
    ? activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || activeRepoPath
    : 'No Repository';

  const handleOpenLocalRepo = async () => {
    try {
      const selected = await invoke<string | null>('select_folder_cmd');
      if (selected) {
        setActiveRepoPath(selected);
        setCurrentNavView('workspace');
        const res = await invoke<RepoStatus>('get_repo_status', { repoPath: selected });
        setStatus(res);
        setIsRepoDropdownOpen(false);
      }
    } catch (err: any) {
      setError({ code: err.code || 'FILESYSTEM_ERROR', message: err.message || String(err) });
    }
  };

  const handleFetch = async () => {
    if (!activeRepoPath) return;
    setIsFetching(true);
    setError(null);
    useLogStore.getState().addLog('info', 'Git', `Fetching origin for repository '${repoName}'...`);
    try {
      await invoke('fetch_remote', { repoPath: activeRepoPath });
      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
      setLastFetchedTimestamp(Date.now());
      useLogStore.getState().addLog('success', 'Git', `Successfully fetched latest changes from origin.`);
    } catch (err: any) {
      const msg = err.message || String(err);
      setError({ code: err.code || 'NETWORK_ERROR', message: msg });
      useLogStore.getState().addLog('error', 'Git', `Fetch failed: ${msg}`, msg);
    } finally {
      setIsFetching(false);
    }
  };

  const handlePush = async () => {
    if (!activeRepoPath || !status?.current_branch) return;
    setIsPushing(true);
    setError(null);
    const branchName = status.current_branch;
    const aheadCount = status.ahead || 1;
    useLogStore.getState().addLog('info', 'Git', `Pushing ${aheadCount} commit(s) to origin/${branchName}...`);
    try {
      await invoke('push_to_remote', { repoPath: activeRepoPath, branch: branchName });
      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
      useLogStore.getState().addLog('success', 'Git', `Successfully pushed ${aheadCount} commit(s) to origin/${branchName}.`);
    } catch (err: any) {
      const msg = err.message || String(err);
      setError({ code: err.code || 'GIT_ERROR', message: msg });
      useLogStore.getState().addLog('error', 'Git', `Push failed to origin/${branchName}: ${msg}`, msg);
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    if (!activeRepoPath || !status?.current_branch) return;
    setIsPulling(true);
    setError(null);
    const branchName = status.current_branch;
    useLogStore.getState().addLog('info', 'Git', `Pulling commits from origin/${branchName}...`);
    try {
      const result = await invoke<PullResult>('pull_from_remote', {
        repoPath: activeRepoPath,
        branch: branchName,
      });

      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);

      if (!result.success && result.conflicts.length > 0) {
        const msg = `Merge conflicts detected in ${result.conflicts.length} files.`;
        setError({ code: 'GIT_CONFLICT_ERROR', message: msg });
        useLogStore.getState().addLog('warning', 'Git', `Pull completed with ${result.conflicts.length} conflicts.`, msg);
      } else {
        useLogStore.getState().addLog('success', 'Git', `Successfully pulled commits from origin/${branchName}.`);
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      setError({ code: err.code || 'GIT_ERROR', message: msg });
      useLogStore.getState().addLog('error', 'Git', `Pull failed: ${msg}`, msg);
    } finally {
      setIsPulling(false);
    }
  };

  const handlePublishRepo = async () => {
    if (!activeRepoPath || !publishName.trim()) return;
    setIsPublishing(true);
    setPublishError(null);
    useLogStore.getState().addLog('info', 'Repo', `Publishing repository '${publishName}' to GitLab...`);
    try {
      await invoke<GitLabProject>('publish_repository', {
        repoPath: activeRepoPath,
        name: publishName.trim(),
        isPrivate: publishIsPrivate,
        description: publishDescription || null,
        serverUrl: user?.server_url || null,
      });
      setIsPublishModalOpen(false);
      setError(null);
      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
      useLogStore.getState().addLog('success', 'Repo', `Successfully published repository '${publishName}' to GitLab.`);
    } catch (err: any) {
      const msg = err.message || String(err);
      setPublishError(msg);
      useLogStore.getState().addLog('error', 'Repo', `Failed to publish repository '${publishName}': ${msg}`, msg);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSwitchBranch = async (branchName: string) => {
    if (!activeRepoPath) return;
    try {
      await invoke('checkout_branch', { repoPath: activeRepoPath, branch: branchName });
      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
      setIsBranchDropdownOpen(false);
    } catch (err: any) {
      setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) });
    }
  };

  const handleCreateBranch = async () => {
    if (!activeRepoPath || !newBranchName.trim()) return;
    try {
      await invoke('create_branch', { repoPath: activeRepoPath, branch: newBranchName.trim() });
      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
      setNewBranchName('');
      setIsCreatingBranch(false);
      setIsBranchDropdownOpen(false);
    } catch (err: any) {
      setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) });
    }
  };

  const handleCreateMergeRequest = async () => {
    if (!user || !status?.current_branch) return;
    const mrUrl = `${user.server_url}/${repoName}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${status.current_branch}`;
    try {
      await openUrl(mrUrl);
    } catch {
      window.open(mrUrl, '_blank');
    }
  };

  const renderFetchPushButton = () => {
    if (!activeRepoPath) {
      return (
        <button disabled className="px-3 py-1.5 bg-base-2 text-text-faint rounded border border-border cursor-not-allowed text-xs font-medium flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Fetch origin
        </button>
      );
    }

    if (error?.message?.includes('No remote configured')) {
      return (
        <button
          onClick={() => {
            setPublishName(repoName);
            setIsPublishModalOpen(true);
          }}
          className="px-3 py-1.5 bg-gitlab-orange hover:bg-orange-600 text-white rounded transition text-xs font-semibold flex items-center gap-1.5 shadow-md"
        >
          <Upload className="w-3.5 h-3.5" />
          Publish repository to GitLab
        </button>
      );
    }

    if (isFetching || isPushing || isPulling) {
      return (
        <button disabled className="px-3 py-1.5 bg-base-2 text-text-primary rounded border border-border cursor-wait text-xs font-medium flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-gitlab-orange" />
          {isFetching ? 'Fetching origin...' : isPushing ? 'Pushing commits...' : 'Pulling commits...'}
        </button>
      );
    }

    const ahead = status?.ahead || 0;
    const behind = status?.behind || 0;

    if (behind > 0) {
      return (
        <button
          onClick={handlePull}
          className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-base-2 text-left transition"
        >
          <ArrowDown className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-text-primary leading-none mb-0.5">Pull origin</span>
            <span className="text-[10px] text-text-muted font-medium leading-tight">Pull {behind} commit{behind > 1 ? 's' : ''}</span>
          </div>
        </button>
      );
    }

    if (ahead > 0) {
      return (
        <button
          onClick={handlePush}
          className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-base-2 text-left transition"
        >
          <ArrowUp className="w-4 h-4 text-gitlab-teal flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-text-primary leading-none mb-0.5">Push origin</span>
            <span className="text-[10px] text-text-muted font-medium leading-tight">Push {ahead} commit{ahead > 1 ? 's' : ''}</span>
          </div>
        </button>
      );
    }

    return (
      <button
        onClick={handleFetch}
        className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-base-2 text-left transition"
      >
        <RefreshCw className={`w-4 h-4 text-gitlab-orange flex-shrink-0 ${isFetching ? 'animate-spin' : ''}`} />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-text-primary leading-none mb-0.5">Fetch origin</span>
          <span className="text-[10px] text-text-muted font-medium leading-tight">
            {lastFetchedTimestamp
              ? `${Math.floor((Date.now() - lastFetchedTimestamp) / 1000 / 60)}m ago`
              : 'Never fetched'}
          </span>
        </div>
      </button>
    );
  };

  const filteredBranches = branches.filter((b) => {
    if (b.name === 'origin/HEAD' || b.name === 'HEAD' || b.name.endsWith('/HEAD')) {
      return false;
    }
    if (!branchSearch.trim()) return true;
    return b.name.toLowerCase().includes(branchSearch.toLowerCase().trim());
  });

  return (
    <header className="h-14 bg-base-0 border-b border-border px-3 flex items-center justify-between select-none z-30 relative">
      {/* Left: GitHub Desktop 3-Segment Top Bar */}
      <div className="flex items-center border border-border rounded-lg bg-base-1 overflow-hidden divide-x divide-border">
        {/* Segment 1: Current repository */}
        <div className="relative">
          <button
            onClick={() => setIsRepoDropdownOpen(!isRepoDropdownOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-base-2 text-left transition"
          >
            <FolderGit2 className="w-4 h-4 text-gitlab-orange flex-shrink-0" />
            <div className="flex flex-col min-w-0 max-w-[170px]">
              <span className="text-[10px] text-text-muted font-medium leading-none mb-0.5">Current repository</span>
              <span className="text-xs font-bold text-text-primary truncate leading-tight">{repoName}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0 ml-1" />
          </button>

          {/* GitHub Desktop Repository Switcher Popup */}
          {isRepoDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-80 bg-base-2 border border-border rounded-lg shadow-2xl p-2 z-50 space-y-2">
              {/* Top Row: Filter input & Add dropdown button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filter"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 bg-base-0 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-gitlab-orange font-sans"
                  />
                </div>

                <div className="relative">
                  <button
                    onClick={() => {
                      setIsRepoDropdownOpen(false);
                      setActiveModalTab('repos');
                      setIsRepoModalOpen(true);
                    }}
                    className="px-2.5 py-1 bg-base-3 hover:bg-base-1 border border-border rounded text-xs text-text-primary font-semibold flex items-center gap-1 transition"
                  >
                    <span>Add</span>
                    <ChevronDown className="w-3 h-3 text-text-muted" />
                  </button>
                </div>
              </div>

              {/* Sections: Recent, Account User, Other */}
              <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                {/* Recent Section */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-2">
                    Recent
                  </div>
                  {recentRepos.slice(0, 3).map((rPath) => {
                    const rName = rPath.split(/[/\\]/).filter(Boolean).pop() || rPath;
                    const isActive = activeRepoPath && activeRepoPath.replace(/\\/g, '/') === rPath.replace(/\\/g, '/');

                    return (
                      <button
                        key={`recent_${rPath}`}
                        onClick={() => {
                          setActiveRepoPath(rPath);
                          setIsRepoDropdownOpen(false);
                        }}
                        className={`w-full px-2 py-1.5 rounded text-xs flex items-center justify-between transition ${
                          isActive
                            ? 'bg-base-3 text-text-primary font-semibold'
                            : 'hover:bg-base-3/60 text-text-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Lock className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                          <span className="truncate">{rName}</span>
                        </div>
                        {isActive && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Account Section */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-2">
                    {user?.username || 'Local Repositories'}
                  </div>
                  {recentRepos.map((rPath) => {
                    const rName = rPath.split(/[/\\]/).filter(Boolean).pop() || rPath;
                    const isActive = activeRepoPath && activeRepoPath.replace(/\\/g, '/') === rPath.replace(/\\/g, '/');

                    return (
                      <button
                        key={`acct_${rPath}`}
                        onClick={() => {
                          setActiveRepoPath(rPath);
                          setIsRepoDropdownOpen(false);
                        }}
                        className={`w-full px-2 py-1.5 rounded text-xs flex items-center justify-between transition ${
                          isActive
                            ? 'bg-base-3 text-text-primary font-semibold'
                            : 'hover:bg-base-3/60 text-text-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Lock className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                          <span className="truncate">{rName}</span>
                        </div>
                        {isActive && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer actions */}
              <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
                <button
                  onClick={handleOpenLocalRepo}
                  className="text-gitlab-teal hover:underline flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add Local Folder
                </button>
                <button
                  onClick={() => {
                    setIsRepoDropdownOpen(false);
                    setActiveModalTab('repos');
                    setIsRepoModalOpen(true);
                  }}
                  className="text-gitlab-orange hover:underline font-medium"
                >
                  Clone Remote...
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Segment 2: Current branch */}
        <div className="relative">
          <button
            disabled={!activeRepoPath}
            onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
            className={`flex items-center gap-2.5 px-3 py-1.5 hover:bg-base-2 text-left transition ${
              !activeRepoPath ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <GitBranch className="w-4 h-4 text-gitlab-teal flex-shrink-0" />
            <div className="flex flex-col min-w-0 max-w-[140px]">
              <span className="text-[10px] text-text-muted font-medium leading-none mb-0.5">Current branch</span>
              <span className="text-xs font-bold text-text-primary truncate leading-tight">{status?.current_branch || 'main'}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0 ml-1" />
          </button>

          {isBranchDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-72 bg-base-2 border border-border rounded-md shadow-2xl p-2 z-50">
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter branches..."
                  value={branchSearch}
                  onChange={(e) => setBranchSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-base-0 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-gitlab-orange"
                />
                {branchSearch && (
                  <button
                    onClick={() => setBranchSearch('')}
                    className="absolute right-2 top-2 text-text-muted hover:text-text-primary p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto mb-2 space-y-0.5">
                {filteredBranches.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-text-muted italic text-center">
                    No branches found matching "{branchSearch}"
                  </div>
                ) : (
                  filteredBranches.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => handleSwitchBranch(b.name)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition ${
                        b.is_current
                          ? 'bg-gitlab-orange/20 text-gitlab-orange font-semibold'
                          : 'text-text-primary hover:bg-base-3'
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      {b.is_current && <Check className="w-3.5 h-3.5 text-gitlab-orange flex-shrink-0 ml-1" />}
                    </button>
                  ))
                )}
              </div>

              {!isCreatingBranch ? (
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <button
                    onClick={() => setIsCreatingBranch(true)}
                    className="text-xs text-gitlab-orange hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Branch
                  </button>
                  <button
                    onClick={handleCreateMergeRequest}
                    className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1"
                  >
                    <GitPullRequest className="w-3.5 h-3.5 text-gitlab-orange" />
                    Create MR
                  </button>
                </div>
              ) : (
                <div className="border-t border-border pt-2 space-y-2">
                  <input
                    type="text"
                    placeholder="New branch name"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="w-full px-2 py-1 bg-base-0 border border-border rounded text-xs text-text-primary"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setIsCreatingBranch(false)}
                      className="px-2 py-1 text-xs text-text-muted hover:text-text-primary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateBranch}
                      className="px-2.5 py-1 text-xs bg-gitlab-orange text-white rounded font-medium"
                    >
                      Create
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fetch / Push / Pull / Publish */}
        {renderFetchPushButton()}
      </div>

      {/* Far Right: Account, Co-author, Settings & Errors */}
      <div className="flex items-center gap-2">
        {error && !error.message?.includes('No remote configured') && !(user && error.message?.includes('Not authenticated')) && (
          <div className="flex items-center gap-1.5 text-[11px] text-red-300 bg-red-950/60 border border-red-800/60 px-2 py-0.5 rounded max-w-xs truncate" title={error.message}>
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{error.message}</span>
            <button onClick={() => setError(null)} className="ml-1 text-red-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Co-author & Settings Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setActiveModalTab('accounts');
              setIsRepoModalOpen(true);
            }}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded border border-border transition flex items-center gap-1 text-xs"
            title="Co-authors & Accounts"
          >
            <UserPlus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              setActiveModalTab('accounts');
              setIsRepoModalOpen(true);
            }}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded border border-border transition flex items-center gap-1 text-xs"
            title="Settings & Account Configuration"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* User Account Profile Button */}
        <div className="relative">
          <button
            onClick={() => {
              if (!user) {
                setActiveModalTab('login');
                setIsRepoModalOpen(true);
              } else {
                setIsProfileDropdownOpen(!isProfileDropdownOpen);
              }
            }}
            className="flex items-center gap-2 px-2.5 py-1 bg-base-2 hover:bg-base-3 border border-border rounded transition text-xs"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Avatar" className="w-4 h-4 rounded-full" />
            ) : (
              <User className="w-3.5 h-3.5 text-gitlab-orange" />
            )}
            <span className="text-text-primary font-medium text-xs">{user ? user.username : 'Sign In'}</span>
            <ChevronDown className="w-3 h-3 text-text-muted" />
          </button>

          {isProfileDropdownOpen && user && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-base-2 border border-border rounded-lg shadow-2xl p-3 z-50 space-y-3">
              {/* User Metadata Header */}
              <div className="flex items-center gap-3 pb-2 border-b border-border">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full border border-border" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gitlab-orange/20 border border-gitlab-orange flex items-center justify-center">
                    <User className="w-5 h-5 text-gitlab-orange" />
                  </div>
                )}
                <div className="truncate min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-text-primary truncate">{user.name}</span>
                    <span className={`px-1 py-0.2 text-[8px] font-bold border rounded ${
                      user.provider === 'github'
                        ? 'bg-white/10 text-white border-white/20'
                        : 'bg-[#FC6D26]/15 text-[#FC6D26] border-[#FC6D26]/30'
                    }`}>
                      {user.provider === 'github' ? 'GitHub' : 'GitLab'}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-muted font-mono truncate">@{user.username}</div>
                </div>
              </div>

              {/* Account Server Info */}
              <div className="text-[11px] text-text-muted flex items-center gap-1.5 px-1 font-mono">
                <Globe className="w-3.5 h-3.5 text-gitlab-teal flex-shrink-0" />
                <span className="truncate">{user.server_url}</span>
              </div>

              <div className="space-y-1 pt-1 border-t border-border">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProfileDropdownOpen(false);
                    setActiveModalTab('accounts');
                    setIsRepoModalOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs font-semibold text-text-primary bg-base-2 hover:bg-base-3 active:bg-base-3 flex items-center justify-between transition border border-gitlab-orange/30 hover:border-gitlab-orange"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-gitlab-orange" />
                    Switch / Manage Accounts
                  </span>
                  <span className="text-[10px] bg-gitlab-orange/20 text-gitlab-orange px-1.5 py-0.5 rounded font-mono">
                    Multi
                  </span>
                </button>

                <button
                  onClick={async () => {
                    setIsProfileDropdownOpen(false);
                    if (user.web_url) {
                      try { await openUrl(user.web_url); } catch { window.open(user.web_url, '_blank'); }
                    }
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-text-primary bg-base-2 hover:bg-base-3 active:bg-base-3 flex items-center justify-between transition"
                >
                  <span>View Profile on {user.provider === 'github' ? 'GitHub' : 'GitLab'}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProfileDropdownOpen(false);
                    setActiveModalTab('repos');
                    setIsRepoModalOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-text-primary bg-base-2 hover:bg-base-3 active:bg-base-3 flex items-center justify-between transition"
                >
                  <span>Manage Repositories</span>
                  <FolderGit2 className="w-3.5 h-3.5 text-gitlab-orange" />
                </button>

                <button
                  onClick={async () => {
                    setIsProfileDropdownOpen(false);
                    try {
                      await invoke('logout_gitlab');
                    } catch {}
                    setUser(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-red-400 bg-base-2 hover:bg-red-950/40 active:bg-red-950/40 hover:text-red-300 flex items-center justify-between transition mt-1"
                >
                  <span>Sign Out</span>
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Publish Repository Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-base-1 border border-border rounded-lg shadow-2xl p-5 w-[420px] space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Upload className="w-4 h-4 text-gitlab-orange" />
              Publish Repository to GitLab
            </h3>
            <p className="text-xs text-text-muted">
              Create a new remote repository on GitLab and push all local commits to sync with the cloud.
            </p>

            {publishError && (
              <div className="p-2.5 bg-red-950/60 border border-red-800/60 rounded text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="break-all">{publishError}</span>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1 font-medium">Repository Name</label>
                <input
                  type="text"
                  required
                  value={publishName}
                  onChange={(e) => setPublishName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-base-0 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-gitlab-orange"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1 font-medium">Description (optional)</label>
                <input
                  type="text"
                  value={publishDescription}
                  onChange={(e) => setPublishDescription(e.target.value)}
                  placeholder="Repository description..."
                  className="w-full px-3 py-1.5 bg-base-0 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-gitlab-orange"
                />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPublishIsPrivate(true)}
                  className={`flex-1 py-1.5 px-3 rounded border text-xs font-medium flex items-center justify-center gap-1.5 ${
                    publishIsPrivate
                      ? 'bg-gitlab-orange/20 border-gitlab-orange text-gitlab-orange'
                      : 'bg-base-0 border-border text-text-muted'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Private Repository
                </button>
                <button
                  type="button"
                  onClick={() => setPublishIsPrivate(false)}
                  className={`flex-1 py-1.5 px-3 rounded border text-xs font-medium flex items-center justify-center gap-1.5 ${
                    !publishIsPrivate
                      ? 'bg-gitlab-orange/20 border-gitlab-orange text-gitlab-orange'
                      : 'bg-base-0 border-border text-text-muted'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Public Repository
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPublishing || !publishName.trim()}
                onClick={handlePublishRepo}
                className="px-4 py-1.5 bg-gitlab-orange hover:bg-orange-600 text-white rounded text-xs font-semibold shadow"
              >
                {isPublishing ? 'Publishing...' : 'Publish Repository'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
