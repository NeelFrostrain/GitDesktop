import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Archive, 
  Plus, 
  Trash2, 
  RefreshCw 
} from 'lucide-react';

import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { StashEntry, RepoStatus } from '../types/git';
import { Checkbox } from './Checkbox';

export const StashManagerView: React.FC = () => {
  const {
    activeRepoPath,
    stashes,
    setStashes,
    setStatus,
    setError
  } = useGitStore();

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
      const res = await invoke<StashEntry[]>('list_stashes_cmd', { repoPath: activeRepoPath });
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
      await invoke('create_stash_cmd', {
        repoPath: activeRepoPath,
        message: stashMessage.trim() || null,
        includeUntracked,
      });

      useLogStore.getState().addLog('success', 'Git', `Created stash: '${stashMessage || 'WIP'}'`);
      setStashMessage('');
      setShowCreateModal(false);

      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
      loadStashes();
    } catch (err: any) {
      setError({ code: 'STASH_ERROR', message: err.message || String(err) });
    }
  };

  const handleApplyStash = async (index: number) => {
    if (!activeRepoPath) return;

    try {
      await invoke('apply_stash_cmd', { repoPath: activeRepoPath, index });
      useLogStore.getState().addLog('success', 'Git', `Applied stash@{${index}}`);

      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
    } catch (err: any) {
      setError({ code: 'STASH_ERROR', message: err.message || String(err) });
    }
  };

  const handlePopStash = async (index: number) => {
    if (!activeRepoPath) return;

    try {
      await invoke('pop_stash_cmd', { repoPath: activeRepoPath, index });
      useLogStore.getState().addLog('success', 'Git', `Popped stash@{${index}}`);

      const newStatus = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
      setStatus(newStatus);
      loadStashes();
    } catch (err: any) {
      setError({ code: 'STASH_ERROR', message: err.message || String(err) });
    }
  };

  const handleDropStash = async (index: number) => {
    if (!activeRepoPath) return;

    if (!confirm(`Are you sure you want to drop stash@{${index}}?`)) return;

    try {
      await invoke('drop_stash_cmd', { repoPath: activeRepoPath, index });
      useLogStore.getState().addLog('info', 'Git', `Dropped stash@{${index}}`);
      loadStashes();
    } catch (err: any) {
      setError({ code: 'STASH_ERROR', message: err.message || String(err) });
    }
  };

  const handleViewDiff = async (index: number) => {
    if (!activeRepoPath) return;
    setSelectedStashIndex(index);
    try {
      const diffStr = await invoke<string>('get_stash_diff_cmd', { repoPath: activeRepoPath, index });
      setStashDiff(diffStr);
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
            className="p-2 bg-base-2 hover:bg-base-3 border border-border rounded-md text-text-muted hover:text-text-primary transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralHover text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Stash Changes</span>
          </button>
        </div>
      </div>

      {/* Create Stash Form Modal Overlay */}
      {showCreateModal && (
        <form onSubmit={handleCreateStash} className="p-4 bg-base-2 border border-border rounded-md space-y-3 shadow-md">
          <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
            <Archive className="w-4 h-4 text-commito-coral" />
            <span>Save Working Copy to Stash</span>
          </h3>

          <input
            type="text"
            placeholder="Stash message (optional, e.g. WIP before branch switch)"
            value={stashMessage}
            onChange={(e) => setStashMessage(e.target.value)}
            className="w-full px-3 py-1.5 bg-base-1 border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-commito-coral font-sans"
            autoFocus
          />

          <div className="flex items-center justify-between">
            <Checkbox
              checked={includeUntracked}
              onChange={setIncludeUntracked}
              label="Include untracked files (-u)"
            />

            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1 bg-base-3 text-text-secondary rounded-md text-xs font-semibold hover:bg-base-1 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1 bg-commito-coral text-white rounded-md text-xs font-bold transition shadow-sm"
              >
                Save Stash
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Grid: Stash List & Diff Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[500px]">
        {/* Left Column: Stash List */}
        <div className="space-y-2">
          {stashes.length === 0 ? (
            <div className="p-8 text-center bg-base-2 border border-border rounded-md text-xs text-text-muted italic">
              No stashes recorded in working repository
            </div>
          ) : (
            stashes.map((s) => {
              const isSelected = selectedStashIndex === s.index;

              return (
                <div
                  key={s.index}
                  onClick={() => handleViewDiff(s.index)}
                  className={`p-3.5 rounded-md border flex items-center justify-between cursor-pointer transition ${
                    isSelected
                      ? 'bg-commito-activeBg border-commito-activeText/30 text-commito-activeText shadow-sm'
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyStash(s.index);
                      }}
                      className="px-2 py-1 bg-base-3 hover:bg-base-0 border border-border rounded text-[11px] font-semibold text-text-secondary transition"
                      title="Apply stash without removing from stack"
                    >
                      Apply
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePopStash(s.index);
                      }}
                      className="px-2 py-1 bg-commito-coral text-white rounded text-[11px] font-bold transition shadow-sm"
                      title="Pop stash (apply & drop)"
                    >
                      Pop
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDropStash(s.index);
                      }}
                      className="p-1 text-text-muted hover:text-red-400 transition"
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
        <div className="bg-base-2 border border-border rounded-md p-4 flex flex-col min-h-0">
          <div className="text-xs font-bold text-text-primary pb-2 border-b border-border flex items-center justify-between">
            <span>Stash Diff Preview</span>
            {selectedStashIndex !== null && (
              <span className="font-mono text-[10px] text-text-muted">
                stash@{`{${selectedStashIndex}}`}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pt-3 font-mono text-[11px] text-text-secondary whitespace-pre-wrap">
            {stashDiff ? stashDiff : <span className="italic text-text-muted">Select a stash entry on the left to preview diff</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
