import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Binary,
  HardDrive,
  Clock,
  ChevronDown,
  ChevronRight,
  FileCode,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { DiffResult, CommitDetails } from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';
import { isImageFile, CopyButton } from './diff/diffUtils';
import { DiffHeader } from './diff/DiffHeader';
import { CommitDetailsHeader } from './diff/CommitDetailsHeader';
import { UnifiedDiffView } from './diff/UnifiedDiffView';
import { SplitDiffView } from './diff/SplitDiffView';
import { ImageDiffView } from './diff/ImageDiffView';

/**
 * Main Diff Viewer presentation component supporting both unstaged/staged working tree changes
 * and historical commit inspection in Unified and Split layout modes.
 */
export const DiffViewer: React.FC = () => {
  const {
    activeRepoPath,
    selectedFile,
    selectedCommitSha,
    activeTab,
    diffViewMode,
    setDiffViewMode,
    status,
    setError,
  } = useGitStore();

  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [commitDetails, setCommitDetails] = useState<CommitDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Expanded per-file diff cache in History mode
  const [expandedHistoryFiles, setExpandedHistoryFiles] = useState<Record<string, DiffResult>>({});
  const [loadingHistoryFiles, setLoadingHistoryFiles] = useState<Record<string, boolean>>({});
  const [openFiles, setOpenFiles] = useState<Record<string, boolean>>({});

  // Derive isStaged as a reactive memo dependency
  const isStaged = useMemo(() => {
    if (!selectedFile || !status) return false;
    const fileInStatus = status.files.find((f) => f.path === selectedFile);
    return fileInStatus ? fileInStatus.staged : false;
  }, [selectedFile, status]);

  // Fetch and live-sync diff when selected file changes, or when external edits occur on disk
  useEffect(() => {
    if (!activeRepoPath || !selectedFile || activeTab !== 'changes') {
      setDiff(null);
      return;
    }

    let isDisposed = false;
    let isFetching = false;

    const fetchLiveDiff = async (isInitial = false) => {
      if (isDisposed || isFetching || !activeRepoPath || !selectedFile) return;
      isFetching = true;
      if (isInitial) {
        setIsLoading(true);
      }

      try {
        const newDiff = await GitService.getFileDiff(activeRepoPath, selectedFile, false);
        if (!isDisposed) {
          setDiff((prev) => {
            // If the diff content and lines are identical, keep previous reference to avoid re-renders
            if (
              prev &&
              prev.file_path === newDiff.file_path &&
              prev.lines.length === newDiff.lines.length &&
              prev.lines.every(
                (l, idx) =>
                  l.content === newDiff.lines[idx]?.content &&
                  l.line_type === newDiff.lines[idx]?.line_type
              )
            ) {
              return prev;
            }
            return newDiff;
          });
        }
      } catch (err: unknown) {
        if (!isDisposed && isInitial) {
          setError(toAppError(err, 'GIT_ERROR'));
        }
      } finally {
        if (!isDisposed) {
          if (isInitial) setIsLoading(false);
          isFetching = false;
        }
      }
    };

    // 1. Initial immediate fetch
    fetchLiveDiff(true);

    // 2. Continuous lightweight background sync (every 1.5s) to detect live external file edits
    const intervalId = setInterval(() => fetchLiveDiff(false), 1500);

    // 3. Instant sync on window focus and document visibility
    const handleFocusSync = () => fetchLiveDiff(false);
    window.addEventListener('focus', handleFocusSync);
    document.addEventListener('visibilitychange', handleFocusSync);

    return () => {
      isDisposed = true;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleFocusSync);
    };
  }, [activeRepoPath, selectedFile, activeTab, setError]);

  // Fetch commit details when selected commit changes in History tab
  useEffect(() => {
    if (!activeRepoPath || !selectedCommitSha || activeTab !== 'history') {
      setCommitDetails(null);
      setExpandedHistoryFiles({});
      setOpenFiles({});
      return;
    }

    setIsLoading(true);
    GitService.getCommitDetails(activeRepoPath, selectedCommitSha)
      .then((details) => {
        setCommitDetails(details);
        // Expand first modified file by default
        if (details.changed_files.length > 0) {
          const firstFile = details.changed_files[0];
          setOpenFiles({ [firstFile]: true });
          fetchCommitFileDiff(selectedCommitSha, firstFile);
        }
      })
      .catch((err: unknown) => setError(toAppError(err, 'GIT_ERROR')))
      .finally(() => setIsLoading(false));
  }, [activeRepoPath, selectedCommitSha, activeTab, setError]);

  const fetchCommitFileDiff = async (sha: string, filePath: string) => {
    if (!activeRepoPath || expandedHistoryFiles[filePath]) return;
    setLoadingHistoryFiles((prev) => ({ ...prev, [filePath]: true }));
    try {
      const res = await GitService.getCommitFileDiff(activeRepoPath, sha, filePath);
      setExpandedHistoryFiles((prev) => ({ ...prev, [filePath]: res }));
    } catch (err: unknown) {
      setError(toAppError(err, 'GIT_ERROR'));
    } finally {
      setLoadingHistoryFiles((prev) => ({ ...prev, [filePath]: false }));
    }
  };

  const toggleFileExpansion = (filePath: string) => {
    const nextState = !openFiles[filePath];
    setOpenFiles((prev) => ({ ...prev, [filePath]: nextState }));
    if (nextState && selectedCommitSha && !expandedHistoryFiles[filePath]) {
      fetchCommitFileDiff(selectedCommitSha, filePath);
    }
  };

  // ── Render Changes Diff Content ──────────────────────────────────────────
  const renderChangesDiff = () => {
    if (!selectedFile) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-text-muted text-sm space-y-2">
          <FileText className="w-10 h-10 opacity-30 text-commito-coral" />
          <span className="font-medium text-text-muted">Select a changed file to view its line-by-line diff.</span>
        </div>
      );
    }

    if (isLoading && (!diff || diff.file_path !== selectedFile)) {
      return (
        <div className="h-full flex items-center justify-center text-text-muted text-sm">Loading file diff...</div>
      );
    }

    if (!diff) return null;

    if (diff.is_large_file) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6">
          <HardDrive className="w-12 h-12 text-git-modified mb-3" />
          <h3 className="text-base font-semibold text-text-primary mb-1">Large File Warning</h3>
          <p className="text-xs text-text-muted max-w-md">
            File <span className="font-mono text-text-primary">{selectedFile}</span> exceeds the maximum diff preview
            limit.
          </p>
        </div>
      );
    }

    if (isImageFile(selectedFile)) {
      return <ImageDiffView filePath={selectedFile} repoPath={activeRepoPath || ''} />;
    }

    if (diff.is_binary) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-base-0">
          <Binary className="w-12 h-12 text-git-modified mb-3" />
          <h3 className="text-base font-semibold text-text-primary mb-1">Binary File Detected</h3>
          <p className="text-xs text-text-muted max-w-md mb-2">Binary files cannot be rendered as text diffs.</p>
          <span className="text-xs font-mono text-git-added px-2.5 py-1 bg-base-1 border border-border rounded-sm">
            File Size: {(diff.file_size_bytes / 1024).toFixed(1)} KB
          </span>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        <DiffHeader
          filePath={selectedFile}
          diffResult={diff}
          diffViewMode={diffViewMode}
          onChangeViewMode={setDiffViewMode}
          staged={isStaged}
        />

        <div className="flex-1 overflow-auto bg-base-0">
          {diffViewMode === 'split' ? (
            <SplitDiffView lines={diff.lines} />
          ) : (
            <UnifiedDiffView lines={diff.lines} />
          )}
        </div>
      </div>
    );
  };

  // ── Render History Details Content ───────────────────────────────────────
  const renderHistoryDetails = () => {
    if (!selectedCommitSha) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-text-muted text-sm">
          <Clock className="w-12 h-12 mb-3 opacity-30 text-git-modified" />
          Select a commit from history to view metadata and changed files.
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="h-full flex items-center justify-center text-text-muted text-sm">Loading commit details...</div>
      );
    }

    if (!commitDetails) return null;

    return (
      <div className="h-full flex flex-col overflow-hidden">
        <CommitDetailsHeader
          commitDetails={commitDetails}
          diffViewMode={diffViewMode}
          onChangeViewMode={setDiffViewMode}
        />

        {/* Changed Files with Accordion Diffs */}
        <div className="flex-1 p-2 overflow-y-auto space-y-3 bg-base-0">
          <div className="text-xs font-semibold text-text-muted p-1 px-0.5 tracking-wider flex items-center justify-between">
            <span className="text-xs">Changed Files ({commitDetails.changed_files.length})</span>
            <span className="font-mono text-[11px] font-medium text-text-faint text-center">
              {commitDetails.changed_files.length} file{commitDetails.changed_files.length !== 1 ? 's' : ''} modified
            </span>
          </div>

          <div className="space-y-2">
            {commitDetails.changed_files.map((file) => {
              const isOpen = Boolean(openFiles[file]);
              const fileDiff = expandedHistoryFiles[file];
              const isFileLoading = Boolean(loadingHistoryFiles[file]);
              const fileStat = commitDetails.file_stats?.find((s) => s.path === file);

              return (
                <div key={file} className="border border-border rounded-sm overflow-hidden bg-base-1 shadow-xs">
                  {/* File Accordion Header */}
                  <button
                    onClick={() => toggleFileExpansion(file)}
                    className="w-full px-3.5 py-2 text-xs font-mono text-text-primary hover:bg-base-2 flex items-center justify-between text-left transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-git-modified flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                      )}
                      <span className="text-text-muted select-none">-</span>
                      <FileCode className="w-3.5 h-3.5 text-git-added flex-shrink-0" />
                      <span className="truncate font-mono font-medium">{file}</span>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {fileStat && (fileStat.additions > 0 || fileStat.deletions > 0) && (
                        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
                          {fileStat.additions > 0 && <span className="text-git-added">+{fileStat.additions}</span>}
                          {fileStat.deletions > 0 && <span className="text-git-removed">-{fileStat.deletions}</span>}
                        </div>
                      )}
                      <CopyButton text={file} />
                      {isFileLoading && (
                        <span className="text-[11px] text-text-muted animate-pulse font-sans">Loading diff...</span>
                      )}
                    </div>
                  </button>

                  {/* Expanded File Diff Body */}
                  {isOpen && (
                    <div className="border-t border-border bg-base-0">
                      {isFileLoading ? (
                        <div className="p-4 text-xs text-text-muted font-mono text-center">Fetching file changes...</div>
                      ) : fileDiff ? (
                        isImageFile(file) ? (
                          <ImageDiffView filePath={file} repoPath={activeRepoPath || ''} />
                        ) : diffViewMode === 'split' ? (
                          <SplitDiffView lines={fileDiff.lines} />
                        ) : (
                          <UnifiedDiffView lines={fileDiff.lines} />
                        )
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-base-0 overflow-hidden">
      {/* Main Diff / Details Display */}
      <div className="flex-1 min-h-0">
        {activeTab === 'changes' ? renderChangesDiff() : renderHistoryDetails()}
      </div>
    </main>
  );
};
