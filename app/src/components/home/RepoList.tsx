import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  DownloadCloud,
  FolderOpen,
  Plus,
  FolderGit2,
  LayoutGrid,
  List,
  X,
  Pin,
  FileEdit,
  PlusSquare,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { useRepoStore } from '../../store/repoStore';
import { useGitStore } from '../../store/useGitStore';
import { SystemService } from '../../services/system/systemService';
import { getErrorMessage } from '../../shared/utils/errorUtils';
import { RepoCard } from './RepoCard';
import { Button } from '../common/Button';

type FilterTab = 'all' | 'pinned' | 'dirty' | 'gitlab' | 'github';

/**
 * Dashboard repository list & grid with search, filter tabs, view modes, spotlight, and quick actions.
 */
export const RepoList: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const statuses = useRepoStore((s) => s.statuses);
  const isLoading = useRepoStore((s) => s.isLoading);
  const loadRepos = useRepoStore((s) => s.loadRepos);
  const addRepo = useRepoStore((s) => s.addRepo);
  const removeInvalidRepos = useRepoStore((s) => s.removeInvalidRepos);

  const { setIsCloneRepoModalOpen, setIsCreateRepoModalOpen } = useGitStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      return (localStorage.getItem('repo_view_mode') as 'grid' | 'list') || 'grid';
    } catch {
      return 'grid';
    }
  });

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut '/' or Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === 'k')) &&
        document.activeElement !== searchInputRef.current
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const setView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('repo_view_mode', mode);
    } catch {
      // ignore
    }
  };

  const handleOpenFolderDialog = async () => {
    try {
      const selectedPath = await SystemService.selectFolder();
      if (selectedPath) await addRepo(selectedPath);
    } catch (error: unknown) {
      alert(`Could not open repository: ${getErrorMessage(error)}`);
    }
  };

  const handleCloneRepo = () => {
    setIsCloneRepoModalOpen(true);
  };

  const handleCreateRepo = () => {
    setIsCreateRepoModalOpen(true);
  };

  // Filter repos by search query and category tab
  const filteredRepos = useMemo(() => {
    return repos.filter((r) => {
      // 1. Text search
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.path.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Tab filter
      const st = statuses[r.path];
      if (filterTab === 'pinned') return Boolean(r.pinned);
      if (filterTab === 'dirty') return Boolean(st && st.dirty_files > 0);
      if (filterTab === 'gitlab') return st?.remote_provider === 'gitlab';
      if (filterTab === 'github') return st?.remote_provider === 'github';

      return true;
    });
  }, [repos, statuses, searchQuery, filterTab]);

  const pinnedRepos = useMemo(() => repos.filter((r) => r.pinned), [repos]);
  const unpinnedFilteredRepos = useMemo(
    () => filteredRepos.filter((r) => !r.pinned),
    [filteredRepos]
  );

  const invalidRepos = useMemo(() => {
    return repos.filter((r) => statuses[r.path]?.is_valid === false);
  }, [repos, statuses]);

  const dirtyCount = useMemo(() => {
    let count = 0;
    Object.values(statuses).forEach((s) => {
      if (s && s.dirty_files > 0) count += 1;
    });
    return count;
  }, [statuses]);

  return (
    <div className="space-y-4 select-none font-sans w-full">
      {/* Missing / Invalid Repositories Top Alert Banner */}
      {invalidRepos.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-sm bg-base-1 border border-border text-xs text-text-primary shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-5 h-5 rounded-xs bg-git-removed-bg border border-git-removed/30 flex items-center justify-center shrink-0 text-git-removed">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0 text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">
                {invalidRepos.length} missing{' '}
                {invalidRepos.length === 1 ? 'repository' : 'repositories'}
              </span>
              <span className="text-border hidden sm:inline">•</span>
              <span className="text-text-muted hidden sm:inline truncate">
                Folder or <code className="font-mono text-[11px] text-text-secondary">.git</code>{' '}
                metadata could not be located on disk.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (
                confirm(
                  `Remove all ${invalidRepos.length} missing/invalid repositories from your workspace? (Files on disk will not be touched)`
                )
              ) {
                await removeInvalidRepos();
              }
            }}
            className="h-6.5 px-2.5 rounded-xs bg-git-removed-bg hover:bg-red-500/25 border border-git-removed/30 text-git-removed hover:text-red-300 text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0 active:scale-[0.98]"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clean Up Missing</span>
          </button>
        </div>
      )}

      {/* Top Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="h-7.5 flex items-center bg-base-1 border border-border rounded-sm p-0.5 gap-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`h-full px-2.5 rounded-xs text-[11.5px] font-medium transition cursor-pointer flex items-center gap-1.5 leading-none ${
                filterTab === 'all'
                  ? 'bg-base-2 text-text-primary font-semibold shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] font-mono text-text-muted">{repos.length}</span>
            </button>

            {pinnedRepos.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterTab('pinned')}
                className={`h-full px-2.5 rounded-xs text-[11.5px] font-medium transition cursor-pointer flex items-center gap-1.5 leading-none ${
                  filterTab === 'pinned'
                    ? 'bg-base-2 text-commito-coral font-semibold shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Pin className="w-3 h-3 fill-commito-coral/30" />
                <span>Pinned</span>
                <span className="text-[10px] font-mono text-text-muted">{pinnedRepos.length}</span>
              </button>
            )}

            {dirtyCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterTab('dirty')}
                className={`h-full px-2.5 rounded-xs text-[11.5px] font-medium transition cursor-pointer flex items-center gap-1.5 leading-none ${
                  filterTab === 'dirty'
                    ? 'bg-amber-500/15 text-amber-400 font-semibold shadow-xs border border-amber-500/30'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <FileEdit className="w-3 h-3" />
                <span>Changes</span>
                <span className="text-[10px] font-mono text-amber-400">{dirtyCount}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setFilterTab('gitlab')}
              className={`h-full px-2.5 rounded-xs text-[11.5px] font-medium transition cursor-pointer leading-none flex items-center ${
                filterTab === 'gitlab'
                  ? 'bg-base-2 text-commito-coral font-semibold shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              GitLab
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('github')}
              className={`h-full px-2.5 rounded-xs text-[11.5px] font-medium transition cursor-pointer leading-none flex items-center ${
                filterTab === 'github'
                  ? 'bg-base-2 text-purple-400 font-semibold shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              GitHub
            </button>
          </div>
        </div>

        {/* Right: Search & View Mode */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Box with Shortcut Badge */}
          <div className="relative w-48 sm:w-60 h-7.5 flex items-center">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search repositories..."
              className="w-full h-full bg-base-1 border border-border hover:border-border-strong rounded-sm pl-8 pr-12 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong transition shadow-2xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 p-0.5 text-text-muted hover:text-text-primary cursor-pointer flex items-center justify-center"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="absolute right-2 text-[10px] font-mono text-text-muted bg-base-2 border border-border px-1 py-0.2 rounded-xs pointer-events-none">
                /
              </span>
            )}
          </div>

          {/* View mode toggle */}
          <div className="h-7.5 flex items-center bg-base-1 border border-border rounded-sm p-0.5 gap-0.5 flex-shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setView('grid')}
              title="Grid view"
              className={`h-full w-6 rounded-xs transition cursor-pointer flex items-center justify-center outline-none focus:outline-none ${
                viewMode === 'grid'
                  ? 'bg-base-2 text-text-primary shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              title="List view"
              className={`h-full w-6 rounded-xs transition cursor-pointer flex items-center justify-center outline-none focus:outline-none ${
                viewMode === 'list'
                  ? 'bg-base-2 text-text-primary shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Spotlight: Pinned Favorites (Deduplicated Section) */}
      {filterTab === 'all' && !searchQuery && pinnedRepos.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
            <span className="flex items-center gap-1.5 text-commito-coral">
              <Pin className="w-3.5 h-3.5 fill-commito-coral/20" />
              <span className="text-text-primary">Pinned Favorites</span>
            </span>
            <span className="text-[11px] font-mono text-text-muted">
              {pinnedRepos.length} pinned
            </span>
          </div>
          {viewMode === 'grid' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: '10px',
              }}
            >
              {pinnedRepos.map((repo) => (
                <RepoCard
                  key={`pinned-${repo.id}`}
                  repo={repo}
                  status={statuses[repo.path]}
                  viewMode="grid"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {pinnedRepos.map((repo) => (
                <RepoCard
                  key={`pinned-${repo.id}`}
                  repo={repo}
                  status={statuses[repo.path]}
                  viewMode="list"
                />
              ))}
            </div>
          )}
          <div className="h-px bg-border my-2" />
        </div>
      )}

      {/* Repositories Display (Deduplicated with Pinned when in All mode) */}
      {filteredRepos.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="space-y-2">
            {filterTab === 'all' && !searchQuery && pinnedRepos.length > 0 && (
              <div className="text-xs font-semibold text-text-secondary">
                All Repositories ({repos.length})
              </div>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: '10px',
              }}
            >
              {/* If in All mode with pinned repos, render unpinned repos here so there's no duplication */}
              {(filterTab === 'all' && !searchQuery && pinnedRepos.length > 0
                ? unpinnedFilteredRepos
                : filteredRepos
              ).map((repo) => (
                <RepoCard key={repo.id} repo={repo} status={statuses[repo.path]} viewMode="grid" />
              ))}

              {/* Quick Add Card */}
              <button
                type="button"
                onClick={handleCreateRepo}
                className="border border-dashed border-border/80 hover:border-commito-coral/70 bg-base-1/25 hover:bg-base-1/60 rounded-sm p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] group min-h-[110px] shadow-2xs outline-none focus:outline-none"
              >
                <div className="w-6.5 h-6.5 rounded-sm bg-base-1 border border-border flex items-center justify-center text-text-muted group-hover:text-commito-coral group-hover:border-commito-coral/50 group-hover:bg-commito-coral/10 group-hover:scale-110 transition-all duration-200 mb-1.5 shadow-2xs">
                  <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200 ease-out" />
                </div>
                <span className="text-[11.5px] font-semibold text-text-secondary group-hover:text-commito-coral transition-colors duration-150">
                  Create or Add Repository
                </span>
                <span className="text-[10px] text-text-muted group-hover:text-text-secondary transition-colors duration-150 mt-0.5">
                  Start fresh or open local directory
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="flex flex-col gap-1.5">
            {(filterTab === 'all' && !searchQuery && pinnedRepos.length > 0
              ? unpinnedFilteredRepos
              : filteredRepos
            ).map((repo) => (
              <RepoCard key={repo.id} repo={repo} status={statuses[repo.path]} viewMode="list" />
            ))}

            {/* Add Row */}
            <button
              type="button"
              onClick={handleCreateRepo}
              className="flex items-center justify-center gap-2.5 px-4 py-2.5 bg-base-1/30 hover:bg-base-1/60 border border-dashed border-border/80 hover:border-commito-coral/70 rounded-sm cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xs active:scale-[0.995] text-text-muted hover:text-text-primary text-xs font-medium group outline-none focus:outline-none"
            >
              <div className="w-4.5 h-4.5 rounded-xs bg-base-1 border border-border/70 flex items-center justify-center text-text-muted group-hover:text-commito-coral group-hover:border-commito-coral/50 group-hover:bg-commito-coral/10 group-hover:scale-110 transition-all duration-200 shadow-2xs">
                <Plus className="w-3 h-3 flex-shrink-0 group-hover:rotate-90 transition-transform duration-200 ease-out" />
              </div>
              <span className="group-hover:text-commito-coral transition-colors duration-150 font-semibold text-text-secondary">
                Create or Add New Repository
              </span>
            </button>
          </div>
        )
      ) : isLoading && repos.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3.5 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-36 bg-base-1/40 border border-border/40 rounded-sm p-4 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-1/2 h-4 bg-base-2 rounded-xs" />
                <div className="w-3/4 h-3 bg-base-2 rounded-xs" />
              </div>
              <div className="w-1/3 h-3 bg-base-2 rounded-xs" />
            </div>
          ))}
        </div>
      ) : repos.length === 0 ? (
        /* Empty State */
        <div className="py-16 px-4 bg-base-1/50 border border-border rounded-sm flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-sm bg-base-2 border border-border flex items-center justify-center text-text-muted shadow-xs">
            <FolderGit2 className="w-6 h-6 text-commito-coral" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-text-primary">No Repositories Yet</h3>
            <p className="text-xs text-text-secondary max-w-sm leading-relaxed">
              Create a new Git repository, open an existing folder from your computer, or clone one
              from GitLab / GitHub.
            </p>
          </div>
          <div className="flex items-center gap-2.5 pt-1 flex-wrap justify-center">
            <Button
              type="button"
              variant="coral"
              size="sm"
              onClick={handleCreateRepo}
              leftIcon={<PlusSquare className="w-3.5 h-3.5" />}
            >
              New Repository
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCloneRepo}
              leftIcon={<DownloadCloud className="w-3.5 h-3.5" />}
            >
              Clone Remote
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleOpenFolderDialog}
              leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
            >
              Open Local Folder
            </Button>
          </div>
        </div>
      ) : (
        /* No Search / Filter Matches */
        <div className="py-10 text-center text-xs text-text-muted bg-base-1/50 border border-border rounded-sm space-y-2">
          <p>No repositories matching &ldquo;{searchQuery}&rdquo; in this filter view.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterTab('all');
            }}
            className="text-commito-coral hover:underline text-xs cursor-pointer font-medium"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};
