import React, { useState, useEffect, useRef, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  Search,
  FolderGit2,
  RefreshCw,
  ChevronDown,
  Check,
  Plus,
  ArrowLeftRight,
  Lock,
  Globe,
  Loader2,
  Folder,
} from 'lucide-react';
import { UnifiedRepo, PagedResult } from '../../../types/gitlab';
import { useGitStore } from '../../../store/useGitStore';
import { useLogStore } from '../../../store/useLogStore';
import { useRepoStore, openRepo } from '../../../features/repos';
import { useAccountServicesStore } from '../../../features/account-services';
import { AccountService } from '../../../services/accounts/accountService';
import { GitService } from '../../../services/git/gitService';
import { getErrorMessage, toAppError } from '../../../shared/utils/errorUtils';
import { useTaskStore } from '../../../features/task-manager';
import { useToastStore } from '../../../store/useToastStore';

interface RemoteAccountReposTabProps {
  parentPath: string;
  onSelectParentPath: () => void;
  onClose: () => void;
}

export const RemoteAccountReposTab: React.FC<RemoteAccountReposTabProps> = ({
  parentPath,
  onSelectParentPath,
  onClose,
}) => {
  const { setActiveRepoPath, setStatus, setError } = useGitStore();
  const addRepo = useRepoStore((s) => s.addRepo);
  const { accounts, activeAccount, setActiveAccount, openModalWithTab, loadAccounts } =
    useAccountServicesStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagedData, setPagedData] = useState<PagedResult<UnifiedRepo> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cloningRepoId, setCloningRepoId] = useState<number | null>(null);
  const [cloneProgress, setCloneProgress] = useState<{
    stage: string;
    percent: number;
    detail: string;
    message: string;
  } | null>(null);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Listen to backend real-time git clone progress events
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setupListener = async () => {
      try {
        unlisten = await listen<{
          stage: string;
          percent: number;
          detail: string;
          message: string;
        }>('git:clone:progress', (event) => {
          setCloneProgress(event.payload);
        });
      } catch (err) {
        console.warn('Failed to listen to git clone progress:', err);
      }
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ensure accounts are loaded on mount
  useEffect(() => {
    loadAccounts().catch(() => {});
  }, [loadAccounts]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const currentAcc = activeAccount || accounts[0] || null;
  const currentHandle =
    currentAcc?.handle?.replace(/^@/, '') || currentAcc?.display_name || 'Account';
  const currentProvider = (currentAcc?.provider || 'github').toLowerCase();

  // Clear stale data immediately whenever the active account or provider changes
  useEffect(() => {
    setPagedData(null);
    setPage(1);
  }, [currentAcc?.id, currentAcc?.provider]);

  const loadRemoteRepos = async () => {
    if (!currentAcc && accounts.length === 0) return;
    setIsLoading(true);
    try {
      const res = await AccountService.fetchUserRepositories(
        page,
        30,
        debouncedSearch,
        currentAcc?.id,
        currentAcc?.provider
      );
      setPagedData(res);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore
        .getState()
        .addLog('error', 'Remote', `Failed to fetch remote repositories: ${msg}`);
      setError(toAppError(error, 'REMOTE_FETCH_ERROR'));
      setPagedData({ items: [], page: 1, total_pages: 1 });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRemoteRepos();
  }, [page, debouncedSearch, currentAcc?.id, currentAcc?.provider]);

  const handleSelectAccount = async (accId: string) => {
    setIsAccountDropdownOpen(false);
    setPagedData(null);
    try {
      await setActiveAccount(accId);
    } catch (e) {
      console.warn('Failed to switch account:', e);
    }
  };

  const handleImportClone = async (repo: UnifiedRepo) => {
    setCloningRepoId(repo.id);
    const repoName = repo.name || 'cloned-repo';
    const targetFolder = parentPath
      ? `${parentPath.replace(/[/\\]+$/, '')}\\${repoName}`
      : repoName;

    const cloneUrl = repo.http_url_to_repo || repo.ssh_url_to_repo;

    // Check if repository already exists locally
    try {
      const existingStatus = await GitService.getRepoStatus(targetFolder);
      if (existingStatus) {
        await addRepo(targetFolder);
        await openRepo(targetFolder);
        setActiveRepoPath(targetFolder);
        setStatus(existingStatus);
        useToastStore.getState().showToast({
          type: 'info',
          title: 'Repository Opened',
          message: `'${repo.name}' already exists locally at '${targetFolder}'. Opened repository!`,
        });
        useLogStore
          .getState()
          .addLog('info', 'Git', `Repository '${repo.name}' already exists at '${targetFolder}'. Opened existing repository.`);
        setCloningRepoId(null);
        onClose();
        return;
      }
    } catch {
      // Folder is not an existing Git repo, proceed to clone
    }

    const taskId = useTaskStore.getState().addTask({
      type: 'clone',
      title: `Cloning ${repoName}`,
      description: `Cloning from ${cloneUrl} into ${targetFolder}`,
      repoName,
      remoteUrl: cloneUrl,
      localPath: targetFolder,
    });

    useLogStore
      .getState()
      .addLog('info', 'Git', `Initiating clone for '${repo.name}' into '${targetFolder}'...`);

    try {
      const finalPath = await AccountService.cloneRepository(cloneUrl, targetFolder);

      useTaskStore.getState().completeTask(taskId);

      useToastStore.getState().showToast({
        type: 'success',
        title: 'Clone Completed',
        message: `Successfully cloned '${repo.name}' to '${finalPath}'`,
      });

      useLogStore
        .getState()
        .addLog(
          'success',
          'Git',
          `Successfully cloned repository '${repo.name}' to '${finalPath}'`
        );

      await addRepo(finalPath);
      await openRepo(finalPath);

      setActiveRepoPath(finalPath);
      const statusRes = await GitService.getRepoStatus(finalPath);
      setStatus(statusRes);

      onClose();
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useTaskStore.getState().failTask(taskId, msg);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Clone Failed',
        message: msg,
      });
      setError(toAppError(error, 'CLONE_ERROR'));
      useLogStore.getState().addLog('error', 'Git', `Clone failed: ${msg}`, msg);
    } finally {
      setCloningRepoId(null);
    }
  };

  const getProviderIcon = (provider: string) => {
    const p = provider.toLowerCase();
    if (p === 'github') {
      return (
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      );
    }
    if (p === 'gitlab') {
      return (
        <svg className="w-3.5 h-3.5 fill-current text-commito-coral" viewBox="0 0 24 24">
          <path d="m23.6 9.89-1.29-3.96a.99.99 0 0 0-.37-.47.98.98 0 0 0-.6-.18.99.99 0 0 0-.6.18.99.99 0 0 0-.37.47L18.9 10.3H5.1L3.63 5.93a.99.99 0 0 0-.37-.47.98.98 0 0 0-.6-.18.99.99 0 0 0-.6.18.99.99 0 0 0-.37.47L.4 9.89a1.98 1.98 0 0 0 .72 2.22L12 20.84l10.88-8.73a1.98 1.98 0 0 0 .72-2.22z" />
        </svg>
      );
    }
    return <FolderGit2 className="w-3.5 h-3.5" />;
  };

  const repos = pagedData?.items || [];
  const filteredRepos = repos.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.path_with_namespace && r.path_with_namespace.toLowerCase().includes(q))
    );
  });

  // Group repositories by organization / owner (matching GitHub Desktop)
  const groupedRepos = useMemo<Record<string, UnifiedRepo[]>>(() => {
    const groups: Record<string, UnifiedRepo[]> = {};
    for (const repo of filteredRepos) {
      const namespace = repo.path_with_namespace
        ? repo.path_with_namespace.split('/')[0]
        : currentHandle;
      const isOwner =
        namespace.toLowerCase() === currentHandle.toLowerCase() ||
        namespace.toLowerCase() === (currentAcc?.handle || '').replace(/^@/, '').toLowerCase();
      const groupKey = isOwner ? 'Your repositories' : namespace;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(repo);
    }
    return groups;
  }, [filteredRepos, currentHandle, currentAcc]);

  if (accounts.length === 0) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center space-y-3 select-none">
        <div className="w-12 h-12 rounded-sm bg-base-1 border border-border flex items-center justify-center text-text-muted">
          <FolderGit2 className="w-6 h-6 text-commito-coral" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-text-primary">No Connected Accounts Found</h4>
          <p className="text-[11.5px] text-text-muted max-w-sm mx-auto">
            Connect your GitHub, GitLab, or Bitbucket account to browse, search, and clone all your
            private and public repositories in one click.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModalWithTab('add')}
          className="h-8 px-4 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-98"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Connect Git Account</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans select-none">
      {/* Top Filter Bar: Account Switcher & Search Box */}
      <div className="flex items-center gap-2.5">
        {/* Account Selector Dropdown Button */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
            className="h-8.5 px-3 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs text-text-primary flex items-center gap-2 transition cursor-pointer shadow-2xs min-w-[150px] justify-between"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0">{getProviderIcon(currentProvider)}</span>
              <span className="font-bold text-xs truncate max-w-[110px]">{currentHandle}</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-text-muted transition-transform duration-150 shrink-0 ${
                isAccountDropdownOpen ? 'rotate-180 text-commito-coral' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {isAccountDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-60 bg-base-1 border border-border-strong rounded-sm shadow-2xl z-50 py-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Accounts
              </div>

              {accounts.map((acc) => {
                const isSelected = activeAccount?.id === acc.id;
                const cleanAccHandle = acc.handle.replace(/^@/, '') || acc.display_name;

                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleSelectAccount(acc.id)}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-commito-coral/15 text-commito-coral font-bold'
                        : 'hover:bg-base-2 text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0">{getProviderIcon(acc.provider)}</span>
                      <span className="truncate">{cleanAccHandle}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-commito-coral shrink-0" />}
                  </button>
                );
              })}

              <div className="border-t border-border/70 my-1" />

              <button
                type="button"
                onClick={() => {
                  setIsAccountDropdownOpen(false);
                  openModalWithTab('accounts');
                }}
                className="w-full px-3 py-1.5 text-left text-[11px] text-text-secondary hover:text-text-primary hover:bg-base-2 transition flex items-center gap-2 cursor-pointer font-medium"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-text-muted" />
                <span>Switch Git Provider</span>
              </button>
            </div>
          )}
        </div>

        {/* Search Repositories Input */}
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search repositories..."
            className="w-full h-8.5 pl-8 pr-8 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none transition shadow-2xs font-sans"
          />
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          {isLoading && (
            <RefreshCw className="w-3.5 h-3.5 text-commito-coral animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
          )}
        </div>
      </div>

      {/* Real-time Clone Progress Indicator */}
      {cloningRepoId !== null && (
        <div className="p-2.5 bg-base-1 border border-border rounded-sm space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Loader2 className="w-3.5 h-3.5 text-commito-coral animate-spin shrink-0" />
              <span className="font-semibold text-text-primary text-xs truncate">
                {cloneProgress?.stage || 'Cloning selected repository...'}
              </span>
            </div>
            <span className="font-mono text-commito-coral font-bold text-xs shrink-0">
              {cloneProgress?.percent || 0}%
            </span>
          </div>

          <div className="w-full h-1 bg-base-0 rounded-full overflow-hidden border border-border/80 relative">
            <div
              className="h-full bg-commito-coral transition-all duration-200 ease-out rounded-full relative"
              style={{ width: `${Math.max(4, cloneProgress?.percent || 4)}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10.5px] text-text-muted font-mono">
            <span className="truncate max-w-[85%]">
              {cloneProgress?.detail || 'Downloading repository objects...'}
            </span>
            <span className="shrink-0">{cloneProgress?.percent || 0}%</span>
          </div>
        </div>
      )}

      {/* Repositories List Container */}
      <div className="bg-base-1/40 border border-border rounded-sm overflow-hidden min-h-[320px] max-h-[420px] overflow-y-auto divide-y divide-border/60">
        {isLoading && filteredRepos.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-2 text-text-muted">
            <Loader2 className="w-5 h-5 text-commito-coral animate-spin" />
            <span className="text-xs">Fetching repositories for {currentHandle}...</span>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="p-16 text-center text-xs text-text-muted italic">
            {searchQuery.trim()
              ? `No repositories found matching "${searchQuery}"`
              : 'No repositories found for this account.'}
          </div>
        ) : (
          Object.entries(groupedRepos).map(([groupName, groupList]) => (
            <div key={groupName} className="divide-y divide-border/40">
              <div className="px-4 py-1.5 bg-base-2/80 text-[11px] font-bold text-text-muted uppercase tracking-wider rounded-t-sm sticky top-0 z-10 backdrop-blur-xs flex items-center justify-between">
                <span>{groupName}</span>
                <span className="text-[10px] font-mono opacity-80">{groupList.length}</span>
              </div>
              {groupList.map((repo) => {
                const isCloning = cloningRepoId === repo.id;
                const isPrivate = repo.visibility === 'private';

                return (
                  <div
                    key={repo.id}
                    className="px-4 py-3 hover:bg-base-1/80 transition-colors flex items-center justify-between gap-3 group"
                  >
                    {/* Left: Repo metadata */}
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-xs text-text-primary truncate group-hover:text-commito-coral transition">
                            {repo.name}
                          </span>
                          {isPrivate ? (
                            <span title="Private repository" className="inline-flex items-center">
                              <Lock className="w-3 h-3 text-text-muted shrink-0" />
                            </span>
                          ) : (
                            <span title="Public repository" className="inline-flex items-center">
                              <Globe className="w-3 h-3 text-text-muted shrink-0" />
                            </span>
                          )}
                        </div>

                        {repo.path_with_namespace && (
                          <div className="text-[11px] text-text-muted truncate font-mono mt-0.5">
                            {repo.path_with_namespace}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Import / Clone Action Button */}
                    <button
                      type="button"
                      onClick={() => handleImportClone(repo)}
                      disabled={isCloning || cloningRepoId !== null}
                      className="h-7.5 px-3.5 bg-base-0 hover:bg-base-2 border border-border hover:border-border-strong text-text-primary rounded-sm text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50 shrink-0 active:scale-98"
                    >
                      {isCloning ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-commito-coral" />
                          <span>Cloning...</span>
                        </>
                      ) : (
                        <span>Clone</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Destination Location Info Bar */}
      <div className="p-2.5 bg-base-1/70 border border-border rounded-sm flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-2 min-w-0 truncate pr-2">
          <Folder className="w-3.5 h-3.5 text-gitlab-teal shrink-0" />
          <span className="truncate">
            Clones into:{' '}
            <span className="font-mono text-text-primary font-semibold">{parentPath}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onSelectParentPath}
          className="text-[11px] font-semibold text-commito-coral hover:text-commito-coralLight transition cursor-pointer shrink-0"
        >
          Change Path...
        </button>
      </div>
    </div>
  );
};
