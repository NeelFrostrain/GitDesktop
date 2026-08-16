import React from 'react';
import { useGitStore } from '../../../store/useGitStore';
import { UserAvatar } from '../../common/UserAvatar';

interface CommitMessageFormProps {
  summary: string;
  onSummaryChange: (val: string) => void;
  description: string;
  onDescriptionChange: (val: string) => void;
  children?: React.ReactNode;
}

export const CommitMessageForm: React.FC<CommitMessageFormProps> = ({
  summary,
  onSummaryChange,
  description,
  onDescriptionChange,
  children,
}) => {
  const { user, setIsUserConfigModalOpen } = useGitStore();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsUserConfigModalOpen(true)}
          title="Configure Git User Identity & Avatar"
          className="rounded-full hover:ring-2 hover:ring-commito-coral/50 transition cursor-pointer flex-shrink-0"
        >
          <UserAvatar
            url={user?.avatar_url}
            name={user?.name || user?.username}
            provider={user?.provider}
            className="w-7 h-7"
            iconClassName="w-3.5 h-3.5"
          />
        </button>
        <input
          type="text"
          placeholder="Summary (required)"
          value={summary}
          onChange={(e) => onSummaryChange(e.target.value)}
          className="flex-1 px-2.5 py-1.5 bg-base-0 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
        />
      </div>

      {/* Unified Description Card Input Container */}
      <div className="bg-base-0 border border-border rounded-md focus-within:border-commito-coral/50 transition flex flex-col overflow-hidden">
        <textarea
          placeholder="Description"
          rows={4}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-transparent text-xs text-text-primary placeholder-text-muted focus:outline-none resize-y min-h-[48px] max-h-[160px] font-sans"
        />
        {children && (
          <div className="px-2 py-1 bg-base-0 border-border/30 flex items-center justify-start gap-1.5">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
