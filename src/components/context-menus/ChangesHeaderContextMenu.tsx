import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Archive } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';

interface ChangesHeaderContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Context menu shown when right-clicking the "N of N changed files" header row.
 * Provides bulk actions: discard all changes and stash all changes.
 */
export const ChangesHeaderContextMenu: React.FC<ChangesHeaderContextMenuProps> = ({
  x,
  y,
  onClose,
}) => {
  const { activeRepoPath, status, setStatus, setError } = useGitStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const fileCount = status?.files?.length ?? 0;
  const hasChanges = fileCount > 0;

  // Discard all changes: run discard on every changed file
  const handleDiscardAll = async () => {
    if (!activeRepoPath || !hasChanges) return;

    const confirmed = confirm(
      `Are you sure you want to discard all ${fileCount} changed file${fileCount !== 1 ? 's' : ''}? This action cannot be undone.`
    );
    if (!confirmed) { onClose(); return; }

    try {
      const files = status!.files.map((f) => f.path);
      for (const filePath of files) {
        await GitService.discardFileChanges(activeRepoPath, filePath);
      }
      useLogStore.getState().addLog('info', 'Git', `Discarded all changes (${fileCount} files)`);
      const res = await GitService.getRepoStatus(activeRepoPath);
      setStatus(res);
    } catch (error: unknown) {
      setError(toAppError(error, 'DISCARD_ALL_ERROR'));
    }
    onClose();
  };

  // Stash all changes
  const handleStashAll = async () => {
    if (!activeRepoPath || !hasChanges) return;

    try {
      await GitService.createStash(activeRepoPath, undefined, true);
      useLogStore.getState().addLog('success', 'Git', `Stashed all changes (${fileCount} files)`);
      const res = await GitService.getRepoStatus(activeRepoPath);
      setStatus(res);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'Git', `Failed to stash changes: ${msg}`);
      setError(toAppError(error, 'STASH_ERROR'));
    }
    onClose();
  };

  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 120);

  return createPortal(
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-[9999] w-52 bg-base-1 border border-border rounded-sm shadow-2xl py-1 text-xs select-none font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="p-1 space-y-0.5">
        {/* Discard all */}
        <button
          onClick={handleDiscardAll}
          disabled={!hasChanges}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-git-removed-bg text-git-removed hover:text-danger flex items-center gap-2.5 transition text-left font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Discard all changes...</span>
        </button>

        {/* Stash all */}
        <button
          onClick={handleStashAll}
          disabled={!hasChanges}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-commito-coral flex items-center gap-2.5 transition text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Archive className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Stash all changes</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
