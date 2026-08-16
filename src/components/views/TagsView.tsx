import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  Search,
  Bookmark,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';

/**
 * Main view for managing, creating, pushing, and deleting lightweight and annotated Git release tags.
 */
export const TagsView: React.FC = () => {
  const { activeRepoPath, tags, setTags, setError } = useGitStore();

  const [filter, setFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagMessage, setTagMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    loadTags();
  }, [activeRepoPath]);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !tagName.trim()) return;

    try {
      await GitService.createTag(activeRepoPath, tagName.trim(), tagMessage.trim() || undefined);

      useLogStore.getState().addLog('success', 'Git', `Created tag '${tagName.trim()}'`);
      setTagName('');
      setTagMessage('');
      setShowCreateModal(false);
      loadTags();
    } catch (error: unknown) {
      setError(toAppError(error, 'TAG_ERROR'));
    }
  };

  const handleDeleteTag = async (name: string) => {
    if (!activeRepoPath) return;
    if (!confirm(`Are you sure you want to delete tag '${name}'?`)) return;

    try {
      await GitService.deleteTag(activeRepoPath, name);
      useLogStore.getState().addLog('info', 'Git', `Deleted tag '${name}'`);
      loadTags();
    } catch (error: unknown) {
      setError(toAppError(error, 'TAG_ERROR'));
    }
  };

  const handlePushTags = async () => {
    if (!activeRepoPath) return;

    try {
      await GitService.pushTags(activeRepoPath);
      useLogStore.getState().addLog('success', 'Git', 'Pushed all local tags to remote origin');
      loadTags();
    } catch (error: unknown) {
      setError(toAppError(error, 'TAG_ERROR'));
    }
  };

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex-1 h-full bg-base-1 overflow-y-auto p-6 select-none space-y-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-text-primary flex items-center gap-2">
            <Tag className="w-5 h-5 text-commito-coral" />
            <span>Tags & Releases</span>
          </h2>
          <p className="text-xs text-text-muted">
            Manage repository release tags, annotated markers, and remote publishing
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter tags..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-base-2 border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-commito-coral"
            />
          </div>

          <button
            onClick={loadTags}
            disabled={isLoading}
            className="p-2 bg-base-2 hover:bg-base-3 border border-border rounded-md text-text-muted hover:text-text-primary transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handlePushTags}
            className="px-3 py-1.5 bg-base-2 hover:bg-base-3 border border-border rounded-md text-xs font-semibold text-text-primary flex items-center gap-1.5 transition cursor-pointer"
            title="Push tags to remote origin"
          >
            <Upload className="w-3.5 h-3.5 text-text-muted" />
            <span>Push Tags</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Tag</span>
          </button>
        </div>
      </div>

      {/* Create Tag Form Drawer */}
      {showCreateModal && (
        <form onSubmit={handleCreateTag} className="p-4 bg-base-2 border border-border rounded-md space-y-3 shadow-md">
          <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
            <Bookmark className="w-4 h-4 text-commito-coral" />
            <span>Create Tag on HEAD</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Tag Name (e.g. v1.0.0)"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              className="w-full px-3 py-1.5 bg-base-1 border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-commito-coral font-mono"
              autoFocus
              required
            />

            <input
              type="text"
              placeholder="Annotation message (optional for lightweight tag)"
              value={tagMessage}
              onChange={(e) => setTagMessage(e.target.value)}
              className="w-full px-3 py-1.5 bg-base-1 border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-commito-coral"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-3 py-1 bg-base-3 text-text-secondary rounded-md text-xs font-semibold hover:bg-base-1 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!tagName.trim()}
              className="px-4 py-1 bg-commito-coral hover:bg-commito-coralLight text-white rounded-md text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Create Tag
            </button>
          </div>
        </form>
      )}

      {/* Tag List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-base-2 border border-border rounded-md text-xs text-text-muted italic">
            No release tags found in repository
          </div>
        ) : (
          filtered.map((tag) => (
            <div
              key={tag.name}
              className="p-3.5 bg-base-2/60 border border-border rounded-md flex items-center justify-between hover:bg-base-2 transition"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                <Tag className="w-4 h-4 text-commito-coral flex-shrink-0" />
                <div className="min-w-0 truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-text-primary truncate">
                      {tag.name}
                    </span>
                    {tag.sha && (
                      <span className="px-1.5 py-0.2 bg-base-3 border border-border rounded font-mono text-[10px] text-text-muted">
                        {tag.sha.slice(0, 7)}
                      </span>
                    )}
                    {tag.is_annotated && (
                      <span className="px-2 py-0.5 bg-commito-coral/20 text-commito-coral border border-commito-coral/40 rounded text-[9px] font-mono font-bold uppercase">
                        Annotated
                      </span>
                    )}
                  </div>
                  {tag.message && (
                    <div className="text-[11px] text-text-muted font-sans mt-0.5 truncate">
                      {tag.message}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleDeleteTag(tag.name)}
                  className="p-1.5 text-text-muted hover:text-red-400 bg-base-3 hover:bg-base-1 border border-border rounded-md transition cursor-pointer"
                  title="Delete tag"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
