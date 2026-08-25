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
  Check,
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

function truncatePath(path: string, maxLen = 38): string {
  if (path.length <= maxLen) return path;
  const parts = path.replace(/\\/g, '/').split('/');
  if (parts.length <= 3) return path;
  return `${parts[0]}/.../${parts[parts.length - 1]}`;
}

export const RepoDrawer: React.FC<RepoDrawerProps> = ({ isOpen, onClose }) => {
  const { repos, statuses, loadRepos, addRepo, removeRepo, pinRepo } = useRepoStore();
  const {
    activeRepoPath,
    setIsCreateRepoModalOpen,
    setIsRepoModalOpen,
    setActiveModalTab,
  } = useGitStore();

  const [filterQuery, setFilterQuery] = useState('');
  const [isAddingLocal, setIsAddingLocal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    setActiveModalTab('repos');
    setIsRepoModalOpen(true);
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

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end select-none font-sans">
      {/* Solid Backdrop (No Blur) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 animate-in fade-in duration-150 cursor-default"
      />

      {/* Slide-over Right Drawer (Solid Dark Background matching Sidebar) */}
      <div className="relative w-full max-w-sm sm:max-w-md h-full bg-base-0 border-l border-border shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 text-text-primary">
        {/* 1. Drawer Header */}
        <div className="px-4 py-3 border-b border-border bg-base-0 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center">
              <FolderGit2 className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-text-primary tracking-wide leading-tight">Switch Repository</h2>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-sm bg-base-2 text-text-muted border border-border/60">
                {repos.length}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Unified Search & Action Toolbar */}
        <div className="p-3 border-b border-border bg-base-0 space-y-2 flex-shrink-0">
          {/* Search Filter Input */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search repositories by name or path..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-8 pr-7 h-8 bg-base-1/60 hover:bg-base-1 focus:bg-base-1 border border-border/60 hover:border-border-strong focus:border-commito-coral/70 rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-commito-coral/20 font-sans transition-all shadow-xs"
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

          {/* Sleek Horizontal Action Buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={handleAddLocalRepo}
              disabled={isAddingLocal}
              className="h-7.5 px-2 rounded-sm bg-base-1/60 hover:bg-base-2 border border-border/60 hover:border-border-strong text-text-primary flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs group disabled:opacity-50"
              title="Add an existing local Git repository folder"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-105 transition-transform flex-shrink-0" />
              <span className="text-[11px] font-medium leading-none truncate">
                {isAddingLocal ? 'Adding...' : 'Add Local'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCreateNewRepo}
              className="h-7.5 px-2 rounded-sm bg-base-1/60 hover:bg-base-2 border border-border/60 hover:border-border-strong text-text-primary flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs group"
              title="Create a brand new Git repository"
            >
              <PlusSquare className="w-3.5 h-3.5 text-blue-400 group-hover:scale-105 transition-transform flex-shrink-0" />
              <span className="text-[11px] font-medium leading-none truncate">Create</span>
            </button>

            <button
              type="button"
              onClick={handleCloneRepo}
              className="h-7.5 px-2 rounded-sm bg-base-1/60 hover:bg-base-2 border border-border/60 hover:border-border-strong text-text-primary flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs group"
              title="Clone repository from remote GitLab/GitHub"
            >
              <Download className="w-3.5 h-3.5 text-commito-coral group-hover:scale-105 transition-transform flex-shrink-0" />
              <span className="text-[11px] font-medium leading-none truncate">Clone</span>
            </button>
          </div>
        </div>

        {/* 3. Repository List (Rich Cards with CommitCard and ChangeFileList tokens) */}
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
              const branchName = status?.current_branch || 'main';
              const isClean = status ? status.dirty_files === 0 : true;

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
                  className={`group relative p-2.5 rounded-sm border cursor-pointer transition-all duration-150 flex items-center justify-between gap-2.5 text-left select-none ${
                    isActive
                      ? 'bg-base-2/90 border-border-strong text-text-primary shadow-xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.75 before:bg-commito-coral before:rounded-r-xs'
                      : 'bg-base-1/40 border-border/50 hover:bg-base-2/70 hover:border-border-strong/60 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-6 h-6 rounded-sm flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform group-hover:scale-105 ${
                        isActive
                          ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/25'
                          : 'bg-base-2 text-text-muted border border-border/60 group-hover:text-commito-coral'
                      }`}
                    >
                      <FolderGit2 className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-semibold leading-tight truncate ${isActive ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>
                          {repo.name}
                        </span>

                        {isActive && (
                          <span className="text-[9.5px] font-mono font-medium px-1.5 py-0.2 rounded-sm bg-commito-coral/15 text-commito-coral border border-commito-coral/30 flex-shrink-0">
                            active
                          </span>
                        )}

                        {repo.pinned && (
                          <span title="Pinned repository" className="flex items-center">
                            <Pin className="w-2.5 h-2.5 text-commito-coral fill-commito-coral/40 flex-shrink-0" />
                          </span>
                        )}
                      </div>

                      {/* Branch & Status Chips */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="h-4.5 px-1.5 inline-flex items-center gap-1 rounded-sm bg-base-2 border border-border/70 text-[10px] font-mono text-text-subtle flex-shrink-0">
                          <GitBranch className="w-2.5 h-2.5 text-commito-coral flex-shrink-0" />
                          <span className="truncate max-w-[120px]">{branchName}</span>
                        </div>

                        <div
                          className={`h-4.5 px-1.5 inline-flex items-center rounded-sm text-[10px] font-mono font-medium border flex-shrink-0 ${
                            isClean
                              ? 'bg-git-added/10 text-git-added border-git-added/25'
                              : 'bg-git-modified/10 text-git-modified border-git-modified/25'
                          }`}
                        >
                          <span>{isClean ? 'clean' : `${status?.dirty_files} modified`}</span>
                        </div>
                      </div>

                      {/* File Path */}
                      <p className="text-[10px] text-text-muted font-mono mt-1.5 truncate leading-none" title={repo.path}>
                        {truncatePath(repo.path)}
                      </p>
                    </div>
                  </div>

                  {/* Actions on right */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isActive ? (
                      <div className="w-5 h-5 rounded-full bg-commito-coral/10 border border-commito-coral/25 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-commito-coral stroke-[2.5]" />
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handlePinToggle(e, repo.id, repo.pinned)}
                          title={repo.pinned ? 'Unpin' : 'Pin to top'}
                          className={`p-1 rounded-sm text-text-faint hover:text-text-primary hover:bg-base-3 transition cursor-pointer ${
                            repo.pinned ? 'opacity-100 text-commito-coral' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Pin className={`w-3 h-3 ${repo.pinned ? 'fill-commito-coral/40' : ''}`} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleRemoveRepo(e, repo.id)}
                          title="Remove from workspace registry"
                          className="p-1 rounded-sm text-text-faint hover:text-git-removed hover:bg-base-3 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
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
