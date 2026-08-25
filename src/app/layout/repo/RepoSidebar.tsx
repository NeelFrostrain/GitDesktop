import React from 'react';
import { useGitStore } from '../../../store/useGitStore';
import { RepositoryHeader } from '../../../components/sidebar/RepositoryHeader';
import { ChangesPanel } from '../../../components/sidebar/changes/ChangesPanel';
import { CommitPanel } from '../../../components/sidebar/commit/CommitPanel';
import { HistoryPanel } from '../../../components/sidebar/history/HistoryPanel';

export const RepoSidebar: React.FC = () => {
  const { activeTab } = useGitStore();

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-base-0 overflow-hidden select-none">
      <RepositoryHeader />

      {activeTab === 'changes' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <ChangesPanel />
          <CommitPanel />
        </div>
      ) : (
        <HistoryPanel />
      )}
    </div>
  );
};
