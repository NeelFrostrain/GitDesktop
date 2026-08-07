import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  FolderGit2, 
  GitPullRequest, 
  Code2, 
  Plus,
  FolderOpen,
  PanelLeftClose,
  Clock,
  CheckSquare as CheckSquareIcon,
  Square,
  FilePlus,
  FileX,
  FileDiff,
  AlertTriangle,
  GitCommit,
  User,
  Filter
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
    user,
  } = useGitStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);
  const [fileFilter, setFileFilter] = useState('');

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('gitlab_sidebar_width');
    return saved ? parseInt(saved, 10) : 280;
  });
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(500, moveEvent.clientX));
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

    const filteredFileList = (status?.files || []).filter((f) => {
      if (!fileFilter.trim()) return true;
      return f.path.toLowerCase().includes(fileFilter.toLowerCase().trim());
    });

    return (
      <aside
        style={{ width: sidebarWidth }}
        className="bg-base-0 border-r border-border flex flex-col h-full select-none text-[13px] z-20 relative flex-shrink-0"
      >
        {/* GitHub Desktop Style Top Navigation Tabs */}
        <div className="flex border-b border-border bg-base-1">
          <button
            onClick={() => setActiveTab('changes')}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'changes'
                ? 'border-gitlab-orange text-text-primary bg-base-0'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <span>Changes</span>
            {allFilesCount > 0 && (
              <span className="px-1.5 py-0.2 bg-base-3 text-text-secondary rounded-full text-[10px] font-mono">
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
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'history'
                ? 'border-gitlab-orange text-text-primary bg-base-0'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <span>History</span>
          </button>
        </div>

        {/* Changes View */}
        {activeTab === 'changes' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter Search Input (GitHub Desktop style) */}
            <div className="p-2 border-b border-border bg-base-1 space-y-1.5">
              <div className="relative">
                <Filter className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter"
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-base-0 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-gitlab-orange"
                />
              </div>

              {/* Select All Checkbox Header */}
              <div className="px-1 pt-1 flex items-center justify-between text-xs text-text-muted">
                <button
                  onClick={() => setAllStaged(!isAllStaged)}
                  className="flex items-center gap-2 hover:text-white font-medium"
                >
                  {isAllStaged ? (
                    <CheckSquareIcon className="w-4 h-4 text-gitlab-teal" />
                  ) : (
                    <Square className="w-4 h-4 text-text-muted" />
                  )}
                  <span>{stagedFiles.length} changed files</span>
                </button>
              </div>
            </div>

            {/* Changed Files List */}
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {filteredFileList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs p-4 text-center">
                  <GitCommit className="w-8 h-8 mb-2 opacity-30 text-gitlab-orange" />
                  No changed files matching filter.
                </div>
              ) : (
                filteredFileList.map((file) => {
                  const isSelected = selectedFile === file.path;
                  const isStaged = stagedFiles.includes(file.path);
                  const isLfs = file.path.endsWith('.uasset') || file.path.endsWith('.png') || file.path.endsWith('.jpg') || file.path.endsWith('.exe') || file.path.endsWith('.bin');

                  return (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFile(file.path)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer group transition ${
                        isSelected
                          ? 'bg-base-3 border border-border-strong text-text-primary font-semibold'
                          : 'hover:bg-base-2 text-text-secondary'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStageFile(file.path);
                        }}
                        className="text-text-muted hover:text-white flex-shrink-0"
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
                      {isLfs && (
                        <div className="w-2.5 h-2.5 border border-amber-400 bg-amber-400/20 rounded-xs flex-shrink-0" title="Binary / LFS File" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* GitHub Desktop Commit Box at Bottom */}
            <div className="p-3 border-t border-border bg-base-1 space-y-2 flex-shrink-0">
              {/* Row 1: User Avatar & Summary Input */}
              <div className="flex items-center gap-2">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="User Avatar" className="w-7 h-7 rounded-full border border-border flex-shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gitlab-orange/20 border border-gitlab-orange flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-gitlab-orange" />
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Summary (required)"
                  value={commitSummary}
                  onChange={(e) => setCommitSummary(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-base-0 border border-border rounded text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-gitlab-orange font-sans"
                />
              </div>

              {/* Row 2: Description Textarea */}
              <textarea
                placeholder="Description"
                rows={2}
                value={commitDescription}
                onChange={(e) => setCommitDescription(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-base-0 border border-border rounded text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-gitlab-orange resize-none font-sans"
              />

              {/* Row 3: Full-width Commit Button */}
              <button
                onClick={handleCommit}
                disabled={!canCommit}
                className={`w-full py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm ${
                  canCommit
                    ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                    : 'bg-base-2 text-text-muted cursor-not-allowed border border-border'
                }`}
              >
                Commit {stagedFiles.length > 0 ? `${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''}` : ''} to {status?.current_branch || 'main'}
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
