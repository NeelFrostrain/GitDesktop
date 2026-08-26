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
import { SmartGitActionButton } from './SmartGitActionButton';
import { BranchDropdown } from './BranchDropdown';
import { Dropdown } from '../common/Dropdown';

/**
 * Top application header bar displaying quick creation tools (Release, Tag, PR/MR, Terminal),
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
              className="h-7 w-7 flex items-center justify-center rounded-sm border border-[#2d2b32] bg-gradient-to-b from-[#222025] via-[#1a191d] to-[#131215] hover:from-[#29272e] hover:via-[#201e24] hover:to-[#17161a] hover:border-commito-coral/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07),0_1px_2px_rgba(0,0,0,0.3)] text-zinc-400 hover:text-commito-coral transition-all cursor-pointer active:scale-95 group"
              title="Draft Release..."
            >
              <Sparkles className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
            </button>

            {/* Create Tag */}
            <button
              type="button"
              onClick={() => setIsCreateTagModalOpen(true)}
              className="h-7 w-7 flex items-center justify-center rounded-sm border border-[#2d2b32] bg-gradient-to-b from-[#222025] via-[#1a191d] to-[#131215] hover:from-[#29272e] hover:via-[#201e24] hover:to-[#17161a] hover:border-amber-500/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07),0_1px_2px_rgba(0,0,0,0.3)] text-zinc-400 hover:text-amber-400 transition-all cursor-pointer active:scale-95 group"
              title="Create Git Tag..."
            >
              <Tag className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
            </button>

            {/* Create Merge / Pull Request */}
            <button
              type="button"
              onClick={() => setIsMergeRequestModalOpen(true)}
              className="h-7 w-7 flex items-center justify-center rounded-sm border border-[#2d2b32] bg-gradient-to-b from-[#222025] via-[#1a191d] to-[#131215] hover:from-[#29272e] hover:via-[#201e24] hover:to-[#17161a] hover:border-commito-coral/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07),0_1px_2px_rgba(0,0,0,0.3)] text-zinc-400 hover:text-commito-coral transition-all cursor-pointer active:scale-95 group"
              title="Create Merge / Pull Request"
            >
              <GitPullRequest className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
            </button>

            {/* Toggle Integrated Terminal */}
            <button
              type="button"
              onClick={toggleTerminal}
              className={`h-7 w-7 flex items-center justify-center rounded-sm border transition-all cursor-pointer active:scale-95 group ${
                isTerminalOpen
                  ? 'border-commito-coral/70 bg-gradient-to-b from-commito-coral/25 to-commito-coral/10 text-commito-coral ring-1 ring-commito-coral/30 shadow-xs'
                  : 'border-[#2d2b32] bg-gradient-to-b from-[#222025] via-[#1a191d] to-[#131215] hover:from-[#29272e] hover:via-[#201e24] hover:to-[#17161a] hover:border-commito-coral/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07),0_1px_2px_rgba(0,0,0,0.3)] text-zinc-400 hover:text-commito-coral'
              }`}
              title="Open in Integrated Terminal"
            >
              <Terminal className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
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
            <button onClick={() => setError(null)} className="ml-1 text-git-removed hover:text-danger cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {!isHome && (
          <>
            {/* Remote Selector Dropdown (when 2+ remotes exist) */}
            {remotes.length > 1 && (
              <div className="w-32">
                <Dropdown
                  options={remotes.map((r) => ({
                    value: r.name,
                    label: r.name,
                    icon: <Globe className="w-3 h-3 text-gitlab-teal" />,
                  }))}
                  value={activeRemote}
                  onChange={(val) => setActiveRemote(val)}
                  placeholder="Remote..."
                  size="sm"
                />
              </div>
            )}

            {/* Smart Git Action Button (with integrated Fetch / Reload) */}
            <SmartGitActionButton />

            {/* Branch Switcher Dropdown */}
            <BranchDropdown />
          </>
        )}
      </div>
    </header>
  );
};
