import React from 'react';
import { Check, History, Terminal, FolderOpen, Code2 } from 'lucide-react';
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
    <div className="h-full w-full flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none animate-in fade-in duration-200 overflow-y-auto">
      <div className="max-w-xl w-full flex flex-col items-center space-y-4 px-2">
        {/* Status Icon */}
        <div className="w-12 h-12 rounded-full bg-git-added/10 border border-git-added/25 text-git-added flex items-center justify-center shadow-xs">
          <Check className="w-6 h-6 stroke-[2.5]" />
        </div>

        {/* Title and Subtitle */}
        <div className="space-y-1">
          <h2 className="text-sm sm:text-base font-semibold text-text-primary">No Local Changes</h2>
          <p className="text-xs text-text-muted">
            Your working tree is clean and all files are committed.
          </p>
        </div>

        {/* Quick Launch & Explorer Actions — centered row */}
        <div className="flex items-center justify-center flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
          >
            <History className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">View History</span>
          </button>
          <button
            type="button"
            onClick={handleOpenVSCode}
            className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
          >
            <Code2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Open in VS Code</span>
          </button>
          <button
            type="button"
            onClick={handleOpenTerminal}
            className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
          >
            <Terminal className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Terminal</span>
          </button>
          <button
            type="button"
            onClick={handleShowExplorer}
            className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Show in Explorer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
