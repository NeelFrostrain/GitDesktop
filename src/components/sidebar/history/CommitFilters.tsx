import React from 'react';
import { Search } from 'lucide-react';

interface CommitFiltersProps {
  filter: string;
  onFilterChange: (val: string) => void;
}

export const CommitFilters: React.FC<CommitFiltersProps> = ({ filter, onFilterChange }) => {
  return (
    <div className="px-2.5 py-1.5 border-b border-border bg-base-0 select-none">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Filter commits by message or SHA..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="w-full pl-8 pr-2.5 py-1 bg-base-1 border border-border rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans transition-colors"
        />
      </div>
    </div>
  );
};
