import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { 
  RotateCcw, 
  FileX, 
  FileStack, 
  Copy, 
  FileText, 
  FolderOpen, 
  Code, 
  ExternalLink 
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { RepoStatus } from '../types/git';

interface FileContextMenuProps {
  filePath: string;
  x: number;
  y: number;
  onClose: () => void;
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  filePath,
  x,
  y,
  onClose,
}) => {
  const { activeRepoPath, setStatus, setError } = useGitStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Extract file extension for dynamic ignore label
  const fileName = filePath.split(/[/\\]/).filter(Boolean).pop() || filePath;
  const extParts = fileName.split('.');
  const extension = extParts.length > 1 ? extParts.pop() : '';
  const ignoreExtLabel = extension ? `Ignore all .${extension} files (add to .gitignore)` : `Ignore extension (add to .gitignore)`;

  const fullPath = activeRepoPath
    ? `${activeRepoPath.replace(/[\/\\]+$/, '')}/${filePath.replace(/^[\/\\]+/, '')}`
    : filePath;

  const fullDir = fullPath.substring(0, Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\')));

  // 1. Discard changes
  const handleDiscardChanges = async () => {
    if (!activeRepoPath) return;

    if (confirm(`Are you sure you want to discard changes in '${filePath}'? This action cannot be undone.`)) {
      try {
        await invoke('discard_file_changes_cmd', {
          repoPath: activeRepoPath,
          filePath,
        });

        useLogStore.getState().addLog('info', 'Git', `Discarded changes in '${filePath}'`);
        const res = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
        setStatus(res);
      } catch (err: any) {
        setError({ code: 'DISCARD_ERROR', message: err.message || String(err) });
      }
    }
    onClose();
  };

  // 2. Ignore file (add to .gitignore)
  const handleIgnoreFile = async () => {
    if (!activeRepoPath) return;

    try {
      await invoke('ignore_file_pattern_cmd', {
        repoPath: activeRepoPath,
        pattern: filePath,
      });

      useLogStore.getState().addLog('success', 'Git', `Added '${filePath}' to .gitignore`);
      const res = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(res);
    } catch (err: any) {
      setError({ code: 'GITIGNORE_ERROR', message: err.message || String(err) });
    }
    onClose();
  };

  // 3. Ignore all .ext files (add to .gitignore)
  const handleIgnoreExtension = async () => {
    if (!activeRepoPath || !extension) return;
    const pattern = `*.${extension}`;

    try {
      await invoke('ignore_file_pattern_cmd', {
        repoPath: activeRepoPath,
        pattern,
      });

      useLogStore.getState().addLog('success', 'Git', `Added '${pattern}' to .gitignore`);
      const res = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(res);
    } catch (err: any) {
      setError({ code: 'GITIGNORE_ERROR', message: err.message || String(err) });
    }
    onClose();
  };

  // 4. Copy file path
  const handleCopyFullPath = () => {
    navigator.clipboard.writeText(fullPath);
    useLogStore.getState().addLog('info', 'System', `Copied file path '${fullPath}' to clipboard`);
    onClose();
  };

  // 5. Copy relative file path
  const handleCopyRelativePath = () => {
    navigator.clipboard.writeText(filePath);
    useLogStore.getState().addLog('info', 'System', `Copied relative path '${filePath}' to clipboard`);
    onClose();
  };

  // 6. Show in Explorer
  const handleShowInExplorer = async () => {
    try {
      await invoke('show_in_explorer_cmd', { repoPath: fullDir || fullPath });
      useLogStore.getState().addLog('info', 'System', `Opened file manager at '${fullDir || fullPath}'`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'System', `Failed to open Explorer: ${err.message || err}`);
    }
    onClose();
  };

  // 7. Open in Visual Studio Code
  const handleOpenVSCode = async () => {
    try {
      await invoke('open_in_vscode_cmd', { repoPath: fullPath });
      useLogStore.getState().addLog('info', 'System', `Opened '${filePath}' in Visual Studio Code`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'System', `Failed to open VS Code: ${err.message || err}`);
    }
    onClose();
  };

  // 8. Open with default program
  const handleOpenDefault = async () => {
    try {
      await invoke('open_file_default_cmd', { filePath: fullPath });
      useLogStore.getState().addLog('info', 'System', `Opened '${filePath}' in default application`);
    } catch (err: any) {
      useLogStore.getState().addLog('error', 'System', `Failed to open file: ${err.message || err}`);
    }
    onClose();
  };

  // Prevent menu overflow off-screen
  const adjustedX = Math.min(x, window.innerWidth - 250);
  const adjustedY = Math.min(y, window.innerHeight - 340);

  return createPortal(
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-[9999] w-64 bg-base-1/95 backdrop-blur-md border border-border rounded-xl shadow-2xl py-1 text-xs select-none font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Group 1: Discard changes */}
      <div className="p-1">
        <button
          onClick={handleDiscardChanges}
          className="w-full px-2.5 py-1.5 rounded-lg hover:bg-red-950/40 text-red-400 hover:text-red-300 flex items-center gap-2.5 transition text-left font-medium"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Discard changes</span>
        </button>
      </div>

      <div className="h-px bg-border my-1" />

      {/* Group 2: GitIgnore options */}
      <div className="p-1 space-y-0.5">
        <button
          onClick={handleIgnoreFile}
          className="w-full px-2.5 py-1.5 rounded-lg hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <FileX className="w-3.5 h-3.5 text-text-muted" />
          <span>Ignore file (add to .gitignore)</span>
        </button>

        {extension && (
          <button
            onClick={handleIgnoreExtension}
            className="w-full px-2.5 py-1.5 rounded-lg hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
          >
            <FileStack className="w-3.5 h-3.5 text-text-muted" />
            <span>{ignoreExtLabel}</span>
          </button>
        )}
      </div>

      <div className="h-px bg-border my-1" />

      {/* Group 3: Copy Paths */}
      <div className="p-1 space-y-0.5">
        <button
          onClick={handleCopyFullPath}
          className="w-full px-2.5 py-1.5 rounded-lg hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <Copy className="w-3.5 h-3.5 text-text-muted" />
          <span>Copy file path</span>
        </button>

        <button
          onClick={handleCopyRelativePath}
          className="w-full px-2.5 py-1.5 rounded-lg hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
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
          className="w-full px-2.5 py-1.5 rounded-lg hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Show in Explorer</span>
        </button>

        <button
          onClick={handleOpenVSCode}
          className="w-full px-2.5 py-1.5 rounded-lg hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <Code className="w-3.5 h-3.5 text-blue-400" />
          <span>Open in Visual Studio Code</span>
        </button>

        <button
          onClick={handleOpenDefault}
          className="w-full px-2.5 py-1.5 rounded-lg hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left"
        >
          <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
          <span>Open with default program</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
