import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Home, 
  FolderGit2, 
  Users, 
  CheckSquare, 
  GitPullRequest, 
  ListCheck, 
  Flag, 
  Code2, 
  Activity, 
  Download, 
  Laptop, 
  Server, 
  Settings, 
  Shield, 
  Globe, 
  HelpCircle, 
  PanelLeftClose,
  FileText,
  Clock,
  CheckSquare as CheckSquareIcon,
  Square,
  FilePlus,
  FileX,
  FileDiff,
  AlertTriangle,
  GitCommit
} from 'lucide-react';
import { useGitStore, NavView } from '../store/useGitStore';
import { FileStatus, CommitInfo, RepoStatus } from '../types/git';

export const Sidebar: React.FC = () => {
  const {
    currentNavView,
    setCurrentNavView,
    activeRepoPath,
    status,
    setStatus,
    selectedFile,
    setSelectedFile,
    stagedFiles,
    toggleStageFile,
    setAllStaged,
    selectedCommitSha,
    setSelectedCommitSha,
    commitSummary,
    setCommitSummary,
    commitDescription,
    setCommitDescription,
    activeTab,
    setActiveTab,
    setIsRepoModalOpen,
    setError,
  } = useGitStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);

  // If in local git workspace mode (a project is active and currentNavView === 'workspace'), render Changes/History git sidebar
  if (currentNavView === 'workspace' && activeRepoPath) {
    const handleCommit = async () => {
      if (!activeRepoPath || !commitSummary.trim()) return;
      setIsCommitting(true);
      try {
        await invoke('stage_files', { repoPath: activeRepoPath, files: stagedFiles });
        await invoke('commit_changes', {
          repoPath: activeRepoPath,
          summary: commitSummary,
          description: commitDescription || null,
        });
        setCommitSummary('');
        setCommitDescription('');
        const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
        setStatus(newStatus);
      } catch (err: any) {
        setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) });
      } finally {
        setIsCommitting(false);
      }
    };

    const getStatusIcon = (file: FileStatus) => {
      switch (file.status) {
        case 'Untracked':
          return <span title="Untracked"><FilePlus className="w-3.5 h-3.5 text-gitlab-teal" /></span>;
        case 'Deleted':
          return <span title="Deleted"><FileX className="w-3.5 h-3.5 text-github-dark-danger" /></span>;
        case 'Conflicted':
          return <span title="Conflicted"><AlertTriangle className="w-3.5 h-3.5 text-github-dark-warning" /></span>;
        case 'Staged':
        case 'Modified':
        default:
          return <span title="Modified"><FileDiff className="w-3.5 h-3.5 text-github-dark-accent" /></span>;
      }
    };

    const allFilesCount = status?.files.length || 0;
    const isAllStaged = allFilesCount > 0 && stagedFiles.length === allFilesCount;
    const canCommit = Boolean(commitSummary.trim() && stagedFiles.length > 0 && !isCommitting);

    return (
      <aside className="w-[220px] bg-base-0 border-r border-border flex flex-col h-[calc(100vh-3rem)] select-none text-[13px]">
        {/* Top Header */}
        <div className="p-3 border-b border-border flex items-center justify-between">
          <button
            onClick={() => setCurrentNavView('home')}
            className="text-[11px] text-text-muted hover:text-text-primary flex items-center gap-1 font-medium"
          >
            ← Back to Home
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border bg-base-1">
          <button
            onClick={() => setActiveTab('changes')}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'changes'
                ? 'border-gitlab-orange text-text-primary bg-base-0'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Changes
            {allFilesCount > 0 && (
              <span className="px-1.5 py-0.2 bg-base-3 text-text-secondary rounded-full text-[10px]">
                {allFilesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              if (activeRepoPath) {
                invoke<CommitInfo[]>('get_commit_history', { repoPath: activeRepoPath, limit: 50, offset: 0 })
                  .then(setCommits)
                  .catch(() => {});
              }
            }}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'history'
                ? 'border-gitlab-orange text-text-primary bg-base-0'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            History
          </button>
        </div>

        {/* Changes View */}
        {activeTab === 'changes' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-3 py-2 bg-base-1 border-b border-border flex items-center justify-between text-xs text-text-muted">
              <button
                onClick={() => setAllStaged(!isAllStaged)}
                className="flex items-center gap-2 hover:text-white"
              >
                {isAllStaged ? (
                  <CheckSquareIcon className="w-4 h-4 text-github-dark-accent" />
                ) : (
                  <Square className="w-4 h-4 text-text-muted" />
                )}
                <span className="font-medium">{stagedFiles.length} of {allFilesCount} changed files</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {status?.files.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs p-4 text-center">
                  <GitCommit className="w-8 h-8 mb-2 opacity-30 text-gitlab-orange" />
                  No uncommitted changes in this repository.
                </div>
              ) : (
                status?.files.map((file) => {
                  const isSelected = selectedFile === file.path;
                  const isStaged = stagedFiles.includes(file.path);
                  return (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFile(file.path)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer group transition ${
                        isSelected
                          ? 'bg-base-3 border border-border-strong text-text-primary'
                          : 'hover:bg-base-2 text-text-secondary'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStageFile(file.path);
                        }}
                        className="text-text-muted hover:text-white"
                      >
                        {isStaged ? (
                          <CheckSquareIcon className="w-4 h-4 text-github-dark-accent" />
                        ) : (
                          <Square className="w-4 h-4 text-text-muted" />
                        )}
                      </button>
                      {getStatusIcon(file)}
                      <span className="truncate flex-1 font-mono text-[11px]">
                        {file.path}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Commit Box */}
            <div className="p-3 border-t border-border bg-base-1 space-y-2">
              <input
                type="text"
                placeholder="Commit summary (required)"
                value={commitSummary}
                onChange={(e) => setCommitSummary(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-base-0 border border-border rounded text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-gitlab-orange"
              />
              <textarea
                placeholder="Description (optional)"
                rows={2}
                value={commitDescription}
                onChange={(e) => setCommitDescription(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-base-0 border border-border rounded text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-gitlab-orange resize-none"
              />
              <button
                onClick={handleCommit}
                disabled={!canCommit}
                className={`w-full py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm ${
                  canCommit
                    ? 'bg-gitlab-teal hover:bg-teal-700 text-white'
                    : 'bg-base-3 text-text-faint cursor-not-allowed'
                }`}
              >
                <GitCommit className="w-3.5 h-3.5" />
                Commit to {status?.current_branch || 'main'}
              </button>
            </div>
          </div>
        )}

        {/* History View */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {commits.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs p-4 text-center">
                <Clock className="w-8 h-8 mb-2 opacity-30 text-gitlab-orange" />
                No commit history found.
              </div>
            ) : (
              commits.map((c) => {
                const isSelected = selectedCommitSha === c.sha;
                return (
                  <div
                    key={c.sha}
                    onClick={() => setSelectedCommitSha(c.sha)}
                    className={`p-2.5 rounded cursor-pointer transition border border-transparent ${
                      isSelected
                        ? 'bg-base-3 border-border-strong'
                        : 'hover:bg-base-2'
                    }`}
                  >
                    <div className="text-xs font-medium text-text-primary truncate mb-1">
                      {c.message}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span>{c.author_name}</span>
                      <span className="font-mono text-[10px] text-text-faint">{c.short_sha}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </aside>
    );
  }

  // Primary GitLab.com App Shell Left Rail Sidebar (180px fixed)
  const navItems: { id: NavView; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'work-items', label: 'Work items', icon: CheckSquare },
    { id: 'merge-requests', label: 'Merge requests', icon: GitPullRequest },
    { id: 'todos', label: 'To-Do List', icon: ListCheck },
    { id: 'workspace', label: 'Local Git Workspace', icon: Code2 },
  ];

  const secondaryNavItems = [
    { label: 'Milestones', icon: Flag },
    { label: 'Snippets', icon: Code2 },
    { label: 'Activity', icon: Activity },
    { label: 'Import history', icon: Download },
    { label: 'Workspaces', icon: Laptop },
    { label: 'Environments', icon: Server },
    { label: 'Operations', icon: Settings },
    { label: 'Security', icon: Shield },
    { label: 'Orbit', icon: Globe },
  ];

  const sidebarWidth = isCollapsed ? 'w-14' : 'w-[180px]';

  return (
    <aside className={`${sidebarWidth} bg-base-0 border-r border-border flex flex-col h-screen select-none transition-all duration-150 text-[13px] z-20`}>
      {/* Top GitLab Logo Mark */}
      <div className="h-12 px-4 flex items-center gap-2 border-b border-transparent">
        <svg className="w-6 h-6 text-gitlab-orange flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 5.5 2a.43.43 0 0 1 .4.28l2.25 6.94h7.7l2.25-6.94a.43.43 0 0 1 .4-.28.42.42 0 0 1 .79.16l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.94z" />
        </svg>
      </div>

      {/* Your Work Section Header */}
      {!isCollapsed && (
        <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-text-faint uppercase tracking-wider">
          Your work
        </div>
      )}

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentNavView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'projects') {
                  setIsRepoModalOpen(true);
                } else {
                  setCurrentNavView(item.id);
                }
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-normal transition-colors duration-150 ${
                isActive
                  ? 'bg-base-3 text-text-primary font-medium'
                  : 'text-text-muted hover:bg-base-2 hover:text-text-primary'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-gitlab-orange' : ''}`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}

        {!isCollapsed && (
          <div className="pt-2 space-y-0.5 border-t border-border/40 mt-2">
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => setIsRepoModalOpen(true)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-text-muted hover:bg-base-2 hover:text-text-primary transition-colors duration-150"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Rail Actions */}
      <div className="p-2 border-t border-border space-y-0.5">
        <button
          onClick={() => setIsRepoModalOpen(true)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-text-muted hover:bg-base-2 hover:text-text-primary transition-colors"
        >
          <HelpCircle className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span>Help</span>}
        </button>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-text-muted hover:bg-base-2 hover:text-text-primary transition-colors"
        >
          <PanelLeftClose className={`w-4 h-4 flex-shrink-0 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          {!isCollapsed && <span>Collapse sidebar</span>}
        </button>
      </div>
    </aside>
  );
};
