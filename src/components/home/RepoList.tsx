import React, { useState } from 'react';
import { Search, DownloadCloud, FolderOpen, Plus, FolderGit2, LayoutGrid, List } from 'lucide-react';
import { useRepoStore } from '../../store/repoStore';
import { useGitStore } from '../../store/useGitStore';
import { SystemService } from '../../services/system/systemService';
import { getErrorMessage } from '../../shared/utils/errorUtils';
import { RepoCard } from './RepoCard';

/**
 * Dashboard repository grid/list with search, view modes, and quick-launch actions.
 */
export const RepoList: React.FC = () => {
  const { repos, statuses, addRepo } = useRepoStore();
  const { setIsRepoModalOpen, setActiveModalTab } = useGitStore();
  const [searchQuery, setSearchQuery] = useState('');
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
    } catch {}
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
    setActiveModalTab('repos');
    setIsRepoModalOpen(true);
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3 select-none">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3 h-3 text-text-faint absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search repositories..."
            className="w-full bg-base-1 border border-border rounded-sm pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-border-strong transition"
          />
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-base-1 border border-border rounded-sm p-0.5 gap-0.5 flex-shrink-0">
          <button
            onClick={() => setView('grid')}
            title="Grid view"
            className={`p-1 rounded-sm transition cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-base-3 text-text-primary'
                : 'text-text-faint hover:text-text-muted'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setView('list')}
            title="List view"
            className={`p-1 rounded-sm transition cursor-pointer ${
              viewMode === 'list'
                ? 'bg-base-3 text-text-primary'
                : 'text-text-faint hover:text-text-muted'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={handleCloneRepo}
          className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer flex-shrink-0"
        >
          <DownloadCloud className="w-3.5 h-3.5" />
          Clone
        </button>
        <button
          onClick={handleOpenFolderDialog}
          className="px-2.5 py-1.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer flex-shrink-0"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Open Local
        </button>
      </div>

      {/* Repo list/grid */}
      {filteredRepos.length > 0 ? (
        viewMode === 'grid' ? (
          <div
            className="animate-in fade-in duration-200"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '10px',
            }}
          >
            {filteredRepos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} status={statuses[repo.path]} viewMode="grid" />
            ))}

            {/* Add tile */}
            <div
              onClick={handleOpenFolderDialog}
              className="border border-dashed border-border hover:border-border-strong bg-transparent hover:bg-base-1 rounded-sm p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] group min-h-[120px]"
            >
              <div className="w-7 h-7 rounded-sm bg-base-1 border border-border flex items-center justify-center text-text-faint group-hover:text-text-muted group-hover:border-border-strong transition-colors mb-2">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-medium text-text-muted group-hover:text-text-primary transition-colors">
                Add Repository
              </span>
              <span className="text-[10px] text-text-faint mt-0.5">Open a local folder</span>
            </div>
          </div>
        ) : (
          /* List view */
          <div className="flex flex-col gap-2 animate-in fade-in duration-200">
            {filteredRepos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} status={statuses[repo.path]} viewMode="list" />
            ))}
            {/* Add row */}
            <div
              onClick={handleOpenFolderDialog}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-base-1/50 hover:bg-base-1 border border-dashed border-border hover:border-border-strong rounded-sm cursor-pointer transition-all duration-150 hover:translate-x-0.5 active:scale-[0.998] text-text-faint hover:text-text-muted text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Add Repository</span>
            </div>
          </div>
        )
      ) : repos.length === 0 ? (
        /* Empty state */
        <div className="py-14 px-4 bg-base-1 border border-border rounded-sm flex flex-col items-center justify-center text-center space-y-3">
          <FolderGit2 className="w-10 h-10 text-text-faint opacity-30" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-text-primary">No Repositories</h3>
            <p className="text-xs text-text-muted max-w-xs">
              Open a local folder or clone from a remote to get started.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleOpenFolderDialog}
              className="px-3 py-1.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Open Local
            </button>
            <button
              onClick={handleCloneRepo}
              className="px-3 py-1.5 bg-base-2 hover:bg-base-3 border border-border text-text-primary rounded-sm text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              Clone Remote
            </button>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-text-muted bg-base-1 border border-border rounded-sm">
          No results for &ldquo;{searchQuery}&rdquo;
        </div>
      )}
    </div>
  );
};
