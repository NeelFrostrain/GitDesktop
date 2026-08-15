import React from 'react';
import { Search, X } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';

interface SettingsSearchBarProps {
  matchCount?: number;
}

export const SettingsSearchBar: React.FC<SettingsSearchBarProps> = ({ matchCount }) => {
  const { searchQuery, setSearchQuery } = useSettingsStore();

  return (
    <div className="relative flex-1 max-w-lg">
      <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        placeholder="Search all settings by name, description, category or CSS variable (e.g. font, accent, diff)..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-9 pr-16 py-1.5 bg-base-2 border border-border rounded-md text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-commito-coral transition"
      />

      {searchQuery && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {matchCount !== undefined && (
            <span className="text-[10px] text-text-muted font-mono bg-base-3 px-1.5 py-0.2 rounded">
              {matchCount} {matchCount === 1 ? 'match' : 'matches'}
            </span>
          )}
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="p-1 text-text-muted hover:text-text-primary rounded cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
