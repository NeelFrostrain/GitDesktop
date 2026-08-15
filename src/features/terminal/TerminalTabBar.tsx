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
  activeTab: 'shell' | 'app_log';
  onTabChange: (tab: 'shell' | 'app_log') => void;
  onClear: () => void;
  onRestart: () => void;
  onSearch: (query: string) => void;
}

export const TerminalTabBar: React.FC<TerminalTabBarProps> = ({
  repoName,
  branchName,
  isAlive,
  activeTab,
  onTabChange,
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
    <div className="h-9 bg-base-1 border-b border-border px-3 flex items-center justify-between flex-shrink-0 select-none text-xs">
      {/* Left: Tab switch (Shell / App Log) + Repo / Branch info */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center bg-base-2 rounded-md p-0.5 border border-border">
          <button
            type="button"
            onClick={() => onTabChange('shell')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'shell'
                ? 'bg-base-0 text-text-primary shadow-xs font-semibold border border-border/80'
                : 'text-text-muted hover:text-text-primary hover:bg-base-3/40'
            }`}
          >
            <Terminal className="w-3 h-3 text-commito-coral" />
            <span>Shell</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('app_log')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'app_log'
                ? 'bg-base-0 text-text-primary shadow-xs font-semibold border border-border/80'
                : 'text-text-muted hover:text-text-primary hover:bg-base-3/40'
            }`}
          >
            <History className="w-3 h-3 text-gitlab-teal" />
            <span>App Log</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-text-muted font-medium ml-0.5">
          <span className="truncate max-w-[140px] font-semibold text-text-primary text-xs">
            {repoName}
          </span>
        </div>

        {branchName && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-base-2 text-text-muted text-[11px] font-mono border border-border max-w-[160px] truncate">
            <GitBranch className="w-2.5 h-2.5 text-commito-coral flex-shrink-0" />
            <span className="truncate">{branchName}</span>
          </div>
        )}

        {activeTab === 'shell' && (
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              isAlive ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-gray-500'
            }`}
            title={isAlive ? 'Process running' : 'Process stopped'}
          />
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Search toggle */}
        {isSearchOpen ? (
          <div className="flex items-center gap-1 bg-base-2 border border-border rounded-md px-2 py-0.5 animate-in fade-in duration-100">
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
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded border border-transparent hover:border-border transition cursor-pointer"
            title="Search terminal (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}

        {/* View Logs Modal Button */}
        <button
          type="button"
          onClick={() => {
            if (activeLogRepoId) {
              openLogViewer(activeLogRepoId);
            }
          }}
          className="flex items-center gap-1.5 px-2 py-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded border border-transparent hover:border-border transition cursor-pointer text-[11px]"
          title="Browse persisted log history"
        >
          <History className="w-3.5 h-3.5 text-gitlab-teal" />
          <span>View Logs</span>
        </button>

        {/* Clear */}
        <button
          type="button"
          onClick={onClear}
          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded border border-transparent hover:border-border transition cursor-pointer"
          title="Clear buffer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Restart / Kill (Shell only) */}
        {activeTab === 'shell' && (
          <button
            type="button"
            onClick={onRestart}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded border border-transparent hover:border-border transition cursor-pointer"
            title="Restart shell process"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          </button>
        )}

        <div className="h-3 w-px bg-border mx-1" />

        {/* Collapse / Close */}
        <button
          type="button"
          onClick={toggleIsOpen}
          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded border border-transparent hover:border-border transition cursor-pointer"
          title="Collapse terminal"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
