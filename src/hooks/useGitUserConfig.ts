import { useState, useEffect, useRef, useMemo } from 'react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { GitService, GitUserIdentity } from '../services/git/gitService';
import { AccountService } from '../services/accounts/accountService';
import { useAccountServicesStore } from '../features/account-services';
import { getErrorMessage, toAppError } from '../shared/utils/errorUtils';
import { Provider } from '../types/gitlab';

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
  const accountServicesAccounts = useAccountServicesStore((s) => s.accounts);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedSyncAccount, setSelectedSyncAccount] = useState<string>('custom');
  const [selectedProvider, setSelectedProvider] = useState<Provider>(user?.provider || 'gitlab');
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

    let isMounted = true;

    const initializeIdentity = async () => {
      // 1. Load accounts in background
      AccountService.listSavedAccounts()
        .then((accs) => {
          if (isMounted && accs && accs.length > 0) {
            setAccounts(accs);
          }
        })
        .catch(() => {});

      useAccountServicesStore.getState().loadAccounts().catch(() => {});

      // 2. Fetch Git repo identity
      let repoIdentity: GitUserIdentity | null = null;
      if (activeRepoPath) {
        try {
          repoIdentity = await GitService.getUserIdentity(activeRepoPath);
        } catch {
          // ignore error
        }
      }

      if (!isMounted) return;

      const storeUser = useGitStore.getState().user;
      const initialName = repoIdentity?.name || storeUser?.name || storeUser?.username || '';
      const initialEmail = repoIdentity?.email || storeUser?.email || '';
      const initialAvatar = storeUser?.avatar_url || null;

      setName(initialName);
      setEmail(initialEmail);
      setAvatarUrl(initialAvatar);
      setModalError(null);

      if (storeUser?.provider) {
        setSelectedProvider(storeUser.provider);
      }

      // Check if current email matches any known account
      const currentServicesAccounts = useAccountServicesStore.getState().accounts;
      const matchedAccount = currentServicesAccounts.find(
        (a) => a.commit_email && a.commit_email.toLowerCase() === initialEmail.toLowerCase()
      );

      if (matchedAccount) {
        setSelectedSyncAccount(matchedAccount.id);
      } else if (storeUser?.id) {
        setSelectedSyncAccount(String(storeUser.id));
      } else {
        setSelectedSyncAccount('custom');
      }
    };

    initializeIdentity();

    return () => {
      isMounted = false;
    };
  }, [isUserConfigModalOpen, activeRepoPath, setAccounts]);

  // Build unique deduplicated list of accounts
  const allAvailableAccounts: AccountOption[] = useMemo(() => {
    const list: AccountOption[] = [];
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

    // 1. Add from AccountServicesStore (current multi-provider source of truth: GitHub, GitLab, Bitbucket)
    for (const acc of accountServicesAccounts) {
      const cleanUsername = acc.handle.replace(/^@+/, '');
      const accKeys = getAccountKeys(acc.provider, acc.commit_email, cleanUsername, acc.display_name);
      accKeys.forEach((k) => seenAccountKeys.add(k));
      list.push({
        id: acc.id,
        name: acc.display_name || cleanUsername,
        username: cleanUsername,
        email: acc.commit_email || null,
        avatar_url: acc.avatar_url || null,
        provider: acc.provider,
      });
    }

    // 2. Also include active user if not already in list
    if (user) {
      const userKeys = getAccountKeys(user.provider, user.email, user.username, user.name);
      const isAlreadyAdded =
        userKeys.some((k) => seenAccountKeys.has(k)) ||
        list.some((a) => a.id === String(user.id));
      if (!isAlreadyAdded) {
        userKeys.forEach((k) => seenAccountKeys.add(k));
        list.push({
          id: String(user.id),
          name: user.name || user.username,
          username: user.username || user.name,
          email: user.email,
          avatar_url: user.avatar_url,
          provider: user.provider,
        });
      }
    }

    // 3. Include accounts from useGitStore
    for (const acc of accounts) {
      const accKeys = getAccountKeys(acc.provider, acc.email, acc.username, acc.name);
      const isAlreadyAdded =
        accKeys.some((k) => seenAccountKeys.has(k)) ||
        list.some((a) => String(a.id) === String(acc.id));

      if (!isAlreadyAdded) {
        accKeys.forEach((k) => seenAccountKeys.add(k));
        list.push({
          id: String(acc.id),
          name: acc.name || acc.username,
          username: acc.username || acc.name,
          email: acc.email,
          avatar_url: acc.avatar_url,
          provider: acc.provider,
        });
      }
    }

    return list;
  }, [accountServicesAccounts, user, accounts]);

  const isValidEmail = (val: string) => /\S+@\S+\.\S+/.test(val.trim());
  const isValidName = name.trim().length > 0;
  const isFormValid = isValidName && isValidEmail(email);

  const handleSyncAccountChange = async (accId: string) => {
    setSelectedSyncAccount(accId);

    if (accId === 'custom') {
      setSelectedProvider('custom');
      return;
    }

    const targetAccount = allAvailableAccounts.find((a) => a.id === accId);

    if (targetAccount) {
      const syncName = targetAccount.name || targetAccount.username || '';
      const syncEmail = targetAccount.email || '';
      const syncAvatar = targetAccount.avatar_url || null;
      const syncProvider = (targetAccount.provider || 'custom') as Provider;

      setName(syncName);
      setEmail(syncEmail);
      setAvatarUrl(syncAvatar);
      setSelectedProvider(syncProvider);

      try {
        await useAccountServicesStore.getState().setActiveAccount(targetAccount.id);
      } catch (err) {
        console.warn('Failed to switch active account:', err);
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

  const activeRepoName = activeRepoPath
    ? activeRepoPath.split(/[/\\]/).filter(Boolean).pop() || null
    : null;

  return {
    isUserConfigModalOpen,
    activeRepoPath,
    activeRepoName,
    selectedProvider,
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
