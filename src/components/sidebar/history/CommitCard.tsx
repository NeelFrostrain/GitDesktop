import React, { useEffect } from 'react';
import { GitMerge, GitCommit, ShieldCheck, ShieldAlert, Tag } from 'lucide-react';
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
  const { activeRepoPath, tags } = useGitStore();
  const { verifiedCommits, verifyCommit } = useSigningStore();
  const verification = verifiedCommits[commit.sha];

  // Match any tags pointing to this commit
  const commitTags = tags.filter(
    (t) =>
      t.sha &&
      (t.sha === commit.sha ||
        commit.sha.startsWith(t.sha) ||
        t.sha.startsWith(commit.short_sha))
  );

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
          className="flex items-center gap-0.5 text-git-added font-mono text-[9px] bg-git-added-bg border border-git-added/40 px-1 py-0.2 rounded-xs"
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
          className="flex items-center gap-0.5 text-git-modified font-mono text-[9px] bg-git-modified-bg border border-git-modified/40 px-1 py-0.2 rounded-xs"
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
      className={`p-2.5 rounded-sm cursor-pointer transition-all duration-150 border relative select-none group flex flex-col gap-1.5 ${
        isDragging
          ? 'opacity-30 border-dashed border-border-strong scale-[0.98]'
          : isTarget && dropZone === 'merge'
          ? 'bg-base-2 border-commito-coral ring-1 ring-commito-coral/40'
          : isSelected
          ? 'bg-base-2 border-border-strong text-text-primary shadow-xs'
          : 'bg-base-1/50 border-border/60 hover:bg-base-2/70 hover:border-border text-text-primary'
      }`}
    >
      {/* Top Border Line Indicator for Drop Before */}
      {isTarget && dropZone === 'before' && (
        <div className="absolute inset-x-0 -top-1 h-0.5 bg-commito-coral z-20 pointer-events-none flex items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-commito-coral -ml-0.5 shadow-xs" />
        </div>
      )}

      {/* Bottom Border Line Indicator for Drop After */}
      {isTarget && dropZone === 'after' && (
        <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-commito-coral z-20 pointer-events-none flex items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-commito-coral -ml-0.5 shadow-xs" />
        </div>
      )}

      {/* Card Header: Commit Message & Tag / SHA / Signature */}
      <div className="flex items-start justify-between gap-2 pointer-events-none">
        <h4 className="text-xs font-semibold truncate leading-tight flex-1 text-text-primary group-hover:text-commito-coral transition-colors">
          {commit.message}
        </h4>
        <div className="flex items-center gap-1 flex-shrink-0">
          {renderSigningBadge()}
          {commitTags.length > 0 ? (
            commitTags.map((tag) => (
              <div
                key={tag.name}
                title={tag.message ? `Git Tag: ${tag.name} (${tag.message}) • Commit: ${commit.short_sha}` : `Git Tag: ${tag.name} • Commit: ${commit.short_sha}`}
                className="flex items-center gap-1 px-1.5 py-0.2 bg-amber-500/15 border border-amber-500/35 rounded-xs text-[9.5px] font-mono font-bold text-amber-400 max-w-[110px]"
              >
                <Tag className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                <span className="truncate">{tag.name}</span>
              </div>
            ))
          ) : (
            <div
              title={`Commit: ${commit.sha}`}
              className="flex items-center gap-0.5 px-1.5 py-0.2 bg-base-0 border border-border/70 rounded-xs text-[9.5px] font-mono text-text-muted"
            >
              <GitCommit className="w-2.5 h-2.5 text-commito-coral" />
              <span>{commit.short_sha}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer: Author + Relative Time + Additions/Deletions */}
      <div className="flex items-center justify-between text-[11px] text-text-muted pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate pr-2">
          <UserAvatar
            name={commit.author_name}
            email={commit.author_email}
            className="w-3.5 h-3.5 rounded-full ring-1 ring-border/50 flex-shrink-0"
            iconClassName="w-2 h-2"
          />
          <span className="truncate font-normal text-text-muted text-[11px]">
            {commit.author_name}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 font-mono text-[10px]">
          {commit.additions !== undefined &&
            commit.deletions !== undefined &&
            (commit.additions > 0 || commit.deletions > 0) && (
              <div className="flex items-center gap-1 text-[9px] font-semibold">
                <span className="text-git-added">+{commit.additions}</span>
                <span className="text-git-removed">-{commit.deletions}</span>
              </div>
            )}
          <span className="text-text-faint">{commit.relative_date}</span>
        </div>
      </div>

      {/* Refined Sleek Drop to Merge Overlay */}
      {isTarget && dropZone === 'merge' && (
        <div className="absolute inset-0 bg-base-1/95 border-2 border-dashed border-commito-coral rounded-sm flex items-center justify-center gap-2 text-xs font-semibold text-commito-coral uppercase tracking-wide z-20 pointer-events-none shadow-lg backdrop-blur-xs animate-in fade-in duration-100">
          <GitMerge className="w-4 h-4" />
          <span>Drop to Squash / Merge</span>
        </div>
      )}
    </div>
  );
};
