import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Archive,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Copy,
  Check,
  GitBranch,
  FileCode,
  FolderOpen,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';
import { Checkbox } from '../common/Checkbox';
import { Button } from '../common/Button';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useTaskStore } from '../../features/task-manager';

/**
 * Modern Dark Obsidian View for inspecting, searching, creating, applying, popping,
 * and dropping Git stashes with syntax-highlighted diff preview.
 */
export const StashManagerView: React.FC = () => {
  const { activeRepoPath, stashes, setStashes, setStatus, setError } = useGitStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stashMessage, setStashMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(true);
  const [selectedStashIndex, setSelectedStashIndex] = useState<number | null>(null);
  const [stashDiff, setStashDiff] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [copiedDiff, setCopiedDiff] = useState(false);
  const [dropStashIndex, setDropStashIndex] = useState<number | null>(null);

  const handleViewDiff = useCallback(
    async (index: number) => {
      if (!activeRepoPath) return;
      setSelectedStashIndex(index);
      setIsDiffLoading(true);
      try {
        const diffStr = await GitService.getStashDiff(activeRepoPath, index);
        setStashDiff(diffStr || '');
      } catch {
        setStashDiff('');
      } finally {
        setIsDiffLoading(false);
      }
    },
    [activeRepoPath]
  );

  const loadStashes = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);
    try {
      const res = await GitService.listStashes(activeRepoPath);
      setStashes(res || []);
      if (res && res.length > 0 && selectedStashIndex === null) {
        handleViewDiff(res[0].index);
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

  const filteredStashes = useMemo(() => {
    if (!searchQuery.trim()) return stashes;
    const q = searchQuery.toLowerCase();
    return stashes.filter(
      (s) =>
        s.message.toLowerCase().includes(q) ||
        s.branch.toLowerCase().includes(q) ||
        `stash@{${s.index}}`.includes(q)
    );
  }, [stashes, searchQuery]);

  const handleCreateStash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath) return;

    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';
    const taskId = useTaskStore.getState().addTask({
      type: 'stash',
      title: `Stash changes: '${stashMessage.trim() || 'WIP'}'`,
      repoName,
      localPath: activeRepoPath,
      cancellable: false,
    });

    useTaskStore.getState().updateTaskProgress(taskId, {
      stage: 'Stashing',
      percent: 40,
      detail: 'Saving working directory state...',
    });

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

      useTaskStore.getState().completeTask(taskId);
    } catch (error: unknown) {
      const errMsg = toAppError(error, 'STASH_ERROR').message;
      useTaskStore.getState().failTask(taskId, errMsg);
      setError(toAppError(error, 'STASH_ERROR'));
    }
  };

  const handleApplyStash = async (index: number) => {
    if (!activeRepoPath) return;

    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';
    const taskId = useTaskStore.getState().addTask({
      type: 'stash',
      title: `Apply stash@{${index}}`,
      repoName,
      localPath: activeRepoPath,
      cancellable: false,
    });

    try {
      await GitService.applyStash(activeRepoPath, index);
      useLogStore.getState().addLog('success', 'Git', `Applied stash@{${index}}`);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      useTaskStore.getState().completeTask(taskId);
    } catch (error: unknown) {
      const errMsg = toAppError(error, 'STASH_ERROR').message;
      useTaskStore.getState().failTask(taskId, errMsg);
      setError(toAppError(error, 'STASH_ERROR'));
    }
  };

  const handlePopStash = async (index: number) => {
    if (!activeRepoPath) return;

    const repoName = activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';
    const taskId = useTaskStore.getState().addTask({
      type: 'stash',
      title: `Pop stash@{${index}}`,
      repoName,
      localPath: activeRepoPath,
      cancellable: false,
    });

    try {
      await GitService.popStash(activeRepoPath, index);
      useLogStore.getState().addLog('success', 'Git', `Popped stash@{${index}}`);

      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      loadStashes();
      useTaskStore.getState().completeTask(taskId);
    } catch (error: unknown) {
      const errMsg = toAppError(error, 'STASH_ERROR').message;
      useTaskStore.getState().failTask(taskId, errMsg);
      setError(toAppError(error, 'STASH_ERROR'));
    }
  };

  const handleConfirmDropStash = async () => {
    if (!activeRepoPath || dropStashIndex === null) return;
    const idx = dropStashIndex;
    setDropStashIndex(null);

    try {
      await GitService.dropStash(activeRepoPath, idx);
      useLogStore.getState().addLog('info', 'Git', `Dropped stash@{${idx}}`);
      if (selectedStashIndex === idx) {
        setSelectedStashIndex(null);
        setStashDiff('');
      }
      loadStashes();
    } catch (error: unknown) {
      setError(toAppError(error, 'STASH_ERROR'));
    }
  };

  const handleCopyDiff = () => {
    if (!stashDiff) return;
    navigator.clipboard.writeText(stashDiff);
    setCopiedDiff(true);
    setTimeout(() => setCopiedDiff(false), 2000);
  };

  const renderColoredDiff = (rawDiff: string) => {
    if (!rawDiff.trim()) {
      return (
        <div className="p-8 text-center text-xs text-text-muted italic">
          No textual modifications in this stash entry.
        </div>
      );
    }

    const lines = rawDiff.split('\n');
    return (
      <div className="font-mono text-[11.5px] leading-5 select-text">
        {lines.map((line, idx) => {
          const isHeader =
            line.startsWith('diff --git') ||
            line.startsWith('index ') ||
            line.startsWith('---') ||
            line.startsWith('+++');
          const isHunk = line.startsWith('@@');
          const isAdd = line.startsWith('+') && !line.startsWith('+++');
          const isDel = line.startsWith('-') && !line.startsWith('---');

          let bg = 'hover:bg-base-3/20';
          let textClass = 'text-text-secondary';

          if (isHeader) {
            bg = 'bg-base-3/40 text-text-muted font-bold py-0.5 border-b border-border/40';
            textClass = 'text-text-muted font-semibold';
          } else if (isHunk) {
            bg =
              'bg-commito-coral/10 text-commito-coral font-semibold border-y border-commito-coral/20 py-0.5';
            textClass = 'text-commito-coral';
          } else if (isAdd) {
            bg = 'bg-diff-add-bg text-diff-add-text';
            textClass = 'text-diff-add-text';
          } else if (isDel) {
            bg = 'bg-diff-remove-bg text-diff-remove-text';
            textClass = 'text-diff-remove-text';
          }

          return (
            <div
              key={idx}
              className={`flex px-2.5 py-0.2 whitespace-pre-wrap break-all border-b border-border/10 transition-colors ${bg}`}
            >
              <span className="w-9 text-right pr-2.5 text-text-faint select-none shrink-0 text-[10px] font-mono border-r border-border/30 mr-2">
                {idx + 1}
              </span>
              <span className={`flex-1 font-mono ${textClass}`}>{line}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 h-full bg-base-1 overflow-y-auto p-5 select-none space-y-4 font-sans">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-border/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0">
            <Archive className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-text-primary leading-none">Stash Management</h2>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xs bg-base-2 border border-border text-text-muted font-bold">
                {stashes.length} {stashes.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Shelve local uncommitted working changes and review saved patches
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadStashes}
            disabled={isLoading}
            className="p-1.5 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-text-muted hover:text-text-primary transition cursor-pointer"
            title="Refresh stashes"
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
          className="p-4 bg-base-2/90 border border-border rounded-sm space-y-3 shadow-md animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
              <Archive className="w-4 h-4 text-commito-coral" />
              <span>Save Working Copy to Stash</span>
            </h3>
          </div>

          <input
            type="text"
            placeholder="Stash message (optional, e.g. WIP before branch switch)"
            value={stashMessage}
            onChange={(e) => setStashMessage(e.target.value)}
            className="w-full px-3 py-1.5 bg-base-1 border border-border hover:border-border-strong rounded-sm text-xs text-text-primary focus:outline-none focus:border-border-strong font-sans"
            autoFocus
          />

          <div className="flex items-center justify-between pt-1">
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

      {/* Main Grid: Stashes List on Left, Diff Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[520px]">
        {/* Left Column (5 cols): Filter & Stashes List */}
        <div className="lg:col-span-5 flex flex-col gap-2">
          {/* Search Filter Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter stashes by message or branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong font-sans"
            />
          </div>

          {/* Stash Cards */}
          <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[640px] pr-0.5">
            {filteredStashes.length === 0 ? (
              <div className="p-8 text-center bg-base-2/50 border border-dashed border-border rounded-sm text-xs text-text-muted flex flex-col items-center justify-center gap-2">
                <Archive className="w-6 h-6 text-text-faint" />
                <span>
                  {searchQuery.trim()
                    ? 'No matching stashes found'
                    : 'No stashes recorded in this repository'}
                </span>
              </div>
            ) : (
              filteredStashes.map((s) => {
                const isSelected = selectedStashIndex === s.index;

                return (
                  <div
                    key={s.index}
                    onClick={() => handleViewDiff(s.index)}
                    className={`p-3 rounded-sm border flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-commito-activeBg border-commito-activeText/40 text-commito-activeText shadow-xs'
                        : 'bg-base-2/70 border-border hover:bg-base-2 text-text-primary'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 bg-base-3 border border-border rounded-xs font-mono text-[9.5px] text-text-muted font-bold">
                          stash@{`{${s.index}}`}
                        </span>
                        <h4 className="text-xs font-bold truncate text-text-primary">
                          {s.message || 'WIP on ' + s.branch}
                        </h4>
                      </div>
                      <div className="text-[10.5px] text-text-muted font-mono mt-1 flex items-center gap-1.5 truncate">
                        <span className="text-gitlab-orange flex items-center gap-1 shrink-0">
                          <GitBranch className="w-3 h-3" />
                          <span>{s.branch}</span>
                        </span>
                        <span>•</span>
                        <span className="truncate">{s.date}</span>
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
                        title="Pop stash (apply and drop)"
                      >
                        Pop
                      </Button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDropStashIndex(s.index);
                        }}
                        className="p-1 text-text-muted hover:text-git-removed transition cursor-pointer rounded-xs hover:bg-base-3"
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
        </div>

        {/* Right Column (7 cols): Diff Preview Panel */}
        <div className="lg:col-span-7 bg-base-2/80 border border-border rounded-sm flex flex-col min-h-0 overflow-hidden shadow-xs">
          <div className="px-3.5 py-2 border-b border-border bg-base-2 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5 text-commito-coral" />
              <span className="text-xs font-bold text-text-primary">Stash Diff Preview</span>
              {selectedStashIndex !== null && (
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-xs bg-base-3 text-text-muted border border-border">
                  stash@{`{${selectedStashIndex}}`}
                </span>
              )}
            </div>

            {stashDiff && (
              <button
                type="button"
                onClick={handleCopyDiff}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-sm bg-base-1 hover:bg-base-3 text-text-muted hover:text-text-primary border border-border transition cursor-pointer"
                title="Copy entire patch diff"
              >
                {copiedDiff ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Diff</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-base-0/60 p-0">
            {isDiffLoading ? (
              <div className="p-8 text-center text-xs text-text-muted italic flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-commito-coral" />
                <span>Loading stash patch...</span>
              </div>
            ) : selectedStashIndex !== null ? (
              renderColoredDiff(stashDiff)
            ) : (
              <div className="p-12 text-center text-xs text-text-muted italic flex flex-col items-center justify-center gap-2">
                <FolderOpen className="w-6 h-6 text-text-faint" />
                <span>Select a stash entry on the left to preview diff</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Danger Drop Stash Confirm Dialog */}
      <ConfirmDialog
        isOpen={dropStashIndex !== null}
        variant="danger"
        title="Drop Stash Entry"
        subtitle={dropStashIndex !== null ? `stash@{${dropStashIndex}}` : ''}
        description="Are you sure you want to permanently delete this stash? Any shelved modifications inside this stash will be permanently discarded."
        discardText="Drop Stash"
        cancelText="Cancel"
        onDiscard={handleConfirmDropStash}
        onCancel={() => setDropStashIndex(null)}
      />
    </div>
  );
};
