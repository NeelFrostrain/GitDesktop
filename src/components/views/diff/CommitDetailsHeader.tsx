import React, { useState } from 'react';
import {
  AlignJustify,
  Columns,
  ShieldCheck,
  ShieldAlert,
  GitCommit,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { CommitDetails } from '../../../types/git';
import { useSigningStore } from '../../../store/signingStore';
import { UserAvatar } from '../../common/UserAvatar';
import { CopyButton } from './diffUtils';

interface CommitDetailsHeaderProps {
  commitDetails: CommitDetails;
  diffViewMode: 'unified' | 'split';
  onChangeViewMode: (mode: 'unified' | 'split') => void;
}

/**
 * Redesigned commit metadata header — clean, minimal, information-dense without feeling cluttered.
 */
export const CommitDetailsHeader: React.FC<CommitDetailsHeaderProps> = ({
  commitDetails,
  diffViewMode,
  onChangeViewMode,
}) => {
  const [showCommitBody, setShowCommitBody] = useState(false);

  const fullMessage = commitDetails.commit.message || '';
  const firstNewlineIndex = fullMessage.indexOf('\n');
  const commitTitle = firstNewlineIndex !== -1 ? fullMessage.substring(0, firstNewlineIndex).trim() : fullMessage;
  const commitBody = firstNewlineIndex !== -1 ? fullMessage.substring(firstNewlineIndex + 1).trim() : '';

  const verification = useSigningStore.getState().verifiedCommits[commitDetails.commit.sha];

  const additions = commitDetails.total_additions ?? commitDetails.commit.additions ?? 0;
  const deletions = commitDetails.total_deletions ?? commitDetails.commit.deletions ?? 0;

  return (
    <div className="bg-base-2 border-b border-border flex-shrink-0">
      {/* Row 1: Commit title + controls */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-4">
        <h2 className="text-xs font-semibold text-text-primary leading-snug" title={commitTitle}>
          {commitTitle}
        </h2>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* View mode toggle */}
          <div className="flex items-center bg-base-1 border border-border rounded-sm p-0.5">
            <button
              type="button"
              onClick={() => onChangeViewMode('unified')}
              className={`w-5 h-5 flex items-center justify-center rounded text-xs transition cursor-pointer ${diffViewMode === 'unified'
                ? 'bg-base-3 text-text-primary'
                : 'text-text-muted hover:text-text-primary'
                }`}
              title="Unified View"
            >
              <AlignJustify className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('split')}
              className={`w-5 h-5 flex items-center justify-center rounded text-xs transition cursor-pointer ${diffViewMode === 'split'
                ? 'bg-base-3 text-text-primary'
                : 'text-text-muted hover:text-text-primary'
                }`}
              title="Split View"
            >
              <Columns className="w-3 h-3" />
            </button>
          </div>

          {/* Copy buttons — same h-6 as the toggle buttons */}
          <CopyButton text={commitDetails.commit.sha} label="SHA" className="!h-6 !px-2 !py-0" />
          <CopyButton text={commitDetails.commit.message} label="Msg" className="!h-6 !px-2 !py-0" />

          {/* Verification badge */}
          {verification?.status === 'Verified' && (
            <span
              title="Cryptographically verified"
              className="flex items-center gap-1 text-git-added text-[11px] bg-git-added/8 border border-git-added/20 px-1.5 py-0.5 rounded-sm font-medium"
            >
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          )}
          {verification?.status === 'Unverified' && (
            <span
              title="Unverified signature"
              className="flex items-center gap-1 text-git-modified text-[11px] bg-git-modified/8 border border-git-modified/20 px-1.5 py-0.5 rounded-sm font-medium"
            >
              <ShieldAlert className="w-3 h-3" />
              Unverified
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Author meta bar */}
      <div className="px-4 pb-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-0.5 min-w-0 text-[11px] text-text-muted">
          {/* Avatar + name */}
          <div className="flex items-center gap-1.5 min-w-0 mr-5">
            <UserAvatar
              name={commitDetails.commit.author_name}
              email={commitDetails.commit.author_email}
              className="w-4 h-4 rounded-full ring-1 ring-border/50 flex-shrink-0"
              iconClassName="w-2.5 h-2.5"
            />
            <span className="font-medium text-text-secondary truncate">
              {commitDetails.commit.author_name}
            </span>
          </div>

          {/* Divider */}
          <span className="text-border select-none">·</span>

          {/* SHA badge */}
          <div className="inline-flex items-center gap-1 font-mono text-[10px] text-text-muted bg-base-1 border border-border/60 px-1.5 h-6 rounded-sm flex-shrink-0">
            <GitCommit className="w-2.5 h-2.5 text-commito-coral flex-shrink-0" />
            <span>{commitDetails.commit.short_sha}</span>
            <CopyButton
              text={commitDetails.commit.sha}
              className="!p-0 !px-0.5 !py-0 !border-0 !bg-transparent hover:!bg-base-2 !text-[9px] !leading-none"
            />
          </div>

          {/* Divider */}
          <span className="text-border select-none">·</span>

          {/* Time */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Clock className="w-3 h-3" />
            <span>{commitDetails.commit.relative_date}</span>
          </div>
        </div>

        {/* Diff stats + expand body */}
        <div className="flex items-center gap-2.5 flex-shrink-0 text-[11px] font-mono font-semibold">
          {additions > 0 && (
            <span className="text-git-added">+{additions}</span>
          )}
          {deletions > 0 && (
            <span className="text-git-removed">-{deletions}</span>
          )}

          {commitBody && (
            <button
              onClick={() => setShowCommitBody(!showCommitBody)}
              className="flex items-center gap-0.5 text-[11px] text-text-muted hover:text-text-primary font-sans font-medium transition cursor-pointer ml-1"
            >
              <span>{showCommitBody ? 'Hide' : 'Details'}</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showCommitBody ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Expandable commit body */}
      {commitBody && showCommitBody && (
        <div className="mx-4 mb-2.5 p-2.5 bg-base-1 border border-border rounded-sm text-[11px] text-text-muted max-h-28 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
          {commitBody}
        </div>
      )}
    </div>
  );
};
