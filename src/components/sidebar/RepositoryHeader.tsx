import React, { useState } from 'react';
import { ChevronsUpDown, FolderGit2 } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { RepoDrawer } from '../layout/RepoDrawer';
import { Tabs } from '../common/Tabs';

export const RepositoryHeader: React.FC = () => {
  const { activeRepoPath, status, branches, activeTab, setActiveTab } = useGitStore();
  const [isRepoDrawerOpen, setIsRepoDrawerOpen] = useState(false);

  const activeRepoName = activeRepoPath
    ? activeRepoPath.split(/[/\\]/).pop() || 'Repository'
    : 'No Repository';

  const branchCount = branches.length || 1;
  const currentBranch = status?.current_branch || 'main';
  const fileCount = status?.files?.length || 0;

  const handleOpenRepoSwitcher = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRepoDrawerOpen(true);
  };

  return (
    <>
      {/* Single Unified Header Row: Compact Repo Switcher (Left) + View Tabs (Right) */}
      <div className="px-2.5 py-2 border-b border-border/40 bg-base-0 select-none flex items-stretch justify-between gap-1.5 py-1">
        {/* Left: Compact Repository Switcher Box */}
        {activeRepoPath ? (
          <button
            type="button"
            onClick={handleOpenRepoSwitcher}
            className="w-[80px] min-w-0 h-full px-2 rounded-sm border border-border/60 bg-base-1/90 hover:bg-base-2/90 hover:border-border-strong/80 flex items-center justify-between gap-1 cursor-pointer transition-all duration-150 shadow-xs group outline-none text-left flex-shrink-0"
            title={`${activeRepoName}\nBranch: ${currentBranch}\nTotal Branches: ${branchCount}`}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <div className="w-4.5 h-4.5 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-150">
                <FolderGit2 className="w-3 h-3" />
              </div>
              <span className="text-[11.5px] font-semibold text-text truncate block leading-tight group-hover:text-commito-coral transition-colors duration-150">
                {activeRepoName}
              </span>
            </div>
            <ChevronsUpDown className="w-3 h-3 text-text-muted group-hover:text-text transition-colors flex-shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenRepoSwitcher}
            className="w-[100px] min-w-0 h-full px-2 bg-base-1/50 border border-dashed border-border/70 hover:border-commito-coral/50 hover:bg-base-2/60 rounded-sm flex items-center justify-between gap-1 cursor-pointer transition-all duration-150 group outline-none text-left flex-shrink-0"
          >
            <div className="flex items-center gap-1.5 text-xs text-text-muted min-w-0">
              <FolderGit2 className="w-3 h-3 text-text-faint group-hover:text-commito-coral transition-colors flex-shrink-0" />
              <span className="font-medium truncate group-hover:text-text transition-colors">Select Repo...</span>
            </div>
            <ChevronsUpDown className="w-3 h-3 text-text-faint group-hover:text-text-muted transition-colors flex-shrink-0" />
          </button>
        )}

        {/* Right: View Change Tabs Box (Changes / History) */}
        <div className="flex-1 min-w-0 h-full">
          <Tabs<'changes' | 'history'>
            tabs={[
              {
                id: 'changes',
                label: 'Changes',
                badge: fileCount,
                badgeVariant: 'coral',
              },
              {
                id: 'history',
                label: 'History',
              },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
            fullWidth
            size="md"
            ariaLabel="Repository change views"
            className='h-full'
          />
        </div>
      </div>

      {/* Slide-over Drawer from the right */}
      <RepoDrawer
        isOpen={isRepoDrawerOpen}
        onClose={() => setIsRepoDrawerOpen(false)}
      />
    </>
  );
};