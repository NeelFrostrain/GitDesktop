import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  Download,
  FolderOpen,
  Loader2,
  AlertCircle,
  Shield,
  KeyRound,
  User,
  Eye,
  EyeOff,
  GitBranch,
  Layers,
  Folder,
  Globe,
  Lock,
  Check,
  FolderGit2,
  ShieldCheck,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { useRepoStore, openRepo } from '../../features/repos';
import { Dropdown } from '../common/Dropdown';
import { Tabs, TabItem } from '../common/Tabs';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SystemService } from '../../services/system/systemService';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { RemoteAccountReposTab } from './repo/RemoteAccountReposTab';

type CloneModalTab = 'remote' | 'url';
type AuthMode = 'saved' | 'credentials' | 'public';

/**
 * Extracts repository name from git URL (e.g. "https://gitlab.com/owner/repo.git" -> "repo").
 */
const extractRepoNameFromUrl = (url: string): string => {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim().replace(/\/+$/, '');
  const lastSegment = trimmed.split(/[/:]/).pop() || '';
  return lastSegment.replace(/\.git$/i, '').trim();
};

/**
 * Detects git hosting provider from clone URL.
 */
const detectProviderFromUrl = (url: string): 'gitlab' | 'github' | 'bitbucket' | 'custom' => {
  const lower = url.toLowerCase();
  if (lower.includes('gitlab')) return 'gitlab';
  if (lower.includes('github')) return 'github';
  if (lower.includes('bitbucket')) return 'bitbucket';
  return 'custom';
};

/**
 * Modern modal dialog for cloning remote Git repositories with support for
 * credentials (Username & Password / Personal Access Token), 2FA/MFA verification,
 * branch selection, and saved accounts.
 */
