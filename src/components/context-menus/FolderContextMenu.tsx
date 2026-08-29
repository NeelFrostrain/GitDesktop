import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { RotateCcw, CheckSquare, Square, FolderX, Copy, FolderOpen, Code } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { useRepoStore } from '../../store/repoStore';
import { GitService } from '../../services/git/gitService';
import { SystemService } from '../../services/system/systemService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';

interface FolderContextMenuProps {
  folderPath: string;
  childFiles: string[];
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Context menu for folder nodes in the Changes tree view.
 * Provides bulk staging, folder discarding, .gitignore additions, and system openers.
 */
export const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
  folderPath,
  childFiles,
  x,
  y,
  onClose,
}) => {
  const { activeRepoPath, stagedFiles, toggleStageFiles, setStatus, setError } = useGitStore();
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

  const fullPath = activeRepoPath
    ? `${activeRepoPath.replace(/[/\\]+$/, '')}/${folderPath.replace(/^[/\\]+/, '')}`
    : folderPath;

  const stagedCount = childFiles.filter((f) => stagedFiles.includes(f)).length;
  const isAllStaged = childFiles.length > 0 && stagedCount === childFiles.length;

  // 1. Stage / Unstage all in folder
  const handleStageAll = async () => {
    onClose();
    await toggleStageFiles(childFiles, true);
  };

  const handleUnstageAll = async () => {
    onClose();
    await toggleStageFiles(childFiles, false);
  };

  // 2. Discard all changes in folder
  const handleDiscardFolder = async () => {
    if (!activeRepoPath || childFiles.length === 0) return;
    const count = childFiles.length;
    const confirmed = confirm(
      `Are you sure you want to discard all changes in ${count} file${count !== 1 ? 's' : ''} under '${folderPath}'? This action cannot be undone.`
    );
    if (!confirmed) {
      onClose();
      return;
    }

    try {
      for (const filePath of childFiles) {
        await GitService.discardFileChanges(activeRepoPath, filePath);
      }
      useLogStore
        .getState()
        .addLog('info', 'Git', `Discarded changes in folder '${folderPath}' (${count} files)`);
      const res = await GitService.getRepoStatus(activeRepoPath);
      setStatus(res);
      useRepoStore
        .getState()
        .refreshStatus(activeRepoPath)
        .catch(() => {});
    } catch (error: unknown) {
      setError(toAppError(error, 'DISCARD_FOLDER_ERROR'));
    }
    onClose();
  };

  // 3. Ignore folder (add to .gitignore)
  const handleIgnoreFolder = async () => {
    if (!activeRepoPath) return;
    try {
      const pattern = folderPath.replace(/^[/\\]+/, '') + '/';
      await invoke('ignore_file_pattern_cmd', { repoPath: activeRepoPath, pattern });
      useLogStore.getState().addLog('success', 'Git', `Added '${pattern}' to .gitignore`);

      // Unstage contained files if staged
      await GitService.unstageFiles(activeRepoPath, childFiles).catch(() => {});

      const res = await GitService.getRepoStatus(activeRepoPath);
      setStatus(res);
      useRepoStore
        .getState()
        .refreshStatus(activeRepoPath)
        .catch(() => {});
    } catch (error: unknown) {
      setError(toAppError(error, 'GITIGNORE_ERROR'));
    }
    onClose();
  };

  // 4. Copy paths
  const handleCopyFullPath = () => {
    navigator.clipboard.writeText(fullPath);
    useLogStore
      .getState()
      .addLog('info', 'System', `Copied folder path '${fullPath}' to clipboard`);
    onClose();
  };

  const handleCopyRelativePath = () => {
    navigator.clipboard.writeText(folderPath);
    useLogStore
      .getState()
      .addLog('info', 'System', `Copied relative folder path '${folderPath}' to clipboard`);
    onClose();
  };

  // 5. Openers
  const handleShowInExplorer = async () => {
    try {
      await SystemService.showInExplorer(fullPath);
      useLogStore.getState().addLog('info', 'System', `Opened file manager at '${fullPath}'`);
    } catch (error: unknown) {
      useLogStore
        .getState()
        .addLog('error', 'System', `Failed to open Explorer: ${getErrorMessage(error)}`);
    }
    onClose();
  };

  const handleOpenVSCode = async () => {
    try {
      await SystemService.openInVSCode(fullPath);
      useLogStore
        .getState()
        .addLog('info', 'System', `Opened folder '${folderPath}' in Visual Studio Code`);
    } catch (error: unknown) {
      useLogStore
        .getState()
        .addLog('error', 'System', `Failed to open VS Code: ${getErrorMessage(error)}`);
    }
    onClose();
  };

  const adjustedX = Math.min(Math.max(8, x), window.innerWidth - 260);
  const adjustedY = Math.min(Math.max(8, y), window.innerHeight - 300);

  return createPortal(
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-[9999] w-64 bg-base-1 border border-border-strong rounded-sm shadow-2xl py-1 text-xs select-none font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Staging actions */}
      <div className="p-1 space-y-0.5">
        {!isAllStaged && (
          <button
            onClick={handleStageAll}
            className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5 text-git-added" />
            <span>Stage all in folder ({childFiles.length})</span>
          </button>
        )}
        {stagedCount > 0 && (
          <button
            onClick={handleUnstageAll}
            className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 text-text-muted" />
            <span>Unstage all in folder</span>
          </button>
        )}
        <button
          onClick={handleDiscardFolder}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-git-removed-bg text-git-removed hover:text-danger flex items-center gap-2.5 transition text-left font-medium cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Discard changes in folder...</span>
        </button>
      </div>

      <div className="h-px bg-border my-1" />

      {/* Ignore */}
      <div className="p-1 space-y-0.5">
        <button
          onClick={handleIgnoreFolder}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
        >
          <FolderX className="w-3.5 h-3.5 text-text-muted" />
          <span>Ignore folder (add to .gitignore)</span>
        </button>
      </div>

      <div className="h-px bg-border my-1" />

      {/* Copy paths */}
      <div className="p-1 space-y-0.5">
        <button
          onClick={handleCopyFullPath}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5 text-text-muted" />
          <span>Copy folder path</span>
        </button>
        <button
          onClick={handleCopyRelativePath}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5 text-text-muted" />
          <span>Copy relative path</span>
        </button>
      </div>

      <div className="h-px bg-border my-1" />

      {/* Openers */}
      <div className="p-1 space-y-0.5">
        <button
          onClick={handleShowInExplorer}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Show in Explorer</span>
        </button>
        <button
          onClick={handleOpenVSCode}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
        >
          <Code className="w-3.5 h-3.5 text-blue-400" />
          <span>Open folder in Visual Studio Code</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
