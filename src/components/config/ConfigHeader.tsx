import React from 'react';
import { User, X } from 'lucide-react';

interface ConfigHeaderProps {
  onClose: () => void;
}

export const ConfigHeader: React.FC<ConfigHeaderProps> = ({ onClose }) => {
  return (
    <div className="px-4 py-3 bg-base-1 border-b border-border flex items-center justify-between select-none">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-sm bg-commito-coral/15 border border-commito-coral/30 text-commito-coral flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5" />
        </div>
        <div>
          <h2 className="text-xs font-bold text-text-primary leading-tight">
            Git User Configuration
          </h2>
          <p className="text-[11px] text-text-muted mt-0.5 leading-none">
            Configure the identity used for your commits.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        title="Close (Esc)"
        className="p-1 text-text-muted hover:text-text-primary rounded-sm hover:bg-base-2 transition cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
