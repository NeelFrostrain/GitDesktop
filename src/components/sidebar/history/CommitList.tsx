import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { CommitInfo } from '../../../types/git';
import { useGitStore } from '../../../store/useGitStore';
import { useHistoryDragAndDrop } from '../../../hooks/useHistoryDragAndDrop';
import { CommitCard } from './CommitCard';
import { CommitContextMenu } from '../../context-menus/CommitContextMenu';

interface CommitListProps {
  commits: CommitInfo[];
  totalLoadedCount?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  isLoadingInitial?: boolean;
  onLoadMore?: () => void;
}

export const CommitList: React.FC<CommitListProps> = ({
  commits,
  hasMore = false,
  isLoadingMore = false,
  isLoadingInitial = false,
  onLoadMore,
}) => {
  const { selectedCommitSha, setSelectedCommitSha, setCurrentNavView } = useGitStore();
  const { commitListRef, draggedSha, dragTarget, handleMouseDownOnCommit } =
    useHistoryDragAndDrop(commits);

  const [contextMenu, setContextMenu] = useState<{
    commit: CommitInfo;
    x: number;
    y: number;
  } | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver to automatically trigger onLoadMore when scrolling near bottom
  useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: commitListRef.current,
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    const sentinel = sentinelRef.current;
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, onLoadMore, commitListRef]);

  // Fallback scroll listener
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasMore || isLoadingMore || !onLoadMore) return;

    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 250) {
      onLoadMore();
    }
  };

  if (isLoadingInitial && commits.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-xs text-text-muted gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-commito-coral" />
        <span>Loading commit timeline...</span>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-text-muted italic">No commits match filter</div>
    );
  }

  return (
    <>
      <div
        ref={commitListRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 pr-0.5 space-y-1 select-none"
      >
        {commits.map((c) => {
          const isSelected = selectedCommitSha === c.sha;
          const isDragging = draggedSha === c.sha;
          const isTarget = dragTarget?.sha === c.sha;
          const dropZone = isTarget ? dragTarget.dropZone : null;

          return (
            <CommitCard
              key={c.sha}
              commit={c}
              isSelected={isSelected}
              isDragging={isDragging}
              isTarget={isTarget}
              dropZone={dropZone}
              onMouseDown={handleMouseDownOnCommit}
              onClick={() => {
                setSelectedCommitSha(c.sha);
                setCurrentNavView('history');
              }}
              onContextMenu={(e, commit) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedCommitSha(commit.sha);
                setContextMenu({ commit, x: e.clientX, y: e.clientY });
              }}
            />
          );
        })}

        {/* Sentinel element for infinite scroll observer */}
        <div ref={sentinelRef} className="h-2 w-full pointer-events-none" />

        {/* Bottom Loading / End State */}
        {isLoadingMore && (
          <div className="py-2.5 flex items-center justify-center gap-2 text-[11px] text-text-muted font-medium bg-base-1/50 border border-border/40 rounded-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral" />
            <span>Loading older commits...</span>
          </div>
        )}

        {!hasMore && commits.length > 20 && (
          <div className="pb-1 text-center text-[10px] font-mono text-text-faint">
            — End of repository history ({commits.length} commits) —
          </div>
        )}
      </div>

      {contextMenu && (
        <CommitContextMenu
          commit={contextMenu.commit}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
};
