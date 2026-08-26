import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
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
  Paperclip,
  Trash2,
  Plus,
  FileCode,
  Archive,
  File as FileIcon,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Package,
  FlaskConical,
  UploadCloud,
} from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { useGitStore } from '../../store/useGitStore';
import { useToastStore } from '../../store/useToastStore';
import { useLogStore } from '../../store/useLogStore';
import { useRemoteStore } from '../../store/remoteStore';
import { ReleaseService } from '../../services/git/releaseService';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { Dropdown } from '../common/Dropdown';
import { ReleaseInfo } from '../../types/git';

export interface CreateReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRelease?: ReleaseInfo | null;
  onSuccess?: () => void;
}

interface AttachedFile {
  path: string;
  name: string;
  size?: number;
}

type ReleaseStage = 'idle' | 'pushing' | 'uploading' | 'finishing' | 'done';

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
  const [tagSource, setTagSource] = useState<'new' | 'existing'>('new');
  const [selectedExistingTag, setSelectedExistingTag] = useState('');
  const [pushImmediately, setPushImmediately] = useState(true);
  const [isPrerelease, setIsPrerelease] = useState(false);
  const [isLatest, setIsLatest] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedRemote, setSelectedRemote] = useState('origin');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStage, setCurrentStage] = useState<ReleaseStage>('idle');
  const [stageMessage, setStageMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen to Tauri release progress events
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{
      stage: string;
      message: string;
      current_file?: string;
      file_index?: number;
      total_files?: number;
    }>('release:progress', (event) => {
      const { stage, message } = event.payload;
      if (stage === 'pushing') {
        setCurrentStage('pushing');
      } else if (stage === 'uploading') {
        setCurrentStage('uploading');
      } else if (stage === 'publishing') {
        setCurrentStage('uploading');
      } else if (stage === 'finishing') {
        setCurrentStage('finishing');
      }
      setStageMessage(message);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

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
      setCurrentStage('idle');
      setStageMessage('');
      setActiveTab('write');
      setAttachedFiles([]);

      if (initialRelease) {
        setTagName(initialRelease.tag_name);
        setReleaseName(initialRelease.name);
        setDescription(initialRelease.description);
        setIsPrerelease(Boolean(initialRelease.is_prerelease));
        setIsLatest(initialRelease.is_latest ?? !initialRelease.is_prerelease);
        setTagSource('existing');
        setSelectedExistingTag(initialRelease.tag_name);
      } else {
        setTagName('');
        setReleaseName('');
        setDescription('');
        setIsPrerelease(false);
        setIsLatest(true);

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

  const formatFileSize = (bytes?: number) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getFileIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.zip') || lower.endsWith('.tar') || lower.endsWith('.gz') || lower.endsWith('.7z') || lower.endsWith('.rar')) {
      return <Archive className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    if (lower.endsWith('.exe') || lower.endsWith('.msi') || lower.endsWith('.dmg') || lower.endsWith('.deb') || lower.endsWith('.appimage') || lower.endsWith('.apk')) {
      return <FileCode className="w-3.5 h-3.5 text-gitlab-teal shrink-0" />;
    }
    return <FileIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />;
  };

  const handleChooseFiles = async () => {
    try {
      const selected = await openDialog({
        multiple: true,
        directory: false,
        title: 'Select Release Assets & Binaries',
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        const newFiles: AttachedFile[] = paths.map((p) => {
          const name = p.split(/[\\/]/).pop() || 'file';
          return { path: p, name };
        });
        setAttachedFiles((prev) => {
          const existingPaths = new Set(prev.map((f) => f.path));
          return [...prev, ...newFiles.filter((f) => !existingPaths.has(f.path))];
        });
      }
    } catch (err) {
      console.warn('Native file dialog error, using HTML fallback:', err);
      fileInputRef.current?.click();
    }
  };

  const handleHtmlFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const added: AttachedFile[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const filePath = (file as unknown as { path?: string }).path || file.name;
        added.push({
          path: filePath,
          name: file.name,
          size: file.size,
        });
      }
      setAttachedFiles((prev) => {
        const existingPaths = new Set(prev.map((f) => f.path));
        return [...prev, ...added.filter((f) => !existingPaths.has(f.path))];
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped: AttachedFile[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const filePath = (file as unknown as { path?: string }).path || file.name;
        dropped.push({
          path: filePath,
          name: file.name,
          size: file.size,
        });
      }
      setAttachedFiles((prev) => {
        const existingPaths = new Set(prev.map((f) => f.path));
        return [...prev, ...dropped.filter((f) => !existingPaths.has(f.path))];
      });
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setAttachedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

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
    const filePaths = attachedFiles.map((f) => f.path);

    if (!finalTag) {
      setError('A valid tag name is required for this release.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setCurrentStage('pushing');
    setStageMessage(
      pushImmediately
        ? `Creating and pushing tag '${finalTag}' to remote repository...`
        : `Creating local release tag '${finalTag}'...`
    );

    try {
      if (isEditMode || tagSource === 'existing') {
        await ReleaseService.updateRelease(
          activeRepoPath,
          finalTag,
          finalTitle,
          finalDesc,
          pushImmediately,
          selectedRemote || null,
          isLatest,
          filePaths
        );

        useLogStore.getState().addLog('success', 'Git', `Saved release '${finalTitle}' (${finalTag})`);
        useToastStore.getState().showToast({
          type: 'success',
          title: isEditMode ? 'Release Updated' : 'Release Published',
          message: `Successfully published release '${finalTitle}' for tag ${finalTag}`,
        });
      } else {
        await ReleaseService.createRelease(
          activeRepoPath,
          finalTag,
          finalTitle,
          finalDesc,
          selectedBranch || null,
          pushImmediately,
          selectedRemote || null,
          isLatest,
          filePaths
        );

        useLogStore.getState().addLog('success', 'Git', `Created release '${finalTitle}' (${finalTag})`);
        useToastStore.getState().showToast({
          type: 'success',
          title: 'Release Created',
          message: `Successfully published release '${finalTitle}'${pushImmediately ? ' to remote' : ''}`,
        });
      }

      setCurrentStage('done');
      setStageMessage('Release published successfully!');

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
      setCurrentStage('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting) {
      onClose();
    }
  };

  // Stage indicator calculation
  const getStageStatus = (stageName: 'pushing' | 'uploading' | 'finishing') => {
    if (currentStage === 'done') return 'done';
    if (currentStage === 'idle') return 'pending';

    if (stageName === 'pushing') {
      return currentStage === 'pushing' ? 'active' : 'done';
    }
    if (stageName === 'uploading') {
      if (currentStage === 'pushing') return 'pending';
      return currentStage === 'uploading' ? 'active' : 'done';
    }
    if (stageName === 'finishing') {
      return currentStage === 'finishing' ? 'active' : 'pending';
    }
    return 'pending';
  };

  const getSubmitButtonLabel = () => {
    if (!isSubmitting) {
      return isEditMode ? 'Save Changes' : 'Publish Release';
    }
    if (currentStage === 'pushing') return 'Pushing Tag...';
    if (currentStage === 'uploading') return 'Uploading Assets...';
    if (currentStage === 'finishing') return 'Finishing Up...';
    return isEditMode ? 'Updating...' : 'Publishing...';
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
        className="w-full max-w-xl bg-base-0 border border-border-strong rounded-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-100 max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-base-1 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xs bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
              <Package className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-text-primary leading-tight">
                {isEditMode ? 'Edit Release' : 'Draft New Release'}
              </h3>
              <p className="text-[10.5px] text-text-muted mt-0.5 leading-none">
                {isEditMode
                  ? `Update release title, notes, and changelog for tag ${initialRelease?.tag_name}`
                  : 'Publish a versioned release package with release notes, assets, and git tag'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-xs text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer disabled:opacity-50"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hidden HTML file input for fallback */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={handleHtmlFileInputChange}
          className="hidden"
        />

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1">
          {/* Target Reference & Tag Selection */}
          {!isEditMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint block">
                  Release Tag <span className="text-commito-coral">*</span>
                </label>
                {tags.length > 0 && (
                  <div className="inline-flex p-0.5 bg-base-0 border border-border rounded-xs">
                    <button
                      type="button"
                      onClick={() => setTagSource('new')}
                      className={`px-2.5 py-0.5 rounded-xs text-[10.5px] font-semibold transition cursor-pointer ${
                        tagSource === 'new'
                          ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/40 shadow-2xs'
                          : 'text-text-muted hover:text-text-primary border border-transparent'
                      }`}
                    >
                      New Tag
                    </button>
                    <button
                      type="button"
                      onClick={() => setTagSource('existing')}
                      className={`px-2.5 py-0.5 rounded-xs text-[10.5px] font-semibold transition cursor-pointer ${
                        tagSource === 'existing'
                          ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/40 shadow-2xs'
                          : 'text-text-muted hover:text-text-primary border border-transparent'
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
                      placeholder="Tag name (e.g. v1.0.0)"
                      value={tagName}
                      onChange={(e) => {
                        setTagName(e.target.value);
                        if (error) setError(null);
                      }}
                      disabled={isSubmitting}
                      className="w-full h-8 px-2.5 font-mono text-xs text-text-primary bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-xs focus:outline-none transition shadow-2xs placeholder:text-text-faint"
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
            <div className="p-2.5 bg-base-1 border border-border rounded-xs flex items-center justify-between">
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
              placeholder={`e.g. Release ${tagName || 'v1.0.0'}`}
              value={releaseName}
              onChange={(e) => setReleaseName(e.target.value)}
              disabled={isSubmitting}
              className="w-full h-8 px-2.5 text-xs text-text-primary bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-xs focus:outline-none transition shadow-2xs placeholder:text-text-faint"
            />
          </div>

          {/* Release Notes / Description with Markdown Tabs & Helper */}
          <div className="space-y-1.5 p-3 bg-base-1 border border-border rounded-sm">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-border/60">
              <div className="inline-flex p-0.5 bg-base-0 border border-border rounded-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className={`px-2.5 py-1 rounded-xs text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    activeTab === 'write'
                      ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/40 shadow-2xs'
                      : 'text-text-muted hover:text-text-primary border border-transparent'
                  }`}
                >
                  <Edit3 className="w-3 h-3 text-commito-coral" />
                  <span>Write Markdown</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-2.5 py-1 rounded-xs text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/40 shadow-2xs'
                      : 'text-text-muted hover:text-text-primary border border-transparent'
                  }`}
                >
                  <Eye className="w-3 h-3 text-gitlab-teal" />
                  <span>Preview</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleGenerateNotesFromCommits}
                className="h-6.5 px-2 bg-base-0 hover:bg-base-2 border border-border text-[10.5px] font-semibold text-text-secondary hover:text-text-primary rounded-xs flex items-center gap-1 transition cursor-pointer shadow-2xs"
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
                rows={5}
                className="w-full p-2.5 bg-base-0 border border-border hover:border-border-strong focus:border-commito-coral rounded-xs text-xs text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-inner font-mono resize-none leading-relaxed"
              />
            ) : (
              <div className="w-full min-h-[120px] max-h-48 p-3 bg-base-0 border border-border rounded-xs overflow-y-auto text-xs text-text-primary font-sans leading-relaxed space-y-2 select-text">
                {description.trim() ? (
                  <div className="whitespace-pre-wrap font-sans text-xs text-text-secondary leading-relaxed">
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

          {/* Attach Binaries / Release Assets Upload Section */}
          <div className="p-3 bg-base-1 border border-border rounded-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-commito-coral" />
                <span className="text-xs font-semibold text-text-primary">
                  Attach Binaries & Release Assets
                </span>
                {attachedFiles.length > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] font-bold bg-commito-coral/15 text-commito-coral border border-commito-coral/30 rounded-xs">
                    {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleChooseFiles}
                disabled={isSubmitting}
                className="h-6.5 px-2 bg-base-0 hover:bg-base-2 border border-border text-[11px] font-semibold text-text-secondary hover:text-text-primary rounded-xs flex items-center gap-1 transition cursor-pointer shadow-2xs"
              >
                <Plus className="w-3 h-3 text-commito-coral" />
                <span>Add Files</span>
              </button>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleChooseFiles}
              className={`border border-dashed rounded-xs p-3.5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1 ${
                isDraggingOver
                  ? 'border-commito-coral bg-commito-coral/10'
                  : 'border-border hover:border-commito-coral/60 bg-base-0/60 hover:bg-base-0'
              }`}
            >
              <UploadCloud className="w-4.5 h-4.5 text-text-muted transition" />
              <div className="text-[11.5px] text-text-secondary">
                <span className="font-semibold text-text-primary hover:underline">Choose files</span> or drag & drop packages here
              </div>
              <p className="text-[10px] text-text-muted font-mono">
                Binaries, tarballs, .zip, .exe, installers, or checksum files
              </p>
            </div>

            {/* Attached Files List */}
            {attachedFiles.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {attachedFiles.map((file, idx) => (
                  <div
                    key={file.path + idx}
                    className="flex items-center justify-between p-2 bg-base-0 border border-border rounded-xs text-xs gap-2 group hover:border-border-strong transition"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {getFileIcon(file.name)}
                      <span className="font-mono text-[11.5px] text-text-primary truncate" title={file.path}>
                        {file.name}
                      </span>
                      {file.size !== undefined && (
                        <span className="text-[10px] text-text-muted shrink-0 font-mono">
                          ({formatFileSize(file.size)})
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      disabled={isSubmitting}
                      className="p-1 text-text-muted hover:text-git-removed hover:bg-git-removed-bg rounded-xs transition cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Existing Release Assets in Edit Mode */}
            {isEditMode && initialRelease?.assets && initialRelease.assets.length > 0 && (
              <div className="pt-2 border-t border-border/40 space-y-1.5">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Existing Remote Assets ({initialRelease.assets.length})
                </div>
                <div className="space-y-1">
                  {initialRelease.assets.map((asset, aIdx) => (
                    <div
                      key={asset.name + aIdx}
                      className="flex items-center justify-between p-1.5 bg-base-0 border border-border rounded-xs text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {getFileIcon(asset.name)}
                        <span className="font-mono text-[11px] text-text-secondary truncate">
                          {asset.name}
                        </span>
                        {asset.size && (
                          <span className="text-[10px] text-text-muted font-mono">
                            ({formatFileSize(asset.size)})
                          </span>
                        )}
                      </div>
                      <span className="text-[9.5px] px-1.5 py-0.2 bg-base-2 text-text-muted border border-border rounded-xs">
                        Synced
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Option Toggle Cards with App Corners and Palette */}
          <div className="space-y-2">
            {/* Option 1: Remote Push */}
            <div
              onClick={() => !isSubmitting && setPushImmediately(!pushImmediately)}
              className={`p-2.5 rounded-sm border transition cursor-pointer flex items-center justify-between gap-3 ${
                pushImmediately
                  ? 'bg-base-1 border-commito-coral/40 shadow-2xs'
                  : 'bg-base-1/50 border-border hover:bg-base-1'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-xs flex items-center justify-center shrink-0 transition ${
                    pushImmediately
                      ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/30'
                      : 'bg-base-0 text-text-muted border border-border'
                  }`}
                >
                  <Upload className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-text-primary leading-none">
                    Push release and tag to remote immediately
                  </div>
                  <p className="text-[10.5px] text-text-muted mt-1 leading-none">
                    Publishes the release tag directly to your remote git platform API
                  </p>
                </div>
              </div>

              {/* Custom Toggle Switch */}
              <div
                className={`w-7.5 h-4 rounded-xs p-0.5 transition-colors shrink-0 ${
                  pushImmediately ? 'bg-commito-coral' : 'bg-base-2 border border-border'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-xs bg-white transition-transform shadow-2xs ${
                    pushImmediately ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>

            {/* Target Remote Dropdown if multi-remote */}
            {pushImmediately && remotes.length > 1 && (
              <div className="ml-8 p-2 bg-base-1 border border-border rounded-xs flex items-center gap-2">
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

            {/* Option 2: Latest Release */}
            <div
              onClick={() => {
                if (isSubmitting) return;
                const next = !isLatest;
                setIsLatest(next);
                if (next) {
                  setIsPrerelease(false);
                }
              }}
              className={`p-2.5 rounded-sm border transition cursor-pointer flex items-center justify-between gap-3 ${
                isLatest
                  ? 'bg-emerald-500/5 border-emerald-500/35 shadow-2xs'
                  : 'bg-base-1/50 border-border hover:bg-base-1'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-xs flex items-center justify-center shrink-0 transition ${
                    isLatest
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-base-0 text-text-muted border border-border'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 leading-none">
                    <span>Set as latest release</span>
                    {isLatest && (
                      <span className="px-1.5 py-0.2 bg-emerald-500/15 text-emerald-400 text-[9px] font-bold rounded-xs border border-emerald-500/30">
                        Latest
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-text-muted mt-1 leading-none">
                    Marks this version as the official primary release for the repository
                  </p>
                </div>
              </div>

              {/* Custom Toggle Switch */}
              <div
                className={`w-7.5 h-4 rounded-xs p-0.5 transition-colors shrink-0 ${
                  isLatest ? 'bg-emerald-500' : 'bg-base-2 border border-border'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-xs bg-white transition-transform shadow-2xs ${
                    isLatest ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>

            {/* Option 3: Pre-release */}
            <div
              onClick={() => {
                if (isSubmitting) return;
                const next = !isPrerelease;
                setIsPrerelease(next);
                if (next) {
                  setIsLatest(false);
                }
              }}
              className={`p-2.5 rounded-sm border transition cursor-pointer flex items-center justify-between gap-3 ${
                isPrerelease
                  ? 'bg-purple-500/5 border-purple-500/35 shadow-2xs'
                  : 'bg-base-1/50 border-border hover:bg-base-1'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-xs flex items-center justify-center shrink-0 transition ${
                    isPrerelease
                      ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                      : 'bg-base-0 text-text-muted border border-border'
                  }`}
                >
                  <FlaskConical className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 leading-none">
                    <span>Mark as pre-release</span>
                    {isPrerelease && (
                      <span className="px-1.5 py-0.2 bg-purple-500/15 text-purple-300 text-[9px] font-bold rounded-xs border border-purple-500/30">
                        Pre-release
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-text-muted mt-1 leading-none">
                    Identifies this package as a beta, alpha, or experimental release candidate
                  </p>
                </div>
              </div>

              {/* Custom Toggle Switch */}
              <div
                className={`w-7.5 h-4 rounded-xs p-0.5 transition-colors shrink-0 ${
                  isPrerelease ? 'bg-purple-500' : 'bg-base-2 border border-border'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-xs bg-white transition-transform shadow-2xs ${
                    isPrerelease ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Live Multi-Stage Progress Tracker during Publishing */}
          {isSubmitting && (
            <div className="p-3 bg-base-1 border border-commito-coral/40 rounded-sm space-y-2 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-text-primary pb-1 border-b border-border/60">
                <span className="flex items-center gap-1.5 text-commito-coral">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing in Progress</span>
                </span>
                <span className="font-mono text-[10px] text-text-muted">
                  Stage: {currentStage.toUpperCase()}
                </span>
              </div>

              {/* Progress Stepper Bar */}
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {/* Stage 1: Pushing */}
                {(() => {
                  const status = getStageStatus('pushing');
                  return (
                    <div
                      className={`flex items-center gap-1.5 p-1.5 rounded-xs border text-[11px] transition-all ${
                        status === 'done'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold'
                          : status === 'active'
                          ? 'bg-commito-coral/15 border-commito-coral text-commito-coral font-bold shadow-2xs'
                          : 'bg-base-0 border-border text-text-muted'
                      }`}
                    >
                      {status === 'done' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : status === 'active' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral shrink-0" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-text-faint shrink-0" />
                      )}
                      <span className="truncate">1. Push Tag</span>
                    </div>
                  );
                })()}

                {/* Stage 2: Uploading */}
                {(() => {
                  const status = getStageStatus('uploading');
                  return (
                    <div
                      className={`flex items-center gap-1.5 p-1.5 rounded-xs border text-[11px] transition-all ${
                        status === 'done'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold'
                          : status === 'active'
                          ? 'bg-commito-coral/15 border-commito-coral text-commito-coral font-bold shadow-2xs'
                          : 'bg-base-0 border-border text-text-muted'
                      }`}
                    >
                      {status === 'done' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : status === 'active' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral shrink-0" />
                      ) : (
                        <Paperclip className="w-3.5 h-3.5 text-text-faint shrink-0" />
                      )}
                      <span className="truncate">
                        2. Assets {attachedFiles.length > 0 ? `(${attachedFiles.length})` : ''}
                      </span>
                    </div>
                  );
                })()}

                {/* Stage 3: Finishing */}
                {(() => {
                  const status = getStageStatus('finishing');
                  return (
                    <div
                      className={`flex items-center gap-1.5 p-1.5 rounded-xs border text-[11px] transition-all ${
                        status === 'done'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold'
                          : status === 'active'
                          ? 'bg-commito-coral/15 border-commito-coral text-commito-coral font-bold shadow-2xs'
                          : 'bg-base-0 border-border text-text-muted'
                      }`}
                    >
                      {status === 'done' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : status === 'active' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral shrink-0" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-text-faint shrink-0" />
                      )}
                      <span className="truncate">3. Finishing</span>
                    </div>
                  );
                })()}
              </div>

              {/* Dynamic Status Message */}
              {stageMessage && (
                <div className="text-[10.5px] text-text-secondary font-mono flex items-center gap-1.5 pt-0.5 truncate">
                  <ArrowRight className="w-3 h-3 text-commito-coral shrink-0" />
                  <span className="truncate">{stageMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xs bg-git-removed-bg border border-git-removed/40 text-git-removed text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80 shrink-0">
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
              className="h-7.5 px-4 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-95 min-w-[130px] justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{getSubmitButtonLabel()}</span>
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
