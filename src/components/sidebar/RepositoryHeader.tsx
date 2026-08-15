import React, { useRef, useState } from 'react';
import { ChevronsUpDown, Home, FolderGit2 } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { RepoDropdown } from '../RepoDropdown';

export const RepositoryHeader: React.FC = () => {
  const { activeRepoPath, status, branches, currentNavView, setCurrentNavView } = useGitStore();
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

  const isHomeActive = currentNavView === 'home';

  return (
    <>
      <div className="p-2.5 border-b border-border space-y-2 select-none">
        {/* Top: Home Dashboard Navigation Button */}
        <button
          onClick={() => setCurrentNavView('home')}
          className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer ${
            isHomeActive
              ? 'bg-commito-coral text-white shadow-sm'
              : 'bg-base-2/60 hover:bg-base-2 text-text-secondary hover:text-text-primary border border-border/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </div>
          {isHomeActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          )}
        </button>

        {/* Bottom: Active Repo Card Switcher */}
        {activeRepoPath ? (
          <div
            ref={repoCardRef}
            onClick={handleOpenRepoSwitcher}
            className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition shadow-xs ${
              !isHomeActive
                ? 'bg-commito-card border-commito-coral/40 shadow-xs'
                : 'bg-base-2/40 border-border hover:border-border-strong hover:bg-base-2'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-md bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <FolderGit2 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-text-primary truncate">{activeRepoName}</h3>
                <p className="text-[10px] text-text-muted font-mono truncate">
                  {status?.current_branch || 'main'} • {branches.length || 1} branch{branches.length !== 1 ? 'es' : ''}
                </p>
              </div>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          </div>
        ) : (
          <div
            ref={repoCardRef}
            onClick={handleOpenRepoSwitcher}
            className="p-2 bg-base-2/40 border border-dashed border-border hover:border-commito-coral/50 rounded-lg flex items-center justify-between cursor-pointer transition"
          >
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <FolderGit2 className="w-3.5 h-3.5" />
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
