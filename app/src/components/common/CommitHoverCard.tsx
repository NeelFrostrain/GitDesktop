import React from 'react';
import { createPortal } from 'react-dom';
import { GitCommit, Calendar } from 'lucide-react';
import { CommitInfo, BranchInfo, TagInfo } from '../../types/git';
import { UserAvatar } from './UserAvatar';

interface CommitHoverCardProps {
  commit: CommitInfo | null;
  branches?: BranchInfo[];
  tags?: TagInfo[];
  coords: { x: number; y: number } | null;
}

function formatFullDate(timestamp: number): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp * 1000);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export const CommitHoverCard: React.FC<CommitHoverCardProps> = ({
  commit,
  branches = [],
  tags = [],
  coords,
}) => {
  if (!commit || !coords) return null;

  // Calculate clamped viewport position
  const CARD_WIDTH = 340;
  const CARD_HEIGHT = 190;
  const PADDING = 12;

  let left = coords.x + 16;
  let top = coords.y - 40;

  // Clamp right
  if (left + CARD_WIDTH > window.innerWidth - PADDING) {
    left = coords.x - CARD_WIDTH - 16;
  }
  // Clamp bottom
  if (top + CARD_HEIGHT > window.innerHeight - PADDING) {
    top = window.innerHeight - CARD_HEIGHT - PADDING;
  }
  // Clamp top
  if (top < PADDING) {
    top = PADDING;
  }

  const parents = commit.parent_shas || [];

  return createPortal(
    <div
      style={{ left: `${left}px`, top: `${top}px`, width: `${CARD_WIDTH}px` }}
      className="fixed z-50 pointer-events-none bg-base-1/95 backdrop-blur-md border border-border-strong rounded-sm shadow-2xl p-3 flex flex-col gap-2 font-sans select-none text-xs animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/40"
    >
      {/* 1. Header: SHA & Branch / Tag Badges */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-1 px-1.5 py-0.2 bg-base-0 border border-border/80 rounded-xs font-mono text-[10.5px] font-bold text-commito-coral shrink-0">
            <GitCommit className="w-3 h-3 text-commito-coral shrink-0" />
            <span>{commit.short_sha}</span>
          </div>

          {branches.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden">
              {branches.slice(0, 2).map((b) => (
                <span
                  key={b.name}
                  className="px-1.5 py-0.2 rounded-xs text-[9.5px] font-mono font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-400 truncate max-w-[90px]"
                >
                  {b.name}
                </span>
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden">
              {tags.slice(0, 1).map((t) => (
                <span
                  key={t.name}
                  className="px-1.5 py-0.2 rounded-xs text-[9.5px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 truncate max-w-[80px]"
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Diff stats (if available) */}
        {commit.additions !== undefined && commit.deletions !== undefined && (
          <div className="flex items-center gap-1 font-mono text-[10px] shrink-0 font-semibold">
            <span className="text-git-added">+{commit.additions}</span>
            <span className="text-git-removed">-{commit.deletions}</span>
          </div>
        )}
      </div>

      {/* 2. Commit Message */}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-text-primary leading-snug break-words">
          {commit.message}
        </p>
      </div>

      {/* 3. Author & Timestamp */}
      <div className="flex flex-col gap-1 text-[11px] text-text-muted bg-base-0/60 border border-border/40 rounded-xs p-1.5">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <UserAvatar
              name={commit.author_name}
              email={commit.author_email}
              className="w-3.5 h-3.5 rounded-full ring-1 ring-border/50 shrink-0"
              iconClassName="w-2 h-2"
            />
            <span className="font-medium text-text-secondary truncate">{commit.author_name}</span>
            {commit.author_email && (
              <span className="text-[10px] text-text-faint truncate">
                &lt;{commit.author_email}&gt;
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-text-faint font-mono mt-0.5">
          <div className="flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5 text-text-muted shrink-0" />
            <span>{formatFullDate(commit.timestamp)}</span>
          </div>
          <span>{commit.relative_date}</span>
        </div>
      </div>

      {/* 4. Parent Hashes (if any) */}
      {parents.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted">
          <span className="text-text-faint">
            {parents.length > 1 ? 'Merge Parents:' : 'Parent:'}
          </span>
          <div className="flex items-center gap-1">
            {parents.map((pSha) => (
              <span
                key={pSha}
                className="px-1 py-0.2 bg-base-0 border border-border/60 rounded-xs text-text-secondary"
              >
                {pSha.slice(0, 7)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
