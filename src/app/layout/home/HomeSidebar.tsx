import React, { useState, useMemo } from 'react';
import { Search, X, Plus, FolderGit2, Download } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useRepoStore, openRepo } from '../../../features/repos';
import { useGitStore } from '../../../store/useGitStore';
import { HomeSidebarRepoItem } from './HomeSidebarRepoItem';
import { HomeSidebarAccountFooter } from './HomeSidebarAccountFooter';

export const HomeSidebar: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);
  const statuses = useRepoStore((s) => s.statuses);
  const addRepo = useRepoStore((s) => s.addRepo);
  const activeRepoPath = useGitStore((s) => s.activeRepoPath);
  const setIsCloneRepoModalOpen = useGitStore((s) => s.setIsCloneRepoModalOpen);
  const [filterQuery, setFilterQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);

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
      {/* Search bar */}
      <div className="px-2.5 pt-2.5 pb-2 flex-shrink-0 border-b border-border">
        <div className="relative">
          <Search className="w-3 h-3 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter repositories..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-7 pr-6 py-1.5 bg-base-1 border border-border rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-border-strong font-sans transition"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Section label */}
      <div className="px-3 py-1.5 flex items-center justify-between flex-shrink-0">
        <span className="text-[10px] font-semibold text-text-faint uppercase tracking-widest">
          Repositories
        </span>
        <span className="text-[10px] text-text-faint tabular-nums">{filteredRepos.length}</span>
      </div>

      {/* Repo list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 min-h-0 scrollbar-thin scrollbar-thumb-base-3">
        {filteredRepos.length === 0 ? (
          <div className="py-8 text-center text-text-muted">
            <FolderGit2 className="w-7 h-7 mx-auto mb-2 opacity-20" />
            <p className="text-[11px] text-text-faint">
              {filterQuery ? 'No matches' : 'No repositories'}
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

        {/* Add / Clone Actions */}
        <div className="grid grid-cols-2 gap-1.5 mt-1 pt-1">
          <button
            type="button"
            onClick={handleAddRepo}
            disabled={isAdding}
            className="py-1.5 px-2 rounded-sm border border-dashed border-border/60 hover:border-border text-text-faint hover:text-text-muted flex items-center justify-center gap-1.5 transition cursor-pointer text-[11px]"
            title="Open existing local repository"
          >
            <Plus className="w-3 h-3" />
            <span>{isAdding ? 'Selecting...' : 'Open Local'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCloneRepoModalOpen(true)}
            className="py-1.5 px-2 rounded-sm border border-dashed border-border/60 hover:border-commito-coral/40 hover:text-commito-coral text-text-faint flex items-center justify-center gap-1.5 transition cursor-pointer text-[11px]"
            title="Clone repository from remote URL"
          >
            <Download className="w-3 h-3" />
            <span>Clone Repo</span>
          </button>
        </div>
      </div>

      {/* Account footer */}
      <HomeSidebarAccountFooter />
    </div>
  );
};
