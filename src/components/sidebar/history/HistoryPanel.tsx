import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CommitInfo } from '../../../types/git';
import { useGitStore } from '../../../store/useGitStore';
import { CommitFilters } from './CommitFilters';
import { CommitList } from './CommitList';

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


export const HistoryPanel: React.FC = () => {
  const [commitFilter, setCommitFilter] = useState('');
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const { activeTab, activeRepoPath, selectedCommitSha, setSelectedCommitSha } = useGitStore();

  useEffect(() => {
    if (activeTab !== 'history') return;

    if (!activeRepoPath) {
      setCommits(sampleCommits);
      if (sampleCommits.length > 0 && !selectedCommitSha) {
        setSelectedCommitSha(sampleCommits[0].sha);
      }
      return;
    }

    invoke<CommitInfo[]>('get_commit_history', { repoPath: activeRepoPath, limit: 50, offset: 0 })
      .then((res) => {
        if (res && res.length > 0) {
          setCommits(res);
          if (!selectedCommitSha) setSelectedCommitSha(res[0].sha);
        } else {
          setCommits(sampleCommits);
        }
      })
      .catch(() => {
        setCommits(sampleCommits);
      });
  }, [activeTab, activeRepoPath]);

  const filteredCommits = commits.filter(
    (c) =>
      c.message.toLowerCase().includes(commitFilter.toLowerCase()) ||
      c.author_name.toLowerCase().includes(commitFilter.toLowerCase()) ||
      c.short_sha.toLowerCase().includes(commitFilter.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <CommitFilters filter={commitFilter} onFilterChange={setCommitFilter} />
      <CommitList commits={filteredCommits} />
    </div>
  );
};
