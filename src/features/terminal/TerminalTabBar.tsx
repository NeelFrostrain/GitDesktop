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
  Play,
  Pause,
  FolderGit2,
} from 'lucide-react';
import { useTerminalStore } from './store/terminalStore';
import { useGitStore } from '../../store/useGitStore';
import { listen } from '@tauri-apps/api/event';
import type { MinGitProgress } from '../git-runtime/useGitRuntime';
import { Tabs } from '../../components/common/Tabs';

export interface TerminalTabBarProps {
  repoName: string;
  branchName?: string;
  isAlive: boolean;
  activeTab: 'shell' | 'app_log';
  onTabChange: (tab: 'shell' | 'app_log') => void;
  onClear: () => void;
  onRestart: () => void;
  onSearch: (query: string) => void;
  autoScroll?: boolean;
  onToggleAutoScroll?: () => void;
  logCount?: number;
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
  autoScroll,
  onToggleAutoScroll,
  logCount,
}) => {
  const {
    toggleIsOpen,
    openLogViewer,
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
      if (event.payload.status === 'completed' || event.payload.status === 'error') {
        setTimeout(() => setGitProgress(null), 4000);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
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
      {/* Left: Tabs + Repo & Branch info */}
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Sleek Segmented Switcher */}
        <Tabs<'shell' | 'app_log'>
          tabs={[
            {
              id: 'shell',
              label: 'Shell',
              icon: <Terminal className="w-3 h-3 text-commito-coral flex-shrink-0" />,
            },
            {
              id: 'app_log',
              label: 'App Log',
              icon: <History className="w-3 h-3 text-gitlab-teal flex-shrink-0" />,
              badge: logCount !== undefined && logCount > 0 ? logCount : undefined,
              badgeVariant: 'neutral',
            },
          ]}
          activeTab={activeTab}
          onChange={onTabChange}
          size="sm"
          ariaLabel="Terminal panel tabs"
        />


        {/* Repo Name Chip */}
        {repoName && (
          <div className="h-6.5 px-2 flex items-center gap-1.5 bg-base-0/80 border border-border rounded-sm text-[11px] text-text-secondary font-medium truncate max-w-[140px] shadow-2xs">
            <FolderGit2 className="w-3 h-3 text-text-muted flex-shrink-0" />
            <span className="truncate">{repoName}</span>
          </div>
        )}

        {/* Branch badge */}
        {branchName && (
          <div className="h-6.5 px-2 flex items-center gap-1.5 bg-base-0/80 border border-border rounded-sm text-[11px] text-text-muted font-mono truncate max-w-[130px] shadow-2xs">
            <GitBranch className="w-3 h-3 text-commito-coral flex-shrink-0" />
            <span className="truncate">{branchName}</span>
          </div>
        )}

        {/* Process status indicator for Shell */}
        {activeTab === 'shell' && (
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 mx-0.5 ${
              isAlive ? 'bg-git-added shadow-[0_0_6px_var(--git-added)]' : 'bg-text-disabled'
            }`}
            title={isAlive ? 'Process running' : 'Process stopped'}
          />
        )}

        {/* MinGit silent download progress pill */}
        {gitProgress && (
          <div
            className={`h-6.5 flex items-center gap-1.5 px-2 rounded-sm text-[10px] font-medium border shadow-2xs transition-all duration-300 ${
              gitProgress.status === 'completed'
                ? 'bg-git-added-bg border-git-added/30 text-git-added'
                : gitProgress.status === 'error'
                ? 'bg-git-removed-bg border-git-removed/30 text-git-removed'
                : 'bg-commito-coral/10 border-commito-coral/30 text-commito-coral'
            }`}
          >
            {gitProgress.status === 'completed' ? (
              <CheckCircle className="w-3 h-3 flex-shrink-0" />
            ) : (
              <Download className="w-3 h-3 flex-shrink-0 animate-bounce" />
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
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* App Log Mode: Auto-scroll toggle pill */}
        {activeTab === 'app_log' && onToggleAutoScroll && (
          <button
            type="button"
            onClick={onToggleAutoScroll}
            className={`h-6.5 px-2 rounded-sm border text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              autoScroll
                ? 'bg-base-0 text-gitlab-teal border-border font-semibold'
                : 'bg-base-0/80 text-text-muted hover:text-text-primary hover:bg-base-2 border border-border'
            }`}
            title={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
          >
            {autoScroll ? (
              <Pause className="w-3 h-3 text-gitlab-teal" />
            ) : (
              <Play className="w-3 h-3 text-text-muted" />
            )}
            <span>{autoScroll ? 'Auto-scroll' : 'Paused'}</span>
          </button>
        )}

        {/* Search input / toggle */}
        {isSearchOpen ? (
          <div className="h-6.5 flex items-center gap-1.5 bg-base-0 border border-border rounded-sm px-2 animate-in fade-in duration-100 shadow-2xs">
            <Search className="w-3 h-3 text-text-muted flex-shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder={activeTab === 'shell' ? 'Find in terminal...' : 'Filter logs...'}
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
              className="text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="h-6.5 px-2 text-text-muted hover:text-text-primary bg-base-0/80 hover:bg-base-2 rounded-sm border border-border transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Search (Ctrl+F)"
          >
            <Search className="w-3 h-3" />
            <span className="text-[11px] hidden sm:inline">Find</span>
          </button>
        )}

        {/* Restart / Kill (Shell only) */}
        {activeTab === 'shell' && (
          <button
            type="button"
            onClick={onRestart}
            className="h-6.5 w-6.5 text-text-muted hover:text-text-primary bg-base-0/80 hover:bg-base-2 rounded-sm border border-border transition cursor-pointer flex items-center justify-center shadow-2xs"
            title="Restart shell process"
          >
            <RotateCcw className="w-3 h-3 text-git-modified" />
          </button>
        )}

        {/* Open Full Logs Modal Button */}
        <button
          type="button"
          onClick={() => {
            const repoPath = useGitStore.getState().activeRepoPath || 'global';
            openLogViewer(repoPath);
          }}
          className="h-6.5 px-2 text-text-muted hover:text-text-primary bg-base-0/80 hover:bg-base-2 rounded-sm border border-border transition cursor-pointer flex items-center gap-1.5 shadow-2xs text-[11px]"
          title="Open full log history viewer"
        >
          <History className="w-3 h-3 text-gitlab-teal flex-shrink-0" />
          <span>Logs</span>
        </button>

        {/* Clear Buffer */}
        <button
          type="button"
          onClick={onClear}
          className="h-6.5 w-6.5 text-text-muted hover:text-git-removed bg-base-0/80 hover:bg-base-2 rounded-sm border border-border transition cursor-pointer flex items-center justify-center shadow-2xs"
          title="Clear output"
        >
          <Trash2 className="w-3 h-3" />
        </button>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Collapse / Close */}
        <button
          type="button"
          onClick={toggleIsOpen}
          className="h-6.5 w-6.5 text-text-muted hover:text-text-primary bg-base-0/80 hover:bg-base-2 rounded-sm border border-border transition cursor-pointer flex items-center justify-center shadow-2xs"
          title="Collapse terminal"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
