import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { FileText, Binary, HardDrive, Clock, ChevronRight, FileCode } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
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
import { CleanWorkingTreeView } from './diff/CleanWorkingTreeView';
import { FileEditorView } from './diff/FileEditorView';
import { StashedChangesView } from './diff/StashedChangesView';

/**
 * Main Diff Viewer presentation component supporting both unstaged/staged working tree changes
 * and historical commit inspection in Unified, Split, and Edit layout modes.
 */
const DIFF_CACHE_CAPACITY = 40;
const diffMemoryCache = new Map<string, DiffResult>();
const commitDetailsMemoryCache = new Map<string, CommitDetails>();
const commitDiffMemoryCache = new Map<string, DiffResult>();

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
    currentBranchStash,
    isViewingStashedChanges,
  } = useGitStore(
    useShallow((s) => ({
      activeRepoPath: s.activeRepoPath,
      selectedFile: s.selectedFile,
      selectedCommitSha: s.selectedCommitSha,
      activeTab: s.activeTab,
      diffViewMode: s.diffViewMode,
      setDiffViewMode: s.setDiffViewMode,
      status: s.status,
      setError: s.setError,
      currentBranchStash: s.currentBranchStash,
      isViewingStashedChanges: s.isViewingStashedChanges,
    }))
  );

  const [diff, setDiff] = useState<DiffResult | null>(() => {
    if (activeRepoPath && selectedFile && activeTab === 'changes') {
      return diffMemoryCache.get(`${activeRepoPath}:${selectedFile}`) || null;
    }
    return null;
  });
  const [commitDetails, setCommitDetails] = useState<CommitDetails | null>(() => {
    if (activeRepoPath && selectedCommitSha && activeTab === 'history') {
      return commitDetailsMemoryCache.get(`${activeRepoPath}:${selectedCommitSha}`) || null;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCommit, setIsLoadingCommit] = useState(false);

  // Editor mode state & handle
  const [editorState, setEditorState] = useState<{
    isDirty: boolean;
    isSaving: boolean;
    saveSuccess: boolean;
  }>({
    isDirty: false,
    isSaving: false,
    saveSuccess: false,
  });
  const editorHandleRef = useRef<import('./diff/FileEditorView').FileEditorHandle | null>(null);

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

    const cacheKey = `${activeRepoPath}:${selectedFile}:${isStaged}`;
    const cachedDiff = diffMemoryCache.get(cacheKey);
    if (cachedDiff) {
      setDiff(cachedDiff);
      setIsLoading(false);
    }

    let isDisposed = false;
    let isFetching = false;

    const fetchLiveDiff = async (isInitial = false) => {
      if (isDisposed || isFetching || !activeRepoPath || !selectedFile) return;
      isFetching = true;
      if (isInitial && !cachedDiff) {
        setIsLoading(true);
      }

      try {
        const newDiff = await GitService.getFileDiff(activeRepoPath, selectedFile, false);
        if (!isDisposed) {
          // Update cache with LRU eviction
          if (diffMemoryCache.size >= DIFF_CACHE_CAPACITY) {
            const oldestKey = diffMemoryCache.keys().next().value;
            if (oldestKey) diffMemoryCache.delete(oldestKey);
          }
          diffMemoryCache.set(cacheKey, newDiff);

          setDiff((prev) => {
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
        if (!isDisposed && isInitial && !cachedDiff) {
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
  }, [activeRepoPath, selectedFile, activeTab, setError, isStaged]);

  const fetchCommitFileDiff = useCallback(
    async (sha: string, filePath: string) => {
      if (!activeRepoPath) return;
      const fileCacheKey = `${activeRepoPath}:${sha}:${filePath}`;
      const cached = commitDiffMemoryCache.get(fileCacheKey);
      if (cached) {
        setExpandedHistoryFiles((prev) =>
          prev[filePath] === cached ? prev : { ...prev, [filePath]: cached }
        );
        return;
      }

      setLoadingHistoryFiles((prev) => ({ ...prev, [filePath]: true }));
      try {
        const res = await GitService.getCommitFileDiff(activeRepoPath, sha, filePath);
        if (commitDiffMemoryCache.size >= DIFF_CACHE_CAPACITY * 2) {
          const oldestKey = commitDiffMemoryCache.keys().next().value;
          if (oldestKey) commitDiffMemoryCache.delete(oldestKey);
        }
        commitDiffMemoryCache.set(fileCacheKey, res);
        setExpandedHistoryFiles((prev) => ({ ...prev, [filePath]: res }));
      } catch (err: unknown) {
        setError(toAppError(err, 'GIT_ERROR'));
      } finally {
        setLoadingHistoryFiles((prev) => ({ ...prev, [filePath]: false }));
      }
    },
    [activeRepoPath, setError]
  );

  // Fetch commit details when selected commit changes in History tab
  useEffect(() => {
    if (!activeRepoPath || !selectedCommitSha || activeTab !== 'history') {
      setCommitDetails(null);
      setExpandedHistoryFiles({});
      setOpenFiles({});
      return;
    }

    let isDisposed = false;
    const cacheKey = `${activeRepoPath}:${selectedCommitSha}`;
    const cachedDetails = commitDetailsMemoryCache.get(cacheKey);

    if (cachedDetails) {
      setCommitDetails(cachedDetails);
      setIsLoadingCommit(false);
      if (cachedDetails.changed_files.length > 0) {
        const firstFile = cachedDetails.changed_files[0];
        setOpenFiles({ [firstFile]: true });
        fetchCommitFileDiff(selectedCommitSha, firstFile);
      }
    } else {
      setIsLoadingCommit(true);
      setExpandedHistoryFiles({});
      setOpenFiles({});

      GitService.getCommitDetails(activeRepoPath, selectedCommitSha)
        .then((details) => {
          if (isDisposed) return;
          if (commitDetailsMemoryCache.size >= DIFF_CACHE_CAPACITY) {
            const oldestKey = commitDetailsMemoryCache.keys().next().value;
            if (oldestKey) commitDetailsMemoryCache.delete(oldestKey);
          }
          commitDetailsMemoryCache.set(cacheKey, details);
          setCommitDetails(details);
          if (details.changed_files.length > 0) {
            const firstFile = details.changed_files[0];
            setOpenFiles({ [firstFile]: true });
            fetchCommitFileDiff(selectedCommitSha, firstFile);
          }
        })
        .catch((err: unknown) => {
          if (!isDisposed) setError(toAppError(err, 'GIT_ERROR'));
        })
        .finally(() => {
          if (!isDisposed) setIsLoadingCommit(false);
        });
    }

    return () => {
      isDisposed = true;
    };
  }, [activeRepoPath, selectedCommitSha, activeTab, setError, fetchCommitFileDiff]);

  const toggleFileExpansion = (filePath: string) => {
    const nextState = !openFiles[filePath];
    setOpenFiles((prev) => ({ ...prev, [filePath]: nextState }));
    if (nextState && selectedCommitSha && !expandedHistoryFiles[filePath]) {
      fetchCommitFileDiff(selectedCommitSha, filePath);
    }
  };

  // ── Render Changes Diff Content ──────────────────────────────────────────
  const renderChangesDiff = () => {
    if (isViewingStashedChanges && currentBranchStash) {
      return <StashedChangesView />;
    }

    if (!selectedFile || (status && status.files.length === 0)) {
      if (status && status.files.length === 0) {
        return <CleanWorkingTreeView />;
      }

      return (
        <div className="h-full flex flex-col items-center justify-center text-text-muted text-sm space-y-2">
          <FileText className="w-10 h-10 opacity-30 text-commito-coral" />
          <span className="font-medium text-text-muted">
            Select a changed file to view its line-by-line diff.
          </span>
        </div>
      );
    }

    if (isLoading && (!diff || diff.file_path !== selectedFile)) {
      return (
        <div className="h-full flex items-center justify-center text-text-muted text-sm">
          Loading file diff...
        </div>
      );
    }

    if (!diff) return null;

    if (diff.is_large_file) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6">
          <HardDrive className="w-12 h-12 text-git-modified mb-3" />
          <h3 className="text-base font-semibold text-text-primary mb-1">Large File Warning</h3>
          <p className="text-xs text-text-muted max-w-md">
            File <span className="font-mono text-text-primary">{selectedFile}</span> exceeds the
            maximum diff preview limit.
          </p>
        </div>
      );
    }

    if (isImageFile(selectedFile)) {
      return (
        <ImageDiffView
          filePath={selectedFile}
          repoPath={activeRepoPath || ''}
          staged={isStaged}
        />
      );
    }

    if (diff.is_binary) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-base-0">
          <Binary className="w-12 h-12 text-git-modified mb-3" />
          <h3 className="text-base font-semibold text-text-primary mb-1">Binary File Detected</h3>
          <p className="text-xs text-text-muted max-w-md mb-2">
            Binary files cannot be rendered as text diffs.
          </p>
          <span className="text-xs font-mono text-git-added px-2.5 py-1 bg-base-1 border border-border rounded-sm">
            File Size: {(diff.file_size_bytes / 1024).toFixed(1)} KB
          </span>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col min-h-0">
        <DiffHeader
          filePath={selectedFile}
          diffResult={diff}
          diffViewMode={diffViewMode}
          onChangeViewMode={setDiffViewMode}
          staged={isStaged}
          isDirty={editorState.isDirty}
          isSaving={editorState.isSaving}
          saveSuccess={editorState.saveSuccess}
          onSave={() => editorHandleRef.current?.save()}
          onRevert={() => editorHandleRef.current?.revert()}
        />

        <div className="flex-1 overflow-auto bg-base-0 flex flex-col min-h-0">
          {diffViewMode === 'edit' && activeRepoPath ? (
            <FileEditorView
              repoPath={activeRepoPath}
              filePath={selectedFile}
              isStaged={isStaged}
              editorRefHandle={editorHandleRef}
              onStateChange={setEditorState}
              onExitEditMode={() => setDiffViewMode('unified')}
              onSaved={async () => {
                if (activeRepoPath) {
                  try {
                    const latestStatus = await GitService.getRepoStatus(activeRepoPath);
                    useGitStore.getState().setStatus(latestStatus);
                    const newDiff = await GitService.getFileDiff(
                      activeRepoPath,
                      selectedFile,
                      false
                    );
                    setDiff(newDiff);
                  } catch (e) {
                    console.error('Failed to sync git status after saving:', e);
                  }
                }
              }}
            />
          ) : diffViewMode === 'split' ? (
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

    if (isLoadingCommit && !commitDetails) {
      return (
        <div className="h-full flex items-center justify-center text-text-muted text-sm">
          Loading commit details...
        </div>
      );
    }

    if (!commitDetails) return null;

    const handleToggleAllFiles = () => {
      const allOpen = commitDetails.changed_files.every((f) => openFiles[f]);
      const nextState: Record<string, boolean> = {};
      commitDetails.changed_files.forEach((f) => {
        nextState[f] = !allOpen;
        if (!allOpen && selectedCommitSha && !expandedHistoryFiles[f]) {
          fetchCommitFileDiff(selectedCommitSha, f);
        }
      });
      setOpenFiles(nextState);
    };

    return (
      <div className="h-full flex flex-col overflow-hidden">
        <CommitDetailsHeader
          commitDetails={commitDetails}
          diffViewMode={diffViewMode}
          onChangeViewMode={setDiffViewMode}
          openFiles={openFiles}
          onToggleExpandAll={handleToggleAllFiles}
        />

        {/* Changed Files with Accordion Diffs */}
        <div className="flex-1 p-1 py-1.5 overflow-y-auto space-y-2 bg-base-0">
          <div className="space-y-2">
            {commitDetails.changed_files.map((file) => {
              const isOpen = Boolean(openFiles[file]);
              const fileDiff = expandedHistoryFiles[file];
              const isFileLoading = Boolean(loadingHistoryFiles[file]);
              const fileStat = commitDetails.file_stats?.find((s) => s.path === file);

              // Split directory and filename for clean visual hierarchy
              const lastSlashIndex = file.lastIndexOf('/');
              const dirPath = lastSlashIndex !== -1 ? file.substring(0, lastSlashIndex + 1) : '';
              const fileName = lastSlashIndex !== -1 ? file.substring(lastSlashIndex + 1) : file;

              return (
                <div
                  key={file}
                  className={`border rounded-sm overflow-hidden bg-base-1 transition-colors duration-150 shadow-2xs ${
                    isOpen ? 'border-border-strong' : 'border-border hover:border-border-strong'
                  }`}
                >
                  {/* File Accordion Header */}
                  <button
                    onClick={() => toggleFileExpansion(file)}
                    className="w-full px-3 py-2 text-xs font-mono text-text-primary hover:bg-base-2/80 flex items-center justify-between text-left transition cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                      <ChevronRight
                        className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-90 text-commito-coral' : 'text-text-faint'
                        }`}
                      />
                      <FileCode className="w-3.5 h-3.5 text-git-added flex-shrink-0 opacity-80" />
                      <div className="truncate min-w-0 flex items-baseline gap-0.5">
                        {dirPath && (
                          <span className="text-text-faint text-[11px] truncate">{dirPath}</span>
                        )}
                        <span className="font-semibold text-text-primary text-xs truncate">
                          {fileName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0 ml-3">
                      {fileStat && (fileStat.additions > 0 || fileStat.deletions > 0) && (
                        <div className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-base-0 border border-border">
                          {fileStat.additions > 0 && (
                            <span className="text-git-added">+{fileStat.additions}</span>
                          )}
                          {fileStat.deletions > 0 && (
                            <span className="text-git-removed">-{fileStat.deletions}</span>
                          )}
                        </div>
                      )}
                      <CopyButton text={file} className="!h-5 !px-1.5 !text-[10px]" />
                      {isFileLoading && (
                        <span className="text-[10px] text-text-muted animate-pulse font-sans">
                          Loading...
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded File Diff Body */}
                  {isOpen && (
                    <div className="border-t border-border bg-base-0 animate-in fade-in duration-150">
                      {isFileLoading ? (
                        <div className="p-4 text-xs text-text-muted font-mono text-center">
                          Fetching file changes...
                        </div>
                      ) : fileDiff ? (
                        isImageFile(file) ? (
                          <ImageDiffView
                            filePath={file}
                            repoPath={activeRepoPath || ''}
                            commitSha={selectedCommitSha || undefined}
                          />
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
    <main className="flex-1 flex flex-col h-full min-h-0 bg-base-0 overflow-hidden">
      {/* Main Diff / Details Display */}
      <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
        {activeTab === 'changes' ? renderChangesDiff() : renderHistoryDetails()}
      </div>
    </main>
  );
};
