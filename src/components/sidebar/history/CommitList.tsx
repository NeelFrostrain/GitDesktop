import React, { useState, useCallback } from 'react';
import { Loader2, GitCommit } from 'lucide-react';
import { CommitInfo } from '../../../types/git';
import { useShallow } from 'zustand/react/shallow';
import { useGitStore } from '../../../store/useGitStore';
import { CommitCard } from './CommitCard';
import { CommitContextMenu } from '../../context-menus/CommitContextMenu';
import { useHistoryDragAndDrop } from '../../../hooks/useHistoryDragAndDrop';

interface CommitListProps {
  commits: CommitInfo[];
  hasMore: boolean;
  isLoadingMore: boolean;
  isLoadingInitial: boolean;
  onLoadMore: () => void;
}

export const CommitList: React.FC<CommitListProps> = ({
  commits,
  hasMore,
  isLoadingMore,
  isLoadingInitial,
  onLoadMore,
}) => {
  const { selectedCommitSha, setSelectedCommitSha } = useGitStore(
    useShallow((s) => ({
      selectedCommitSha: s.selectedCommitSha,
      setSelectedCommitSha: s.setSelectedCommitSha,
    }))
  );
  const [contextMenu, setContextMenu] = useState<{
    commit: CommitInfo;
    x: number;
    y: number;
  } | null>(null);

  const { draggedSha, dragTarget, handleMouseDownOnCommit, commitListRef } =
    useHistoryDragAndDrop(commits);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!hasMore || isLoadingMore || isLoadingInitial) return;
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop - clientHeight < 200) {
        onLoadMore();
      }
    },
    [hasMore, isLoadingMore, isLoadingInitial, onLoadMore]
  );

  if (isLoadingInitial && commits.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-xs text-text-muted gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-commito-coral" />
        <span>Loading commit history...</span>
      </div>
    );
  }

  if (!isLoadingInitial && commits.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-xs text-text-muted gap-2 text-center">
        <GitCommit className="w-6 h-6 text-text-faint" />
        <span>No commits found matching filter.</span>
      </div>
    );
  }

  return (
    <div
      ref={commitListRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto pl-2 py-2 space-y-1.5 scrollbar-thin select-none"
    >
      {commits.map((commit) => {
        const isSelected = selectedCommitSha === commit.sha;
        const isDragging = draggedSha === commit.sha;
        const isTarget = dragTarget?.sha === commit.sha;
        const dropZone = isTarget ? dragTarget.dropZone : null;

        return (
          <CommitCard
            key={commit.sha}
            commit={commit}
            isSelected={isSelected}
            isDragging={isDragging}
            isTarget={isTarget}
            dropZone={dropZone}
            onMouseDown={handleMouseDownOnCommit}
            onClick={() => setSelectedCommitSha(commit.sha)}
            onContextMenu={(e, c) => {
              e.preventDefault();
              setSelectedCommitSha(c.sha);
              setContextMenu({ commit: c, x: e.clientX, y: e.clientY });
            }}
          />
        );
      })}

      {isLoadingMore && (
        <div className="py-2 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral" />
          <span>Loading more...</span>
        </div>
      )}

      {contextMenu && (
        <CommitContextMenu
          commit={contextMenu.commit}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