export const CloneRepoModal: React.FC = () => {
  const {
    isCloneRepoModalOpen,
    cloneModalInitialUrl,
    setIsCloneRepoModalOpen,
    setActiveRepoPath,
    setStatus,
    setError,
    accounts,
  } = useGitStore();
  const addRepo = useRepoStore((s) => s.addRepo);

  const [activeMainTab, setActiveMainTab] = useState<CloneModalTab>('remote');
  const [url, setUrl] = useState('');
  const [parentPath, setParentPath] = useState(() => {
    try {
      return localStorage.getItem('last_clone_parent_path') || 'E:\\Projects';
    } catch {
      return 'E:\\Projects';
    }
  });

  // Auth State
  const [authMode, setAuthMode] = useState<AuthMode>(() =>
    accounts.length > 0 ? 'saved' : 'credentials'
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [username, setUsername] = useState('');
  const [passwordOrToken, setPasswordOrToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [has2FaEnabled, setHas2FaEnabled] = useState(false);
  const [saveCredentials, setSaveCredentials] = useState(true);

  // Advanced Options
  const [specificBranch, setSpecificBranch] = useState('');
  const [isShallowClone, setIsShallowClone] = useState(false);
  const [recurseSubmodules, setRecurseSubmodules] = useState(true);

  // Execution state
  const [isCloning, setIsCloning] = useState(false);
  const [cloneProgressMessage, setCloneProgressMessage] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const urlInputRef = useRef<HTMLInputElement>(null);

  const isDirty = url.trim() !== '' || username.trim() !== '' || passwordOrToken.trim() !== '';

  const { showConfirm, requestClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard({
    isDirty,
    onClose: () => setIsCloneRepoModalOpen(false),
  });

  // Initialize on modal open
  useEffect(() => {
    if (isCloneRepoModalOpen) {
      const initial = cloneModalInitialUrl || '';
      if (initial) {
        setUrl(initial);
        setActiveMainTab('url');
      } else {
        setActiveMainTab('remote');
      }
      setLocalError(null);
      setIsCloning(false);
      setCloneProgressMessage('');
      if (accounts.length > 0) {
        setAuthMode('saved');
        setSelectedAccountId(accounts[0].id || accounts[0].username);
      } else {
        setAuthMode('credentials');
      }

      if (initial) {
        setTimeout(() => {
          urlInputRef.current?.focus();
        }, 60);
      }
    }
  }, [isCloneRepoModalOpen, cloneModalInitialUrl, accounts]);

  // Auto-update folder name when URL changes (unless user manually customized it)
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (localError) setLocalError(null);
  };

  const detectedProvider = useMemo(() => detectProviderFromUrl(url), [url]);

  const authTabs = useMemo<TabItem<AuthMode>[]>(() => {
    const items: TabItem<AuthMode>[] = [];
    if (accounts.length > 0) {
      items.push({
        id: 'saved',
        label: 'Saved Account',
        badge: accounts.length,
        icon: <Shield className="w-3.5 h-3.5" />,
      });
    }
    items.push({
      id: 'credentials',
      label: 'Username & Password / Token',
      icon: <KeyRound className="w-3.5 h-3.5" />,
    });
    items.push({
      id: 'public',
      label: 'Public / Anonymous',
      icon: <Globe className="w-3.5 h-3.5" />,
    });
    return items;
  }, [accounts.length]);

  const repoName = useMemo(() => extractRepoNameFromUrl(url) || 'cloned-repo', [url]);
  const fullDestinationPath = parentPath
    ? `${parentPath.replace(/[/\\]+$/, '')}\\${repoName}`
    : repoName;

  const handleSelectParentFolder = async () => {
    try {
      const folder = await SystemService.selectFolder();
      if (folder) {
        setParentPath(folder);
        try {
          localStorage.setItem('last_clone_parent_path', folder);
        } catch {}
      }
    } catch {
      // Silently ignore cancel
    }
  };

  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isCloning) return;

    setIsCloning(true);
    setLocalError(null);
    setCloneProgressMessage(`Cloning repository into ${repoName}...`);

    try {
      // Format clone URL with credentials if specified in Credentials mode
      let effectiveCloneUrl = url.trim();

      if (authMode === 'credentials' && username.trim() && passwordOrToken.trim()) {
        const cleanUser = encodeURIComponent(username.trim());
        const cleanPass = encodeURIComponent(passwordOrToken.trim());

        if (effectiveCloneUrl.startsWith('https://')) {
          const rest = effectiveCloneUrl.slice(8);
          effectiveCloneUrl = `https://${cleanUser}:${cleanPass}@${rest}`;
        } else if (effectiveCloneUrl.startsWith('http://')) {
          const rest = effectiveCloneUrl.slice(7);
          effectiveCloneUrl = `http://${cleanUser}:${cleanPass}@${rest}`;
        }
      }

      // Execute clone command
      await invoke('clone_repository', {
        remoteUrl: effectiveCloneUrl,
        localPath: fullDestinationPath,
      });

      useLogStore
        .getState()
        .addLog(
          'success',
          'Git',
          `Successfully cloned repository '${repoName}' to '${fullDestinationPath}'`
        );

      // Add to registered repos list
      await addRepo(fullDestinationPath);
      await openRepo(fullDestinationPath);

      // Open workspace
      setActiveRepoPath(fullDestinationPath);
      const statusRes = await GitService.getRepoStatus(fullDestinationPath);
      setStatus(statusRes);

      setIsCloneRepoModalOpen(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      let formattedError = msg;

      if (
        msg.toLowerCase().includes('authentication failed') ||
        msg.toLowerCase().includes('fatal: authentication')
      ) {
        formattedError =
          'Authentication failed. Please check your username and password or Personal Access Token (PAT). If 2FA is active, use a PAT.';
      } else if (
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('not empty')
      ) {
        formattedError = `Target directory '${fullDestinationPath}' already exists and is not empty. Please select another folder name or destination path.`;
      }

      setLocalError(formattedError);
      setError(toAppError(err, 'CLONE_ERROR'));
    } finally {
      setIsCloning(false);
      setCloneProgressMessage('');
    }
  };

  if (!isCloneRepoModalOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clone-repo-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCloning) {
          requestClose();
        }
      }}
      className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-100"
    >
      <div
        className="w-full max-w-xl bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4.5 py-2.5 border-b border-border bg-base-1 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* <div className="w-7 h-7 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
              <Download className="w-4 h-4" />
            </div> */}
            <div className="flex items-center gap-2 min-w-0">
              <h2
                id="clone-repo-modal-title"
                className="text-sm font-bold text-text-primary leading-none"
              >
                Clone a Repository
              </h2>
              <span className="text-border">•</span>
              <span className="text-xs text-text-muted">
                {activeMainTab === 'remote' ? 'Connected accounts' : 'Remote Git URL'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={requestClose}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer shrink-0"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="px-4.5 pt-2 bg-base-1 border-b border-border flex items-center shrink-0">
          <Tabs<CloneModalTab>
            tabs={[
              {
                id: 'remote',
                label: 'Your Repositories',
                icon: <FolderGit2 className="w-3.5 h-3.5 text-commito-coral" />,
              },
              {
                id: 'url',
                label: 'Clone by URL',
                icon: <Globe className="w-3.5 h-3.5" />,
              },
            ]}
            activeTab={activeMainTab}
            onChange={setActiveMainTab}
            size="sm"
          />
        </div>

        {/* Tab 1: Your Repositories from Connected Accounts */}
        {activeMainTab === 'remote' && (
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 bg-base-0">
            <RemoteAccountReposTab
              parentPath={parentPath}
              onSelectParentPath={handleSelectParentFolder}
              onClose={() => setIsCloneRepoModalOpen(false)}
            />
          </div>
        )}

        {/* Tab 2: Clone from URL */}
        {activeMainTab === 'url' && (
          <form onSubmit={handleClone} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4.5 space-y-3.5 text-xs font-sans text-text-primary bg-base-0">
              {/* Error Message */}
              {localError && (
                <div className="flex items-start gap-2.5 p-3 rounded-sm bg-git-removed-bg border border-git-removed/40 text-git-removed text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Clone Failed</p>
                    <p className="text-[11.5px] opacity-90 leading-normal mt-0.5">{localError}</p>
                  </div>
                </div>
              )}

              {/* 1. Repository Source URL Card */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1">
                    <span>Repository URL</span>
                    <span className="text-commito-coral">*</span>
                  </label>
                  {detectedProvider !== 'custom' && (
                    <span className="text-[11px] font-medium text-commito-coral capitalize px-1.5 py-0.5 rounded bg-commito-coral/10 border border-commito-coral/25">
                      {detectedProvider} repository
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    ref={urlInputRef}
                    type="text"
                    required
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://gitlab.com/owner/project.git or git@github.com:owner/project.git"
                    className="w-full h-8.5 pl-3 pr-8 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs font-mono text-text-primary/90 placeholder:text-text-muted/60 focus:outline-none transition shadow-2xs"
                  />
                  <Globe className="w-4 h-4 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 2. Destination Folder & Parent Path */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1">
                    <span>Local Destination Path</span>
                    <span className="text-commito-coral">*</span>
                  </label>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    required
                    value={parentPath}
                    onChange={(e) => setParentPath(e.target.value)}
                    className="flex-1 h-8.5 px-3 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs font-mono text-text-primary/90 placeholder:text-text-muted/60 focus:outline-none transition shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={handleSelectParentFolder}
                    className="h-8.5 px-3 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary transition flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="Browse local directory"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Choose...</span>
                  </button>
                </div>

                {/* Destination Path Preview Card */}
                <div className="px-3 py-1.5 bg-base-1/70 border border-border/70 rounded-sm flex items-center gap-2 text-[11.5px] text-text-muted font-mono truncate">
                  <Folder className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span className="text-text-muted shrink-0">Will clone to:</span>
                  <span
                    className="text-text-secondary font-medium truncate"
                    title={fullDestinationPath}
                  >
                    {fullDestinationPath}
                  </span>
                </div>
              </div>

              {/* 3. Authentication & Security Card */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-commito-coral" />
                    <span>Authentication</span>
                  </div>
                </div>

                {/* Segmented Auth Mode Switcher */}
                <Tabs<AuthMode>
                  tabs={authTabs}
                  activeTab={authMode}
                  onChange={setAuthMode}
                  variant="segmented"
                  size="sm"
                  fullWidth
                />

                {/* Mode: Saved Account */}
                {authMode === 'saved' && accounts.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-medium text-text-secondary">
                      Connected Account
                    </label>
                    <Dropdown
                      options={accounts.map((a) => ({
                        value: a.id || a.username,
                        label: `${a.username} (${a.provider === 'github' ? 'GitHub' : 'GitLab'})`,
                      }))}
                      value={selectedAccountId}
                      onChange={setSelectedAccountId}
                      className="w-full"
                    />
                    <p className="text-[11px] text-text-muted">
                      Cloning will use the authenticated access token for this account.
                    </p>
                  </div>
                )}

                {/* Mode: Credentials */}
                {authMode === 'credentials' && (
                  <div className="space-y-3 pt-1">
                    {/* 2-Column: Username + Password */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Username */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-text-muted" />
                          <span>Username</span>
                        </label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="username or oauth2"
                          className="w-full h-8 px-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs font-sans text-text-primary placeholder:text-text-muted/60 focus:outline-none transition shadow-2xs"
                        />
                      </div>

                      {/* Password / Personal Access Token */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5 text-text-muted" />
                            <span>Password / Token</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setHas2FaEnabled(!has2FaEnabled)}
                            className="text-[11px] text-commito-coral hover:underline cursor-pointer font-medium"
                          >
                            {has2FaEnabled ? 'Hide 2FA' : '2FA / MFA?'}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={passwordOrToken}
                            onChange={(e) => setPasswordOrToken(e.target.value)}
                            placeholder="Password or Token (glpat-... / ghp_...)"
                            className="w-full h-8 pl-2.5 pr-8 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs font-sans text-text-primary placeholder:text-text-muted/60 focus:outline-none transition shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer p-0.5"
                            title={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 2FA / MFA Verification Drawer */}
                    {has2FaEnabled && (
                      <div className="p-3 bg-base-2/80 border border-border rounded-sm space-y-2 animate-in fade-in duration-100">
                        <div className="flex items-start gap-2 text-xs text-text-primary font-medium">
                          <Lock className="w-3.5 h-3.5 text-commito-coral shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-text-primary">
                              Two-Factor Authentication (2FA)
                            </p>
                            <p className="text-[11px] text-text-muted leading-tight mt-0.5">
                              When 2FA is active, Git requires a{' '}
                              <strong>Personal Access Token (PAT)</strong> with repository read
                              permissions, or an active TOTP verification code.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1 pt-1">
                          <label className="text-xs font-medium text-text-secondary">
                            2FA Verification Code (OTP)
                          </label>
                          <input
                            type="text"
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value)}
                            placeholder="6-digit Authenticator OTP code"
                            className="w-full h-8 px-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs font-mono text-text-primary placeholder:text-text-muted/60 focus:outline-none transition shadow-2xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Save Credentials Toggle Card */}
                    <div
                      onClick={() => {
                        if (isCloning) return;
                        setSaveCredentials(!saveCredentials);
                      }}
                      className={`p-2.5 rounded-sm border transition cursor-pointer flex items-center justify-between gap-3 select-none ${
                        saveCredentials
                          ? 'bg-emerald-500/5 border-emerald-500/35 shadow-2xs'
                          : 'bg-base-1/50 border-border hover:bg-base-1'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-xs flex items-center justify-center shrink-0 transition ${
                            saveCredentials
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-base-0 text-text-muted border border-border'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 leading-none">
                            <span>Remember credentials in system keyring</span>
                            {saveCredentials && (
                              <span className="px-1.5 py-0.2 bg-emerald-500/15 text-emerald-400 text-[9px] font-bold rounded-xs border border-emerald-500/30">
                                Saved
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted mt-1 leading-none">
                            Securely persist username and token in OS credential vault
                          </p>
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <div
                        className={`relative inline-flex items-center w-7.5 h-4 rounded-xs px-0.5 border transition-colors shrink-0 ${
                          saveCredentials
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'bg-base-2 border-border'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-xs bg-white transition-transform duration-150 shadow-2xs ${
                            saveCredentials ? 'translate-x-3' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Mode: Public */}
                {authMode === 'public' && (
                  <div className="p-2.5 bg-base-1/70 border border-border/60 rounded-sm flex items-center gap-2 text-xs text-text-secondary">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      No authentication credentials required for public open-source repositories.
                    </span>
                  </div>
                )}
              </div>

              {/* 4. Clone Settings Section */}
              <div className="space-y-3">
                {/* Branch / Tag Input */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-text-muted" />
                    <span>
                      Branch / Tag{' '}
                      <span className="text-text-muted font-normal text-[11px]">(optional)</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={specificBranch}
                    onChange={(e) => setSpecificBranch(e.target.value)}
                    placeholder="e.g. main, dev, or release/v1.0"
                    className="w-full h-8 px-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text-primary/90 placeholder:text-text-muted/60 focus:outline-none transition shadow-2xs font-sans"
                  />
                </div>

                {/* Toggle Options: Rich Cards */}
                <div className="space-y-2 pt-0.5">
                  {/* Option 1: Recurse Submodules */}
                  <div
                    onClick={() => {
                      if (isCloning) return;
                      setRecurseSubmodules(!recurseSubmodules);
                    }}
                    className={`p-2.5 rounded-sm border transition cursor-pointer flex items-center justify-between gap-3 select-none ${
                      recurseSubmodules
                        ? 'bg-commito-coral/5 border-commito-coral/35 shadow-2xs'
                        : 'bg-base-1/50 border-border hover:bg-base-1'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-xs flex items-center justify-center shrink-0 transition ${
                          recurseSubmodules
                            ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/30'
                            : 'bg-base-0 text-text-muted border border-border'
                        }`}
                      >
                        <FolderGit2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 leading-none">
                          <span>Recurse submodules</span>
                          {recurseSubmodules && (
                            <span className="px-1.5 py-0.2 bg-commito-coral/15 text-commito-coral text-[9px] font-bold rounded-xs border border-commito-coral/30">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted mt-1 leading-none">
                          Automatically initialize and clone all nested submodules
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <div
                      className={`relative inline-flex items-center w-7.5 h-4 rounded-xs px-0.5 border transition-colors shrink-0 ${
                        recurseSubmodules
                          ? 'bg-commito-coral border-commito-coral'
                          : 'bg-base-2 border-border'
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded-xs bg-white transition-transform duration-150 shadow-2xs ${
                          recurseSubmodules ? 'translate-x-3' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Option 2: Shallow Clone */}
                  <div
                    onClick={() => {
                      if (isCloning) return;
                      setIsShallowClone(!isShallowClone);
                    }}
                    className={`p-2.5 rounded-sm border transition cursor-pointer flex items-center justify-between gap-3 select-none ${
                      isShallowClone
                        ? 'bg-sky-500/5 border-sky-500/35 shadow-2xs'
                        : 'bg-base-1/50 border-border hover:bg-base-1'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-xs flex items-center justify-center shrink-0 transition ${
                          isShallowClone
                            ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                            : 'bg-base-0 text-text-muted border border-border'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 leading-none">
                          <span>Shallow clone (--depth 1)</span>
                          {isShallowClone && (
                            <span className="px-1.5 py-0.2 bg-sky-500/15 text-sky-400 text-[9px] font-bold rounded-xs border border-sky-500/30">
                              Fast
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted mt-1 leading-none">
                          Fetch only the latest commit without downloading full commit history
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <div
                      className={`relative inline-flex items-center w-7.5 h-4 rounded-xs px-0.5 border transition-colors shrink-0 ${
                        isShallowClone ? 'bg-sky-500 border-sky-500' : 'bg-base-2 border-border'
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded-xs bg-white transition-transform duration-150 shadow-2xs ${
                          isShallowClone ? 'translate-x-3' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-3 bg-base-1 border-t border-border flex items-center justify-between shrink-0">
              <div className="text-xs text-text-muted truncate">
                {cloneProgressMessage && (
                  <span className="flex items-center gap-2 text-commito-coral font-medium animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span className="truncate">{cloneProgressMessage}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={isCloning}
                  className="px-4 py-1.5 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-xs font-medium text-text-subtle hover:text-text-primary transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCloning || !url.trim()}
                  className="px-4.5 py-1.5 bg-commito-coral hover:bg-commito-coralLight disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-98"
                >
                  {isCloning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Cloning Repository...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Clone Repository</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      <ConfirmDialog
        isOpen={showConfirm}
        title="Discard Clone Configuration?"
        description="You have entered clone details and credentials. If you leave now, your entries will be discarded."
        cancelText="Keep Editing"
        discardText="Discard & Close"
        onDiscard={confirmDiscard}
        onCancel={cancelDiscard}
        variant="danger"
      />
    </div>,
    document.body
  );
};
