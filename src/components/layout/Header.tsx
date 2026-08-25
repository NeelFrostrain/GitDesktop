import React, { useEffect } from 'react';
import {
  GitPullRequest,
  Tag,
  Sparkles,
  FolderGit2,
  FileCode,
  RotateCcw,
  History,
  AlertCircle,
  X,
  Globe,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useRemoteStore } from '../../store/remoteStore';
import { SmartGitActionButton } from './SmartGitActionButton';
import { BranchDropdown } from './BranchDropdown';
import { Dropdown } from '../common/Dropdown';

/**
 * Top application header bar displaying quick creation tools (Release, Tag, PR/MR, Worktree, Patch, Rebase, Reflog),
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
    setIsWorktreeModalOpen,
    setIsPatchModalOpen,
    setIsRebaseModalOpen,
    setIsReflogModalOpen,
  } = useGitStore();

  const {
    remotes,
    activeRemote,
    setActiveRemote,
    loadRemotes,
  } = useRemoteStore();

  useEffect(() => {
    if (activeRepoPath) {
      loadRemotes(activeRepoPath);
    }
  }, [activeRepoPath, loadRemotes]);

  const isHome = currentNavView === 'home';

  return (
    <header className="h-10 bg-base-0 border-b border-border px-2 flex items-center justify-between flex-shrink-0 select-none">
      {/* Left: Quick Create & Inspection Tools */}
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
              className="h-7 w-7 flex items-center justify-center text-text-muted hover:text-commito-coral hover:bg-base-2 rounded-sm border border-border transition cursor-pointer shadow-2xs"
              title="Draft Release..."
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>

            {/* Create Tag */}
            <button
              type="button"
              onClick={() => setIsCreateTagModalOpen(true)}
              className="h-7 w-7 flex items-center justify-center text-text-muted hover:text-amber-400 hover:bg-base-2 rounded-sm border border-border transition cursor-pointer shadow-2xs"
              title="Create Git Tag..."
            >
              <Tag className="w-3.5 h-3.5" />
            </button>

            {/* Create Merge / Pull Request */}
            <button
              type="button"
              onClick={() => setIsMergeRequestModalOpen(true)}
              className="h-7 w-7 flex items-center justify-center text-text-muted hover:text-commito-coral hover:bg-base-2 rounded-sm border border-border transition cursor-pointer shadow-2xs"
              title="Create Merge / Pull Request"
            >
              <GitPullRequest className="w-3.5 h-3.5" />
            </button>

            {/* Worktrees Tool */}
            <button
              type="button"
              onClick={() => setIsWorktreeModalOpen(true)}
              className="h-7 w-7 flex items-center justify-center text-text-muted hover:text-emerald-400 hover:bg-base-2 rounded-sm border border-border transition cursor-pointer shadow-2xs"
              title="Manage Worktrees"
            >
              <FolderGit2 className="w-3.5 h-3.5" />
            </button>

            {/* Patch Studio */}
            <button
              type="button"
              onClick={() => setIsPatchModalOpen(true)}
              className="h-7 w-7 flex items-center justify-center text-text-muted hover:text-cyan-400 hover:bg-base-2 rounded-sm border border-border transition cursor-pointer shadow-2xs"
              title="Export / Apply Patch"
            >
              <FileCode className="w-3.5 h-3.5" />
            </button>

            {/* Interactive Rebase */}
            <button
              type="button"
              onClick={() => setIsRebaseModalOpen(true)}
              className="h-7 w-7 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-base-2 rounded-sm border border-border transition cursor-pointer shadow-2xs"
              title="Interactive Rebase"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Reflog History */}
            <button
              type="button"
              onClick={() => setIsReflogModalOpen(true)}
              className="h-7 w-7 flex items-center justify-center text-text-muted hover:text-gitlab-teal hover:bg-base-2 rounded-sm border border-border transition cursor-pointer shadow-2xs"
              title="Reflog History"
            >
              <History className="w-3.5 h-3.5" />
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
