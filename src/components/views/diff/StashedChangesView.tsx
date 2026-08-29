import React, { useState, useEffect } from 'react';
import {
  Archive,
  AlertTriangle,
  RotateCcw,
  Trash2,
  FileText,
  Loader2,
  Copy,
  Check,
  AlignJustify,
  Columns,
  FileCode,
  X,
} from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { GitService } from '../../../services/git/gitService';
import { DiffResult } from '../../../types/git';
import { UnifiedDiffView } from './UnifiedDiffView';
import { SplitDiffView } from './SplitDiffView';
import { Button } from '../../common/Button';
import { Tabs } from '../../common/Tabs';

export const StashedChangesView: React.FC = () => {
  const {
    activeRepoPath,
    currentBranchStash,
    restoreCurrentBranchStash,
    discardCurrentBranchStash,
    setIsViewingStashedChanges,
    selectedStashFile,
    diffViewMode,
    setDiffViewMode,
  } = useGitStore();

  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [isConfirmDiscardOpen, setIsConfirmDiscardOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load diff for selected stashed file
  useEffect(() => {
    if (!activeRepoPath || !currentBranchStash || !selectedStashFile) {
      setDiff(null);
      return;
    }

    let isDisposed = false;
    setIsLoadingDiff(true);

    GitService.getStashFileDiff(activeRepoPath, currentBranchStash.index, selectedStashFile)
      .then((res) => {
        if (!isDisposed) setDiff(res);
      })
      .catch(() => {
        if (!isDisposed) setDiff(null);
      })
      .finally(() => {
        if (!isDisposed) setIsLoadingDiff(false);
      });

    return () => {
      isDisposed = true;
    };
  }, [activeRepoPath, currentBranchStash?.index, selectedStashFile]);

  const handleRestore = async () => {
    setIsRestoring(true);
    setErrorMsg(null);
    try {
      await restoreCurrentBranchStash();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setIsRestoring(false);
    }
  };

  const handleDiscard = async () => {
    setIsDiscarding(true);
    setErrorMsg(null);
    try {
      await discardCurrentBranchStash();
      setIsConfirmDiscardOpen(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setIsDiscarding(false);
    }
  };

  const handleCopyPath = () => {
    if (selectedStashFile) {
      navigator.clipboard.writeText(selectedStashFile);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!currentBranchStash) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-base-0 text-text-muted select-none">
        <Archive className="w-12 h-12 stroke-1 text-text-muted/40 mb-3" />
        <h2 className="text-base font-semibold text-text-primary mb-1">No Stashed Changes</h2>
        <p className="text-xs text-text-muted mb-4 max-w-sm">
          There are no stashed modifications saved on this branch.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setIsViewingStashedChanges(false)}>
          Return to Changes
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-base-0 overflow-hidden font-sans select-none relative">
      {/* Top Header & Actions Toolbar */}
      <div className="px-6 py-4 border-b border-border bg-base-1/50 flex flex-col gap-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Stashed changes</h1>
          <button
            type="button"
            onClick={() => setIsViewingStashedChanges(false)}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
            title="Close Stashed Changes view"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons + Helper Text */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="coral"
            size="sm"
            onClick={handleRestore}
            isLoading={isRestoring}
            disabled={isRestoring || isDiscarding}
            leftIcon={!isRestoring ? <RotateCcw className="w-3.5 h-3.5" /> : undefined}
            title="Apply stashed modifications back to your working directory"
          >
            Restore
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsConfirmDiscardOpen(true)}
            disabled={isRestoring || isDiscarding}
            leftIcon={<Trash2 className="w-3.5 h-3.5 text-text-muted" />}
            title="Permanently remove these stashed changes"
          >
            Discard
          </Button>

          <span className="text-xs text-text-muted select-none">
            <strong className="text-text-primary font-semibold">Restore</strong> will move your
            stashed files to the Changes list.
          </span>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-sm bg-git-removed-bg border border-git-removed/40 text-git-removed text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Main Full-Width Diff Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-base-0 overflow-hidden">
        {selectedStashFile ? (
          <>
            {/* File Diff Header Toolbar */}
            <div className="h-10 px-4 border-b border-border bg-base-1/50 flex items-center justify-between gap-2 flex-shrink-0 select-none">
              <div className="flex items-center gap-2 min-w-0 truncate">
                <FileCode className="w-4 h-4 text-commito-coral shrink-0" />
                <span className="font-mono text-xs font-semibold text-text-primary truncate">
                  {selectedStashFile}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
                  title="Copy file path"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-git-added" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>

              {/* Compact Segmented View Mode Switcher */}
              <Tabs<'unified' | 'split'>
                tabs={[
                  {
                    id: 'unified',
                    icon: <AlignJustify className="w-3.5 h-3.5" />,
                    title: 'Unified Diff View',
                  },
                  {
                    id: 'split',
                    icon: <Columns className="w-3.5 h-3.5" />,
                    title: 'Split (Side-by-Side) Diff View',
                  },
                ]}
                activeTab={diffViewMode === 'split' ? 'split' : 'unified'}
                onChange={(mode) => setDiffViewMode(mode)}
                iconOnly
                size="sm"
                ariaLabel="Diff layout modes"
              />
            </div>

            {/* Diff Content Area with Full Vertical & Horizontal Scrolling */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-base-0 select-text">
              {isLoadingDiff ? (
                <div className="flex items-center justify-center h-full p-8 text-text-muted">
                  <Loader2 className="w-6 h-6 animate-spin text-commito-coral" />
                </div>
              ) : diff && diff.lines && diff.lines.length > 0 ? (
                diffViewMode === 'split' ? (
                  <SplitDiffView lines={diff.lines} />
                ) : (
                  <UnifiedDiffView lines={diff.lines} />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-text-muted select-none">
                  <FileText className="w-8 h-8 stroke-1 text-text-muted/40 mb-2" />
                  <span className="text-xs font-medium">The file is empty</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-text-muted select-none">
            <FileText className="w-8 h-8 stroke-1 text-text-muted/40 mb-2" />
            <span className="text-xs">Select a stashed file from the sidebar to view its diff</span>
          </div>
        )}
      </div>

      {/* Discard Confirmation Modal */}
      {isConfirmDiscardOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100 select-none">
          <div className="bg-base-0 border border-border-strong rounded-sm shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-100">
            <div className="p-4 flex items-start gap-3 border-b border-border bg-base-1/50">
              <div className="w-8 h-8 rounded-sm bg-git-removed-bg border border-git-removed/40 text-git-removed flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-text-primary">
                  Discard Stashed Changes?
                </h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Are you sure you want to permanently discard all stashed changes for branch{' '}
                  <strong className="text-text-primary">{currentBranchStash.branch}</strong>? This
                  action cannot be undone.
                </p>
              </div>
            </div>

            <div className="px-4 py-3 bg-base-0 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsConfirmDiscardOpen(false)}
                disabled={isDiscarding}
              >
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDiscard} isLoading={isDiscarding}>
                Discard Stash
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
