import React from 'react';
import {
  Terminal,
  History,
  Trash2,
  RotateCcw,
  Search,
  ChevronDown,
  X,
  GitBranch,
} from 'lucide-react';
import { useTerminalStore } from './store/terminalStore';

interface TerminalTabBarProps {
  repoName: string;
  branchName?: string;
  isAlive: boolean;
  onClear: () => void;
  onRestart: () => void;
  onSearch: (query: string) => void;
}

export const TerminalTabBar: React.FC<TerminalTabBarProps> = ({
  repoName,
  branchName,
  isAlive,
  onClear,
  onRestart,
  onSearch,
}) => {
  const {
    toggleIsOpen,
    openLogViewer,
    activeLogRepoId,
    searchQuery,
    setSearchQuery,
    isSearchOpen,
    setIsSearchOpen,
  } = useTerminalStore();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    onSearch(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch(searchQuery);
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setSearchQuery('');
      onSearch('');
    }
  };

  return (
    <div className="h-8 bg-base-1 border-b border-border px-3 flex items-center justify-between flex-shrink-0 select-none text-xs">
      {/* Left: Terminal indicator + Repo/Branch info */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1.5 text-text-primary font-medium">
          <Terminal className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
          <span className="truncate max-w-[120px] font-semibold">{repoName}</span>
        </div>

        {branchName && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-base-2 text-text-muted text-[10px] font-mono border border-border/70 max-w-[160px] truncate">
            <GitBranch className="w-2.5 h-2.5 text-commito-coral flex-shrink-0" />
            <span className="truncate">{branchName}</span>
          </div>
        )}

        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            isAlive ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-gray-500'
          }`}
          title={isAlive ? 'Process running' : 'Process stopped'}
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Search toggle */}
        {isSearchOpen ? (
          <div className="flex items-center gap-1 bg-base-2 border border-border rounded px-1.5 py-0.5 animate-in fade-in duration-100">
            <Search className="w-3 h-3 text-text-muted" />
            <input
              type="text"
              autoFocus
              placeholder="Find in terminal..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              className="bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none w-32 font-mono"
            />
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
                onSearch('');
              }}
              className="text-text-muted hover:text-text-primary"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded border border-transparent hover:border-border transition cursor-pointer"
            title="Search terminal scrollback (Ctrl+F)"
          >
            <Search className="w-3 h-3" />
          </button>
        )}

        {/* View Logs */}
        <button
          type="button"
          onClick={() => {
            if (activeLogRepoId) {
              openLogViewer(activeLogRepoId);
            }
          }}
          className="flex items-center gap-1 px-1.5 py-0.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded border border-transparent hover:border-border transition cursor-pointer text-[11px]"
          title="Browse saved past session transcripts"
        >
          <History className="w-3 h-3 text-gitlab-teal" />
          <span>View Logs</span>
        </button>

        {/* Clear */}
        <button
          type="button"
          onClick={onClear}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded border border-transparent hover:border-border transition cursor-pointer"
          title="Clear terminal buffer"
        >
          <Trash2 className="w-3 h-3" />
        </button>

        {/* Restart / Kill */}
        <button
          type="button"
          onClick={onRestart}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded border border-transparent hover:border-border transition cursor-pointer"
          title="Restart shell process"
        >
          <RotateCcw className="w-3 h-3 text-amber-400" />
        </button>

        <div className="h-3 w-px bg-border mx-1" />

        {/* Collapse / Close */}
        <button
          type="button"
          onClick={toggleIsOpen}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded border border-transparent hover:border-border transition cursor-pointer"
          title="Collapse terminal (Ctrl+`)"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
