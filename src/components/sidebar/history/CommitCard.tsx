import React, { useEffect } from 'react';
import { GitMerge, GitCommit, ShieldCheck, ShieldAlert } from 'lucide-react';
import { CommitInfo } from '../../../types/git';
import { UserAvatar } from '../../common/UserAvatar';
import { useSigningStore } from '../../../store/signingStore';
import { useGitStore } from '../../../store/useGitStore';

interface CommitCardProps {
  commit: CommitInfo;
  isSelected: boolean;
  isDragging: boolean;
  isTarget: boolean;
  dropZone: 'before' | 'after' | 'merge' | null;
  onMouseDown: (e: React.MouseEvent, c: CommitInfo) => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent, c: CommitInfo) => void;
}

export const CommitCard: React.FC<CommitCardProps> = ({
  commit,
  isSelected,
  isDragging,
  isTarget,
  dropZone,
  onMouseDown,
  onClick,
  onContextMenu,
}) => {
  const { activeRepoPath } = useGitStore();
  const { verifiedCommits, verifyCommit } = useSigningStore();
  const verification = verifiedCommits[commit.sha];

  useEffect(() => {
    if (activeRepoPath && !verification && commit.sha) {
      verifyCommit(activeRepoPath, commit.sha);
    }
  }, [activeRepoPath, commit.sha, verification, verifyCommit]);

  const renderSigningBadge = () => {
    if (!verification || verification.status === 'NoSignature') return null;

    if (verification.status === 'Verified') {
      const signer = typeof verification.details === 'object' ? verification.details.signer : '';
      return (
        <span
          title={`Verified commit (Signed by ${signer || 'GPG/SSH key'})`}
          className="flex items-center gap-0.5 text-git-added font-mono text-[9px] bg-git-added-bg border border-git-added/40 px-1 py-0.2 rounded"
        >
          <ShieldCheck className="w-2.5 h-2.5" />
          <span>Verified</span>
        </span>
      );
    }

    if (verification.status === 'Unverified') {
      const reason = typeof verification.details === 'object' ? verification.details.reason : '';
      return (
        <span
          title={`Unverified signature: ${reason || 'Untrusted or expired key'}`}
          className="flex items-center gap-0.5 text-git-modified font-mono text-[9px] bg-git-modified-bg border border-git-modified/40 px-1 py-0.2 rounded"
        >
          <ShieldAlert className="w-2.5 h-2.5" />
          <span>Unverified</span>
        </span>
      );
    }

    return null;
  };

  return (
    <div
      data-commit-sha={commit.sha}
      onMouseDown={(e) => onMouseDown(e, commit)}
      onClick={onClick}
      onContextMenu={(e) => onContextMenu(e, commit)}
      className={`p-2.5 rounded-sm cursor-pointer transition-all border relative select-none ${
        isDragging
          ? 'opacity-40 border-dashed border-commito-coral scale-[0.98]'
          : isTarget && dropZone === 'merge'
          ? 'bg-commito-coral/20 border-commito-coral text-commito-coral shadow-lg ring-1 ring-commito-coral/50'
          : isSelected
          ? 'bg-commito-activeBg border-commito-activeText/30 text-commito-activeText shadow-sm'
          : 'bg-base-2/60 border-border/60 hover:bg-base-2 hover:border-border text-text-primary'
      }`}
    >
      {/* Top Border Line Indicator for Drop Before */}
      {isTarget && dropZone === 'before' && (
        <div className="absolute inset-x-0 -top-1 h-1 bg-commito-coral rounded-full shadow-[0_0_8px_rgba(255,107,107,0.9)] z-20 pointer-events-none flex items-center justify-center">
          <span className="px-2 py-0.5 text-[9px] font-extrabold text-white bg-commito-coral rounded-full shadow-md -translate-y-2 uppercase tracking-wider">
            MOVE ABOVE
          </span>
        </div>
      )}

      {/* Bottom Border Line Indicator for Drop After */}
      {isTarget && dropZone === 'after' && (
        <div className="absolute inset-x-0 -bottom-1 h-1 bg-commito-coral rounded-full shadow-[0_0_8px_rgba(255,107,107,0.9)] z-20 pointer-events-none flex items-center justify-center">
          <span className="px-2 py-0.5 text-[9px] font-extrabold text-white bg-commito-coral rounded-full shadow-md translate-y-2 uppercase tracking-wider">
            MOVE BELOW
          </span>
        </div>
      )}

      {/* Card Header & Content */}
      <div className="flex items-start justify-between gap-2 mb-1 pointer-events-none">
        <h4 className="text-xs font-bold truncate leading-snug flex-1">{commit.message}</h4>
        <div className="flex items-center gap-1 flex-shrink-0">
          {renderSigningBadge()}
          <div className="flex items-center gap-1 px-1.5 py-0.2 bg-base-3 border border-border rounded-sm text-[10px] font-mono text-text-muted">
            <GitCommit className="w-2.5 h-2.5 text-commito-coral" />
            <span>{commit.short_sha}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-text-muted mt-1.5 pointer-events-none">
        <div className="flex items-center gap-1.5 truncate">
          <UserAvatar
            name={commit.author_name}
            email={commit.author_email}
            className="w-4 h-4 rounded-full ring-1 ring-border/50"
            iconClassName="w-2.5 h-2.5"
          />
          <span className="truncate font-medium text-text-secondary">{commit.author_name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {commit.additions !== undefined && commit.deletions !== undefined && (commit.additions > 0 || commit.deletions > 0) && (
            <div className="flex items-center gap-1 font-mono text-[9px] font-semibold">
              <span className="text-git-added">+{commit.additions}</span>
              <span className="text-git-removed">-{commit.deletions}</span>
            </div>
          )}
          <span className="font-mono text-[10px] text-text-faint">{commit.relative_date}</span>
        </div>
      </div>

      {/* Drop to Merge Overlay */}
      {isTarget && dropZone === 'merge' && (
        <div className="absolute inset-0 bg-commito-coral/90 border-2 border-commito-coral rounded-sm flex items-center justify-center gap-1.5 text-[10px] font-extrabold text-white uppercase tracking-wider z-20 pointer-events-none shadow-lg">
          <GitMerge className="w-3.5 h-3.5" />
          <span>DROP TO MERGE COMMITS</span>
        </div>
      )}
    </div>
  );
};
