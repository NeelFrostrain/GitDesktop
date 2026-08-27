import React from 'react';
import { UserCheck, X } from 'lucide-react';

interface ConfigHeaderProps {
  onClose: () => void;
  repoName?: string | null;
}

export const ConfigHeader: React.FC<ConfigHeaderProps> = ({ onClose, repoName }) => {
  return (
    <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-base-1 shrink-0 select-none">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-sm bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 border border-commito-coral/30">
          <UserCheck className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-xs font-bold text-text-primary leading-none truncate">
            Git Identity Configuration
          </h3>
          {repoName && (
            <>
              <span className="text-border hidden sm:inline">•</span>
              <span className="text-[11px] text-text-muted truncate hidden sm:inline font-mono">
                {repoName}
              </span>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        title="Close (Esc)"
        className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
