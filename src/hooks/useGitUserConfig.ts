import { useState, useEffect, useRef } from 'react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { GitService } from '../services/git/gitService';
import { AccountService } from '../services/accounts/accountService';
import { getErrorMessage, toAppError } from '../shared/utils/errorUtils';

/**
 * Account option representation for the identity selector dropdown.
 */
export interface AccountOption {
  id: string;
  name: string;
  username: string;
  email?: string | null;
  avatar_url?: string | null;
  provider: string;
}

/**
 * Hook managing Git user identity configuration modal state, avatar file uploads,
 * synchronization with connected accounts, and optional commit resumption.
 */
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
    AccountService.listSavedAccounts()
      .then((accs) => {
        if (accs && accs.length > 0) {
          setAccounts(accs);
        }
      })
      .catch(() => {
        // Silently handle account fetch failures
      });

    // Load initial values from global store
    setName(user?.name || user?.username || '');
    setEmail(user?.email || '');
    setAvatarUrl(user?.avatar_url || null);
    setModalError(null);
    if (user?.provider) {
      setSelectedProvider(user.provider);
    }
    setSelectedSyncAccount(user ? `active:${user.id}` : 'custom');

    // Read configured user identity from active repository
    if (activeRepoPath) {
      GitService.getUserIdentity(activeRepoPath)
        .then((res) => {
          if (res) {
            if (res.name) setName(res.name);
            if (res.email) setEmail(res.email);
          }
        })
        .catch(() => {
          // Silently handle config read errors
        });
    }
  }, [isUserConfigModalOpen, activeRepoPath, user, setAccounts]);

  // Build unique deduplicated list of accounts
  const allAvailableAccounts: AccountOption[] = [];
  const seenAccountKeys = new Set<string>();

  const getAccountKeys = (provider: string, accountEmail?: string | null, username?: string | null, accountName?: string | null) => {
    const keys: string[] = [];
    const prov = (provider || 'git').toLowerCase();
    if (accountEmail && accountEmail.trim()) {
      keys.push(`${prov}:email:${accountEmail.trim().toLowerCase()}`);
    }
    const cleanHandle = (username || accountName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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

    const targetAccount = allAvailableAccounts.find((a) => a.id === accId);

    if (targetAccount) {
      const syncName = targetAccount.name || targetAccount.username;
      if (syncName) setName(syncName);
      if (targetAccount.email) setEmail(targetAccount.email);
      if (targetAccount.avatar_url) setAvatarUrl(targetAccount.avatar_url);
      if (targetAccount.provider === 'github' || targetAccount.provider === 'gitlab') {
        setSelectedProvider(targetAccount.provider as 'github' | 'gitlab');
      }

      const providerLabel = targetAccount.provider ? targetAccount.provider.toUpperCase() : 'Remote';
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
        await GitService.setRepoConfig(activeRepoPath, 'user.name', trimmedName);
        await GitService.setRepoConfig(activeRepoPath, 'user.email', trimmedEmail);
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

      // Resume pending commit operation if one was waiting for user identity setup
      if (pendingCommitData && activeRepoPath) {
        useLogStore.getState().addLog('info', 'Git', 'Resuming original commit operation...');

        const { commitOptions: opts, stagedFiles } = useGitStore.getState();
        if (stagedFiles.length > 0) {
          await GitService.stageFiles(activeRepoPath, stagedFiles);
        }
        await GitService.commit({
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

        const statusRes = await GitService.getRepoStatus(activeRepoPath);
        setStatus(statusRes);
      }

      setPendingCommitData(null);
      setIsUserConfigModalOpen(false);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setModalError(`Failed to save configuration or execute commit: ${message}`);
      setError(toAppError(error, 'GIT_CONFIG_ERROR'));
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
