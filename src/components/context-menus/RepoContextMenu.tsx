import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  Edit3,
  Layers,
  PlusSquare,
  Copy,
  Folder,
  ExternalLink,
  Terminal,
  FolderOpen,
  Code,
  Trash2,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { SystemService } from '../../services/system/systemService';
import { getErrorMessage } from '../../shared/utils/errorUtils';

interface RepoContextMenuProps {
  repoPath: string;
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Context menu for repository entries in the recent lists and dropdowns, offering alias editing,
 * worktree management, path copying, external tools launcher (terminal, explorer, VS Code), and removal.
 */
export const RepoContextMenu: React.FC<RepoContextMenuProps> = ({
  repoPath,
  x,
  y,
  onClose,
}) => {
  const {
    repoAliases,
    setRepoAlias,
    removeRecentRepo,
    setActiveRepoPath,
    setIsWorktreeModalOpen,
    user,
  } = useGitStore();

  const [showAliasInput, setShowAliasInput] = useState(false);
  const [aliasText, setAliasText] = useState(repoAliases[repoPath.replace(/\\/g, '/')] || '');
  const menuRef = useRef<HTMLDivElement>(null);

  const repoName = repoPath.split(/[/\\]/).filter(Boolean).pop() || repoPath;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleCopyName = () => {
    navigator.clipboard.writeText(repoName);
    useLogStore.getState().addLog('info', 'System', `Copied repo name '${repoName}' to clipboard`);
    onClose();
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(repoPath);
    useLogStore.getState().addLog('info', 'System', `Copied repo path '${repoPath}' to clipboard`);
    onClose();
  };

  const handleOpenTerminal = async () => {
    try {
      await SystemService.openInTerminal(repoPath);
      useLogStore.getState().addLog('info', 'System', `Opened terminal at '${repoPath}'`);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'System', `Failed to open terminal: ${msg}`);
    }
    onClose();
  };

  const handleOpenVSCode = async () => {
    try {
      await SystemService.openInVSCode(repoPath);
      useLogStore.getState().addLog('info', 'System', `Opened VS Code at '${repoPath}'`);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'System', `Failed to open VS Code: ${msg}`);
    }
    onClose();
  };

  const handleShowInExplorer = async () => {
    try {
      await SystemService.showInExplorer(repoPath);
      useLogStore.getState().addLog('info', 'System', `Opened file manager at '${repoPath}'`);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useLogStore.getState().addLog('error', 'System', `Failed to open Explorer: ${msg}`);
    }
    onClose();
  };

  const handleViewOnRemote = async () => {
    const host = user?.provider === 'github' ? 'https://github.com' : 'https://gitlab.com';
    const remoteUrl = `${host}/${repoName}`;
    try {
      await openUrl(remoteUrl);
    } catch {
      useLogStore.getState().addLog('warning', 'Remote', `Could not open remote URL '${remoteUrl}'`);
    }
    onClose();
  };

  const handleSaveAlias = (e: React.FormEvent) => {
    e.preventDefault();
    setRepoAlias(repoPath, aliasText);
    useLogStore.getState().addLog('info', 'Repo', `Set alias for '${repoName}' to '${aliasText}'`);
    setShowAliasInput(false);
    onClose();
  };

  const handleShowWorktrees = () => {
    setActiveRepoPath(repoPath);
    setIsWorktreeModalOpen(true);
    onClose();
  };

  const handleRemoveRepo = () => {
    removeRecentRepo(repoPath);
    onClose();
  };

  const adjustedX = Math.min(x, window.innerWidth - 240);
  const adjustedY = Math.min(y, window.innerHeight - 360);

  return createPortal(
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-[9999] w-56 bg-base-1 border border-border rounded-md shadow-2xl py-1 text-xs select-none font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100"
    >
      {showAliasInput ? (
        <form onSubmit={handleSaveAlias} className="p-2 space-y-2">
          <label className="text-[11px] font-bold text-text-secondary block">
            Set Repository Alias
          </label>
          <input
            type="text"
            placeholder="e.g. My Primary Client Repo"
            value={aliasText}
            onChange={(e) => setAliasText(e.target.value)}
            className="w-full px-2.5 py-1 bg-base-2 border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-commito-coral"
            autoFocus
          />
          <div className="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setShowAliasInput(false)}
              className="px-2 py-1 text-[11px] bg-base-2 hover:bg-base-3 text-text-muted rounded-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2 py-1 text-[11px] bg-commito-coral hover:bg-commito-coralLight text-white font-bold rounded-md cursor-pointer"
            >
              Save Alias
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Group 1: Custom Alias & Worktrees */}
          <div className="p-1 space-y-0.5">
            <button
              onClick={() => setShowAliasInput(true)}
              className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-commito-coral" />
              <span>Create alias</span>
            </button>

            <button
              onClick={handleShowWorktrees}
              className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-gitlab-teal" />
              <span>Show worktrees</span>
            </button>

            <button
              onClick={handleShowWorktrees}
              className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
            >
              <PlusSquare className="w-3.5 h-3.5 text-gitlab-orange" />
              <span>New worktree...</span>
            </button>
          </div>

          <div className="h-px bg-border my-1" />

          {/* Group 2: Copy Info */}
          <div className="p-1 space-y-0.5">
            <button
              onClick={handleCopyName}
              className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-text-muted" />
              <span>Copy repo name</span>
            </button>

            <button
              onClick={handleCopyPath}
              className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5 text-text-muted" />
              <span>Copy repo path</span>
            </button>
          </div>

          <div className="h-px bg-border my-1" />

          {/* Group 3: System Openers */}
          <div className="p-1 space-y-0.5">
            <button
              onClick={handleViewOnRemote}
              className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-github-dark-accent" />
              <span>Open in remote</span>
            </button>

            <button
              onClick={handleOpenTerminal}
              className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Open in Command Prompt</span>
            </button>

            <button
              onClick={handleShowInExplorer}
              className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Show in Explorer</span>
            </button>

            <button
              onClick={handleOpenVSCode}
              className="w-full px-2.5 py-1.5 rounded-md hover:bg-base-2 text-text-primary flex items-center gap-2 transition cursor-pointer"
            >
              <Code className="w-3.5 h-3.5 text-blue-400" />
              <span>Open in Visual Studio Code</span>
            </button>
          </div>

          <div className="h-px bg-border my-1" />

          {/* Group 4: Destructive Action */}
          <div className="p-1">
            <button
              onClick={handleRemoveRepo}
              className="w-full px-2.5 py-1.5 rounded-md hover:bg-red-950/40 text-red-400 hover:text-red-300 flex items-center gap-2 transition font-medium cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove...</span>
            </button>
          </div>
        </>
      )}
    </div>,
    document.body
  );
};
