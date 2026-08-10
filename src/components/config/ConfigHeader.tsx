import React from 'react';
import { User, X } from 'lucide-react';

interface ConfigHeaderProps {
  onClose: () => void;
}

export const ConfigHeader: React.FC<ConfigHeaderProps> = ({ onClose }) => {
  return (
    <div className="px-4 py-3 bg-base-0 border-b border-border flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-commito-coral/20 border border-commito-coral/40 text-commito-coral flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5" />
        </div>
        <div>
          <h2 className="text-xs font-bold text-text-primary leading-tight">
            Git User Configuration
          </h2>
          <p className="text-[10px] text-text-muted">
            Configure the identity used for your commits.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        title="Close dialog"
        className="p-1 text-text-muted hover:text-text-primary rounded-md hover:bg-base-2 transition cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
