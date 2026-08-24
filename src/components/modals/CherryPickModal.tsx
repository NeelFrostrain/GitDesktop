import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  GitCommit,
  GitBranch,
  Play,
  Search,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { CommitInfo, BranchInfo } from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
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
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-base-0 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-git-added-bg border border-git-added/40 text-git-added flex items-center justify-center">
              <GitCommit className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary leading-tight">
                Cherry-Pick Commits
              </h2>
              <p className="text-[11px] text-text-muted">
                Select one or more commits from another branch to apply onto current branch
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCherryPickModalOpen(false)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleExecuteCherryPick} className="flex-1 flex flex-col min-h-0 p-5 space-y-4">
          {/* Branch Selector & Search */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-base-2 border border-border rounded-md">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-commito-coral flex-shrink-0" />
              <Dropdown
                options={branches.map((b) => ({ value: b.name, label: b.name }))}
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
                className="w-full pl-8 pr-3 py-1.5 bg-base-1 border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-commito-coral"
              />
            </div>
          </div>

          {/* Options row */}
          <div className="flex items-center justify-between text-xs text-text-muted px-1">
            <Checkbox
              checked={noCommit}
              onChange={setNoCommit}
              label="Stage changes without auto-committing (-n / --no-commit)"
            />
            <span className="font-mono text-[11px]">{selectedShas.length} selected</span>
          </div>

          {/* Commits List */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
            {filteredCommits.length === 0 ? (
              <div className="p-8 text-center bg-base-2 border border-border rounded-md text-xs text-text-muted italic">
                No commits found in branch {sourceBranch}
              </div>
            ) : (
              filteredCommits.map((c) => {
                const isSelected = selectedShas.includes(c.sha);

                return (
                  <div
                    key={c.sha}
                    onClick={() => toggleSelectCommit(c.sha)}
                    className={`p-3 rounded-md border flex items-center justify-between cursor-pointer transition ${
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

          {/* Modal Footer Controls */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsCherryPickModalOpen(false)}
              className="px-4 py-2 bg-base-2 hover:bg-base-3 border border-border rounded-md text-xs font-semibold text-text-secondary transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedShas.length === 0 || isSubmitting}
              className={`px-5 py-2 bg-commito-coral hover:bg-commito-coralLight text-white rounded-md text-xs font-bold flex items-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isSubmitting ? 'Cherry-picking...' : `Cherry-pick ${selectedShas.length} Commit(s)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
