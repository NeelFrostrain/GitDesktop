import React from 'react';
import { GitCommit } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';

interface CommitButtonProps {
  canCommit: boolean;
  isCommitting: boolean;
  onCommit: () => void;
  hasActiveOptions: boolean;
}

export const CommitButton: React.FC<CommitButtonProps> = ({
  canCommit,
  isCommitting,
  onCommit,
  hasActiveOptions,
}) => {
  const { status, stagedFiles } = useGitStore();
  const currentBranch = status?.current_branch || 'main';
  const count = stagedFiles.length;

  return (
    <button
      onClick={onCommit}
      disabled={!canCommit || isCommitting}
      className={`w-full py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm ${
        canCommit
          ? 'bg-commito-coral hover:bg-commito-coralHover text-white cursor-pointer'
          : 'bg-base-2 text-text-muted cursor-not-allowed border border-border'
      }`}
    >
      <GitCommit className="w-3.5 h-3.5" />
      <span>
        Commit {count > 0 ? `${count} file${count > 1 ? 's' : ''}` : ''} to {currentBranch}
      </span>
      {hasActiveOptions && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"
          title="Custom commit options active"
        />
      )}
    </button>
  );
};
