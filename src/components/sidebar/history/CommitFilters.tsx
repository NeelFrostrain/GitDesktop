import React from 'react';
import { Search, X } from 'lucide-react';

interface CommitFiltersProps {
  filter: string;
  onFilterChange: (val: string) => void;
}

export const CommitFilters: React.FC<CommitFiltersProps> = ({ filter, onFilterChange }) => {
  return (
    <div className="px-2.5 pt-2 pb-2 border-b border-border/40 bg-base-0 select-none">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 pointer-events-none transition-colors" />
        <input
          type="text"
          placeholder="Filter commits by message or SHA..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="w-full pl-8 pr-7 py-1.5 bg-base-1/80 hover:bg-base-1 focus:bg-base-1 border border-border/60 hover:border-border-strong focus:border-border-strong rounded-sm text-xs text-text placeholder:text-text-muted focus:outline-none font-sans transition-all duration-150"
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
    </div>
  );
};
