import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Search,
  Plus,
  Edit3,
  Trash2,
  Upload,
  Check,
  RefreshCw,
  GitPullRequest,
  X,
  Globe,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';
import { Button } from '../common/Button';

/**
 * Main view for inspecting, filtering, switching, creating, renaming, pushing, and deleting repository branches.
 */
export const BranchesView: React.FC = () => {
  const {
    activeRepoPath,
    setStatus,
    branches,
    setBranches,
    setError,
    setIsMergeRequestModalOpen,
  } = useGitStore();

  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadBranches = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);

    try {
      const res = await GitService.listBranches(activeRepoPath);
      setBranches(res || []);
    } catch (error: unknown) {
      setError(toAppError(error, 'BRANCH_ERROR'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, [activeRepoPath]);

  const handleCheckout = async (branchName: string) => {
    if (!activeRepoPath) return;

    try {
      await GitService.checkoutBranch(activeRepoPath, branchName);
      useLogStore.getState().addLog('success', 'Git', `Checked out branch '${branchName}'`);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      loadBranches();
    } catch (error: unknown) {
      setError(toAppError(error, 'CHECKOUT_ERROR'));
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !newBranchName.trim()) return;

    try {
      await GitService.createBranch(activeRepoPath, newBranchName.trim());
      useLogStore.getState().addLog('success', 'Git', `Created branch '${newBranchName.trim()}' and checked out`);
      setNewBranchName('');
      setShowCreateModal(false);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      loadBranches();
    } catch (error: unknown) {
      setError(toAppError(error, 'CREATE_BRANCH_ERROR'));
    }
  };

  const handleRenameBranch = async (oldName: string) => {
    if (!activeRepoPath || !renameValue.trim()) return;

    try {
      await GitService.renameBranch(activeRepoPath, oldName, renameValue.trim());
      useLogStore.getState().addLog('info', 'Git', `Renamed branch '${oldName}' to '${renameValue.trim()}'`);
      setEditingBranch(null);
      setRenameValue('');

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      loadBranches();
    } catch (error: unknown) {
      setError(toAppError(error, 'RENAME_BRANCH_ERROR'));
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    if (!activeRepoPath) return;

    if (!confirm(`Are you sure you want to delete branch '${branchName}'?`)) {
      return;
    }

    try {
      await GitService.deleteBranch(activeRepoPath, branchName, true);
      useLogStore.getState().addLog('info', 'Git', `Deleted branch '${branchName}'`);
      loadBranches();
    } catch (error: unknown) {
      setError(toAppError(error, 'DELETE_BRANCH_ERROR'));
    }
  };

  const handlePushBranch = async (branchName: string) => {
    if (!activeRepoPath) return;

    try {
      await GitService.pushBranch(activeRepoPath, branchName, true);
      useLogStore.getState().addLog('success', 'Git', `Pushed branch '${branchName}' to origin with upstream set`);
      loadBranches();
    } catch (error: unknown) {
      setError(toAppError(error, 'PUSH_BRANCH_ERROR'));
    }
  };

  const filtered = branches.filter((b) => b.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex-1 h-full bg-base-1 overflow-y-auto p-6 select-none space-y-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-text-primary tracking-tight">Branches</h2>
            <span className="px-1.5 py-0.2 bg-base-2 text-text-muted text-[10.5px] font-mono font-medium rounded-sm border border-border/70">
              {branches.length}
            </span>
          </div>
          <p className="text-xs text-text-muted">Manage local and remote tracking branches</p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter branches..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-base-2/80 hover:bg-base-2 focus:bg-base-2 border border-border/70 hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none font-sans transition-all shadow-xs"
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter('')}
                className="absolute right-2 top-2 text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={loadBranches}
            disabled={isLoading}
            className="p-1.5 bg-base-2 hover:bg-base-3 border border-border/70 rounded-sm text-text-muted hover:text-text-primary transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh branches"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-commito-coral' : ''}`} />
          </button>

          <Button
            type="button"
            variant="coral"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            New Branch
          </Button>
        </div>
      </div>

      {/* Create Branch Inline Drawer Modal */}
      {showCreateModal && (
        <form
          onSubmit={handleCreateBranch}
          className="p-4 bg-base-2 border border-border/80 rounded-sm space-y-3 shadow-md animate-in fade-in duration-100 ring-1 ring-black/20"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-text-primary">Create New Branch</h3>
              <p className="text-[11px] text-text-muted">
                Branch will be created from HEAD ({branches.find((b) => b.is_current)?.name || 'active branch'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. feature/awesome-thing"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-base-1 border border-border/80 hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text-primary focus:outline-none font-mono shadow-inner"
              autoFocus
              required
            />

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="coral"
              size="sm"
              disabled={!newBranchName.trim()}
            >
              Create & Checkout
            </Button>
          </div>
        </form>
      )}

      {/* Branches List */}
      <div className="space-y-1.5 font-sans">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted italic border border-border/70 rounded-sm bg-base-2/40">
            No branches match your query
          </div>
        ) : (
          filtered.map((b) => {
            const isEditing = editingBranch === b.name;

            return (
              <div
                key={b.name}
                className={`p-2.5 rounded-sm border flex items-center justify-between transition-all duration-150 ${
                  b.is_current
                    ? 'bg-base-2 border-border-strong text-text-primary shadow-xs'
                    : 'bg-base-2/60 border-border/60 hover:bg-base-2 hover:border-border-strong text-text-primary shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-4">
                  <div
                    className={`w-6 h-6 rounded-sm flex items-center justify-center shrink-0 ${
                      b.is_current
                        ? 'bg-commito-coral/20 text-commito-coral'
                        : b.is_remote
                        ? 'bg-gitlab-blue/10 text-gitlab-blue'
                        : 'bg-base-1 text-text-muted'
                    }`}
                  >
                    {b.is_remote ? <Globe className="w-3.5 h-3.5" /> : <GitBranch className="w-3.5 h-3.5" />}
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="px-2 py-1 bg-base-1 border border-border/80 hover:border-border-strong rounded text-xs font-mono text-text-primary focus:outline-none focus:border-border-strong flex-1"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleRenameBranch(b.name)}
                        className="p-1 bg-git-added text-text-on-accent rounded cursor-pointer"
                        title="Save rename"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`font-mono text-xs truncate ${
                          b.is_current ? 'font-bold text-commito-coral' : 'font-semibold text-text'
                        }`}
                      >
                        {b.name}
                      </span>
                      {b.is_current && (
                        <span className="px-1.5 py-0.5 bg-commito-coral text-white rounded-xs text-[9px] font-mono font-extrabold uppercase tracking-wider leading-none shadow-2xs shrink-0 select-none">
                          CURRENT
                        </span>
                      )}
                      {b.is_remote && (
                        <span className="px-1.5 py-0.2 bg-gitlab-blue/15 text-gitlab-blue border border-gitlab-blue/30 rounded-xs text-[9px] font-mono font-medium shrink-0">
                          remote
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePushBranch(b.name)}
                    className="p-1.5 text-text-muted hover:text-commito-coral bg-base-1 hover:bg-base-3 border border-border/60 rounded-sm transition cursor-pointer shadow-xs"
                    title="Push branch to origin"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMergeRequestModalOpen(true)}
                    className="p-1.5 text-text-muted hover:text-emerald-400 bg-base-1 hover:bg-base-3 border border-border/60 rounded-sm transition cursor-pointer shadow-xs"
                    title="Create Merge / Pull Request"
                  >
                    <GitPullRequest className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingBranch(b.name);
                      setRenameValue(b.name);
                    }}
                    className="p-1.5 text-text-muted hover:text-text-primary bg-base-1 hover:bg-base-3 border border-border/60 rounded-sm transition cursor-pointer shadow-xs"
                    title="Rename branch"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {!b.is_current && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCheckout(b.name)}
                        className="px-2.5 py-1 bg-base-1 hover:bg-base-3 border border-border/60 rounded-sm text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer shadow-xs"
                      >
                        Checkout
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBranch(b.name)}
                        className="p-1.5 text-text-muted hover:text-git-removed bg-base-1 hover:bg-git-removed-bg border border-border/60 rounded-sm transition cursor-pointer shadow-xs"
                        title="Delete branch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
