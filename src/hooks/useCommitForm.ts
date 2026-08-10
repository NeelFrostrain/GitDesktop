import { useState, useRef, useEffect } from 'react';
import { useGitStore } from '../store/useGitStore';
import { useLogStore } from '../store/useLogStore';
import { GitCommitService } from '../services/git/GitCommitService';

export function useCommitForm() {
  const {
    activeRepoPath,
    status,
    setStatus,
    stagedFiles,
    commitSummary,
    setCommitSummary,
    commitDescription,
    setCommitDescription,
    commitOptions,
    setCommitOptions,
    setError,
    setIsUserConfigModalOpen,
    setPendingCommitData,
  } = useGitStore();

  const [isCommitting, setIsCommitting] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setIsOptionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveOptions = Boolean(
    commitOptions.bypassHooks || commitOptions.signOff || commitOptions.allowEmpty
  );

  const allFilesCount = status?.files?.length || 0;
  const canCommit = Boolean(
    commitSummary.trim() && (stagedFiles.length > 0 || allFilesCount > 0 || commitOptions.allowEmpty)
  );

  const handleCommit = async () => {
    if (!activeRepoPath || !commitSummary.trim()) return;

    // Check Git user identity first
    const identity = await GitCommitService.getIdentity(activeRepoPath);
    if (!identity?.name || !identity?.email || !identity.name.trim() || !identity.email.trim()) {
      setPendingCommitData({
        summary: commitSummary,
        description: commitDescription,
      });
      setIsUserConfigModalOpen(true);
      return;
    }

    setIsCommitting(true);

    try {
      await GitCommitService.commit({
        repoPath: activeRepoPath,
        summary: commitSummary,
        description: commitDescription,
        noVerify: commitOptions.bypassHooks,
        signOff: commitOptions.signOff,
        allowEmpty: commitOptions.allowEmpty,
      });

      setCommitSummary('');
      setCommitDescription('');
      useLogStore.getState().addLog('success', 'Git', `Committed: ${commitSummary}`);

      const newStatus = await GitCommitService.getStatus(activeRepoPath);
      setStatus(newStatus);
    } catch (err: any) {
      setError({ code: err.code || 'GIT_ERROR', message: err.message || String(err) });
    } finally {
      setIsCommitting(false);
    }
  };

  const clearForm = () => {
    setCommitSummary('');
    setCommitDescription('');
  };

  return {
    commitSummary,
    setCommitSummary,
    commitDescription,
    setCommitDescription,
    commitOptions,
    setCommitOptions,
    isCommitting,
    isOptionsMenuOpen,
    setIsOptionsMenuOpen,
    optionsMenuRef,
    hasActiveOptions,
    canCommit,
    handleCommit,
    clearForm,
  };
}
