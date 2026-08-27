import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FilePlus,
  FolderPlus,
  FolderOpen,
  Terminal,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useTerminalStore } from '../../features/terminal/store/terminalStore';
import { SystemService } from '../../services/system/systemService';

interface ChangesEmptySpaceContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
}

export const ChangesEmptySpaceContextMenu: React.FC<ChangesEmptySpaceContextMenuProps> = ({
  x,
  y,
  onClose,
  onNewFile,
  onNewFolder,
}) => {
  const { activeRepoPath } = useGitStore();
  const { setIsOpen: setTerminalOpen } = useTerminalStore();
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

  // 1. New File...
  const handleNewFileClick = () => {
    onClose();
    onNewFile();
  };

  // 2. New Folder...
  const handleNewFolderClick = () => {
    onClose();
    onNewFolder();
  };

  // 3. Reveal in File Explorer
  const handleRevealInExplorer = async () => {
    onClose();
    if (!activeRepoPath) return;
    try {
      await SystemService.showInExplorer(activeRepoPath);
    } catch (err: unknown) {
      console.error('Failed to reveal in explorer:', err);
    }
  };

  // 4. Open in Integrated Terminal
  const handleOpenTerminal = () => {
    onClose();
    setTerminalOpen(true);
  };

  const adjustedX = Math.min(x, window.innerWidth - 240);
  const adjustedY = Math.min(y, window.innerHeight - 180);

  return createPortal(
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-[9999] w-60 bg-base-1 border border-border rounded-md shadow-2xl py-1 text-xs select-none font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="p-1 space-y-0.5">
        {/* New File... */}
        <button
          type="button"
          onClick={handleNewFileClick}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center justify-between transition text-left cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <FilePlus className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
            <span>New File...</span>
          </div>
        </button>

        {/* New Folder... */}
        <button
          type="button"
          onClick={handleNewFolderClick}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center justify-between transition text-left cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-3.5 h-3.5 text-gitlab-teal flex-shrink-0" />
            <span>New Folder...</span>
          </div>
        </button>

        <div className="h-px bg-border my-1 mx-1" />

        {/* Reveal in File Explorer */}
        <button
          type="button"
          onClick={handleRevealInExplorer}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center justify-between transition text-left cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <FolderOpen className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary flex-shrink-0" />
            <span>Reveal in File Explorer</span>
          </div>
          {/* <span className="text-[10px] font-mono text-text-faint">Shift+Alt+R</span> */}
        </button>

        {/* Open in Integrated Terminal */}
        <button
          type="button"
          onClick={handleOpenTerminal}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center justify-between transition text-left cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <Terminal className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary flex-shrink-0" />
            <span>Open in Integrated Terminal</span>
          </div>
        </button>
      </div>
    </div>,
    document.body
  );
};
