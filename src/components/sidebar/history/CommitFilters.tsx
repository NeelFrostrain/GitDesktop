import React from 'react';
import { Search, X, Tag, ShieldCheck, User } from 'lucide-react';

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
  return (
    <div className="px-2.5 pt-2 pb-1.5 border-b border-border/40 bg-base-0 select-none space-y-1.5">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none transition-colors" />
        <input
          type="text"
          placeholder="Filter by message, author, or SHA..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="w-full pl-8 pr-7 py-1 bg-base-1/80 hover:bg-base-1 focus:bg-base-1 border border-border/60 hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text placeholder:text-text-muted focus:outline-none font-sans transition-all duration-150"
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

      {onQuickFilterChange && (
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
          <button
            type="button"
            onClick={() => onQuickFilterChange('all')}
            className={`px-1.5 py-0.5 rounded-xs text-[10px] font-medium transition cursor-pointer ${
              activeQuickFilter === 'all'
                ? 'bg-commito-coral/20 text-commito-coral font-semibold border border-commito-coral/40'
                : 'text-text-muted hover:text-text-primary hover:bg-base-1 border border-transparent'
            }`}
          >
            All
          </button>

          <button
            type="button"
            onClick={() => onQuickFilterChange('mine')}
            className={`px-1.5 py-0.5 rounded-xs text-[10px] font-medium flex items-center gap-1 transition cursor-pointer ${
              activeQuickFilter === 'mine'
                ? 'bg-commito-coral/20 text-commito-coral font-semibold border border-commito-coral/40'
                : 'text-text-muted hover:text-text-primary hover:bg-base-1 border border-transparent'
            }`}
          >
            <User className="w-2.5 h-2.5" />
            <span>Mine</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilterChange('signed')}
            className={`px-1.5 py-0.5 rounded-xs text-[10px] font-medium flex items-center gap-1 transition cursor-pointer ${
              activeQuickFilter === 'signed'
                ? 'bg-git-added/20 text-git-added font-semibold border border-git-added/40'
                : 'text-text-muted hover:text-text-primary hover:bg-base-1 border border-transparent'
            }`}
          >
            <ShieldCheck className="w-2.5 h-2.5" />
            <span>Verified</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilterChange('tagged')}
            className={`px-1.5 py-0.5 rounded-xs text-[10px] font-medium flex items-center gap-1 transition cursor-pointer ${
              activeQuickFilter === 'tagged'
                ? 'bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/40'
                : 'text-text-muted hover:text-text-primary hover:bg-base-1 border border-transparent'
            }`}
          >
            <Tag className="w-2.5 h-2.5" />
            <span>Tagged</span>
          </button>
        </div>
      )}
    </div>
  );
};
