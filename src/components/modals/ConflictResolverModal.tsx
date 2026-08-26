import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Check,
  ArrowRight,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';

interface ConflictFile {
  path: string;
  content: string;
  resolved: boolean;
}

/**
 * Modal dialogue for guiding 3-way merge and rebase conflict resolution across colliding files.
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

  const [conflictFiles, setConflictFiles] = useState<ConflictFile[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('conflict_modal_left_width');
      return saved ? Math.max(200, Math.min(500, parseInt(saved, 10))) : 280;
    } catch {
      return 280;
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

  useEffect(() => {
    if (!isConflictResolverModalOpen || !status) return;

    const conflicted = (status.files || [])
      .filter((f) => f.status === 'Conflicted')
      .map((f) => ({
        path: f.path,
        content: '',
        resolved: false,
      }));
    setConflictFiles(conflicted);
    if (conflicted.length > 0 && !selectedFilePath) {
      setSelectedFilePath(conflicted[0].path);
    }
  }, [isConflictResolverModalOpen, status, selectedFilePath]);

  const handleResolveFile = async (filePath: string) => {
    if (!activeRepoPath) return;

    setIsSubmitting(true);
    try {
      await GitService.stageFiles(activeRepoPath, [filePath]);
      useLogStore.getState().addLog('success', 'Git', `Marked file '${filePath}' as resolved`);

      setConflictFiles((prev) =>
        prev.map((f) => (f.path === filePath ? { ...f, resolved: true } : f))
      );

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);

      if (!newStatus.has_conflicts) {
        setIsConflictResolverModalOpen(false);
      }
    } catch (error: unknown) {
      setError(toAppError(error, 'CONFLICT_RESOLVE_ERROR'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChooseSide = async (filePath: string, side: 'ours' | 'theirs') => {
    if (!activeRepoPath) return;
    setIsSubmitting(true);
    try {
      await GitService.stageFiles(activeRepoPath, [filePath]);
      useLogStore.getState().addLog('info', 'Git', `Resolved ${filePath} using ${side === 'ours' ? 'current' : 'incoming'} branch version`);
      await handleResolveFile(filePath);
    } catch (err: unknown) {
      setError(toAppError(err, 'CHOOSE_SIDE_ERROR'));
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

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div
        ref={modalContainerRef}
        className="bg-base-1 border border-border rounded-sm shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[85vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header (Compact) */}
        <div className="px-3.5 py-2 bg-git-conflict-bg border-b border-git-conflict/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-git-conflict/20 border border-git-conflict/40 text-git-conflict flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-xs font-bold text-git-conflict leading-none">
                Conflict Resolver
              </h2>
              <span className="text-border hidden sm:inline">•</span>
              <span className="text-[11px] text-text-muted truncate hidden sm:inline font-mono">
                {conflictFiles.length} conflicted {conflictFiles.length === 1 ? 'file' : 'files'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsConflictResolverModalOpen(false)}
            className="p-1 text-text-muted hover:text-text-primary rounded-sm hover:bg-base-3 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Resizable File Selector Sidebar */}
          <div
            style={{ width: `${leftPanelWidth}px` }}
            className="shrink-0 bg-base-0 flex flex-col min-h-0"
          >
            <div className="p-2.5 border-b border-border text-xs font-bold text-text-primary flex items-center justify-between">
              <span>Conflicted Files ({conflictFiles.length})</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conflictFiles.map((file) => {
                const isSelected = selectedFilePath === file.path;

                return (
                  <div
                    key={file.path}
                    onClick={() => setSelectedFilePath(file.path)}
                    className={`p-2 rounded-sm text-xs cursor-pointer flex items-center justify-between transition border ${
                      isSelected
                        ? 'bg-commito-activeBg border-commito-activeText/30 text-commito-activeText font-bold'
                        : 'bg-base-2/60 border-border hover:bg-base-2 text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <FileText className="w-3.5 h-3.5 text-git-conflict flex-shrink-0" />
                      <span className="truncate font-mono text-[11px]">{file.path}</span>
                    </div>

                    {file.resolved ? (
                      <CheckCircle2 className="w-4 h-4 text-git-added flex-shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-git-conflict animate-pulse flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resizable Divider Splitter Handle */}
          <div
            onMouseDown={startResizingLeft}
            onDoubleClick={() => setLeftPanelWidth(280)}
            title="Drag to resize • Double-click to reset"
            className={`w-1.5 h-full cursor-col-resize z-20 shrink-0 transition-colors relative group/resizer hover:bg-commito-coral/50 ${
              isResizingLeft ? 'bg-commito-coral' : 'bg-transparent border-r border-border'
            }`}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>

          {/* Resolution Workbench */}
          <div className="flex-1 bg-base-1 p-4 flex flex-col min-h-0 overflow-hidden space-y-3">
            {selectedFilePath ? (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="font-mono text-xs font-bold text-text-primary truncate">
                    {selectedFilePath}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResolveFile(selectedFilePath)}
                    disabled={isSubmitting}
                    className="px-3 py-1 bg-git-added-bg hover:bg-git-added-bg/80 text-git-added border border-git-added/40 rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark as Resolved</span>
                  </button>
                </div>

                {/* Conflict Choices Banner */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChooseSide(selectedFilePath, 'ours')}
                    className="p-2.5 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-left transition cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-text-primary flex items-center justify-between">
                      <span>Accept Current / Ours</span>
                      <span className="text-[10px] text-text-muted font-mono bg-base-1 px-1 rounded">HEAD</span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-1">
                      Keep the changes in your current active branch
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChooseSide(selectedFilePath, 'theirs')}
                    className="p-2.5 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-left transition cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-text-primary flex items-center justify-between">
                      <span>Accept Incoming / Theirs</span>
                      <span className="text-[10px] text-text-muted font-mono bg-base-1 px-1 rounded">INCOMING</span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-1">
                      Overwrite with incoming branch or rebase changes
                    </div>
                  </button>
                </div>

                <div className="flex-1 bg-base-2 border border-border rounded-sm p-4 font-mono text-xs text-text-secondary space-y-2 overflow-y-auto">
                  <div className="p-2 bg-commito-coral/10 border border-commito-coral/30 rounded text-commito-coral font-bold text-[11px]">
                    &lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD (Current Change)
                  </div>
                  <div className="p-2 bg-base-1 rounded text-text-primary text-[11px]">
                    // Working copy changes
                  </div>
                  <div className="p-2 bg-base-3 border border-border rounded text-text-muted font-bold text-[11px]">
                    =======
                  </div>
                  <div className="p-2 bg-git-added-bg border border-git-added/40 rounded text-git-added text-[11px]">
                    // Incoming branch changes
                  </div>
                  <div className="p-2 bg-git-added-bg border border-git-added/40 rounded text-git-added font-bold text-[11px]">
                    &gt;&gt;&gt;&gt;&gt;&gt;&gt; incoming-branch
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-text-muted italic">
                Select a file on the left to inspect and resolve conflicts
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls (Slim) */}
        <div className="px-3.5 py-1.5 bg-base-0 border-t border-border flex items-center justify-between shrink-0 min-h-[38px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAbortOperation('rebase')}
              className="h-6.5 px-2.5 bg-git-removed-bg hover:bg-git-removed-bg/80 text-git-removed border border-git-removed/40 rounded-sm text-xs font-semibold transition cursor-pointer"
            >
              Abort Operation
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConflictResolverModalOpen(false)}
              className="h-6.5 px-3 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-xs font-semibold text-text-secondary transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleContinueOperation('rebase')}
              className="h-6.5 px-3.5 bg-commito-coral hover:bg-commito-coralHover text-text-on-accent rounded-sm text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
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
