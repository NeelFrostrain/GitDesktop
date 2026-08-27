import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  PlusSquare,
  FolderPlus,
  Download,
  FolderGit2,
  GitBranch,
  FileEdit,
  Pin,
  Trash2,
} from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useRepoStore, openRepo } from '../../features/repos';
import { useGitStore } from '../../store/useGitStore';

interface RepoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RepoDrawer: React.FC<RepoDrawerProps> = ({ isOpen, onClose }) => {
  const { repos, statuses, loadRepos, addRepo, removeRepo, pinRepo } = useRepoStore();
  const {
    activeRepoPath,
    setIsCreateRepoModalOpen,
    setIsCloneRepoModalOpen,
  } = useGitStore();

  const [filterQuery, setFilterQuery] = useState('');
  const [isAddingLocal, setIsAddingLocal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('repo_drawer_width');
      return saved ? Math.max(300, Math.min(900, parseInt(saved, 10))) : 420;
    } catch {
      return 420;
    }
  });

  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const maxWidth = Math.min(900, window.innerWidth - 60);
      const newWidth = Math.max(300, Math.min(maxWidth, window.innerWidth - e.clientX));
      setDrawerWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem('repo_drawer_width', drawerWidth.toString());
      } catch { }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, drawerWidth]);

  // Load repos & focus search when opening
  useEffect(() => {
    if (isOpen) {
      loadRepos();
      setFilterQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [isOpen, loadRepos]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter and sort repos
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
      // Active repo first if not searching
      if (!filterQuery) {
        if (a.path === activeRepoPath) return -1;
        if (b.path === activeRepoPath) return 1;
      }
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.last_opened_at || 0) - (a.last_opened_at || 0);
    });
  }, [repos, filterQuery, activeRepoPath]);

  // Actions
  const handleSelectRepo = async (path: string) => {
    onClose();
    await openRepo(path);
  };

  const handleAddLocalRepo = async () => {
    try {
      setIsAddingLocal(true);
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select Git Repository Folder',
      });
      if (selected && typeof selected === 'string') {
        await addRepo(selected);
        await openRepo(selected);
        onClose();
      }
    } catch (err) {
      console.warn('Failed to add repository:', err);
    } finally {
      setIsAddingLocal(false);
    }
  };

  const handleCreateNewRepo = () => {
    onClose();
    setIsCreateRepoModalOpen(true);
  };

  const handleCloneRepo = () => {
    onClose();
    setIsCloneRepoModalOpen(true);
  };

  const handleRemoveRepo = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await removeRepo(id);
    } catch (err) {
      console.warn('Failed to remove repository:', err);
    }
  };

  const handlePinToggle = (e: React.MouseEvent, id: string, currentPinned: boolean) => {
    e.stopPropagation();
    pinRepo(id, !currentPinned);
  };

  const renderProvider = (provider?: string | null) => {
    if (provider === 'gitlab')
      return (
        <span className="text-[9px] font-mono font-bold uppercase text-commito-coral bg-commito-coral/10 border border-commito-coral/20 px-1.5 py-0.5 rounded-sm">
          GitLab
        </span>
      );
    if (provider === 'github')
      return (
        <span className="text-[9px] font-mono font-bold uppercase text-purple-400 bg-purple-900/30 border border-purple-700/30 px-1.5 py-0.5 rounded-sm">
          GitHub
        </span>
      );
    return null;
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end select-none font-sans">
      {/* Solid Backdrop (No Blur) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 cursor-default"
      />

      {/* Slide-over Right Drawer */}
      <div
        style={{ width: `${drawerWidth}px` }}
        className="relative max-w-full h-full bg-base-0 border-l border-border shadow-2xl flex flex-col z-10 text-text-primary"
      >
        {/* Resizable handle on the left border */}
        <div
          onMouseDown={startResizing}
          onDoubleClick={() => setDrawerWidth(420)}
          title="Drag to resize drawer • Double-click to reset"
          className={`absolute top-0 -left-1 w-1 h-full cursor-col-resize z-30 transition-colors flex items-center justify-center ${isResizing ? 'bg-commito-coral' : 'hover:bg-commito-coral/60'
            }`}
        />

        {/* 1. Drawer Header (Compact) */}
        <div className="px-3.5 py-2 border-b border-border bg-base-1 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0">
              <FolderGit2 className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-xs font-bold text-text-primary leading-none">Switch Repository</h2>
              <span className="text-border">•</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-xs bg-base-2 text-text-muted border border-border">
                {repos.length}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer shrink-0"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. Unified Search & Action Toolbar */}
        <div className="px-3 py-2 border-b border-border bg-base-0/80 space-y-1.5 flex-shrink-0">
          {/* Search Filter Input */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search repositories by name or path..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-8 pr-7 h-7 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none transition shadow-2xs font-sans"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="absolute right-2 p-0.5 text-text-muted hover:text-text-primary rounded-sm transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sleek Horizontal Action Buttons with Unified Theme Background */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={handleAddLocalRepo}
              disabled={isAddingLocal}
              className="h-7.5 px-2 rounded-sm bg-base-1 hover:bg-base-2 active:bg-base-3 border border-border hover:border-border-strong text-text-primary flex items-center justify-center gap-1.5 transition-all cursor-pointer group active:scale-95 disabled:opacity-50 shadow-2xs"
              title="Add an existing local Git repository folder"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-105 transition-transform flex-shrink-0" />
              <span className="text-[11px] font-semibold truncate leading-none">
                {isAddingLocal ? 'Adding...' : 'Add Local'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCreateNewRepo}
              className="h-7.5 px-2 rounded-sm bg-base-1 hover:bg-base-2 active:bg-base-3 border border-border hover:border-border-strong text-text-primary flex items-center justify-center gap-1.5 transition-all cursor-pointer group active:scale-95 shadow-2xs"
              title="Create a brand new Git repository"
            >
              <PlusSquare className="w-3.5 h-3.5 text-sky-400 group-hover:scale-105 transition-transform flex-shrink-0" />
              <span className="text-[11px] font-semibold truncate leading-none">Create</span>
            </button>

            <button
              type="button"
              onClick={handleCloneRepo}
              className="h-7.5 px-2 rounded-sm bg-base-1 hover:bg-base-2 active:bg-base-3 border border-border hover:border-border-strong text-text-primary flex items-center justify-center gap-1.5 transition-all cursor-pointer group active:scale-95 shadow-2xs"
              title="Clone repository from remote GitLab/GitHub"
            >
              <Download className="w-3.5 h-3.5 text-commito-coral group-hover:scale-105 transition-transform flex-shrink-0" />
              <span className="text-[11px] font-semibold truncate leading-none">Clone</span>
            </button>
          </div>
        </div>

        {/* 3. Repository List (Compact Sleek Cards) */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-base-3 min-h-0">
          {filteredRepos.length === 0 ? (
            <div className="py-12 px-4 text-center text-text-muted flex flex-col items-center justify-center select-none">
              <FolderGit2 className="w-7 h-7 mx-auto mb-2 text-text-faint opacity-40" />
              <p className="text-xs font-medium text-text-muted">
                {filterQuery ? `No repositories matching "${filterQuery}"` : 'No repositories found'}
              </p>
              <p className="text-[11px] text-text-faint mt-1 max-w-xs">
                {filterQuery ? 'Try a different search keyword.' : 'Add a local repository folder or create a new one.'}
              </p>
            </div>
          ) : (
            filteredRepos.map((repo) => {
              const isActive = repo.path === activeRepoPath;
              const status = statuses[repo.path];
              const isDirty = Boolean(status && status.dirty_files > 0);

              return (
                <div
                  key={repo.id || repo.path}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectRepo(repo.path)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectRepo(repo.path);
                    }
                  }}
                  className={`group relative px-3 py-2 rounded-sm border transition-colors cursor-pointer flex items-center justify-between gap-2 select-none ${isActive
                      ? 'bg-base-2 border-border-strong text-text-primary shadow-xs'
                      : repo.pinned
                        ? 'bg-base-1 border-border-strong shadow-xs'
                        : 'bg-base-1/50 border-border/60 hover:border-border-strong hover:bg-base-2/60 shadow-xs'
                    }`}
                >
                  {/* Left: Icon + Title & Path */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <FolderGit2
                      className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isActive ? 'text-commito-coral' : 'text-text-faint group-hover:text-commito-coral'
                        }`}
                    />

                    <div className="min-w-0 flex-1">
                      {/* Top Line: Name + Provider Tag + Branch Chip */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-xs font-semibold truncate leading-none transition-colors ${isActive ? 'text-commito-coral' : 'text-text-primary group-hover:text-commito-coral'
                            }`}
                          title={repo.name}
                        >
                          {repo.name}
                        </span>
                        {renderProvider(status?.remote_provider)}
                        <div className="h-4 px-1 inline-flex items-center gap-0.5 bg-base-0 border border-border/70 rounded-xs text-[9.5px] font-mono text-text-muted">
                          <GitBranch className="w-2 h-2 text-commito-coral flex-shrink-0" />
                          <span className="truncate max-w-[140px]">{status?.current_branch || 'main'}</span>
                        </div>
                      </div>

                      {/* Bottom Line: File Path */}
                      <p className="text-[10px] text-text-faint font-mono truncate mt-0.5 leading-none" title={repo.path}>
                        {repo.path}
                      </p>
                    </div>
                  </div>

                  {/* Right: Status chip */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isDirty ? (
                      <div className="h-4.5 px-1.5 inline-flex items-center gap-1 bg-git-modified-bg border border-git-modified/30 rounded-sm text-[9.5px] font-mono text-git-modified font-semibold">
                        <FileEdit className="w-2.5 h-2.5" />
                        <span>{status!.dirty_files}</span>
                      </div>
                    ) : (
                      <div className="h-4.5 px-1.5 inline-flex items-center gap-1 text-[9.5px] font-mono text-git-clean bg-git-added-bg border border-git-added/20 rounded-sm">
                        <span className="w-1 h-1 rounded-full bg-git-added" />
                        <span>Clean</span>
                      </div>
                    )}

                    {repo.pinned && (
                      <button
                        type="button"
                        onClick={(e) => handlePinToggle(e, repo.id, repo.pinned)}
                        className="p-0.5 text-commito-coral group-hover:opacity-0 transition-opacity"
                        title="Pinned"
                      >
                        <Pin className="w-3 h-3 fill-commito-coral/30" />
                      </button>
                    )}
                  </div>

                  {/* Absolute Hover Actions: Overlays on hover perfectly centered */}
                  <div
                    className={`absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center gap-0.5 px-1 py-0.5 rounded-sm border border-border/50 shadow-xs ${isActive ? 'bg-base-2' : repo.pinned ? 'bg-base-1' : 'bg-base-2'
                      }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => handlePinToggle(e, repo.id, repo.pinned)}
                      className={`w-5 h-5 flex items-center justify-center rounded-sm hover:bg-base-3 transition cursor-pointer ${repo.pinned ? 'text-commito-coral' : 'text-text-faint hover:text-text-primary'
                        }`}
                      title={repo.pinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin className={`w-3 h-3 ${repo.pinned ? 'fill-commito-coral/30' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveRepo(e, repo.id)}
                      className="w-5 h-5 flex items-center justify-center rounded-sm text-text-faint hover:text-git-removed hover:bg-git-removed-bg transition cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
