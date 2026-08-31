import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, FolderSearch, Trash2, X } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useGitStore } from '../../store/useGitStore';
import { useRepoStore } from '../../store/repoStore';

/**
 * Modern compact modal dialog displayed when an active or selected repository
 * cannot be found on the local filesystem or its .git structure is missing/corrupt.
 */
export const MissingRepoModal: React.FC = () => {
  const {
    isMissingRepoModalOpen,
    missingRepoPath,
    missingRepoReason,
    setIsMissingRepoModalOpen,
    activeRepoPath,
    setActiveRepoPath,
    setCurrentNavView,
    removeRecentRepo,
  } = useGitStore();

  const { repos, removeRepo, relocateRepo, openRepo, loadRepos } = useRepoStore();
  const [isLocating, setIsLocating] = useState(false);

  const targetPath = missingRepoPath || activeRepoPath || '';
  const matchingRepo = repos.find((r) => r.path === targetPath);

  const handleClose = useCallback(() => {
    setIsMissingRepoModalOpen(false);
    // If the currently active repository is the missing one, navigate to home safely
    if (activeRepoPath === targetPath) {
      setActiveRepoPath(null);
      setCurrentNavView('home');
    }
  }, [setIsMissingRepoModalOpen, activeRepoPath, targetPath, setActiveRepoPath, setCurrentNavView]);

  const handleRemove = useCallback(async () => {
    try {
      if (matchingRepo) {
        await removeRepo(matchingRepo.id);
      }
      if (targetPath) {
        removeRecentRepo(targetPath);
      }
      if (activeRepoPath === targetPath) {
        setActiveRepoPath(null);
      }
      setCurrentNavView('home');
      await loadRepos();
    } catch (err) {
      console.error('Failed to remove missing repo:', err);
    } finally {
      setIsMissingRepoModalOpen(false);
    }
  }, [
    matchingRepo,
    removeRepo,
    targetPath,
    removeRecentRepo,
    activeRepoPath,
    setActiveRepoPath,
    setCurrentNavView,
    loadRepos,
    setIsMissingRepoModalOpen,
  ]);

  const handleLocate = useCallback(async () => {
    setIsLocating(true);
    try {
      const selected = await openDialog({
        title: 'Locate Repository Folder',
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        if (targetPath) {
          await relocateRepo(targetPath, selected);
        }
        setIsMissingRepoModalOpen(false);
        await openRepo(selected);
      }
    } catch (err) {
      console.error('Failed to locate repo folder:', err);
    } finally {
      setIsLocating(false);
    }
  }, [targetPath, relocateRepo, openRepo, setIsMissingRepoModalOpen]);

  // Keyboard shortcut: Escape to close / navigate to home
  useEffect(() => {
    if (!isMissingRepoModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMissingRepoModalOpen, handleClose]);

  if (!isMissingRepoModalOpen || !targetPath) return null;

  return createPortal(
    <div className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none animate-in fade-in duration-100">
      <div
        className="w-full max-w-md bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="missing-repo-title"
      >
        {/* Compact Header */}
        <div className="px-3.5 py-2 border-b border-border bg-base-1 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-xs bg-git-removed-bg border border-git-removed/30 flex items-center justify-center shrink-0 text-git-removed">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h2
                id="missing-repo-title"
                className="text-xs font-bold text-text-primary leading-none"
              >
                Repository Not Found
              </h2>
              <span className="text-border">•</span>
              <span className="text-[11px] text-text-muted font-mono leading-none">
                Invalid Path
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
            title="Close (Esc)"
            aria-label="Close dialog"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3 bg-base-0 text-xs font-sans text-text-primary">
          <p className="text-[11.5px] text-text-secondary leading-relaxed font-normal">
            This repository cannot be found on disk or its{' '}
            <code className="px-1 py-0.2 rounded-xs bg-base-1 border border-border text-text-primary font-mono text-[10.5px]">
              .git
            </code>{' '}
            folder is missing or corrupt. It may have been moved, deleted, or unmounted.
          </p>

          {/* Location & Reason Box */}
          <div className="p-2.5 rounded-sm bg-base-1 border border-border space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-semibold uppercase tracking-wider text-text-muted">
              <span>Last Known Path</span>
            </div>
            <div className="font-mono text-[11px] text-text-primary break-all select-all leading-snug">
              {targetPath}
            </div>
            {missingRepoReason && (
              <div className="text-[11px] text-git-removed/90 flex items-center gap-1.5 pt-1.5 border-t border-border/60">
                <AlertCircle className="w-3 h-3 shrink-0 text-git-removed" />
                <span className="truncate">{missingRepoReason}</span>
              </div>
            )}
          </div>
        </div>

        {/* Compact Footer Actions */}
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-base-1 border-t border-border">
          <button
            type="button"
            onClick={handleRemove}
            className="h-7 px-2.5 rounded-xs bg-git-removed-bg hover:bg-red-500/25 border border-git-removed/30 text-git-removed text-xs font-medium inline-flex items-center justify-center gap-1.5 leading-none transition cursor-pointer active:scale-[0.98]"
            title="Remove from workspace"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLocate}
              disabled={isLocating}
              className="h-7 px-2.5 rounded-xs bg-base-2 hover:bg-base-3 border border-border text-text-primary text-xs font-medium inline-flex items-center justify-center gap-1.5 leading-none transition cursor-pointer active:scale-[0.98] disabled:opacity-50"
            >
              <FolderSearch className="w-3 h-3 text-text-muted" />
              <span>{isLocating ? 'Locating...' : 'Locate Folder...'}</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="h-7 px-3.5 rounded-xs bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 leading-none transition cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
