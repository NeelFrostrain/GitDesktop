import React from 'react';
import { Search, Download, Trash2, X, CheckSquare, Square } from 'lucide-react';
import { LogCategory, LogFilter, LogLevel } from '../../../core/logging';

interface LogFilterBarProps {
  filter: LogFilter;
  onChange: (patch: Partial<LogFilter>) => void;
  onClear: () => void;
  onExport: () => void;
  activeRepoId?: string | null;
}

const ALL_CATEGORIES: LogCategory[] = [
  'Git',
  'Account',
  'Remote',
  'Signing',
  'Activity',
  'Repo',
  'Terminal',
  'App',
];

const ALL_LEVELS: LogLevel[] = ['Debug', 'Info', 'Success', 'Warn', 'Error'];

export const LogFilterBar: React.FC<LogFilterBarProps> = ({
  filter,
  onChange,
  onClear,
  onExport,
  activeRepoId,
}) => {
  const selectedCats = filter.categories || [];
  const selectedLevels = filter.levels || [];

  const toggleCategory = (cat: LogCategory) => {
    if (selectedCats.includes(cat)) {
      onChange({ categories: selectedCats.filter((c) => c !== cat) });
    } else {
      onChange({ categories: [...selectedCats, cat] });
    }
  };

  const toggleLevel = (lvl: LogLevel) => {
    if (selectedLevels.includes(lvl)) {
      onChange({ levels: selectedLevels.filter((l) => l !== lvl) });
    } else {
      onChange({ levels: [...selectedLevels, lvl] });
    }
  };

  const clearAllFilters = () => {
    onChange({
      categories: [],
      levels: [],
      search: '',
      this_repo_only: false,
    });
  };

  const hasActiveFilters =
    selectedCats.length > 0 ||
    selectedLevels.length > 0 ||
    Boolean(filter.search) ||
    filter.this_repo_only;

  return (
    <div className="p-3 bg-base-1 border-b border-border space-y-2.5 flex-shrink-0 text-xs select-none">
      {/* Top row: Search input + Actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search logs by message or metadata..."
            value={filter.search || ''}
            onChange={(e) => onChange({ search: e.target.value })}
            className="w-full pl-8 pr-7 py-1 bg-base-2 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
          />
          {filter.search && (
            <button
              onClick={() => onChange({ search: '' })}
              className="absolute right-2 top-1.5 text-text-muted hover:text-text-primary p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* This repo only toggle if repo is active */}
        {activeRepoId && (
          <button
            onClick={() => onChange({ this_repo_only: !filter.this_repo_only })}
            className={`px-2.5 py-1 rounded-md border text-xs flex items-center gap-1.5 transition cursor-pointer ${
              filter.this_repo_only
                ? 'bg-commito-coral/15 border-commito-coral/40 text-commito-coral font-medium'
                : 'bg-base-2 border-border text-text-muted hover:text-text-primary'
            }`}
            title="Filter logs specifically tied to this repository"
          >
            {filter.this_repo_only ? (
              <CheckSquare className="w-3.5 h-3.5 text-commito-coral" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            <span>This repo only</span>
          </button>
        )}

        <button
          onClick={onExport}
          className="px-2.5 py-1 bg-base-2 hover:bg-base-3 border border-border rounded-md text-text-primary flex items-center gap-1.5 transition cursor-pointer"
          title="Export logs to file"
        >
          <Download className="w-3.5 h-3.5 text-text-muted" />
          <span>Export</span>
        </button>

        <button
          onClick={onClear}
          className="px-2.5 py-1 bg-base-2 hover:bg-git-removed-bg hover:border-git-removed/40 border border-border rounded-md text-text-muted hover:text-git-removed flex items-center gap-1.5 transition cursor-pointer"
          title="Clear log store"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="px-2 py-1 text-commito-coral hover:underline font-medium cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Category Pills Row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mr-1">
          Category:
        </span>
        {ALL_CATEGORIES.map((cat) => {
          const isSelected = selectedCats.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition cursor-pointer ${
                isSelected
                  ? 'bg-base-3 border-commito-coral/60 text-text-primary shadow-xs'
                  : 'bg-base-2 border-border/70 text-text-muted hover:text-text-primary hover:bg-base-3/60'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Level Pills Row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mr-1">
          Level:
        </span>
        {ALL_LEVELS.map((lvl) => {
          const isSelected = selectedLevels.includes(lvl);
          return (
            <button
              key={lvl}
              onClick={() => toggleLevel(lvl)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition cursor-pointer ${
                isSelected
                  ? 'bg-base-3 border-text-muted text-text-primary shadow-xs font-semibold'
                  : 'bg-base-2 border-border/70 text-text-muted hover:text-text-primary hover:bg-base-3/60'
              }`}
            >
              {lvl}
            </button>
          );
        })}
      </div>
    </div>
  );
};
