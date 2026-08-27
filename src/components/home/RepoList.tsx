import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useRepoStore } from '../../store/repoStore';
import { useGitStore } from '../../store/useGitStore';
import { SystemService } from '../../services/system/systemService';
import { getErrorMessage } from '../../shared/utils/errorUtils';
import { RepoCard } from './RepoCard';
import { Button } from '../common/Button';

type FilterTab = 'all' | 'pinned' | 'dirty' | 'gitlab' | 'github';

/**
 * Dashboard repository list & grid with search, filter tabs, view modes, and quick actions.
 */
export const RepoList: React.FC = () => {
  const { repos, statuses, addRepo } = useRepoStore();
  const { setIsCloneRepoModalOpen } = useGitStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      return (localStorage.getItem('repo_view_mode') as 'grid' | 'list') || 'grid';
    } catch {
      return 'grid';
    }
  });

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

  const pinnedCount = useMemo(() => repos.filter((r) => r.pinned).length, [repos]);
  const dirtyCount = useMemo(() => {
    let count = 0;
    Object.values(statuses).forEach((s) => {
      if (s && s.dirty_files > 0) count += 1;
    });
    return count;
  }, [statuses]);

  return (
    <div className="space-y-3.5 select-none font-sans">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Filter Pills */}
          <div className="h-6.5 flex items-center bg-base-1 border border-border rounded-sm p-0.5 gap-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`h-full px-2 rounded-xs text-[11px] font-medium transition cursor-pointer flex items-center gap-1 leading-none ${
                filterTab === 'all'
                  ? 'bg-base-2 text-text-primary font-semibold shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] font-mono text-text-faint">{repos.length}</span>
            </button>

            {pinnedCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterTab('pinned')}
                className={`h-full px-2 rounded-xs text-[11px] font-medium transition cursor-pointer flex items-center gap-1 leading-none ${
                  filterTab === 'pinned'
                    ? 'bg-base-2 text-commito-coral font-semibold shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Pin className="w-2.5 h-2.5" />
                <span>Pinned</span>
                <span className="text-[10px] font-mono text-text-faint">{pinnedCount}</span>
              </button>
            )}

            {dirtyCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterTab('dirty')}
                className={`h-full px-2 rounded-xs text-[11px] font-medium transition cursor-pointer flex items-center gap-1 leading-none ${
                  filterTab === 'dirty'
                    ? 'bg-git-modified-bg text-git-modified font-semibold shadow-xs border border-git-modified/30'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <FileEdit className="w-2.5 h-2.5" />
                <span>Changes</span>
                <span className="text-[10px] font-mono text-text-faint">{dirtyCount}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setFilterTab('gitlab')}
              className={`h-full px-2 rounded-xs text-[11px] font-medium transition cursor-pointer leading-none flex items-center ${
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
              className={`h-full px-2 rounded-xs text-[11px] font-medium transition cursor-pointer leading-none flex items-center ${
                filterTab === 'github'
                  ? 'bg-base-2 text-purple-400 font-semibold shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              GitHub
            </button>
          </div>
        </div>

        {/* Right: Search, View Mode & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Box */}
          <div className="relative w-44 sm:w-52 h-6.5 flex items-center">
            <Search className="w-3.5 h-3.5 text-text-faint absolute left-2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full h-full bg-base-1 border border-border rounded-sm pl-7 pr-6 text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-border-strong transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 p-0.5 text-text-faint hover:text-text-primary cursor-pointer flex items-center justify-center"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* View mode toggle */}
          <div className="h-6.5 flex items-center bg-base-1 border border-border rounded-sm p-0.5 gap-0.5 flex-shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setView('grid')}
              title="Grid view"
              className={`h-full w-5.5 rounded-xs transition cursor-pointer flex items-center justify-center ${
                viewMode === 'grid'
                  ? 'bg-base-2 text-text-primary shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-primary hover:bg-base-2/50'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              title="List view"
              className={`h-full w-5.5 rounded-xs transition cursor-pointer flex items-center justify-center ${
                viewMode === 'list'
                  ? 'bg-base-2 text-text-primary shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-primary hover:bg-base-2/50'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Clone Remote */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCloneRepo}
            leftIcon={<DownloadCloud className="w-3.5 h-3.5" />}
          >
            Clone
          </Button>

          {/* Open Local */}
          <Button
            type="button"
            variant="coral"
            size="sm"
            onClick={handleOpenFolderDialog}
            leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
          >
            Open Local
          </Button>
        </div>
      </div>

      {/* Repositories Display */}
      {filteredRepos.length > 0 ? (
        viewMode === 'grid' ? (
          <div
            className="animate-in fade-in duration-200"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
            }}
          >
            {filteredRepos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} status={statuses[repo.path]} viewMode="grid" />
            ))}

            {/* Quick Add Card */}
            <div
              onClick={handleOpenFolderDialog}
              className="border border-dashed border-border hover:border-commito-coral/50 bg-base-1/30 hover:bg-base-1/70 rounded-sm p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.99] group min-h-[130px] shadow-2xs"
            >
              <div className="w-7 h-7 rounded-sm bg-base-1 border border-border flex items-center justify-center text-text-faint group-hover:text-commito-coral group-hover:border-commito-coral/40 transition-colors mb-2">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-text-muted group-hover:text-text-primary transition-colors">
                Add Repository
              </span>
              <span className="text-[10.5px] text-text-faint mt-0.5">Open a local folder on disk</span>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
            {filteredRepos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} status={statuses[repo.path]} viewMode="list" />
            ))}

            {/* Add Row */}
            <div
              onClick={handleOpenFolderDialog}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-base-1/30 hover:bg-base-1/70 border border-dashed border-border hover:border-commito-coral/50 rounded-sm cursor-pointer transition-all duration-150 text-text-faint hover:text-text-primary text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Add Repository (Open Local Folder)</span>
            </div>
          </div>
        )
      ) : repos.length === 0 ? (
        /* Empty State */
        <div className="py-16 px-4 bg-base-1/50 border border-border rounded-sm flex flex-col items-center justify-center text-center space-y-3.5">
          <div className="w-12 h-12 rounded-sm bg-base-2 border border-border flex items-center justify-center text-text-faint shadow-xs">
            <FolderGit2 className="w-6 h-6 text-commito-coral opacity-80" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-text-primary">No Repositories Yet</h3>
            <p className="text-xs text-text-muted max-w-sm leading-relaxed">
              Open a local Git repository from your computer or clone one from GitLab / GitHub.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="coral"
              size="md"
              onClick={handleOpenFolderDialog}
              leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
            >
              Open Local Repository
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleCloneRepo}
              leftIcon={<DownloadCloud className="w-3.5 h-3.5" />}
            >
              Clone from Remote
            </Button>
          </div>
        </div>
      ) : (
        /* No Search / Filter Matches */
        <div className="py-8 text-center text-xs text-text-muted bg-base-1/50 border border-border rounded-sm">
          No repositories matching &ldquo;{searchQuery}&rdquo; in this filter view.
        </div>
      )}
    </div>
  );
};
