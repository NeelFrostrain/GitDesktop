import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, User, Upload, Trash2, CheckCircle2, AlertCircle, Link2, Link, ChevronDown, Check, Unlink } from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { RepoStatus } from '../types/git';
import { SavedAccount } from '../types/gitlab';
import { UserAvatar } from './UserAvatar';

export const GitUserConfigModal: React.FC = () => {
  const {
    activeRepoPath,
    user,
    setUser,
    accounts,
    setAccounts,
    setStatus,
    setError,
    isUserConfigModalOpen,
    setIsUserConfigModalOpen,
    pendingCommitData,
    setPendingCommitData,
  } = useGitStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedSyncAccount, setSelectedSyncAccount] = useState<string>('custom');
  const [selectedProvider, setSelectedProvider] = useState<'gitlab' | 'github'>(user?.provider || 'gitlab');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  useEffect(() => {
    if (!isUserConfigModalOpen) return;

    // Load connected accounts list
    invoke<SavedAccount[]>('list_accounts_cmd')
      .then((accs) => {
        if (accs && accs.length > 0) {
          setAccounts(accs);
        }
      })
      .catch(() => {});

    // Load initial values from current user or git config
    setName(user?.name || user?.username || '');
    setEmail(user?.email || '');
    setAvatarUrl(user?.avatar_url || null);
    setModalError(null);
    if (user?.provider) {
      setSelectedProvider(user.provider);
    }
    setSelectedSyncAccount(user ? `active:${user.id}` : 'custom');

    if (activeRepoPath) {
      invoke<any>('get_git_user_identity_cmd', { repoPath: activeRepoPath })
        .then((res) => {
          if (res) {
            if (res.name) setName(res.name);
            if (res.email) setEmail(res.email);
          }
        })
        .catch(() => {});
    }
  }, [isUserConfigModalOpen, activeRepoPath, user]);

  if (!isUserConfigModalOpen) return null;

  // Build unique deduplicated list of accounts
  const allAvailableAccounts: {
    id: string;
    name: string;
    username: string;
    email?: string | null;
    avatar_url?: string | null;
    provider: string;
  }[] = [];

  const seenAccountKeys = new Set<string>();

  const getAccountKeys = (provider: string, email?: string | null, username?: string | null, name?: string | null) => {
    const keys: string[] = [];
    const prov = (provider || 'git').toLowerCase();
    if (email && email.trim()) {
      keys.push(`${prov}:email:${email.trim().toLowerCase()}`);
    }
    const cleanHandle = (username || name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanHandle) {
      keys.push(`${prov}:handle:${cleanHandle}`);
    }
    return keys;
  };

  if (user) {
    const userKeys = getAccountKeys(user.provider, user.email, user.username, user.name);
    userKeys.forEach((k) => seenAccountKeys.add(k));
    allAvailableAccounts.push({
      id: `active:${user.id}`,
      name: user.name || user.username,
      username: user.username || user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      provider: user.provider,
    });
  }

  for (const acc of accounts) {
    const accKeys = getAccountKeys(acc.provider, acc.email, acc.username, acc.name);
    const isAlreadyAdded = accKeys.some((k) => seenAccountKeys.has(k)) || String(acc.id) === String(user?.id);

    if (!isAlreadyAdded) {
      accKeys.forEach((k) => seenAccountKeys.add(k));
      allAvailableAccounts.push({
        id: String(acc.id),
        name: acc.name || acc.username,
        username: acc.username || acc.name,
        email: acc.email,
        avatar_url: acc.avatar_url,
        provider: acc.provider,
      });
    }
  }


  const isValidEmail = (val: string) => /\S+@\S+\.\S+/.test(val.trim());
  const isValidName = name.trim().length > 0;
  const isFormValid = isValidName && isValidEmail(email);

  const handleSyncAccountChange = (accId: string) => {
    setSelectedSyncAccount(accId);

    if (accId === 'custom') {
      return;
    }

    const targetAcc = allAvailableAccounts.find((a) => a.id === accId);

    if (targetAcc) {
      const syncName = targetAcc.name || targetAcc.username;
      if (syncName) setName(syncName);
      if (targetAcc.email) setEmail(targetAcc.email);
      if (targetAcc.avatar_url) setAvatarUrl(targetAcc.avatar_url);
      if (targetAcc.provider === 'github' || targetAcc.provider === 'gitlab') {
        setSelectedProvider(targetAcc.provider);
      }

      const providerLabel = targetAcc.provider ? targetAcc.provider.toUpperCase() : 'Remote';
      useLogStore.getState().addLog('info', 'Git', `Synced identity with ${providerLabel} account: ${syncName}`);
    }
  };



  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setModalError('Avatar image must be smaller than 2 MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setModalError('Please select a valid image file (PNG, JPG, WebP, SVG).');
      return;
    }

    setModalError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setModalError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    try {
      // 1. Save git config (repo local if repo is active)
      if (activeRepoPath) {
        await invoke('set_repo_git_config_cmd', {
          repoPath: activeRepoPath,
          key: 'user.name',
          value: trimmedName,
        });

        await invoke('set_repo_git_config_cmd', {
          repoPath: activeRepoPath,
          key: 'user.email',
          value: trimmedEmail,
        });
      }

      // 2. Save avatar & identity in user store
      const updatedUser = {
        id: user?.id || 1,
        username: trimmedName.toLowerCase().replace(/\s+/g, '-'),
        name: trimmedName,
        email: trimmedEmail,
        avatar_url: avatarUrl || null,
        web_url: user?.web_url || '',
        server_url: user?.server_url || '',
        provider: selectedProvider || user?.provider || 'gitlab',

      };
      setUser(updatedUser);

      useLogStore.getState().addLog('success', 'Git', `Configured Git user: '${trimmedName} <${trimmedEmail}>'`);

      // 3. Resume pending commit if triggered from commit action
      if (pendingCommitData && activeRepoPath) {
        useLogStore.getState().addLog('info', 'Git', `Resuming original commit operation...`);

        const opts = useGitStore.getState().commitOptions;
        await invoke('commit_changes', {
          repoPath: activeRepoPath,
          summary: pendingCommitData.summary,
          description: pendingCommitData.description || null,
          noVerify: opts.bypassHooks,
          signOff: opts.signOff,
          allowEmpty: opts.allowEmpty,
        });


        useLogStore.getState().addLog(
          'success',
          'Git',
          `Committed changes to ${activeRepoPath.split(/[/\\]/).pop()}: '${pendingCommitData.summary}'`
        );

        // Refresh repo status
        const statusRes = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
        setStatus(statusRes);
      }

      // Reset pending state and close modal
      setPendingCommitData(null);
      setIsUserConfigModalOpen(false);
    } catch (err: any) {
      const msg = err.message || String(err);
      setModalError(`Failed to save configuration or execute commit: ${msg}`);
      setError({ code: 'GIT_CONFIG_ERROR', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsUserConfigModalOpen(false);
    setPendingCommitData(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-base-0 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-commito-coral/20 border border-commito-coral/40 text-commito-coral flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary leading-tight">
                Git User Configuration
              </h2>
              <p className="text-[11px] text-text-muted">
                Set the identity used for your Git commits
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-base-2 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {modalError && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-md flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="leading-snug">{modalError}</div>
            </div>
          )}

          {/* Sync with Remote Account Selector */}
          <div className="p-3.5 bg-base-2/60 border border-border rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-commito-coral" />
                <span>Sync with Remote</span>
              </label>
              {selectedSyncAccount !== 'custom' ? (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                  <Link className="w-2.5 h-2.5" /> Linked
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-base-3 text-text-muted border border-border rounded text-[10px] font-semibold uppercase tracking-wider">
                  Unlinked / Manual
                </span>
              )}
            </div>

            {/* Custom Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-3 py-2 bg-base-0 border border-border hover:border-commito-coral/50 rounded-md text-xs text-text-primary flex items-center justify-between transition cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-2 truncate">
                  {selectedSyncAccount === 'custom' ? (
                    <>
                      <Unlink className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                      <span className="font-semibold text-text-secondary truncate">⚡ Unlinked / Manual Identity</span>
                    </>
                  ) : (
                    (() => {
                      const selectedItem = allAvailableAccounts.find((a) => a.id === selectedSyncAccount);

                      if (!selectedItem) return <span>Select account...</span>;
                      return (
                        <>
                          <UserAvatar
                            url={selectedItem.avatar_url}
                            name={selectedItem.name || selectedItem.username}
                            email={selectedItem.email || undefined}
                            provider={selectedItem.provider}
                            className="w-4 h-4"
                            iconClassName="w-2.5 h-2.5"
                          />
                          <span className="font-bold text-text-primary truncate">
                            {selectedItem.provider === 'github' ? 'GitHub' : 'GitLab'}: {selectedItem.name || selectedItem.username}
                          </span>
                          {selectedItem.email && (
                            <span className="text-[10px] text-text-muted font-mono truncate">
                              ({selectedItem.email})
                            </span>
                          )}
                        </>
                      );
                    })()
                  )}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ml-2 flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-base-1 border border-border rounded-md shadow-2xl z-50 py-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto">
                  {/* Unlinked Option */}
                  <button
                    type="button"
                    onClick={() => {
                      handleSyncAccountChange('custom');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition cursor-pointer ${
                      selectedSyncAccount === 'custom'
                        ? 'bg-commito-coral/20 text-commito-coral font-bold'
                        : 'hover:bg-base-2 text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Unlink className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                      <span>⚡ Unlinked / Manual Identity</span>
                    </div>
                    {selectedSyncAccount === 'custom' && <Check className="w-3.5 h-3.5 text-commito-coral" />}
                  </button>

                  {/* Available Accounts Options */}
                  {allAvailableAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        handleSyncAccountChange(acc.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition cursor-pointer ${
                        selectedSyncAccount === acc.id
                          ? 'bg-commito-coral/20 text-commito-coral font-bold'
                          : 'hover:bg-base-2 text-text-primary'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <UserAvatar url={acc.avatar_url} name={acc.name || acc.username} email={acc.email || undefined} provider={acc.provider} className="w-4 h-4" iconClassName="w-2.5 h-2.5" />
                        <div className="truncate">
                          <span className="font-bold">
                            {acc.provider === 'github' ? 'GitHub' : 'GitLab'}: {acc.name || acc.username}
                          </span>
                          {acc.email && <span className="text-[10px] text-text-muted font-mono ml-1">({acc.email})</span>}
                        </div>
                      </div>
                      {selectedSyncAccount === acc.id && <Check className="w-3.5 h-3.5 text-commito-coral" />}
                    </button>
                  ))}
                </div>
              )}


            </div>


            <p className="text-[11px] text-text-muted leading-snug">
              Syncing populates your name, email, and avatar directly from GitHub or GitLab.
            </p>
          </div>

          {/* Avatar Selector Section */}
          <div className="p-3 bg-base-2/60 border border-border rounded-md flex items-center gap-4">
            <UserAvatar
              url={avatarUrl}
              name={name || 'User'}
              className="w-14 h-14"
              iconClassName="w-6 h-6"
            />

            <div className="flex-1 space-y-1.5">
              <span className="text-xs font-bold text-text-primary block">
                Profile Avatar
              </span>
              <p className="text-[11px] text-text-muted leading-tight">
                Stored in app settings for desktop UI display
              </p>

              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-base-1 hover:bg-base-3 border border-border rounded text-[11px] font-semibold text-text-primary flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Upload className="w-3 h-3 text-commito-coral" />
                  <span>Upload Image</span>
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="px-2 py-1 bg-base-1 hover:bg-base-3 border border-border rounded text-[11px] font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name Field */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-primary block">
              Git User Name <span className="text-commito-coral">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Neel Frostrain"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSelectedSyncAccount('custom');
              }}
              className="w-full px-3 py-2 bg-base-0 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
              required
            />
          </div>

          {/* Email Field */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-primary block">
              Git User Email <span className="text-commito-coral">*</span>
            </label>
            <input
              type="email"
              placeholder="e.g. example@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSelectedSyncAccount('custom');
              }}
              className={`w-full px-3 py-2 bg-base-0 border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none font-sans ${
                email && !isValidEmail(email)
                  ? 'border-red-500/60 focus:border-red-500'
                  : 'border-border focus:border-commito-coral/50'
              }`}
              required
            />
            {email && !isValidEmail(email) && (
              <span className="text-[10px] text-red-400 block pt-0.5 font-medium">
                Please enter a valid email address.
              </span>
            )}
          </div>

          {/* Footer Controls */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-base-2 hover:bg-base-3 border border-border rounded-md text-xs font-semibold text-text-secondary transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`px-5 py-2 rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-sm ${
                isFormValid && !isSubmitting
                  ? 'bg-commito-coral hover:bg-commito-coralHover text-white cursor-pointer'
                  : 'bg-base-2 text-text-muted border border-border cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save & Continue'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
