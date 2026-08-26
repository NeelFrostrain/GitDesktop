import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Loader2,
  Tag,
  Upload,
  AlertCircle,
  Check,
  Paperclip,
  Trash2,
  Plus,
  FileCode,
  Archive,
  File as FileIcon,
  Sparkles,
  Package,
  FlaskConical,
  UploadCloud,
  ExternalLink,
  Calendar,
  FileText,
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
import { formatBranchDropdownOptions } from '../../shared/utils/branchUtils';
import { Dropdown } from '../common/Dropdown';
import { Tabs } from '../common/Tabs';
import { MarkdownPreview } from '../common/MarkdownPreview';
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
  const { activeRepoPath, branches, status, tags, releases, setTags, setReleases, setBranches } = useGitStore();
  const { remotes, activeRemote, loadRemotes } = useRemoteStore();

  const [tagSource, setTagSource] = useState<'new' | 'existing'>(initialRelease ? 'existing' : 'new');
  const [tagName, setTagName] = useState('');
  const [selectedExistingTag, setSelectedExistingTag] = useState('');
  const [releaseName, setReleaseName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [pushImmediately, setPushImmediately] = useState(true);
  const [isPrerelease, setIsPrerelease] = useState(false);
  const [isLatest, setIsLatest] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedRemote, setSelectedRemote] = useState('origin');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentStage, setCurrentStage] = useState<ReleaseStage>('idle');
  const [stageMessage, setStageMessage] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Resizable panel width state
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('release_modal_left_width');
      return saved ? Math.max(300, Math.min(650, parseInt(saved, 10))) : 420;
    } catch {
      return 420;
    }
  });
  const [isResizingLeft, setIsResizingLeft] = useState(false);

  const startResizingLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
  };

  useEffect(() => {
    if (!isResizingLeft) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!modalContainerRef.current) return;
      const modalRect = modalContainerRef.current.getBoundingClientRect();
      const newWidth = Math.max(300, Math.min(modalRect.width - 340, e.clientX - modalRect.left));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      try {
        localStorage.setItem('release_modal_left_width', leftPanelWidth.toString());
      } catch {}
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingLeft, leftPanelWidth]);

  // Check if current selection is an existing release
  const activeExistingRelease = useMemo(() => {
    if (initialRelease) return initialRelease;
    if (tagSource === 'existing' && selectedExistingTag) {
      return releases.find((r) => r.tag_name === selectedExistingTag) || null;
    }
    return null;
  }, [initialRelease, tagSource, selectedExistingTag, releases]);

  const isEditingExistingRelease = Boolean(activeExistingRelease);

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

  // Fetch branches, tags, releases, and remotes whenever the modal opens
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

      ReleaseService.listReleases(activeRepoPath)
        .then((rList) => {
          if (rList && rList.length > 0) {
            setReleases(rList);
            const targetTag = initialRelease?.tag_name || selectedExistingTag || rList[0]?.tag_name;
            const updatedRel = rList.find((r) => r.tag_name === targetTag);
            if (updatedRel && (tagSource === 'existing' || initialRelease)) {
              loadReleaseData(updatedRel);
            }
          }
        })
        .catch(() => {});

      loadRemotes(activeRepoPath).catch(() => {});
    }
  }, [isOpen, activeRepoPath, setBranches, setTags, setReleases, loadRemotes]);

/**
 * Natural & Semantic version comparator in descending order (e.g. v2.6.0 > v2.5.8 > v2.5.1 > v1.0.0).
 */
