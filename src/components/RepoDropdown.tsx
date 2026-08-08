import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { 
  Search, 
  FolderGit2, 
  FolderPlus, 
  Download, 
  Lock, 
  Globe, 
  ExternalLink,
  ChevronDown,
  Layers,
  PlusSquare
} from 'lucide-react';

import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { RepoStatus } from '../types/git';
import { UnifiedRepo } from '../types/gitlab';

interface RepoDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRect: DOMRect | null;
}

export const RepoDropdown: React.FC<RepoDropdownProps> = ({
  isOpen,
  onClose,
  triggerRect,
}) => {
  const {
    activeRepoPath,
    setActiveRepoPath,
    recentRepos,
    addRecentRepo,
    setStatus,
    setError,
    setIsRepoModalOpen,
    setIsCreateRepoModalOpen,
    setActiveModalTab,
    user,
  } = useGitStore();


  const [filterQuery, setFilterQuery] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [userRepos, setUserRepos] = useState<UnifiedRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        (!addMenuRef.current || !addMenuRef.current.contains(e.target as Node))
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Close Add sub-menu on outside click
  useEffect(() => {
    const handleAddMenuOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    if (showAddMenu) {
      document.addEventListener('mousedown', handleAddMenuOutside);
    }
    return () => document.removeEventListener('mousedown', handleAddMenuOutside);
  }, [showAddMenu]);

  // Fetch user projects once opened
  useEffect(() => {
    if (isOpen && user) {
      setIsLoadingRepos(true);
      invoke<any>('fetch_user_repositories', { page: 1, provider: user.provider })
        .then((res) => {
          if (res && res.items) {
            setUserRepos(res.items);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingRepos(false));
    }
  }, [isOpen, user]);


  if (!isOpen || !triggerRect) return null;



  const handleSelectRepoPath = async (repoPath: string) => {
    try {
      setActiveRepoPath(repoPath);
      addRecentRepo(repoPath);
      useLogStore.getState().addLog('info', 'Repo', `Switched repository to '${repoPath}'`);
      
      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath });
      setStatus(newStatus);
    } catch (err: any) {
      setError({ code: 'REPO_SWITCH_ERROR', message: err.message || String(err) });
    }
    onClose();
  };

  const handleOpenLocalRepo = async () => {
    setShowAddMenu(false);
    try {
      const selected = await invoke<string | null>('select_folder_cmd');
      if (selected) {
        await handleSelectRepoPath(selected);
      }
    } catch (err: any) {
      setError({ code: 'SELECT_FOLDER_ERROR', message: err.message || String(err) });
    }
  };

  const handleCloneRepo = () => {
    setShowAddMenu(false);
    onClose();
    setActiveModalTab('repos');
    setIsRepoModalOpen(true);
  };

  const handleCreateNewRepo = () => {
    setShowAddMenu(false);
    onClose();
    setIsCreateRepoModalOpen(true);
  };

  const handleViewAllRepos = () => {
    onClose();
    setActiveModalTab('repos');
    setIsRepoModalOpen(true);
  };


  // Helper to extract repo name from path
  const getRepoName = (path: string) => {
    return path.split(/[/\\]/).filter(Boolean).pop() || path;
  };

  // Filter recent repos
  const filteredRecentRepos = recentRepos.filter((path) => {
    const name = getRepoName(path);
    return name.toLowerCase().includes(filterQuery.toLowerCase()) || path.toLowerCase().includes(filterQuery.toLowerCase());
  });

  // Filter user remote repos
  const filteredUserRepos = userRepos.filter((repo) => {
    return (
      repo.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      repo.path_with_namespace.toLowerCase().includes(filterQuery.toLowerCase())
    );
  });

  const menuWidth = Math.max(triggerRect.width, 320);
  const leftPos = Math.min(triggerRect.left, window.innerWidth - menuWidth - 10);
  const topPos = triggerRect.bottom + 6;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        left: `${leftPos}px`,
        top: `${topPos}px`,
        width: `${menuWidth}px`,
      }}
      className="fixed z-[9999] bg-base-1/95 backdrop-blur-md border border-border rounded-md shadow-2xl overflow-hidden flex flex-col max-h-[460px] text-xs font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* Top Filter Bar & Add Dropdown */}
      <div className="p-2.5 border-b border-border bg-base-0/80 flex items-center gap-2 flex-shrink-0">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter repositories..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 bg-base-2 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral transition"
            autoFocus
          />
        </div>

        {/* Add Dropdown Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="px-2.5 py-1 bg-commito-coral hover:bg-commito-coralHover text-white rounded-md text-xs font-bold flex items-center gap-1 transition shadow-sm cursor-pointer"
          >
            <span>Add</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showAddMenu ? 'rotate-180' : ''}`} />
          </button>

          {showAddMenu && (
            <div
              ref={addMenuRef}
              className="absolute right-0 top-8 z-10 w-52 bg-base-1 border border-border rounded-md shadow-xl p-1 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                onClick={handleOpenLocalRepo}
                className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2 transition text-left cursor-pointer font-medium"
              >
                <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Local Repository</span>
              </button>
              <button
                type="button"
                onClick={handleCreateNewRepo}
                className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2 transition text-left cursor-pointer font-medium"
              >
                <PlusSquare className="w-3.5 h-3.5 text-blue-400" />
                <span>Create New Repository</span>
              </button>
              <button
                type="button"
                onClick={handleCloneRepo}
                className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2 transition text-left cursor-pointer font-medium"
              >
                <Download className="w-3.5 h-3.5 text-commito-coral" />
                <span>Clone Repository</span>
              </button>
            </div>
          )}


        </div>
      </div>

      {/* Repositories Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-3">
        {/* Section 1: Recent Repositories */}
        <div>
          <div className="px-2 py-1 text-[10px] font-extrabold text-text-muted uppercase tracking-wider flex items-center justify-between">
            <span>Recent Repositories</span>
            <span className="font-mono text-[9px] bg-base-2 px-1.5 py-0.2 rounded border border-border">
              {filteredRecentRepos.length}
            </span>
          </div>

          {filteredRecentRepos.length === 0 ? (
            <div className="px-3 py-2 text-text-muted italic text-[11px]">
              No recent repositories found
            </div>
          ) : (
            <div className="space-y-0.5 mt-0.5">
              {filteredRecentRepos.map((path) => {
                const name = getRepoName(path);
                const isActive = activeRepoPath === path;

                return (
                  <div
                    key={path}
                    onClick={() => handleSelectRepoPath(path)}
                    className={`w-full px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 transition cursor-pointer ${
                      isActive
                        ? 'bg-commito-activeBg text-commito-activeText font-semibold border border-commito-activeText/20'
                        : 'hover:bg-base-2 text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FolderGit2 className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-commito-coral' : 'text-text-muted'}`} />
                      <div className="min-w-0 truncate">
                        <span className="block truncate text-xs font-bold leading-snug">{name}</span>
                        <span className="block truncate text-[10px] text-text-muted font-mono leading-tight">{path}</span>
                      </div>
                    </div>

                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-commito-coral shadow-sm shadow-commito-coral/50 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Account Repositories */}
        {user && (
          <div>
            <div className="px-2 py-1 text-[10px] font-extrabold text-text-muted uppercase tracking-wider flex items-center justify-between border-t border-border/50 pt-2">
              <span>{user.name || user.username} Projects</span>
              <span className="font-mono text-[9px] bg-base-2 px-1.5 py-0.2 rounded border border-border">
                {filteredUserRepos.length}
              </span>
            </div>

            {isLoadingRepos ? (
              <div className="px-3 py-2 text-text-muted text-[11px] animate-pulse">
                Loading projects...
              </div>
            ) : filteredUserRepos.length === 0 ? (
              <div className="px-3 py-2 text-text-muted italic text-[11px]">
                No matching projects
              </div>
            ) : (
              <div className="space-y-0.5 mt-0.5">
                {filteredUserRepos.map((repo) => {
                  const isPrivate = repo.visibility === 'private';

                  return (
                    <div
                      key={repo.id}
                      onClick={handleCloneRepo}
                      className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center justify-between gap-2 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isPrivate ? (
                          <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0 truncate">
                          <span className="block truncate text-xs font-bold leading-snug">{repo.name}</span>
                          <span className="block truncate text-[10px] text-text-muted font-mono leading-tight">
                            {repo.path_with_namespace}
                          </span>
                        </div>
                      </div>

                      <ExternalLink className="w-3 h-3 text-text-muted hover:text-text-primary flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Bar: View All Repositories */}
      <div className="p-2 border-t border-border bg-base-0 flex items-center justify-between flex-shrink-0">
        <button
          type="button"
          onClick={handleViewAllRepos}
          className="w-full px-3 py-1.5 bg-base-2 hover:bg-base-3 border border-border rounded-md text-xs font-bold text-text-secondary hover:text-text-primary flex items-center justify-center gap-2 transition cursor-pointer"
        >

          <Layers className="w-3.5 h-3.5 text-commito-coral" />
          <span>View All Repositories & Accounts...</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
