import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  GitBranch,
  ArrowUp,
  ArrowDown,
  Play,
  RefreshCw,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { RebaseCommitPlanItem, RebaseCommitAction, BranchInfo } from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { formatBranchDropdownOptions } from '../../shared/utils/branchUtils';
import { Dropdown } from '../common/Dropdown';

/**
 * Modal dialogue for executing interactive rebase plans with custom commit action ordering
 * (pick, reword, edit, squash, fixup, drop).
 */
export const RebaseModal: React.FC = () => {
  const {
    activeRepoPath,
    isRebaseModalOpen,
    setIsRebaseModalOpen,
    status,
    setError,
    setIsConflictResolverModalOpen,
  } = useGitStore();

  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [targetBranch, setTargetBranch] = useState('main');
  const [commitPlan, setCommitPlan] = useState<RebaseCommitPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isRebaseModalOpen || !activeRepoPath) return;

    GitService.listBranches(activeRepoPath)
      .then((res) => {
        setBranches(res || []);
        const defaultTarget = res?.find((b) => !b.is_current)?.name || 'main';
        setTargetBranch(defaultTarget);
        loadCommits(defaultTarget);
      })
      .catch(() => {});
  }, [isRebaseModalOpen, activeRepoPath]);

  const loadCommits = async (target: string) => {
    if (!activeRepoPath) return;
    setIsLoading(true);

    try {
      const commits = await invoke<RebaseCommitPlanItem[]>('get_rebase_commits_cmd', {
        repoPath: activeRepoPath,
        targetBranch: target,
      });
      setCommitPlan(commits || []);
    } catch {
      setCommitPlan([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionChange = (index: number, actionStr: string) => {
    const action = actionStr as RebaseCommitAction;
    setCommitPlan((prev) => prev.map((item, i) => (i === index ? { ...item, action } : item)));
  };

  const handleMoveCommit = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === commitPlan.length - 1) return;

    const newPlan = [...commitPlan];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const temp = newPlan[index];
    newPlan[index] = newPlan[targetIdx];
    newPlan[targetIdx] = temp;
    setCommitPlan(newPlan);
  };

  const handleExecuteRebase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !targetBranch) return;

    setIsSubmitting(true);
    try {
      await invoke('execute_rebase_cmd', {
        repoPath: activeRepoPath,
        target: targetBranch,
        plan: commitPlan,
      });

      useLogStore
        .getState()
        .addLog(
          'success',
          'Git',
          `Rebased ${status?.current_branch || 'current branch'} onto ${targetBranch}`
        );
      setIsRebaseModalOpen(false);
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err);
      setError(toAppError(err, 'REBASE_ERROR'));
      if (errorMsg.includes('conflict') || errorMsg.includes('Rebase failed')) {
        setIsRebaseModalOpen(false);
        setIsConflictResolverModalOpen(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isRebaseModalOpen) return null;

  const branchOptions = formatBranchDropdownOptions(branches.filter((b) => !b.is_current));

  const actionOptions = [
    { value: 'pick', label: 'pick (use commit)' },
    { value: 'reword', label: 'reword (use & edit msg)' },
    { value: 'edit', label: 'edit (stop for amend)' },
    { value: 'squash', label: 'squash (meld into prev)' },
    { value: 'fixup', label: 'fixup (meld & discard msg)' },
    { value: 'drop', label: 'drop (remove commit)' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-sm shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 border border-commito-coral/30">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-bold text-text-primary leading-none truncate">
                Interactive Rebase
              </h3>
              {status?.current_branch && (
                <>
                  <span className="text-border hidden sm:inline">•</span>
                  <span className="text-[11px] text-text-muted truncate hidden sm:inline font-mono">
                    {status.current_branch}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsRebaseModalOpen(false)}
            disabled={isSubmitting}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer disabled:opacity-50"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body */}
        <form
          id="rebase-form"
          onSubmit={handleExecuteRebase}
          className="flex-1 flex flex-col min-h-0 p-4 sm:p-5 space-y-4 overflow-hidden"
        >
          {/* Target Branch Selector */}
          <div className="flex items-center gap-3 p-3.5 bg-base-2 border border-border rounded-sm">
            <GitBranch className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-xs font-bold text-text-primary">Rebase onto Target:</span>
            <Dropdown
              options={branchOptions}
              value={targetBranch}
              onChange={(val) => {
                setTargetBranch(val);
                loadCommits(val);
              }}
              className="flex-1"
            />

            <button
              type="button"
              onClick={() => loadCommits(targetBranch)}
              disabled={isLoading}
              className="p-2 text-text-muted hover:text-text-primary bg-base-1 border border-border rounded-sm cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Commit Plan Drag/Reorder Table */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            <div className="flex items-center justify-between text-xs font-bold text-text-muted px-1 pb-1">
              <span>Commit Plan ({commitPlan.length} commits to process)</span>
              <span>Action per Commit</span>
            </div>

            {commitPlan.length === 0 ? (
              <div className="p-8 text-center bg-base-2 border border-border rounded-sm text-xs text-text-muted italic">
                Current branch is already up to date with {targetBranch}
              </div>
            ) : (
              commitPlan.map((item, index) => (
                <div
                  key={item.sha + index}
                  className="p-3 bg-base-2 border border-border rounded-sm flex items-center justify-between gap-3 hover:border-text-muted transition"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMoveCommit(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-text-muted hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveCommit(index, 'down')}
                        disabled={index === commitPlan.length - 1}
                        className="p-1 text-text-muted hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.2 bg-base-3 border border-border rounded font-mono text-[10px] text-text-muted">
                          {item.short_sha}
                        </span>
                        <h4 className="text-xs font-bold text-text-primary truncate">
                          {item.message}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <Dropdown
                    options={actionOptions}
                    value={item.action}
                    onChange={(val) => handleActionChange(index, val)}
                    size="sm"
                  />
                </div>
              ))
            )}
          </div>
        </form>

        {/* Pinned Bottom Footer Controls */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border bg-base-1 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setIsRebaseModalOpen(false)}
            disabled={isSubmitting}
            className="h-7.5 px-3.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer shadow-2xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="rebase-form"
            disabled={isSubmitting}
            className="h-7.5 px-4 rounded-sm text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs bg-commito-coral hover:bg-commito-coralLight text-white active:scale-98 disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isSubmitting ? 'Executing Plan...' : 'Execute Rebase Plan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
