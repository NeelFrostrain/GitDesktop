import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, CheckCircle2, FileText, Check, ArrowRight, Split } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';
import {
  parseConflictMarkers,
  reconstructResolvedFile,
  ParsedConflictFile,
  ConflictHunk,
} from '../../shared/utils/conflictParser';

interface ConflictFileItem {
  path: string;
  resolved: boolean;
}

/**
 * Visual 3-Way Merge Conflict Resolver with chunk-by-chunk 1-click actions:
 * Accept Current, Accept Incoming, Accept Both, and direct live editable preview.
 */
export const ConflictResolverModal: React.FC = () => {
  const {
    activeRepoPath,
    isConflictResolverModalOpen,
    setIsConflictResolverModalOpen,
    status,
    setStatus,
    setError,
  } = useGitStore();

  const [conflictFiles, setConflictFiles] = useState<ConflictFileItem[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedConflictFile | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('conflict_modal_left_width');
      return saved ? Math.max(200, Math.min(500, parseInt(saved, 10))) : 260;
    } catch {
      return 260;
    }
  });
  const [isResizingLeft, setIsResizingLeft] = useState(false);

  const startResizingLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
  };

  useEffect(() => {
    if (!isResizingLeft) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!modalContainerRef.current) return;
      const modalRect = modalContainerRef.current.getBoundingClientRect();
      const newWidth = Math.max(200, Math.min(modalRect.width - 300, e.clientX - modalRect.left));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      try {
        localStorage.setItem('conflict_modal_left_width', leftPanelWidth.toString());
      } catch {}
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingLeft, leftPanelWidth]);

  // Load conflicted file list from status
  useEffect(() => {
    if (!isConflictResolverModalOpen || !status) return;

    const conflicted = (status.files || [])
      .filter((f) => f.status === 'Conflicted')
      .map((f) => ({
        path: f.path,
        resolved: false,
      }));

    setConflictFiles(conflicted);
    if (
      conflicted.length > 0 &&
      (!selectedFilePath || !conflicted.some((c) => c.path === selectedFilePath))
    ) {
      setSelectedFilePath(conflicted[0].path);
    }
  }, [isConflictResolverModalOpen, status, selectedFilePath]);

  // Load and parse conflict markers for the active file
  const loadFileContent = useCallback(
    async (filePath: string) => {
      if (!activeRepoPath) return;
      setIsLoadingFile(true);
      try {
        const content = await GitService.getFileContent(activeRepoPath, filePath);
        const parsed = parseConflictMarkers(content || '');
        setParsedData(parsed);
      } catch {
        setParsedData(null);
      } finally {
        setIsLoadingFile(false);
      }
    },
    [activeRepoPath]
  );

  useEffect(() => {
    if (selectedFilePath && isConflictResolverModalOpen) {
      loadFileContent(selectedFilePath);
    }
  }, [selectedFilePath, isConflictResolverModalOpen, loadFileContent]);

  // Set resolution choice for a specific conflict hunk
  const handleSetHunkChoice = (
    hunkId: string,
    choice: ConflictHunk['choice'],
    customContent: string = ''
  ) => {
    if (!parsedData) return;

    const newSegments = parsedData.segments.map((seg) => {
      if (seg.type === 'conflict' && seg.hunk.id === hunkId) {
        return {
          ...seg,
          hunk: {
            ...seg.hunk,
            choice,
            customContent: choice === 'custom' ? customContent : seg.hunk.customContent,
          },
        };
      }
      return seg;
    });

    const conflictHunks = newSegments.filter(
      (s): s is { type: 'conflict'; hunk: ConflictHunk } => s.type === 'conflict'
    );

    setParsedData({
      ...parsedData,
      segments: newSegments,
      resolvedHunks: conflictHunks.filter((s) => s.hunk.choice !== null).length,
    });
  };

  // Batch resolve all hunks in current file
  const handleBatchResolveAll = (choice: 'ours' | 'theirs') => {
    if (!parsedData) return;

    const newSegments = parsedData.segments.map((seg) => {
      if (seg.type === 'conflict') {
        return {
          ...seg,
          hunk: { ...seg.hunk, choice },
        };
      }
      return seg;
    });

    setParsedData({
      ...parsedData,
      segments: newSegments,
      resolvedHunks: parsedData.totalHunks,
    });
  };

  // Apply resolved file to disk & stage it in Git
  const handleSaveAndStage = async () => {
    if (!activeRepoPath || !selectedFilePath || !parsedData) return;

    setIsSubmitting(true);
    try {
      const finalContent = reconstructResolvedFile(parsedData.segments);

      // 1. Write resolved content to disk
      await invoke('save_file_content_cmd', {
        repoPath: activeRepoPath,
        filePath: selectedFilePath,
        content: finalContent,
      });

      // 2. Stage resolved file
      await GitService.stageFiles(activeRepoPath, [selectedFilePath]);
      useLogStore
        .getState()
        .addLog('success', 'Git', `Successfully resolved and staged: ${selectedFilePath}`);

      // 3. Mark file resolved locally
      setConflictFiles((prev) =>
        prev.map((f) => (f.path === selectedFilePath ? { ...f, resolved: true } : f))
      );

      // 4. Refresh status
      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);

      // 5. If all files resolved, close modal
      if (!newStatus.has_conflicts) {
        setIsConflictResolverModalOpen(false);
      } else {
        // Select next unresolved file
        const nextUnresolved = (newStatus.files || []).find((f) => f.status === 'Conflicted');
        if (nextUnresolved) setSelectedFilePath(nextUnresolved.path);
      }
    } catch (err: unknown) {
      setError(toAppError(err, 'SAVE_CONFLICT_ERROR'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueOperation = async (op: 'merge' | 'rebase') => {
    if (!activeRepoPath) return;

    try {
      if (op === 'merge') {
        await invoke('merge_continue', { repoPath: activeRepoPath });
      } else {
        await invoke('rebase_continue', { repoPath: activeRepoPath });
      }

      setIsConflictResolverModalOpen(false);
      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
    } catch (error: unknown) {
      setError(toAppError(error, 'CONTINUE_ERROR'));
    }
  };

  const handleAbortOperation = async (op: 'merge' | 'rebase') => {
    if (!activeRepoPath) return;

    try {
      if (op === 'merge') {
        await invoke('merge_abort', { repoPath: activeRepoPath });
      } else {
        await invoke('rebase_abort', { repoPath: activeRepoPath });
      }

      setIsConflictResolverModalOpen(false);
      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
    } catch (error: unknown) {
      setError(toAppError(error, 'ABORT_ERROR'));
    }
  };

  if (!isConflictResolverModalOpen) return null;

  const totalHunks = parsedData?.totalHunks || 0;
  const resolvedHunks = parsedData?.resolvedHunks || 0;
  const isCurrentFileFullyResolved = totalHunks > 0 && resolvedHunks === totalHunks;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans animate-in fade-in duration-100">
      <div
        ref={modalContainerRef}
        className="bg-base-1 border border-border-strong rounded-sm shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col h-[88vh] animate-in zoom-in-95 duration-100"
      >
        {/* Top Header */}
        <div className="px-3.5 py-2 bg-base-0 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-git-conflict/20 text-git-conflict border border-git-conflict/40 flex items-center justify-center shrink-0">
              <Split className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-xs font-bold text-text-primary leading-none">
                3-Way Merge Conflict Resolver
              </h2>
              <span className="text-border">•</span>
              <span className="text-[11px] text-text-muted font-mono truncate">
                {conflictFiles.filter((f) => !f.resolved).length} remaining conflicted file
                {conflictFiles.filter((f) => !f.resolved).length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsConflictResolverModalOpen(false)}
            className="p-1 text-text-muted hover:text-text-primary rounded-sm hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* File Selector Sidebar */}
          <div
            style={{ width: `${leftPanelWidth}px` }}
            className="shrink-0 bg-base-0/80 border-r border-border flex flex-col min-h-0 select-none"
          >
            <div className="p-2.5 border-b border-border text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center justify-between">
              <span>Conflicted Files</span>
              <span className="font-mono text-[10px] text-commito-coral">
                {conflictFiles.filter((f) => f.resolved).length}/{conflictFiles.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 scrollbar-thin">
              {conflictFiles.map((file) => {
                const isSelected = selectedFilePath === file.path;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedFilePath(file.path)}
                    className={`w-full p-2 rounded-xs flex items-center justify-between gap-2 text-left cursor-pointer transition ${
                      isSelected
                        ? 'bg-base-2 text-text-primary border border-border-strong font-semibold shadow-2xs'
                        : 'text-text-secondary hover:text-text-primary hover:bg-base-1 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText
                        className={`w-3.5 h-3.5 shrink-0 ${
                          file.resolved ? 'text-git-added' : 'text-git-conflict'
                        }`}
                      />
                      <span className="truncate font-mono text-xs">{file.path}</span>
                    </div>

                    {file.resolved ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-git-added shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-git-conflict animate-pulse shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resizer Splitter */}
          <div
            onMouseDown={startResizingLeft}
            onDoubleClick={() => setLeftPanelWidth(260)}
            className={`w-1.5 h-full cursor-col-resize z-20 shrink-0 transition-colors hover:bg-commito-coral/50 ${
              isResizingLeft ? 'bg-commito-coral' : 'bg-transparent border-r border-border'
            }`}
          />

          {/* Main Resolution Workbench */}
          <div className="flex-1 bg-base-1 flex flex-col min-h-0 overflow-hidden">
            {selectedFilePath ? (
              <>
                {/* File Header Bar & Batch Actions */}
                <div className="px-3 py-2 bg-base-0 border-b border-border flex items-center justify-between gap-3 shrink-0 select-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-bold text-text-primary truncate">
                      {selectedFilePath}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xs bg-base-2 border border-border text-commito-coral">
                      {resolvedHunks}/{totalHunks} resolved
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {totalHunks > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleBatchResolveAll('ours')}
                          className="px-2 py-1 bg-base-2 hover:bg-base-3 border border-border rounded-xs text-[11px] font-medium text-text-secondary hover:text-text-primary transition cursor-pointer"
                          title="Accept all Current / Ours changes in this file"
                        >
                          Accept All Ours
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBatchResolveAll('theirs')}
                          className="px-2 py-1 bg-base-2 hover:bg-base-3 border border-border rounded-xs text-[11px] font-medium text-text-secondary hover:text-text-primary transition cursor-pointer"
                          title="Accept all Incoming / Theirs changes in this file"
                        >
                          Accept All Theirs
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveAndStage}
                      disabled={isSubmitting || !isCurrentFileFullyResolved}
                      className={`px-3 py-1 rounded-xs text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                        isCurrentFileFullyResolved
                          ? 'bg-git-added text-white hover:bg-git-added/90'
                          : 'bg-base-2 text-text-muted border border-border cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? 'Staging...' : 'Save & Mark Resolved'}</span>
                    </button>
                  </div>
                </div>

                {/* Hunk Stream Resolution Canvas */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs scrollbar-thin">
                  {isLoadingFile ? (
                    <div className="py-12 text-center text-text-muted text-xs">
                      Loading file conflict chunks...
                    </div>
                  ) : parsedData && parsedData.segments.length > 0 ? (
                    parsedData.segments.map((seg, sIdx) => {
                      if (seg.type === 'plain') {
                        return (
                          <div
                            key={`plain-${sIdx}`}
                            className="p-2.5 bg-base-0/60 border border-border/40 rounded-xs text-text-secondary whitespace-pre-wrap leading-relaxed select-text"
                          >
                            {seg.content}
                          </div>
                        );
                      }

                      const { hunk } = seg;
                      const isResolved = hunk.choice !== null;

                      return (
                        <div
                          key={hunk.id}
                          className={`border rounded-sm overflow-hidden transition-all duration-150 ${
                            isResolved
                              ? 'border-git-added/50 bg-base-0/80 shadow-2xs'
                              : 'border-git-conflict/70 bg-base-0 ring-1 ring-git-conflict/30 shadow-xs'
                          }`}
                        >
                          {/* Hunk Action Toolbar Header */}
                          <div className="px-3 py-1.5 bg-base-2 border-b border-border flex items-center justify-between gap-2 shrink-0 select-none">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider font-sans">
                                Conflict {hunk.id.replace('hunk-', '#')}
                              </span>
                              {isResolved ? (
                                <span className="text-[9.5px] px-1.5 py-0.2 rounded-xs bg-git-added/20 text-git-added border border-git-added/40 font-bold font-sans">
                                  RESOLVED ({hunk.choice})
                                </span>
                              ) : (
                                <span className="text-[9.5px] px-1.5 py-0.2 rounded-xs bg-git-conflict/20 text-git-conflict border border-git-conflict/40 font-bold font-sans animate-pulse">
                                  UNRESOLVED
                                </span>
                              )}
                            </div>

                            {/* 1-Click Action Buttons */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSetHunkChoice(hunk.id, 'ours')}
                                className={`px-2 py-0.5 rounded-xs text-[10.5px] font-sans font-semibold transition cursor-pointer ${
                                  hunk.choice === 'ours'
                                    ? 'bg-commito-coral text-white shadow-2xs'
                                    : 'bg-base-1 hover:bg-base-3 border border-border text-text-secondary hover:text-commito-coral'
                                }`}
                              >
                                Accept Current
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSetHunkChoice(hunk.id, 'theirs')}
                                className={`px-2 py-0.5 rounded-xs text-[10.5px] font-sans font-semibold transition cursor-pointer ${
                                  hunk.choice === 'theirs'
                                    ? 'bg-git-added text-white shadow-2xs'
                                    : 'bg-base-1 hover:bg-base-3 border border-border text-text-secondary hover:text-git-added'
                                }`}
                              >
                                Accept Incoming
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSetHunkChoice(hunk.id, 'both-ours-first')}
                                className={`px-2 py-0.5 rounded-xs text-[10.5px] font-sans font-medium transition cursor-pointer ${
                                  hunk.choice === 'both-ours-first'
                                    ? 'bg-base-3 text-text-primary border border-border-strong'
                                    : 'bg-base-1 hover:bg-base-3 border border-border text-text-muted hover:text-text-primary'
                                }`}
                                title="Keep both: Current first, then Incoming"
                              >
                                Accept Both
                              </button>
                            </div>
                          </div>

                          {/* Side-by-Side Visual Inspection */}
                          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                            {/* Left: Current / Ours */}
                            <div
                              className={`p-2.5 ${
                                hunk.choice === 'ours' || hunk.choice === 'both-ours-first'
                                  ? 'bg-commito-coral/10'
                                  : 'bg-base-0/40 opacity-70'
                              }`}
                            >
                              <div className="text-[10px] font-bold text-commito-coral mb-1 flex items-center justify-between uppercase tracking-wider font-sans">
                                <span>{hunk.currentLabel}</span>
                                <span className="font-mono text-[9px] lowercase opacity-80">
                                  {hunk.currentContent.split('\n').length} lines
                                </span>
                              </div>
                              <pre className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed select-text font-mono">
                                {hunk.currentContent || (
                                  <span className="italic text-text-muted">(empty)</span>
                                )}
                              </pre>
                            </div>

                            {/* Right: Incoming / Theirs */}
                            <div
                              className={`p-2.5 ${
                                hunk.choice === 'theirs' || hunk.choice === 'both-ours-first'
                                  ? 'bg-git-added/10'
                                  : 'bg-base-0/40 opacity-70'
                              }`}
                            >
                              <div className="text-[10px] font-bold text-git-added mb-1 flex items-center justify-between uppercase tracking-wider font-sans">
                                <span>{hunk.incomingLabel}</span>
                                <span className="font-mono text-[9px] lowercase opacity-80">
                                  {hunk.incomingContent.split('\n').length} lines
                                </span>
                              </div>
                              <pre className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed select-text font-mono">
                                {hunk.incomingContent || (
                                  <span className="italic text-text-muted">(empty)</span>
                                )}
                              </pre>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-text-muted text-xs italic">
                      No merge conflict markers detected in this file.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-text-muted italic select-none">
                Select a conflicted file on the left to start 3-way resolution
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-3.5 py-2 bg-base-0 border-t border-border flex items-center justify-between shrink-0 min-h-[38px] select-none">
          <button
            type="button"
            onClick={() => handleAbortOperation('rebase')}
            className="h-6.5 px-2.5 bg-git-removed-bg hover:bg-git-removed-bg/80 text-git-removed border border-git-removed/40 rounded-xs text-xs font-semibold transition cursor-pointer"
          >
            Abort Operation
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConflictResolverModalOpen(false)}
              className="h-6.5 px-3 bg-base-2 hover:bg-base-3 border border-border rounded-xs text-xs font-semibold text-text-secondary transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleContinueOperation('rebase')}
              className="h-6.5 px-3.5 bg-commito-coral hover:bg-commito-coralHover text-text-on-accent rounded-xs text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <span>Continue Operation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolverModal;
