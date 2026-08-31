import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  GitBranch,
  ArrowUpRight,
  ArrowDownLeft,
  Pin,
  Clock,
  FileEdit,
  Trash2,
  GitCommit,
  Terminal,
  Code,
  FolderOpen,
  MoreVertical,
  Copy,
  AlertCircle,
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

export const RepoCard: React.FC<RepoCardProps> = React.memo(
  ({ repo, status, viewMode = 'grid' }) => {
    const pinRepo = useRepoStore((s) => s.pinRepo);
    const removeRepo = useRepoStore((s) => s.removeRepo);
    const setIsMissingRepoModalOpen = useGitStore((s) => s.setIsMissingRepoModalOpen);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const isInvalid = status?.is_valid === false;

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

    const handleCardClick = () => {
      if (isInvalid) {
        setIsMissingRepoModalOpen(
          true,
          repo.path,
          status?.error_message || 'Directory not found or .git metadata missing'
        );
        return;
      }
      openRepo(repo.path);
    };

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
      return new Date(ts * 1000).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    };

    const renderProvider = () => {
      if (status?.remote_provider === 'gitlab')
        return (
          <span className="text-[9.5px] font-mono font-bold uppercase text-commito-coral bg-commito-coral/10 border border-commito-coral/30 px-1.5 py-0.2 rounded-xs">
            GitLab
          </span>
        );
      if (status?.remote_provider === 'github')
        return (
          <span className="text-[9.5px] font-mono font-bold uppercase text-purple-400 bg-purple-950/40 border border-purple-800/40 px-1.5 py-0.2 rounded-xs">
            GitHub
          </span>
        );
      return (
        <span className="text-[9.5px] font-mono font-medium text-text-muted bg-base-0 border border-border px-1.5 py-0.2 rounded-xs">
          Local
        </span>
      );
    };

    const isDirty = Boolean(status && status.dirty_files > 0);

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
          {/* Launchers */}
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

          {/* Actions */}
          <div className="p-1 space-y-0.5">
            <button
              type="button"
              onClick={handlePinClick}
              className="w-full px-2.5 py-1.5 rounded-xs hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
            >
              <Pin
                className={`w-3.5 h-3.5 ${repo.pinned ? 'text-commito-coral fill-commito-coral/30' : 'text-text-muted'}`}
              />
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

          {/* Remove */}
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

    // ── List View Rendering ──────────────────────────────────────────────────
    if (viewMode === 'list') {
      return (
        <>
          <div
            onClick={handleCardClick}
            onContextMenu={handleContextMenu}
            className={`group px-3.5 py-2.5 bg-base-1/50 border border-border hover:border-border-strong rounded-sm hover:bg-base-1 transition-colors duration-150 ease-out cursor-pointer flex items-center justify-between gap-3 select-none shadow-2xs overflow-hidden outline-none focus:outline-none ${
              repo.pinned ? 'border-border-strong bg-base-1/80' : ''
            }`}
          >
            {/* Left: Icon + Name + Provider + Branch + Path */}
            <div className="flex items-center gap-2.5 min-w-0 max-w-[340px] shrink-0">
              <div className="min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3
                    className="text-xs font-semibold text-text-primary/95 truncate group-hover:text-commito-coral transition-colors"
                    title={repo.name}
                  >
                    {repo.name}
                  </h3>
                  {renderProvider()}
                  {!isInvalid ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-base-0 border border-border rounded-xs text-[10px] font-mono text-text-muted">
                      <GitBranch className="w-2.5 h-2.5 text-commito-coral" />
                      <span className="truncate max-w-[110px]">
                        {status?.current_branch || 'main'}
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-git-removed-bg border border-git-removed/30 rounded-xs text-[9.5px] font-mono text-git-removed font-medium">
                      <AlertCircle className="w-2.5 h-2.5 text-git-removed" />
                      <span>
                        {status?.error_type === 'folder_missing'
                          ? 'Missing Folder'
                          : 'Invalid .git'}
                      </span>
                    </span>
                  )}
                  {repo.pinned && (
                    <Pin className="w-3 h-3 text-commito-coral fill-commito-coral/30 flex-shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-text-muted font-mono truncate" title={repo.path}>
                  {repo.path}
                </p>
              </div>
            </div>

            {/* Middle: Last commit summary or Error explanation */}
            <div className="hidden md:flex items-center gap-1.5 flex-1 min-w-0 text-left px-2">
              {isInvalid ? (
                <span className="text-[11px] text-text-muted truncate block w-full font-mono">
                  {status?.error_message || 'Directory not found on disk'}
                </span>
              ) : (
                <>
                  <GitCommit className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span
                    className="text-[11px] text-text-secondary truncate block w-full"
                    title={status?.last_commit_summary}
                  >
                    {status?.last_commit_summary || '—'}
                  </span>
                </>
              )}
            </div>

            {/* Right Section: Time -> Modified badge -> 3-Dots Menu */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {isInvalid ? (
                <button
                  type="button"
                  onClick={handleRemoveClick}
                  className="h-6 px-2 rounded-xs bg-git-removed-bg hover:bg-red-500/25 border border-git-removed/30 text-git-removed hover:text-red-300 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer active:scale-[0.98]"
                  title="Remove from workspace"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              ) : (
                <>
                  {/* Timestamp */}
                  <span className="hidden sm:flex items-center gap-1 text-[10px] text-text-muted font-mono">
                    <Clock className="w-2.5 h-2.5" />
                    {formatRelativeTime(status?.last_commit_at || 0)}
                  </span>

                  {/* Status chips */}
                  <div className="flex items-center gap-1.5">
                    {status && (status.ahead > 0 || status.behind > 0) && (
                      <div className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 bg-base-0 border border-border rounded-xs">
                        {status.ahead > 0 && (
                          <span className="flex items-center gap-0.5 text-git-added font-semibold">
                            <ArrowUpRight className="w-2.5 h-2.5" />
                            {status.ahead}
                          </span>
                        )}
                        {status.behind > 0 && (
                          <span className="flex items-center gap-0.5 text-git-renamed font-semibold">
                            <ArrowDownLeft className="w-2.5 h-2.5" />
                            {status.behind}
                          </span>
                        )}
                      </div>
                    )}

                    {isDirty ? (
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-git-modified-bg border border-git-modified/30 rounded-xs text-[10px] font-mono text-git-modified font-semibold">
                        <FileEdit className="w-2.5 h-2.5" />
                        {status!.dirty_files} modified
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-[10px] font-mono text-git-clean px-1.5 py-0.2 bg-git-added-bg border border-git-added/20 rounded-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-git-added" />
                        Clean
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 3-Dots Menu Button */}
              <button
                type="button"
                onClick={handleDotsClick}
                className="p-1 rounded-xs text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer flex-shrink-0"
                title="More options"
              >
                <MoreVertical className="w-4 h-4" />
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
          className={`group p-2.5 bg-base-1/50 border border-border hover:border-border-strong rounded-sm transition-all duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer flex flex-col justify-between gap-2 select-none shadow-2xs hover:shadow-lg min-h-[110px] overflow-hidden outline-none focus:outline-none ${
            repo.pinned ? 'border-border-strong bg-base-1/80' : ''
          }`}
        >
          <div className="space-y-1">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3
                      className="text-[11.5px] font-semibold text-text-primary/95 truncate group-hover:text-commito-coral transition-colors"
                      title={repo.name}
                    >
                      {repo.name}
                    </h3>
                    {renderProvider()}
                    {repo.pinned && (
                      <Pin className="w-2.5 h-2.5 text-commito-coral fill-commito-coral/30 flex-shrink-0" />
                    )}
                  </div>
                </div>
              </div>

              {/* 3-Dots Menu Button */}
              <button
                type="button"
                onClick={handleDotsClick}
                className="p-0.5 rounded-xs text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer flex-shrink-0"
                title="More options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Path */}
            <p className="text-[9.5px] text-text-muted font-mono truncate pl-0.5" title={repo.path}>
              {repo.path}
            </p>

            {/* Status Badges */}
            <div className="flex items-center flex-wrap gap-1 pt-0.5">
              {isInvalid ? (
                <div className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-git-removed-bg border border-git-removed/30 rounded-xs text-[9.5px] font-mono text-git-removed font-medium">
                  <AlertCircle className="w-2.5 h-2.5 text-git-removed" />
                  <span>
                    {status?.error_type === 'folder_missing' ? 'Missing Folder' : 'Invalid .git'}
                  </span>
                </div>
              ) : (
                <>
                  <div className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-base-0 border border-border rounded-xs text-[9.5px] font-mono text-text-muted">
                    <GitBranch className="w-2.5 h-2.5 text-commito-coral" />
                    <span className="truncate max-w-[110px]">
                      {status?.current_branch || 'main'}
                    </span>
                  </div>

                  {status && (status.ahead > 0 || status.behind > 0) && (
                    <div className="inline-flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.2 bg-base-0 border border-border rounded-xs">
                      {status.ahead > 0 && (
                        <span className="flex items-center gap-0.5 text-git-added font-semibold">
                          <ArrowUpRight className="w-2.5 h-2.5" />
                          {status.ahead}
                        </span>
                      )}
                      {status.behind > 0 && (
                        <span className="flex items-center gap-0.5 text-git-renamed font-semibold">
                          <ArrowDownLeft className="w-2.5 h-2.5" />
                          {status.behind}
                        </span>
                      )}
                    </div>
                  )}

                  {isDirty ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-git-modified-bg border border-git-modified/30 rounded-xs text-[9.5px] font-mono text-git-modified font-semibold">
                      <FileEdit className="w-2.5 h-2.5" />
                      {status!.dirty_files} modified
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 text-[9.5px] font-mono text-git-clean px-1.5 py-0.2 bg-git-added-bg border border-git-added/20 rounded-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-git-added" />
                      Clean
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer commit summary or invalid note */}
          <div className="pt-1 border-t border-border/60 flex items-center justify-between gap-1.5">
            {isInvalid ? (
              <div className="flex items-center justify-between w-full">
                <span className="text-[9.5px] text-text-muted truncate font-mono">
                  Not found on disk
                </span>
                <button
                  type="button"
                  onClick={handleRemoveClick}
                  className="text-[10px] text-git-removed hover:text-red-300 flex items-center gap-1 font-medium hover:underline cursor-pointer transition"
                  title="Remove from workspace"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span>Remove</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <GitCommit className="w-2.5 h-2.5 text-text-muted shrink-0" />
                  <span
                    className="text-[10px] text-text-secondary truncate"
                    title={status?.last_commit_summary}
                  >
                    {status?.last_commit_summary || '—'}
                  </span>
                </div>
                <span className="flex items-center gap-0.5 text-[9.5px] text-text-muted flex-shrink-0 font-mono">
                  <Clock className="w-2.5 h-2.5" />
                  {formatRelativeTime(status?.last_commit_at || 0)}
                </span>
              </>
            )}
          </div>
        </div>
        {renderContextMenu()}
      </>
    );
  }
);

RepoCard.displayName = 'RepoCard';
