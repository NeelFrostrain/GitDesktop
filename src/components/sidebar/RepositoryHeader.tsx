import React, { useRef, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { RepoDropdown } from '../RepoDropdown';

export const RepositoryHeader: React.FC = () => {
  const { activeRepoPath, status, branches } = useGitStore();
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const [repoCardRect, setRepoCardRect] = useState<DOMRect | null>(null);
  const repoCardRef = useRef<HTMLDivElement>(null);

  const activeRepoName = activeRepoPath
    ? activeRepoPath.split(/[/\\]/).pop() || 'NicolasN_BunnyMP'
    : 'NicolasN_BunnyMP';

  const handleOpenRepoSwitcher = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (repoCardRef.current) {
      setRepoCardRect(repoCardRef.current.getBoundingClientRect());
    }
    setIsRepoDropdownOpen(!isRepoDropdownOpen);
  };

  return (
    <>
      <div className="p-3 border-b border-border">
        <div
          ref={repoCardRef}
          onClick={handleOpenRepoSwitcher}
          className="p-2.5 bg-commito-card border border-border hover:border-border-strong rounded-md flex items-center justify-between cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-md bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-text-primary truncate">{activeRepoName}</h3>
              <p className="text-[10px] text-text-muted font-mono truncate">
                {status?.current_branch || 'main'} • {branches.length || 1} branch
                {branches.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-text-muted flex-shrink-0" />
        </div>
      </div>

      <RepoDropdown
        isOpen={isRepoDropdownOpen}
        onClose={() => setIsRepoDropdownOpen(false)}
        triggerRect={repoCardRect}
      />
    </>
  );
};
