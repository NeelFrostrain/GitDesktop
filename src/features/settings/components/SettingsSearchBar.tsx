import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';

interface SettingsSearchBarProps {
  matchCount?: number;
}

export const SettingsSearchBar: React.FC<SettingsSearchBarProps> = ({ matchCount }) => {
  const { searchQuery, setSearchQuery } = useSettingsStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus shortcut on '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative w-56 sm:w-64">
      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-text-muted">
        <Search className="w-3.5 h-3.5" />
      </div>

      <input
        ref={inputRef}
        type="text"
        placeholder="Search settings..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full h-7 pl-8 pr-7 bg-base-0 border border-border rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong transition"
      />

      <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
        {searchQuery ? (
          <div className="flex items-center gap-1.5">
            {matchCount !== undefined && (
              <span className="text-[10px] text-text-muted font-mono bg-base-1 px-1 py-0.2 rounded-xs border border-border">
                {matchCount}
              </span>
            )}
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-0.5 text-text-muted hover:text-text-primary rounded-xs transition cursor-pointer"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <kbd className="w-4 h-4 flex items-center justify-center text-[10px] font-mono text-text-muted bg-base-1 border border-border rounded-xs pointer-events-none select-none">
            /
          </kbd>
        )}
      </div>
    </div>
  );
};
