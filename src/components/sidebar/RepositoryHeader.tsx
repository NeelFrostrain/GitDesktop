import React, { useRef, useState } from 'react';
import { ChevronsUpDown, FolderGit2 } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { RepoDropdown } from '../layout/RepoDropdown';

export const RepositoryHeader: React.FC = () => {
  const { activeRepoPath, status, branches } = useGitStore();
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const [repoCardRect, setRepoCardRect] = useState<DOMRect | null>(null);
  const repoCardRef = useRef<HTMLDivElement>(null);

  const activeRepoName = activeRepoPath
    ? activeRepoPath.split(/[/\\]/).pop() || 'Repository'
    : 'No Repository';

  const handleOpenRepoSwitcher = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (repoCardRef.current) {
      setRepoCardRect(repoCardRef.current.getBoundingClientRect());
    }
    setIsRepoDropdownOpen(!isRepoDropdownOpen);
  };

  return (
    <>
      <div className="px-2.5 py-2 border-b border-border bg-base-0 select-none">
        {/* Active Repo Card Switcher */}
        {activeRepoPath ? (
          <div
            ref={repoCardRef}
            onClick={handleOpenRepoSwitcher}
            className="p-2 rounded-sm border bg-base-1 border-border hover:border-border-strong hover:bg-base-2 flex items-center justify-between cursor-pointer transition-all duration-150 shadow-xs group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6.5 h-6.5 rounded-sm bg-commito-coral/10 border border-commito-coral/25 text-commito-coral flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <FolderGit2 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-text-primary truncate leading-tight group-hover:text-commito-coral transition-colors">
                  {activeRepoName}
                </h3>
                <p className="text-[10px] text-text-muted font-mono truncate mt-0.5 leading-none">
                  {status?.current_branch || 'main'} <span className="text-text-faint">•</span> {branches.length || 1} branch{branches.length !== 1 ? 'es' : ''}
                </p>
              </div>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors flex-shrink-0" />
          </div>
        ) : (
          <div
            ref={repoCardRef}
            onClick={handleOpenRepoSwitcher}
            className="p-2 bg-base-1 border border-dashed border-border hover:border-commito-coral/50 hover:bg-base-2 rounded-sm flex items-center justify-between cursor-pointer transition-all duration-150"
          >
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <FolderGit2 className="w-3.5 h-3.5 text-text-faint" />
              <span>Select Repository...</span>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          </div>
        )}
      </div>

      <RepoDropdown
        isOpen={isRepoDropdownOpen}
        onClose={() => setIsRepoDropdownOpen(false)}
        triggerRect={repoCardRect}
      />
    </>
  );
};
