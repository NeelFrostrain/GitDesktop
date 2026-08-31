import React from 'react';
import { RotateCcw } from 'lucide-react';

interface CommitActionsProps {
  isVisible: boolean;
  onClear: () => void;
}

export const CommitActions: React.FC<CommitActionsProps> = ({ isVisible, onClear }) => {
  if (!isVisible) return null;

  return (
    <button
      type="button"
      onClick={onClear}
      title="Clear Commit Message"
      className="p-1 rounded-sm text-text-muted hover:text-git-removed hover:bg-base-2 transition cursor-pointer text-xs flex items-center justify-center"
    >
      <RotateCcw className="w-3.5 h-3.5" />
    </button>
  );
};
