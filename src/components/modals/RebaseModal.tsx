import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  X, 
  GitBranch, 
  ArrowUp, 
  ArrowDown, 
  Play, 
  RefreshCw,
  RotateCcw
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';

import { useLogStore } from '../../store/useLogStore';
import { RebaseCommitPlanItem, RebaseCommitAction, BranchInfo } from '../../types/git';
import { Dropdown } from '../common/Dropdown';

export const RebaseModal: React.FC = () => {
  const {
    activeRepoPath,
    isRebaseModalOpen,
    setIsRebaseModalOpen,
    status,
    setError,
    setIsConflictResolverModalOpen
  } = useGitStore();

  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [targetBranch, setTargetBranch] = useState('main');
  const [commitPlan, setCommitPlan] = useState<RebaseCommitPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isRebaseModalOpen || !activeRepoPath) return;

    invoke<BranchInfo[]>('list_branches', { repoPath: activeRepoPath })
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
    setCommitPlan((prev) =>
      prev.map((item, i) => (i === index ? { ...item, action } : item))
    );
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

      useLogStore.getState().addLog('success', 'Git', `Rebased ${status?.current_branch || 'current branch'} onto ${targetBranch}`);
      setIsRebaseModalOpen(false);
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      setError({ code: 'REBASE_ERROR', message: errorMsg });
      if (errorMsg.includes('conflict') || errorMsg.includes('Rebase failed')) {
        setIsRebaseModalOpen(false);
        setIsConflictResolverModalOpen(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isRebaseModalOpen) return null;

  const branchOptions = branches
    .filter((b) => !b.is_current)
    .map((b) => ({ value: b.name, label: b.name }));

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
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-base-0 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-commito-coral/20 border border-commito-coral/40 text-commito-coral flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary leading-tight">
                Interactive Rebase Studio
              </h2>
              <p className="text-[11px] text-text-muted">
                Rebase <span className="font-mono text-commito-coral font-bold">{status?.current_branch || 'current branch'}</span> onto target branch with commit re-ordering
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsRebaseModalOpen(false)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-base-2 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleExecuteRebase} className="flex-1 flex flex-col min-h-0 p-5 space-y-4">
          {/* Target Branch Selector */}
          <div className="flex items-center gap-3 p-3.5 bg-base-2 border border-border rounded-md">
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
              className="p-2 text-text-muted hover:text-text-primary bg-base-1 border border-border rounded-md"
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
              <div className="p-8 text-center bg-base-2 border border-border rounded-md text-xs text-text-muted italic">
                Current branch is already up to date with {targetBranch}
              </div>
            ) : (
              commitPlan.map((item, index) => (
                <div
                  key={item.sha + index}
                  className="p-3 bg-base-2 border border-border rounded-md flex items-center justify-between gap-3 hover:border-text-muted transition"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMoveCommit(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-text-muted hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveCommit(index, 'down')}
                        disabled={index === commitPlan.length - 1}
                        className="p-1 text-text-muted hover:text-white disabled:opacity-30"
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


          {/* Modal Footer Controls */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsRebaseModalOpen(false)}
              className="px-4 py-2 bg-base-2 hover:bg-base-3 border border-border rounded-md text-xs font-semibold text-text-secondary transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-commito-coral hover:bg-commito-coralHover text-white rounded-md text-xs font-bold flex items-center gap-2 transition shadow-sm cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isSubmitting ? 'Rebasing...' : 'Execute Rebase Plan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
