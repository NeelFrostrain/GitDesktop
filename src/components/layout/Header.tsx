import React, { useEffect } from 'react';
import {
  GitPullRequest,
  Tag,
  Sparkles,
  Terminal,
  AlertCircle,
  X,
  Globe,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useRemoteStore } from '../../store/remoteStore';
import { useTerminalStore } from '../../features/terminal/store/terminalStore';
import { useAiAgentStore } from '../../features/ai-agent';
import { SmartGitActionButton } from './SmartGitActionButton';
import { BranchDropdown } from './BranchDropdown';
import { Dropdown } from '../common/Dropdown';

/**
 * Top application header bar displaying quick creation tools (Release, Tag, PR/MR, Terminal, AI Agent),
 * active sync/fetch button, remote selector, and branch switcher.
 */
export const Header: React.FC = () => {
  const {
    activeRepoPath,
    error,
    setError,
    currentNavView,
    setIsMergeRequestModalOpen,
    setIsCreateTagModalOpen,
    setIsCreateReleaseModalOpen,
    setEditingRelease,
  } = useGitStore();

  const {
    remotes,
    activeRemote,
    setActiveRemote,
    loadRemotes,
  } = useRemoteStore();

  const {
    isOpen: isTerminalOpen,
    toggleIsOpen: toggleTerminal,
  } = useTerminalStore();

  const {
    isOpen: isAiAgentOpen,
    toggleIsOpen: toggleAiAgent,
  } = useAiAgentStore();

  useEffect(() => {
    if (activeRepoPath) {
      loadRemotes(activeRepoPath);
    }
  }, [activeRepoPath, loadRemotes]);

  const isHome = currentNavView === 'home';

  return (
    <header className="h-10 bg-base-0 border-b border-border px-2 flex items-center justify-between flex-shrink-0 select-none">
      {/* Left: Quick Create Tools */}
      <div className="flex items-center gap-1.5">
        {!isHome && (
          <>
            {/* Draft Release */}
            <button
              type="button"
              onClick={() => {
                setEditingRelease(null);
                setIsCreateReleaseModalOpen(true);
              }}
              className="h-7 w-7 flex items-center justify-center rounded-sm border border-border bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-muted hover:text-commito-coral transition cursor-pointer active:scale-95 group shadow-2xs"
              title="Draft Release..."
            >
              <Sparkles className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
            </button>

            {/* Create Tag */}
            <button
              type="button"
              onClick={() => setIsCreateTagModalOpen(true)}
              className="h-7 w-7 flex items-center justify-center rounded-sm border border-border bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-muted hover:text-amber-400 transition cursor-pointer active:scale-95 group shadow-2xs"
              title="Create Git Tag..."
            >
              <Tag className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
            </button>

            {/* Create Merge / Pull Request */}
            <button
              type="button"
              onClick={() => setIsMergeRequestModalOpen(true)}
              className="h-7 w-7 flex items-center justify-center rounded-sm border border-border bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-muted hover:text-commito-coral transition cursor-pointer active:scale-95 group shadow-2xs"
              title="Create Merge / Pull Request"
            >
              <GitPullRequest className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
            </button>

            {/* Toggle Integrated Terminal */}
            <button
              type="button"
              onClick={toggleTerminal}
              className={`h-7 w-7 flex items-center justify-center rounded-sm border transition cursor-pointer active:scale-95 group shadow-2xs ${
                isTerminalOpen
                  ? 'border-commito-coral/50 bg-commito-coral/15 text-commito-coral'
                  : 'border-border bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-muted hover:text-commito-coral'
              }`}
              title="Open in Integrated Terminal"
            >
              <Terminal className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
            </button>

            {/* Toggle AI Git Agent */}
            <button
              type="button"
              onClick={toggleAiAgent}
              className={`h-7 px-2 flex items-center justify-center gap-1.5 rounded-sm border transition cursor-pointer active:scale-95 group shadow-2xs ${
                isAiAgentOpen
                  ? 'border-commito-coral/60 bg-commito-coral/20 text-commito-coral ring-1 ring-commito-coral/30'
                  : 'border-border bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-muted hover:text-commito-coral hover:border-commito-coral/40'
              }`}
              title="AI Git Agent (Ctrl+I)"
            >
              <span className="text-[11px] font-semibold">AI Agent</span>
            </button>
          </>
        )}
      </div>

      {/* Right: Sync, Push, Branch & PR Action Group */}
      <div className="flex items-center gap-2">
        {error && !error.message?.includes('No remote configured') && !error.message?.includes('Not authenticated') && (
          <div
            className="flex items-center gap-1 text-[11px] text-git-removed bg-git-removed-bg border border-git-removed/40 px-2 py-0.5 rounded-sm max-w-xs truncate"
            title={error.message}
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{error.message}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-1 hover:text-text-primary p-0.5"
              aria-label="Dismiss error"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {!isHome && (
          <>
            {/* Sync / Push Smart Button */}
            <SmartGitActionButton />

            {/* Remote Selector Dropdown */}
            {remotes.length > 0 && (
              <Dropdown
                value={activeRemote || remotes[0]?.name || ''}
                options={remotes.map((r) => ({
                  value: r.name,
                  label: r.name,
                  description: r.url,
                }))}
                onChange={(val) => setActiveRemote(val)}
                className="w-24 text-xs font-mono"
                icon={<Globe className="w-3.5 h-3.5 text-text-muted" />}
              />
            )}

            {/* Active Branch Switcher */}
            <BranchDropdown />
          </>
        )}
      </div>
    </header>
  );
};
