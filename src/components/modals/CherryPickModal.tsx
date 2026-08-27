import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  GitCommit,
  GitBranch,
  Play,
  Search,
  Loader2,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { CommitInfo, BranchInfo } from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { formatBranchDropdownOptions } from '../../shared/utils/branchUtils';
import { Checkbox } from '../common/Checkbox';
import { Dropdown } from '../common/Dropdown';

/**
 * Modal dialogue for cherry-picking specific commits from any branch onto the current HEAD.
 */
export const CherryPickModal: React.FC = () => {
  const {
    activeRepoPath,
    isCherryPickModalOpen,
    setIsCherryPickModalOpen,
    setError,
    setIsConflictResolverModalOpen,
  } = useGitStore();

  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [sourceBranch, setSourceBranch] = useState('main');
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedShas, setSelectedShas] = useState<string[]>([]);
  const [noCommit, setNoCommit] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isCherryPickModalOpen || !activeRepoPath) return;

    GitService.listBranches(activeRepoPath)
      .then((res) => {
        setBranches(res || []);
        const defaultBranch = res?.find((b) => !b.is_current)?.name || 'main';
        setSourceBranch(defaultBranch);
        loadBranchCommits();
      })
      .catch(() => {});
  }, [isCherryPickModalOpen, activeRepoPath]);

  const loadBranchCommits = async () => {
    if (!activeRepoPath) return;

    try {
      const res = await GitService.getCommitHistory(activeRepoPath, 50, 0);
      setCommits(res || []);
    } catch {
      setCommits([]);
    }
  };

  const toggleSelectCommit = (sha: string) => {
    if (selectedShas.includes(sha)) {
      setSelectedShas(selectedShas.filter((s) => s !== sha));
    } else {
      setSelectedShas([...selectedShas, sha]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedShas.length === filteredCommits.length) {
      setSelectedShas([]);
    } else {
      setSelectedShas(filteredCommits.map((c) => c.sha));
    }
  };

  const handleExecuteCherryPick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || selectedShas.length === 0) return;

    setIsSubmitting(true);
    try {
      await invoke('cherry_pick_commits_cmd', {
        repoPath: activeRepoPath,
        shas: selectedShas,
        noCommit,
      });

      useLogStore.getState().addLog('success', 'Git', `Cherry-picked ${selectedShas.length} commit(s)`);
      setIsCherryPickModalOpen(false);
      setSelectedShas([]);
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err);
      setError(toAppError(err, 'CHERRY_PICK_ERROR'));
      if (errorMsg.includes('conflict') || errorMsg.includes('Cherry-pick failed')) {
        setIsCherryPickModalOpen(false);
        setIsConflictResolverModalOpen(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCommits = commits.filter(
    (c) =>
      c.message.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.short_sha.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.author_name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (!isCherryPickModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-sm shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 border border-commito-coral/30">
              <GitCommit className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-bold text-text-primary leading-none truncate">
                Cherry-Pick Commits
              </h3>
              {sourceBranch && (
                <>
                  <span className="text-border hidden sm:inline">•</span>
                  <span className="text-[11px] text-text-muted truncate hidden sm:inline font-mono">
                    from {sourceBranch}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCherryPickModalOpen(false)}
            disabled={isSubmitting}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer disabled:opacity-50"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body */}
        <form id="cherry-pick-form" onSubmit={handleExecuteCherryPick} className="flex-1 flex flex-col min-h-0 p-4 sm:p-5 space-y-4 overflow-hidden">
          {/* Branch Selector & Search */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-base-2 border border-border rounded-sm">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-commito-coral flex-shrink-0" />
              <Dropdown
                options={formatBranchDropdownOptions(branches)}
                value={sourceBranch}
                onChange={(val) => {
                  setSourceBranch(val);
                  loadBranchCommits();
                }}
                className="flex-1 font-mono"
              />
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search commits by message..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-base-1 border border-border rounded-sm text-xs text-text-primary focus:outline-none focus:border-commito-coral"
              />
            </div>
          </div>

          {/* Commit List Selection Area */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            <div className="flex items-center justify-between text-xs font-bold text-text-muted px-1 pb-1">
              <span>Select Commits ({selectedShas.length} of {commits.length} chosen)</span>
              {commits.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-commito-coral hover:text-commito-coralLight text-xs cursor-pointer font-semibold"
                >
                  {selectedShas.length === commits.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {filteredCommits.length === 0 ? (
              <div className="p-8 text-center bg-base-2 border border-border rounded-sm text-xs text-text-muted italic">
                {commits.length === 0 ? 'No cherry-pickable commits found on this branch' : 'No commits matched your search'}
              </div>
            ) : (
              filteredCommits.map((c) => {
                const isSelected = selectedShas.includes(c.sha);

                return (
                  <div
                    key={c.sha}
                    onClick={() => toggleSelectCommit(c.sha)}
                    className={`p-3 rounded-sm border flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? 'bg-commito-activeBg border-commito-activeText/30 text-commito-activeText shadow-xs'
                        : 'bg-base-2/60 border-border hover:bg-base-2 text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleSelectCommit(c.sha)}
                      />

                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.2 bg-base-3 border border-border rounded font-mono text-[10px] text-text-muted flex-shrink-0">
                            {c.short_sha}
                          </span>
                          <h4 className="text-xs font-bold truncate">{c.message}</h4>
                        </div>
                        <div className="text-[11px] text-text-muted font-mono mt-0.5">
                          {c.author_name} • {c.relative_date}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-border">
            <Checkbox
              checked={noCommit}
              onChange={setNoCommit}
              label="Stage changes without auto-committing (-n / --no-commit)"
            />
          </div>
        </form>

        {/* Pinned Bottom Footer Controls */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border bg-base-1 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setIsCherryPickModalOpen(false)}
            disabled={isSubmitting}
            className="h-7.5 px-3.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer shadow-2xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="cherry-pick-form"
            disabled={selectedShas.length === 0 || isSubmitting}
            className="h-7.5 px-4 rounded-sm text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs bg-commito-coral hover:bg-commito-coralLight text-white active:scale-98 disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isSubmitting ? 'Cherry-picking...' : `Cherry-pick ${selectedShas.length} Commit(s)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
