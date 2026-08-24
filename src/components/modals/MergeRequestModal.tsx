import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  X,
  GitPullRequest,
  GitBranch,
  CheckCircle2,
  ExternalLink,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { UnifiedMergeRequest, BranchInfo } from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { Dropdown } from '../common/Dropdown';

/**
 * Modal dialogue for creating and browsing GitLab Merge Requests / GitHub Pull Requests.
 */
export const MergeRequestModal: React.FC = () => {
  const {
    activeRepoPath,
    isMergeRequestModalOpen,
    setIsMergeRequestModalOpen,
    user,
    status,
    setError,
  } = useGitStore();

  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [sourceBranch, setSourceBranch] = useState(status?.current_branch || 'main');
  const [targetBranch, setTargetBranch] = useState('main');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [mergeRequests, setMergeRequests] = useState<UnifiedMergeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isMergeRequestModalOpen || !activeRepoPath) return;

    GitService.listBranches(activeRepoPath)
      .then((res) => setBranches(res || []))
      .catch(() => {});

    if (status?.current_branch) {
      setSourceBranch(status.current_branch);
    }
  }, [isMergeRequestModalOpen, activeRepoPath, status?.current_branch]);

  const loadMergeRequests = async () => {
    setIsLoading(true);
    try {
      const res = await invoke<Record<string, unknown>[]>('get_open_merge_requests', { projectId: '1' });
      if (Array.isArray(res)) {
        setMergeRequests(
          res.map((mr) => {
            const author = (mr.author as Record<string, unknown>) || {};
            return {
              id: (mr.id as number) || (mr.iid as number),
              iid: mr.iid as number,
              title: (mr.title as string) || '',
              description: (mr.description as string) || '',
              state: (mr.state as string) || 'opened',
              source_branch: (mr.source_branch as string) || 'feature',
              target_branch: (mr.target_branch as string) || 'main',
              web_url: (mr.web_url as string) || '#',
              author_name: (author.name as string) || 'GitLab User',
              author_avatar: author.avatar_url as string | undefined,
              created_at: (mr.created_at as string) || new Date().toISOString(),
            };
          })
        );
      } else {
        setMergeRequests([]);
      }
    } catch {
      setMergeRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isMergeRequestModalOpen || activeTab !== 'list') return;
    loadMergeRequests();
  }, [isMergeRequestModalOpen, activeTab]);

  const handleCreateMergeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await invoke<{ web_url?: string }>('create_merge_request', {
        projectId: '1',
        sourceBranch,
        targetBranch,
        title,
        description: description || null,
      });

      useLogStore
        .getState()
        .addLog('success', 'Merge Request', `Created Merge Request '${title}' (${sourceBranch} -> ${targetBranch})`);
      setTitle('');
      setDescription('');
      setActiveTab('list');
      if (res?.web_url) {
        openUrl(res.web_url).catch(() => {});
      }
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      setError(toAppError(error, 'MR_ERROR'));
      useLogStore.getState().addLog('error', 'Merge Request', `Failed to create Merge Request: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMergeRequestModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-sm shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-base-0 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-commito-coral/20 border border-commito-coral/40 text-commito-coral flex items-center justify-center">
              <GitPullRequest className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary leading-tight">
                {user?.provider === 'github' ? 'Pull Requests' : 'Merge Requests'}
              </h2>
              <p className="text-[11px] text-text-muted">
                Create and manage branch pull & merge requests for remote origin
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMergeRequestModalOpen(false)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-sm hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dual Tab Bar */}
        <div className="px-5 pt-3 pb-2 border-b border-border flex items-center gap-2 bg-base-0/50">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3.5 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'create'
                ? 'bg-commito-coral hover:bg-commito-coralLight text-white shadow-xs'
                : 'bg-base-2 text-text-secondary hover:text-text-primary'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create {user?.provider === 'github' ? 'Pull Request' : 'Merge Request'}</span>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3.5 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'list'
                ? 'bg-commito-coral hover:bg-commito-coralLight text-white shadow-xs'
                : 'bg-base-2 text-text-secondary hover:text-text-primary'
            }`}
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            <span>Open {user?.provider === 'github' ? 'Pull Requests' : 'Merge Requests'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'create' ? (
            <form onSubmit={handleCreateMergeRequest} className="space-y-4">
              {/* Source vs Target Branch Selectors */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-base-2 border border-border rounded-sm">
                <div>
                  <label className="text-[11px] font-bold text-text-secondary mb-1.5 flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-commito-coral" />
                    <span>Source Branch (Compare)</span>
                  </label>
                  <Dropdown
                    options={branches.map((b) => ({
                      value: b.name,
                      label: `${b.name}${b.is_current ? ' (active)' : ''}`,
                    }))}
                    value={sourceBranch}
                    onChange={setSourceBranch}
                    className="w-full font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-secondary mb-1.5 flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Target Branch (Base)</span>
                  </label>
                  <Dropdown
                    options={branches.map((b) => ({ value: b.name, label: b.name }))}
                    value={targetBranch}
                    onChange={setTargetBranch}
                    className="w-full font-mono"
                  />
                </div>
              </div>

              {/* Title Field */}
              <div>
                <label className="text-[11px] font-bold text-text-secondary mb-1 block">
                  Title (Required)
                </label>
                <input
                  type="text"
                  placeholder="e.g. feat(auth): add OAuth2 loopback authentication flow"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-base-2 border border-border rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral"
                  required
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="text-[11px] font-bold text-text-secondary mb-1 block">
                  Description (Markdown supported)
                </label>
                <textarea
                  rows={4}
                  placeholder="Provide detailed description of changes, issue references, and testing steps..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-base-2 border border-border rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMergeRequestModalOpen(false)}
                  className="px-4 py-2 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-xs font-semibold text-text-secondary transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || isSubmitting}
                  className={`px-5 py-2 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-bold flex items-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50`}
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Request'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Tab: List Open Requests */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-text-primary">
                  Open Requests ({mergeRequests.length})
                </span>
                <button
                  onClick={loadMergeRequests}
                  disabled={isLoading}
                  className="p-1.5 text-text-muted hover:text-text-primary bg-base-2 rounded-sm border border-border cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {mergeRequests.length === 0 ? (
                <div className="p-8 text-center bg-base-2 border border-border rounded-sm space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-git-added mx-auto" />
                  <p className="text-xs text-text-muted font-medium">
                    No open requests found for this project
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {mergeRequests.map((mr) => (
                    <div
                      key={mr.id}
                      className="p-3.5 bg-base-2 border border-border rounded-sm flex items-center justify-between hover:border-text-muted transition"
                    >
                      <div className="space-y-1 min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-git-added-bg border border-git-added/40 text-git-added text-[10px] font-mono font-bold rounded uppercase">
                            {mr.state}
                          </span>
                          <h4 className="text-xs font-bold text-text-primary truncate">
                            {mr.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-text-muted font-mono">
                          <span>{mr.source_branch}</span>
                          <span>→</span>
                          <span>{mr.target_branch}</span>
                          <span>•</span>
                          <span>by {mr.author_name}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => mr.web_url && openUrl(mr.web_url)}
                        className="px-3 py-1.5 bg-base-3 hover:bg-base-1 border border-border rounded-sm text-xs font-semibold text-text-primary flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
