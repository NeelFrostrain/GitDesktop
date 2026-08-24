import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  RotateCcw,
  RefreshCw,
  History,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { ReflogEntry } from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';

/**
 * Modal dialogue for reviewing the repository's HEAD reflog entries and executing safe recovery resets.
 */
export const ReflogModal: React.FC = () => {
  const {
    activeRepoPath,
    isReflogModalOpen,
    setIsReflogModalOpen,
    setStatus,
    setError,
  } = useGitStore();

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

    if (!confirm(`CAUTION: Restore branch HEAD to ${sha.slice(0, 7)}? This will execute git reset --hard.`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await invoke('restore_reflog_target_cmd', { repoPath: activeRepoPath, sha, force: true });
      useLogStore.getState().addLog('success', 'Git', `Restored branch HEAD to ${sha.slice(0, 7)} via Reflog`);

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
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-sm shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-base-0 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-git-added-bg border border-git-added/40 text-git-added flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary leading-tight">
                Git Reflog Safety Net & Recovery
              </h2>
              <p className="text-[11px] text-text-muted">
                Inspect reference log timeline and restore branch to any past commit state
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsReflogModalOpen(false)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-sm hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reflog Timeline List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {isLoading ? (
            <div className="p-12 text-center text-text-muted italic flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading reflog timeline...</span>
            </div>
          ) : reflogEntries.length === 0 ? (
            <div className="p-12 text-center text-text-muted italic">
              No reflog entries recorded
            </div>
          ) : (
            reflogEntries.map((entry) => (
              <div
                key={entry.index + entry.sha}
                className="p-3.5 bg-base-2 border border-border rounded-sm flex items-center justify-between hover:border-text-muted transition"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                  <span className="px-2 py-0.5 bg-base-3 border border-border rounded font-mono text-[10px] text-commito-coral font-bold flex-shrink-0">
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
                  onClick={() => handleRestoreTarget(entry.sha)}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition shadow-xs flex-shrink-0 cursor-pointer disabled:opacity-50"
                  title={`Restore HEAD to ${entry.sha.slice(0, 7)}`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
