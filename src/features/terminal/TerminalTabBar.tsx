import React, { useState, useEffect } from 'react';
import {
  Terminal,
  History,
  Trash2,
  RotateCcw,
  Search,
  ChevronDown,
  X,
  GitBranch,
  Download,
  CheckCircle,
} from 'lucide-react';
import { useTerminalStore } from './store/terminalStore';
import { listen } from '@tauri-apps/api/event';
import type { MinGitProgress } from '../git-runtime/useGitRuntime';

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

  const [gitProgress, setGitProgress] = useState<MinGitProgress | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<MinGitProgress>('mingit:download:progress', (event) => {
      setGitProgress(event.payload);
      // Auto-clear the pill 4 seconds after completion or error
      if (event.payload.status === 'completed' || event.payload.status === 'error') {
        setTimeout(() => setGitProgress(null), 4000);
      }
    }).then((fn) => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  }, []);

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

        {/* MinGit silent download progress pill */}
        {gitProgress && (
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all duration-300 ${
            gitProgress.status === 'completed'
              ? 'bg-git-added-bg border-git-added/30 text-git-added'
              : gitProgress.status === 'error'
              ? 'bg-git-removed-bg border-git-removed/30 text-git-removed'
              : 'bg-commito-coral/10 border-commito-coral/30 text-commito-coral'
          }`}>
            {gitProgress.status === 'completed' ? (
              <CheckCircle className="w-2.5 h-2.5 flex-shrink-0" />
            ) : (
              <Download className="w-2.5 h-2.5 flex-shrink-0 animate-bounce" />
            )}
            <span>
              {gitProgress.status === 'completed'
                ? 'Git ready'
                : gitProgress.status === 'error'
                ? 'Git install failed'
                : gitProgress.status === 'extracting'
                ? 'Installing git...'
                : `Git ${gitProgress.percentage.toFixed(0)}%`}
            </span>
            {(gitProgress.status === 'downloading' || gitProgress.status === 'extracting') && (
              <div className="w-12 h-1 rounded-full bg-commito-coral/20 overflow-hidden">
                <div
                  className="h-full bg-commito-coral rounded-full transition-all duration-200"
                  style={{ width: `${gitProgress.percentage}%` }}
                />
              </div>
            )}
          </div>
        )}

        {branchName && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-base-2 text-text-muted text-[11px] font-mono border border-border max-w-[160px] truncate">
            <GitBranch className="w-2.5 h-2.5 text-commito-coral flex-shrink-0" />
            <span className="truncate">{branchName}</span>
          </div>
        )}

        {activeTab === 'shell' && (
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              isAlive ? 'bg-git-added shadow-[0_0_6px_var(--git-added)]' : 'bg-text-disabled'
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
            <RotateCcw className="w-3.5 h-3.5 text-git-modified" />
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
