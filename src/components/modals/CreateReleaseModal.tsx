import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  X,
  Loader2,
  GitBranch,
  Tag,
  Upload,
  AlertCircle,
  Check,
  Eye,
  Edit3,
  ListPlus,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useToastStore } from '../../store/useToastStore';
import { useLogStore } from '../../store/useLogStore';
import { useRemoteStore } from '../../store/remoteStore';
import { ReleaseService } from '../../services/git/releaseService';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { Dropdown } from '../common/Dropdown';
import { Checkbox } from '../common/Checkbox';
import { ReleaseInfo } from '../../types/git';

export interface CreateReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRelease?: ReleaseInfo | null;
  onSuccess?: () => void;
}

export const CreateReleaseModal: React.FC<CreateReleaseModalProps> = ({
  isOpen,
  onClose,
  initialRelease,
  onSuccess,
}) => {
  const { activeRepoPath, branches, status, tags, setTags, setReleases, setBranches } = useGitStore();
  const { remotes, activeRemote, loadRemotes } = useRemoteStore();

  const isEditMode = Boolean(initialRelease);

  const [tagName, setTagName] = useState('');
  const [releaseName, setReleaseName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [tagSource, setTagSource] = useState<'existing' | 'new'>('new');
  const [selectedExistingTag, setSelectedExistingTag] = useState('');
  const [pushImmediately, setPushImmediately] = useState(true);
  const [isPrerelease, setIsPrerelease] = useState(false);
  const [selectedRemote, setSelectedRemote] = useState('origin');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch branches, tags, and remotes whenever the modal opens
  useEffect(() => {
    if (isOpen && activeRepoPath) {
      setIsLoadingBranches(true);
      GitService.listBranches(activeRepoPath)
        .then((bList) => {
          if (bList) setBranches(bList);
        })
        .catch(() => {})
        .finally(() => {
          setIsLoadingBranches(false);
        });

      GitService.listTags(activeRepoPath)
        .then((tList) => {
          if (tList) setTags(tList);
        })
        .catch(() => {});

      loadRemotes(activeRepoPath).catch(() => {});
    }
  }, [isOpen, activeRepoPath, setBranches, setTags, loadRemotes]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsSubmitting(false);
      setActiveTab('write');

      if (initialRelease) {
        setTagName(initialRelease.tag_name);
        setReleaseName(initialRelease.name);
        setDescription(initialRelease.description);
        setIsPrerelease(Boolean(initialRelease.is_prerelease));
        setTagSource('existing');
        setSelectedExistingTag(initialRelease.tag_name);
      } else {
        setTagName('');
        setReleaseName('');
        setDescription('');
        setIsPrerelease(false);

        if (tags.length > 0) {
          setTagSource('new');
          setSelectedExistingTag(tags[0].name);
        } else {
          setTagSource('new');
        }

        const current = status?.current_branch || branches.find((b) => b.is_current)?.name || branches[0]?.name || 'main';
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
  }, [isOpen, initialRelease, status?.current_branch, activeRemote, remotes]);

  // Keep selectedBranch synced if branches load asynchronously
  useEffect(() => {
    if (isOpen && !initialRelease && branches.length > 0) {
      setSelectedBranch((prev) => {
        if (prev && branches.some((b) => b.name === prev)) return prev;
        const current = status?.current_branch || branches.find((b) => b.is_current)?.name || branches[0]?.name || 'main';
        return current;
      });
    }
  }, [isOpen, initialRelease, branches, status?.current_branch]);

  // Keep selectedExistingTag synced if tags load asynchronously
  useEffect(() => {
    if (isOpen && !initialRelease && tags.length > 0) {
      setSelectedExistingTag((prev) => {
        if (prev && tags.some((t) => t.name === prev)) return prev;
        return tags[0].name;
      });
    }
  }, [isOpen, initialRelease, tags]);

  // Branch options for dropdown
  const branchOptions = useMemo(() => {
    return branches.map((b) => ({
      value: b.name,
      label: b.name,
      icon: <GitBranch className="w-3.5 h-3.5 text-commito-coral" />,
      badge: b.is_current ? 'current' : undefined,
    }));
  }, [branches]);

  // Tag options for existing tags dropdown
  const tagOptions = useMemo(() => {
    return tags.map((t) => ({
      value: t.name,
      label: t.name,
      icon: <Tag className="w-3.5 h-3.5 text-amber-400" />,
      badge: t.sha ? t.sha.slice(0, 7) : undefined,
    }));
  }, [tags]);

  // Remote options for dropdown
  const remoteOptions = useMemo(() => {
    return remotes.map((r) => ({
      value: r.name,
      label: r.name,
      description: r.url || r.push_url || undefined,
    }));
  }, [remotes]);

  if (!isOpen) return null;

  const handleGenerateNotesFromCommits = async () => {
    if (!activeRepoPath) return;
    try {
      const history = await GitService.getCommitHistory(activeRepoPath, 15, 0);
      if (history && history.length > 0) {
        const commitBullets = history
          .map((c) => `- ${c.message} (${c.short_sha}) - @${c.author_name}`)
          .join('\n');
        const generated = `### What's Changed in this Release\n\n${commitBullets}\n\n**Full Changelog**: https://github.com/repository/commits/${tagName || 'v1.0.0'}`;
        setDescription(generated);
      }
    } catch {
      useToastStore.getState().showToast({
        type: 'info',
        title: 'Generate Notes',
        message: 'Could not automatically load commits for notes generation',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || isSubmitting) return;

    const finalTag = isEditMode
      ? initialRelease?.tag_name || tagName.trim()
      : tagSource === 'existing'
      ? selectedExistingTag
      : tagName.trim();

    const finalTitle = releaseName.trim() || `Release ${finalTag}`;
    const finalDesc = description.trim();

    if (!finalTag) {
      setError('A valid tag name is required for this release.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditMode) {
        await ReleaseService.updateRelease(
          activeRepoPath,
          finalTag,
          finalTitle,
          finalDesc,
          pushImmediately,
          selectedRemote || null
        );

        useLogStore.getState().addLog('success', 'Git', `Updated release '${finalTitle}' (${finalTag})`);
        useToastStore.getState().showToast({
          type: 'success',
          title: 'Release Updated',
          message: `Successfully updated release '${finalTitle}'`,
        });
      } else {
        await ReleaseService.createRelease(
          activeRepoPath,
          finalTag,
          finalTitle,
          finalDesc,
          selectedBranch || null,
          pushImmediately,
          selectedRemote || null
        );

        useLogStore.getState().addLog('success', 'Git', `Created release '${finalTitle}' (${finalTag})`);
        useToastStore.getState().showToast({
          type: 'success',
          title: 'Release Created',
          message: `Successfully published release '${finalTitle}'${pushImmediately ? ' to remote' : ''}`,
        });
      }

      // Refresh releases & tags in store
      const updatedReleases = await ReleaseService.listReleases(activeRepoPath);
      setReleases(updatedReleases || []);

      const updatedTags = await GitService.listTags(activeRepoPath);
      setTags(updatedTags || []);

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const appErr = toAppError(err);
      setError(appErr.message || getErrorMessage(err) || 'Failed to save release');
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
        className="w-full max-w-xl bg-base-0 border border-border-strong rounded-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-base-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-text-primary leading-tight">
                {isEditMode ? 'Edit Release' : 'Draft New Release'}
              </h3>
              <p className="text-[10.5px] text-text-muted mt-0.5 leading-none">
                {isEditMode
                  ? `Update release title, notes, and changelog for tag ${initialRelease?.tag_name}`
                  : 'Publish a versioned release package with release notes and git tag'}
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
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 max-h-[82vh] overflow-y-auto">
          {/* Tag Configuration */}
          {!isEditMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint block">
                  Release Tag <span className="text-commito-coral">*</span>
                </label>
                {tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTagSource('new')}
                      className={`px-2 py-0.5 rounded-xs text-[10.5px] font-semibold transition cursor-pointer ${
                        tagSource === 'new'
                          ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/40'
                          : 'text-text-muted hover:text-text-primary bg-base-1 border border-border'
                      }`}
                    >
                      New Tag
                    </button>
                    <button
                      type="button"
                      onClick={() => setTagSource('existing')}
                      className={`px-2 py-0.5 rounded-xs text-[10.5px] font-semibold transition cursor-pointer ${
                        tagSource === 'existing'
                          ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/40'
                          : 'text-text-muted hover:text-text-primary bg-base-1 border border-border'
                      }`}
                    >
                      Existing Tag
                    </button>
                  </div>
                )}
              </div>

              {tagSource === 'new' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Tag Name (e.g. v2.7.0)"
                      value={tagName}
                      onChange={(e) => {
                        setTagName(e.target.value);
                        if (error) setError(null);
                      }}
                      disabled={isSubmitting}
                      className="w-full h-8 px-2.5 font-mono text-xs text-text-primary bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm focus:outline-none transition shadow-2xs placeholder:text-text-faint"
                      required
                    />
                  </div>

                  <div>
                    <Dropdown
                      options={branchOptions}
                      value={selectedBranch}
                      onChange={(val) => setSelectedBranch(val)}
                      disabled={isSubmitting}
                      placeholder={isLoadingBranches ? 'Loading branches...' : 'Target Branch...'}
                      size="md"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Dropdown
                    options={tagOptions}
                    value={selectedExistingTag}
                    onChange={(val) => setSelectedExistingTag(val)}
                    disabled={isSubmitting}
                    placeholder="Select existing tag..."
                    size="md"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-2.5 bg-base-1 border border-border rounded-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-mono text-xs font-bold text-text-primary">
                  {initialRelease?.tag_name}
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-muted">Target Tag</span>
            </div>
          )}

          {/* Release Title Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-primary block">
              Release Title
            </label>
            <input
              type="text"
              placeholder="e.g. v2.7.0 - Security & Performance Improvements"
              value={releaseName}
              onChange={(e) => setReleaseName(e.target.value)}
              disabled={isSubmitting}
              className="w-full h-8 px-2.5 text-xs text-text-primary bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm focus:outline-none transition shadow-2xs placeholder:text-text-faint"
            />
          </div>

          {/* Release Notes / Description with Markdown Tabs & Helper */}
          <div className="space-y-1.5 p-3 bg-base-1 border border-border rounded-sm">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-border/60">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className={`px-2.5 py-1 rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    activeTab === 'write'
                      ? 'bg-base-0 text-text-primary border border-border shadow-2xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Edit3 className="w-3 h-3 text-commito-coral" />
                  <span>Write Markdown</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-2.5 py-1 rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-base-0 text-text-primary border border-border shadow-2xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Eye className="w-3 h-3 text-gitlab-teal" />
                  <span>Preview</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleGenerateNotesFromCommits}
                className="px-2 py-0.5 bg-base-0 hover:bg-base-2 border border-border text-[10.5px] font-semibold text-text-secondary hover:text-text-primary rounded-xs flex items-center gap-1 transition cursor-pointer shadow-2xs"
                title="Generate notes bullet points from recent commits"
              >
                <ListPlus className="w-3 h-3 text-commito-coral" />
                <span>Auto-fill from Commits</span>
              </button>
            </div>

            {activeTab === 'write' ? (
              <textarea
                placeholder="Describe this release, new features, bugfixes, breaking changes, and contributor mentions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                rows={6}
                className="w-full p-2.5 bg-base-0 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-inner font-mono resize-none leading-relaxed"
              />
            ) : (
              <div className="w-full min-h-[140px] max-h-56 p-3 bg-base-0 border border-border rounded-sm overflow-y-auto text-xs text-text-primary font-sans leading-relaxed space-y-2 select-text">
                {description.trim() ? (
                  <div className="whitespace-pre-wrap font-sans text-xs text-text-secondary">
                    {description}
                  </div>
                ) : (
                  <div className="text-text-faint italic text-center py-6">
                    No release notes written yet.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Options: Pre-release & Remote Push */}
          <div className="p-3 bg-base-1 border border-border rounded-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <Checkbox
                checked={pushImmediately}
                onChange={(checked) => setPushImmediately(checked)}
                disabled={isSubmitting}
                label={
                  <span className="text-xs font-semibold text-text-primary">
                    Push release and tag to remote repository immediately
                  </span>
                }
              />
              <Upload className="w-3.5 h-3.5 text-text-muted" />
            </div>

            {pushImmediately && remotes.length > 1 && (
              <div className="pt-1 flex items-center gap-2">
                <span className="text-[11px] text-text-muted font-medium shrink-0">Target Remote:</span>
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

            <div className="pt-1 border-t border-border/40">
              <Checkbox
                checked={isPrerelease}
                onChange={(checked) => setIsPrerelease(checked)}
                disabled={isSubmitting}
                label={
                  <span className="text-xs text-text-secondary font-medium">
                    Set as pre-release (indicates beta or non-production ready)
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

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-7.5 px-3.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary transition cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-7.5 px-4 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isEditMode ? 'Updating Release...' : 'Publishing Release...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEditMode ? 'Save Changes' : 'Publish Release'}</span>
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
