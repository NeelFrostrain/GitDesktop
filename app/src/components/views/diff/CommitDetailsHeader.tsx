import React, { useState } from 'react';
import {
  AlignJustify,
  Columns,
  ShieldCheck,
  ShieldAlert,
  GitCommit,
  Clock,
  ChevronDown,
  Copy,
  Check,
  Files,
  Tag,
} from 'lucide-react';
import { CommitDetails } from '../../../types/git';
import { useSigningStore } from '../../../store/signingStore';
import { useGitStore } from '../../../store/useGitStore';
import { UserAvatar } from '../../common/UserAvatar';
import { Button } from '../../common/Button';

interface CommitDetailsHeaderProps {
  commitDetails: CommitDetails;
  diffViewMode: 'unified' | 'split' | 'edit';
  onChangeViewMode: (mode: 'unified' | 'split' | 'edit') => void;
  openFiles: Record<string, boolean>;
  onToggleExpandAll: () => void;
}

/**
 * Modern, merged, high-density commit header with metadata, diff stats, changed files count, and view controls.
 */
export const CommitDetailsHeader: React.FC<CommitDetailsHeaderProps> = ({
  commitDetails,
  diffViewMode,
  onChangeViewMode,
  openFiles,
  onToggleExpandAll,
}) => {
  const [showCommitBody, setShowCommitBody] = useState(false);
  const [copiedSha, setCopiedSha] = useState(false);

  const fullMessage = commitDetails.commit.message || '';
  const firstNewlineIndex = fullMessage.indexOf('\n');
  const commitTitle =
    firstNewlineIndex !== -1 ? fullMessage.substring(0, firstNewlineIndex).trim() : fullMessage;
  const commitBody =
    firstNewlineIndex !== -1 ? fullMessage.substring(firstNewlineIndex + 1).trim() : '';

  const verification = useSigningStore.getState().verifiedCommits[commitDetails.commit.sha];

  const additions = commitDetails.total_additions ?? commitDetails.commit.additions ?? 0;
  const deletions = commitDetails.total_deletions ?? commitDetails.commit.deletions ?? 0;

  const isAllOpen = commitDetails.changed_files.every((f) => openFiles[f]);

  const tags = useGitStore((s) => s.tags);
  const commitTags = tags.filter(
    (t) =>
      t.sha &&
      (t.sha === commitDetails.commit.sha ||
        commitDetails.commit.sha.startsWith(t.sha) ||
        t.sha.startsWith(commitDetails.commit.short_sha))
  );

  const handleCopySha = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(commitDetails.commit.sha);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 1500);
  };

  return (
    <div className="bg-base-1/70 border-b border-border flex-shrink-0 select-none">
      {/* Top Row: Title + View Switcher & Verification */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-4">
        <h2
          className="text-xs font-semibold text-text-primary leading-snug truncate min-w-0 flex-1"
          title={commitTitle}
        >
          {commitTitle}
        </h2>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View mode toggle */}
          <div className="flex items-center bg-base-0 border border-border rounded-sm p-0.5">
            <button
              type="button"
              onClick={() => onChangeViewMode('unified')}
              className={`p-1 rounded-sm text-xs transition cursor-pointer ${
                diffViewMode === 'unified'
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
              className={`p-1 rounded-sm text-xs transition cursor-pointer ${
                diffViewMode === 'split'
                  ? 'bg-base-2 text-text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Split (Side-by-Side) View"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Verification badge */}
          {verification?.status === 'Verified' && (
            <span
              title="Cryptographically verified"
              className="flex items-center gap-1 text-git-added text-[10px] bg-git-added/10 border border-git-added/25 px-1.5 py-0.5 rounded-sm font-semibold"
            >
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          )}
          {verification?.status === 'Unverified' && (
            <span
              title="Unverified signature"
              className="flex items-center gap-1 text-git-modified text-[10px] bg-git-modified/10 border border-git-modified/25 px-1.5 py-0.5 rounded-sm font-semibold"
            >
              <ShieldAlert className="w-3 h-3" />
              Unverified
            </span>
          )}
        </div>
      </div>

      {/* Bottom Row: Author meta bar, SHA pill, Time, Changed Files count, Diff Stats & Expand button */}
      <div className="px-4 pb-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0 text-[11px] text-text-muted">
          {/* Author */}
          <div className="flex items-center gap-1.5 min-w-0">
            <UserAvatar
              name={commitDetails.commit.author_name}
              email={commitDetails.commit.author_email}
              className="w-4 h-4 rounded-full ring-1 ring-border/60 flex-shrink-0"
              iconClassName="w-2.5 h-2.5"
            />
            <span className="font-medium text-text-primary truncate">
              {commitDetails.commit.author_name}
            </span>
          </div>

          <span className="text-text-faint select-none">/</span>

          {/* Click-to-copy SHA badge */}
          <button
            type="button"
            onClick={handleCopySha}
            title="Click to copy full commit SHA"
            className="chip chip-commit hover:border-border-strong cursor-pointer active:scale-95"
          >
            <GitCommit className="w-3 h-3 text-commito-coral flex-shrink-0" />
            <span>{commitDetails.commit.short_sha}</span>
            {copiedSha ? (
              <Check className="w-2.5 h-2.5 text-git-added ml-0.5" />
            ) : (
              <Copy className="w-2.5 h-2.5 text-text-faint ml-0.5 opacity-70" />
            )}
          </button>

          {/* Git Tag Badges */}
          {commitTags.map((tag) => (
            <span
              key={tag.name}
              title={tag.message ? `Git Tag: ${tag.name} (${tag.message})` : `Git Tag: ${tag.name}`}
              className="chip chip-tag"
            >
              <Tag className="w-2.5 h-2.5" />
              <span>{tag.name}</span>
            </span>
          ))}

          <span className="text-text-faint select-none">/</span>

          {/* Time */}
          <div className="flex items-center gap-1 flex-shrink-0 text-text-faint">
            <Clock className="w-3 h-3" />
            <span>{commitDetails.commit.relative_date}</span>
          </div>

          <span className="text-text-faint select-none">/</span>

          {/* Merged Changed Files Badge */}
          <div className="chip chip-commit">
            <Files className="w-2.5 h-2.5 text-commito-coral" />
            <span>{commitDetails.changed_files.length} changed</span>
          </div>
        </div>

        {/* Right: Diff stats + Expand/Collapse All + Expand details button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {(additions > 0 || deletions > 0) && (
            <div className="chip chip-stat text-[11px] px-2 py-0.5 gap-1.5 shadow-2xs">
              {additions > 0 && <span className="text-git-added">+{additions}</span>}
              {deletions > 0 && <span className="text-git-removed">-{deletions}</span>}
            </div>
          )}

          {/* Merged Expand / Collapse All Button */}
          <Button type="button" variant="secondary" size="xs" onClick={onToggleExpandAll}>
            {isAllOpen ? 'Collapse All' : 'Expand All'}
          </Button>

          {commitBody && (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => setShowCommitBody(!showCommitBody)}
              rightIcon={
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-150 ${
                    showCommitBody ? 'rotate-180 text-commito-coral' : ''
                  }`}
                />
              }
            >
              {showCommitBody ? 'Hide Details' : 'Details'}
            </Button>
          )}
        </div>
      </div>

      {/* Expandable Commit Description / Body */}
      {commitBody && showCommitBody && (
        <div className="mx-4 mb-3 p-3 bg-base-0 border-l-2 border-l-commito-coral border-y border-r border-border rounded-r-sm text-[11px] text-text-muted max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed shadow-2xs animate-in fade-in duration-150">
          {commitBody}
        </div>
      )}
    </div>
  );
};
