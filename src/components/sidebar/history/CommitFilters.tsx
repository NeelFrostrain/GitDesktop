import React from 'react';
import { Search, X, Tag, ShieldCheck, User, GitBranch } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { Tabs, TabItem } from '../../common/Tabs';

export type CommitQuickFilter = 'all' | 'mine' | 'signed' | 'tagged';

interface CommitFiltersProps {
  filter: string;
  onFilterChange: (val: string) => void;
  activeQuickFilter?: CommitQuickFilter;
  onQuickFilterChange?: (qf: CommitQuickFilter) => void;
  currentUserEmail?: string;
}

export const CommitFilters: React.FC<CommitFiltersProps> = ({
  filter,
  onFilterChange,
  activeQuickFilter = 'all',
  onQuickFilterChange,
}) => {
  const quickFilterTabs: TabItem<CommitQuickFilter>[] = [
    { id: 'all', label: 'All' },
    { id: 'mine', label: 'Mine', icon: <User className="w-3 h-3" /> },
    { id: 'signed', label: 'Verified', icon: <ShieldCheck className="w-3 h-3 text-git-added" /> },
    { id: 'tagged', label: 'Tagged', icon: <Tag className="w-3 h-3 text-amber-400" /> },
  ];

  return (
    <div className="px-2.5 pt-2 pb-1.5 border-b border-border bg-base-0 select-none space-y-1.5">
      {/* Search Bar & Graph View Toggle */}
      <div className="relative flex items-center gap-1.5">
        <div className="relative flex-1 flex items-center">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none transition-colors" />
          <input
            type="text"
            placeholder="Filter commits..."
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="w-full pl-8 pr-7 py-1 bg-base-1/70 hover:bg-base-1 focus:bg-base-1 border border-border/70 hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text placeholder:text-text-muted focus:outline-none font-sans transition-all duration-150 shadow-2xs"
          />
          {filter && (
            <button
              type="button"
              onClick={() => onFilterChange('')}
              className="absolute right-2 p-0.5 text-text-muted hover:text-text rounded-sm transition-colors cursor-pointer"
              title="Clear filter"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => useGitStore.getState().setCurrentNavView('graph')}
          className="h-6 px-2 bg-base-1/70 hover:bg-base-2 text-text-muted hover:text-text-primary border border-border/80 
          hover:border-border-strong rounded-sm text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs shrink-0"
          title="Open Visual Git Graph Table View"
        >
          <GitBranch className="w-3 h-3 text-commito-coral" />
          <span>Graph</span>
        </button>
      </div>

      {/* Shared Reusable Tabs Component */}
      {onQuickFilterChange && (
        <Tabs<CommitQuickFilter>
          tabs={quickFilterTabs}
          activeTab={activeQuickFilter}
          onChange={onQuickFilterChange}
          size="xs"
          variant="segmented"
          fullWidth
          ariaLabel="Commit quick filters"
        />
      )}
    </div>
  );
};
