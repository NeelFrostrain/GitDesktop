import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  GitBranch,
  Pin,
  Clock,
  FileEdit,
  FolderGit2,
  Trash2,
  GitCommit,
  Terminal,
  Code,
  FolderOpen,
  MoreVertical,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { RepoEntry, RepoDashboardStatus } from '../../types/home';
import { useRepoStore, openRepo } from '../../features/repos';
import { useGitStore } from '../../store/useGitStore';
import { SystemService } from '../../services/system/systemService';
import { useLogStore } from '../../store/useLogStore';

export interface RepoCardProps {
  repo: RepoEntry;
  status?: RepoDashboardStatus;
  viewMode?: 'grid' | 'list';
}

export const RepoCard: React.FC<RepoCardProps> = ({ repo, status, viewMode = 'grid' }) => {
  const pinRepo = useRepoStore((s) => s.pinRepo);
  const removeRepo = useRepoStore((s) => s.removeRepo);
  const activeRepoPath = useGitStore((s) => s.activeRepoPath);
  const isActive = repo.path === activeRepoPath;

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuPos) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuPos(null);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [menuPos]);

  const handleCardClick = () => openRepo(repo.path);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleDotsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ x: rect.right - 210, y: rect.bottom + 6 });
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    pinRepo(repo.id, !repo.pinned);
    setMenuPos(null);
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuPos(null);
    if (confirm(`Remove '${repo.name}' from your workspace list? (Files won't be deleted)`)) {
      removeRepo(repo.id);
    }
  };

  const handleOpenVSCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuPos(null);
    SystemService.openInVSCode(repo.path).catch(() => {});
  };

  const handleOpenTerminal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuPos(null);
    SystemService.openInTerminal(repo.path).catch(() => {});
  };

  const handleShowExplorer = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuPos(null);
    SystemService.showInExplorer(repo.path).catch(() => {});
  };

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuPos(null);
    navigator.clipboard.writeText(repo.path);
    useLogStore.getState().addLog('info', 'System', `Copied '${repo.path}' to clipboard`);
  };

  const formatRelativeTime = (ts: number) => {
    if (!ts) return '—';
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const renderProvider = () => {
    const provider = status?.remote_provider;
    if (provider === 'github') {
      return (
        <span className="px-1.5 py-0.2 rounded-xs bg-purple-950/40 border border-purple-500/40 text-[9px] font-mono font-bold text-purple-300 tracking-wider">
          GITHUB
        </span>
      );
    }
    if (provider === 'gitlab') {
      return (
        <span className="px-1.5 py-0.2 rounded-xs bg-orange-950/40 border border-[#e24329]/40 text-[9px] font-mono font-bold text-[#fc6d26] tracking-wider">
          GITLAB
        </span>
      );
    }
    return null;
  };

  const isDirty = Boolean(status && status.dirty_files > 0);
  const branchName = status?.current_branch || 'main';

  // ── Context Menu Portal Box ──────────────────────────────────────────────
  const renderContextMenu = () => {
    if (!menuPos) return null;
    const adjustedX = Math.max(8, Math.min(menuPos.x, window.innerWidth - 220));
    const adjustedY = Math.max(8, Math.min(menuPos.y, window.innerHeight - 260));

    return createPortal(
      <div
        ref={menuRef}
        style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
        onClick={(e) => e.stopPropagation()}
        className="fixed z-10000 w-52 bg-base-1 border border-border rounded-sm shadow-2xl py-1 text-xs select-none font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100"
      >
        <div className="p-1 space-y-0.5">
          <button
            type="button"
            onClick={handleOpenVSCode}
            className="w-full px-2.5 py-1.5 rounded-xs hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
          >
            <Code className="w-3.5 h-3.5 text-blue-400" />
            <span>Open in VS Code</span>
          </button>

          <button
            type="button"
            onClick={handleOpenTerminal}
            className="w-full px-2.5 py-1.5 rounded-xs hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open in Terminal</span>
          </button>

          <button
            type="button"
            onClick={handleShowExplorer}
            className="w-full px-2.5 py-1.5 rounded-xs hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Show in Explorer</span>
          </button>
        </div>

        <div className="h-px bg-border my-1" />

        <div className="p-1 space-y-0.5">
          <button
            type="button"
            onClick={handlePinClick}
            className="w-full px-2.5 py-1.5 rounded-xs hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
          >
            <Pin className={`w-3.5 h-3.5 ${repo.pinned ? 'text-commito-coral fill-commito-coral/30' : 'text-text-muted'}`} />
            <span>{repo.pinned ? 'Unpin from Favorites' : 'Pin to Favorites'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPath}
            className="w-full px-2.5 py-1.5 rounded-xs hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-text-muted" />
            <span>Copy Path</span>
          </button>
        </div>

        <div className="h-px bg-border my-1" />

        <div className="p-1">
          <button
            type="button"
            onClick={handleRemoveClick}
            className="w-full px-2.5 py-1.5 rounded-xs hover:bg-git-removed-bg text-git-removed hover:text-danger flex items-center gap-2 transition font-medium cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove from workspace</span>
          </button>
        </div>
      </div>,
      document.body
    );
  };

  // ── List View Rendering (Seamless Flat Row with Left Accent) ─────────────
  if (viewMode === 'list') {
    return (
      <>
        <div
          onClick={handleCardClick}
          onContextMenu={handleContextMenu}
          className={`group px-3.5 py-2.5 border-l-2 transition-all duration-100 cursor-pointer flex items-center justify-between gap-4 select-none ${
            isActive
              ? 'bg-base-2 border-l-commito-coral text-text-primary font-semibold'
              : 'border-l-transparent text-text-muted hover:text-text-primary hover:bg-base-1/70'
          }`}
        >
          {/* Left: Folder Icon + Name + Badges + Path */}
          <div className="flex items-center gap-2.5 min-w-0 max-w-[340px] lg:max-w-[420px] shrink-0">
            <FolderGit2
              className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                isActive ? 'text-commito-coral' : 'text-text-muted group-hover:text-commito-coral'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-xs truncate leading-none font-mono ${
                    isActive ? 'font-bold text-text-primary' : 'font-medium text-text-primary group-hover:text-commito-coral'
                  }`}
                  title={repo.name}
                >
                  {repo.name}
                </span>
                {renderProvider()}
                <div className="h-4 px-1 inline-flex items-center gap-0.5 bg-base-0 border border-border/70 rounded-xs text-[9.5px] font-mono text-text-muted">
                  <GitBranch className="w-2.5 h-2.5 text-commito-coral flex-shrink-0" />
                  <span className="truncate max-w-[100px]">{branchName}</span>
                </div>
                {repo.pinned && (
                  <Pin className="w-3 h-3 text-commito-coral fill-commito-coral/30 flex-shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-text-muted/70 font-mono truncate mt-0.5 leading-tight" title={repo.path}>
                {repo.path}
              </p>
            </div>
          </div>

          {/* Middle: Commit Summary */}
          <div className="hidden md:flex items-center gap-1.5 flex-1 min-w-0 text-left px-2">
            <GitCommit className="w-3 h-3 text-text-muted shrink-0" />
            <span className="text-[10.5px] text-text-muted/80 font-mono truncate block w-full" title={status?.last_commit_summary}>
              {status?.last_commit_summary || '—'}
            </span>
          </div>

          {/* Right: Timestamp + Status badge + 3-dots */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-text-muted/70 font-mono">
              <Clock className="w-2.5 h-2.5" />
              {formatRelativeTime(status?.last_commit_at || 0)}
            </span>

            {isDirty ? (
              <span
                className="text-git-modified shrink-0 flex items-center gap-1"
                title={`${status?.dirty_files} uncommitted changes`}
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span className="font-mono text-[10px] font-bold">{status?.dirty_files}</span>
              </span>
            ) : (
              <span className="text-git-added shrink-0" title="Clean repository">
                <CheckCircle2 className="w-3.5 h-3.5 text-git-added/70" />
              </span>
            )}

            <button
              type="button"
              onClick={handleDotsClick}
              className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-3 transition cursor-pointer flex-shrink-0"
              title="More options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {renderContextMenu()}
      </>
    );
  }

  // ── Grid Card View Rendering ─────────────────────────────────────────────
  return (
    <>
      <div
        onClick={handleCardClick}
        onContextMenu={handleContextMenu}
        className={`group p-3.5 bg-base-1/50 border rounded-sm border-l-2 transition-all duration-100 cursor-pointer flex flex-col justify-between gap-2.5 select-none shadow-2xs ${
          isActive
            ? 'bg-base-2 border-border/60 border-l-commito-coral text-text-primary font-semibold'
            : 'border-border/60 border-l-transparent hover:border-l-commito-coral hover:bg-base-2/70'
        }`}
      >
        <div className="space-y-1.5">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <FolderGit2
                className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-commito-coral' : 'text-text-muted group-hover:text-commito-coral'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-xs truncate leading-none font-mono ${
                      isActive ? 'font-bold text-text-primary' : 'font-medium text-text-primary group-hover:text-commito-coral'
                    }`}
                    title={repo.name}
                  >
                    {repo.name}
                  </span>
                  {renderProvider()}
                  <div className="h-4 px-1 inline-flex items-center gap-0.5 bg-base-0 border border-border/70 rounded-xs text-[9.5px] font-mono text-text-muted">
                    <GitBranch className="w-2.5 h-2.5 text-commito-coral flex-shrink-0" />
                    <span className="truncate max-w-[100px]">{branchName}</span>
                  </div>
                  {repo.pinned && (
                    <Pin className="w-3 h-3 text-commito-coral fill-commito-coral/30 flex-shrink-0" />
                  )}
                </div>
              </div>
            </div>

            {/* Right: Status Icon + 3-Dots Menu */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isDirty ? (
                <span
                  className="text-git-modified shrink-0 flex items-center gap-1"
                  title={`${status?.dirty_files} uncommitted changes`}
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span className="font-mono text-[10px] font-bold">{status?.dirty_files}</span>
                </span>
              ) : (
                <span className="text-git-added shrink-0" title="Clean repository">
                  <CheckCircle2 className="w-3.5 h-3.5 text-git-added/70" />
                </span>
              )}

              <button
                type="button"
                onClick={handleDotsClick}
                className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-3 transition cursor-pointer flex-shrink-0"
                title="More options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Path */}
          <p className="text-[10px] text-text-muted/70 font-mono truncate leading-tight" title={repo.path}>
            {repo.path}
          </p>
        </div>

        {/* Footer commit summary */}
        <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <GitCommit className="w-3 h-3 text-text-muted shrink-0" />
            <span className="text-[10.5px] text-text-muted/80 font-mono truncate" title={status?.last_commit_summary}>
              {status?.last_commit_summary || '—'}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-text-muted/70 flex-shrink-0 font-mono">
            <Clock className="w-2.5 h-2.5" />
            {formatRelativeTime(status?.last_commit_at || 0)}
          </span>
        </div>
      </div>
      {renderContextMenu()}
    </>
  );
};
