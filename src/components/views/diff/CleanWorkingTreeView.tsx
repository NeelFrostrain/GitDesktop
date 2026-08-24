import React from 'react';
import {
  Check,
  History,
  Terminal,
  FolderOpen,
  Code2,
} from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { SystemService } from '../../../services/system/systemService';

export const CleanWorkingTreeView: React.FC = () => {
  const { activeRepoPath, setActiveTab } = useGitStore();

  const handleOpenVSCode = () => {
    if (activeRepoPath) SystemService.openInVSCode(activeRepoPath).catch(() => {});
  };

  const handleOpenTerminal = () => {
    if (activeRepoPath) SystemService.openInTerminal(activeRepoPath).catch(() => {});
  };

  const handleShowExplorer = () => {
    if (activeRepoPath) SystemService.showInExplorer(activeRepoPath).catch(() => {});
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
      <div className="max-w-md w-full flex flex-col items-center space-y-4">
        {/* Status Icon */}
        <div className="w-12 h-12 rounded-full bg-git-added/10 border border-git-added/25 text-git-added flex items-center justify-center shadow-xs">
          <Check className="w-6 h-6 stroke-[2.5]" />
        </div>

        {/* Title and Subtitle */}
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-text-primary">No Local Changes</h2>
          <p className="text-xs text-text-muted">
            Your working tree is clean and all files are committed.
          </p>
        </div>

        {/* Quick Launch & Explorer Actions */}
        <div className="w-full pt-1 flex items-center justify-center flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('history')}
            className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <History className="w-3.5 h-3.5" />
            <span>View History</span>
          </button>
          <button
            onClick={handleOpenVSCode}
            className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Open in VS Code</span>
          </button>
          <button
            onClick={handleOpenTerminal}
            className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>
          <button
            onClick={handleShowExplorer}
            className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Show in Explorer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
