import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { listen } from '@tauri-apps/api/event';
import {
  X,
  Upload,
  Loader2,
  AlertCircle,
  Lock,
  Building2,
  Check,
  ChevronDown,
  Plus,
  User,
  Users,
  LogIn,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { useRepoStore } from '../../store/repoStore';
import { useRemoteStore } from '../../store/remoteStore';
import { useAccounts, useAccountServicesStore } from '../../features/account-services';
import { GitService } from '../../services/git/gitService';
import { AccountService } from '../../services/accounts/accountService';
import { NamespaceOption } from '../../types/git';
import { UserAvatar } from '../common/UserAvatar';
import { Checkbox } from '../common/Checkbox';
import { getErrorMessage } from '../../shared/utils/errorUtils';
import { useTaskStore } from '../../features/task-manager';

export const PublishRepoModal: React.FC = () => {
  const { activeRepoPath, isPublishRepoModalOpen, setIsPublishRepoModalOpen, setStatus, setError } =
    useGitStore();

  const { accounts, activeAccount } = useAccounts();
  const { openModalWithTab } = useAccountServicesStore();

  const defaultRepoName = useMemo(() => {
    if (!activeRepoPath) return '';
    return activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || '';
  }, [activeRepoPath]);

  // Form State
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [selectedNamespaceId, setSelectedNamespaceId] = useState<string>('personal');
  const [isCustomWorkspace, setIsCustomWorkspace] = useState(false);
  const [customWorkspaceSlug, setCustomWorkspaceSlug] = useState('');
  const [namespaces, setNamespaces] = useState<NamespaceOption[]>([]);
  const [isLoadingNamespaces, setIsLoadingNamespaces] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Custom Dropdown Open States
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isNamespaceDropdownOpen, setIsNamespaceDropdownOpen] = useState(false);

  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const namespaceDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize selected account and repo name when modal opens
  useEffect(() => {
    if (isPublishRepoModalOpen) {
      setName(defaultRepoName);
      setDescription('');
      setIsPrivate(true);
      setLocalError(null);
      setIsPublishing(false);
      setIsAccountDropdownOpen(false);
      setIsNamespaceDropdownOpen(false);

      if (accounts.length > 0) {
        const initialAcc = activeAccount || accounts[0];
        setSelectedAccountId(initialAcc.id);
      } else {
        setSelectedAccountId('');
      }
    }
  }, [isPublishRepoModalOpen, defaultRepoName, accounts, activeAccount]);

  // Click outside listener for custom dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
      if (
        namespaceDropdownRef.current &&
        !namespaceDropdownRef.current.contains(e.target as Node)
      ) {
        setIsNamespaceDropdownOpen(false);
      }
    };

    if (isPublishRepoModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPublishRepoModalOpen]);

  // Fetch namespaces / orgs / groups whenever the selected account changes
  useEffect(() => {
    if (!selectedAccountId || !isPublishRepoModalOpen) return;

    let isMounted = true;
    setIsLoadingNamespaces(true);
    setLocalError(null);

    GitService.listNamespaces(selectedAccountId)
      .then((opts) => {
        if (isMounted) {
          setNamespaces(opts || []);
          if (opts && opts.length > 0) {
            setSelectedNamespaceId(opts[0].id);
          } else {
            setSelectedNamespaceId('personal');
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setNamespaces([
            {
              id: 'personal',
              name: 'Personal Account / Namespace',
              kind: 'personal',
              description: null,
              avatar_url: null,
            },
          ]);
          setSelectedNamespaceId('personal');
          useLogStore
            .getState()
            .addLog('warning', 'Remote', `Unable to fetch organizations: ${getErrorMessage(err)}`);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingNamespaces(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedAccountId, isPublishRepoModalOpen]);

  // Handle ESC key to dismiss dropdowns or modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAccountDropdownOpen) {
          setIsAccountDropdownOpen(false);
        } else if (isNamespaceDropdownOpen) {
          setIsNamespaceDropdownOpen(false);
        } else if (isPublishRepoModalOpen && !isPublishing) {
          setIsPublishRepoModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPublishRepoModalOpen,
    isPublishing,
    isAccountDropdownOpen,
    isNamespaceDropdownOpen,
    setIsPublishRepoModalOpen,
  ]);

  const currentAccount = accounts.find((a) => a.id === selectedAccountId);
  const selectedNamespace = namespaces.find((ns) => ns.id === selectedNamespaceId) || namespaces[0];

  // Validation
  const hasInvalidChars = /[/\\:*?"<>|]/.test(name);
  const isValidName = name.trim().length > 0 && !hasInvalidChars;

  const getNamespaceLabel = () => {
    if (!currentAccount) return 'Organization / Group';
    switch (currentAccount.provider) {
      case 'github':
        return 'Organization';
      case 'gitlab':
        return 'Group / Namespace';
      case 'bitbucket':
        return 'Workspace';
      default:
        return 'Namespace';
    }
  };

  const getProviderBadge = (provider: string) => {
    const p = (provider || '').toLowerCase();
    switch (p) {
      case 'github':
        return (
          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs border text-purple-400 bg-purple-950/40 border-purple-800/40 shrink-0">
            GitHub
          </span>
        );
      case 'gitlab':
        return (
          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs border text-commito-coral bg-commito-coral/10 border-commito-coral/30 shrink-0">
            GitLab
          </span>
        );
      case 'bitbucket':
        return (
          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs border text-blue-400 bg-blue-950/40 border-blue-800/40 shrink-0">
            Bitbucket
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs border text-emerald-400 bg-emerald-950/40 border-emerald-800/40 shrink-0">
            Git
          </span>
        );
    }
  };

  // Listen for OAuth completion to clear errors and reload namespaces
  useEffect(() => {
    if (!isPublishRepoModalOpen) return;
    let unlisten: (() => void) | undefined;
    listen('oauth-account-synced', () => {
      setIsReauthenticating(false);
      setLocalError(null);
      if (selectedAccountId) {
        setIsLoadingNamespaces(true);
        GitService.listNamespaces(selectedAccountId)
          .then((opts) => {
            setNamespaces(opts || []);
            if (opts && opts.length > 0) setSelectedNamespaceId(opts[0].id);
          })
          .catch(() => {})
          .finally(() => setIsLoadingNamespaces(false));
      }
    }).then((unsub) => {
      unlisten = unsub;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [isPublishRepoModalOpen, selectedAccountId]);

  const handleReauthenticate = async () => {
    if (!currentAccount) return;
    setIsReauthenticating(true);
    try {
      await AccountService.startProviderOAuth(currentAccount.provider, currentAccount.instance_url);
    } catch (err: unknown) {
      setLocalError(getErrorMessage(err));
      setIsReauthenticating(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidName || !activeRepoPath || !selectedAccountId || isPublishing) return;

    setIsPublishing(true);
    setLocalError(null);

    const repoName =
      activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || name.trim() || 'Repository';
    const taskId = useTaskStore.getState().addTask({
      type: 'publish',
      title: `Publish '${name.trim()}' to ${currentAccount?.provider || 'remote'}`,
      repoName,
      localPath: activeRepoPath,
      cancellable: false,
    });

    useTaskStore.getState().updateTaskProgress(taskId, {
      stage: 'Creating remote repo',
      percent: 30,
      detail: `Creating repository on ${currentAccount?.provider || 'remote'}...`,
    });

    try {
      useLogStore
        .getState()
        .addLog(
          'info',
          'Remote',
          `Publishing repository '${name.trim()}' to ${currentAccount?.provider || 'remote'}...`
        );

      const effectiveNamespace = isCustomWorkspace
        ? customWorkspaceSlug.trim() || null
        : selectedNamespaceId !== 'personal'
          ? selectedNamespaceId
          : null;

      const result = await GitService.publishRepository({
        repoPath: activeRepoPath,
        accountId: selectedAccountId,
        name: name.trim(),
        description: description.trim() || null,
        isPrivate,
        namespaceId: effectiveNamespace,
      });

      useTaskStore.getState().updateTaskProgress(taskId, {
        stage: 'Completed',
        percent: 100,
        detail: `Published to ${result.remote_url}`,
      });
      useTaskStore.getState().completeTask(taskId);

      useLogStore
        .getState()
        .addLog('success', 'Remote', `Successfully published repository to ${result.remote_url}`);

      // Refresh the active repo status (updates has_remote, remote_url, ahead/behind)
      const updatedStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(updatedStatus);

      // Refresh the header remote list so the Globe button and SmartGitActionButton update immediately
      useRemoteStore.getState().loadRemotes(activeRepoPath);

      // Also refresh the Home Dashboard card and ensure the repo is registered
      useRepoStore.getState().refreshStatus(activeRepoPath);
      useRepoStore
        .getState()
        .addRepo(activeRepoPath)
        .catch(() => {});

      setIsPublishRepoModalOpen(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      useTaskStore.getState().failTask(taskId, msg);
      setLocalError(msg);
      setError({ code: 'GIT_PUBLISH_ERROR', message: msg });
      useLogStore.getState().addLog('error', 'Remote', `Failed to publish repository: ${msg}`);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isPublishRepoModalOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-repo-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPublishing) {
          setIsPublishRepoModalOpen(false);
        }
      }}
      className="fixed inset-0 z-10000 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-base-0 border border-border-strong rounded-sm shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-100 max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 border border-commito-coral/30">
              <Upload className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3
                id="publish-repo-modal-title"
                className="text-xs font-bold text-text-primary leading-none truncate"
              >
                Publish Repository
              </h3>
              {defaultRepoName && (
                <>
                  <span className="text-border hidden sm:inline">•</span>
                  <span className="text-[11px] text-text-muted truncate hidden sm:inline font-mono">
                    {defaultRepoName}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => !isPublishing && setIsPublishRepoModalOpen(false)}
            disabled={isPublishing}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer disabled:opacity-50"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        {accounts.length === 0 ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-base-2 border border-border flex items-center justify-center mx-auto text-text-muted">
              <User className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-text-primary">No Connected Accounts Found</h4>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                Connect your GitHub, GitLab, or Bitbucket account to publish your local repositories
                with one click.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsPublishRepoModalOpen(false);
                openModalWithTab('add');
              }}
              className="px-4 py-1.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect an Account</span>
            </button>
          </div>
        ) : (
          <>
            <form
              id="publish-repo-form"
              onSubmit={handlePublish}
              className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1"
            >
              {localError && (
                <div className="p-3 bg-git-removed-bg border border-git-removed/40 rounded-sm space-y-2 text-xs text-git-removed animate-in fade-in">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-git-removed shrink-0 mt-0.5" />
                    <div className="leading-snug flex-1 font-medium">{localError}</div>
                  </div>
                  {localError.toLowerCase().includes('no token found') && currentAccount && (
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={handleReauthenticate}
                        disabled={isReauthenticating}
                        className="px-3 py-1 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98 disabled:opacity-60"
                      >
                        {isReauthenticating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <LogIn className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isReauthenticating
                            ? 'Opening Browser...'
                            : `Re-authenticate with ${currentAccount.provider === 'github' ? 'GitHub' : currentAccount.provider === 'bitbucket' ? 'Bitbucket' : 'GitLab'}`}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 1. Account Dropdown Selector */}
              <div className="space-y-1.5" ref={accountDropdownRef}>
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint">
                    Publish to Account
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPublishRepoModalOpen(false);
                      openModalWithTab('add');
                    }}
                    className="text-[10.5px] text-commito-coral hover:text-commito-coralLight font-semibold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Another Account</span>
                  </button>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPublishing) {
                        setIsNamespaceDropdownOpen(false);
                        setIsAccountDropdownOpen(!isAccountDropdownOpen);
                      }
                    }}
                    disabled={isPublishing}
                    className={`w-full h-9 px-3 bg-base-1 border rounded-sm text-xs text-text-primary flex items-center justify-between transition cursor-pointer shadow-2xs focus:outline-none ${
                      isAccountDropdownOpen
                        ? 'border-border-strong bg-base-2'
                        : 'border-border hover:border-border-strong hover:bg-base-1/90'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0">
                      {currentAccount ? (
                        <>
                          <UserAvatar
                            url={currentAccount.avatar_url}
                            name={currentAccount.display_name || currentAccount.handle}
                            provider={currentAccount.provider}
                            className="w-5.5 h-5.5 rounded-xs shrink-0 ring-1 ring-border/60"
                            iconClassName="w-3 h-3"
                          />
                          <span className="font-bold text-text-primary truncate">
                            {currentAccount.display_name || currentAccount.handle}
                          </span>
                          {getProviderBadge(currentAccount.provider)}
                          <span className="text-[11px] text-text-muted font-mono truncate hidden sm:inline">
                            {currentAccount.handle}
                          </span>
                        </>
                      ) : (
                        <span className="text-text-muted italic">Select an account...</span>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ml-2 shrink-0 ${
                        isAccountDropdownOpen ? 'rotate-180 text-commito-coral' : ''
                      }`}
                    />
                  </button>

                  {/* Account Dropdown Menu */}
                  {isAccountDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-base-0 border border-border-strong rounded-sm shadow-2xl z-50 py-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto">
                      {accounts.map((acc) => {
                        const isSelected = selectedAccountId === acc.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setSelectedAccountId(acc.id);
                              setIsAccountDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-commito-coral/15 text-commito-coral font-bold'
                                : 'hover:bg-base-1 text-text-primary'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                              <UserAvatar
                                url={acc.avatar_url}
                                name={acc.display_name || acc.handle}
                                provider={acc.provider}
                                className="w-5.5 h-5.5 rounded-xs ring-1 ring-border/60 shrink-0"
                                iconClassName="w-3 h-3"
                              />
                              <div className="truncate min-w-0">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="font-bold truncate">
                                    {acc.display_name || acc.handle}
                                  </span>
                                  {getProviderBadge(acc.provider)}
                                </div>
                                <div className="text-[10.5px] text-text-muted font-mono truncate">
                                  {acc.handle}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-commito-coral shrink-0" />
                            )}
                          </button>
                        );
                      })}

                      <div className="border-t border-border/70 my-1" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsAccountDropdownOpen(false);
                          setIsPublishRepoModalOpen(false);
                          openModalWithTab('add');
                        }}
                        className="w-full px-3 py-1.5 text-left text-[11px] text-commito-coral hover:bg-commito-coral/10 transition flex items-center gap-2 cursor-pointer font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Connect Another Account...</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Repository Name Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-secondary flex items-center justify-between">
                  <span>
                    Repository Name <span className="text-commito-coral">*</span>
                  </span>
                  {hasInvalidChars && (
                    <span className="text-[10.5px] text-git-removed font-normal">
                      Contains invalid characters
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="e.g. my-awesome-project"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPublishing}
                  className={`w-full h-8.5 px-3 bg-base-1 border rounded-sm text-xs text-text-primary font-mono placeholder:text-text-faint focus:outline-none transition shadow-2xs ${
                    hasInvalidChars
                      ? 'border-git-removed focus:border-danger ring-1 ring-git-removed/20'
                      : 'border-border hover:border-border-strong focus:border-border-strong'
                  }`}
                  required
                />
              </div>

              {/* 3. Repository Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-secondary block">
                  Description{' '}
                  <span className="text-text-faint text-[10px] font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Short description of your project..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isPublishing}
                  className="w-full h-8.5 px-3 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-2xs"
                />
              </div>

              {/* 4. Keep this code private Checkbox */}
              <div
                onClick={() => {
                  if (!isPublishing) setIsPrivate(!isPrivate);
                }}
                className="p-3 bg-base-1 border border-border hover:border-border-strong rounded-sm flex items-start gap-2.5 cursor-pointer shadow-2xs select-none transition group"
              >
                <div className="mt-0.5 pointer-events-none">
                  <Checkbox
                    checked={isPrivate}
                    onChange={(val) => setIsPrivate(val)}
                    disabled={isPublishing}
                    size="md"
                  />
                </div>
                <div className="text-xs text-text-primary cursor-pointer leading-tight flex-1">
                  <div className="font-semibold flex items-center gap-1.5 group-hover:text-text-primary">
                    <Lock className="w-3 h-3 text-text-secondary" />
                    <span>Keep this code private</span>
                  </div>
                  <div className="text-[10.5px] text-text-muted mt-0.5">
                    {isPrivate
                      ? 'Only you and authorized collaborators will have access.'
                      : 'Anyone on the internet can see and clone public repositories.'}
                  </div>
                </div>
              </div>

              {/* 5. Custom Organization / Group / Workspace Dropdown */}
              <div className="space-y-1" ref={namespaceDropdownRef}>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-text-secondary flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-text-muted" />
                    <span>{getNamespaceLabel()}</span>
                  </label>
                  {isLoadingNamespaces ? (
                    <span className="text-[10px] text-text-muted flex items-center gap-1 font-normal">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Loading...</span>
                    </span>
                  ) : isCustomWorkspace ? (
                    <button
                      type="button"
                      onClick={() => setIsCustomWorkspace(false)}
                      className="text-[10.5px] text-commito-coral hover:text-commito-coralLight font-medium cursor-pointer"
                    >
                      Select from list
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsNamespaceDropdownOpen(false);
                        setIsCustomWorkspace(true);
                      }}
                      className="text-[10.5px] text-text-muted hover:text-commito-coral font-medium cursor-pointer"
                    >
                      Custom workspace...
                    </button>
                  )}
                </div>

                {isCustomWorkspace ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="e.g. your-workspace-slug"
                      value={customWorkspaceSlug}
                      onChange={(e) => setCustomWorkspaceSlug(e.target.value)}
                      disabled={isPublishing}
                      className="w-full h-8.5 px-3 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text-primary font-mono placeholder:text-text-faint focus:outline-none transition shadow-2xs"
                    />
                    <p className="text-[10.5px] text-text-muted">
                      Enter the exact Bitbucket workspace slug identifier from
                      bitbucket.org/&lt;workspace&gt;.
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPublishing && !isLoadingNamespaces) {
                          setIsAccountDropdownOpen(false);
                          setIsNamespaceDropdownOpen(!isNamespaceDropdownOpen);
                        }
                      }}
                      disabled={isPublishing || isLoadingNamespaces}
                      className={`w-full h-8.5 px-3 bg-base-1 border rounded-sm text-xs text-text-primary flex items-center justify-between transition cursor-pointer shadow-2xs focus:outline-none ${
                        isNamespaceDropdownOpen
                          ? 'border-border-strong bg-base-2'
                          : 'border-border hover:border-border-strong hover:bg-base-1/90'
                      } ${isLoadingNamespaces ? 'opacity-70 cursor-wait' : ''}`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        {selectedNamespace?.avatar_url ? (
                          <img
                            src={selectedNamespace.avatar_url}
                            alt=""
                            className="w-4 h-4 rounded-xs shrink-0 object-cover"
                          />
                        ) : selectedNamespace?.kind === 'personal' ? (
                          <User className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        ) : (
                          <Users className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        )}
                        <span className="font-medium text-text-primary truncate">
                          {selectedNamespace?.name || 'Select organization...'}
                        </span>
                        {selectedNamespace?.kind && selectedNamespace.kind !== 'personal' && (
                          <span className="text-[9px] uppercase px-1 py-0.2 rounded-xs bg-base-2 border border-border text-text-muted font-mono shrink-0">
                            {selectedNamespace.kind}
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ml-2 shrink-0 ${
                          isNamespaceDropdownOpen ? 'rotate-180 text-commito-coral' : ''
                        }`}
                      />
                    </button>

                    {/* Organization Dropdown Menu */}
                    {isNamespaceDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-base-0 border border-border-strong rounded-sm shadow-2xl z-50 py-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 max-h-52 overflow-y-auto">
                        {namespaces.map((ns) => {
                          const isSelected = selectedNamespaceId === ns.id;
                          return (
                            <button
                              key={ns.id}
                              type="button"
                              onClick={() => {
                                setSelectedNamespaceId(ns.id);
                                setIsNamespaceDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition cursor-pointer ${
                                isSelected
                                  ? 'bg-commito-coral/15 text-commito-coral font-bold'
                                  : 'hover:bg-base-1 text-text-primary'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                                {ns.avatar_url ? (
                                  <img
                                    src={ns.avatar_url}
                                    alt=""
                                    className="w-4.5 h-4.5 rounded-xs shrink-0 object-cover"
                                  />
                                ) : ns.kind === 'personal' ? (
                                  <User className="w-4 h-4 text-text-muted shrink-0" />
                                ) : (
                                  <Users className="w-4 h-4 text-text-muted shrink-0" />
                                )}
                                <div className="truncate min-w-0">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-semibold truncate">{ns.name}</span>
                                    {ns.kind && ns.kind !== 'personal' && (
                                      <span className="text-[9px] uppercase px-1 py-0.2 rounded-xs bg-base-2 border border-border text-text-muted font-mono shrink-0">
                                        {ns.kind}
                                      </span>
                                    )}
                                  </div>
                                  {ns.description && (
                                    <div className="text-[10.5px] text-text-muted truncate">
                                      {ns.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-commito-coral shrink-0" />
                              )}
                            </button>
                          );
                        })}

                        <div className="border-t border-border/70 my-1" />

                        <button
                          type="button"
                          onClick={() => {
                            setIsNamespaceDropdownOpen(false);
                            setIsCustomWorkspace(true);
                          }}
                          className="w-full px-3 py-1.5 text-left text-[11px] text-commito-coral hover:bg-commito-coral/10 transition flex items-center gap-2 cursor-pointer font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Enter Custom Workspace Slug...</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>

            {/* Pinned Bottom Footer Actions */}
            <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-base-1 border-t border-border shrink-0 select-none">
              <button
                type="button"
                onClick={() => setIsPublishRepoModalOpen(false)}
                disabled={isPublishing}
                className="h-7.5 px-3.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer shadow-2xs disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="publish-repo-form"
                disabled={!isValidName || isPublishing}
                className={`h-7.5 px-4 rounded-sm text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                  isValidName && !isPublishing
                    ? 'bg-commito-coral hover:bg-commito-coralLight text-white active:scale-98'
                    : 'bg-base-2 text-text-muted border border-border cursor-not-allowed opacity-60'
                }`}
              >
                {isPublishing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{isPublishing ? 'Publishing...' : 'Publish Repository'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
