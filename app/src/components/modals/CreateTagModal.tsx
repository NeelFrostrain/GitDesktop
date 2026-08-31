import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useToastStore } from '../../store/useToastStore';
import { useLogStore } from '../../store/useLogStore';
import { useRemoteStore } from '../../store/remoteStore';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { formatBranchDropdownOptions } from '../../shared/utils/branchUtils';
import { Dropdown } from '../common/Dropdown';
import { Checkbox } from '../common/Checkbox';
import { Tabs } from '../common/Tabs';
import { Button } from '../common/Button';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { TagInfo } from '../../types/git';

export interface CreateTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCommitSha?: string | null;
  targetBranchName?: string | null;
  initialTagName?: string | null;
  initialMode?: 'new' | 'existing';
  onSuccess?: () => void;
}

export const CreateTagModal: React.FC<CreateTagModalProps> = ({
  isOpen,
  onClose,
  targetCommitSha,
  targetBranchName,
  initialTagName,
  initialMode = 'new',
  onSuccess,
}) => {
  const { activeRepoPath, branches, tags, status, setTags, setBranches } = useGitStore();
  const { remotes, activeRemote, loadRemotes } = useRemoteStore();

  // Mode: Create New Tag vs Manage Existing Tag
  const [tagMode, setTagMode] = useState<'new' | 'existing'>(initialMode);
  const [selectedExistingTag, setSelectedExistingTag] = useState<string>('');

  // New Tag Fields
  const [tagName, setTagName] = useState('');
  const [tagMessage, setTagMessage] = useState('');
  const [isAnnotated, setIsAnnotated] = useState(false);
  const [targetType, setTargetType] = useState<'branch' | 'head' | 'commit'>('branch');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [customCommitSha, setCustomCommitSha] = useState('');
  const [pushImmediately, setPushImmediately] = useState(true);
  const [selectedRemote, setSelectedRemote] = useState('origin');
  const [deleteFromRemote, setDeleteFromRemote] = useState(false);

  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);
  const [isPushingAll, setIsPushingAll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPushingExisting, setIsPushingExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Track unsaved form edits
  const isDirty = useMemo(() => {
    if (tagMode === 'new') {
      return tagName.trim() !== '' || tagMessage.trim() !== '' || customCommitSha.trim() !== '';
    }
    return false;
  }, [tagMode, tagName, tagMessage, customCommitSha]);

  const { showConfirm, requestClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard({
    isDirty,
    onClose,
  });

  const fetchRemoteTags = async () => {
    if (!activeRepoPath || isFetchingRemote) return;
    setIsFetchingRemote(true);
    setError(null);
    try {
      await GitService.fetchTags(activeRepoPath, selectedRemote || null);
      const updatedTags = await GitService.listTags(activeRepoPath);
      setTags(updatedTags || []);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Tags Synced',
        message: `Synced ${updatedTags.length} tags from cloud (${selectedRemote || 'origin'})`,
      });
    } catch (err: unknown) {
      useToastStore.getState().showToast({
        type: 'warning',
        title: 'Cloud Sync Failed',
        message: getErrorMessage(err) || 'Could not fetch remote tags from cloud',
      });
    } finally {
      setIsFetchingRemote(false);
    }
  };

  const handlePushAllTags = async () => {
    if (!activeRepoPath || isPushingAll) return;
    setIsPushingAll(true);
    setError(null);
    try {
      await GitService.pushTags(activeRepoPath, selectedRemote || null);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'All Tags Pushed',
        message: `Successfully pushed all local tags to cloud (${selectedRemote || 'origin'})`,
      });
    } catch (err: unknown) {
      const appErr = toAppError(err);
      setError(appErr.message || getErrorMessage(err) || 'Failed to push all tags to remote');
    } finally {
      setIsPushingAll(false);
    }
  };

  // Fetch branches, tags, and remotes whenever modal opens
  useEffect(() => {
    if (isOpen && activeRepoPath) {
      setIsLoadingBranches(true);
      setIsLoadingTags(true);

      GitService.listBranches(activeRepoPath)
        .then((bList) => {
          if (bList) setBranches(bList);
        })
        .catch(() => {})
        .finally(() => setIsLoadingBranches(false));

      // Fetch from remote cloud and then list local tags
      GitService.fetchTags(activeRepoPath)
        .catch(() => {})
        .finally(() => {
          GitService.listTags(activeRepoPath)
            .then((tList) => {
              if (tList) setTags(tList);
            })
            .catch(() => {})
            .finally(() => setIsLoadingTags(false));
        });

      loadRemotes(activeRepoPath).catch(() => {});
    }
  }, [isOpen, activeRepoPath, setBranches, setTags, loadRemotes]);

  // Reset or initialize fields on open
  useEffect(() => {
    if (isOpen) {
      setTagMode(initialMode);
      setTagName('');
      setTagMessage('');
      setIsAnnotated(false);
      setError(null);
      setIsSubmitting(false);
      setIsDeleting(false);
      setIsPushingExisting(false);
      setDeleteFromRemote(false);

      if (targetCommitSha) {
        setTargetType('commit');
        setCustomCommitSha(targetCommitSha);
      } else if (targetBranchName) {
        setTargetType('branch');
        setSelectedBranch(targetBranchName);
      } else {
        const current =
          status?.current_branch ||
          branches.find((b) => b.is_current)?.name ||
          branches[0]?.name ||
          'main';
        setTargetType('branch');
        setSelectedBranch(current);
      }

      if (activeRemote) {
        setSelectedRemote(activeRemote);
      } else if (remotes.length > 0) {
        setSelectedRemote(remotes[0].name);
      }

      if (initialTagName) {
        setSelectedExistingTag(initialTagName);
      } else if (tags.length > 0) {
        setSelectedExistingTag(tags[0].name);
      } else {
        setSelectedExistingTag('');
      }

      if (initialMode === 'new') {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      }
    }
  }, [
    isOpen,
    initialMode,
    initialTagName,
    targetCommitSha,
    targetBranchName,
    status?.current_branch,
    activeRemote,
    remotes,
    tags,
  ]);

  // Keep selectedBranch synced if branches load asynchronously
  useEffect(() => {
    if (isOpen && branches.length > 0 && !targetBranchName && !targetCommitSha) {
      setSelectedBranch((prev) => {
        if (prev && branches.some((b) => b.name === prev)) return prev;
        const current =
          status?.current_branch ||
          branches.find((b) => b.is_current)?.name ||
          branches[0]?.name ||
          'main';
        return current;
      });
    }
  }, [isOpen, branches, targetBranchName, targetCommitSha, status?.current_branch]);

  // Keep selectedExistingTag valid
  useEffect(() => {
    if (isOpen && tags.length > 0 && !selectedExistingTag) {
      setSelectedExistingTag(tags[0].name);
    }
  }, [isOpen, tags, selectedExistingTag]);

  // Transform branches for Custom Dropdown
  const branchOptions = useMemo(() => {
    return formatBranchDropdownOptions(branches);
  }, [branches]);

  // Transform remotes for Custom Dropdown
  const remoteOptions = useMemo(() => {
    return remotes.map((r) => ({
      value: r.name,
      label: r.name,
      description: r.url || r.push_url || undefined,
    }));
  }, [remotes]);

  // Transform existing tags for Dropdown
  const existingTagOptions = useMemo(() => {
    return tags.map((t) => ({
      value: t.name,
      label: t.name,
      badge: t.sha ? t.sha.slice(0, 7) : undefined,
      description: t.message || (t.is_annotated ? 'Annotated tag' : 'Lightweight tag'),
      icon: <Tag className="w-3.5 h-3.5 text-commito-coral shrink-0" />,
    }));
  }, [tags]);

  // Currently selected tag info
  const currentTagInfo: TagInfo | undefined = useMemo(() => {
    return tags.find((t) => t.name === selectedExistingTag);
  }, [tags, selectedExistingTag]);

  if (!isOpen) return null;

  // Handle Create New Tag
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
        .addLog(
          'success',
          'Git',
          `Created tag '${cleanTagName}' ${targetRef ? `on ${targetRef}` : ''}`
        );

      // 2. Optionally push immediately
      if (pushImmediately) {
        try {
          await GitService.pushSpecificTag(activeRepoPath, cleanTagName, selectedRemote || null);
          useLogStore
            .getState()
            .addLog(
              'success',
              'Git',
              `Pushed tag '${cleanTagName}' to remote '${selectedRemote || 'origin'}'`
            );
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

  // Handle Delete Tag
  const handleDeleteTag = async () => {
    if (!activeRepoPath || !selectedExistingTag || isDeleting) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete tag '${selectedExistingTag}'?${
        deleteFromRemote ? '\nThis will also remove the tag from the remote repository.' : ''
      }`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      // 1. Delete local tag
      await GitService.deleteTag(activeRepoPath, selectedExistingTag);
      useLogStore.getState().addLog('success', 'Git', `Deleted local tag '${selectedExistingTag}'`);

      // 2. Optionally delete remote tag
      if (deleteFromRemote) {
        try {
          await GitService.deleteRemoteTag(
            activeRepoPath,
            selectedExistingTag,
            selectedRemote || null
          );
          useLogStore
            .getState()
            .addLog(
              'success',
              'Git',
              `Deleted remote tag '${selectedExistingTag}' from '${selectedRemote || 'origin'}'`
            );
        } catch (remoteErr: unknown) {
          useToastStore.getState().showToast({
            type: 'warning',
            title: 'Remote Tag Deletion Failed',
            message: `Local tag was removed, but remote tag could not be deleted: ${getErrorMessage(remoteErr)}`,
          });
        }
      }

      // 3. Refresh tags
      const updatedTags = await GitService.listTags(activeRepoPath);
      setTags(updatedTags || []);

      useToastStore.getState().showToast({
        type: 'success',
        title: 'Tag Deleted',
        message: `Successfully removed tag '${selectedExistingTag}'`,
      });

      if (updatedTags && updatedTags.length > 0) {
        setSelectedExistingTag(updatedTags[0].name);
      } else {
        setSelectedExistingTag('');
        setTagMode('new');
      }

      onSuccess?.();
    } catch (err: unknown) {
      const appErr = toAppError(err);
      setError(appErr.message || getErrorMessage(err) || 'Failed to delete tag');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Push Existing Tag to Remote
  const handlePushExistingTag = async () => {
    if (!activeRepoPath || !selectedExistingTag || isPushingExisting) return;

    setIsPushingExisting(true);
    setError(null);

    try {
      await GitService.pushSpecificTag(activeRepoPath, selectedExistingTag, selectedRemote || null);
      useLogStore
        .getState()
        .addLog(
          'success',
          'Git',
          `Pushed tag '${selectedExistingTag}' to remote '${selectedRemote || 'origin'}'`
        );

      useToastStore.getState().showToast({
        type: 'success',
        title: 'Tag Pushed',
        message: `Successfully pushed tag '${selectedExistingTag}' to '${selectedRemote || 'origin'}'`,
      });
    } catch (err: unknown) {
      const appErr = toAppError(err);
      setError(appErr.message || getErrorMessage(err) || 'Failed to push tag to remote');
    } finally {
      setIsPushingExisting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting && !isDeleting && !isPushingExisting) {
      requestClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-10000 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none font-sans animate-in fade-in duration-100"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting && !isDeleting && !isPushingExisting) {
          requestClose();
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-lg bg-base-0 border border-border-strong rounded-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Compact Single-Row with Tabs) */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* <div className="w-6 h-6 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
              <Tag className="w-3.5 h-3.5" />
            </div> */}
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-bold text-xs text-text-primary leading-none">
                {tagMode === 'new' ? 'New Tag' : 'Manage Tags'}
              </h3>
              {selectedRemote && (
                <>
                  <span className="text-border hidden sm:inline">•</span>
                  <span className="text-[11px] text-text-muted truncate hidden sm:inline font-mono">
                    {selectedRemote}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Tabs<'new' | 'existing'>
              tabs={[
                {
                  id: 'new',
                  label: 'Create',
                  icon: <Tag className="w-3 h-3" />,
                },
                {
                  id: 'existing',
                  label: `Tags (${tags.length})`,
                  icon: <Bookmark className="w-3 h-3" />,
                },
              ]}
              activeTab={tagMode}
              onChange={(mode) => {
                setTagMode(mode);
                setError(null);
              }}
              size="xs"
              variant="segmented"
              ariaLabel="Tag management mode"
            />

            <button
              onClick={requestClose}
              disabled={isSubmitting || isDeleting || isPushingExisting}
              className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer disabled:opacity-50"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {tagMode === 'new' ? (
          <form onSubmit={handleSubmit} className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
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
                className="w-full h-8 px-2.5 font-mono text-xs text-text-primary bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm focus:outline-none transition shadow-2xs placeholder:text-text-faint"
                required
              />
            </div>

            {/* Target Base (Branch / HEAD / Commit) */}
            <div className="space-y-2">
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint block">
                Target Reference
              </label>

              <Tabs<'branch' | 'head' | 'commit'>
                tabs={[
                  {
                    id: 'branch',
                    label: 'On Branch',
                    icon: <GitBranch className="w-3.5 h-3.5" />,
                  },
                  {
                    id: 'head',
                    label: 'HEAD',
                    icon: <Bookmark className="w-3.5 h-3.5" />,
                  },
                  {
                    id: 'commit',
                    label: 'Commit SHA',
                    icon: <GitCommit className="w-3.5 h-3.5" />,
                  },
                ]}
                activeTab={targetType}
                onChange={setTargetType}
                fullWidth
                size="md"
                ariaLabel="Tag target reference"
              />

              {/* Custom Branch Dropdown */}
              {targetType === 'branch' && (
                <div className="pt-0.5">
                  <Dropdown
                    options={branchOptions}
                    value={selectedBranch}
                    onChange={(val) => setSelectedBranch(val)}
                    disabled={isSubmitting}
                    placeholder={
                      isLoadingBranches ? 'Loading branches...' : 'Select target branch...'
                    }
                    size="md"
                  />
                </div>
              )}

              {/* Custom Commit Input */}
              {targetType === 'commit' && (
                <div className="pt-0.5">
                  <input
                    type="text"
                    placeholder="e.g. 8f9b1c2 or full SHA"
                    value={customCommitSha}
                    onChange={(e) => setCustomCommitSha(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-8 px-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs font-mono text-text-primary focus:outline-none transition shadow-2xs"
                    required={targetType === 'commit'}
                  />
                </div>
              )}
            </div>

            {/* Tag Annotation Section with Custom Checkbox */}
            <div className="p-3 bg-base-1 border border-border rounded-sm space-y-2">
              <Checkbox
                checked={isAnnotated}
                onChange={(checked) => setIsAnnotated(checked)}
                disabled={isSubmitting}
                label={
                  <span className="text-xs font-semibold text-text-primary">
                    Annotated Tag (include release notes or message)
                  </span>
                }
              />

              {isAnnotated && (
                <textarea
                  placeholder="Write release notes, version changelog, or annotation message..."
                  value={tagMessage}
                  onChange={(e) => setTagMessage(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full p-2.5 bg-base-0 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-inner font-sans resize-none"
                />
              )}
            </div>

            {/* Remote Push Section with Custom Checkbox & Custom Dropdown */}
            <div className="p-3 bg-base-1 border border-border rounded-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <Checkbox
                  checked={pushImmediately}
                  onChange={(checked) => setPushImmediately(checked)}
                  disabled={isSubmitting}
                  label={
                    <span className="text-xs font-semibold text-text-primary">
                      Push tag to remote immediately
                    </span>
                  }
                />
                <Upload className="w-3.5 h-3.5 text-text-muted" />
              </div>

              {pushImmediately && remotes.length > 1 && (
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-[11px] text-text-muted font-medium shrink-0">
                    Target Remote:
                  </span>
                  <div className="flex-1">
                    <Dropdown
                      options={remoteOptions}
                      value={selectedRemote}
                      onChange={(val) => setSelectedRemote(val)}
                      disabled={isSubmitting}
                      placeholder="Select remote..."
                      size="sm"
                    />
                  </div>
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={requestClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="coral"
                size="sm"
                disabled={isSubmitting || !tagName.trim()}
                isLoading={isSubmitting}
                leftIcon={!isSubmitting ? <Check className="w-3.5 h-3.5" /> : undefined}
              >
                Create Tag
              </Button>
            </div>
          </form>
        ) : (
          /* Manage Existing Tag Mode */
          <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
            {tags.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Tag className="w-8 h-8 text-text-faint mx-auto" />
                <p className="text-xs font-medium text-text-muted">
                  No existing tags found in this repository.
                </p>
                <button
                  type="button"
                  onClick={() => setTagMode('new')}
                  className="h-7 px-3 bg-commito-coral/10 hover:bg-commito-coral/20 border border-commito-coral/30 text-commito-coral rounded-sm text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Tag className="w-3 h-3" />
                  <span>Create First Tag</span>
                </button>
              </div>
            ) : (
              <>
                {/* Select Tag Dropdown with Cloud Sync Button */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-text-primary block">
                      Select Tag to Manage
                    </label>
                    <button
                      type="button"
                      onClick={fetchRemoteTags}
                      disabled={isFetchingRemote || isDeleting || isPushingExisting}
                      className="text-[11px] font-semibold text-commito-coral hover:text-commito-coralLight flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                      title="Fetch latest tags from cloud remote repository"
                    >
                      <RefreshCw className={`w-3 h-3 ${isFetchingRemote ? 'animate-spin' : ''}`} />
                      <span>{isFetchingRemote ? 'Syncing...' : 'Sync with Cloud'}</span>
                    </button>
                  </div>
                  <Dropdown
                    options={existingTagOptions}
                    value={selectedExistingTag}
                    onChange={(val) => {
                      setSelectedExistingTag(val);
                      setError(null);
                    }}
                    disabled={isDeleting || isPushingExisting || isFetchingRemote}
                    placeholder={isLoadingTags ? 'Loading tags...' : 'Choose a tag...'}
                    size="md"
                  />
                </div>

                {/* Tag Details Card */}
                {currentTagInfo && (
                  <div className="p-3 bg-base-1 border border-border rounded-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
                        Tag Information
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-xs border ${
                          currentTagInfo.is_annotated
                            ? 'bg-commito-coral/10 border-commito-coral/30 text-commito-coral font-semibold'
                            : 'bg-base-2 border-border text-text-muted'
                        }`}
                      >
                        {currentTagInfo.is_annotated ? 'Annotated Tag' : 'Lightweight'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-base-0 border border-border/70 rounded-xs">
                        <span className="text-[10px] text-text-faint block uppercase font-mono">
                          Target SHA
                        </span>
                        <span className="font-mono text-text-primary font-bold">
                          {currentTagInfo.sha || 'Unknown'}
                        </span>
                      </div>
                      <div className="p-2 bg-base-0 border border-border/70 rounded-xs">
                        <span className="text-[10px] text-text-faint block uppercase font-mono">
                          Tagger / Author
                        </span>
                        <span className="text-text-primary truncate block">
                          {currentTagInfo.tagger_name || 'Git Commit Author'}
                        </span>
                      </div>
                    </div>

                    {currentTagInfo.message && (
                      <div className="p-2.5 bg-base-0 border border-border/70 rounded-xs space-y-1">
                        <span className="text-[10px] text-text-faint block uppercase font-mono">
                          Tag Message
                        </span>
                        <p className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
                          {currentTagInfo.message}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Remote Actions Box */}
                <div className="p-3 bg-base-1 border border-border rounded-sm space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-commito-coral" />
                      <span>Remote Cloud Synchronization</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handlePushAllTags}
                        disabled={isPushingAll || isPushingExisting || isDeleting}
                        className="h-6.5 px-2 bg-base-0 hover:bg-base-2 border border-border text-[11px] font-medium text-text-secondary rounded-sm flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                        title="Push all local repository tags to remote"
                      >
                        {isPushingAll ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                        <span>Push All Tags</span>
                      </button>

                      <button
                        type="button"
                        onClick={handlePushExistingTag}
                        disabled={
                          isPushingExisting || isPushingAll || isDeleting || !selectedExistingTag
                        }
                        className="h-6.5 px-2.5 bg-commito-coral/15 hover:bg-commito-coral/25 border border-commito-coral/35 text-commito-coral rounded-sm text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                      >
                        {isPushingExisting ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Pushing...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3 h-3" />
                            <span>Push Tag</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {remotes.length > 1 && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-text-muted shrink-0">Remote:</span>
                      <div className="flex-1">
                        <Dropdown
                          options={remoteOptions}
                          value={selectedRemote}
                          onChange={(val) => setSelectedRemote(val)}
                          disabled={isPushingExisting || isDeleting}
                          size="sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-1 border-t border-border/60">
                    <Checkbox
                      checked={deleteFromRemote}
                      onChange={(checked) => setDeleteFromRemote(checked)}
                      disabled={isDeleting}
                      label={
                        <span className="text-[11.5px] text-text-muted">
                          Also delete from remote repository when deleting tag
                        </span>
                      }
                    />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 p-2.5 rounded-sm bg-git-removed-bg border border-git-removed/40 text-git-removed text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="truncate">{error}</span>
                  </div>
                )}

                {/* Manage Footer Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/80">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteTag}
                    disabled={isDeleting || isPushingExisting || !selectedExistingTag}
                    isLoading={isDeleting}
                    leftIcon={!isDeleting ? <Trash2 className="w-3.5 h-3.5" /> : undefined}
                  >
                    Delete Tag
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onClose}
                    disabled={isDeleting || isPushingExisting}
                  >
                    Done
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Unsaved Changes Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirm}
        title="Unsaved Tag Changes"
        description="You have unsaved changes in this tag. If you leave now, your tag name and message will be discarded."
        discardText="Discard Changes"
        saveText={tagName.trim() ? 'Create Tag' : undefined}
        cancelText="Keep Editing"
        isSaving={isSubmitting}
        onDiscard={confirmDiscard}
        onSave={() => {
          handleSubmit({ preventDefault: () => {} } as React.FormEvent);
        }}
        onCancel={cancelDiscard}
      />
    </div>,
    document.body
  );
};
