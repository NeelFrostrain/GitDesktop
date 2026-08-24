import React, { useState } from 'react';
import { AlignJustify, Columns, ShieldCheck, ShieldAlert, GitCommit, Clock } from 'lucide-react';
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
 * Header card for Commit details in History view, displaying author, verification status, and stats.
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

  return (
    <div className="p-3 bg-base-2 border-b border-border space-y-2.5 flex-shrink-0">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xs font-semibold text-text-primary truncate" title={commitTitle}>
          {commitTitle}
        </h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center bg-base-0 border border-border rounded-md p-0.5">
            <button
              type="button"
              onClick={() => onChangeViewMode('unified')}
              className={`p-1 rounded text-xs transition cursor-pointer ${diffViewMode === 'unified'
                ? 'bg-base-2 text-text-primary shadow-xs'
                : 'text-text-muted hover:text-text-primary'
                }`}
              title="Unified View"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('split')}
              className={`p-1 rounded text-xs transition cursor-pointer ${diffViewMode === 'split'
                ? 'bg-base-2 text-text-primary shadow-xs'
                : 'text-text-muted hover:text-text-primary'
                }`}
              title="Split (Side-by-Side) View"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {verification && verification.status === 'Verified' && (
              <span
                title={`Cryptographically verified commit (Signed by ${
                  typeof verification.details === 'object' ? verification.details?.signer || 'GPG/SSH' : 'GPG/SSH'
                })`}
                className="flex items-center gap-1 text-git-added font-mono text-[11px] bg-git-added-bg border border-git-added/40 px-2 py-0.5 rounded-md font-medium"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified</span>
              </span>
            )}
            {verification && verification.status === 'Unverified' && (
              <span
                title="Unverified commit signature"
                className="flex items-center gap-1 text-git-modified font-mono text-[11px] bg-git-modified-bg border border-git-modified/40 px-2 py-0.5 rounded-md font-medium"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Unverified</span>
              </span>
            )}

            <CopyButton text={commitDetails.commit.sha} label="SHA" />
            <CopyButton text={commitDetails.commit.message} label="Msg" />
          </div>
        </div>
      </div>

      {/* Author & Commit Info Bar */}
      <div className="flex items-center justify-between text-[11px] bg-base-1 px-2.5 py-1.5 rounded-md border border-border/80 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar
            name={commitDetails.commit.author_name}
            email={commitDetails.commit.author_email}
            className="w-4 h-4 rounded-full ring-1 ring-border/60 flex-shrink-0"
            iconClassName="w-2.5 h-2.5"
          />
          <span className="font-semibold text-text-primary truncate">{commitDetails.commit.author_name}</span>

          {/* Commit node badge */}
          <div className="flex items-center gap-1 text-text-muted font-mono text-[10px] px-1.5 py-0.2 rounded bg-base-2 border border-border/60">
            <GitCommit className="w-3 h-3 text-commito-coral flex-shrink-0" />
            <span className="font-semibold text-text-secondary">{commitDetails.commit.short_sha}</span>
            <CopyButton
              text={commitDetails.commit.sha}
              className="p-0.5 border-0 bg-transparent hover:bg-base-3 text-[9px]"
            />
          </div>

          <div className="flex items-center gap-1 text-text-faint">
            <Clock className="w-3 h-3" />
            <span>{commitDetails.commit.relative_date}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono font-bold text-xs flex-shrink-0">
          {(commitDetails.total_additions !== undefined || commitDetails.commit.additions !== undefined) && (
            <span className="text-git-added">
              +{commitDetails.total_additions ?? commitDetails.commit.additions ?? 0}
            </span>
          )}
          {(commitDetails.total_deletions !== undefined || commitDetails.commit.deletions !== undefined) && (
            <span className="text-git-removed">
              -{commitDetails.total_deletions ?? commitDetails.commit.deletions ?? 0}
            </span>
          )}

          {commitBody && (
            <button
              onClick={() => setShowCommitBody(!showCommitBody)}
              className="text-[11px] text-commito-coral hover:underline font-medium font-sans ml-1 cursor-pointer"
            >
              {showCommitBody ? 'Hide Details' : 'Show Details'}
            </button>
          )}
        </div>
      </div>

      {commitBody && showCommitBody && (
        <div className="p-2 bg-base-0 border border-border rounded-md text-[11px] text-text-muted max-h-28 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
          {commitBody}
        </div>
      )}
    </div>
  );
};
