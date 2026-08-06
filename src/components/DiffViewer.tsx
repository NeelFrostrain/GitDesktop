import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { 
  FileText, 
  Binary, 
  HardDrive, 
  GitPullRequest, 
  ExternalLink, 
  Columns, 
  AlignJustify,
  CheckCircle,
  Clock,
  User,
  GitCommit
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { DiffResult, CommitDetails } from '../types/git';

export const DiffViewer: React.FC = () => {
  const {
    activeRepoPath,
    selectedFile,
    selectedCommitSha,
    activeTab,
    diffViewMode,
    setDiffViewMode,
    status,
    user,
    setError,
  } = useGitStore();

  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [commitDetails, setCommitDetails] = useState<CommitDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch diff when selected file changes in Changes tab
  useEffect(() => {
    if (!activeRepoPath || !selectedFile || activeTab !== 'changes') {
      setDiff(null);
      return;
    }

    setIsLoading(true);
    const fileInStatus = status?.files.find((f) => f.path === selectedFile);
    const isStaged = fileInStatus ? fileInStatus.staged : false;

    invoke<DiffResult>('get_file_diff', {
      repoPath: activeRepoPath,
      filePath: selectedFile,
      staged: isStaged,
    })
      .then(setDiff)
      .catch((err) => setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) }))
      .finally(() => setIsLoading(false));
  }, [activeRepoPath, selectedFile, activeTab, status]);

  // Fetch commit details when selected commit changes in History tab
  useEffect(() => {
    if (!activeRepoPath || !selectedCommitSha || activeTab !== 'history') {
      setCommitDetails(null);
      return;
    }

    setIsLoading(true);
    invoke<CommitDetails>('get_commit_details', {
      repoPath: activeRepoPath,
      sha: selectedCommitSha,
    })
      .then(setCommitDetails)
      .catch((err) => setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) }))
      .finally(() => setIsLoading(false));
  }, [activeRepoPath, selectedCommitSha, activeTab]);

  const repoName = activeRepoPath
    ? activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || activeRepoPath
    : '';

  const handleOpenMergeRequest = async () => {
    if (!user || !status?.current_branch) return;
    const url = `${user.server_url}/${repoName}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${status.current_branch}`;
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleViewPipelines = async () => {
    if (!user) return;
    const url = `${user.server_url}/${repoName}/-/pipelines`;
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  const isCurrentBranchPushed = (status?.ahead || 0) === 0;

  // Render Diff for Changes Tab
  const renderChangesDiff = () => {
    if (!selectedFile) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm">
          <FileText className="w-12 h-12 mb-3 opacity-30 text-github-dark-accent" />
          Select a changed file to view its line-by-line diff.
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
          Loading file diff...
        </div>
      );
    }

    if (!diff) return null;

    if (diff.is_large_file) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6">
          <HardDrive className="w-12 h-12 text-github-dark-warning mb-3" />
          <h3 className="text-base font-semibold text-github-dark-heading mb-1">
            Large File Warning
          </h3>
          <p className="text-xs text-gray-400 max-w-md">
            File <span className="font-mono text-white">{selectedFile}</span> exceeds the maximum diff preview limit ({(diff.file_size_bytes / (1024 * 1024)).toFixed(2)} MB). Diffs are suppressed for performance.
          </p>
        </div>
      );
    }

    if (diff.is_binary) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6">
          <Binary className="w-12 h-12 text-github-dark-accent mb-3" />
          <h3 className="text-base font-semibold text-github-dark-heading mb-1">
            Binary File Detected
          </h3>
          <p className="text-xs text-gray-400 max-w-md">
            Binary files cannot be rendered as text diffs.
          </p>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        {/* Diff File Header Bar */}
        <div className="h-10 bg-github-dark-header border-b border-github-dark-border px-4 flex items-center justify-between">
          <span className="font-mono text-xs text-github-dark-heading font-medium truncate">
            {selectedFile}
          </span>
          <div className="flex items-center gap-1 bg-github-dark-sidebar border border-github-dark-border rounded p-0.5">
            <button
              onClick={() => setDiffViewMode('unified')}
              className={`p-1 rounded text-xs flex items-center gap-1 ${
                diffViewMode === 'unified'
                  ? 'bg-github-dark-accent text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Unified View"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              Unified
            </button>
            <button
              onClick={() => setDiffViewMode('split')}
              className={`p-1 rounded text-xs flex items-center gap-1 ${
                diffViewMode === 'split'
                  ? 'bg-github-dark-accent text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Split View"
            >
              <Columns className="w-3.5 h-3.5" />
              Split
            </button>
          </div>
        </div>

        {/* Diff Line Viewer */}
        <div className="flex-1 overflow-auto bg-[#1c2128] font-mono text-[12px] leading-6 select-text">
          {diff.lines.length === 0 ? (
            <div className="p-6 text-gray-500 text-center">No textual line changes detected.</div>
          ) : (
            diff.lines.map((line, idx) => {
              let lineBg = 'hover:bg-github-dark-hover/30';
              let textColor = 'text-github-dark-text';
              let prefix = ' ';

              if (line.line_type === 'addition') {
                lineBg = 'bg-green-950/40 text-green-300';
                textColor = 'text-green-300';
                prefix = '+';
              } else if (line.line_type === 'deletion') {
                lineBg = 'bg-red-950/40 text-red-300';
                textColor = 'text-red-300';
                prefix = '-';
              } else if (line.line_type === 'header') {
                lineBg = 'bg-github-dark-header text-github-dark-accent font-semibold';
              }

              return (
                <div key={idx} className={`flex border-b border-github-dark-border/20 ${lineBg}`}>
                  {/* Line numbers */}
                  <div className="w-12 px-2 py-0.5 text-right text-gray-500 select-none border-r border-github-dark-border/30 bg-github-dark-sidebar/40">
                    {line.old_line_num ?? ''}
                  </div>
                  <div className="w-12 px-2 py-0.5 text-right text-gray-500 select-none border-r border-github-dark-border/30 bg-github-dark-sidebar/40">
                    {line.new_line_num ?? ''}
                  </div>
                  {/* Line prefix */}
                  <div className="w-6 px-1 py-0.5 text-center select-none font-bold">
                    {prefix}
                  </div>
                  {/* Line content */}
                  <div className={`flex-1 px-2 py-0.5 whitespace-pre ${textColor}`}>
                    {line.content}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // Render Commit Details for History Tab
  const renderHistoryDetails = () => {
    if (!selectedCommitSha) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm">
          <Clock className="w-12 h-12 mb-3 opacity-30 text-github-dark-accent" />
          Select a commit from history to view metadata and changed files.
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
          Loading commit details...
        </div>
      );
    }

    if (!commitDetails) return null;

    return (
      <div className="h-full flex flex-col">
        {/* Commit Header Card */}
        <div className="p-6 bg-github-dark-header border-b border-github-dark-border space-y-4">
          <div className="flex items-start justify-between">
            <h2 className="text-base font-semibold text-github-dark-heading leading-snug">
              {commitDetails.commit.message}
            </h2>
            <span className="font-mono text-xs px-2.5 py-1 bg-github-dark-sidebar border border-github-dark-border rounded text-github-dark-accent font-medium">
              {commitDetails.commit.short_sha}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-github-dark-text">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-github-dark-accent" />
              <span className="font-medium text-white">{commitDetails.commit.author_name}</span>
              <span className="text-gray-400">({commitDetails.commit.author_email})</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{commitDetails.commit.relative_date}</span>
            </div>
          </div>
        </div>

        {/* Changed Files Section */}
        <div className="flex-1 p-6 overflow-y-auto space-y-3">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Changed Files ({commitDetails.changed_files.length})
          </div>

          <div className="space-y-1">
            {commitDetails.changed_files.map((file) => (
              <div
                key={file}
                className="px-3 py-2 bg-github-dark-sidebar border border-github-dark-border rounded text-xs font-mono text-github-dark-heading flex items-center gap-2"
              >
                <GitCommit className="w-3.5 h-3.5 text-github-dark-accent" />
                <span>{file}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-github-dark-bg overflow-hidden">
      {/* Action Banner */}
      <div className="h-10 bg-github-dark-sidebar border-b border-github-dark-border px-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-github-dark-success" />
          <span className="text-github-dark-heading font-medium">Branch status:</span>
          <span className="text-gray-400">
            {isCurrentBranchPushed ? 'Up to date with origin' : `${status?.ahead || 0} commits ahead`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenMergeRequest}
            disabled={!user || !isCurrentBranchPushed}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
              user && isCurrentBranchPushed
                ? 'bg-orange-950/80 text-orange-400 border border-orange-800/50 hover:bg-orange-900/80'
                : 'bg-github-dark-header text-gray-500 border border-github-dark-border cursor-not-allowed'
            }`}
            title={!isCurrentBranchPushed ? 'Push branch to origin before creating Merge Request' : ''}
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            Create Merge Request
          </button>

          <button
            onClick={handleViewPipelines}
            disabled={!user}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
              user
                ? 'bg-github-dark-header text-github-dark-heading border border-github-dark-border hover:bg-github-dark-hover'
                : 'bg-github-dark-header text-gray-500 border border-github-dark-border cursor-not-allowed'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Pipelines
          </button>
        </div>
      </div>

      {/* Main Diff / Details Display */}
      <div className="flex-1 min-h-0">
        {activeTab === 'changes' ? renderChangesDiff() : renderHistoryDetails()}
      </div>
    </main>
  );
};
