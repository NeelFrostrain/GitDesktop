import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  Search,
  Copy,
  Check,
  Globe,
  Loader2,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { useToastStore } from '../../store/useToastStore';
import { useRemoteStore } from '../../store/remoteStore';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { CreateTagModal } from '../modals/CreateTagModal';

/**
 * Modern Dark Obsidian View for managing, creating, pushing, and inspecting Git release tags.
 */
export const TagsView: React.FC = () => {
  const { activeRepoPath, tags, setTags, setError } = useGitStore();
  const { remotes, activeRemote, loadRemotes } = useRemoteStore();

  const [filter, setFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRemote, setSelectedRemote] = useState('origin');
  const [isLoading, setIsLoading] = useState(false);
  const [isPushingAll, setIsPushingAll] = useState(false);
  const [pushingTagMap, setPushingTagMap] = useState<Record<string, boolean>>({});
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const loadTags = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);
    try {
      const res = await GitService.listTags(activeRepoPath);
      setTags(res || []);
    } catch {
      setTags([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeRepoPath) {
      loadTags();
      loadRemotes(activeRepoPath);
    }
  }, [activeRepoPath]);

  useEffect(() => {
    if (activeRemote) {
      setSelectedRemote(activeRemote);
    } else if (remotes.length > 0) {
      setSelectedRemote(remotes[0].name);
    }
  }, [activeRemote, remotes]);

  const handleDeleteTag = async (name: string) => {
    if (!activeRepoPath) return;
    if (!confirm(`Delete tag '${name}'? This will remove the local tag marker.`)) return;

    try {
      await GitService.deleteTag(activeRepoPath, name);
      useLogStore.getState().addLog('info', 'Git', `Deleted tag '${name}'`);
      useToastStore.getState().showToast({
        type: 'info',
        title: 'Tag Deleted',
        message: `Removed tag '${name}' locally`,
      });
      loadTags();
    } catch (error: unknown) {
      setError(toAppError(error, 'TAG_ERROR'));
    }
  };

  const handlePushAllTags = async () => {
    if (!activeRepoPath || isPushingAll) return;
    setIsPushingAll(true);

    try {
      await GitService.pushTags(activeRepoPath, selectedRemote || null);
      useLogStore
        .getState()
        .addLog('success', 'Git', `Pushed all tags to remote '${selectedRemote || 'origin'}'`);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Tags Published',
        message: `All tags pushed to '${selectedRemote || 'origin'}'`,
      });
      loadTags();
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      setError(toAppError(error, 'TAG_ERROR'));
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Push Failed',
        message: msg,
      });
    } finally {
      setIsPushingAll(false);
    }
  };

  const handlePushSingleTag = async (tagName: string) => {
    if (!activeRepoPath || pushingTagMap[tagName]) return;
    setPushingTagMap((prev) => ({ ...prev, [tagName]: true }));

    try {
      await GitService.pushSpecificTag(activeRepoPath, tagName, selectedRemote || null);
      useLogStore
        .getState()
        .addLog('success', 'Git', `Pushed tag '${tagName}' to '${selectedRemote || 'origin'}'`);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Tag Pushed',
        message: `Tag '${tagName}' pushed to '${selectedRemote || 'origin'}'`,
      });
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      setError(toAppError(error, 'TAG_ERROR'));
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Push Failed',
        message: msg,
      });
    } finally {
      setPushingTagMap((prev) => ({ ...prev, [tagName]: false }));
    }
  };

  const handleCopyTagName = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedTag(name);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex-1 h-full bg-base-0 overflow-y-auto p-5 select-none space-y-4 font-sans">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-border/80">
        <div>
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Tag className="w-4 h-4 text-commito-coral" />
            <span>Tags & Releases</span>
            <span className="px-1.5 py-0.2 bg-base-1 border border-border rounded-xs text-[10px] font-mono text-text-muted">
              {tags.length}
            </span>
          </h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            Manage repository release tags, annotated markers, and remote publishing
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tags..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary focus:outline-none transition shadow-2xs placeholder:text-text-faint"
            />
          </div>

          {/* Remote Selector (when remotes available) */}
          {remotes.length > 1 && (
            <div className="flex items-center gap-1 bg-base-1 border border-border rounded-sm h-8 px-2 text-xs">
              <Globe className="w-3 h-3 text-text-muted shrink-0" />
              <select
                value={selectedRemote}
                onChange={(e) => setSelectedRemote(e.target.value)}
                className="bg-transparent text-xs font-mono text-text-primary focus:outline-none cursor-pointer"
              >
                {remotes.map((r) => (
                  <option key={r.name} value={r.name} className="bg-base-1 text-text-primary">
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={loadTags}
            disabled={isLoading}
            className="h-8 w-8 flex items-center justify-center bg-base-1 hover:bg-base-2 border border-border rounded-sm text-text-muted hover:text-text-primary transition cursor-pointer shadow-2xs disabled:opacity-50"
            title="Reload tags"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Push All Tags Button */}
          <button
            onClick={handlePushAllTags}
            disabled={isPushingAll || tags.length === 0}
            className="h-8 px-3 bg-base-1 hover:bg-base-2 border border-border rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Push all local tags to '${selectedRemote || 'origin'}'`}
          >
            {isPushingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-text-muted" />
            )}
            <span>Push All Tags</span>
          </button>

          {/* Create Tag Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="h-8 px-3.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Tag</span>
          </button>
        </div>
      </div>

      {/* Tag List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="p-10 text-center bg-base-1 border border-border rounded-sm text-xs text-text-muted space-y-2">
            <Tag className="w-8 h-8 mx-auto text-text-faint opacity-50" />
            <p className="font-semibold text-text-secondary">
              {filter ? 'No matching tags found' : 'No release tags in this repository yet'}
            </p>
            <p className="text-[11px] text-text-muted max-w-sm mx-auto">
              Create lightweight or annotated tags to mark releases, versions, and deployment checkpoints.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 h-7.5 px-3.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Tag</span>
            </button>
          </div>
        ) : (
          filtered.map((tag) => {
            const isPushing = pushingTagMap[tag.name] || false;
            const isCopied = copiedTag === tag.name;

            return (
              <div
                key={tag.name}
                className="p-3 bg-base-1 border border-border hover:border-border-strong rounded-sm flex items-center justify-between gap-4 transition shadow-2xs group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-sm bg-commito-coral/10 border border-commito-coral/20 flex items-center justify-center text-commito-coral shrink-0">
                    <Tag className="w-3.5 h-3.5" />
                  </div>

                  <div className="min-w-0 flex-1 truncate">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-text-primary truncate">
                        {tag.name}
                      </span>

                      {tag.sha && (
                        <span className="px-1.5 py-0.2 bg-base-0 border border-border/80 rounded-xs font-mono text-[10.5px] text-text-muted">
                          {tag.sha.slice(0, 7)}
                        </span>
                      )}

                      {tag.is_annotated ? (
                        <span className="px-1.5 py-0.2 bg-commito-coral/10 text-commito-coral border border-commito-coral/30 rounded-xs text-[9.5px] font-mono font-bold uppercase">
                          Annotated
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 bg-base-0 text-text-faint border border-border/60 rounded-xs text-[9.5px] font-mono uppercase">
                          Lightweight
                        </span>
                      )}

                      {tag.tagger_name && (
                        <span className="text-[11px] text-text-muted">
                          by <span className="text-text-secondary font-medium">{tag.tagger_name}</span>
                        </span>
                      )}
                    </div>

                    {tag.message && (
                      <p className="text-[11px] text-text-muted font-sans mt-1 truncate">
                        {tag.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Copy Tag Name */}
                  <button
                    onClick={() => handleCopyTagName(tag.name)}
                    className="h-7 px-2 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-text-muted hover:text-text-primary transition cursor-pointer text-[11px] flex items-center gap-1 shadow-2xs"
                    title="Copy tag name to clipboard"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3 text-git-added" />
                        <span className="text-git-added font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {/* Push Single Tag */}
                  <button
                    onClick={() => handlePushSingleTag(tag.name)}
                    disabled={isPushing}
                    className="h-7 px-2.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-text-secondary hover:text-text-primary transition cursor-pointer text-[11px] flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                    title={`Push '${tag.name}' to remote '${selectedRemote || 'origin'}'`}
                  >
                    {isPushing ? (
                      <Loader2 className="w-3 h-3 animate-spin text-commito-coral" />
                    ) : (
                      <Upload className="w-3 h-3 text-text-muted" />
                    )}
                    <span>Push</span>
                  </button>

                  {/* Delete Tag */}
                  <button
                    onClick={() => handleDeleteTag(tag.name)}
                    className="h-7 w-7 flex items-center justify-center bg-base-0 hover:bg-git-removed-bg border border-border hover:border-git-removed/40 rounded-sm text-text-muted hover:text-git-removed transition cursor-pointer shadow-2xs"
                    title="Delete local tag"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Tag Modal */}
      {isCreateModalOpen && (
        <CreateTagModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={loadTags}
        />
      )}
    </div>
  );
};
