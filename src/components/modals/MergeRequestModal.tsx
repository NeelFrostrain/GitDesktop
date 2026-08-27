import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  X,
  GitPullRequest,
  GitBranch,
  CheckCircle2,
  ExternalLink,
  Plus,
  RefreshCw,
  Loader2,
  FileText,
  Sparkles,
  Check,
  AlertCircle,
  Search,
  Globe,
  User,
  ArrowLeftRight,
  ArrowLeft,
  Edit3,
  Save,
  XCircle,
  MessageSquare,
  GitCommit,
  FileCode,
  Send,
  Copy,
  ChevronDown,
  ChevronRight,
  Tag,
  Users,
  AlignJustify,
  Columns,
  GitMerge,
  MoreHorizontal,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { useToastStore } from '../../store/useToastStore';
import { useRemoteStore } from '../../store/remoteStore';
import {
  UnifiedMergeRequest,
  BranchInfo,
  PullRequestComment,
  CommitInfo,
  CommitFileStat,
  DiffResult,
} from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { ReleaseService } from '../../services/git/releaseService';
import { PullRequestService, parseRemoteRepoInfo } from '../../services/git/pullRequestService';
import { toAppError, parseApiError } from '../../shared/utils/errorUtils';
import { formatBranchDropdownOptions } from '../../shared/utils/branchUtils';
import { Dropdown } from '../common/Dropdown';
import { Checkbox } from '../common/Checkbox';
import { Tabs } from '../common/Tabs';
import { MarkdownPreview } from '../common/MarkdownPreview';
import { Button } from '../common/Button';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { UnifiedDiffView } from '../views/diff/UnifiedDiffView';
import { SplitDiffView } from '../views/diff/SplitDiffView';

type InspectorTab = 'conversation' | 'commits' | 'files';

/**
 * Modern 50/50 Balanced 2-Column Split Modal for Creating, Inspecting, and Editing
 * GitHub Pull Requests & GitLab Merge Requests with Markdown Editor, AI Summary, Commits, Files & Comments.
 */
