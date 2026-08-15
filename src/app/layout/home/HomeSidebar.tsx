import React, { useState, useMemo } from 'react';
import { Home, Search, X, Plus, FolderGit2 } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useRepoStore, openRepo } from '../../../features/repos';
import { useGitStore } from '../../../store/useGitStore';
import { HomeSidebarRepoItem } from './HomeSidebarRepoItem';
import { HomeSidebarAccountFooter } from './HomeSidebarAccountFooter';

export const HomeSidebar: React.FC = () => {
  const { repos, statuses, addRepo } = useRepoStore();
  const activeRepoPath = useGitStore((s) => s.activeRepoPath);
  const [filterQuery, setFilterQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Filter and sort repos: Pinned first, then by last opened / name
  const filteredRepos = useMemo(() => {
    let list = [...repos];
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.path.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.last_opened_at || 0) - (a.last_opened_at || 0);
    });
  }, [repos, filterQuery]);

  const handleAddRepo = async () => {
    try {
      setIsAdding(true);
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select Git Repository Folder',
      });

      if (selected && typeof selected === 'string') {
        await addRepo(selected);
        await openRepo(selected);
      }
    } catch (err) {
      console.warn('Failed to add repository:', err);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-base-0 overflow-hidden select-none text-xs">
      {/* Top Header: Home Navigation Item */}
      <div className="p-2.5 border-b border-border space-y-2 flex-shrink-0">
        <button
          type="button"
          className="w-full px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center justify-between bg-commito-coral text-white shadow-sm cursor-default"
        >
          <div className="flex items-center gap-2">
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        </button>

        {/* Filter Repositories Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter repositories..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1 bg-base-2 border border-border rounded-md text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Repo Quick-List Header & Content */}
      <div className="px-3 py-1.5 bg-base-1/50 border-b border-border/60 flex items-center justify-between text-[11px] font-semibold text-text-muted uppercase tracking-wider flex-shrink-0">
        <span>Repositories ({filteredRepos.length})</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0 scrollbar-thin scrollbar-thumb-base-3">
        {filteredRepos.length === 0 ? (
          <div className="p-6 text-center text-text-muted">
            <FolderGit2 className="w-8 h-8 mx-auto mb-2 text-text-faint opacity-40" />
            <p className="text-xs font-medium text-text-secondary">
              {filterQuery ? 'No matching repositories' : 'No repositories found'}
            </p>
            <p className="text-[11px] mt-1 text-text-muted">
              {filterQuery
                ? 'Try a different filter search term.'
                : 'Add a repository below or create one on the Home dashboard.'}
            </p>
          </div>
        ) : (
          filteredRepos.map((repo) => (
            <HomeSidebarRepoItem
              key={repo.id || repo.path}
              repo={repo}
              status={statuses[repo.path]}
              isActive={repo.path === activeRepoPath}
            />
          ))
        )}

        {/* Compact "+ Add Repository" button */}
        <button
          type="button"
          onClick={handleAddRepo}
          disabled={isAdding}
          className="w-full p-2 mt-1 rounded-md border border-dashed border-border/80 hover:border-commito-coral/50 hover:bg-base-2 text-text-muted hover:text-text-primary flex items-center justify-center gap-1.5 transition cursor-pointer font-medium text-xs"
        >
          <Plus className="w-3.5 h-3.5 text-commito-coral" />
          <span>{isAdding ? 'Selecting folder...' : 'Add Repository'}</span>
        </button>
      </div>

      {/* Pinned Account Footer */}
      <HomeSidebarAccountFooter />
    </div>
  );
};
