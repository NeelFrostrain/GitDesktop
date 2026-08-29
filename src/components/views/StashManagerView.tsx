import React, { useState, useEffect } from 'react';
import { Archive, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';
import { Checkbox } from '../common/Checkbox';
import { Button } from '../common/Button';

/**
 * Main view for inspecting, creating, applying, popping, and dropping Git stashes with live diff preview.
 */
export const StashManagerView: React.FC = () => {
  const { activeRepoPath, stashes, setStashes, setStatus, setError } = useGitStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stashMessage, setStashMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(true);
  const [selectedStashIndex, setSelectedStashIndex] = useState<number | null>(null);
  const [stashDiff, setStashDiff] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const loadStashes = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);
    try {
      const res = await GitService.listStashes(activeRepoPath);
      setStashes(res || []);
      if (res && res.length > 0 && selectedStashIndex === null) {
        handleViewDiff(0);
      }
    } catch {
      setStashes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStashes();
  }, [activeRepoPath]);

  const handleCreateStash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath) return;

    try {
      await GitService.createStash(
        activeRepoPath,
        stashMessage.trim() || undefined,
        includeUntracked
      );

      useLogStore.getState().addLog('success', 'Git', `Created stash: '${stashMessage || 'WIP'}'`);
      setStashMessage('');
      setShowCreateModal(false);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      loadStashes();
    } catch (error: unknown) {
      setError(toAppError(error, 'STASH_ERROR'));
    }
  };

  const handleApplyStash = async (index: number) => {
    if (!activeRepoPath) return;

    try {
      await GitService.applyStash(activeRepoPath, index);
      useLogStore.getState().addLog('success', 'Git', `Applied stash@{${index}}`);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
    } catch (error: unknown) {
      setError(toAppError(error, 'STASH_ERROR'));
    }
  };

  const handlePopStash = async (index: number) => {
    if (!activeRepoPath) return;

    try {
      await GitService.popStash(activeRepoPath, index);
      useLogStore.getState().addLog('success', 'Git', `Popped stash@{${index}}`);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      loadStashes();
    } catch (error: unknown) {
      setError(toAppError(error, 'STASH_ERROR'));
    }
  };

  const handleDropStash = async (index: number) => {
    if (!activeRepoPath) return;

    if (!confirm(`Are you sure you want to drop stash@{${index}}?`)) return;

    try {
      await GitService.dropStash(activeRepoPath, index);
      useLogStore.getState().addLog('info', 'Git', `Dropped stash@{${index}}`);
      loadStashes();
    } catch (error: unknown) {
      setError(toAppError(error, 'STASH_ERROR'));
    }
  };

  const handleViewDiff = async (index: number) => {
    if (!activeRepoPath) return;
    setSelectedStashIndex(index);
    try {
      const diffStr = await GitService.getStashDiff(activeRepoPath, index);
      setStashDiff(diffStr || '');
    } catch {
      setStashDiff('');
    }
  };

  return (
    <div className="flex-1 h-full bg-base-1 overflow-y-auto p-6 select-none space-y-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-text-primary flex items-center gap-2">
            <Archive className="w-5 h-5 text-commito-coral" />
            <span>Stash Management</span>
          </h2>
          <p className="text-xs text-text-muted">
            Shelve uncommitted changes and inspect stash diff previews
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadStashes}
            disabled={isLoading}
            className="p-2 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-text-muted hover:text-text-primary transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <Button
            type="button"
            variant="coral"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Stash Changes
          </Button>
        </div>
      </div>

      {/* Create Stash Form Modal Overlay */}
      {showCreateModal && (
        <form
          onSubmit={handleCreateStash}
          className="p-4 bg-base-2 border border-border rounded-sm space-y-3 shadow-md"
        >
          <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
            <Archive className="w-4 h-4 text-commito-coral" />
            <span>Save Working Copy to Stash</span>
          </h3>

          <input
            type="text"
            placeholder="Stash message (optional, e.g. WIP before branch switch)"
            value={stashMessage}
            onChange={(e) => setStashMessage(e.target.value)}
            className="w-full px-3 py-1.5 bg-base-1 border border-border hover:border-border-strong rounded-sm text-xs text-text-primary focus:outline-none focus:border-border-strong font-sans"
            autoFocus
          />

          <div className="flex items-center justify-between">
            <Checkbox
              checked={includeUntracked}
              onChange={setIncludeUntracked}
              label="Include untracked files (-u)"
            />

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="coral" size="sm">
                Save Stash
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Grid: Stash List & Diff Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[500px]">
        {/* Left Column: Stash List */}
        <div className="space-y-2">
          {stashes.length === 0 ? (
            <div className="p-8 text-center bg-base-2 border border-border rounded-sm text-xs text-text-muted italic">
              No stashes recorded in working repository
            </div>
          ) : (
            stashes.map((s) => {
              const isSelected = selectedStashIndex === s.index;

              return (
                <div
                  key={s.index}
                  onClick={() => handleViewDiff(s.index)}
                  className={`p-3.5 rounded-sm border flex items-center justify-between cursor-pointer transition ${
                    isSelected
                      ? 'bg-commito-activeBg border-commito-activeText/30 text-commito-activeText shadow-xs'
                      : 'bg-base-2/60 border-border hover:bg-base-2 text-text-primary'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-base-3 border border-border rounded font-mono text-[10px] text-text-muted font-bold">
                        stash@{`{${s.index}}`}
                      </span>
                      <h4 className="text-xs font-bold truncate">{s.message}</h4>
                    </div>
                    <div className="text-[11px] text-text-muted font-mono mt-1">
                      on branch {s.branch} • {s.date}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyStash(s.index);
                      }}
                      title="Apply stash without removing from stack"
                    >
                      Apply
                    </Button>
                    <Button
                      type="button"
                      variant="coral"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePopStash(s.index);
                      }}
                      title="Pop stash (apply & drop)"
                    >
                      Pop
                    </Button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDropStash(s.index);
                      }}
                      className="p-1 text-text-muted hover:text-git-removed transition cursor-pointer"
                      title="Drop stash"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Diff Preview Panel */}
        <div className="bg-base-2 border border-border rounded-sm p-4 flex flex-col min-h-0">
          <div className="text-xs font-bold text-text-primary pb-2 border-b border-border flex items-center justify-between">
            <span>Stash Diff Preview</span>
            {selectedStashIndex !== null && (
              <span className="font-mono text-[10px] text-text-muted">
                stash@{`{${selectedStashIndex}}`}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pt-3 font-mono text-[11px] text-text-secondary whitespace-pre-wrap">
            {stashDiff ? (
              stashDiff
            ) : (
              <span className="italic text-text-muted">
                Select a stash entry on the left to preview diff
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
