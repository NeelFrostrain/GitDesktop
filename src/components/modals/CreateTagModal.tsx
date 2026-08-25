import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Tag,
  X,
  Loader2,
  GitBranch,
  GitCommit,
  Upload,
  AlertCircle,
  Bookmark,
  Check,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useToastStore } from '../../store/useToastStore';
import { useLogStore } from '../../store/useLogStore';
import { useRemoteStore } from '../../store/remoteStore';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';

export interface CreateTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCommitSha?: string | null;
  targetBranchName?: string | null;
  onSuccess?: () => void;
}

export const CreateTagModal: React.FC<CreateTagModalProps> = ({
  isOpen,
  onClose,
  targetCommitSha,
  targetBranchName,
  onSuccess,
}) => {
  const { activeRepoPath, branches, status, setTags } = useGitStore();
  const { remotes, activeRemote } = useRemoteStore();

  const [tagName, setTagName] = useState('');
  const [tagMessage, setTagMessage] = useState('');
  const [isAnnotated, setIsAnnotated] = useState(false);
  const [targetType, setTargetType] = useState<'branch' | 'head' | 'commit'>('branch');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [customCommitSha, setCustomCommitSha] = useState('');
  const [pushImmediately, setPushImmediately] = useState(true);
  const [selectedRemote, setSelectedRemote] = useState('origin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTagName('');
      setTagMessage('');
      setIsAnnotated(false);
      setError(null);
      setIsSubmitting(false);

      if (targetCommitSha) {
        setTargetType('commit');
        setCustomCommitSha(targetCommitSha);
      } else if (targetBranchName) {
        setTargetType('branch');
        setSelectedBranch(targetBranchName);
      } else {
        const current = status?.current_branch || branches[0]?.name || 'main';
        setTargetType('branch');
        setSelectedBranch(current);
      }

      if (activeRemote) {
        setSelectedRemote(activeRemote);
      } else if (remotes.length > 0) {
        setSelectedRemote(remotes[0].name);
      }

      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, targetCommitSha, targetBranchName, status, branches, activeRemote, remotes]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !tagName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const cleanTagName = tagName.trim();
    let targetRef: string | null = null;

    if (targetType === 'branch') {
      targetRef = selectedBranch || null;
    } else if (targetType === 'commit') {
      targetRef = customCommitSha.trim() || null;
    } else {
      targetRef = 'HEAD';
    }

    try {
      // 1. Create tag
      await GitService.createTag(
        activeRepoPath,
        cleanTagName,
        isAnnotated ? tagMessage.trim() || undefined : undefined,
        targetRef
      );

      useLogStore
        .getState()
        .addLog('success', 'Git', `Created tag '${cleanTagName}' ${targetRef ? `on ${targetRef}` : ''}`);

      // 2. Optionally push immediately
      if (pushImmediately) {
        try {
          await GitService.pushSpecificTag(activeRepoPath, cleanTagName, selectedRemote || null);
          useLogStore
            .getState()
            .addLog('success', 'Git', `Pushed tag '${cleanTagName}' to remote '${selectedRemote || 'origin'}'`);
        } catch (pushErr: unknown) {
          useToastStore.getState().showToast({
            type: 'warning',
            title: 'Tag Created (Push Failed)',
            message: `Tag '${cleanTagName}' was created locally, but could not be pushed: ${getErrorMessage(pushErr)}`,
          });
        }
      }

      // 3. Refresh tags
      const updatedTags = await GitService.listTags(activeRepoPath);
      setTags(updatedTags || []);

      useToastStore.getState().showToast({
        type: 'success',
        title: 'Tag Created',
        message: `Successfully created tag '${cleanTagName}'${pushImmediately ? ' and pushed to remote' : ''}`,
      });

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const appErr = toAppError(err);
      setError(appErr.message || getErrorMessage(err) || 'Failed to create tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none font-sans animate-in fade-in duration-100"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-lg bg-base-0 border border-border-strong rounded-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-base-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
              <Tag className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-text-primary leading-tight">Create Git Tag</h3>
              <p className="text-[10.5px] text-text-muted mt-0.5 leading-none">
                Create a release tag or annotated marker on branch or commit
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer disabled:opacity-50"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Tag Name Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-primary block">
              Tag Name <span className="text-commito-coral">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. v1.0.0, release-2026.1, beta-0.2"
              value={tagName}
              onChange={(e) => {
                setTagName(e.target.value);
                if (error) setError(null);
              }}
              disabled={isSubmitting}
              className="w-full h-8 px-2.5 font-mono text-xs text-text-primary bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral focus:ring-1 focus:ring-commito-coral/30 rounded-sm focus:outline-none transition shadow-2xs placeholder:text-text-faint"
              required
            />
          </div>

          {/* Target Base (Branch / HEAD / Commit) */}
          <div className="space-y-2">
            <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint block">
              Target Reference
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetType('branch')}
                className={`h-8 px-2.5 rounded-sm border text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  targetType === 'branch'
                    ? 'bg-commito-coral/15 border-commito-coral/40 text-commito-coral font-semibold'
                    : 'bg-base-1 border-border text-text-secondary hover:text-text-primary hover:bg-base-2'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>On Branch</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('head')}
                className={`h-8 px-2.5 rounded-sm border text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  targetType === 'head'
                    ? 'bg-commito-coral/15 border-commito-coral/40 text-commito-coral font-semibold'
                    : 'bg-base-1 border-border text-text-secondary hover:text-text-primary hover:bg-base-2'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>HEAD</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('commit')}
                className={`h-8 px-2.5 rounded-sm border text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  targetType === 'commit'
                    ? 'bg-commito-coral/15 border-commito-coral/40 text-commito-coral font-semibold'
                    : 'bg-base-1 border-border text-text-secondary hover:text-text-primary hover:bg-base-2'
                }`}
              >
                <GitCommit className="w-3.5 h-3.5" />
                <span>Commit SHA</span>
              </button>
            </div>

            {/* Branch Selector (when Target = Branch) */}
            {targetType === 'branch' && (
              <div className="pt-1">
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full h-8 px-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs font-mono text-text-primary focus:outline-none transition cursor-pointer shadow-2xs"
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name} className="bg-base-1 text-text-primary">
                      {b.name} {b.is_current ? '(current branch)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Commit Input (when Target = Commit) */}
            {targetType === 'commit' && (
              <div className="pt-1">
                <input
                  type="text"
                  placeholder="e.g. 8f9b1c2 or full SHA"
                  value={customCommitSha}
                  onChange={(e) => setCustomCommitSha(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full h-8 px-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs font-mono text-text-primary focus:outline-none transition shadow-2xs"
                  required={targetType === 'commit'}
                />
              </div>
            )}
          </div>

          {/* Tag Annotation Toggle & Message */}
          <div className="space-y-2 p-3 bg-base-1 border border-border rounded-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnnotated}
                onChange={(e) => setIsAnnotated(e.target.checked)}
                className="w-3.5 h-3.5 accent-commito-coral rounded-xs cursor-pointer"
              />
              <span className="text-xs font-semibold text-text-primary">
                Annotated Tag (include release notes or message)
              </span>
            </label>

            {isAnnotated && (
              <textarea
                placeholder="Write release notes, version changelog, or annotation message..."
                value={tagMessage}
                onChange={(e) => setTagMessage(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                className="w-full p-2.5 bg-base-0 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-inner font-sans resize-none"
              />
            )}
          </div>

          {/* Remote Push Options */}
          <div className="p-3 bg-base-1 border border-border rounded-sm space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pushImmediately}
                  onChange={(e) => setPushImmediately(e.target.checked)}
                  className="w-3.5 h-3.5 accent-commito-coral rounded-xs cursor-pointer"
                />
                <span className="text-xs font-semibold text-text-primary">
                  Push tag to remote immediately
                </span>
              </div>
              <Upload className="w-3.5 h-3.5 text-text-muted" />
            </label>

            {pushImmediately && remotes.length > 1 && (
              <div className="pt-1 flex items-center gap-2">
                <span className="text-[11px] text-text-muted font-medium">Target Remote:</span>
                <select
                  value={selectedRemote}
                  onChange={(e) => setSelectedRemote(e.target.value)}
                  className="h-7 px-2 bg-base-0 border border-border rounded-sm text-xs font-mono text-text-primary focus:outline-none cursor-pointer"
                >
                  {remotes.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name} ({r.url || r.push_url})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-sm bg-git-removed-bg border border-git-removed/40 text-git-removed text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-7.5 px-3.5 bg-base-1 hover:bg-base-2 border border-border rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !tagName.trim()}
              className="h-7.5 px-4 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating & Pushing...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Create Tag</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
