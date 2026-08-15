import React, { useState } from 'react';
import { CommitInfo } from '../../../types/git';
import { useGitStore } from '../../../store/useGitStore';
import { useHistoryDragAndDrop } from '../../../hooks/useHistoryDragAndDrop';
import { CommitCard } from './CommitCard';
import { CommitContextMenu } from '../../context-menus/CommitContextMenu';

interface CommitListProps {
  commits: CommitInfo[];
}

export const CommitList: React.FC<CommitListProps> = ({ commits }) => {
  const { selectedCommitSha, setSelectedCommitSha, setCurrentNavView } = useGitStore();
  const { commitListRef, draggedSha, dragTarget, handleMouseDownOnCommit } =
    useHistoryDragAndDrop(commits);

  const [contextMenu, setContextMenu] = useState<{
    commit: CommitInfo;
    x: number;
    y: number;
  } | null>(null);

  if (commits.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-text-muted italic">
        No commits match filter
      </div>
    );
  }

  return (
    <>
      <div ref={commitListRef} className="flex-1 overflow-y-auto p-2 pr-0.5 space-y-1">
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
