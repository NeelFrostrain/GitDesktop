import React from 'react';
import { Layers, ChevronRight } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';

export const StashedChangesSidebarItem: React.FC = () => {
  const { currentBranchStash, stashFiles, isViewingStashedChanges, setIsViewingStashedChanges } = useGitStore();

  if (!currentBranchStash) return null;

  const count = stashFiles?.length || 0;

  return (
    <div className="px-2 py-1.5 border-t border-border bg-base-0 flex-shrink-0 select-none">
      <button
        type="button"
        onClick={() => setIsViewingStashedChanges(!isViewingStashedChanges)}
        className={`w-full py-2 px-2 rounded-sm text-xs font-semibold flex items-center justify-between transition cursor-pointer border shadow-xs ${
          isViewingStashedChanges
            ? 'bg-commito-coral text-white border-commito-coral shadow-sm ring-1 ring-commito-coral/40'
            : 'bg-base-1 hover:bg-base-2 text-text-primary border-border hover:border-border-strong'
        }`}
        title={`Stashed changes on this branch (${currentBranchStash.date}). Click to inspect or restore.`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Layers className={`w-3.5 h-3.5 flex-shrink-0 ${isViewingStashedChanges ? 'text-white' : 'text-commito-coral'}`} />
          <span className="truncate tracking-tight font-medium text-xs">Stashed Changes</span>
          {count > 0 && (
            <span
              className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-sm text-[10px] font-mono font-bold leading-none border ${
                isViewingStashedChanges
                  ? 'bg-white/20 border-white/30 text-white'
                  : 'bg-base-0 border-border text-text-muted'
              }`}
            >
              {count}
            </span>
          )}
        </div>
        <ChevronRight
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
            isViewingStashedChanges ? 'rotate-90 text-white' : 'text-text-muted'
          }`}
        />
      </button>
    </div>
  );
};
