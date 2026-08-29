import React, { useState, useEffect } from 'react';
import { Search, FolderGit2, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { UnifiedRepo, PagedResult } from '../../../types/gitlab';
import { useGitStore } from '../../../store/useGitStore';
import { useLogStore } from '../../../store/useLogStore';
import { AccountService } from '../../../services/accounts/accountService';
import { SystemService } from '../../../services/system/systemService';
import { getErrorMessage, toAppError } from '../../../shared/utils/errorUtils';

/**
 * Tab component for browsing, searching, and cloning remote repositories from connected providers.
 */
export const RemoteReposTab: React.FC = () => {
  const { user, setActiveRepoPath, setIsRepoModalOpen, setError } = useGitStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagedData, setPagedData] = useState<PagedResult<UnifiedRepo> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cloningRepoId, setCloningRepoId] = useState<number | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadRemoteRepos = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await AccountService.fetchUserRepositories(page, 15, debouncedSearch);
      setPagedData(res);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Remote', `Failed to fetch remote repositories: ${msg}`);
      setError(toAppError(error, 'REMOTE_FETCH_ERROR'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRemoteRepos();
  }, [page, debouncedSearch, user]);

  const handleClone = async (repo: UnifiedRepo) => {
    setCloningRepoId(repo.id);
    useLogStore.getState().addLog('info', 'Git', `Initiating clone for '${repo.name}'...`);
    try {
      const targetFolder = await SystemService.selectFolder();
      if (!targetFolder) {
        setCloningRepoId(null);
        return;
      }

      const cloneUrl = repo.http_url_to_repo || repo.ssh_url_to_repo;
      const finalPath = await AccountService.cloneRepository(cloneUrl, targetFolder);

      useLogStore.getState().addLog('success', 'Git', `Successfully cloned repository '${repo.name}' to '${finalPath}'`);
      setActiveRepoPath(finalPath);
      setIsRepoModalOpen(false);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      setError(toAppError(error, 'CLONE_ERROR'));
      useLogStore.getState().addLog('error', 'Git', `Clone failed: ${msg}`, msg);
    } finally {
      setCloningRepoId(null);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-sm bg-base-1">
        <FolderGit2 className="w-12 h-12 text-text-muted mb-3 opacity-40" />
        <h4 className="text-sm font-semibold text-text-primary mb-1">No Active Account</h4>
        <p className="text-xs text-text-muted max-w-sm mb-4">
          Please connect an account in the Accounts or Add Account tab to view and clone remote repositories.
        </p>
      </div>
    );
  }

  const repos = pagedData?.items || [];
  const totalPages = pagedData?.total_pages || 1;

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="flex items-center gap-2 bg-base-1 border border-border hover:border-border-strong rounded-sm px-2.5 py-1.5 focus-within:border-border-strong">
        <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter repositories by name or namespace..."
          className="w-full bg-transparent text-xs text-text-primary focus:outline-none"
        />
        {isLoading && <RefreshCw className="w-3 h-3 text-commito-coral animate-spin shrink-0" />}
      </div>

      {/* Repo List */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {repos.length === 0 && !isLoading ? (
          <div className="p-8 text-center text-xs text-text-muted italic">No repositories found.</div>
        ) : (
          repos.map((repo) => {
            const isCloning = cloningRepoId === repo.id;

            return (
              <div
                key={repo.id}
                className="p-3 rounded-sm border border-border bg-base-1 hover:border-text-muted/30 transition flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-text-primary truncate">{repo.name}</span>
                    <span className="text-[10px] text-text-muted truncate">{repo.path_with_namespace}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-base-2 border border-border text-text-muted">
                      {repo.visibility}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-text-muted mt-1">
                    {repo.default_branch && <span>Branch: {repo.default_branch}</span>}
                    {repo.star_count > 0 && <span>★ {repo.star_count}</span>}
                  </div>
                </div>

                <button
                  onClick={() => handleClone(repo)}
                  disabled={isCloning}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-commito-coral text-white text-xs font-semibold hover:bg-commito-coralLight transition disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {isCloning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {isCloning ? 'Cloning...' : 'Clone'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-text-muted">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="p-1 rounded bg-base-2 hover:bg-base-3 border border-border disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-1 rounded bg-base-2 hover:bg-base-3 border border-border disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
