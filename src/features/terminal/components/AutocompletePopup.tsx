import React from 'react';
import {
  GitBranch,
  Globe,
  FileCode,
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
  position?: { x: number; y: number };
}

const getKindIcon = (kind: AutocompleteKind) => {
  switch (kind) {
    case 'branch':
      return <GitBranch className="w-3 h-3 text-commito-coral" />;
    case 'remote':
      return <Globe className="w-3 h-3 text-gitlab-teal" />;
    case 'file':
      return <FileCode className="w-3 h-3 text-gitlab-blue" />;
    case 'tag':
      return <Tag className="w-3 h-3 text-amber-400" />;
    case 'flag':
      return <Flag className="w-3 h-3 text-purple-400" />;
    case 'stash':
      return <Archive className="w-3 h-3 text-indigo-400" />;
    case 'subcommand':
      return <Layers className="w-3 h-3 text-teal-400" />;
    case 'command':
    default:
      return <Terminal className="w-3 h-3 text-commito-coral" />;
  }
};

const getKindBadge = (kind: AutocompleteKind) => {
  switch (kind) {
    case 'branch':
      return 'bg-commito-coral/15 text-commito-coral border-commito-coral/30';
    case 'remote':
      return 'bg-gitlab-teal/15 text-gitlab-teal border-gitlab-teal/30';
    case 'file':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'tag':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'flag':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'stash':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    default:
      return 'bg-base-3 text-text-muted border-border';
  }
};

export const AutocompletePopup: React.FC<AutocompletePopupProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
}) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="absolute left-6 bottom-10 z-40 w-80 max-h-60 bg-base-1/95 backdrop-blur-md border border-border-strong rounded-lg shadow-2xl overflow-hidden flex flex-col font-sans select-none animate-in fade-in zoom-in-95 duration-100">
      {/* Header bar */}
      <div className="px-2.5 py-1 bg-base-2/80 border-b border-border/80 flex items-center justify-between text-[10px] text-text-muted">
        <span className="font-semibold tracking-wider uppercase text-text-secondary">
          Suggestions ({suggestions.length})
        </span>
        <span className="flex items-center gap-1.5 font-mono">
          <kbd className="px-1 py-0.2 bg-base-3 border border-border rounded text-[9px]">Tab</kbd> Complete
          <kbd className="px-1 py-0.2 bg-base-3 border border-border rounded text-[9px]">Esc</kbd> Close
        </span>
      </div>

      {/* Suggestion list */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/30 max-h-52 p-1">
        {suggestions.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={`${item.kind}-${item.value}-${idx}`}
              type="button"
              onClick={() => onSelect(item)}
              className={`w-full px-2 py-1.5 rounded text-left flex items-center justify-between gap-2 text-xs transition cursor-pointer ${
                isSelected
                  ? 'bg-commito-coral/20 text-text-primary border border-commito-coral/40 font-medium'
                  : 'hover:bg-base-2 text-text-secondary border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="flex-shrink-0">{getKindIcon(item.kind)}</span>
                <span className="truncate font-mono font-medium">{item.text}</span>
                {item.description && (
                  <span className="text-[11px] text-text-muted truncate font-sans">
                    {item.description}
                  </span>
                )}
              </div>

              <span
                className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-mono flex-shrink-0 ${getKindBadge(
                  item.kind
                )}`}
              >
                {item.kind}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
