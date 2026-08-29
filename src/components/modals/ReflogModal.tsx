import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, RotateCcw, RefreshCw, History } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { ReflogEntry } from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';

/**
 * Modal dialogue for reviewing the repository's HEAD reflog entries and executing safe recovery resets.
 */
export const ReflogModal: React.FC = () => {
  const { activeRepoPath, isReflogModalOpen, setIsReflogModalOpen, setStatus, setError } =
    useGitStore();

  const [reflogEntries, setReflogEntries] = useState<ReflogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReflog = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);

    try {
      const res = await GitService.listReflog(activeRepoPath, 50);
      setReflogEntries(res || []);
    } catch {
      setReflogEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isReflogModalOpen || !activeRepoPath) return;
    loadReflog();
  }, [isReflogModalOpen, activeRepoPath]);

  const handleRestoreTarget = async (sha: string) => {
    if (!activeRepoPath) return;

    if (
      !confirm(
        `CAUTION: Restore branch HEAD to ${sha.slice(0, 7)}? This will execute git reset --hard.`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      await invoke('restore_reflog_target_cmd', { repoPath: activeRepoPath, sha, force: true });
      useLogStore
        .getState()
        .addLog('success', 'Git', `Restored branch HEAD to ${sha.slice(0, 7)} via Reflog`);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      setIsReflogModalOpen(false);
    } catch (error: unknown) {
      setError(toAppError(error, 'REFLOG_RESTORE_ERROR'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isReflogModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans animate-in fade-in duration-100">
      <div className="bg-base-0 border border-border-strong rounded-sm shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 border border-commito-coral/30">
              <History className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-bold text-text-primary leading-none truncate">
                Git Reflog Timeline
              </h3>
              <span className="text-border hidden sm:inline">•</span>
              <span className="text-[11px] text-text-muted truncate hidden sm:inline font-mono">
                Safety Net & Recovery
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadReflog}
              disabled={isLoading}
              className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsReflogModalOpen(false)}
              className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Reflog Timeline List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 bg-base-0">
          {isLoading ? (
            <div className="p-12 text-center text-text-muted italic flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-commito-coral" />
              <span>Loading reflog timeline...</span>
            </div>
          ) : reflogEntries.length === 0 ? (
            <div className="p-12 text-center text-text-muted italic bg-base-1 border border-border rounded-sm">
              No reflog entries recorded
            </div>
          ) : (
            reflogEntries.map((entry) => (
              <div
                key={entry.index + entry.sha}
                className="p-3 bg-base-1 border border-border hover:border-border-strong rounded-sm flex items-center justify-between hover:bg-base-2/70 transition shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                  <span className="px-2 py-0.5 bg-base-2 border border-border rounded font-mono text-[10px] text-commito-coral font-bold flex-shrink-0">
                    HEAD@{`{${entry.index}}`}
                  </span>

                  <div className="min-w-0 truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-text-primary">
                        {entry.sha.slice(0, 7)}
                      </span>
                      <h4 className="text-xs font-bold truncate text-text-primary">
                        {entry.message}
                      </h4>
                    </div>
                    <div className="text-[11px] text-text-muted font-mono mt-0.5">
                      action: {entry.action} • {entry.date}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestoreTarget(entry.sha)}
                  disabled={isSubmitting}
                  className="h-7 px-3 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition shadow-xs flex-shrink-0 cursor-pointer disabled:opacity-50 active:scale-98"
                  title={`Restore HEAD to ${entry.sha.slice(0, 7)}`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restore</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-4 py-2.5 border-t border-border bg-base-1 shrink-0 font-sans select-none">
          <button
            type="button"
            onClick={() => setIsReflogModalOpen(false)}
            className="h-7.5 px-3.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
