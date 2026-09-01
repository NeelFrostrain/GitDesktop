import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  RefreshCw,
  FolderGit2,
  Plus,
  Search,
  ExternalLink,
  FolderOpen,
  Trash2,
  Copy,
  Check,
  GitBranch,
  GitCommit,
  Download,
  Folder,
  Globe,
  X,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useRepoStore } from '../../store/repoStore';
import { useLogStore } from '../../store/useLogStore';
import { useToastStore } from '../../store/useToastStore';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';
import { SubmoduleInfo } from '../../types/git';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Button } from '../common/Button';
import { openUrl } from '@tauri-apps/plugin-opener';

type SubmoduleFilterTab = 'all' | 'active' | 'modified' | 'uninitialized';

/**
 * Modern Dark Obsidian View for inspecting, initializing, updating, syncing, and managing Git submodules (.gitmodules).
 */
export const SubmodulesView: React.FC = () => {
  const {
    activeRepoPath,
    submodules,
    setSubmodules,
    setError,
    setStatus,
    setIsAddSubmoduleModalOpen,
  } = useGitStore();
  const { openRepo } = useRepoStore();
  const { showToast } = useToastStore();

  const [isLoading, setIsLoading] = useState(false);
  const [filterTab, setFilterTab] = useState<SubmoduleFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Per-item action loading states
  const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, boolean>>({});
  const [deletingSubmodule, setDeletingSubmodule] = useState<SubmoduleInfo | null>(null);

  const loadSubmodules = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);

    try {
      const res = await GitService.listSubmodules(activeRepoPath);
      setSubmodules(res || []);
    } catch {
      setSubmodules([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmodules();
  }, [activeRepoPath]);

  const handleInitSubmodules = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);

    try {
      await GitService.initSubmodules(activeRepoPath);
      useLogStore.getState().addLog('success', 'Git', 'Initialized repository submodules');
      showToast({
        type: 'success',
        title: 'Submodules Initialized',
        message: 'All registered submodules have been initialized.',
      });
      await loadSubmodules();
    } catch (error: unknown) {
      setError(toAppError(error, 'SUBMODULE_ERROR'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSubmodules = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);

    try {
      await GitService.updateSubmodules(activeRepoPath);
      useLogStore.getState().addLog('success', 'Git', 'Updated submodules recursively');
      showToast({
        type: 'success',
        title: 'Submodules Updated',
        message: 'All submodules updated recursively.',
      });
      await loadSubmodules();
    } catch (error: unknown) {
      setError(toAppError(error, 'SUBMODULE_ERROR'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncSubmodules = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);

    try {
      await GitService.syncSubmodules(activeRepoPath);
      useLogStore.getState().addLog('success', 'Git', 'Synced submodule remote URLs');
      showToast({
        type: 'success',
        title: 'Submodules Synced',
        message: 'Submodule remote URLs synced with .gitmodules.',
      });
      await loadSubmodules();
    } catch (error: unknown) {
      setError(toAppError(error, 'SUBMODULE_ERROR'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSubmoduleRepo = async (sub: SubmoduleInfo) => {
    if (!activeRepoPath) return;
    const norm = activeRepoPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const cleanSubPath = sub.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const fullPath = `${norm}/${cleanSubPath}`;

    try {
      await openRepo(fullPath);
      showToast({
        type: 'success',
        title: 'Opened Submodule',
        message: `Switched active repository to '${sub.name}'.`,
      });
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Cannot Open Submodule',
        message: String(err),
      });
    }
  };

  const handleUpdateSingle = async (sub: SubmoduleInfo, remote: boolean) => {
    if (!activeRepoPath) return;
    setActionLoadingMap((prev) => ({ ...prev, [sub.path]: true }));

    try {
      await GitService.updateSingleSubmodule(activeRepoPath, sub.path, remote);
      useLogStore
        .getState()
        .addLog('success', 'Git', `Updated submodule '${sub.name}'${remote ? ' from remote' : ''}`);
      showToast({
        type: 'success',
        title: 'Submodule Updated',
        message: `Submodule '${sub.name}' updated successfully.`,
      });
      await loadSubmodules();
      try {
        const newStatus = await GitService.getRepoStatus(activeRepoPath);
        setStatus(newStatus);
      } catch {}
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: String(err),
      });
    } finally {
      setActionLoadingMap((prev) => ({ ...prev, [sub.path]: false }));
    }
  };

  const handleConfirmDelete = async () => {
    if (!activeRepoPath || !deletingSubmodule) return;
    const sub = deletingSubmodule;
    setDeletingSubmodule(null);
    setIsLoading(true);

    try {
      await GitService.removeSubmodule(activeRepoPath, sub.path);
      useLogStore
        .getState()
        .addLog('success', 'Git', `Removed submodule '${sub.name}' from ${sub.path}`);
      showToast({
        type: 'success',
        title: 'Submodule Removed',
        message: `Submodule '${sub.name}' removed from repository.`,
      });
      await loadSubmodules();
      try {
        const newStatus = await GitService.getRepoStatus(activeRepoPath);
        setStatus(newStatus);
      } catch {}
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Failed to Remove',
        message: String(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenRemoteUrl = async (rawUrl: string) => {
    if (!rawUrl) return;
    let target = rawUrl;
    if (target.startsWith('git@')) {
      target = target.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');
    }
    try {
      await openUrl(target);
    } catch {
      window.open(target, '_blank');
    }
  };

  const handleCopy = (text: string, key: string, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast({
      type: 'info',
      title: label,
      message: text,
    });
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Status counts
  const activeCount = useMemo(() => submodules.filter((s) => s.is_initialized).length, [submodules]);
  const dirtyCount = useMemo(() => submodules.filter((s) => s.is_dirty).length, [submodules]);
  const uninitCount = useMemo(() => submodules.filter((s) => !s.is_initialized).length, [submodules]);

  const filteredSubmodules = useMemo(() => {
    return submodules.filter((s) => {
      // Tab filter
      if (filterTab === 'active' && !s.is_initialized) return false;
      if (filterTab === 'modified' && !s.is_dirty) return false;
      if (filterTab === 'uninitialized' && s.is_initialized) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.path.toLowerCase().includes(q) ||
          s.url.toLowerCase().includes(q) ||
          s.head_sha.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [submodules, filterTab, searchQuery]);

  return (
    <div className="flex-1 h-full bg-base-0 overflow-y-auto p-4 select-none space-y-4 font-sans animate-in fade-in duration-100">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Boxes className="w-4 h-4 text-gitlab-teal" />
            <span>Git Submodules</span>
            <span className="px-1.5 py-0.2 bg-base-1 border border-border rounded-xs text-[10px] font-mono text-text-muted">
              {submodules.length} {submodules.length === 1 ? 'submodule' : 'submodules'}
            </span>
          </h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            Manage nested Git repositories (.gitmodules), track pinned commit revisions, and synchronize remotes
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={loadSubmodules}
            disabled={isLoading}
            title="Refresh submodules status"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <Button
            type="button"
            variant="coral"
            size="sm"
            onClick={() => setIsAddSubmoduleModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Submodule
          </Button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, path, URL, or commit SHA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-7 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text-primary focus:outline-none transition shadow-2xs placeholder:text-text-faint"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Bulk Operations */}
          {submodules.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleInitSubmodules}
                disabled={isLoading}
                title="Initialize registered submodules"
              >
                Init All
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSyncSubmodules}
                disabled={isLoading}
                title="Synchronize remote URLs with .gitmodules"
              >
                Sync Remotes
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleUpdateSubmodules}
                disabled={isLoading}
                title="Recursively update and fetch submodule commits"
              >
                Update Recursive
              </Button>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="h-8 flex items-center bg-base-1 p-0.5 border border-border rounded-sm box-border">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`h-full px-2.5 rounded-xs text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-base-2 text-text-primary border border-border shadow-2xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>All ({submodules.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('active')}
              className={`h-full px-2.5 rounded-xs text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                filterTab === 'active'
                  ? 'bg-git-added-bg text-git-added border border-git-added/30 shadow-2xs'
                  : 'text-text-muted hover:text-git-added'
              }`}
            >
              <span>Active ({activeCount})</span>
            </button>

            {dirtyCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterTab('modified')}
                className={`h-full px-2.5 rounded-xs text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  filterTab === 'modified'
                    ? 'bg-git-modified-bg text-git-modified border border-git-modified/30 shadow-2xs'
                    : 'text-text-muted hover:text-git-modified'
                }`}
              >
                <span>Modified ({dirtyCount})</span>
              </button>
            )}

            {uninitCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterTab('uninitialized')}
                className={`h-full px-2.5 rounded-xs text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  filterTab === 'uninitialized'
                    ? 'bg-base-2 text-text-muted border border-border shadow-2xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <span>Uninit ({uninitCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Submodule Cards List */}
      <div className="space-y-2.5">
        {filteredSubmodules.length === 0 ? (
          <div className="p-12 text-center bg-base-1/50 border border-border rounded-sm space-y-3">
            <Boxes className="w-10 h-10 text-text-muted/40 mx-auto" />
            <div className="space-y-1">
              <p className="font-semibold text-xs text-text-primary">
                {searchQuery.trim() || filterTab !== 'all'
                  ? 'No submodules match your filter criteria'
                  : 'No Git submodules configured in this repository'}
              </p>
              <p className="text-[11px] text-text-muted max-w-md mx-auto">
                {searchQuery.trim() || filterTab !== 'all'
                  ? 'Try changing or clearing your search term and filter tab.'
                  : 'Submodules allow you to keep another Git repository as a subdirectory of your repository while keeping your commits separate.'}
              </p>
            </div>
            {!searchQuery.trim() && filterTab === 'all' && (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="coral"
                  size="sm"
                  onClick={() => setIsAddSubmoduleModalOpen(true)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add your first submodule
                </Button>
              </div>
            )}
          </div>
        ) : (
          filteredSubmodules.map((sub) => {
            const isItemLoading = Boolean(actionLoadingMap[sub.path]);
            const shortSha = sub.head_sha
              ? sub.head_sha.length >= 7
                ? sub.head_sha.slice(0, 7)
                : sub.head_sha
              : null;

            return (
              <div
                key={sub.path}
                className="p-3.5 bg-base-1/80 hover:bg-base-1 border border-border hover:border-border-strong rounded-sm transition duration-100 shadow-2xs space-y-3"
              >
                {/* Header Information Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Icon Box */}
                    <div className="w-8 h-8 rounded-sm bg-base-2 border border-border flex items-center justify-center text-gitlab-teal shrink-0 mt-0.5">
                      <FolderGit2 className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Name & Status Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-text-primary truncate">
                          {sub.name}
                        </span>

                        {sub.is_dirty && (
                          <span className="px-1.5 py-0.2 bg-git-modified-bg border border-git-modified/40 text-git-modified text-[10px] font-mono font-bold rounded-xs">
                            Modified
                          </span>
                        )}

                        {sub.is_initialized ? (
                          <span className="px-1.5 py-0.2 bg-git-added-bg border border-git-added/40 text-git-added text-[10px] font-mono font-bold rounded-xs">
                            Active
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 bg-base-2 text-text-muted border border-border text-[10px] font-mono rounded-xs">
                            Uninitialized
                          </span>
                        )}

                        {sub.branch && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-base-2 text-text-secondary border border-border text-[10px] font-mono rounded-xs">
                            <GitBranch className="w-2.5 h-2.5 text-text-muted" />
                            <span>{sub.branch}</span>
                          </span>
                        )}
                      </div>

                      {/* Path & Remote URL Link */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-text-muted font-mono">
                        <div className="inline-flex items-center gap-1 text-text-secondary">
                          <Folder className="w-3 h-3 text-text-muted shrink-0" />
                          <span>{sub.path}</span>
                        </div>

                        {sub.url && (
                          <button
                            type="button"
                            onClick={() => handleOpenRemoteUrl(sub.url)}
                            className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 underline underline-offset-2 transition cursor-pointer truncate max-w-md"
                            title={`Open remote URL: ${sub.url}`}
                          >
                            <Globe className="w-3 h-3 text-text-muted shrink-0" />
                            <span className="truncate">{sub.url}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Commit SHA Pill */}
                  {shortSha && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-base-0 border border-border rounded-xs text-[11px] font-mono text-text-muted shrink-0 self-start sm:self-auto shadow-2xs">
                      <GitCommit className="w-3.5 h-3.5 text-commito-coral shrink-0" />
                      <span className="font-semibold text-text-primary">{shortSha}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(sub.head_sha, `sha-${sub.path}`, 'Commit SHA Copied')}
                        className="text-text-faint hover:text-text-primary p-0.5 cursor-pointer transition ml-0.5"
                        title="Copy full commit SHA"
                      >
                        {copiedKey === `sha-${sub.path}` ? (
                          <Check className="w-3 h-3 text-git-added" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom Action Buttons Bar */}
                <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Open in Git Desktop */}
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => handleOpenSubmoduleRepo(sub)}
                      leftIcon={<FolderOpen className="w-3 h-3 text-sky-400" />}
                      title="Open submodule as active repository in Git Desktop"
                    >
                      Open in Git Desktop
                    </Button>

                    {/* Update Pinned Commit */}
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      disabled={isItemLoading}
                      onClick={() => handleUpdateSingle(sub, false)}
                      leftIcon={<Download className="w-3 h-3" />}
                      title="Fetch and update submodule to its pinned commit revision"
                    >
                      Update
                    </Button>

                    {/* Pull Latest Remote */}
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      disabled={isItemLoading}
                      onClick={() => handleUpdateSingle(sub, true)}
                      leftIcon={<RefreshCw className="w-3 h-3" />}
                      title="Pull latest remote branch commit into submodule"
                    >
                      Pull Latest
                    </Button>

                    {/* Copy Submodule Path */}
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => handleCopy(sub.path, `path-${sub.path}`, 'Submodule Path Copied')}
                      leftIcon={
                        copiedKey === `path-${sub.path}` ? (
                          <Check className="w-3 h-3 text-git-added" />
                        ) : (
                          <Copy className="w-3 h-3 text-text-muted" />
                        )
                      }
                      title="Copy local submodule path"
                    >
                      Copy Path
                    </Button>
                  </div>

                  {/* Remove Submodule Button */}
                  <button
                    type="button"
                    onClick={() => setDeletingSubmodule(sub)}
                    className="p-1.5 text-text-muted hover:text-git-removed hover:bg-git-removed-bg rounded-xs transition cursor-pointer"
                    title="Remove and unregister submodule from repository"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingSubmodule)}
        title="Remove Git Submodule"
        subtitle={`Remove '${deletingSubmodule?.name || 'submodule'}'`}
        description={`Are you sure you want to remove the submodule '${deletingSubmodule?.name}' from '${deletingSubmodule?.path}'? This will de-initialize the submodule, unregister it from .gitmodules, and clean its working tree directory.`}
        discardText="Remove Submodule"
        cancelText="Cancel"
        variant="danger"
        onDiscard={handleConfirmDelete}
        onCancel={() => setDeletingSubmodule(null)}
      />
    </div>
  );
};
