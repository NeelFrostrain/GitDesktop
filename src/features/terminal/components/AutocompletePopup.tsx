import React, { useEffect, useRef } from 'react';
import {
  GitBranch,
  Globe,
  File,
  Tag,
  Flag,
  Terminal,
  Archive,
  Layers,
} from 'lucide-react';
import { AutocompleteSuggestion, AutocompleteKind } from '../types';

interface AutocompletePopupProps {
  suggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: AutocompleteSuggestion) => void;
  position?: { x: number; y: number } | null;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

const getKindIcon = (kind: AutocompleteKind) => {
  switch (kind) {
    case 'branch':
      return <GitBranch className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />;
    case 'remote':
      return <Globe className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
    case 'file':
      return <File className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
    case 'tag':
      return <Tag className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
    case 'flag':
      return <Flag className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
    case 'stash':
      return <Archive className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />;
    case 'subcommand':
      return <Layers className="w-3.5 h-3.5 text-gitlab-teal flex-shrink-0" />;
    case 'command':
    default:
      return <Terminal className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />;
  }
};

export const AutocompletePopup: React.FC<AutocompletePopupProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  position,
  containerRef,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll selected item into view inside the popup
  useEffect(() => {
    if (typeof selectedItemRef.current?.scrollIntoView === 'function') {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (suggestions.length === 0) return null;

  // Popup dimensions & clamping calculation
  const popupWidth = 420;
  const estimatedHeight = Math.min(suggestions.length * 38 + 32, 240);

  let left = 16;
  let top = 16;

  if (position && containerRef?.current) {
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Clamp horizontal position so it never overflows left or right
    left = Math.max(8, Math.min(position.x, containerWidth - popupWidth - 12));

    // Vertical positioning: check if there's enough space below cursor
    if (position.y + estimatedHeight > containerHeight - 8) {
      // Flip above cursor line
      top = Math.max(4, position.y - 20 - estimatedHeight);
    } else {
      // Render directly below cursor line
      top = Math.max(4, position.y);
    }
  }

  return (
    <div
      style={{ left: `${left}px`, top: `${top}px` }}
      className="absolute z-50 w-[420px] max-h-[260px] bg-base-2 border border-border shadow-2xl rounded-xl overflow-hidden flex flex-col font-sans select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header bar */}
      <div className="px-3 py-1.5 bg-base-1 border-b border-border flex items-center justify-between text-[10px] text-text-muted flex-shrink-0">
        <span className="font-bold tracking-wider uppercase text-text-secondary">
          Suggestions ({suggestions.length})
        </span>
        <span className="flex items-center gap-2 font-mono">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.2 bg-base-3 border border-border rounded text-[9px] text-text-primary">
              Tab
            </kbd>
            <span>Complete</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.2 bg-base-3 border border-border rounded text-[9px] text-text-primary">
              Esc
            </kbd>
            <span>Close</span>
          </span>
        </span>
      </div>

      {/* Suggestion list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto max-h-[220px] p-1 space-y-0.5 scrollbar-thin scrollbar-thumb-base-3"
      >
        {suggestions.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={`${item.kind}-${item.value}-${idx}`}
              ref={isSelected ? selectedItemRef : null}
              type="button"
              onClick={() => onSelect(item)}
              className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between gap-3 text-xs transition cursor-pointer ${
                isSelected
                  ? 'bg-commito-coral/15 text-text-primary border-l-2 border-commito-coral font-medium shadow-xs'
                  : 'hover:bg-white/[0.04] text-text-secondary hover:text-text-primary border-l-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {getKindIcon(item.kind)}

                {/* Command / token name: Never truncated */}
                <span className="font-mono font-semibold text-text-primary flex-shrink-0 text-xs">
                  {item.text}
                </span>

                {/* Description: Truncates gracefully if constrained */}
                {item.description && (
                  <span className="text-[11px] text-text-muted truncate font-sans min-w-0 flex-1">
                    {item.description}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
