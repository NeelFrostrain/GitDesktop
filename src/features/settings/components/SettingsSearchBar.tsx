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
    <div className="relative flex-1 max-w-sm">
      <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search settings..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full h-7 pl-8 pr-16 bg-base-0 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary placeholder:text-text-muted focus:outline-none transition shadow-2xs"
      />

      {searchQuery ? (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {matchCount !== undefined && (
            <span className="text-[10px] text-text-muted font-mono bg-base-1 px-1.5 py-0.2 rounded-xs border border-border">
              {matchCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="p-0.5 text-text-muted hover:text-text-primary rounded-xs transition cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <kbd className="px-1.5 py-0.2 text-[10px] font-mono text-text-muted bg-base-1 border border-border rounded-xs">
            /
          </kbd>
        </div>
      )}
    </div>
  );
};