export const MergeRequestModal: React.FC = () => {
  const {
    activeRepoPath,
    isMergeRequestModalOpen,
    setIsMergeRequestModalOpen,
    user,
    status,
    setError,
  } = useGitStore();
  const { remotes, loadRemotes } = useRemoteStore();

  // Main Modal Mode: 'create' | 'list' | 'edit'
  const [activeTab, setActiveTab] = useState<'create' | 'list' | 'edit'>('create');
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');

  // Inspector Sub-Tabs
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('conversation');

  // Create Mode Form State
  const [sourceBranch, setSourceBranch] = useState(status?.current_branch || 'main');
  const [targetBranch, setTargetBranch] = useState('main');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  const [squashCommits, setSquashCommits] = useState(false);
  const [deleteSourceBranch, setDeleteSourceBranch] = useState(false);
  const [selectedRemote, setSelectedRemote] = useState('origin');

  // Edit Mode Form State
  const [editingMr, setEditingMr] = useState<UnifiedMergeRequest | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTargetBranch, setEditTargetBranch] = useState('');
  const [editEditorTab, setEditEditorTab] = useState<'write' | 'preview'>('write');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isClosingPr, setIsClosingPr] = useState(false);
  const [isGeneratingAiForEdit, setIsGeneratingAiForEdit] = useState(false);

  // List & Inspector State
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedMrId, setSelectedMrId] = useState<string | null>(null);

  // Inspector Details: Commits, Files, Comments
  const [prComments, setPrComments] = useState<PullRequestComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentEditorTab, setCommentEditorTab] = useState<'write' | 'preview'>('write');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Comment Actions & Context Menu
  const [activeCommentMenuId, setActiveCommentMenuId] = useState<number | string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [isSavingCommentEdit, setIsSavingCommentEdit] = useState(false);
  const [hiddenCommentIds, setHiddenCommentIds] = useState<Set<number>>(new Set());

  // Merge PR Modal State
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeMethod, setMergeMethod] = useState<'merge' | 'squash' | 'rebase'>('merge');
  const [mergeCommitTitle, setMergeCommitTitle] = useState('');
  const [mergeCommitMessage, setMergeCommitMessage] = useState('');
  const [deleteBranchAfterMerge, setDeleteBranchAfterMerge] = useState(false);
  const [squashAfterMerge, setSquashAfterMerge] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  const [prCommits, setPrCommits] = useState<CommitInfo[]>([]);
  const [prFiles, setPrFiles] = useState<CommitFileStat[]>([]);
  const [totalAdditions, setTotalAdditions] = useState(0);
  const [totalDeletions, setTotalDeletions] = useState(0);
  const [isLoadingBranchDiff, setIsLoadingBranchDiff] = useState(false);

  // Diff View Mode (Unified vs Split) & Expanded files
  const [diffViewMode, setDiffViewMode] = useState<'unified' | 'split'>('unified');
  const [openFilePaths, setOpenFilePaths] = useState<Set<string>>(new Set());
  const [fileDiffCache, setFileDiffCache] = useState<Record<string, DiffResult>>({});
  const [loadingFilePaths, setLoadingFilePaths] = useState<Set<string>>(new Set());
  const [copiedFilePath, setCopiedFilePath] = useState<string | null>(null);

  // Data & Loaders
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [mergeRequests, setMergeRequests] = useState<UnifiedMergeRequest[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track unsaved form edits
  const isDirty = useMemo(() => {
    if (activeTab === 'create') {
      return title.trim() !== '' || description.trim() !== '';
    }
    if (activeTab === 'edit' && editingMr) {
      return (
        editTitle !== (editingMr.title || '') ||
        editDescription !== (editingMr.description || '') ||
        editTargetBranch !== (editingMr.target_branch || '')
      );
    }
    return false;
  }, [activeTab, title, description, editingMr, editTitle, editDescription, editTargetBranch]);

  const { showConfirm, requestClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard({
    isDirty,
    onClose: () => setIsMergeRequestModalOpen(false),
  });
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const editTitleInputRef = useRef<HTMLInputElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Resizable panel width state
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pr_modal_left_width');
      return saved ? Math.max(260, Math.min(650, parseInt(saved, 10))) : 360;
    } catch {
      return 360;
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
      const newWidth = Math.max(260, Math.min(modalRect.width - 340, e.clientX - modalRect.left));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      try {
        localStorage.setItem('pr_modal_left_width', leftPanelWidth.toString());
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

  // Initialize & Load branches/remotes on open
  useEffect(() => {
    if (!isMergeRequestModalOpen || !activeRepoPath) {
      setEditingMr(null);
      return;
    }

    setIsLoadingBranches(true);
    setFormError(null);

    const current = status?.current_branch || 'main';
    setSourceBranch(current);

    GitService.listBranches(activeRepoPath)
      .then((res) => {
        if (res && res.length > 0) {
          setBranches(res);
          const otherBranches = res.filter((b) => b.name !== current);
          const defaultTarget =
            otherBranches.find((b) => b.name === 'main' || b.name === 'master')?.name ||
            otherBranches[0]?.name ||
            (current === 'main' ? 'dev' : 'main');
          setTargetBranch(defaultTarget);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingBranches(false));

    loadRemotes(activeRepoPath)
      .then(() => {
        const state = useRemoteStore.getState();
        if (state.activeRemote) {
          setSelectedRemote(state.activeRemote);
        } else if (state.remotes.length > 0) {
          setSelectedRemote(state.remotes[0].name);
        }
      })
      .catch(() => {});

    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 80);
  }, [isMergeRequestModalOpen, activeRepoPath]);

  const targetRemoteInfo = useMemo(() => {
    const remote = remotes.find((r) => r.name === selectedRemote) || remotes[0];
    return parseRemoteRepoInfo(remote?.url || remote?.push_url);
  }, [remotes, selectedRemote]);

  const providerName = useMemo(() => {
    if (targetRemoteInfo?.provider === 'github') return 'GitHub';
    if (targetRemoteInfo?.provider === 'gitlab') return 'GitLab';
    if (user?.provider === 'github') return 'GitHub';
    return 'GitLab';
  }, [targetRemoteInfo, user]);

  const requestTypeLabel = providerName === 'GitHub' ? 'Pull Request' : 'Merge Request';

  // Load Open Pull / Merge Requests
  const loadMergeRequests = useCallback(async () => {
    if (!activeRepoPath) return;
    setIsLoadingList(true);
    try {
      const projectPath = targetRemoteInfo?.projectPath || '1';
      const serverUrl = targetRemoteInfo?.serverUrl;
      const provider = targetRemoteInfo?.provider !== 'unknown' ? targetRemoteInfo?.provider : user?.provider;
      const res = await PullRequestService.listOpenPullRequests(projectPath, serverUrl, provider);
      setMergeRequests(res || []);
      if (res && res.length > 0) {
        setSelectedMrId((prev) => (prev && res.some((m) => String(m.id) === prev) ? prev : String(res[0].id)));
      }
    } catch (err: unknown) {
      setMergeRequests([]);
      setFormError(parseApiError(err) || 'Could not load open requests');
    } finally {
      setIsLoadingList(false);
    }
  }, [activeRepoPath, targetRemoteInfo?.projectPath, targetRemoteInfo?.serverUrl, targetRemoteInfo?.provider, user?.provider]);

  // Load Open Requests once when modal opens or active repository changes
  useEffect(() => {
    if (isMergeRequestModalOpen && activeRepoPath) {
      loadMergeRequests();
    }
  }, [isMergeRequestModalOpen, activeRepoPath, selectedRemote]);

  // Check if an open PR already exists for the selected source branch
  const existingPrForSource = useMemo(() => {
    return mergeRequests.find(
      (mr) => mr.source_branch === sourceBranch && (mr.state?.toLowerCase() === 'open' || mr.state?.toLowerCase() === 'opened')
    );
  }, [mergeRequests, sourceBranch]);

  // Branch dropdown options
  const branchOptions = useMemo(() => {
    return formatBranchDropdownOptions(branches);
  }, [branches]);

  // Global click listener to dismiss comment context menu
  useEffect(() => {
    const handleGlobalClick = () => {
      if (activeCommentMenuId !== null) {
        setActiveCommentMenuId(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [activeCommentMenuId]);

  // Remote options
  const remoteOptions = useMemo(() => {
    return remotes.map((r) => ({
      value: r.name,
      label: r.name,
      description: r.url || r.push_url || undefined,
      icon: <Globe className="w-3.5 h-3.5 text-text-muted" />,
    }));
  }, [remotes]);

  // Filtered list
  const filteredMergeRequests = useMemo(() => {
    if (!searchFilter.trim()) return mergeRequests;
    const q = searchFilter.toLowerCase();
    return mergeRequests.filter(
      (mr) =>
        mr.title.toLowerCase().includes(q) ||
        mr.source_branch.toLowerCase().includes(q) ||
        mr.target_branch.toLowerCase().includes(q) ||
        (mr.author_name && mr.author_name.toLowerCase().includes(q))
    );
  }, [mergeRequests, searchFilter]);

  // Currently active selected PR for inspector
  const activeSelectedMr = useMemo(() => {
    if (filteredMergeRequests.length === 0) return null;
    if (selectedMrId) {
      return filteredMergeRequests.find((m) => String(m.id) === selectedMrId) || filteredMergeRequests[0];
    }
    return filteredMergeRequests[0];
  }, [filteredMergeRequests, selectedMrId]);

  // Load comments and branch diff whenever active selected PR changes
  const loadPrDetails = useCallback(async () => {
    if (!activeSelectedMr || !activeRepoPath) return;

    const projectPath = targetRemoteInfo?.projectPath || '1';
    const serverUrl = targetRemoteInfo?.serverUrl;
    const provider = targetRemoteInfo?.provider !== 'unknown' ? targetRemoteInfo?.provider : user?.provider;
    const prNumber = Number(activeSelectedMr.iid || activeSelectedMr.id);

    // 1. Load Comments
    setIsLoadingComments(true);
    PullRequestService.getComments(projectPath, prNumber, serverUrl, provider)
      .then((comments) => {
        setPrComments(comments || []);
      })
      .catch(() => {
        setPrComments([]);
      })
      .finally(() => {
        setIsLoadingComments(false);
      });

    // 2. Load Commits & Changed Files between branches
    setIsLoadingBranchDiff(true);
    GitService.getBranchComparison(activeRepoPath, activeSelectedMr.target_branch, activeSelectedMr.source_branch)
      .then((diffRes) => {
        if (diffRes) {
          setPrCommits(diffRes.commits || []);
          setPrFiles(diffRes.files || []);
          setTotalAdditions(diffRes.total_additions || 0);
          setTotalDeletions(diffRes.total_deletions || 0);

          // If there are files and none open, auto-open the first file
          if (diffRes.files && diffRes.files.length > 0) {
            setOpenFilePaths(new Set([diffRes.files[0].path]));
            GitService.getFileDiff(activeRepoPath, diffRes.files[0].path, false)
              .then((fDiff) => {
                setFileDiffCache({ [diffRes.files[0].path]: fDiff });
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {
        setPrCommits([]);
        setPrFiles([]);
      })
      .finally(() => {
        setIsLoadingBranchDiff(false);
      });
  }, [activeSelectedMr, activeRepoPath, targetRemoteInfo?.projectPath, targetRemoteInfo?.serverUrl, targetRemoteInfo?.provider, user?.provider]);

  useEffect(() => {
    if (activeTab === 'list' && activeSelectedMr) {
      loadPrDetails();
    }
  }, [activeTab, activeSelectedMr?.id, loadPrDetails]);

  // Toggle single file diff in Files Changed tab
  const handleToggleFileDiff = async (filePath: string) => {
    const nextOpen = new Set(openFilePaths);
    if (nextOpen.has(filePath)) {
      nextOpen.delete(filePath);
      setOpenFilePaths(nextOpen);
      return;
    }

    nextOpen.add(filePath);
    setOpenFilePaths(nextOpen);

    if (!fileDiffCache[filePath] && activeRepoPath) {
      setLoadingFilePaths((prev) => new Set(prev).add(filePath));
      try {
        const res = await GitService.getFileDiff(activeRepoPath, filePath, false);
        setFileDiffCache((prev) => ({ ...prev, [filePath]: res }));
      } catch {
        // fail gracefully
      } finally {
        setLoadingFilePaths((prev) => {
          const next = new Set(prev);
          next.delete(filePath);
          return next;
        });
      }
    }
  };

  // Expand / Collapse All files
  const handleToggleExpandAll = async () => {
    if (openFilePaths.size === prFiles.length && prFiles.length > 0) {
      setOpenFilePaths(new Set());
      return;
    }

    const allPaths = new Set(prFiles.map((f) => f.path));
    setOpenFilePaths(allPaths);

    const uncached = prFiles.filter((f) => !fileDiffCache[f.path]);
    if (uncached.length > 0 && activeRepoPath) {
      for (const f of uncached) {
        setLoadingFilePaths((prev) => new Set(prev).add(f.path));
        GitService.getFileDiff(activeRepoPath, f.path, false)
          .then((res) => {
            setFileDiffCache((prev) => ({ ...prev, [f.path]: res }));
          })
          .catch(() => {})
          .finally(() => {
            setLoadingFilePaths((prev) => {
              const next = new Set(prev);
              next.delete(f.path);
              return next;
            });
          });
      }
    }
  };

  const handleCopyFilePath = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedFilePath(path);
    setTimeout(() => setCopiedFilePath(null), 2000);
  };

  // Post a new comment to PR
  const handlePostComment = async () => {
    if (!activeSelectedMr || !newCommentText.trim() || isPostingComment) return;

    setIsPostingComment(true);
    try {
      const projectPath = targetRemoteInfo?.projectPath || '1';
      const serverUrl = targetRemoteInfo?.serverUrl;
      const provider = targetRemoteInfo?.provider !== 'unknown' ? targetRemoteInfo?.provider : user?.provider;
      const prNumber = Number(activeSelectedMr.iid || activeSelectedMr.id);

      const added = await PullRequestService.addComment(
        projectPath,
        prNumber,
        newCommentText.trim(),
        serverUrl,
        provider
      );

      setPrComments((prev) => [...prev, added]);
      setNewCommentText('');
      setCommentEditorTab('write');
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Comment Added',
        message: 'Your comment was posted successfully.',
      });
    } catch (err: unknown) {
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Failed to Post Comment',
        message: parseApiError(err),
      });
    } finally {
      setIsPostingComment(false);
    }
  };

  // Open Merge Modal
  const handleOpenMergeModal = () => {
    if (!activeSelectedMr) return;
    setMergeCommitTitle(`Merge pull request #${activeSelectedMr.id} from ${activeSelectedMr.source_branch}`);
    setMergeCommitMessage(`Merge branch '${activeSelectedMr.source_branch}' into ${activeSelectedMr.target_branch}`);
    setShowMergeModal(true);
  };

  // Execute Merge
  const handleMergePr = async () => {
    if (!activeSelectedMr || isMerging) return;
    setIsMerging(true);
    try {
      const projectPath = targetRemoteInfo?.projectPath || '1';
      const serverUrl = targetRemoteInfo?.serverUrl;
      const provider = targetRemoteInfo?.provider !== 'unknown' ? targetRemoteInfo?.provider : user?.provider;
      const prNumber = Number(activeSelectedMr.iid || activeSelectedMr.id);

      await PullRequestService.mergePullRequest(projectPath, prNumber, {
        mergeMethod,
        commitTitle: mergeCommitTitle.trim() || undefined,
        commitMessage: mergeCommitMessage.trim() || undefined,
        squash: squashAfterMerge,
        shouldRemoveSourceBranch: deleteBranchAfterMerge,
        serverUrl,
        provider,
      });

      useToastStore.getState().showToast({
        type: 'success',
        title: `${requestTypeLabel} Merged`,
        message: `Successfully merged #${activeSelectedMr.id} into ${activeSelectedMr.target_branch}`,
      });

      setShowMergeModal(false);
      await loadMergeRequests();
    } catch (err: unknown) {
      const msg = parseApiError(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Merge Failed',
        message: msg,
      });
    } finally {
      setIsMerging(false);
    }
  };

  // Comment Context Actions
  const handleCopyCommentLink = (commentId?: number) => {
    if (!activeSelectedMr) return;
    const url = commentId
      ? `${activeSelectedMr.web_url}#issuecomment-${commentId}`
      : activeSelectedMr.web_url;
    navigator.clipboard.writeText(url);
    useToastStore.getState().showToast({
      type: 'info',
      title: 'Link Copied',
      message: 'Direct link copied to clipboard',
    });
    setActiveCommentMenuId(null);
  };

  const handleCopyCommentMarkdown = (body: string) => {
    navigator.clipboard.writeText(body);
    useToastStore.getState().showToast({
      type: 'info',
      title: 'Markdown Copied',
      message: 'Markdown text copied to clipboard',
    });
    setActiveCommentMenuId(null);
  };

  const handleQuoteReply = (body: string) => {
    const quoted = body
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    setNewCommentText((prev) => (prev.trim() ? `${prev.trim()}\n\n${quoted}\n\n` : `${quoted}\n\n`));
    setCommentEditorTab('write');
    setActiveCommentMenuId(null);
    setTimeout(() => {
      commentTextareaRef.current?.focus();
    }, 60);
  };

  const handleReferenceInNewIssue = (commentId?: number) => {
    if (!activeSelectedMr) return;
    const refText = commentId
      ? `Ref: ${activeSelectedMr.title} (#${activeSelectedMr.id} comment #${commentId})`
      : `Ref: ${activeSelectedMr.title} (#${activeSelectedMr.id})`;
    navigator.clipboard.writeText(refText);
    useToastStore.getState().showToast({
      type: 'info',
      title: 'Reference Copied',
      message: 'Reference text copied to clipboard for new issue',
    });
    setActiveCommentMenuId(null);
  };

  const handleStartEditComment = (commentId: number, currentBody: string) => {
    setEditingCommentId(commentId);
    setEditingCommentBody(currentBody);
    setActiveCommentMenuId(null);
  };

  const handleSaveEditComment = async (commentId: number) => {
    if (!activeSelectedMr || !editingCommentBody.trim() || isSavingCommentEdit) return;
    setIsSavingCommentEdit(true);
    try {
      const projectPath = targetRemoteInfo?.projectPath || '1';
      const serverUrl = targetRemoteInfo?.serverUrl;
      const provider = targetRemoteInfo?.provider !== 'unknown' ? targetRemoteInfo?.provider : user?.provider;
      const prNumber = Number(activeSelectedMr.iid || activeSelectedMr.id);

      const updated = await PullRequestService.editComment(
        projectPath,
        prNumber,
        commentId,
        editingCommentBody.trim(),
        serverUrl,
        provider
      );

      setPrComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, body: updated.body } : c))
      );
      setEditingCommentId(null);
      setEditingCommentBody('');
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Comment Updated',
        message: 'Your comment has been edited.',
      });
    } catch (err: unknown) {
      const msg = parseApiError(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Edit Failed',
        message: msg,
      });
    } finally {
      setIsSavingCommentEdit(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!activeSelectedMr) return;
    if (!confirm('Are you sure you want to delete this comment?')) return;
    setActiveCommentMenuId(null);

    try {
      const projectPath = targetRemoteInfo?.projectPath || '1';
      const serverUrl = targetRemoteInfo?.serverUrl;
      const provider = targetRemoteInfo?.provider !== 'unknown' ? targetRemoteInfo?.provider : user?.provider;
      const prNumber = Number(activeSelectedMr.iid || activeSelectedMr.id);

      await PullRequestService.deleteComment(projectPath, prNumber, commentId, serverUrl, provider);
      setPrComments((prev) => prev.filter((c) => c.id !== commentId));
      useToastStore.getState().showToast({
        type: 'info',
        title: 'Comment Deleted',
        message: 'Comment was removed.',
      });
    } catch (err: unknown) {
      const msg = parseApiError(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Delete Failed',
        message: msg,
      });
    }
  };

  const handleToggleHideComment = (commentId: number) => {
    setHiddenCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
    setActiveCommentMenuId(null);
  };

  // Switch to Full 50/50 Workspace for Editing Selected PR
  const handleOpenFullEditWorkspace = (mr: UnifiedMergeRequest) => {
    setEditingMr(mr);
    setEditTitle(mr.title);
    setEditDescription(mr.description || '');
    setEditTargetBranch(mr.target_branch);
    setEditEditorTab('write');
    setFormError(null);
    setActiveTab('edit');
    setTimeout(() => {
      editTitleInputRef.current?.focus();
    }, 80);
  };

  // Save changes from Full 50/50 Edit Workspace
  const handleSaveFullEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingMr || !editTitle.trim() || isSavingEdit) return;

    setIsSavingEdit(true);
    setFormError(null);

    try {
      const projectPath = targetRemoteInfo?.projectPath || '1';
      const serverUrl = targetRemoteInfo?.serverUrl;
      const provider = targetRemoteInfo?.provider !== 'unknown' ? targetRemoteInfo?.provider : user?.provider;
      const prNumber = Number(editingMr.iid || editingMr.id);

      const updated = await PullRequestService.updatePullRequest(
        projectPath,
        prNumber,
        {
          title: editTitle.trim(),
          description: editDescription.trim(),
          targetBranch: editTargetBranch || undefined,
          serverUrl,
          provider,
        }
      );

      setMergeRequests((prev) =>
        prev.map((mr) => (mr.id === editingMr.id ? { ...mr, ...updated } : mr))
      );

      useToastStore.getState().showToast({
        type: 'success',
        title: `${requestTypeLabel} Updated`,
        message: `Successfully updated #${editingMr.id}`,
      });
      useLogStore
        .getState()
        .addLog('success', 'Merge Request', `Updated ${requestTypeLabel} #${editingMr.id} '${editTitle}'`);

      setActiveTab('list');
      setSelectedMrId(String(editingMr.id));
      setEditingMr(null);
    } catch (err: unknown) {
      const msg = parseApiError(err);
      setFormError(msg);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Update Failed',
        message: msg,
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Close or Reopen PR
  const handleCloseOrReopenPr = async (mrToToggle: UnifiedMergeRequest) => {
    if (!mrToToggle || isClosingPr) return;
    const isCurrentlyOpen = mrToToggle.state?.toLowerCase() === 'open' || mrToToggle.state?.toLowerCase() === 'opened';
    const actionLabel = isCurrentlyOpen ? 'close' : 'reopen';

    if (!confirm(`Are you sure you want to ${actionLabel} ${requestTypeLabel} #${mrToToggle.id} '${mrToToggle.title}'?`)) {
      return;
    }

    setIsClosingPr(true);
    setFormError(null);

    try {
      const projectPath = targetRemoteInfo?.projectPath || '1';
      const serverUrl = targetRemoteInfo?.serverUrl;
      const provider = targetRemoteInfo?.provider !== 'unknown' ? targetRemoteInfo?.provider : user?.provider;
      const prNumber = Number(mrToToggle.iid || mrToToggle.id);

      await PullRequestService.updatePullRequest(
        projectPath,
        prNumber,
        {
          state: isCurrentlyOpen ? 'closed' : 'open',
          serverUrl,
          provider,
        }
      );

      useToastStore.getState().showToast({
        type: 'info',
        title: `${requestTypeLabel} ${isCurrentlyOpen ? 'Closed' : 'Reopened'}`,
        message: `Successfully ${isCurrentlyOpen ? 'closed' : 'reopened'} #${mrToToggle.id}`,
      });

      await loadMergeRequests();
      if (activeTab === 'edit') {
        setActiveTab('list');
        setEditingMr(null);
      }
    } catch (err: unknown) {
      const msg = parseApiError(err);
      setFormError(msg);
      useToastStore.getState().showToast({
        type: 'error',
        title: `${isCurrentlyOpen ? 'Close' : 'Reopen'} Failed`,
        message: msg,
      });
    } finally {
      setIsClosingPr(false);
    }
  };

  // AI Description Generator for Edit Workspace
  const handleGenerateAiForEdit = async () => {
    if (!activeRepoPath || !editingMr || isGeneratingAiForEdit) return;

    setIsGeneratingAiForEdit(true);
    setFormError(null);

    try {
      const res = await ReleaseService.generateAiReleaseNotes(
        activeRepoPath,
        editingMr.source_branch,
        editTargetBranch !== editingMr.source_branch ? editTargetBranch : undefined
      );

      if (res && res.notes) {
        setEditDescription(res.notes);
        setEditEditorTab('preview');
        useToastStore.getState().showToast({
          type: 'success',
          title: 'Notes Generated',
          message: `Generated summary analyzing ${res.commits_analyzed} commits`,
        });
      }
    } catch (err: unknown) {
      try {
        const history = await GitService.getCommitHistory(activeRepoPath, 30);
        if (history && history.length > 0) {
          const commitBullets = history
            .filter((c) => !c.message.startsWith('Merge branch') && !c.message.startsWith('Merge pull request'))
            .map((c) => {
              const handle = `@${c.author_name.replace(/\s+/g, '')}`;
              return `- ${c.message} (\`${c.short_sha}\`) by ${handle}`;
            })
            .join('\n');
          const generated = `### Summary of Changes\n\n${commitBullets}\n\n### Review Notes\n- Verified branch diff between \`${editingMr.source_branch}\` and \`${editTargetBranch}\`\n- Ready for peer review`;
          setEditDescription(generated);
          setEditEditorTab('preview');
        }
      } catch {
        setFormError(parseApiError(err) || 'Could not generate AI description');
      }
    } finally {
      setIsGeneratingAiForEdit(false);
    }
  };

  // AI PR Summary & Notes Generator for Create Mode
  const handleGenerateAiDescription = async () => {
    if (!activeRepoPath || isGeneratingAi || !sourceBranch) return;

    setIsGeneratingAi(true);
    setFormError(null);

    try {
      const res = await ReleaseService.generateAiReleaseNotes(
        activeRepoPath,
        sourceBranch,
        targetBranch !== sourceBranch ? targetBranch : undefined
      );

      if (res && res.notes) {
        if (!title.trim() && res.title) {
          setTitle(res.title.replace(/^Release\s+/i, 'feat: '));
        }
        setDescription(res.notes);
        setEditorTab('preview');
        useToastStore.getState().showToast({
          type: 'success',
          title: 'PR Notes Generated',
          message: `Generated summary analyzing ${res.commits_analyzed} commits`,
        });
      }
    } catch (err: unknown) {
      try {
        const history = await GitService.getCommitHistory(activeRepoPath, 30);
        if (history && history.length > 0) {
          const commitBullets = history
            .filter((c) => !c.message.startsWith('Merge branch') && !c.message.startsWith('Merge pull request'))
            .map((c) => {
              const handle = `@${c.author_name.replace(/\s+/g, '')}`;
              return `- ${c.message} (\`${c.short_sha}\`) by ${handle}`;
            })
            .join('\n');
          const generated = `### Summary of Changes\n\n${commitBullets}\n\n### Review Notes\n- Verified branch diff between \`${sourceBranch}\` and \`${targetBranch}\`\n- Ready for peer review`;
          setDescription(generated);
          setEditorTab('preview');
          useToastStore.getState().showToast({
            type: 'info',
            title: 'Commit Notes Loaded',
            message: `Loaded ${history.length} commits into description`,
          });
        }
      } catch {
        setFormError(parseApiError(err) || 'Could not generate AI description');
      }
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Submit Handler for Create Mode
  const handleCreateMergeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    if (sourceBranch === targetBranch) {
      setFormError(`Source branch and target branch cannot be the same (${sourceBranch} → ${targetBranch}). Please select a different target base branch.`);
      return;
    }

    if (existingPrForSource) {
      setFormError(`A ${requestTypeLabel.toLowerCase()} (#${existingPrForSource.id}) already exists for '${sourceBranch}'.`);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    let finalTitle = title.trim();
    if (isDraft && !finalTitle.toLowerCase().startsWith('draft:') && !finalTitle.toLowerCase().startsWith('wip:')) {
      finalTitle = `Draft: ${finalTitle}`;
    }

    try {
      const projectPath = targetRemoteInfo?.projectPath || '1';
      const serverUrl = targetRemoteInfo?.serverUrl;
      const provider = targetRemoteInfo?.provider !== 'unknown' ? targetRemoteInfo?.provider : user?.provider;

      const res = await PullRequestService.createPullRequest(
        projectPath,
        sourceBranch,
        targetBranch,
        finalTitle,
        description.trim() || undefined,
        serverUrl,
        provider
      );

      useLogStore
        .getState()
        .addLog('success', 'Merge Request', `Created request '${finalTitle}' (${sourceBranch} -> ${targetBranch})`);

      useToastStore.getState().showToast({
        type: 'success',
        title: `${requestTypeLabel} Created`,
        message: `Successfully created ${requestTypeLabel} for ${sourceBranch} -> ${targetBranch}`,
      });

      setTitle('');
      setDescription('');
      setIsDraft(false);
      await loadMergeRequests();
      setActiveTab('list');

      if (res?.web_url) {
        openUrl(res.web_url).catch(() => {});
      }
    } catch (error: unknown) {
      const errorMsg = parseApiError(error);
      setFormError(errorMsg);
      setError(toAppError(error, 'MR_ERROR'));
      useLogStore.getState().addLog('error', 'Merge Request', `Failed to create request: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting && !isGeneratingAi && !isSavingEdit && !isPostingComment) {
      requestClose();
    }
  };

  if (!isMergeRequestModalOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-request-modal-title"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting && !isGeneratingAi && !isSavingEdit && !isPostingComment) {
          requestClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-100"
    >
      <div
        ref={modalContainerRef}
        className="w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col h-[88vh] max-h-[850px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header (Compact & Space-saving) */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
              <GitPullRequest className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h2 id="merge-request-modal-title" className="text-xs font-bold text-text-primary leading-none">
                {activeTab === 'edit' && editingMr
                  ? `Edit ${requestTypeLabel} #${editingMr.id}`
                  : `${requestTypeLabel}s`}
              </h2>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-base-2 border border-border rounded text-text-muted">
                {providerName}
              </span>
              <span className="text-border hidden sm:inline">•</span>
              <span className="text-[11px] text-text-muted truncate hidden sm:inline">
                {targetRemoteInfo?.projectPath || selectedRemote}
              </span>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'edit' ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('list');
                  setEditingMr(null);
                }}
                className="h-6.5 px-2.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <Tabs<'create' | 'list'>
                tabs={[
                  { id: 'create', label: `New ${requestTypeLabel}`, icon: <Plus className="w-3 h-3" /> },
                  {
                    id: 'list',
                    label: `Open (${mergeRequests.length})`,
                    icon: <GitPullRequest className="w-3 h-3" />,
                  },
                ]}
                activeTab={activeTab}
                onChange={(t) => {
                  setActiveTab(t);
                  setFormError(null);
                  setEditingMr(null);
                }}
                size="xs"
                variant="segmented"
                ariaLabel="Request view tabs"
              />
            )}

            <button
              onClick={requestClose}
              disabled={isSubmitting || isSavingEdit}
              className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer disabled:opacity-50"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {activeTab === 'create' ? (
          /* CREATE PULL REQUEST WORKSPACE (Resizable Left / Right) */
          <form onSubmit={handleCreateMergeRequest} className="flex-1 flex flex-row min-h-0 overflow-hidden">
            {/* Resizable Left Column */}
            <div
              style={{ width: `${leftPanelWidth}px` }}
              className="shrink-0 p-4 md:p-5 space-y-4 overflow-y-auto bg-base-0 flex flex-col min-h-0"
            >
              <div className="p-3.5 bg-base-1 border border-border rounded-sm space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-commito-coral" />
                    <span>Branch Comparison</span>
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_32px_1fr] items-end gap-2.5 pt-0.5 w-full">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-commito-coral flex items-center gap-1 font-mono uppercase">
                        <span>Source</span>
                        <span className="text-[9px] px-1 py-0.1 bg-commito-coral/15 rounded-xs border border-commito-coral/30">head</span>
                      </span>
                    </div>
                    <Dropdown
                      options={branchOptions}
                      value={sourceBranch}
                      onChange={setSourceBranch}
                      disabled={isSubmitting || isLoadingBranches}
                      placeholder={isLoadingBranches ? 'Loading...' : 'Source...'}
                      size="md"
                    />
                  </div>

                  <div className="flex items-center justify-center pb-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const temp = sourceBranch;
                        setSourceBranch(targetBranch);
                        setTargetBranch(temp);
                      }}
                      className="w-8 h-8 rounded-sm bg-base-0 hover:bg-base-2 border border-border text-text-muted hover:text-commito-coral flex items-center justify-center transition cursor-pointer shadow-2xs shrink-0 active:scale-95"
                      title="Swap source and target branches"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-emerald-400 flex items-center gap-1 font-mono uppercase">
                        <span>Target</span>
                        <span className="text-[9px] px-1 py-0.1 bg-emerald-500/15 rounded-xs border border-emerald-500/30">base</span>
                      </span>
                    </div>
                    <Dropdown
                      options={branchOptions}
                      value={targetBranch}
                      onChange={setTargetBranch}
                      disabled={isSubmitting || isLoadingBranches}
                      placeholder={isLoadingBranches ? 'Loading...' : 'Target...'}
                      size="md"
                    />
                  </div>
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary block">
                  {requestTypeLabel} Title <span className="text-commito-coral">*</span>
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  placeholder="e.g. Add dark mode toggle or Fix issue with sync"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  disabled={isSubmitting || isGeneratingAi}
                  className="w-full h-8.5 px-3 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs font-mono text-text-primary focus:outline-none transition shadow-2xs"
                  required
                />
              </div>

              {/* Remote Dropdown if multiple */}
              {remotes.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary block">Target Remote</label>
                  <Dropdown
                    options={remoteOptions}
                    value={selectedRemote}
                    onChange={setSelectedRemote}
                    disabled={isSubmitting || isGeneratingAi}
                    size="md"
                  />
                </div>
              )}

              {/* Settings & Options */}
              <div className="p-3.5 bg-base-1 border border-border rounded-sm space-y-2.5 shadow-2xs">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted block pb-1 border-b border-border/60">
                  Settings & Options
                </span>

                <Checkbox
                  checked={isDraft}
                  onChange={setIsDraft}
                  disabled={isSubmitting || isGeneratingAi}
                  label={
                    <div>
                      <span className="text-xs font-semibold text-text-primary block">
                        Mark as Draft
                      </span>
                      <span className="text-[10.5px] text-text-muted block">
                        Prevents merging until marked ready
                      </span>
                    </div>
                  }
                />

                <Checkbox
                  checked={squashCommits}
                  onChange={setSquashCommits}
                  disabled={isSubmitting || isGeneratingAi}
                  label={
                    <div>
                      <span className="text-xs font-semibold text-text-primary block">
                        Squash commits upon merge
                      </span>
                    </div>
                  }
                />

                <Checkbox
                  checked={deleteSourceBranch}
                  onChange={setDeleteSourceBranch}
                  disabled={isSubmitting || isGeneratingAi}
                  label={
                    <div>
                      <span className="text-xs font-semibold text-text-primary block">
                        Delete branch after merge
                      </span>
                    </div>
                  }
                />
              </div>

              {/* Branch Warning Alerts */}
              {existingPrForSource ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-sm space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Existing Request Found</span>
                  </div>
                  <p className="text-[11.5px] text-text-secondary leading-normal">
                    A pull request (<span className="font-mono text-amber-400">#{existingPrForSource.id}</span>) from{' '}
                    <span className="font-mono text-commito-coral">'{sourceBranch}'</span> already exists.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMrId(String(existingPrForSource.id));
                      setActiveTab('list');
                    }}
                    className="mt-1 text-[11px] font-semibold text-commito-coral hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Pull Request #{existingPrForSource.id}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              ) : sourceBranch === targetBranch ? (
                <div className="p-3 bg-git-removed-bg border border-git-removed/40 rounded-sm space-y-1 text-xs text-git-removed">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Identical Branches</span>
                  </div>
                  <p className="text-[11.5px] text-text-secondary leading-normal">
                    Choose two different branches to create a {requestTypeLabel.toLowerCase()}.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-sm space-y-1 text-xs text-emerald-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Branches Differ</span>
                  </div>
                  <p className="text-[11.5px] text-text-secondary leading-normal">
                    Changes on <span className="font-mono text-commito-coral">'{sourceBranch}'</span> will be submitted into{' '}
                    <span className="font-mono text-emerald-400">'{targetBranch}'</span>.
                  </p>
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 p-2.5 rounded-xs bg-git-removed-bg border border-git-removed/40 text-git-removed text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{formError}</span>
                </div>
              )}
            </div>

            {/* Resizable Divider Splitter Handle */}
            <div
              onMouseDown={startResizingLeft}
              onDoubleClick={() => setLeftPanelWidth(360)}
              title="Drag to resize • Double-click to reset"
              className={`w-1.5 h-full cursor-col-resize z-20 shrink-0 transition-colors relative group/resizer hover:bg-commito-coral/50 ${
                isResizingLeft ? 'bg-commito-coral' : 'bg-transparent border-r border-border'
              }`}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>

            {/* Right Column */}
            <div className="flex-1 min-w-0 p-4 md:p-5 overflow-hidden flex flex-col bg-base-1/25 min-h-0 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/70 shrink-0">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-commito-coral" />
                    <span>Description & Review Notes</span>
                  </label>
                  <Tabs<'write' | 'preview'>
                    tabs={[
                      { id: 'write', label: 'Write' },
                      { id: 'preview', label: 'Preview' },
                    ]}
                    activeTab={editorTab}
                    onChange={setEditorTab}
                    size="xs"
                    ariaLabel="PR description view"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAiDescription}
                  disabled={isSubmitting || isGeneratingAi || !sourceBranch}
                  className="h-6.5 px-2.5 bg-commito-coral/10 hover:bg-commito-coral/20 border border-commito-coral/35 text-[11px] font-semibold text-commito-coral rounded-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50 active:scale-95"
                  title="Generate notes analyzing commit history"
                >
                  {isGeneratingAi ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral" />
                      <span>Synthesizing Commits...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-commito-coral" />
                      <span>Generate Notes with AI</span>
                    </>
                  )}
                </button>
              </div>

              {/* Description Input / Markdown Area */}
              <div className="flex-1 min-h-0 bg-base-1 border border-border rounded-sm overflow-hidden flex flex-col shadow-2xs">
                {editorTab === 'write' ? (
                  <textarea
                    placeholder="Enter full description, checklist, or click 'Generate Notes with AI' to analyze commits between branches automatically..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSubmitting || isGeneratingAi}
                    className="w-full h-full p-3.5 bg-transparent resize-none text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none leading-relaxed transition"
                  />
                ) : (
                  <div className="w-full h-full p-3.5 overflow-y-auto">
                    <MarkdownPreview
                      content={description}
                      emptyText="No description written yet. Switch to the Write tab or click 'Generate Notes with AI'."
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[10.5px] text-text-muted shrink-0 pt-0.5 font-mono">
                <span>
                  {description.length} characters • {description.trim() ? description.trim().split(/\s+/).length : 0} words
                </span>
                <span>Markdown & GFM supported</span>
              </div>
            </div>
          </form>
        ) : activeTab === 'edit' && editingMr ? (
          /* EDIT EXISTING PULL REQUEST WORKSPACE (Resizable Left / Right) */
          <form onSubmit={handleSaveFullEdit} className="flex-1 flex flex-row min-h-0 overflow-hidden">
            {/* Resizable Left Column */}
            <div
              style={{ width: `${leftPanelWidth}px` }}
              className="shrink-0 p-4 md:p-5 space-y-4 overflow-y-auto bg-base-0 flex flex-col min-h-0"
            >
              <div className="p-3.5 bg-base-1 border border-border rounded-sm space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-commito-coral" />
                    <span>Branch Configuration</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded-xs font-mono font-semibold uppercase">
                    {editingMr.state || 'OPEN'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5 w-full">
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10.5px] font-bold text-commito-coral flex items-center gap-1 font-mono uppercase">
                      <span>Source Branch</span>
                      <span className="text-[9px] px-1 py-0.1 bg-commito-coral/15 rounded-xs border border-commito-coral/30">head</span>
                    </span>
                    <div className="h-8.5 px-3 bg-base-0 border border-border rounded-sm text-xs font-mono text-commito-coral font-bold flex items-center truncate">
                      {editingMr.source_branch}
                    </div>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <span className="text-[10.5px] font-bold text-emerald-400 flex items-center gap-1 font-mono uppercase">
                      <span>Target Branch</span>
                      <span className="text-[9px] px-1 py-0.1 bg-emerald-500/15 rounded-xs border border-emerald-500/30">base</span>
                    </span>
                    <Dropdown
                      options={branchOptions}
                      value={editTargetBranch}
                      onChange={setEditTargetBranch}
                      disabled={isSavingEdit}
                      placeholder="Target base branch..."
                      size="md"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary block">
                  {requestTypeLabel} Title <span className="text-commito-coral">*</span>
                </label>
                <input
                  ref={editTitleInputRef}
                  type="text"
                  placeholder="Pull request title..."
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  disabled={isSavingEdit}
                  className="w-full h-8.5 px-3 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs font-mono text-text-primary focus:outline-none transition shadow-2xs"
                  required
                />
              </div>

              <div className="p-3.5 bg-base-1 border border-border rounded-sm space-y-2 text-xs font-mono">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted block pb-1 border-b border-border/60">
                  Request Metadata
                </span>
                <div className="flex items-center justify-between text-text-muted pt-1">
                  <span>Author:</span>
                  <span className="text-text-primary font-bold">@{editingMr.author_name}</span>
                </div>
                <div className="flex items-center justify-between text-text-muted">
                  <span>Request Number:</span>
                  <span className="text-text-primary font-bold">#{editingMr.id}</span>
                </div>
                {editingMr.web_url && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => openUrl(editingMr.web_url!)}
                      className="w-full h-7 px-2.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs text-text-primary flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <span>View on {providerName}</span>
                      <ExternalLink className="w-3 h-3 text-text-muted" />
                    </button>
                  </div>
                )}
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-2.5 rounded-xs bg-git-removed-bg border border-git-removed/40 text-git-removed text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{formError}</span>
                </div>
              )}
            </div>

            {/* Resizable Divider Splitter Handle */}
            <div
              onMouseDown={startResizingLeft}
              onDoubleClick={() => setLeftPanelWidth(360)}
              title="Drag to resize • Double-click to reset"
              className={`w-1.5 h-full cursor-col-resize z-20 shrink-0 transition-colors relative group/resizer hover:bg-commito-coral/50 ${
                isResizingLeft ? 'bg-commito-coral' : 'bg-transparent border-r border-border'
              }`}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>

            {/* Right Column */}
            <div className="flex-1 min-w-0 p-4 md:p-5 overflow-hidden flex flex-col bg-base-1/25 min-h-0 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/70 shrink-0">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-commito-coral" />
                    <span>Description & Review Notes</span>
                  </label>
                  <Tabs<'write' | 'preview'>
                    tabs={[
                      { id: 'write', label: 'Write' },
                      { id: 'preview', label: 'Preview' },
                    ]}
                    activeTab={editEditorTab}
                    onChange={setEditEditorTab}
                    size="xs"
                    ariaLabel="Edit description view"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAiForEdit}
                  disabled={isSavingEdit || isGeneratingAiForEdit}
                  className="h-6.5 px-2.5 bg-commito-coral/10 hover:bg-commito-coral/20 border border-commito-coral/35 text-[11px] font-semibold text-commito-coral rounded-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50 active:scale-95"
                  title="Generate notes analyzing commit history"
                >
                  {isGeneratingAiForEdit ? (
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

              <div className="flex-1 min-h-0 bg-base-1 border border-border rounded-sm overflow-hidden flex flex-col shadow-2xs">
                {editEditorTab === 'write' ? (
                  <textarea
                    placeholder="Enter updated pull request description or checklist..."
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    disabled={isSavingEdit}
                    className="w-full h-full p-3.5 bg-transparent resize-none text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none leading-relaxed transition"
                  />
                ) : (
                  <div className="w-full h-full p-3.5 overflow-y-auto">
                    <MarkdownPreview
                      content={editDescription}
                      emptyText="No description written yet."
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[10.5px] text-text-muted shrink-0 pt-0.5 font-mono">
                <span>
                  {editDescription.length} characters • {editDescription.trim() ? editDescription.trim().split(/\s+/).length : 0} words
                </span>
                <span>Markdown & GFM supported</span>
              </div>
            </div>
          </form>
        ) : (
          /* LIST & INSPECT OPEN REQUESTS (Master-Detail with Conversation, Commits, Files & Comments) */
          <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
            {/* Left Resizable Column: Search & Request Cards List */}
            <div
              style={{ width: `${leftPanelWidth}px` }}
              className="shrink-0 p-3 flex flex-col min-h-0 overflow-hidden space-y-2.5 bg-base-0"
            >
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={`Search ${requestTypeLabel.toLowerCase()}s...`}
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full h-7.5 pl-7.5 pr-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary focus:outline-none transition shadow-2xs placeholder:text-text-faint font-sans"
                  />
                </div>

                <button
                  type="button"
                  onClick={loadMergeRequests}
                  disabled={isLoadingList}
                  className="h-7.5 px-2 bg-base-1 hover:bg-base-2 border border-border rounded-sm text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 transition cursor-pointer disabled:opacity-50 shadow-2xs shrink-0"
                  title="Refresh open requests from remote"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingList ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {isLoadingList ? (
                <div className="p-8 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-commito-coral mx-auto" />
                  <p className="text-xs font-medium text-text-muted">Loading open {requestTypeLabel.toLowerCase()}s...</p>
                </div>
              ) : filteredMergeRequests.length === 0 ? (
                <div className="p-6 text-center bg-base-0 border border-border rounded-sm space-y-2 flex-1 flex flex-col items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                  <h4 className="text-xs font-bold text-text-primary">No open {requestTypeLabel.toLowerCase()}s</h4>
                  <p className="text-[11px] text-text-muted max-w-xs mx-auto">
                    No active {requestTypeLabel.toLowerCase()}s pending on remote{' '}
                    <span className="font-mono text-text-primary font-semibold">{selectedRemote}</span>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="h-6.5 px-2.5 bg-commito-coral/15 hover:bg-commito-coral/25 border border-commito-coral/35 text-commito-coral rounded-sm text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create {requestTypeLabel}</span>
                  </button>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                  {filteredMergeRequests.map((mr) => {
                    const isSelected = String(mr.id) === String(activeSelectedMr?.id);
                    return (
                      <div
                        key={mr.id}
                        onClick={() => setSelectedMrId(String(mr.id))}
                        className={`p-2.5 rounded-sm border transition cursor-pointer space-y-1 select-none ${
                          isSelected
                            ? 'bg-commito-coral/10 border-commito-coral/50 shadow-2xs ring-1 ring-commito-coral/20'
                            : 'bg-base-1 border-border hover:border-border-strong hover:bg-base-1/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-1.5 py-0.2 bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-[9.5px] font-mono font-bold rounded-xs uppercase shrink-0">
                            {mr.state || 'OPEN'}
                          </span>
                          <span className="text-[10.5px] font-mono text-text-faint">#{mr.id}</span>
                        </div>

                        <h4 className="text-xs font-bold text-text-primary line-clamp-1 leading-tight">{mr.title}</h4>

                        <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono text-text-muted pt-0.5">
                          <span className="truncate">
                            <span className="text-commito-coral font-semibold">{mr.source_branch}</span>
                            {' → '}
                            <span className="text-emerald-400 font-semibold">{mr.target_branch}</span>
                          </span>
                          <span className="truncate shrink-0 flex items-center gap-1">
                            {mr.author_avatar ? (
                              <img src={mr.author_avatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover border border-border shrink-0" />
                            ) : null}
                            <span>@{mr.author_name.replace(/\s+/g, '')}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Resizable Divider Splitter Handle */}
            <div
              onMouseDown={startResizingLeft}
              onDoubleClick={() => setLeftPanelWidth(360)}
              title="Drag to resize • Double-click to reset"
              className={`w-1.5 h-full cursor-col-resize z-20 shrink-0 transition-colors relative group/resizer hover:bg-commito-coral/50 ${
                isResizingLeft ? 'bg-commito-coral' : 'bg-transparent border-r border-border'
              }`}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>

            {/* Right Column: Full Inspector with Sub-Tabs */}
            <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden bg-base-1/25">
              {activeSelectedMr ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* Top Inspector Header Card (Ultra-compact 2-row layout) */}
                  <div className="px-3.5 py-2 border-b border-border bg-base-0 shrink-0 space-y-1.5 shadow-2xs">
                    {/* Row 1: Status Pill + #ID + Title + Action Buttons */}
                    <div className="flex items-center justify-between gap-2.5 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-[10px] font-mono font-bold rounded-xs uppercase shrink-0">
                          {activeSelectedMr.state || 'OPEN'}
                        </span>
                        <span className="text-xs font-mono text-text-muted font-bold shrink-0">#{activeSelectedMr.id}</span>
                        <h3 className="text-xs font-bold text-text-primary truncate">{activeSelectedMr.title}</h3>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {(activeSelectedMr.state?.toLowerCase() === 'open' || activeSelectedMr.state?.toLowerCase() === 'opened') && (
                          <button
                            type="button"
                            onClick={handleOpenMergeModal}
                            className="h-6.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs active:scale-95"
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                            <span>Merge</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenFullEditWorkspace(activeSelectedMr)}
                          className="h-6.5 px-2.5 bg-base-1 hover:bg-base-2 border border-border text-text-primary rounded-sm text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs active:scale-95"
                        >
                          <Edit3 className="w-3 h-3 text-text-muted" />
                          <span>Edit</span>
                        </button>

                        {activeSelectedMr.web_url && (
                          <button
                            type="button"
                            onClick={() => openUrl(activeSelectedMr.web_url!)}
                            className="h-6.5 px-2 bg-base-1 hover:bg-base-2 border border-border text-text-primary rounded-sm text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                            title={`Open on ${providerName}`}
                          >
                            <span>{providerName}</span>
                            <ExternalLink className="w-3 h-3 text-text-muted" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Sub-Tabs on Left + Metadata Route and Additions/Deletions on Right */}
                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/60">
                      <Tabs<InspectorTab>
                        tabs={[
                          {
                            id: 'conversation',
                            label: 'Conversation',
                            icon: <MessageSquare className="w-3 h-3" />,
                            badge: prComments.length > 0 ? prComments.length : undefined,
                            badgeVariant: 'neutral',
                          },
                          {
                            id: 'commits',
                            label: 'Commits',
                            icon: <GitCommit className="w-3 h-3" />,
                            badge: isLoadingBranchDiff ? undefined : prCommits.length,
                            badgeVariant: 'neutral',
                          },
                          {
                            id: 'files',
                            label: 'Files Changed',
                            icon: <FileCode className="w-3 h-3" />,
                            badge: isLoadingBranchDiff ? undefined : prFiles.length,
                            badgeVariant: 'neutral',
                          },
                        ]}
                        activeTab={inspectorTab}
                        onChange={setInspectorTab}
                        size="xs"
                        variant="segmented"
                        ariaLabel="Pull request sub tabs"
                      />

                      <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted flex-wrap">
                        <div className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3 text-commito-coral shrink-0" />
                          <span className="text-commito-coral font-bold">{activeSelectedMr.source_branch}</span>
                          <span className="text-text-faint">→</span>
                          <span className="text-emerald-400 font-bold">{activeSelectedMr.target_branch}</span>
                        </div>

                        <span className="text-border">•</span>

                        <div className="flex items-center gap-1">
                          {activeSelectedMr.author_avatar ? (
                            <img
                              src={activeSelectedMr.author_avatar}
                              alt=""
                              className="w-3.5 h-3.5 rounded-full object-cover border border-border shrink-0"
                            />
                          ) : (
                            <User className="w-3 h-3 text-text-faint shrink-0" />
                          )}
                          <span>@{activeSelectedMr.author_name.replace(/\s+/g, '')}</span>
                        </div>

                        {(totalAdditions > 0 || totalDeletions > 0) && (
                          <>
                            <span className="text-border">•</span>
                            <div className="flex items-center gap-1 font-mono text-[10.5px] font-bold px-1.5 py-0.2 rounded-xs bg-base-1 border border-border">
                              <span className="text-emerald-400">+{totalAdditions}</span>
                              <span className="text-red-400">-{totalDeletions}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Inspector Body Content based on Sub-Tab */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                    {inspectorTab === 'conversation' && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Main Conversation Stream (col 8) */}
                        <div className="lg:col-span-8 space-y-4">
                          {/* PR Description Post Card */}
                          <div className="bg-base-0 border border-border rounded-sm shadow-2xs">
                            <div className="px-3.5 py-2 bg-base-1 border-b border-border/80 flex items-center justify-between relative rounded-t-sm">
                              <div className="flex items-center gap-2">
                                {activeSelectedMr.author_avatar ? (
                                  <img
                                    src={activeSelectedMr.author_avatar}
                                    alt={activeSelectedMr.author_name}
                                    className="w-5 h-5 rounded-full object-cover border border-border shrink-0"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-commito-coral/20 border border-commito-coral/40 flex items-center justify-center text-[10px] font-bold text-commito-coral shrink-0">
                                    {activeSelectedMr.author_name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-xs font-bold text-text-primary">
                                  @{activeSelectedMr.author_name.replace(/\s+/g, '')}
                                </span>
                                <span className="text-[10.5px] text-text-muted">opened this request</span>
                              </div>

                              <div className="relative flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCommentMenuId(activeCommentMenuId === 'desc' ? null : 'desc');
                                  }}
                                  className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded transition cursor-pointer"
                                  title="Options"
                                >
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </button>

                                {activeCommentMenuId === 'desc' && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-1 z-50 w-48 bg-base-0 border border-border rounded-sm shadow-2xl py-1 text-xs text-text-primary animate-in fade-in zoom-in-95 duration-100 divide-y divide-border/60"
                                  >
                                    <div className="py-0.5">
                                      <button
                                        type="button"
                                        onClick={() => handleCopyCommentLink()}
                                        className="w-full px-3.5 py-1.5 text-left text-text-primary hover:bg-base-2 transition cursor-pointer text-xs font-normal"
                                      >
                                        Copy link
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyCommentMarkdown(activeSelectedMr.description || '')}
                                        className="w-full px-3.5 py-1.5 text-left text-text-primary hover:bg-base-2 transition cursor-pointer text-xs font-normal"
                                      >
                                        Copy Markdown
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleQuoteReply(activeSelectedMr.description || '')}
                                        className="w-full px-3.5 py-1.5 text-left text-text-primary hover:bg-base-2 transition cursor-pointer text-xs font-normal"
                                      >
                                        Quote reply
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleReferenceInNewIssue()}
                                        className="w-full px-3.5 py-1.5 text-left text-text-primary hover:bg-base-2 transition cursor-pointer text-xs font-normal"
                                      >
                                        Reference in new issue
                                      </button>
                                    </div>

                                    <div className="py-0.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveCommentMenuId(null);
                                          handleOpenFullEditWorkspace(activeSelectedMr);
                                        }}
                                        className="w-full px-3.5 py-1.5 text-left text-text-primary hover:bg-base-2 transition cursor-pointer text-xs font-normal"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="p-4 max-h-[320px] overflow-y-auto">
                              <MarkdownPreview
                                content={activeSelectedMr.description || ''}
                                emptyText="No description provided for this request."
                              />
                            </div>
                          </div>

                          {/* Existing Comments Thread */}
                          {isLoadingComments ? (
                            <div className="p-6 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-commito-coral" />
                              <span>Loading comments...</span>
                            </div>
                          ) : prComments.length > 0 ? (
                            <div className="space-y-3">
                              {prComments.map((comment) => {
                                const isHidden = hiddenCommentIds.has(comment.id);
                                const isEditing = editingCommentId === comment.id;

                                if (isHidden) {
                                  return (
                                    <div
                                      key={comment.id}
                                      className="bg-base-0 border border-border/70 rounded-sm px-3.5 py-2 flex items-center justify-between text-xs text-text-muted"
                                    >
                                      <span className="italic">This comment was hidden.</span>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleHideComment(comment.id)}
                                        className="text-[11px] font-semibold text-commito-coral hover:underline cursor-pointer"
                                      >
                                        Unhide
                                      </button>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={comment.id}
                                    className="bg-base-0 border border-border rounded-sm shadow-2xs animate-in fade-in duration-100 relative"
                                  >
                                    <div className="px-3.5 py-1.5 bg-base-1 border-b border-border/70 flex items-center justify-between text-xs relative rounded-t-sm">
                                      <div className="flex items-center gap-2">
                                        {comment.author_avatar ? (
                                          <img
                                            src={comment.author_avatar}
                                            alt={comment.author_name}
                                            className="w-5 h-5 rounded-full object-cover border border-border shrink-0"
                                          />
                                        ) : (
                                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0">
                                            {comment.author_name.charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                        <span className="font-bold text-text-primary">@{comment.author_username}</span>
                                        <span className="text-[10.5px] text-text-muted">
                                          commented {comment.created_at ? comment.created_at.slice(0, 10) : ''}
                                        </span>
                                      </div>

                                      <div className="relative flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveCommentMenuId(activeCommentMenuId === comment.id ? null : comment.id);
                                          }}
                                          className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded transition cursor-pointer"
                                          title="Options"
                                        >
                                          <MoreHorizontal className="w-3.5 h-3.5" />
                                        </button>

                                        {activeCommentMenuId === comment.id && (
                                          <div
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute right-0 top-full mt-1 z-50 w-48 bg-base-0 border border-border rounded-sm shadow-2xl py-1 text-xs text-text-primary animate-in fade-in zoom-in-95 duration-100 divide-y divide-border/60"
                                          >
                                            <div className="py-0.5">
                                              <button
                                                type="button"
                                                onClick={() => handleCopyCommentLink(comment.id)}
                                                className="w-full px-3.5 py-1.5 text-left text-text-primary hover:bg-base-2 transition cursor-pointer text-xs font-normal"
                                              >
                                                Copy link
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleCopyCommentMarkdown(comment.body)}
                                                className="w-full px-3.5 py-1.5 text-left text-text-primary hover:bg-base-2 transition cursor-pointer text-xs font-normal"
                                              >
                                                Copy Markdown
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleQuoteReply(comment.body)}
                                                className="w-full px-3.5 py-1.5 text-left text-text-primary hover:bg-base-2 transition cursor-pointer text-xs font-normal"
                                              >
                                                Quote reply
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleReferenceInNewIssue(comment.id)}
                                                className="w-full px-3.5 py-1.5 text-left text-text-primary hover:bg-base-2 transition cursor-pointer text-xs font-normal"
                                              >
                                                Reference in new issue
                                              </button>
                                            </div>

                                            <div className="py-0.5">
                                              <button
                                                type="button"
                                                onClick={() => handleStartEditComment(comment.id, comment.body)}
                                                className="w-full px-3.5 py-1.5 text-left text-text-primary hover:bg-base-2 transition cursor-pointer text-xs font-normal"
                                              >
                                                Edit
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleToggleHideComment(comment.id)}
                                                className="w-full px-3.5 py-1.5 text-left text-text-primary hover:bg-base-2 transition cursor-pointer text-xs font-normal"
                                              >
                                                Hide
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteComment(comment.id)}
                                                className="w-full px-3.5 py-1.5 text-left text-red-400 hover:text-red-300 hover:bg-red-500/10 transition cursor-pointer text-xs font-normal"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {isEditing ? (
                                      <div className="p-3 space-y-2">
                                        <textarea
                                          value={editingCommentBody}
                                          onChange={(e) => setEditingCommentBody(e.target.value)}
                                          disabled={isSavingCommentEdit}
                                          className="w-full h-24 p-2.5 bg-base-1 border border-border focus:border-commito-coral rounded-sm text-xs text-text-primary font-mono resize-none focus:outline-none transition"
                                        />
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setEditingCommentId(null)}
                                            disabled={isSavingCommentEdit}
                                            className="h-7 px-3 bg-base-1 hover:bg-base-2 border border-border text-text-primary rounded-sm text-xs font-semibold cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSaveEditComment(comment.id)}
                                            disabled={isSavingCommentEdit || !editingCommentBody.trim()}
                                            className="h-7 px-3.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                          >
                                            {isSavingCommentEdit && <Loader2 className="w-3 h-3 animate-spin" />}
                                            <span>Save Changes</span>
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="p-3.5 text-xs text-text-primary">
                                        <MarkdownPreview content={comment.body} />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}

                          {/* Add a Comment Card (GitHub Style) */}
                          <div className="bg-base-0 border border-border rounded-sm overflow-hidden shadow-2xs space-y-0">
                            <div className="px-3.5 py-2 bg-base-1 border-b border-border flex items-center justify-between">
                              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-commito-coral" />
                                <span>Add a comment</span>
                              </span>
                              <Tabs<'write' | 'preview'>
                                tabs={[
                                  { id: 'write', label: 'Write' },
                                  { id: 'preview', label: 'Preview' },
                                ]}
                                activeTab={commentEditorTab}
                                onChange={setCommentEditorTab}
                                size="xs"
                                ariaLabel="Comment mode tabs"
                              />
                            </div>

                            <div className="p-3">
                              {commentEditorTab === 'write' ? (
                                <textarea
                                  ref={commentTextareaRef}
                                  placeholder="Add your comment here... (Markdown supported)"
                                  value={newCommentText}
                                  onChange={(e) => setNewCommentText(e.target.value)}
                                  disabled={isPostingComment}
                                  className="w-full h-24 p-2.5 bg-base-1 border border-border focus:border-commito-coral rounded-sm text-xs text-text-primary placeholder:text-text-faint font-mono resize-none focus:outline-none transition"
                                />
                              ) : (
                                <div className="w-full min-h-[96px] p-2.5 bg-base-1 border border-border rounded-sm">
                                  <MarkdownPreview
                                    content={newCommentText}
                                    emptyText="Nothing to preview. Type a comment in the Write tab."
                                  />
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2">
                                <span className="text-[10px] text-text-muted font-mono">
                                  Markdown is supported
                                </span>
                                <button
                                  type="button"
                                  onClick={handlePostComment}
                                  disabled={!newCommentText.trim() || isPostingComment}
                                  className="h-7 px-3.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-xs active:scale-95"
                                >
                                  {isPostingComment ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span>Posting...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-3 h-3" />
                                      <span>Comment</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Sidebar Metadata Panel (col 4, GitHub style) */}
                        <div className="lg:col-span-4 space-y-3">
                          <div className="p-3.5 bg-base-0 border border-border rounded-sm space-y-3 shadow-2xs text-xs font-sans">
                            {/* Reviewers */}
                            <div className="space-y-1.5 pb-2.5 border-b border-border/70">
                              <div className="flex items-center justify-between text-text-secondary font-bold text-[11px] uppercase tracking-wider">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5 text-commito-coral" />
                                  <span>Reviewers</span>
                                </span>
                              </div>
                              {activeSelectedMr.reviewers && activeSelectedMr.reviewers.length > 0 ? (
                                <div className="space-y-1.5 pt-0.5">
                                  {activeSelectedMr.reviewers.map((r, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5">
                                      {r.avatar_url ? (
                                        <img src={r.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                                      ) : (
                                        <div className="w-4 h-4 rounded-full bg-base-2 border border-border flex items-center justify-center text-[9px] font-mono">
                                          {(r.name || r.username || 'R').charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="font-mono text-text-primary text-[11px] font-medium truncate">
                                        @{r.username || r.name}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-text-muted">No reviews requested</p>
                              )}
                            </div>

                            {/* Assignees */}
                            <div className="space-y-1.5 pb-2.5 border-b border-border/70">
                              <div className="flex items-center justify-between text-text-secondary font-bold text-[11px] uppercase tracking-wider">
                                <span className="flex items-center gap-1">
                                  <User className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Assignees</span>
                                </span>
                              </div>
                              {activeSelectedMr.assignees && activeSelectedMr.assignees.length > 0 ? (
                                <div className="space-y-1.5 pt-0.5">
                                  {activeSelectedMr.assignees.map((a, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5">
                                      {a.avatar_url ? (
                                        <img src={a.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                                      ) : (
                                        <div className="w-4 h-4 rounded-full bg-base-2 border border-border flex items-center justify-center text-[9px] font-mono">
                                          {(a.name || a.username || 'A').charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="font-mono text-text-primary text-[11px] font-medium truncate">
                                        @{a.username || a.name}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-text-muted">No one assigned</p>
                              )}
                            </div>

                            {/* Labels */}
                            <div className="space-y-1.5 pb-2.5 border-b border-border/70">
                              <div className="flex items-center justify-between text-text-secondary font-bold text-[11px] uppercase tracking-wider">
                                <span className="flex items-center gap-1">
                                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Labels</span>
                                </span>
                              </div>
                              {activeSelectedMr.labels && activeSelectedMr.labels.length > 0 ? (
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  {activeSelectedMr.labels.map((l, idx) => (
                                    <span
                                      key={idx}
                                      style={{
                                        backgroundColor: l.color ? `${l.color}20` : undefined,
                                        borderColor: l.color ? `${l.color}50` : undefined,
                                        color: l.color || undefined,
                                      }}
                                      className="px-1.5 py-0.2 bg-base-2 border border-border text-text-secondary text-[10px] font-mono font-semibold rounded-xs"
                                    >
                                      {l.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-text-muted">None yet</p>
                              )}
                            </div>

                            {/* Milestone (if any) */}
                            {activeSelectedMr.milestone && (
                              <div className="space-y-1 pb-2.5 border-b border-border/70">
                                <div className="text-text-secondary font-bold text-[11px] uppercase tracking-wider">
                                  Milestone
                                </div>
                                <p className="text-[11px] font-mono text-text-primary font-semibold">
                                  {activeSelectedMr.milestone}
                                </p>
                              </div>
                            )}

                            {/* Status & Lifecycle Action */}
                            <div className="space-y-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleCloseOrReopenPr(activeSelectedMr)}
                                disabled={isClosingPr}
                                className="w-full h-7.5 px-3 bg-git-removed-bg hover:bg-git-removed/20 border border-git-removed/40 text-git-removed rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                              >
                                {isClosingPr ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {activeSelectedMr.state?.toLowerCase() === 'open' || activeSelectedMr.state?.toLowerCase() === 'opened'
                                    ? `Close ${requestTypeLabel}`
                                    : `Reopen ${requestTypeLabel}`}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Commits Sub-Tab */}
                    {inspectorTab === 'commits' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-border/70 text-xs">
                          <span className="font-bold text-text-primary">
                            {prCommits.length} Commits between <code className="text-commito-coral">{activeSelectedMr.source_branch}</code> and <code className="text-emerald-400">{activeSelectedMr.target_branch}</code>
                          </span>
                          <span className="text-text-muted font-mono text-[11px]">Git History</span>
                        </div>

                        {isLoadingBranchDiff ? (
                          <div className="p-8 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-commito-coral" />
                            <span>Comparing branch commits...</span>
                          </div>
                        ) : prCommits.length === 0 ? (
                          <div className="p-8 text-center bg-base-0 border border-border rounded-sm text-xs text-text-muted space-y-1">
                            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                            <p className="font-bold text-text-primary">Branches are up to date</p>
                            <p className="text-[11px]">No unique commits found in this branch comparison.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {prCommits.map((c) => (
                              <div key={c.sha} className="p-3 bg-base-0 border border-border rounded-sm flex items-center justify-between gap-3 shadow-2xs hover:border-border-strong transition">
                                <div className="space-y-1 min-w-0">
                                  <h4 className="text-xs font-bold text-text-primary line-clamp-1">{c.message}</h4>
                                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                                    <span className="font-semibold text-text-secondary">@{c.author_name}</span>
                                    <span>•</span>
                                    <span>{c.relative_date}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="px-2 py-0.5 bg-base-1 border border-border text-commito-coral font-mono text-[10.5px] font-bold rounded-xs">
                                    {c.short_sha}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(c.sha);
                                      useToastStore.getState().showToast({
                                        type: 'info',
                                        title: 'SHA Copied',
                                        message: `Copied ${c.short_sha} to clipboard`,
                                      });
                                    }}
                                    className="p-1 text-text-muted hover:text-text-primary hover:bg-base-1 rounded transition cursor-pointer"
                                    title="Copy full SHA"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Files Changed Sub-Tab with 2 View Modes (Unified & Split) */}
                    {inspectorTab === 'files' && (
                      <div className="space-y-3">
                        {/* Header toolbar */}
                        <div className="flex items-center justify-between pb-2 border-b border-border/70 text-xs flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-text-primary">
                              Showing {prFiles.length} changed files
                            </span>
                            {(totalAdditions > 0 || totalDeletions > 0) && (
                              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-2 py-0.5 rounded-xs bg-base-0 border border-border shadow-2xs">
                                {totalAdditions > 0 && <span className="text-emerald-400">+{totalAdditions}</span>}
                                {totalDeletions > 0 && <span className="text-red-400">-{totalDeletions}</span>}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* 2 View Mode Switcher (Unified vs Split - matches History view) */}
                            <div className="flex items-center bg-base-0 border border-border rounded-sm p-0.5 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => setDiffViewMode('unified')}
                                className={`p-1 rounded-sm text-xs transition cursor-pointer ${
                                  diffViewMode === 'unified'
                                    ? 'bg-base-2 text-text-primary shadow-xs'
                                    : 'text-text-muted hover:text-text-primary'
                                }`}
                                title="Unified View"
                              >
                                <AlignJustify className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDiffViewMode('split')}
                                className={`p-1 rounded-sm text-xs transition cursor-pointer ${
                                  diffViewMode === 'split'
                                    ? 'bg-base-2 text-text-primary shadow-xs'
                                    : 'text-text-muted hover:text-text-primary'
                                }`}
                                title="Split (Side-by-Side) View"
                              >
                                <Columns className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Expand / Collapse All Button */}
                            {prFiles.length > 0 && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="xs"
                                onClick={handleToggleExpandAll}
                              >
                                {openFilePaths.size === prFiles.length ? 'Collapse All' : 'Expand All'}
                              </Button>
                            )}
                          </div>
                        </div>

                        {isLoadingBranchDiff ? (
                          <div className="p-8 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-commito-coral" />
                            <span>Computing file diffs...</span>
                          </div>
                        ) : prFiles.length === 0 ? (
                          <div className="p-8 text-center bg-base-0 border border-border rounded-sm text-xs text-text-muted space-y-1">
                            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                            <p className="font-bold text-text-primary">No file changes</p>
                            <p className="text-[11px]">No file modifications between these two branches.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {prFiles.map((f) => {
                              const isExpanded = openFilePaths.has(f.path);
                              const isLoadingDiff = loadingFilePaths.has(f.path);
                              const diffData = fileDiffCache[f.path];

                              return (
                                <div key={f.path} className="bg-base-0 border border-border rounded-sm overflow-hidden shadow-2xs">
                                  {/* File Card Header */}
                                  <div
                                    onClick={() => handleToggleFileDiff(f.path)}
                                    className="p-2.5 bg-base-1/80 hover:bg-base-1 border-b border-border/70 flex items-center justify-between gap-2 cursor-pointer select-none transition"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {isExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                      )}
                                      <FileCode className="w-3.5 h-3.5 text-commito-coral shrink-0" />
                                      <span className="text-xs font-mono text-text-primary font-bold truncate">{f.path}</span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Status Badge */}
                                      <span
                                        className={`px-1.5 py-0.2 text-[9.5px] font-mono font-bold uppercase rounded-xs border ${
                                          f.status === 'added'
                                            ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                                            : f.status === 'deleted'
                                            ? 'bg-red-500/15 border-red-500/35 text-red-400'
                                            : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                        }`}
                                      >
                                        {f.status}
                                      </span>

                                      {/* Copy Path Button */}
                                      <button
                                        type="button"
                                        onClick={(e) => handleCopyFilePath(e, f.path)}
                                        className="h-5 px-1.5 text-[10px] font-mono text-text-muted hover:text-text-primary bg-base-0 hover:bg-base-2 border border-border rounded-xs flex items-center gap-1 transition cursor-pointer"
                                        title="Copy file path"
                                      >
                                        {copiedFilePath === f.path ? (
                                          <>
                                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                                            <span className="text-emerald-400">Copied</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-2.5 h-2.5" />
                                            <span>Copy</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Expanded File Diff viewer using UnifiedDiffView or SplitDiffView */}
                                  {isExpanded && (
                                    <div className="bg-base-0 max-h-[500px] overflow-auto">
                                      {isLoadingDiff ? (
                                        <div className="p-6 text-center text-text-muted flex items-center justify-center gap-2">
                                          <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral" />
                                          <span className="text-xs">Loading file diff...</span>
                                        </div>
                                      ) : diffData && diffData.lines.length > 0 ? (
                                        diffViewMode === 'split' ? (
                                          <SplitDiffView lines={diffData.lines} />
                                        ) : (
                                          <UnifiedDiffView lines={diffData.lines} />
                                        )
                                      ) : (
                                        <div className="p-6 text-text-muted text-center font-mono text-xs">
                                          No textual line changes detected.
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center flex-1 flex flex-col items-center justify-center text-text-muted space-y-2">
                  <GitPullRequest className="w-8 h-8 text-text-faint mx-auto" />
                  <p className="text-xs">Select a {requestTypeLabel.toLowerCase()} from the left to inspect or review details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer Actions (Slim & Space-saving) */}
        <div className="flex items-center justify-between gap-3 px-3.5 py-1.5 border-t border-border bg-base-1/70 shrink-0 min-h-[38px]">
          <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
            <span className="truncate text-[11px]">
              Target: <span className="text-text-primary font-semibold">{targetRemoteInfo?.projectPath || selectedRemote}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'edit' && editingMr ? (
              <>
                <button
                  type="button"
                  onClick={() => handleCloseOrReopenPr(editingMr)}
                  disabled={isClosingPr || isSavingEdit}
                  className="h-6.5 px-2.5 bg-git-removed-bg hover:bg-git-removed/20 border border-git-removed/40 text-git-removed rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {isClosingPr ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  <span>
                    {editingMr.state?.toLowerCase() === 'open' || editingMr.state?.toLowerCase() === 'opened'
                      ? `Close ${requestTypeLabel}`
                      : `Reopen ${requestTypeLabel}`}
                  </span>
                </button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setActiveTab('list');
                    setEditingMr(null);
                  }}
                  disabled={isSavingEdit}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="coral"
                  size="sm"
                  onClick={() => handleSaveFullEdit()}
                  disabled={!editTitle.trim() || isSavingEdit}
                  isLoading={isSavingEdit}
                  leftIcon={!isSavingEdit ? <Save className="w-3.5 h-3.5" /> : undefined}
                >
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={requestClose}
                  disabled={isSubmitting || isGeneratingAi}
                >
                  Close
                </Button>

                {activeTab === 'create' && (
                  <Button
                    type="button"
                    variant="coral"
                    size="sm"
                    onClick={handleCreateMergeRequest}
                    disabled={!title.trim() || isSubmitting || isGeneratingAi || sourceBranch === targetBranch || !!existingPrForSource}
                    isLoading={isSubmitting}
                    leftIcon={!isSubmitting ? <Check className="w-3.5 h-3.5" /> : undefined}
                    title={
                      sourceBranch === targetBranch
                        ? 'Cannot submit pull request: Source and target branches are identical'
                        : existingPrForSource
                        ? `A pull request (#${existingPrForSource.id}) already exists for '${sourceBranch}'`
                        : undefined
                    }
                  >
                    Submit {requestTypeLabel}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Merge Confirmation Dialog Modal */}
        {showMergeModal && activeSelectedMr && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none animate-in fade-in duration-100"
            onClick={(e) => {
              e.stopPropagation();
              if (!isMerging) setShowMergeModal(false);
            }}
          >
            <div
              className="w-full max-w-lg bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Merge Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-base-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <GitMerge className="w-4 h-4" />
                  <span>Merge {requestTypeLabel} #{activeSelectedMr.id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => !isMerging && setShowMergeModal(false)}
                  disabled={isMerging}
                  className="p-1 text-text-muted hover:text-text-primary rounded-sm hover:bg-base-2 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Merge Modal Body */}
              <div className="p-4 space-y-4 text-xs">
                {/* Branch route */}
                <div className="p-2.5 bg-base-1 border border-border rounded-sm flex items-center gap-2 font-mono text-[11.5px]">
                  <GitBranch className="w-3.5 h-3.5 text-commito-coral shrink-0" />
                  <span className="text-commito-coral font-bold">{activeSelectedMr.source_branch}</span>
                  <span className="text-text-muted">merges into</span>
                  <span className="text-emerald-400 font-bold">{activeSelectedMr.target_branch}</span>
                </div>

                {/* Strategy Selector (GitHub) */}
                {providerName === 'GitHub' ? (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                      Merge Strategy
                    </label>
                    <div className="space-y-1.5">
                      {[
                        { id: 'merge' as const, label: 'Create a merge commit', desc: 'All commits from this branch will be added to the base branch via a merge commit.' },
                        { id: 'squash' as const, label: 'Squash and merge', desc: 'The commits from this branch will be combined into one commit in the base branch.' },
                        { id: 'rebase' as const, label: 'Rebase and merge', desc: 'The commits from this branch will be rebased and added to the base branch.' },
                      ].map((strat) => (
                        <div
                          key={strat.id}
                          onClick={() => setMergeMethod(strat.id)}
                          className={`p-2.5 rounded-sm border transition cursor-pointer flex items-start gap-2.5 ${
                            mergeMethod === strat.id
                              ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20'
                              : 'bg-base-1 border-border hover:bg-base-2'
                          }`}
                        >
                          <input
                            type="radio"
                            name="merge_strategy"
                            checked={mergeMethod === strat.id}
                            onChange={() => setMergeMethod(strat.id)}
                            className="mt-0.5 accent-emerald-500 cursor-pointer"
                          />
                          <div className="space-y-0.5">
                            <div className="font-bold text-text-primary">{strat.label}</div>
                            <div className="text-[11px] text-text-muted">{strat.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Checkbox
                      checked={squashAfterMerge}
                      onChange={setSquashAfterMerge}
                      label="Squash commits before merging"
                    />
                    <Checkbox
                      checked={deleteBranchAfterMerge}
                      onChange={setDeleteBranchAfterMerge}
                      label="Delete source branch after merge"
                    />
                  </div>
                )}

                {/* Commit Title */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                    Commit Title
                  </label>
                  <input
                    type="text"
                    value={mergeCommitTitle}
                    onChange={(e) => setMergeCommitTitle(e.target.value)}
                    placeholder="Merge commit title"
                    className="w-full h-8 px-2.5 bg-base-1 border border-border focus:border-emerald-500 rounded-sm text-xs text-text-primary font-mono focus:outline-none transition"
                  />
                </div>

                {/* Commit Message */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                    Commit Message
                  </label>
                  <textarea
                    value={mergeCommitMessage}
                    onChange={(e) => setMergeCommitMessage(e.target.value)}
                    placeholder="Optional extended commit message"
                    className="w-full h-16 p-2 bg-base-1 border border-border focus:border-emerald-500 rounded-sm text-xs text-text-primary font-mono resize-none focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Merge Modal Footer */}
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-base-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => !isMerging && setShowMergeModal(false)}
                  disabled={isMerging}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="emerald"
                  size="sm"
                  onClick={handleMergePr}
                  disabled={isMerging}
                  isLoading={isMerging}
                  leftIcon={!isMerging ? <GitMerge className="w-3.5 h-3.5" /> : undefined}
                >
                  Confirm Merge
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unsaved Changes Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirm}
        title={`Unsaved ${requestTypeLabel} Changes`}
        description={`You have unsaved changes in this ${requestTypeLabel.toLowerCase()} draft. If you leave now, your title, description, and settings will be discarded.`}
        discardText="Discard Changes"
        saveText={activeTab === 'create' ? (title.trim() ? `Create ${requestTypeLabel}` : undefined) : 'Save Changes'}
        cancelText="Keep Editing"
        isSaving={isSubmitting || isSavingEdit}
        onDiscard={confirmDiscard}
        onSave={() => {
          if (activeTab === 'create') {
            handleCreateMergeRequest({ preventDefault: () => {} } as React.FormEvent);
          } else if (activeTab === 'edit') {
            handleSaveFullEdit();
          }
        }}
        onCancel={cancelDiscard}
      />
    </div>,
    document.body
  );
};
