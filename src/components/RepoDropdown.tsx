import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import {
  Search,
  FolderGit2,
  FolderPlus,
  Download,
  Lock,
  Globe,
  PlusSquare,
  X,
  Check,
  GitBranch,
  Loader2,
  Plus,
  Layers,
  UserCheck,
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

// ─── Utility Helpers ─────────────────────────────────────────────────────────

function getRepoName(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() || path;
}

function truncatePath(path: string, maxLen = 38): string {
  if (path.length <= maxLen) return path;
  const parts = path.replace(/\\/g, '/').split('/');
  if (parts.length <= 3) return path;
  return `${parts[0]}/.../${parts[parts.length - 1]}`;
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

/** Section Label Header */
function SectionHeader({ title, count, badge }: { title: string; count?: number; badge?: string }) {
  return (
    <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
          {title}
        </span>
        {badge && (
          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-base-3 text-text-secondary border border-border">
            {badge}
          </span>
        )}
      </div>
      {count !== undefined && (
        <span className="text-[10px] font-mono text-text-muted bg-base-2 px-1.5 py-0.2 rounded border border-border">
          {count}
        </span>
      )}
    </div>
  );
}

/** Active / Current Repository Banner Card */
function ActiveRepoCard({
  path,
  status,
  onClick,
}: {
  path: string;
  status: RepoStatus | null;
  onClick: () => void;
}) {
  const name = getRepoName(path);
  const branch = status?.current_branch || 'HEAD';
  const isClean = status?.is_clean ?? true;
  const fileCount = status?.files?.length || 0;

  return (
    <div
      onClick={onClick}
      className="mx-2 my-1 px-3 py-2 rounded-md bg-commito-activeBg/50 border border-commito-coral/30 hover:border-commito-coral/50 transition cursor-pointer group shadow-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center flex-shrink-0">
            <FolderGit2 className="w-3.5 h-3.5 text-commito-coral" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-text-primary truncate">{name}</span>
              <span className="text-[9px] font-extrabold px-1 rounded bg-commito-coral/20 text-commito-coral border border-commito-coral/30">
                ACTIVE
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-muted font-mono">
              <span className="flex items-center gap-1 text-text-secondary truncate">
                <GitBranch className="w-2.5 h-2.5 text-commito-coral" />
                {branch}
              </span>
              <span>•</span>
              <span className={isClean ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                {isClean ? 'clean' : `${fileCount} change${fileCount === 1 ? '' : 's'}`}
              </span>
            </div>
            <p className="text-[9.5px] text-text-muted font-mono mt-0.5 truncate" title={path}>
              {truncatePath(path)}
            </p>
          </div>
        </div>
        <div className="w-4 h-4 rounded-full bg-commito-coral/20 border border-commito-coral/40 flex items-center justify-center flex-shrink-0">
          <Check className="w-2.5 h-2.5 text-commito-coral" />
        </div>
      </div>
    </div>
  );
}

/** Individual Repository Row */
function RepoRow({
  path,
  isActive,
  onSelect,
  onRemove,
}: {
  path: string;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const name = getRepoName(path);

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between gap-2 px-2.5 py-1.5 mx-1.5 rounded-md cursor-pointer transition ${
        isActive
          ? 'bg-commito-activeBg text-commito-activeText font-semibold border border-commito-coral/30'
          : 'hover:bg-base-2 text-text-primary'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <FolderGit2
          className={`w-3.5 h-3.5 flex-shrink-0 ${
            isActive ? 'text-commito-coral' : 'text-text-muted group-hover:text-text-secondary'
          }`}
        />
        <div className="min-w-0">
          <span className="block truncate text-xs font-bold leading-snug">{name}</span>
          <span className="block truncate text-[10px] text-text-muted font-mono leading-tight" title={path}>
            {truncatePath(path)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {isActive ? (
          <Check className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-base-3 text-text-muted hover:text-red-400 transition"
            title="Remove from recent repositories"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Cloud Remote Repository Row */
function CloudRepoRow({ repo, onClone }: { repo: UnifiedRepo; onClone: () => void }) {
  const isPrivate = repo.visibility === 'private';

  return (
    <div
      onClick={onClone}
      className="group flex items-center justify-between gap-2 px-2.5 py-1.5 mx-1.5 rounded-md hover:bg-base-2 text-text-primary cursor-pointer transition"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {isPrivate ? (
          <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        ) : (
          <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <span className="block truncate text-xs font-bold leading-snug">{repo.name}</span>
          <span className="block truncate text-[10px] text-text-muted font-mono leading-tight">
            {repo.path_with_namespace}
          </span>
        </div>
      </div>

      <Download className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 group-hover:text-commito-coral transition flex-shrink-0" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const RepoDropdown: React.FC<RepoDropdownProps> = ({ isOpen, onClose, triggerRect }) => {
  const {
    activeRepoPath,
    setActiveRepoPath,
    recentRepos,
    addRecentRepo,
    removeRecentRepo,
    setStatus,
    setError,
    setIsRepoModalOpen,
    setIsCreateRepoModalOpen,
    setActiveModalTab,
    user,
    status,
  } = useGitStore();

  const [filterQuery, setFilterQuery] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [userRepos, setUserRepos] = useState<UnifiedRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
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
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Close Add sub-menu on click outside
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

  // Fetch remote projects when dropdown opens
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

  // ── Actions ─────────────────────────────────────────────────────────────────

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

  const handleManageAccounts = () => {
    onClose();
    setActiveModalTab('accounts');
    setIsRepoModalOpen(true);
  };

  // ── Filtering ───────────────────────────────────────────────────────────────

  const queryLower = filterQuery.trim().toLowerCase();

  const filteredRecentRepos = useMemo(() => {
    return recentRepos.filter((path) => {
      const name = getRepoName(path).toLowerCase();
      const fullPath = path.toLowerCase();
      return name.includes(queryLower) || fullPath.includes(queryLower);
    });
  }, [recentRepos, queryLower]);

  const filteredUserRepos = useMemo(() => {
    return userRepos.filter((repo) => {
      return (
        repo.name.toLowerCase().includes(queryLower) ||
        repo.path_with_namespace.toLowerCase().includes(queryLower)
      );
    });
  }, [userRepos, queryLower]);

  // Positioning
  const menuWidth = Math.max(triggerRect.width, 360);
  const leftPos = Math.min(triggerRect.left, window.innerWidth - menuWidth - 12);
  const topPos = triggerRect.bottom + 6;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        left: `${leftPos}px`,
        top: `${topPos}px`,
        width: `${menuWidth}px`,
      }}
      className="fixed z-[9999] bg-base-1/98 backdrop-blur-md border border-border rounded-md shadow-2xl overflow-hidden flex flex-col max-h-[500px] text-xs font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* 1. Header Toolbar: Title & Add Action */}
      <div className="px-3 pt-2.5 pb-2 border-b border-border bg-base-0/90 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <FolderGit2 className="w-4 h-4 text-commito-coral" />
          <span className="font-extrabold text-xs text-text-primary tracking-wide">Switch Repository</span>
        </div>

        {/* Compact Add Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="px-2 py-1 bg-commito-coral hover:bg-commito-coralHover text-white rounded text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
            title="Add or create repository"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>

          {/* Sub-menu for Add options */}
          {showAddMenu && (
            <div
              ref={addMenuRef}
              className="absolute right-0 top-7 z-10 w-52 bg-base-1 border border-border rounded-md shadow-2xl p-1 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
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
                <span>Clone Remote Repository</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Primary Search Bar */}
      <div className="p-2 border-b border-border bg-base-0/50 flex-shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search repositories by name or path..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1 bg-base-2 border border-border rounded text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral transition"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="absolute right-2 text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Dedicated Scrollable Repository Content */}
      <div className="flex-1 overflow-y-auto py-1 space-y-2 min-h-0">
        {/* CURRENT REPOSITORY SECTION (Shown if active & no search query or matches query) */}
        {activeRepoPath && (!filterQuery || getRepoName(activeRepoPath).toLowerCase().includes(queryLower)) && (
          <div>
            <SectionHeader title="Current Repository" />
            <ActiveRepoCard
              path={activeRepoPath}
              status={status}
              onClick={() => handleSelectRepoPath(activeRepoPath)}
            />
          </div>
        )}

        {/* RECENT REPOSITORIES SECTION */}
        <div>
          <SectionHeader title="Recent" count={filteredRecentRepos.length} />

          {filteredRecentRepos.length === 0 ? (
            <div className="px-3 py-2 text-text-muted text-[11px] italic">
              {filterQuery ? 'No repositories found matching search.' : 'No recent repositories.'}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredRecentRepos.map((path) => (
                <RepoRow
                  key={path}
                  path={path}
                  isActive={activeRepoPath === path}
                  onSelect={() => handleSelectRepoPath(path)}
                  onRemove={() => removeRecentRepo(path)}
                />
              ))}
            </div>
          )}
        </div>

        {/* CLOUD / ACCOUNT PROJECTS SECTION */}
        {user && (
          <div className="pt-1 border-t border-border/40">
            <SectionHeader
              title={`${user.provider.toUpperCase()} PROJECTS`}
              badge={user.name || user.username}
              count={filteredUserRepos.length}
            />

            {isLoadingRepos ? (
              <div className="px-3 py-2 text-text-muted text-[11px] flex items-center gap-2 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading remote projects...</span>
              </div>
            ) : filteredUserRepos.length === 0 ? (
              <div className="px-3 py-2 text-text-muted text-[11px] italic">
                {filterQuery ? 'No matching cloud projects.' : 'No projects available.'}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredUserRepos.map((repo) => (
                  <CloudRepoRow key={repo.id} repo={repo} onClone={handleCloneRepo} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Footer Bar */}
      <div className="p-2 border-t border-border bg-base-0/90 flex items-center justify-between flex-shrink-0 gap-2">
        <button
          type="button"
          onClick={handleViewAllRepos}
          className="flex-1 px-2.5 py-1 bg-base-2 hover:bg-base-3 border border-border rounded text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-commito-coral" />
          <span>View All Repositories</span>
        </button>

        <button
          type="button"
          onClick={handleManageAccounts}
          className="px-2.5 py-1 bg-base-2 hover:bg-base-3 border border-border rounded text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer"
          title="Manage connected Git accounts"
        >
          <UserCheck className="w-3.5 h-3.5 text-gitlab-blue" />
          <span>Accounts</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
