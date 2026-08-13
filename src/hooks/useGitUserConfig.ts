import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { RepoStatus } from '../types/git';
import { SavedAccount } from '../types/gitlab';

export interface AccountOption {
  id: string;
  name: string;
  username: string;
  email?: string | null;
  avatar_url?: string | null;
  provider: string;
}

export function useGitUserConfig() {
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

    // Load initial values
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

  // Build unique deduplicated list of accounts
  const allAvailableAccounts: AccountOption[] = [];
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

    if (accId === 'custom') return;

    const targetAcc = allAvailableAccounts.find((a) => a.id === accId);

    if (targetAcc) {
      const syncName = targetAcc.name || targetAcc.username;
      if (syncName) setName(syncName);
      if (targetAcc.email) setEmail(targetAcc.email);
      if (targetAcc.avatar_url) setAvatarUrl(targetAcc.avatar_url);
      if (targetAcc.provider === 'github' || targetAcc.provider === 'gitlab') {
        setSelectedProvider(targetAcc.provider as 'github' | 'gitlab');
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

      if (pendingCommitData && activeRepoPath) {
        useLogStore.getState().addLog('info', 'Git', `Resuming original commit operation...`);

        const { commitOptions: opts, stagedFiles } = useGitStore.getState();
        if (stagedFiles.length > 0) {
          await invoke('stage_files', { repoPath: activeRepoPath, files: stagedFiles });
        }
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

        const statusRes = await invoke<RepoStatus>('get_repo_status', { repoPath: activeRepoPath });
        setStatus(statusRes);
      }

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

  return {
    isUserConfigModalOpen,
    name,
    setName,
    email,
    setEmail,
    avatarUrl,
    selectedSyncAccount,
    allAvailableAccounts,
    isDropdownOpen,
    setIsDropdownOpen,
    isSubmitting,
    modalError,
    fileInputRef,
    dropdownRef,
    isValidEmail,
    isFormValid,
    handleSyncAccountChange,
    handleImageUpload,
    handleRemoveAvatar,
    handleSave,
    handleClose,
    setSelectedSyncAccount,
  };
}
