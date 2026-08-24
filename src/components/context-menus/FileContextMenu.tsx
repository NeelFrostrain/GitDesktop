import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import {
  RotateCcw,
  FileX,
  Copy,
  FileText,
  FolderOpen,
  Code,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { SystemService } from '../../services/system/systemService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';

interface FileContextMenuProps {
  filePath: string;
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Context menu for changed file items in the working tree, offering discard,
 * ignore (.gitignore), path copying, and external editor / file explorer openers.
 */
export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  filePath,
  x,
  y,
  onClose,
}) => {
  const { activeRepoPath, setStatus, setError } = useGitStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const folderItemRef = useRef<HTMLDivElement>(null);
  const [folderSubmenuOpen, setFolderSubmenuOpen] = useState(false);
  const [submenuPos, setSubmenuPos] = useState<{ x: number; y: number } | null>(null);

  // Derived values — computed before handlers so all refs are available
  const fileName = filePath.split(/[/\\]/).filter(Boolean).pop() || filePath;
  const extParts = fileName.split('.');
  const extension = extParts.length > 1 ? extParts.pop() : '';
  const ignoreExtLabel = extension
    ? `Ignore all .${extension} files (add to .gitignore)`
    : `Ignore extension (add to .gitignore)`;

  const fullPath = activeRepoPath
    ? `${activeRepoPath.replace(/[\/\\]+$/, '')}/${filePath.replace(/^[\/\\]+/, '')}`
    : filePath;

  const fullDir = fullPath.substring(0, Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\')));

  // Build hierarchical folder segments from relative filePath
  // e.g. "src/app/layout/home/Foo.tsx" → ["/src/app/layout/home", "/src/app/layout", "/src/app", "/src"]
  const folderSegments = (() => {
    const normalized = filePath.replace(/\\/g, '/').replace(/^\//, '');
    const parts = normalized.split('/');
    parts.pop(); // remove filename
    if (parts.length === 0) return [];
    const segments: string[] = [];
    for (let i = parts.length; i >= 1; i--) {
      segments.push('/' + parts.slice(0, i).join('/'));
    }
    return segments;
  })();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleFolderMouseEnter = () => {
    if (folderItemRef.current) {
      const rect = folderItemRef.current.getBoundingClientRect();
      const submenuWidth = 220;
      const spaceRight = window.innerWidth - rect.right;
      const sx = spaceRight >= submenuWidth ? rect.right : rect.left - submenuWidth;
      const submenuHeight = (folderSegments.length + 1) * 32 + 16;
      const sy = Math.min(rect.top, window.innerHeight - submenuHeight - 4);
      setSubmenuPos({ x: sx, y: sy });
    }
    setFolderSubmenuOpen(true);
  };

  const handleFolderMouseLeave = () => {
    setFolderSubmenuOpen(false);
    setSubmenuPos(null);
  };

  // 1. Discard changes
  const handleDiscardChanges = async () => {
    if (!activeRepoPath) return;
    if (confirm(`Are you sure you want to discard changes in '${filePath}'? This action cannot be undone.`)) {
      try {
        await GitService.discardFileChanges(activeRepoPath, filePath);
        useLogStore.getState().addLog('info', 'Git', `Discarded changes in '${filePath}'`);
        const res = await GitService.getRepoStatus(activeRepoPath);
        setStatus(res);
      } catch (error: unknown) {
        setError(toAppError(error, 'DISCARD_ERROR'));
      }
    }
    onClose();
  };

  // 2. Ignore file
  const handleIgnoreFile = async () => {
    if (!activeRepoPath) return;
    try {
      await invoke('ignore_file_pattern_cmd', { repoPath: activeRepoPath, pattern: filePath });
      useLogStore.getState().addLog('success', 'Git', `Added '${filePath}' to .gitignore`);
      const res = await GitService.getRepoStatus(activeRepoPath);
      setStatus(res);
    } catch (error: unknown) {
      setError(toAppError(error, 'GITIGNORE_ERROR'));
    }
    onClose();
  };

  // 3. Ignore folder
  const handleIgnoreFolder = async (folderPattern: string) => {
    if (!activeRepoPath) return;
    const pattern = folderPattern.replace(/^\//, '') + '/';
    try {
      await invoke('ignore_file_pattern_cmd', { repoPath: activeRepoPath, pattern });
      useLogStore.getState().addLog('success', 'Git', `Added '${pattern}' to .gitignore`);
      const res = await GitService.getRepoStatus(activeRepoPath);
      setStatus(res);
    } catch (error: unknown) {
      setError(toAppError(error, 'GITIGNORE_ERROR'));
    }
    onClose();
  };

  // 4. Ignore all .ext
  const handleIgnoreExtension = async () => {
    if (!activeRepoPath || !extension) return;
    const pattern = `*.${extension}`;
    try {
      await invoke('ignore_file_pattern_cmd', { repoPath: activeRepoPath, pattern });
      useLogStore.getState().addLog('success', 'Git', `Added '${pattern}' to .gitignore`);
      const res = await GitService.getRepoStatus(activeRepoPath);
      setStatus(res);
    } catch (error: unknown) {
      setError(toAppError(error, 'GITIGNORE_ERROR'));
    }
    onClose();
  };

  // 5. Copy paths
  const handleCopyFullPath = () => {
    navigator.clipboard.writeText(fullPath);
    useLogStore.getState().addLog('info', 'System', `Copied file path '${fullPath}' to clipboard`);
    onClose();
  };

  const handleCopyRelativePath = () => {
    navigator.clipboard.writeText(filePath);
    useLogStore.getState().addLog('info', 'System', `Copied relative path '${filePath}' to clipboard`);
    onClose();
  };

  // 6. Openers
  const handleShowInExplorer = async () => {
    try {
      await SystemService.showInExplorer(fullDir || fullPath);
      useLogStore.getState().addLog('info', 'System', `Opened file manager at '${fullDir || fullPath}'`);
    } catch (error: unknown) {
      useLogStore.getState().addLog('error', 'System', `Failed to open Explorer: ${getErrorMessage(error)}`);
    }
    onClose();
  };

  const handleOpenVSCode = async () => {
    try {
      await SystemService.openInVSCode(fullPath);
      useLogStore.getState().addLog('info', 'System', `Opened '${filePath}' in Visual Studio Code`);
    } catch (error: unknown) {
      useLogStore.getState().addLog('error', 'System', `Failed to open VS Code: ${getErrorMessage(error)}`);
    }
    onClose();
  };

  const handleOpenDefault = async () => {
    try {
      await SystemService.openFileDefault(fullPath);
      useLogStore.getState().addLog('info', 'System', `Opened '${filePath}' in default application`);
    } catch (error: unknown) {
      useLogStore.getState().addLog('error', 'System', `Failed to open file: ${getErrorMessage(error)}`);
    }
    onClose();
  };

  const adjustedX = Math.min(x, window.innerWidth - 250);
  const adjustedY = Math.min(y, window.innerHeight - 380);

  return createPortal(
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-[9999] w-64 bg-base-1 border border-border rounded-sm shadow-2xl py-1 text-xs select-none font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Group 1: Discard */}
      <div className="p-1">
        <button
          onClick={handleDiscardChanges}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-git-removed-bg text-git-removed hover:text-danger flex items-center gap-2.5 transition text-left font-medium cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Discard changes</span>
        </button>
      </div>

      <div className="h-px bg-border my-1" />

      {/* Group 2: GitIgnore */}
      <div className="p-1 space-y-0.5">
        {/* Combined Ignore with submenu */}
        <div
          ref={folderItemRef}
          className="relative"
          onMouseEnter={handleFolderMouseEnter}
          onMouseLeave={handleFolderMouseLeave}
        >
          <button className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center justify-between gap-2.5 transition text-left cursor-pointer">
            <span className="flex items-center gap-2.5">
              <FileX className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              Ignore (add to .gitignore)
            </span>
            <ChevronRight className="w-3 h-3 text-text-faint flex-shrink-0" />
          </button>

          {folderSubmenuOpen && submenuPos && createPortal(
            <div
              style={{ left: `${submenuPos.x}px`, top: `${submenuPos.y}px` }}
              className="fixed z-[10001] w-56 bg-base-1 border border-border rounded-sm shadow-2xl py-1 text-xs"
              onMouseEnter={() => setFolderSubmenuOpen(true)}
              onMouseLeave={() => { setFolderSubmenuOpen(false); setSubmenuPos(null); }}
            >
              {/* Ignore file */}
              <button
                onClick={handleIgnoreFile}
                className="w-full px-3 py-1.5 hover:bg-base-2 text-text-primary text-left cursor-pointer transition font-mono truncate"
                title={filePath}
              >
                {fileName}
              </button>

              {/* Folder segments */}
              {folderSegments.length > 0 && (
                <>
                  <div className="h-px bg-border my-1" />
                  {folderSegments.map((seg) => (
                    <button
                      key={seg}
                      onClick={() => handleIgnoreFolder(seg)}
                      className="w-full px-3 py-1.5 hover:bg-base-2 text-text-primary text-left cursor-pointer transition font-mono truncate"
                      title={seg}
                    >
                      {seg}
                    </button>
                  ))}
                </>
              )}

              {/* Ignore all .ext */}
              {extension && (
                <>
                  <div className="h-px bg-border my-1" />
                  <button
                    onClick={handleIgnoreExtension}
                    className="w-full px-3 py-1.5 hover:bg-base-2 text-text-muted hover:text-text-primary text-left cursor-pointer transition truncate"
                  >
                    {ignoreExtLabel}
                  </button>
                </>
              )}
            </div>,
            document.body
          )}
        </div>

      </div>

      <div className="h-px bg-border my-1" />

      {/* Group 3: Copy Paths */}
      <div className="p-1 space-y-0.5">
        <button
          onClick={handleCopyFullPath}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5 text-text-muted" />
          <span>Copy file path</span>
        </button>
        <button
          onClick={handleCopyRelativePath}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-text-muted" />
          <span>Copy relative file path</span>
        </button>
      </div>

      <div className="h-px bg-border my-1" />

      {/* Group 4: Openers */}
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
          <span>Open in Visual Studio Code</span>
        </button>
        <button
          onClick={handleOpenDefault}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
          <span>Open with default program</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
