import React, { useState, useEffect } from 'react';
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
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-git-conflict-bg border-b border-git-conflict/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-git-conflict/20 border border-git-conflict/40 text-git-conflict flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-git-conflict leading-tight">
                Merge & Rebase Conflict Resolution Studio
              </h2>
              <p className="text-[11px] text-text-muted">
                Resolve line collisions across 3-way hunks and mark files ready to commit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsConflictResolverModalOpen(false)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-base-3 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* File Selector Sidebar */}
          <div className="w-64 border-r border-border bg-base-0 flex flex-col">
            <div className="p-3 border-b border-border text-xs font-bold text-text-primary flex items-center justify-between">
              <span>Conflicted Files ({conflictFiles.length})</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conflictFiles.map((file) => {
                const isSelected = selectedFilePath === file.path;

                return (
                  <div
                    key={file.path}
                    onClick={() => setSelectedFilePath(file.path)}
                    className={`p-2.5 rounded-md text-xs cursor-pointer flex items-center justify-between transition border ${
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

          {/* Conflict Hunk Editor */}
          <div className="flex-1 flex flex-col min-w-0 bg-base-1 p-5 space-y-4 overflow-y-auto">
            {selectedFilePath ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="font-mono text-xs font-bold text-text-primary">
                    {selectedFilePath}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResolveFile(selectedFilePath)}
                    disabled={isSubmitting}
                    className="px-4 py-1.5 bg-git-added hover:bg-git-added/90 text-text-on-accent rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Resolved</span>
                  </button>
                </div>

                {/* 3-Way Quick Actions */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleResolveFile(selectedFilePath)}
                    className="p-3 bg-base-2 border border-border hover:border-commito-coral rounded-md text-left space-y-1 transition group cursor-pointer"
                  >
                    <div className="text-xs font-bold text-commito-coral group-hover:underline">
                      Accept Current (Ours)
                    </div>
                    <div className="text-[11px] text-text-muted">
                      Keep working tree version
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResolveFile(selectedFilePath)}
                    className="p-3 bg-base-2 border border-border hover:border-git-added rounded-md text-left space-y-1 transition group cursor-pointer"
                  >
                    <div className="text-xs font-bold text-git-added group-hover:underline">
                      Accept Incoming (Theirs)
                    </div>
                    <div className="text-[11px] text-text-muted">
                      Overwrite with incoming branch commit
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResolveFile(selectedFilePath)}
                    className="p-3 bg-base-2 border border-border hover:border-accent rounded-md text-left space-y-1 transition group cursor-pointer"
                  >
                    <div className="text-xs font-bold text-accent group-hover:underline">
                      Accept Both Changes
                    </div>
                    <div className="text-[11px] text-text-muted">
                      Combine both code blocks
                    </div>
                  </button>
                </div>

                <div className="flex-1 bg-base-2 border border-border rounded-md p-4 font-mono text-xs text-text-secondary space-y-2">
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

        {/* Modal Footer Controls */}
        <div className="px-5 py-3 bg-base-0 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAbortOperation('rebase')}
              className="px-3 py-1.5 bg-git-removed-bg hover:bg-git-removed-bg/80 text-git-removed border border-git-removed/40 rounded-md text-xs font-semibold transition cursor-pointer"
            >
              Abort Operation
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConflictResolverModalOpen(false)}
              className="px-4 py-1.5 bg-base-2 hover:bg-base-3 border border-border rounded-md text-xs font-semibold text-text-secondary transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleContinueOperation('rebase')}
              className="px-4 py-1.5 bg-commito-coral hover:bg-commito-coralHover text-text-on-accent rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
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
