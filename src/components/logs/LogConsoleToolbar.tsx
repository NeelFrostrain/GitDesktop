import React from 'react';
import { Search, Filter } from 'lucide-react';
import { LogLevel, LogCategory } from '../../store/useLogStore';
import { Dropdown } from '../common/Dropdown';

interface LogConsoleToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterLevel: 'all' | LogLevel;
  onLevelChange: (level: 'all' | LogLevel) => void;
  filterCategory: 'all' | LogCategory;
  onCategoryChange: (category: 'all' | LogCategory) => void;
  availableCategories: LogCategory[];
}

export const LogConsoleToolbar: React.FC<LogConsoleToolbarProps> = ({
  searchQuery,
  onSearchChange,
  filterLevel,
  onLevelChange,
  filterCategory,
  onCategoryChange,
  availableCategories,
}) => {
  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...availableCategories.map((cat) => ({ value: cat, label: cat })),
  ];

  return (
    <div className="px-4 py-2 bg-base-1 border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0 select-none">
      {/* Search Input matching Changed Files filter */}
      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search logs..."
            className="w-full pl-8 pr-3 py-1 bg-base-0 border border-border hover:border-border-strong rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-border-strong font-sans"
          />
        </div>
      </div>

      {/* Filter Dropdowns */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />

        {/* Level Filter */}
        <Dropdown
          options={[
            { value: 'all', label: 'All Levels' },
            { value: 'success', label: '✓ Success Only' },
            { value: 'error', label: '✕ Errors Only' },
            { value: 'warning', label: '⚠ Warnings Only' },
            { value: 'info', label: '● Info Only' },
          ]}
          value={filterLevel}
          onChange={(val) => onLevelChange(val as any)}
          size="sm"
        />

        {/* Dynamic Category Filter */}
        <Dropdown
          options={categoryOptions}
          value={filterCategory}
          onChange={(val) => onCategoryChange(val as any)}
          size="sm"
        />
      </div>
    </div>
  );
};
