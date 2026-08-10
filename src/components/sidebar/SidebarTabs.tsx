import React from 'react';
import { useGitStore } from '../../store/useGitStore';

export const SidebarTabs: React.FC = () => {
  const { activeTab, setActiveTab, status } = useGitStore();
  const fileCount = status?.files?.length || 0;

  return (
    <div className="px-3 pt-2 pb-1 border-b border-border">
      <div className="flex items-center gap-1 bg-base-2 border border-border rounded-md p-0.5 w-full">
        <button
          onClick={() => setActiveTab('changes')}
          className={`flex-1 py-1 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition ${
            activeTab === 'changes'
              ? 'bg-commito-activeBg text-commito-activeText shadow-sm'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Changes ({fileCount})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition ${
            activeTab === 'history'
              ? 'bg-commito-activeBg text-commito-activeText shadow-sm'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          History
        </button>
      </div>
    </div>
  );
};
