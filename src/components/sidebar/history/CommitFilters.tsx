import React from 'react';
import { Search } from 'lucide-react';

interface CommitFiltersProps {
  filter: string;
  onFilterChange: (val: string) => void;
}

export const CommitFilters: React.FC<CommitFiltersProps> = ({ filter, onFilterChange }) => {
  return (
    <div className="p-3 border-b border-border">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
        <input
          type="text"
          placeholder="Filter commits by message or SHA..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-base-1 border border-border rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
        />
      </div>
    </div>
  );
};
