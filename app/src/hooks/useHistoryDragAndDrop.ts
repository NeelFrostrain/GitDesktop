import { useState, useRef } from 'react';
import { CommitInfo } from '../types/git';
import { useGitStore } from '../store/useGitStore';

/**
 * Drop target indicator state for drag & drop history reordering or commit merging.
 */
export interface DragTargetState {
  sha: string;
  dropZone: 'before' | 'after' | 'merge';
}

/**
 * Custom hook providing smooth drag-and-drop commit reordering and merging operations
 * in the history panel, featuring auto-scrolling and relative drop zone detection.
 *
 * @param commits - The active list of commits in the history view.
 */
export function useHistoryDragAndDrop(commits: CommitInfo[]) {
  const { setPendingHistoryOp, setIsRewriteModalOpen } = useGitStore();
  const [draggedSha, setDraggedSha] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTargetState | null>(null);

  const commitListRef = useRef<HTMLDivElement>(null);

  const handleMouseDownOnCommit = (e: React.MouseEvent, commit: CommitInfo) => {
    // Only respond to primary (left) mouse button clicks
    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let currentX = startX;
    let currentY = startY;
    let isDraggingStarted = false;
    let currentTarget: DragTargetState | null = null;
    let animFrameId: number | null = null;

    /**
     * Finds the commit card element under current pointer coordinates and computes the drop zone:
     * - Top 35%: reorder 'before'
     * - Bottom 35%: reorder 'after'
     * - Middle 30%: 'merge' (squash)
     */
    const updateTargetFromPoint = (x: number, y: number) => {
      const elemBelow = document.elementFromPoint(x, y);
      if (!elemBelow) {
        currentTarget = null;
        setDragTarget(null);
        return;
      }

      const cardElem = elemBelow.closest('[data-commit-sha]');
      if (!cardElem) {
        currentTarget = null;
        setDragTarget(null);
        return;
      }

      const targetSha = cardElem.getAttribute('data-commit-sha');
      if (!targetSha || targetSha === commit.sha) {
        currentTarget = null;
        setDragTarget(null);
        return;
      }

      const rect = cardElem.getBoundingClientRect();
      const relativeY = y - rect.top;
      const ratio = relativeY / rect.height;

      let dropZone: 'before' | 'after' | 'merge' = 'merge';
      if (ratio < 0.35) {
        dropZone = 'before';
      } else if (ratio > 0.65) {
        dropZone = 'after';
      }

      currentTarget = { sha: targetSha, dropZone };
      setDragTarget(currentTarget);
    };

    /**
     * Handles automatic container scrolling when dragging near top or bottom edges.
     */
    const autoScrollLoop = () => {
      const container = commitListRef.current;
      if (container && isDraggingStarted) {
        const rect = container.getBoundingClientRect();
        const topThreshold = rect.top + 45;
        const bottomThreshold = rect.bottom - 45;

        let scrollDelta = 0;
        if (currentY < topThreshold) {
          scrollDelta = -Math.min(12, Math.max(3, (topThreshold - currentY) / 3));
        } else if (currentY > bottomThreshold) {
          scrollDelta = Math.min(12, Math.max(3, (currentY - bottomThreshold) / 3));
        }

        if (scrollDelta !== 0) {
          container.scrollTop += scrollDelta;
          updateTargetFromPoint(currentX, currentY);
        }
      }

      animFrameId = requestAnimationFrame(autoScrollLoop);
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      currentX = moveEvent.clientX;
      currentY = moveEvent.clientY;

      const dist = Math.hypot(currentX - startX, currentY - startY);
      // Small 4px threshold prevents accidental drag when clicking to inspect
      if (!isDraggingStarted) {
        if (dist > 4) {
          isDraggingStarted = true;
          setDraggedSha(commit.sha);
          animFrameId = requestAnimationFrame(autoScrollLoop);
        } else {
          return;
        }
      }

      updateTargetFromPoint(currentX, currentY);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }

      if (isDraggingStarted && currentTarget) {
        const sourceCommit = commit;
        const targetCommit = commits.find((c) => c.sha === currentTarget!.sha);

        if (targetCommit) {
          if (currentTarget.dropZone === 'before' || currentTarget.dropZone === 'after') {
            setPendingHistoryOp({
              type: 'reorder',
              sourceCommit,
              targetCommit,
              position: currentTarget.dropZone,
            });
            setIsRewriteModalOpen(true);
          } else if (currentTarget.dropZone === 'merge') {
            setPendingHistoryOp({
              type: 'merge',
              sourceCommit,
              targetCommit,
              newMessage: `${targetCommit.message}\n\n${sourceCommit.message}`,
            });
            setIsRewriteModalOpen(true);
          }
        }
      }

      setDraggedSha(null);
      setDragTarget(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return {
    commitListRef,
    draggedSha,
    dragTarget,
    handleMouseDownOnCommit,
  };
}
