import React, { useEffect } from 'react';
import { GitMerge, GitCommit, ShieldCheck, ShieldAlert, Tag } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
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

/**
 * Parses Conventional Commit patterns (e.g. "feat(ui): add button" -> type, scope, title).
 */
function renderCommitMessage(message: string) {
  const match = message.match(/^([a-zA-Z]+)(\([^)]+\))?(!)?:\s*(.*)$/);
  if (!match) {
    return (
      <span className="truncate text-xs font-medium text-text-primary group-hover:text-commito-coral transition-colors leading-tight">
        {message}
      </span>
    );
  }

  const [, type, scope, breaking, rest] = match;
  return (
    <span className="truncate text-xs leading-tight">
      <span className="font-mono font-bold text-commito-coral text-[11px]">{type}</span>
      {scope && <span className="font-mono text-text-muted text-[10px]">{scope}</span>}
      {breaking && <span className="text-git-conflict font-bold">!</span>}
      <span className="text-text-muted font-mono">: </span>
      <span className="font-medium text-text-primary group-hover:text-commito-coral transition-colors">
        {rest}
      </span>
    </span>
  );
}

export const CommitCard: React.FC<CommitCardProps> = React.memo(({
  commit,
  isSelected,
  isDragging,
  isTarget,
  dropZone,
  onMouseDown,
  onClick,
  onContextMenu,
}) => {
  const { activeRepoPath, tags } = useGitStore(
    useShallow((s) => ({
      activeRepoPath: s.activeRepoPath,
      tags: s.tags,
    }))
  );
  const verification = useSigningStore((s) => s.verifiedCommits[commit.sha]);
  const verifyCommit = useSigningStore((s) => s.verifyCommit);

  // Match any tags pointing to this commit
  const commitTags = tags.filter(
    (t) =>
      t.sha &&
      (t.sha === commit.sha || commit.sha.startsWith(t.sha) || t.sha.startsWith(commit.short_sha))
  );

  useEffect(() => {
    if (activeRepoPath && !verification && commit.sha) {
      verifyCommit(activeRepoPath, commit.sha);
    }
  }, [activeRepoPath, commit.sha, verification, verifyCommit]);

  const renderSigningBadge = () => {
    if (!verification || verification.status === 'NoSignature') return null;

    if (verification.status === 'Verified') {
      return (
        <span
          title="Verified commit signature"
          className="flex items-center text-git-added font-mono text-[9px] bg-git-added-bg border border-git-added/40 px-1 py-0.2 rounded-xs"
        >
          <ShieldCheck className="w-2.5 h-2.5" />
        </span>
      );
    }

    if (verification.status === 'Unverified') {
      return (
        <span
          title="Unverified signature"
          className="flex items-center text-git-modified font-mono text-[9px] bg-git-modified-bg border border-git-modified/40 px-1 py-0.2 rounded-xs"
        >
          <ShieldAlert className="w-2.5 h-2.5" />
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
      className={`px-3 py-2 rounded-sm border cursor-pointer transition-all duration-150 relative select-none group flex flex-col gap-1.5 ${
        isDragging
          ? 'opacity-30 border-dashed border-border-strong scale-[0.98]'
          : isTarget && dropZone === 'merge'
            ? 'bg-base-2 border-commito-coral ring-1 ring-commito-coral/40'
            : isSelected
              ? 'bg-base-2 border-commito-coral/50 ring-1 ring-commito-coral/30 text-text-primary shadow-xs'
              : 'bg-base-1/50 border-border/60 hover:bg-base-2/80 hover:border-border-strong text-text-primary'
      }`}
    >
      {/* Row 1: Message + Tags / SHA */}
      <div className="flex items-center justify-between gap-2 min-w-0 pointer-events-none">
        <div className="min-w-0 truncate flex-1">{renderCommitMessage(commit.message)}</div>

        <div className="flex items-center gap-1 shrink-0">
          {renderSigningBadge()}
          {commitTags.length > 0 ? (
            commitTags.map((tag) => (
              <div
                key={tag.name}
                title={`Git Tag: ${tag.name}`}
                className="chip chip-tag max-w-[95px]"
              >
                <Tag className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                <span className="truncate">{tag.name}</span>
              </div>
            ))
          ) : (
            <div
              title={`Commit: ${commit.sha}`}
              className="chip chip-commit group-hover:border-border-strong transition-colors"
            >
              <GitCommit className="w-2.5 h-2.5 text-commito-coral" />
              <span>{commit.short_sha}</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Author + Relative Date + Diff Stats */}
      <div className="flex items-center justify-between text-[10.5px] text-text-muted pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate pr-2">
          <UserAvatar
            name={commit.author_name}
            email={commit.author_email}
            className="w-3.5 h-3.5 rounded-full ring-1 ring-border/50 shrink-0"
            iconClassName="w-2 h-2"
          />
          <span className="truncate font-normal text-text-secondary text-[11px]">
            {commit.author_name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
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

      {/* Top Border Line Indicator for Drop Before */}
      {isTarget && dropZone === 'before' && (
        <div className="absolute inset-x-0 -top-0.5 h-0.5 bg-commito-coral z-20 pointer-events-none flex items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-commito-coral -ml-0.5 shadow-xs" />
        </div>
      )}

      {/* Bottom Border Line Indicator for Drop After */}
      {isTarget && dropZone === 'after' && (
        <div className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-commito-coral z-20 pointer-events-none flex items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-commito-coral -ml-0.5 shadow-xs" />
        </div>
      )}

      {/* Drop to Merge Overlay */}
      {isTarget && dropZone === 'merge' && (
        <div className="absolute inset-0 bg-base-1/95 border-2 border-dashed border-commito-coral rounded-sm flex items-center justify-center gap-2 text-xs font-semibold text-commito-coral uppercase tracking-wide z-20 pointer-events-none shadow-lg backdrop-blur-xs animate-in fade-in duration-100">
          <GitMerge className="w-4 h-4" />
          <span>Drop to Squash / Merge</span>
        </div>
      )}
    </div>
  );
});
