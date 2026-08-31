import { useShallow } from 'zustand/react/shallow';
import { useGitStore } from '../../../store/useGitStore';
import { RepositoryHeader } from '../../../components/sidebar/RepositoryHeader';
import { ChangesPanel } from '../../../components/sidebar/changes/ChangesPanel';
import { StashedFileListPanel } from '../../../components/sidebar/changes/StashedFileListPanel';
import { StashedChangesSidebarItem } from '../../../components/sidebar/changes/StashedChangesSidebarItem';
import { CommitPanel } from '../../../components/sidebar/commit/CommitPanel';
import { HistoryPanel } from '../../../components/sidebar/history/HistoryPanel';

export const RepoSidebar: React.FC = () => {
  const { activeTab, isViewingStashedChanges, currentBranchStash } = useGitStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      isViewingStashedChanges: s.isViewingStashedChanges,
      currentBranchStash: s.currentBranchStash,
    }))
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-base-0 overflow-hidden select-none">
      <RepositoryHeader />

      {activeTab === 'changes' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {isViewingStashedChanges && currentBranchStash ? (
            <StashedFileListPanel />
          ) : (
            <ChangesPanel />
          )}
          <StashedChangesSidebarItem />
          <CommitPanel />
        </div>
      ) : (
        <HistoryPanel />
      )}
    </div>
  );
};
