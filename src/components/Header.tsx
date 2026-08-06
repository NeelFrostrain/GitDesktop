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
  X
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { BranchInfo, RepoStatus, PullResult } from '../types/git';
import { GitLabProject } from '../types/gitlab';

export const Header: React.FC = () => {
  const {
    activeRepoPath,
    setActiveRepoPath,
    status,
    setStatus,
    user,
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
    try {
      await invoke('fetch_remote', { repoPath: activeRepoPath });
      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
      setLastFetchedTimestamp(Date.now());
    } catch (err: any) {
      setError({ code: err.code || 'NETWORK_ERROR', message: err.message || String(err) });
    } finally {
      setIsFetching(false);
    }
  };

  const handlePush = async () => {
    if (!activeRepoPath || !status?.current_branch) return;
    setIsPushing(true);
    setError(null);
    try {
      await invoke('push_to_remote', { repoPath: activeRepoPath, branch: status.current_branch });
      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
    } catch (err: any) {
      setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) });
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    if (!activeRepoPath || !status?.current_branch) return;
    setIsPulling(true);
    setError(null);
    try {
      const result = await invoke<PullResult>('pull_from_remote', {
        repoPath: activeRepoPath,
        branch: status.current_branch,
      });

      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);

      if (!result.success && result.conflicts.length > 0) {
        setError({
          code: 'GIT_CONFLICT_ERROR',
          message: `Merge conflicts detected in ${result.conflicts.length} files. Please resolve conflicts below.`,
        });
      }
    } catch (err: any) {
      setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) });
    } finally {
      setIsPulling(false);
    }
  };

  const handlePublishRepo = async () => {
    if (!activeRepoPath || !publishName.trim()) return;
    setIsPublishing(true);
    setPublishError(null);
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
    } catch (err: any) {
      setPublishError(err.message || String(err));
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
          className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 transition text-xs font-medium flex items-center gap-1.5 shadow-sm"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          Pull {behind} commit{behind > 1 ? 's' : ''}
        </button>
      );
    }

    if (ahead > 0) {
      return (
        <button
          onClick={handlePush}
          className="px-3 py-1.5 bg-gitlab-teal text-white rounded hover:bg-teal-600 transition text-xs font-medium flex items-center gap-1.5 shadow-sm"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          Push {ahead} commit{ahead > 1 ? 's' : ''}
        </button>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleFetch}
          className="px-3 py-1.5 bg-base-2 text-text-primary hover:bg-base-3 border border-border rounded transition text-xs font-medium flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-gitlab-orange" />
          Fetch origin
        </button>
        {lastFetchedTimestamp && (
          <span className="text-[11px] text-text-muted font-normal hidden lg:inline">
            {Math.floor((Date.now() - lastFetchedTimestamp) / 1000 / 60)}m ago
          </span>
        )}
      </div>
    );
  };

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(branchSearch.toLowerCase())
  );

  return (
    <header className="h-12 bg-base-0 border-b border-border px-3 flex items-center justify-between select-none z-30 relative">
      {/* Left: GitHub Desktop Repository & Branch Selector */}
      <div className="flex items-center gap-2">
        {/* Repository Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsRepoDropdownOpen(!isRepoDropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 bg-base-2 hover:bg-base-3 border border-border rounded text-xs text-text-primary font-medium transition"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-gitlab-orange" />
            <span className="max-w-[150px] truncate">{repoName}</span>
            <ChevronDown className="w-3 h-3 text-text-muted" />
          </button>

          {isRepoDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-64 bg-base-2 border border-border rounded-md shadow-2xl py-1 z-50">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-text-faint uppercase tracking-wider">
                Current Repository
              </div>
              <div className="px-3 py-2 text-xs text-text-primary font-medium border-b border-border flex items-center justify-between">
                <span className="truncate">{repoName}</span>
                {activeRepoPath && <Check className="w-3.5 h-3.5 text-gitlab-orange" />}
              </div>
              <button
                onClick={handleOpenLocalRepo}
                className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-base-3 flex items-center gap-2"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-text-muted" />
                Add Existing Local Repository...
              </button>
              <button
                onClick={() => {
                  setIsRepoDropdownOpen(false);
                  setActiveModalTab('repos');
                  setIsRepoModalOpen(true);
                }}
                className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-base-3 flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 text-text-muted" />
                Clone Repository from GitLab...
              </button>
            </div>
          )}
        </div>

        {/* Branch Selector */}
        <div className="relative">
          <button
            disabled={!activeRepoPath}
            onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
            className={`flex items-center gap-2 px-2.5 py-1.5 bg-base-2 border border-border rounded text-xs text-text-primary font-medium transition ${
              !activeRepoPath ? 'opacity-50 cursor-not-allowed' : 'hover:bg-base-3'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-gitlab-teal" />
            <span className="max-w-[130px] truncate">{status?.current_branch || 'main'}</span>
            <ChevronDown className="w-3 h-3 text-text-muted" />
          </button>

          {isBranchDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-72 bg-base-2 border border-border rounded-md shadow-2xl p-2 z-50">
              <input
                type="text"
                placeholder="Filter branches..."
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-base-0 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-gitlab-orange mb-2"
              />

              <div className="max-h-48 overflow-y-auto mb-2 space-y-0.5">
                {filteredBranches.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => handleSwitchBranch(b.name)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between ${
                      b.is_current
                        ? 'bg-gitlab-orange/20 text-gitlab-orange font-semibold'
                        : 'text-text-primary hover:bg-base-3'
                    }`}
                  >
                    <span className="truncate">{b.name}</span>
                    {b.is_current && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
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

      {/* Far Right: Account & Settings */}
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

        <button
          onClick={() => {
            setActiveModalTab('login');
            setIsRepoModalOpen(true);
          }}
          className="flex items-center gap-2 px-2.5 py-1 bg-base-2 hover:bg-base-3 border border-border rounded transition text-xs"
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Avatar" className="w-4 h-4 rounded-full" />
          ) : (
            <User className="w-3.5 h-3.5 text-gitlab-orange" />
          )}
          <span className="text-text-primary font-medium text-xs">{user ? user.username : 'Sign In'}</span>
        </button>
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
