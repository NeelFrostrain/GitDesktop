import React from 'react';
import { useGitStore } from '../../store/useGitStore';

export const SidebarTabs: React.FC = () => {
  const { activeTab, setActiveTab, status } = useGitStore();
  const fileCount = status?.files?.length || 0;

  return (
    <div className="px-2.5 py-1.5 border-b border-border bg-base-0 select-none">
      <div className="flex items-center bg-base-1 border border-border rounded-sm p-0.5 w-full gap-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('changes')}
          className={`flex-1 py-1 px-2 text-xs font-semibold rounded-sm flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${
            activeTab === 'changes'
              ? 'bg-base-2 text-text-primary shadow-xs border border-border-strong/70'
              : 'text-text-muted hover:text-text-primary hover:bg-base-2/50 border border-transparent'
          }`}
        >
          <span>Changes</span>
          <span
            className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-sm text-[10px] font-mono leading-none text-center transition-colors ${
              fileCount > 0
                ? activeTab === 'changes'
                  ? 'bg-commito-coral text-white font-bold'
                  : 'bg-commito-coral/15 text-commito-coral font-semibold border border-commito-coral/25'
                : 'bg-base-0 text-text-muted border border-border/60'
            }`}
          >
            {fileCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1 px-2 text-xs font-semibold rounded-sm flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-base-2 text-text-primary shadow-xs border border-border-strong/70'
              : 'text-text-muted hover:text-text-primary hover:bg-base-2/50 border border-transparent'
          }`}
        >
          <span>History</span>
        </button>
      </div>
    </div>
  );
};
