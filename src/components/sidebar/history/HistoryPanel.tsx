import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CommitInfo } from '../../../types/git';
import { useGitStore } from '../../../store/useGitStore';
import { useSigningStore } from '../../../store/signingStore';
import { GitService } from '../../../services/git/gitService';
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
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { activeTab, activeRepoPath, selectedCommitSha, setSelectedCommitSha, setTags } =
    useGitStore();

  const isFetchingRef = useRef(false);

  // Load initial batch of commits
  const loadInitialCommits = useCallback(async () => {
    if (!activeRepoPath) {
      setCommits(sampleCommits);
      setHasMore(false);
      if (sampleCommits.length > 0 && !selectedCommitSha) {
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
        setCommits(res);
        setHasMore(res.length === PAGE_SIZE);
      } else {
        setCommits([]);
        setHasMore(false);
      }
    } catch {
      setCommits(sampleCommits);
      setHasMore(false);
    } finally {
      setIsLoadingInitial(false);
    }
  }, [activeRepoPath, setTags]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadInitialCommits();
    }
  }, [activeTab, activeRepoPath, loadInitialCommits]);

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
  const { user, tags } = useGitStore();
  const { verifiedCommits } = useSigningStore();

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
