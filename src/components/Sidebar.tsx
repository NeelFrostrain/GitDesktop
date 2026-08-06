import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  FolderGit2, 
  GitPullRequest, 
  Code2, 
  Plus,
  FolderOpen,
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
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { FileStatus, CommitInfo, RepoStatus } from '../types/git';

export const Sidebar: React.FC = () => {
  const {
    currentNavView,
    setCurrentNavView,
    activeRepoPath,
    setActiveRepoPath,
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
    setActiveModalTab,
    setError,
  } = useGitStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('gitlab_sidebar_width');
    return saved ? parseInt(saved, 10) : 260;
  });
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(160, Math.min(500, moveEvent.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem('gitlab_sidebar_width', newWidth.toString());
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleOpenLocalFolder = async () => {
    try {
      const selected = await invoke<string | null>('select_folder_cmd');
      if (selected) {
        setActiveRepoPath(selected);
        setCurrentNavView('workspace');
        const res = await invoke<RepoStatus>('get_repo_status', { repoPath: selected });
        setStatus(res);
      }
    } catch (err: any) {
      setError({ code: err.code || 'FILESYSTEM_ERROR', message: err.message || String(err) });
    }
  };

  // If in local git workspace mode (a project is active and currentNavView === 'workspace'), render Changes/History git sidebar
  if (currentNavView === 'workspace' && activeRepoPath) {
    const handleCommit = async () => {
      if (!activeRepoPath || !commitSummary.trim()) return;
      setIsCommitting(true);
      const summaryText = commitSummary.trim();
      const count = stagedFiles.length;
      useLogStore.getState().addLog('info', 'Git', `Creating commit '${summaryText}' with ${count} file(s)...`);
      try {
        await invoke('stage_files', { repoPath: activeRepoPath, files: stagedFiles });
        await invoke('commit_changes', {
          repoPath: activeRepoPath,
          summary: summaryText,
          description: commitDescription || null,
        });
        setCommitSummary('');
        setCommitDescription('');
        const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
        setStatus(newStatus);
        useLogStore.getState().addLog('success', 'Git', `Successfully created commit: '${summaryText}'`);
      } catch (err: any) {
        const msg = err.message || String(err);
        setError({ code: err.code || 'GIT_ERROR', message: msg });
        useLogStore.getState().addLog('error', 'Git', `Commit failed: ${msg}`, msg);
      } finally {
        setIsCommitting(false);
      }
    };

    const getStatusIcon = (file: FileStatus) => {
      switch (file.status) {
        case 'Untracked':
          return <span title="Untracked"><FilePlus className="w-3.5 h-3.5 text-gitlab-teal" /></span>;
        case 'Deleted':
          return <span title="Deleted"><FileX className="w-3.5 h-3.5 text-red-400" /></span>;
        case 'Conflicted':
          return <span title="Conflicted"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /></span>;
        case 'Staged':
        case 'Modified':
        default:
          return <span title="Modified"><FileDiff className="w-3.5 h-3.5 text-blue-400" /></span>;
      }
    };

    const allFilesCount = status?.files.length || 0;
    const isAllStaged = allFilesCount > 0 && stagedFiles.length === allFilesCount;
    const canCommit = Boolean(commitSummary.trim() && stagedFiles.length > 0 && !isCommitting);

    return (
      <aside
        style={{ width: sidebarWidth }}
        className="bg-base-0 border-r border-border flex flex-col h-full select-none text-[13px] z-20 relative flex-shrink-0"
      >
        {/* Top Header */}
        <div className="p-3 border-b border-border flex items-center justify-between">
          <button
            onClick={() => setCurrentNavView('home')}
            className="text-[11px] text-text-muted hover:text-text-primary flex items-center gap-1 font-medium"
          >
            ← Repository Overview
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
                  <CheckSquareIcon className="w-4 h-4 text-gitlab-teal" />
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
                          <CheckSquareIcon className="w-4 h-4 text-gitlab-teal" />
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
            <div className="p-3 border-t border-border bg-base-1 space-y-2 flex-shrink-0">
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

        {/* Resizable Drag Border Handle */}
        <div
          onMouseDown={startResizing}
          className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gitlab-orange/80 transition-colors z-30 ${
            isResizing ? 'bg-gitlab-orange w-1.5' : 'bg-transparent'
          }`}
          title="Drag to resize sidebar width"
        />
      </aside>
    );
  }

  return (
    <aside
      style={{ width: isCollapsed ? 56 : Math.min(sidebarWidth, 320) }}
      className="bg-base-0 border-r border-border flex flex-col h-full select-none text-[13px] z-20 relative flex-shrink-0"
    >
      {/* Top GitLab Logo Mark */}
      <div className="h-12 px-4 flex items-center gap-2 border-b border-transparent">
        <svg className="w-6 h-6 text-gitlab-orange flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 5.5 2a.43.43 0 0 1 .4.28l2.25 6.94h7.7l2.25-6.94a.43.43 0 0 1 .4-.28.42.42 0 0 1 .79.16l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.94z" />
        </svg>
      </div>

      {/* Section Header */}
      {!isCollapsed && (
        <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold text-text-faint uppercase tracking-wider">
          Repository Options
        </div>
      )}

      {/* Nav List - Repository Management Only */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {/* Local Git Workspace */}
        <button
          onClick={() => setCurrentNavView('workspace')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors duration-150 ${
            currentNavView === 'workspace'
              ? 'bg-base-3 text-text-primary font-medium border border-border-strong'
              : 'text-text-muted hover:bg-base-2 hover:text-text-primary'
          }`}
          title={isCollapsed ? "Git Workspace" : undefined}
        >
          <Code2 className={`w-4 h-4 flex-shrink-0 ${currentNavView === 'workspace' ? 'text-gitlab-orange' : ''}`} />
          {!isCollapsed && <span className="truncate">Git Workspace</span>}
        </button>

        {/* Add Existing Local Repository */}
        <button
          onClick={handleOpenLocalFolder}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-text-muted hover:bg-base-2 hover:text-text-primary transition-colors duration-150"
          title={isCollapsed ? "Add Local Repo" : undefined}
        >
          <FolderOpen className="w-4 h-4 flex-shrink-0 text-gitlab-teal" />
          {!isCollapsed && <span className="truncate">Add Local Repo...</span>}
        </button>

        {/* Clone Repository from GitLab */}
        <button
          onClick={() => {
            setActiveModalTab('repos');
            setIsRepoModalOpen(true);
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-text-muted hover:bg-base-2 hover:text-text-primary transition-colors duration-150"
          title={isCollapsed ? "Clone Repository" : undefined}
        >
          <Plus className="w-4 h-4 flex-shrink-0 text-gitlab-orange" />
          {!isCollapsed && <span className="truncate">Clone Repository...</span>}
        </button>

        {/* Projects List */}
        <button
          onClick={() => {
            setActiveModalTab('repos');
            setIsRepoModalOpen(true);
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-text-muted hover:bg-base-2 hover:text-text-primary transition-colors duration-150"
          title={isCollapsed ? "GitLab Projects" : undefined}
        >
          <FolderGit2 className="w-4 h-4 flex-shrink-0 text-blue-400" />
          {!isCollapsed && <span className="truncate">GitLab Projects</span>}
        </button>

        {/* Merge Requests */}
        <button
          onClick={() => setCurrentNavView('merge-requests')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors duration-150 ${
            currentNavView === 'merge-requests'
              ? 'bg-base-3 text-text-primary font-medium border border-border-strong'
              : 'text-text-muted hover:bg-base-2 hover:text-text-primary'
          }`}
          title={isCollapsed ? "Merge Requests" : undefined}
        >
          <GitPullRequest className="w-4 h-4 flex-shrink-0 text-purple-400" />
          {!isCollapsed && <span className="truncate">Merge Requests</span>}
        </button>
      </div>

      {/* Bottom Rail Action: Collapse Sidebar */}
      <div className="p-2 border-t border-border">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-text-muted hover:bg-base-2 hover:text-text-primary transition-colors"
        >
          <PanelLeftClose className={`w-4 h-4 flex-shrink-0 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          {!isCollapsed && <span>Collapse sidebar</span>}
        </button>
      </div>

      {/* Resizable Drag Border Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={startResizing}
          className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gitlab-orange/80 transition-colors z-30 ${
            isResizing ? 'bg-gitlab-orange w-1.5' : 'bg-transparent'
          }`}
          title="Drag to resize sidebar width"
        />
      )}
    </aside>
  );
};
