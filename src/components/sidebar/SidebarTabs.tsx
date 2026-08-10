import React from 'react';
import { useGitStore } from '../../store/useGitStore';

export const SidebarTabs: React.FC = () => {
  const { activeTab, setActiveTab, status } = useGitStore();
  const fileCount = status?.files?.length || 0;

  return (
    <div className="px-2.5 py-1 border-b border-border bg-base-0">
      <div className="flex items-center gap-1 bg-base-2 border border-border rounded-md p-0.5 w-full">
        <button
          type="button"
          onClick={() => setActiveTab('changes')}
          className={`flex-1 py-1 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition cursor-pointer ${activeTab === 'changes'
            ? 'bg-commito-activeBg text-commito-activeText shadow-xs'
            : 'text-text-muted hover:text-text-primary'
            }`}
        >
          Changes ({fileCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition cursor-pointer ${activeTab === 'history'
            ? 'bg-commito-activeBg text-commito-activeText shadow-xs'
            : 'text-text-muted hover:text-text-primary'
            }`}
        >
          History
        </button>
      </div>
    </div>
  );
};
