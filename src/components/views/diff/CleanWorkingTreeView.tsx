import React from 'react';
import {
  Check,
  Upload,
  Download,
  History,
  Terminal,
  FolderOpen,
  Code2,
  GitBranch,
  Loader2,
} from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { useRepositorySync } from '../../../hooks/useRepositorySync';
import { SystemService } from '../../../services/system/systemService';

export const CleanWorkingTreeView: React.FC = () => {
  const { activeRepoPath, status, setActiveTab } = useGitStore();
  const { executePush, executePull, isPushing, isPulling } = useRepositorySync();

  const branchName = status?.current_branch || 'main';
  const ahead = status?.ahead || 0;
  const behind = status?.behind || 0;

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
      <div className="max-w-md w-full flex flex-col items-center space-y-5">
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

        {/* Contextual Sync Card (Push / Pull / Synced) */}
        {ahead > 0 ? (
          <div className="w-full bg-base-1 border border-border rounded-sm p-3.5 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-text-primary">
              <span className="font-semibold text-commito-coral">{ahead}</span>
              <span className="text-text-muted">commit{ahead > 1 ? 's' : ''} ready to push to</span>
              <span className="font-mono text-[11px] bg-base-2 px-1.5 py-0.5 rounded border border-border flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-commito-coral" />
                origin/{branchName}
              </span>
            </div>
            <button
              onClick={executePush}
              disabled={isPushing}
              className="px-4 py-1.5 bg-commito-coral hover:bg-commito-coralLight text-white text-xs font-semibold rounded-sm flex items-center gap-2 transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPushing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Pushing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Push {ahead} Commit{ahead > 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          </div>
        ) : behind > 0 ? (
          <div className="w-full bg-base-1 border border-border rounded-sm p-3.5 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-text-primary">
              <span className="font-semibold text-gitlab-blue">{behind}</span>
              <span className="text-text-muted">commit{behind > 1 ? 's' : ''} available to pull from</span>
              <span className="font-mono text-[11px] bg-base-2 px-1.5 py-0.5 rounded border border-border flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-gitlab-blue" />
                origin/{branchName}
              </span>
            </div>
            <button
              onClick={executePull}
              disabled={isPulling}
              className="px-4 py-1.5 bg-gitlab-blue hover:bg-gitlab-blue/90 text-white text-xs font-semibold rounded-sm flex items-center gap-2 transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPulling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Pulling...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Pull {behind} Commit{behind > 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs text-text-muted bg-base-1 border border-border px-3 py-1.5 rounded-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-git-added" />
            <span>Up to date with</span>
            <span className="font-mono text-[11px] text-text-primary font-medium">
              origin/{branchName}
            </span>
          </div>
        )}

        {/* Quick Launch & Explorer Actions */}
        <div className="w-full pt-2 flex items-center justify-center flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('history')}
            className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>View History</span>
          </button>
          <button
            onClick={handleOpenVSCode}
            className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Open in VS Code</span>
          </button>
          <button
            onClick={handleOpenTerminal}
            className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>
          <button
            onClick={handleShowExplorer}
            className="px-2.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-muted hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Show in Explorer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
