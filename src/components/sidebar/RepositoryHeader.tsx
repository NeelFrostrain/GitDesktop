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
      <div className="border-b border-border bg-base-0 select-none p-2 flex flex-col gap-2">
        {/* Top Row: Full-width Repository Switcher Button */}
        {activeRepoPath ? (
          <button
            type="button"
            onClick={handleOpenRepoSwitcher}
            className="w-full h-8.5 px-2.5 rounded-sm border border-border bg-base-1/70 hover:bg-base-2 hover:border-border-strong active:bg-base-3 flex items-center justify-between gap-2 cursor-pointer transition shadow-2xs group outline-none text-left"
            title={`${activeRepoName}\nBranch: ${currentBranch}\nTotal Branches: ${branchCount}\nClick to switch repository`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-5.5 h-5.5 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FolderGit2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-text-primary truncate block group-hover:text-commito-coral transition-colors">
                {activeRepoName}
              </span>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenRepoSwitcher}
            className="w-full h-8.5 px-2.5 bg-base-1/50 border border-dashed border-border hover:border-border-strong hover:bg-base-2/60 rounded-sm flex items-center justify-between gap-2 cursor-pointer transition group outline-none text-left"
          >
            <div className="flex items-center gap-2 text-xs text-text-muted min-w-0">
              <FolderGit2 className="w-3.5 h-3.5 text-text-faint group-hover:text-commito-coral transition-colors shrink-0" />
              <span className="font-medium truncate group-hover:text-text-primary transition-colors">
                Select Repo...
              </span>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-text-faint group-hover:text-muted transition-colors shrink-0" />
          </button>
        )}

        {/* Bottom Row: Full-width Changes / History Tabs */}
        <div className="h-7.5">
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
            size="sm"
            className="h-full"
            ariaLabel="Repository change views"
          />
        </div>
      </div>

      {/* Slide-over Drawer from the left */}
      <RepoDrawer isOpen={isRepoDrawerOpen} onClose={() => setIsRepoDrawerOpen(false)} />
    </>
  );
};
