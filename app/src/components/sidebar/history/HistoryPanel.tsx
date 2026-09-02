import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CommitInfo } from '../../../types/git';
import { useGitStore } from '../../../store/useGitStore';
import { useSigningStore } from '../../../store/signingStore';
import { GitService } from '../../../services/git/gitService';
import { RepoCacheService } from '../../../services/git/repoCacheService';
import { CommitFilters, CommitQuickFilter } from './CommitFilters';
import { CommitList } from './CommitList';

const PAGE_SIZE = 50;

const sampleCommits: CommitInfo[] = [
  {
    sha: '2488b368a1f73b64c129e9240',
    short_sha: '2488b368',
    message: 'build(tauri): upgrade Tauri to v2.4.1',
    author_name: 'Neel Frostrain',
    author_email: 'neelofficial0812@gmail.com',
    timestamp: Date.now(),
    relative_date: '5 minutes ago',
  },
  {
    sha: '153d4db9c2e47f81a329e1112',
    short_sha: '153d4db9',
    message: 'feat(git): add commit history reorder engine',
    author_name: 'Neel Frostrain',
    author_email: 'neelofficial0812@gmail.com',
    timestamp: Date.now() - 3600000,
    relative_date: '1 hour ago',
  },
];

/**
 * Sidebar panel displaying the repository commit log timeline with text search filtering
 * and dynamic infinite-scroll pagination.
 */
export const HistoryPanel: React.FC = () => {
  const [commitFilter, setCommitFilter] = useState('');
  const {
    activeRepoPath,
    setSelectedCommitSha,
    tags,
    setTags,
    user,
    status,
    repoSyncCounter,
  } = useGitStore(
    useShallow((s) => ({
      activeRepoPath: s.activeRepoPath,
      setSelectedCommitSha: s.setSelectedCommitSha,
      tags: s.tags,
      setTags: s.setTags,
      user: s.user,
      status: s.status,
      repoSyncCounter: s.repoSyncCounter,
    }))
  );

  const [commits, setCommits] = useState<CommitInfo[]>(() => {
    if (activeRepoPath) {
      const cached = RepoCacheService.getCommits(activeRepoPath);
      if (cached && cached.length > 0) return cached;
    }
    return [];
  });
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isFetchingRef = useRef(false);

  // Sync with cached commits or reset when activeRepoPath changes
  useEffect(() => {
    if (!activeRepoPath) {
      setCommits([]);
      setHasMore(false);
      return;
    }
    const cached = RepoCacheService.getCommits(activeRepoPath);
    if (cached && cached.length > 0) {
      setCommits(cached);
      const currentSha = useGitStore.getState().selectedCommitSha;
      if (!currentSha) {
        setSelectedCommitSha(cached[0].sha);
      }
    } else {
      setCommits([]);
      setHasMore(true);
      setIsLoadingInitial(true);
    }
  }, [activeRepoPath, setSelectedCommitSha]);

  // Load initial batch of commits
  const loadInitialCommits = useCallback(async () => {
    if (!activeRepoPath) {
      setCommits(sampleCommits);
      setHasMore(false);
      const currentSha = useGitStore.getState().selectedCommitSha;
      if (sampleCommits.length > 0 && !currentSha) {
        setSelectedCommitSha(sampleCommits[0].sha);
      }
      return;
    }

    setIsLoadingInitial(true);
    setHasMore(true);

    try {
      // 1. Fetch tags in parallel
      GitService.listTags(activeRepoPath)
        .then((tagsRes) => {
          if (tagsRes) setTags(tagsRes);
        })
        .catch(() => {});

      // 2. Fetch first batch of commits
      const res = await GitService.getCommitHistory(activeRepoPath, PAGE_SIZE, 0);
      if (res && res.length > 0) {
        RepoCacheService.setCommits(activeRepoPath, res);
        setCommits(res);
        setHasMore(res.length === PAGE_SIZE);
        const currentSha = useGitStore.getState().selectedCommitSha;
        const hasSelected = currentSha && res.some((c) => c.sha === currentSha);
        if (!hasSelected) {
          setSelectedCommitSha(res[0].sha);
        }
      } else {
        setCommits([]);
        setHasMore(false);
        setSelectedCommitSha(null);
      }
    } catch {
      setCommits(sampleCommits);
      setHasMore(false);
    } finally {
      setIsLoadingInitial(false);
    }
  }, [activeRepoPath, setTags, setSelectedCommitSha]);

  useEffect(() => {
    loadInitialCommits();
  }, [activeRepoPath, status?.current_branch, repoSyncCounter, loadInitialCommits]);

  // Load next batch on scroll
  const handleLoadMore = useCallback(async () => {
    if (
      !activeRepoPath ||
      !hasMore ||
      isLoadingMore ||
      isLoadingInitial ||
      isFetchingRef.current ||
      commits.length === 0
    ) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoadingMore(true);

    try {
      const offset = commits.length;
      const nextBatch = await GitService.getCommitHistory(activeRepoPath, PAGE_SIZE, offset);

      if (nextBatch && nextBatch.length > 0) {
        setCommits((prev) => {
          const existingShas = new Set(prev.map((c) => c.sha));
          const fresh = nextBatch.filter((c) => !existingShas.has(c.sha));
          return [...prev, ...fresh];
        });
        setHasMore(nextBatch.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [activeRepoPath, hasMore, isLoadingMore, isLoadingInitial, commits.length]);

  const [activeQuickFilter, setActiveQuickFilter] = useState<CommitQuickFilter>('all');
  const verifiedCommits = useSigningStore((s) => s.verifiedCommits);

  const filteredCommits = commits.filter((c) => {
    // 1. Text filter
    if (commitFilter.trim()) {
      const q = commitFilter.toLowerCase();
      const match =
        c.message.toLowerCase().includes(q) ||
        c.author_name.toLowerCase().includes(q) ||
        c.author_email.toLowerCase().includes(q) ||
        c.short_sha.toLowerCase().includes(q);
      if (!match) return false;
    }

    // 2. Quick filter
    if (activeQuickFilter === 'mine') {
      const userEmail = user?.email?.toLowerCase();
      const userName = user?.name?.toLowerCase();
      const isMine =
        (userEmail && c.author_email.toLowerCase().includes(userEmail)) ||
        (userName && c.author_name.toLowerCase().includes(userName));
      if (!isMine) return false;
    } else if (activeQuickFilter === 'signed') {
      const v = verifiedCommits[c.sha];
      if (!v || v.status !== 'Verified') return false;
    } else if (activeQuickFilter === 'tagged') {
      const hasTag = tags.some(
        (t) =>
          t.sha && (t.sha === c.sha || c.sha.startsWith(t.sha) || t.sha.startsWith(c.short_sha))
      );
      if (!hasTag) return false;
    }

    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none">
      <CommitFilters
        filter={commitFilter}
        onFilterChange={setCommitFilter}
        activeQuickFilter={activeQuickFilter}
        onQuickFilterChange={setActiveQuickFilter}
        currentUserEmail={user?.email || undefined}
      />
      <CommitList
        commits={filteredCommits}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        isLoadingInitial={isLoadingInitial}
        onLoadMore={handleLoadMore}
      />
    </div>
  );
};
