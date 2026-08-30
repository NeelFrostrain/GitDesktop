import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FilePlus,
  FolderPlus,
  FolderOpen,
  Terminal,
  Copy,
  Folder,
  Code,
  Trash2,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useGitStore } from '../../store/useGitStore';
import { useRepoStore } from '../../store/repoStore';
import { useRemoteStore } from '../../store/remoteStore';
import { useTerminalStore } from '../../features/terminal/store/terminalStore';
import { SystemService } from '../../services/system/systemService';
import { useLogStore } from '../../store/useLogStore';
import { getErrorMessage } from '../../shared/utils/errorUtils';
import { getWebUrlFromRemoteUrl } from '../../shared/utils/urlUtils';

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
  const { activeRepoPath, removeRecentRepo } = useGitStore();
  const { remotes } = useRemoteStore();
  const { repos, removeRepo } = useRepoStore();
  const { setIsOpen: setTerminalOpen } = useTerminalStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  // Keep a ref so event listeners always see the latest value without re-registering
  const showRemoveConfirmRef = useRef(false);
  showRemoveConfirmRef.current = showRemoveConfirm;

  const repoName = activeRepoPath
    ? activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || activeRepoPath
    : '';

  // Derive a browsable web URL from the first configured remote
  const remoteUrl = remotes.length > 0 ? remotes[0].url : null;
  const webUrl = remoteUrl ? getWebUrlFromRemoteUrl(remoteUrl) : null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close the menu while the confirm dialog is open —
      // the dialog buttons are outside menuRef and would trigger this
      if (showRemoveConfirmRef.current) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showRemoveConfirmRef.current) {
          // Let ConfirmDialog's own Escape handler close it first
          setShowRemoveConfirm(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // ── Group 1: File Creation ────────────────────────────────────────────────
  const handleNewFileClick = () => {
    onClose();
    onNewFile();
  };
  const handleNewFolderClick = () => {
    onClose();
    onNewFolder();
  };

  // ── Group 2: Explorer & Integrated Terminal ───────────────────────────────
  const handleRevealInExplorer = async () => {
    onClose();
    if (!activeRepoPath) return;
    try {
      await SystemService.showInExplorer(activeRepoPath);
    } catch (err: unknown) {
      useLogStore
        .getState()
        .addLog('error', 'System', `Failed to reveal in Explorer: ${getErrorMessage(err)}`);
    }
  };

  const handleOpenIntegratedTerminal = () => {
    onClose();
    setTerminalOpen(true);
  };

  // ── Group 3: Copy ─────────────────────────────────────────────────────────
  const handleCopyRepoName = () => {
    if (!repoName) return;
    navigator.clipboard.writeText(repoName);
    useLogStore.getState().addLog('info', 'System', `Copied repo name '${repoName}' to clipboard`);
    onClose();
  };

  const handleCopyRepoPath = () => {
    if (!activeRepoPath) return;
    navigator.clipboard.writeText(activeRepoPath);
    useLogStore
      .getState()
      .addLog('info', 'System', `Copied repo path '${activeRepoPath}' to clipboard`);
    onClose();
  };

  // ── Group 4: External Tools ───────────────────────────────────────────────
  const handleViewOnRemote = async () => {
    onClose();
    if (!webUrl) return;
    try {
      await SystemService.openInBrowser(webUrl);
    } catch (err: unknown) {
      useLogStore
        .getState()
        .addLog('warning', 'Remote', `Could not open remote URL: ${getErrorMessage(err)}`);
    }
  };

  const handleOpenVSCode = async () => {
    onClose();
    if (!activeRepoPath) return;
    try {
      await SystemService.openInVSCode(activeRepoPath);
      useLogStore.getState().addLog('info', 'System', `Opened VS Code at '${activeRepoPath}'`);
    } catch (err: unknown) {
      useLogStore
        .getState()
        .addLog('error', 'System', `Failed to open VS Code: ${getErrorMessage(err)}`);
    }
  };

  // ── Group 5: Destructive ─────────────────────────────────────────────────
  const handleRemoveClick = () => {
    // Show confirm dialog instead of removing immediately
    setShowRemoveConfirm(true);
  };

  const handleConfirmRemove = async () => {
    const targetPath = activeRepoPath;
    const targetName = repoName;
    setShowRemoveConfirm(false);
    onClose();
    if (!targetPath) return;

    // 1. Remove from registry (dashboard)
    try {
      const registryEntry = repos.find(
        (r) =>
          r.path.replace(/\\/g, '/').toLowerCase() === targetPath.replace(/\\/g, '/').toLowerCase()
      );
      await removeRepo(registryEntry ? registryEntry.id : targetPath);
    } catch {
      // ignore
    }

    // 2. Remove from recent list
    removeRecentRepo(targetPath);

    // 3. Clear active repo and return to home view
    useGitStore.getState().setActiveRepoPath(null);
    useGitStore.getState().setCurrentNavView('home');

    useLogStore.getState().addLog('info', 'Repo', `Removed '${targetName}' from app`);
  };

  const handleCancelRemove = () => {
    setShowRemoveConfirm(false);
    onClose();
  };

  const adjustedX = Math.min(x, window.innerWidth - 250);
  const adjustedY = Math.min(y, window.innerHeight - 460);

  const item =
    'w-full px-2.5 py-1.5 rounded-sm hover:bg-base-2 text-text-primary flex items-center gap-2.5 transition text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  const menu = createPortal(
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-[9999] w-60 bg-base-1 border border-border rounded-sm shadow-2xl py-1 text-xs select-none font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100"
    >
      {/* ── Group 1: File Creation ── */}
      <div className="p-1 space-y-0.5">
        <button type="button" onClick={handleNewFileClick} className={item}>
          <FilePlus className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
          <span>New File...</span>
        </button>
        <button type="button" onClick={handleNewFolderClick} className={item}>
          <FolderPlus className="w-3.5 h-3.5 text-gitlab-teal flex-shrink-0" />
          <span>New Folder...</span>
        </button>
      </div>

      <div className="h-px bg-border my-1 mx-1" />

      {/* ── Group 2: Explorer & Integrated Terminal ── */}
      <div className="p-1 space-y-0.5">
        <button type="button" onClick={handleRevealInExplorer} className={item}>
          <FolderOpen className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span>Reveal in File Explorer</span>
        </button>
        <button type="button" onClick={handleOpenIntegratedTerminal} className={item}>
          <Terminal className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span>Open in Integrated Terminal</span>
        </button>
      </div>

      <div className="h-px bg-border my-1 mx-1" />

      {/* ── Group 3: Copy ── */}
      <div className="p-1 space-y-0.5">
        <button type="button" onClick={handleCopyRepoName} disabled={!repoName} className={item}>
          <Copy className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          <span>Copy Repo Name</span>
        </button>
        <button
          type="button"
          onClick={handleCopyRepoPath}
          disabled={!activeRepoPath}
          className={item}
        >
          <Folder className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          <span>Copy Repo Path</span>
        </button>
      </div>

      <div className="h-px bg-border my-1 mx-1" />

      {/* ── Group 4: External Tools ── */}
      <div className="p-1 space-y-0.5">
        {webUrl && (
          <button type="button" onClick={handleViewOnRemote} className={item}>
            <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span>View on Remote</span>
            <ExternalLink className="w-3 h-3 text-text-faint ml-auto flex-shrink-0" />
          </button>
        )}
        <button
          type="button"
          onClick={handleOpenVSCode}
          disabled={!activeRepoPath}
          className={item}
        >
          <Code className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <span>Open in Visual Studio Code</span>
        </button>
      </div>

      <div className="h-px bg-border my-1 mx-1" />

      {/* ── Group 5: Destructive ── */}
      <div className="p-1">
        <button
          type="button"
          onClick={handleRemoveClick}
          disabled={!activeRepoPath}
          className="w-full px-2.5 py-1.5 rounded-sm hover:bg-git-removed-bg text-git-removed hover:text-danger flex items-center gap-2.5 transition text-left cursor-pointer font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Remove...</span>
        </button>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {!showRemoveConfirm && menu}
      <ConfirmDialog
        isOpen={showRemoveConfirm}
        variant="danger"
        title="Remove Repository"
        subtitle={repoName}
        description={`'${repoName}' will be removed from the dashboard and your recent repository list. The files on disk will not be deleted.`}
        discardText="Remove Repository"
        cancelText="Keep It"
        onDiscard={handleConfirmRemove}
        onCancel={handleCancelRemove}
      />
    </>
  );
};
