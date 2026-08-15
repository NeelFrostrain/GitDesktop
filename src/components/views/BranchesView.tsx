import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  GitBranch, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Upload, 
  Check, 
  RefreshCw,
  GitPullRequest
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { BranchInfo, RepoStatus } from '../../types/git';

export const BranchesView: React.FC = () => {
  const { 
    activeRepoPath, 
    setStatus, 
    branches, 
    setBranches, 
    setError,
    setIsMergeRequestModalOpen 
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
      const res = await invoke<BranchInfo[]>('list_branches', { repoPath: activeRepoPath });
      setBranches(res || []);
    } catch (err: any) {
      setError({ code: 'BRANCH_ERROR', message: err.message || String(err) });
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
      await invoke('checkout_branch', { repoPath: activeRepoPath, branch: branchName });
      useLogStore.getState().addLog('success', 'Git', `Checked out branch '${branchName}'`);
      
      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
      loadBranches();
    } catch (err: any) {
      setError({ code: 'CHECKOUT_ERROR', message: err.message || String(err) });
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !newBranchName.trim()) return;

    try {
      await invoke('create_branch', { repoPath: activeRepoPath, branch: newBranchName.trim() });
      useLogStore.getState().addLog('success', 'Git', `Created branch '${newBranchName.trim()}' and checked out`);
      setNewBranchName('');
      setShowCreateModal(false);

      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
      loadBranches();
    } catch (err: any) {
      setError({ code: 'CREATE_BRANCH_ERROR', message: err.message || String(err) });
    }
  };

  const handleRenameBranch = async (oldName: string) => {
    if (!activeRepoPath || !renameValue.trim()) return;

    try {
      await invoke('rename_branch', { repoPath: activeRepoPath, oldName, newName: renameValue.trim() });
      useLogStore.getState().addLog('info', 'Git', `Renamed branch '${oldName}' to '${renameValue.trim()}'`);
      setEditingBranch(null);
      setRenameValue('');

      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
      loadBranches();
    } catch (err: any) {
      setError({ code: 'RENAME_BRANCH_ERROR', message: err.message || String(err) });
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    if (!activeRepoPath) return;

    if (!confirm(`Are you sure you want to delete branch '${branchName}'?`)) {
      return;
    }

    try {
      await invoke('delete_branch', { repoPath: activeRepoPath, branch: branchName, force: true });
      useLogStore.getState().addLog('info', 'Git', `Deleted branch '${branchName}'`);
      loadBranches();
    } catch (err: any) {
      setError({ code: 'DELETE_BRANCH_ERROR', message: err.message || String(err) });
    }
  };

  const handlePushBranch = async (branchName: string) => {
    if (!activeRepoPath) return;

    try {
      await invoke('push_branch', { repoPath: activeRepoPath, branch: branchName, setUpstream: true });
      useLogStore.getState().addLog('success', 'Git', `Pushed branch '${branchName}' to origin with upstream set`);
      loadBranches();
    } catch (err: any) {
      setError({ code: 'PUSH_BRANCH_ERROR', message: err.message || String(err) });
    }
  };

  const filtered = branches.filter((b) => b.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex-1 h-full bg-base-1 overflow-y-auto p-6 select-none space-y-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-text-primary">Branches</h2>
          <p className="text-xs text-text-muted">Manage local and remote tracking branches</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter branches..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-base-2 border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-commito-coral/50 font-sans"
            />
          </div>

          <button
            onClick={loadBranches}
            disabled={isLoading}
            className="p-2 bg-base-2 hover:bg-base-3 border border-border rounded-md text-text-muted hover:text-text-primary transition"
            title="Refresh branches"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralHover text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Branch</span>
          </button>
        </div>
      </div>

      {/* Create Branch Inline Drawer Modal */}
      {showCreateModal && (
        <form onSubmit={handleCreateBranch} className="p-4 bg-base-2 border border-border rounded-md space-y-3 shadow-md animate-in fade-in duration-100">
          <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-commito-coral" />
            <span>Create Branch from Current HEAD</span>
          </h3>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. feature/user-profile-v2"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-base-1 border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-commito-coral font-mono"
              autoFocus
              required
            />

            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-3 py-1.5 bg-base-3 text-text-secondary rounded-md text-xs font-semibold hover:bg-base-1 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!newBranchName.trim()}
              className="px-4 py-1.5 bg-commito-coral hover:bg-commito-coralHover text-white rounded-md text-xs font-bold transition shadow-sm"
            >
              Create & Checkout
            </button>
          </div>
        </form>
      )}

      {/* Branches List */}
      <div className="space-y-2 font-sans">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted italic border border-border rounded-md bg-base-2/40">
            No branches match your query
          </div>
        ) : (
          filtered.map((b) => {
            const isEditing = editingBranch === b.name;

            return (
              <div
                key={b.name}
                className={`p-3 rounded-md border flex items-center justify-between transition ${
                  b.is_current
                    ? 'bg-commito-activeBg border-commito-activeText/30 text-commito-activeText shadow-sm'
                    : 'bg-base-2/60 border-border hover:bg-base-2 text-text-primary'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                  <GitBranch className={`w-4 h-4 flex-shrink-0 ${b.is_current ? 'text-commito-coral' : 'text-text-muted'}`} />
                  
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="px-2 py-1 bg-base-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-commito-coral flex-1"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenameBranch(b.name)}
                        className="p-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded"
                        title="Save rename"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-xs font-bold truncate">{b.name}</span>
                      {b.is_current && (
                        <span className="px-2 py-0.5 bg-commito-coral/20 text-commito-coral border border-commito-coral/40 rounded text-[9px] font-mono font-bold uppercase flex-shrink-0">
                          Active
                        </span>
                      )}
                      {b.is_remote && (
                        <span className="px-1.5 py-0.2 bg-base-3 text-text-muted border border-border rounded text-[9px] font-mono flex-shrink-0">
                          remote
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handlePushBranch(b.name)}
                    className="p-1.5 text-text-muted hover:text-commito-coral bg-base-3 hover:bg-base-1 border border-border rounded-md transition"
                    title="Push branch to origin"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setIsMergeRequestModalOpen(true)}
                    className="p-1.5 text-text-muted hover:text-github-dark-accent bg-base-3 hover:bg-base-1 border border-border rounded-md transition"
                    title="Create Merge / Pull Request"
                  >
                    <GitPullRequest className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      setEditingBranch(b.name);
                      setRenameValue(b.name);
                    }}
                    className="p-1.5 text-text-muted hover:text-text-primary bg-base-3 hover:bg-base-1 border border-border rounded-md transition"
                    title="Rename branch"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {!b.is_current && (
                    <>
                      <button
                        onClick={() => handleCheckout(b.name)}
                        className="px-2.5 py-1 bg-base-3 hover:bg-base-0 border border-border rounded-md text-xs font-semibold text-text-secondary transition"
                      >
                        Checkout
                      </button>

                      <button
                        onClick={() => handleDeleteBranch(b.name)}
                        className="p-1.5 text-text-muted hover:text-red-400 bg-base-3 hover:bg-base-1 border border-border rounded-md transition"
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