function compareSemverDescending(a: string, b: string): number {
  const parseSegments = (v: string) => {
    const clean = v.trim().replace(/^[vV](\.|\-)?/, '');
    return clean.split(/[-+.]/).map((s) => {
      const num = Number(s);
      return isNaN(num) ? s.toLowerCase() : num;
    });
  };

  const aParts = parseSegments(a);
  const bParts = parseSegments(b);
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLen; i++) {
    const pA = aParts[i];
    const pB = bParts[i];

    if (pA === undefined) return 1;
    if (pB === undefined) return -1;

    if (typeof pA === 'number' && typeof pB === 'number') {
      if (pA !== pB) return pB - pA; // Descending
    } else {
      const strA = String(pA);
      const strB = String(pB);
      if (strA !== strB) return strB.localeCompare(strA);
    }
  }

  return b.localeCompare(a);
}

  // Branch options for dropdown
  const branchOptions = useMemo(() => {
    return formatBranchDropdownOptions(branches);
  }, [branches]);

  // Tag options for existing tags dropdown with rich release metadata and SEMVER DESCENDING SORT
  const tagOptions = useMemo(() => {
    const tagMap = new Map<string, { name: string; sha?: string; message?: string; is_annotated?: boolean; release?: ReleaseInfo }>();
    tags.forEach((t) => {
      tagMap.set(t.name, { name: t.name, sha: t.sha, message: t.message, is_annotated: t.is_annotated });
    });
    releases.forEach((r) => {
      const existing = tagMap.get(r.tag_name);
      if (existing) {
        existing.release = r;
      } else {
        tagMap.set(r.tag_name, { name: r.tag_name, release: r });
      }
    });

    const items = Array.from(tagMap.values());

    // Sort items:
    // 1. Release with is_latest === true comes FIRST.
    // 2. Then all releases & tags sorted in SEMVER / Version descending order (newest/highest version first).
    items.sort((a, b) => {
      if (a.release?.is_latest && !b.release?.is_latest) return -1;
      if (!a.release?.is_latest && b.release?.is_latest) return 1;

      // If both have releases with dates, sort by date descending
      if (a.release?.created_at && b.release?.created_at && a.release.created_at !== b.release.created_at) {
        return b.release.created_at.localeCompare(a.release.created_at);
      }

      // Semantic version / natural descending sort
      return compareSemverDescending(a.name, b.name);
    });

    return items.map(({ name, sha, message, release }) => {
      let badge: string | undefined = undefined;
      if (release?.is_latest) {
        badge = 'Latest';
      } else if (release?.is_prerelease) {
        badge = 'Pre-release';
      } else if (release?.web_url || (release?.assets && release.assets.length > 0)) {
        badge = 'Release';
      } else if (sha) {
        badge = sha.slice(0, 7);
      }

      const hasCustomName = release?.name && release.name !== name && !release.name.startsWith(`Release ${name}`);
      const label = hasCustomName ? `${name} — ${release!.name}` : name;
      const description = release?.description
        ? release.description.split('\n')[0].slice(0, 55)
        : message
        ? message.split('\n')[0].slice(0, 55)
        : undefined;

      return {
        value: name,
        label,
        description,
        icon: release?.is_latest || release?.web_url || (release?.assets && release.assets.length > 0) ? (
          <Package className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <Tag className="w-3.5 h-3.5 text-gitlab-teal" />
        ),
        badge,
      };
    });
  }, [tags, releases]);

  // Load a release into form state
  const loadReleaseData = useCallback((rel: ReleaseInfo) => {
    setTagName(rel.tag_name);
    setReleaseName(rel.name || `Release ${rel.tag_name}`);
    setDescription(rel.description || '');
    setIsPrerelease(Boolean(rel.is_prerelease));
    setIsLatest(rel.is_latest ?? !rel.is_prerelease);
    setSelectedExistingTag(rel.tag_name);

    if (rel.assets && rel.assets.length > 0) {
      setAttachedFiles(
        rel.assets.map((a) => ({
          name: a.name,
          path: a.url || a.direct_asset_url || a.name,
          size: a.size,
        }))
      );
    } else {
      setAttachedFiles([]);
    }
  }, []);

  // Reset form when modal opens or initialRelease changes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsSubmitting(false);
      setIsDeleting(false);
      setCurrentStage('idle');
      setStageMessage('');
      setActiveTab('write');
      setAttachedFiles([]);

      if (initialRelease) {
        setTagSource('existing');
        loadReleaseData(initialRelease);
      } else {
        setTagSource('new');
        setTagName('');
        setReleaseName('');
        setDescription('');
        setIsPrerelease(false);
        setIsLatest(true);

        const defaultTag = tagOptions[0]?.value || tags[0]?.name || '';
        if (defaultTag) {
          setSelectedExistingTag(defaultTag);
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
  }, [isOpen, initialRelease, status?.current_branch, activeRemote, remotes, loadReleaseData, tagOptions, tags]);

  // When in existing mode, automatically sync active release notes and assets when releases or selectedExistingTag updates
  useEffect(() => {
    if (!isOpen || tagSource !== 'existing') return;
    const targetTag = selectedExistingTag || (tagOptions.length > 0 ? tagOptions[0].value : null);
    if (targetTag) {
      const matched = releases.find((r) => r.tag_name === targetTag);
      if (matched) {
        setTagName(matched.tag_name);
        setReleaseName(matched.name || `Release ${matched.tag_name}`);
        setDescription(matched.description || '');
        setIsPrerelease(Boolean(matched.is_prerelease));
        setIsLatest(matched.is_latest ?? !matched.is_prerelease);
        if (matched.assets && matched.assets.length > 0) {
          setAttachedFiles(
            matched.assets.map((a) => ({
              name: a.name,
              path: a.url || a.direct_asset_url || a.name,
              size: a.size,
            }))
          );
        } else {
          setAttachedFiles([]);
        }
      }
    }
  }, [isOpen, tagSource, selectedExistingTag, releases, tagOptions]);

  // Remote options for dropdown
  const remoteOptions = useMemo(() => {
    return remotes.map((r) => ({
      value: r.name,
      label: r.name,
      description: r.url || r.push_url || undefined,
    }));
  }, [remotes]);

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
    if (lower.endsWith('.exe') || lower.endsWith('.msi') || lower.endsWith('.dmg') || lower.endsWith('.appimage') || lower.endsWith('.deb') || lower.endsWith('.rpm')) {
      return <Package className="w-3.5 h-3.5 text-commito-coral shrink-0" />;
    }
    if (lower.endsWith('.js') || lower.endsWith('.json') || lower.endsWith('.ts') || lower.endsWith('.py') || lower.endsWith('.rs')) {
      return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
    return <FileIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />;
  };

  const handleChooseFiles = async () => {
    try {
      const selected = await openDialog({
        multiple: true,
        directory: false,
        title: 'Select Release Binaries & Assets to Attach',
      });

      if (selected) {
        const filePaths = Array.isArray(selected) ? selected : [selected];
        const newFiles: AttachedFile[] = filePaths.map((p) => ({
          path: p,
          name: p.split(/[/\\]/).pop() || 'asset',
        }));

        setAttachedFiles((prev) => {
          const existingPaths = new Set(prev.map((f) => f.path));
          const filtered = newFiles.filter((f) => !existingPaths.has(f.path));
          return [...prev, ...filtered];
        });
      }
    } catch {
      fileInputRef.current?.click();
    }
  };

  const handleNativeFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newFiles: AttachedFile[] = files.map((f) => ({
        path: (f as unknown as { path?: string }).path || f.name,
        name: f.name,
        size: f.size,
      }));
      setAttachedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const newFiles: AttachedFile[] = files.map((f) => ({
        path: (f as unknown as { path?: string }).path || f.name,
        name: f.name,
        size: f.size,
      }));
      setAttachedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleGenerateNotesFromCommits = async () => {
    if (!activeRepoPath || isGeneratingAi || isSubmitting) return;

    const effectiveTag = (tagSource === 'new' ? tagName : selectedExistingTag).trim() || 'v1.0.0';
    setIsGeneratingAi(true);

    try {
      // Find latest previous tag
      const otherTags = tags.filter((t) => t.name !== effectiveTag);
      const prevTag = otherTags.length > 0 ? otherTags[0].name : undefined;

      const result = await ReleaseService.generateAiReleaseNotes(
        activeRepoPath,
        effectiveTag,
        prevTag,
        tagSource === 'new' ? selectedBranch || undefined : undefined
      );

      if (result) {
        if (result.notes) {
          setDescription(result.notes);
        }
        if (result.title && (!releaseName.trim() || releaseName.startsWith('Release '))) {
          setReleaseName(result.title);
        }

        useToastStore.getState().showToast({
          type: 'success',
          title: 'Release Notes Generated',
          message: `Analyzed ${result.commits_analyzed} commits using ${result.model_used}`,
        });
      }
    } catch (err: unknown) {
      // Graceful fallback to local commit log
      try {
        const history = await GitService.getCommitHistory(activeRepoPath, 25, 0);
        if (history && history.length > 0) {
          const commitBullets = history
            .filter((c) => !c.message.startsWith('Merge branch') && !c.message.startsWith('Merge pull request'))
            .map((c) => {
              const handle = `@${c.author_name.replace(/\s+/g, '')}`;
              return `- ${c.message} (\`${c.short_sha}\`) by ${handle}`;
            })
            .join('\n');
          const generated = `### What's Changed in this Release\n\n${commitBullets}\n\n**Full Changelog**: https://github.com/repository/commits/${effectiveTag}`;
          setDescription(generated);
          useToastStore.getState().showToast({
            type: 'info',
            title: 'Changelog Loaded',
            message: `Loaded ${history.length} commits into release notes`,
          });
        }
      } catch {
        useToastStore.getState().showToast({
          type: 'error',
          title: 'Notes Generation Failed',
          message: getErrorMessage(err) || 'Could not generate release notes from commits',
        });
      }
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleDeleteRelease = async () => {
    const targetTag = tagSource === 'new' ? tagName.trim() : selectedExistingTag.trim();
    if (!activeRepoPath || !targetTag || isDeleting || isSubmitting) return;

    if (!window.confirm(`Are you sure you want to delete the release for tag "${targetTag}"?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await ReleaseService.deleteRelease(
        activeRepoPath,
        targetTag,
        true,
        selectedRemote || null
      );

      useLogStore.getState().addLog('info', 'Git', `Deleted release '${targetTag}'`);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Release Deleted',
        message: `Successfully deleted release '${targetTag}'`,
      });

      const updatedReleases = await ReleaseService.listReleases(activeRepoPath);
      setReleases(updatedReleases || []);

      const updatedTags = await GitService.listTags(activeRepoPath);
      setTags(updatedTags || []);

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const appErr = toAppError(err);
      setError(appErr.message || getErrorMessage(err) || 'Failed to delete release');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || isSubmitting) return;

    const finalTag = tagSource === 'new' ? tagName.trim() : selectedExistingTag.trim();
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
        ? `Publishing release and syncing tag '${finalTag}' with remote...`
        : `Saving local release tag '${finalTag}'...`
    );

    try {
      if (isEditingExistingRelease) {
        await ReleaseService.updateRelease(
          activeRepoPath,
          finalTag,
          finalTitle,
          finalDesc,
          pushImmediately,
          selectedRemote || null,
          isLatest,
          isPrerelease,
          filePaths
        );

        useLogStore.getState().addLog('success', 'Git', `Updated release '${finalTitle}' (${finalTag})`);
        useToastStore.getState().showToast({
          type: 'success',
          title: 'Release Updated',
          message: `Successfully updated release '${finalTitle}' for tag ${finalTag}`,
        });
      } else {
        await ReleaseService.createRelease(
          activeRepoPath,
          finalTag,
          finalTitle,
          finalDesc,
          tagSource === 'new' ? selectedBranch || null : null,
          pushImmediately,
          selectedRemote || null,
          isLatest,
          isPrerelease,
          filePaths
        );

        useLogStore.getState().addLog('success', 'Git', `Created release '${finalTitle}' (${finalTag})`);
        useToastStore.getState().showToast({
          type: 'success',
          title: 'Release Published',
          message: `Successfully created release '${finalTitle}'${pushImmediately ? ' on remote' : ''}`,
        });
      }

      setCurrentStage('done');
      setStageMessage('Release saved successfully!');

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
    if (e.key === 'Escape' && !isSubmitting && !isDeleting) {
      onClose();
    }
  };

  const getStageColorClasses = (stage: ReleaseStage) => {
    switch (stage) {
      case 'pushing':
        return {
          badge: 'text-sky-400 bg-sky-500/15 border-sky-500/35',
          spinner: 'text-sky-400',
        };
      case 'uploading':
        return {
          badge: 'text-amber-400 bg-amber-500/15 border-amber-500/35',
          spinner: 'text-amber-400',
        };
      case 'finishing':
        return {
          badge: 'text-purple-400 bg-purple-500/15 border-purple-500/35',
          spinner: 'text-purple-400',
        };
      case 'done':
        return {
          badge: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/35',
          spinner: 'text-emerald-400',
        };
      default:
        return {
          badge: 'text-commito-coral bg-commito-coral/15 border-commito-coral/30',
          spinner: 'text-commito-coral',
        };
    }
  };

  const getSubmitButtonLabel = () => {
    if (isEditingExistingRelease) {
      return pushImmediately ? 'Save & Push Update' : 'Save Changes';
    }
    return pushImmediately ? 'Publish Release' : 'Save Local Release';
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-release-title"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-100"
    >
      <div
        ref={modalContainerRef}
        className="w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl bg-base-0 border border-border rounded-md shadow-2xl overflow-hidden flex flex-col h-[88vh] max-h-[850px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Compact Single-Row) */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 border border-commito-coral/30">
              <Package className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 id="create-release-title" className="text-xs font-bold text-text-primary leading-none">
                {isEditingExistingRelease ? (
                  <span>
                    Manage Release <span className="font-mono text-commito-coral font-bold">{activeExistingRelease?.tag_name}</span>
                  </span>
                ) : (
                  <span>Draft New Release</span>
                )}
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

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isDeleting}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer disabled:opacity-50"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hidden Native File Input for drag/drop & manual selection */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleNativeFileInput}
          multiple
          className="hidden"
        />

        {/* Split 2-Column Form Body (Resizable) */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-row min-h-0 overflow-hidden">
          {/* Left Resizable Column: Metadata, Tag, Assets, Toggles */}
          <div
            style={{ width: `${leftPanelWidth}px` }}
            className="shrink-0 flex flex-col min-h-0 overflow-y-auto p-4 space-y-3.5 bg-base-0"
          >
            {/* Section 1: Tag Source Selector (New Tag vs Existing Tag) */}
            {!initialRelease ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-primary flex items-center gap-1">
                    <span>RELEASE TAG</span>
                    <span className="text-commito-coral font-bold">*</span>
                  </label>

                  <Tabs<'new' | 'existing'>
                    tabs={[
                      { id: 'new', label: 'New Tag' },
                      {
                        id: 'existing',
                        label: 'Existing Tag',
                        badge: tags.length > 0 ? tags.length : undefined,
                        badgeVariant: 'amber',
                      },
                    ]}
                    activeTab={tagSource}
                    onChange={(t) => {
                      setTagSource(t);
                      setError(null);
                      if (t === 'existing') {
                        const tagToSelect = selectedExistingTag || tagOptions[0]?.value || tags[0]?.name || '';
                        if (tagToSelect) {
                          setSelectedExistingTag(tagToSelect);
                          const existingRel = releases.find((r) => r.tag_name === tagToSelect);
                          if (existingRel) {
                            loadReleaseData(existingRel);
                          } else {
                            setReleaseName(`Release ${tagToSelect}`);
                            setAttachedFiles([]);
                          }
                        }
                      } else if (t === 'new') {
                        setTagName('');
                        setReleaseName('');
                        setDescription('');
                        setIsLatest(true);
                        setIsPrerelease(false);
                        setAttachedFiles([]);
                      }
                    }}
                    size="xs"
                    ariaLabel="Tag source selection"
                  />
                </div>

                {tagSource === 'new' ? (
                  /* New Tag & Branch Inputs */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="e.g. v1.0.0"
                        value={tagName}
                        onChange={(e) => setTagName(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full h-8 px-2.5 text-xs font-mono text-text-primary bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-xs focus:outline-none transition shadow-2xs placeholder:text-text-faint"
                      />
                      <Tag className="w-3.5 h-3.5 text-text-faint absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                  /* Existing Tag Selector Dropdown */
                  <div className="space-y-2">
                    {tagOptions.length > 0 ? (
                      <Dropdown
                        options={tagOptions}
                        value={selectedExistingTag}
                        onChange={(val) => {
                          setSelectedExistingTag(val);
                          const existingRel = releases.find((r) => r.tag_name === val);
                          if (existingRel) {
                            loadReleaseData(existingRel);
                          } else {
                            setReleaseName(`Release ${val}`);
                            setAttachedFiles([]);
                          }
                        }}
                        disabled={isSubmitting || isDeleting}
                        placeholder="Select existing tag..."
                        size="md"
                      />
                    ) : (
                      <div className="p-3 bg-base-1 border border-border/80 rounded-xs flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-text-muted">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>No tags or releases found in repository</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTagSource('new')}
                          className="h-6 px-2.5 bg-commito-coral hover:bg-commito-coralLight text-white text-[11px] font-semibold rounded-xs flex items-center gap-1 transition cursor-pointer shrink-0 shadow-2xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Create New Tag</span>
                        </button>
                      </div>
                    )}

                    {/* Summary card if the selected tag is an existing release */}
                    {activeExistingRelease && (
                      <div className="p-2.5 bg-base-1 border border-amber-500/30 rounded-xs flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-xs bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                            <Package className="w-3 h-3" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-mono text-xs font-bold text-text-primary truncate">
                              {activeExistingRelease.tag_name}
                            </div>
                            <div className="text-[10.5px] text-text-muted truncate">
                              {activeExistingRelease.name || 'Untitled Release'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {activeExistingRelease.is_latest && (
                            <span className="px-1.5 py-0.2 bg-emerald-500/15 text-emerald-400 text-[9.5px] font-bold rounded-xs border border-emerald-500/30">
                              Latest
                            </span>
                          )}
                          {activeExistingRelease.is_prerelease && (
                            <span className="px-1.5 py-0.2 bg-purple-500/15 text-purple-300 text-[9.5px] font-bold rounded-xs border border-purple-500/30">
                              Pre-release
                            </span>
                          )}
                          {activeExistingRelease.created_at && (
                            <span className="text-[10px] text-text-muted font-mono flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-text-faint" />
                              {activeExistingRelease.created_at.slice(0, 10)}
                            </span>
                          )}
                          {activeExistingRelease.web_url && (
                            <a
                              href={activeExistingRelease.web_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-text-muted hover:text-commito-coral transition rounded-xs hover:bg-base-2 ml-1"
                              title="View on Cloud"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Fixed Tag Banner when opened directly from edit button */
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

            {/* Section 2: Release Title Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-primary block">
                Release Title
              </label>
              <input
                type="text"
                placeholder={`e.g. Release ${tagName || selectedExistingTag || 'v1.0.0'}`}
                value={releaseName}
                onChange={(e) => setReleaseName(e.target.value)}
                disabled={isSubmitting || isDeleting}
                className="w-full h-8 px-2.5 text-xs text-text-primary bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-xs focus:outline-none transition shadow-2xs placeholder:text-text-faint"
              />
            </div>

            {/* Section 3: Attach Binaries & Release Assets */}
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
                  disabled={isSubmitting || isDeleting}
                  className="h-6.5 px-2 bg-base-0 hover:bg-base-2 border border-border text-[11px] font-semibold text-text-secondary hover:text-text-primary rounded-xs flex items-center gap-1 transition cursor-pointer shadow-2xs disabled:opacity-50"
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
                className={`border border-dashed rounded-xs p-3 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1 ${
                  isDraggingOver
                    ? 'border-commito-coral bg-commito-coral/10'
                    : 'border-border hover:border-commito-coral/60 bg-base-0/60 hover:bg-base-0'
                }`}
              >
                <UploadCloud className="w-4.5 h-4.5 text-text-muted transition" />
                <div className="text-[11.5px] text-text-secondary">
                  <span className="font-semibold text-text-primary hover:underline">Choose files</span> or drag & drop
                </div>
                <p className="text-[10px] text-text-muted font-mono">
                  Binaries, tarballs, .zip, .exe, installers, or checksum files
                </p>
              </div>

              {/* Attached Files List */}
              {attachedFiles.length > 0 && (
                <div className="space-y-1.5 pt-0.5 max-h-32 overflow-y-auto">
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
                        disabled={isSubmitting || isDeleting}
                        className="p-1 text-text-muted hover:text-git-removed hover:bg-git-removed-bg rounded-xs transition cursor-pointer"
                        title="Remove file"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Remote Target & Publish Options */}
            <div className="space-y-2">
              {/* Remote Selector (if multiple remotes exist) */}
              {remotes.length > 1 && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-primary block">
                    Target Remote
                  </label>
                  <Dropdown
                    options={remoteOptions}
                    value={selectedRemote}
                    onChange={(val) => setSelectedRemote(val)}
                    disabled={isSubmitting || isDeleting}
                    placeholder="Select Remote..."
                    size="md"
                  />
                </div>
              )}

              {/* Option 1: Push Immediately Toggle */}
              <div
                onClick={() => !isSubmitting && !isDeleting && setPushImmediately(!pushImmediately)}
                className={`p-2.5 rounded-sm border transition cursor-pointer flex items-center justify-between gap-3 ${
                  pushImmediately
                    ? 'bg-commito-coral/5 border-commito-coral/35 shadow-2xs'
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
                    <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 leading-none">
                      <span>Push release and tag to remote immediately</span>
                    </div>
                    <p className="text-[10.5px] text-text-muted mt-1 leading-none">
                      Publishes directly to remote git platform API
                    </p>
                  </div>
                </div>

                {/* Custom Toggle Switch */}
                <div
                  className={`relative inline-flex items-center w-7.5 h-4 rounded-xs px-0.5 border transition-colors shrink-0 ${
                    pushImmediately
                      ? 'bg-commito-coral border-commito-coral'
                      : 'bg-base-2 border-border'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-xs bg-white transition-transform duration-150 shadow-2xs ${
                      pushImmediately ? 'translate-x-3' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Option 2: Set as Latest Release Toggle */}
              <div
                onClick={() => {
                  if (isSubmitting || isDeleting) return;
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
                      Marks this as the primary release version
                    </p>
                  </div>
                </div>

                {/* Custom Toggle Switch */}
                <div
                  className={`relative inline-flex items-center w-7.5 h-4 rounded-xs px-0.5 border transition-colors shrink-0 ${
                    isLatest
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'bg-base-2 border-border'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-xs bg-white transition-transform duration-150 shadow-2xs ${
                      isLatest ? 'translate-x-3' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Option 3: Pre-release Toggle */}
              <div
                onClick={() => {
                  if (isSubmitting || isDeleting) return;
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
                      Beta, alpha, or release candidate
                    </p>
                  </div>
                </div>

                {/* Custom Toggle Switch */}
                <div
                  className={`relative inline-flex items-center w-7.5 h-4 rounded-xs px-0.5 border transition-colors shrink-0 ${
                    isPrerelease
                      ? 'bg-purple-500 border-purple-500'
                      : 'bg-base-2 border-border'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-xs bg-white transition-transform duration-150 shadow-2xs ${
                      isPrerelease ? 'translate-x-3' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </div>



            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-xs bg-git-removed-bg border border-git-removed/40 text-git-removed text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}
          </div>

          {/* Resizable Divider Splitter Handle */}
          <div
            onMouseDown={startResizingLeft}
            onDoubleClick={() => setLeftPanelWidth(420)}
            title="Drag to resize • Double-click to reset"
            className={`w-1.5 h-full cursor-col-resize z-20 shrink-0 transition-colors relative group/resizer hover:bg-commito-coral/50 ${
              isResizingLeft ? 'bg-commito-coral' : 'bg-transparent border-r border-border'
            }`}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>

          {/* Right Column: Full-Height Markdown Editor & Preview */}
          <div className="flex-1 min-w-0 p-4 md:p-5 overflow-hidden flex flex-col bg-base-1/25 min-h-0 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/70 shrink-0">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-commito-coral" />
                  <span>Release Notes & Changelog</span>
                </label>
                <Tabs<'write' | 'preview'>
                  tabs={[
                    {
                      id: 'write',
                      label: 'Write',
                    },
                    {
                      id: 'preview',
                      label: 'Preview',
                    },
                  ]}
                  activeTab={activeTab}
                  onChange={setActiveTab}
                  size="xs"
                  ariaLabel="Release notes view"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateNotesFromCommits}
                disabled={isSubmitting || isDeleting || isGeneratingAi}
                className="h-6.5 px-2.5 bg-commito-coral/10 hover:bg-commito-coral/20 border border-commito-coral/35 text-[11px] font-semibold text-commito-coral rounded-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50 active:scale-95"
                title="Use AI to analyze commits between new and previous tags to compose full release notes"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral" />
                    <span>Analyzing Commits...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-commito-coral" />
                    <span>Generate Notes with AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Editor / Preview Body */}
            <div className="flex-1 min-h-0 flex flex-col bg-base-0 border border-border rounded-xs overflow-hidden shadow-inner">
              {activeTab === 'write' ? (
                <textarea
                  placeholder="Describe this release, new features, bugfixes, breaking changes, and contributor mentions... (Markdown supported)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting || isDeleting}
                  className="w-full h-full p-3 bg-transparent text-xs text-text-primary placeholder:text-text-faint focus:outline-none transition font-mono resize-none leading-relaxed overflow-y-auto"
                />
              ) : (
                <div className="w-full h-full p-3.5 overflow-y-auto">
                  <MarkdownPreview
                    content={description}
                    emptyText="No release notes written yet. Switch to the Write tab to draft notes."
                  />
                </div>
              )}
            </div>

            {/* Footer info bar for markdown */}
            <div className="flex items-center justify-between text-[10.5px] text-text-muted shrink-0 pt-0.5 font-mono">
              <span>{description.length} characters • {description.trim() ? description.trim().split(/\s+/).length : 0} words</span>
              <span>Markdown & GFM supported</span>
            </div>
          </div>
        </form>

        {/* Modal Footer Actions (Slim & Space-saving) */}
        <div className="flex items-center justify-between gap-3 px-3.5 py-1.5 border-t border-border bg-base-1/70 shrink-0 min-h-[38px]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isSubmitting ? (
              (() => {
                const colors = getStageColorClasses(currentStage);
                return (
                  <div className="flex items-center gap-2 min-w-0 text-xs animate-in fade-in duration-100">
                    <Loader2 className={`w-3.5 h-3.5 animate-spin ${colors.spinner} shrink-0`} />
                    <div className="flex items-center gap-1.5 min-w-0 font-mono text-[11px]">
                      <span className={`font-bold uppercase text-[9.5px] px-1.5 py-0.2 rounded-xs border ${colors.badge} shrink-0 shadow-2xs`}>
                        {currentStage}
                      </span>
                      <span className="text-text-muted truncate font-mono text-[11px]" title={stageMessage}>
                        {stageMessage || 'Publishing release...'}
                      </span>
                    </div>
                  </div>
                );
              })()
            ) : isEditingExistingRelease ? (
              <button
                type="button"
                onClick={handleDeleteRelease}
                disabled={isSubmitting || isDeleting}
                className="h-6.5 px-2.5 bg-git-removed-bg hover:bg-git-removed/20 border border-git-removed/40 text-git-removed rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Permanently delete this release and remove release tag"
              >
                {isDeleting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                <span>Delete Release</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
              className="h-6.5 px-3 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary transition cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isDeleting}
              className="h-6.5 px-3.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-95 min-w-[130px] justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{getSubmitButtonLabel()}</span>
                </>
              ) : (
                <>
                  <Check className="w-3 h-3" />
                  <span>{getSubmitButtonLabel()}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
