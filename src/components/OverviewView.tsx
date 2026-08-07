import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { GitBranch, FolderOpen, ExternalLink, Code2, CheckCircle2 } from 'lucide-react';
import { useGitStore } from '../store/useGitStore';

export const OverviewView: React.FC = () => {
  const { activeRepoPath, status, user, setCurrentNavView, setIsRepoModalOpen, setActiveModalTab } = useGitStore();
  const activeRepoName = activeRepoPath ? activeRepoPath.split(/[/\\]/).pop() || 'NicolasN_BunnyMP' : 'NicolasN_BunnyMP';

  const handleOpenFolder = async () => {
    if (activeRepoPath) {
      try {
        await openUrl(activeRepoPath);
      } catch {
        invoke('select_folder_cmd').catch(() => {});
      }
    }
  };

  return (
    <div className="flex-1 h-full bg-base-1 overflow-y-auto p-6 select-none space-y-6">
      {/* Top Banner: Repo Info */}
      <div className="p-5 bg-base-2 border border-border rounded-md flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-md bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 flex items-center justify-center font-bold text-lg shadow-inner">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11l7-7 7 7M5 19l7-7 7 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-text-primary">{activeRepoName}</h2>
            <p className="text-xs text-text-muted font-mono">{activeRepoPath || 'e:/Projects/gitlab-desktop'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenFolder}
            className="px-3.5 py-1.5 bg-base-3 hover:bg-base-0 border border-border rounded-md text-xs font-semibold text-text-primary flex items-center gap-1.5 transition cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-gitlab-teal" />
            <span>Open in Explorer</span>
          </button>

          <button
            onClick={() => {
              setActiveModalTab('repos');
              setIsRepoModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralHover text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Repository Options</span>
          </button>
        </div>
      </div>

      {/* Grid Quick Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Card 1: Branch Status */}
        <div className="p-4 bg-base-2 border border-border rounded-md space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium">
            <span>Current Branch</span>
            <GitBranch className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-text-primary font-mono truncate">
            {status?.current_branch || 'main'}
          </div>
          <div className="text-[11px] text-text-muted flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Up to date with origin/main</span>
          </div>
        </div>

        {/* Card 2: Changes Status */}
        <div
          onClick={() => setCurrentNavView('changes')}
          className="p-4 bg-base-2 border border-border rounded-md space-y-2 cursor-pointer hover:border-border-strong transition"
        >
          <div className="flex items-center justify-between text-xs text-text-muted font-medium">
            <span>Working Copy Status</span>
            <Code2 className="w-4 h-4 text-commito-coral" />
          </div>
          <div className="text-base font-bold text-text-primary">
            {status?.files?.length || 0} modified file{status?.files?.length === 1 ? '' : 's'}
          </div>
          <div className="text-[11px] text-commito-activeText font-semibold">
            Click to view uncommitted changes →
          </div>
        </div>

        {/* Card 3: User Profile */}
        <div className="p-4 bg-base-2 border border-border rounded-md space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium">
            <span>Active Account</span>
            <span className="px-1.5 py-0.2 bg-white/10 text-white rounded text-[9px] font-mono font-bold uppercase">
              {user?.provider || 'GitLab'}
            </span>
          </div>
          <div className="text-base font-bold text-text-primary truncate">
            {user ? user.name : 'Jane Dev'}
          </div>
          <div className="text-[11px] text-text-muted font-mono truncate">
            @{user ? user.username : 'janedev'}
          </div>
        </div>
      </div>
    </div>
  );
};
