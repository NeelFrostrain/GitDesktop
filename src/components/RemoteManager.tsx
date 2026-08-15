import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Globe,
  Check,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
} from 'lucide-react';
import { useRemoteStore } from '../store/remoteStore';
import { useGitStore } from '../store/useGitStore';

export const RemoteManager: React.FC = () => {
  const { activeRepoPath } = useGitStore();
  const {
    remotes,
    activeRemote,
    setActiveRemote,
    isRemoteManagerOpen,
    setIsRemoteManagerOpen,
    loadRemotes,
    addRemote,
    removeRemote,
    setRemoteUrl,
  } = useRemoteStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState('');
  const [newRemoteUrl, setNewRemoteUrl] = useState('');
  const [editingRemote, setEditingRemote] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isRemoteManagerOpen && activeRepoPath) {
      loadRemotes(activeRepoPath);
    }
  }, [isRemoteManagerOpen, activeRepoPath, loadRemotes]);

  if (!isRemoteManagerOpen) return null;

  const handleUrlChange = (url: string) => {
    setNewRemoteUrl(url);
    if (!newRemoteName) {
      if (url.includes('gitlab') || url.includes('github')) {
        if (!remotes.some((r) => r.name === 'upstream') && remotes.some((r) => r.name === 'origin')) {
          setNewRemoteName('upstream');
        } else if (!remotes.some((r) => r.name === 'origin')) {
          setNewRemoteName('origin');
        }
      }
    }
  };

  const handleAddRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath) return;
    setLocalError(null);

    const name = newRemoteName.trim();
    const url = newRemoteUrl.trim();

    if (!name || !url) {
      setLocalError('Remote name and URL are required');
      return;
    }

    if (remotes.some((r) => r.name === name)) {
      setLocalError(`A remote named '${name}' already exists`);
      return;
    }

    setIsLoading(true);
    try {
      await addRemote(activeRepoPath, name, url);
      setNewRemoteName('');
      setNewRemoteUrl('');
      setIsAdding(false);
    } catch (err: any) {
      setLocalError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async (name: string) => {
    if (!activeRepoPath) return;
    setLocalError(null);

    const url = editUrl.trim();
    if (!url) {
      setLocalError('URL cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      await setRemoteUrl(activeRepoPath, name, url, false);
      setEditingRemote(null);
      setEditUrl('');
    } catch (err: any) {
      setLocalError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!activeRepoPath) return;
    if (confirm(`Are you sure you want to remove remote '${name}'?`)) {
      setIsLoading(true);
      try {
        await removeRemote(activeRepoPath, name);
      } catch (err: any) {
        setLocalError(err?.message || String(err));
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl bg-base-1 border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 bg-base-0 border-b border-border px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-gitlab-teal" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Manage Git Remotes
            </h2>
          </div>
          <button
            onClick={() => setIsRemoteManagerOpen(false)}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {localError && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{localError}</div>
            </div>
          )}

          {/* List of configured remotes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-text-muted uppercase tracking-wider">
              <span>Configured Remotes ({remotes.length})</span>
              {!isAdding && (
                <button
                  onClick={() => setIsAdding(true)}
                  className="text-commito-coral hover:underline font-bold flex items-center gap-1 cursor-pointer normal-case"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Remote</span>
                </button>
              )}
            </div>

            {remotes.length === 0 ? (
              <div className="p-6 bg-base-2 border border-border rounded-lg text-center text-xs text-text-muted">
                No remotes configured for this repository yet.
              </div>
            ) : (
              remotes.map((remote) => {
                const isActive = activeRemote === remote.name;
                const isEditing = editingRemote === remote.name;

                return (
                  <div
                    key={remote.name}
                    className={`p-3.5 rounded-lg border transition ${
                      isActive
                        ? 'bg-base-2 border-commito-coral/50 shadow-xs'
                        : 'bg-base-2/50 border-border hover:border-border-strong'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-text-primary">
                          <span>Edit URL for '{remote.name}'</span>
                          <button
                            onClick={() => setEditingRemote(null)}
                            className="text-text-muted hover:text-text-primary"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className="w-full bg-base-1 border border-border rounded px-2.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-commito-coral"
                          placeholder="https://gitlab.com/owner/repo.git"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingRemote(null)}
                            className="px-2.5 py-1 bg-base-3 hover:bg-base-1 border border-border rounded text-xs text-text-secondary"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(remote.name)}
                            disabled={isLoading}
                            className="px-3 py-1 bg-commito-coral hover:bg-commito-coralHover text-white rounded text-xs font-bold flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save URL</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-text-primary font-mono">
                              {remote.name}
                            </span>
                            {remote.is_default && (
                              <span className="px-1.5 py-0.2 bg-gitlab-teal/20 text-gitlab-teal border border-gitlab-teal/30 rounded text-[9px] font-mono font-bold uppercase">
                                Default
                              </span>
                            )}
                            {isActive && (
                              <span className="px-1.5 py-0.2 bg-commito-coral/20 text-commito-coral border border-commito-coral/30 rounded text-[9px] font-mono font-bold uppercase">
                                Active Target
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted font-mono truncate" title={remote.url}>
                            {remote.url}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-text-faint font-mono pt-1">
                            <span className="flex items-center gap-1">
                              <ArrowUpRight className="w-3 h-3 text-commito-coral" />
                              {remote.ahead} ahead
                            </span>
                            <span className="flex items-center gap-1">
                              <ArrowDownLeft className="w-3 h-3 text-gitlab-blue" />
                              {remote.behind} behind
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {!isActive && (
                            <button
                              onClick={() => setActiveRemote(remote.name)}
                              className="px-2 py-1 bg-base-3 hover:bg-base-1 border border-border rounded text-[11px] font-medium text-text-secondary transition"
                            >
                              Set Active
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingRemote(remote.name);
                              setEditUrl(remote.url);
                            }}
                            className="p-1 text-text-muted hover:text-text-primary hover:bg-base-3 rounded transition"
                            title="Edit URL"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(remote.name)}
                            className="p-1 text-text-muted hover:text-red-400 hover:bg-red-950/40 rounded transition"
                            title="Remove remote"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Add Remote Form */}
          {isAdding && (
            <form onSubmit={handleAddRemote} className="p-4 bg-base-2 border border-commito-coral/40 rounded-lg space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-text-primary">
                <span>Add New Remote</span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary">Remote Name</label>
                <input
                  type="text"
                  value={newRemoteName}
                  onChange={(e) => setNewRemoteName(e.target.value)}
                  placeholder="e.g. upstream, origin, fork"
                  className="w-full bg-base-1 border border-border rounded px-2.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-commito-coral"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary">Remote URL</label>
                <input
                  type="text"
                  value={newRemoteUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://gitlab.com/owner/repository.git"
                  className="w-full bg-base-1 border border-border rounded px-2.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-commito-coral"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 bg-base-3 hover:bg-base-1 border border-border rounded text-xs text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralHover disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Add Remote</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
