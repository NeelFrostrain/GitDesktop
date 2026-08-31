import React, { useState, useEffect, useRef } from 'react';
import { Loader2, ChevronUp, Clock, GripVertical } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { formatEta } from '../types';
import { useGitStore } from '../../../store/useGitStore';

const STORAGE_POS_KEY = 'git_desktop_floating_task_pos';

interface Position {
  x: number;
  y: number;
}

export const FloatingTaskWidget: React.FC = () => {
  const tasks = useTaskStore((s) => s.tasks);
  const isModalOpen = useTaskStore((s) => s.isModalOpen);
  const setModalOpen = useTaskStore((s) => s.setModalOpen);
  const isCloneModalOpen = useGitStore((s) => s.isCloneRepoModalOpen);

  const [position, setPosition] = useState<Position | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    cardX: number;
    cardY: number;
    hasMoved: boolean;
  }>({ startX: 0, startY: 0, cardX: 0, cardY: 0, hasMoved: false });

  const cardRef = useRef<HTMLDivElement>(null);

  const activeTasks = tasks.filter((t) => t.status === 'running');

  // Ensure card stays in viewport when window resizes
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        const cardWidth = 320;
        const cardHeight = 80;
        const maxX = Math.max(10, window.innerWidth - cardWidth - 16);
        const maxY = Math.max(10, window.innerHeight - cardHeight - 16);
        return {
          x: Math.max(16, Math.min(prev.x, maxX)),
          y: Math.max(16, Math.min(prev.y, maxY)),
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag on primary mouse button or touch
    if (e.button !== 0) return;

    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      cardX: rect.left,
      cardY: rect.top,
      hasMoved: false,
    };

    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - dragRef.current.startX;
      const deltaY = moveEvent.clientY - dragRef.current.startY;

      if (!dragRef.current.hasMoved && Math.hypot(deltaX, deltaY) > 3) {
        dragRef.current.hasMoved = true;
      }

      if (dragRef.current.hasMoved) {
        const cardWidth = 320;
        const cardHeight = 80;
        const maxX = Math.max(10, window.innerWidth - cardWidth - 16);
        const maxY = Math.max(10, window.innerHeight - cardHeight - 16);

        const newX = Math.max(16, Math.min(dragRef.current.cardX + deltaX, maxX));
        const newY = Math.max(16, Math.min(dragRef.current.cardY + deltaY, maxY));

        setPosition({ x: newX, y: newY });
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (dragRef.current.hasMoved) {
        const cardWidth = 320;
        const cardHeight = 80;
        const maxX = Math.max(10, window.innerWidth - cardWidth - 16);
        const maxY = Math.max(10, window.innerHeight - cardHeight - 16);

        const finalX = Math.max(16, Math.min(dragRef.current.cardX + (upEvent.clientX - dragRef.current.startX), maxX));
        const finalY = Math.max(16, Math.min(dragRef.current.cardY + (upEvent.clientY - dragRef.current.startY), maxY));

        const finalPos = { x: finalX, y: finalY };
        setPosition(finalPos);
        try {
          localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(finalPos));
        } catch {}
      } else {
        // If not dragged, trigger click action
        setModalOpen(true);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Don't show floating widget if there are no active tasks or if full modals are already open
  if (activeTasks.length === 0 || isModalOpen || isCloneModalOpen) {
    return null;
  }

  const primaryTask = activeTasks[0];
  const percent = primaryTask.progress.percent || 0;
  const eta = formatEta(primaryTask.startedAt, percent);

  const style: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
      }
    : {
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        touchAction: 'none',
      };

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      style={style}
      className={`z-9999 max-w-sm w-80 bg-base-1/95 border backdrop-blur-md rounded-sm shadow-2xl p-2.5 space-y-1.5 select-none group ${
        isDragging
          ? 'cursor-grabbing border-commito-coral/60 shadow-commito-coral/10 ring-1 ring-commito-coral/40'
          : 'cursor-grab border-border hover:border-border-strong hover:shadow-xl'
      }`}
      title="Click to view details or drag anywhere to reposition"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <GripVertical className="w-3.5 h-3.5 text-text-muted/50 group-hover:text-text-muted shrink-0 cursor-grab" />
          <Loader2 className="w-3.5 h-3.5 text-commito-coral animate-spin shrink-0" />
          <span className="font-semibold text-xs text-text-primary truncate">
            {primaryTask.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-commito-coral font-bold text-xs">
            {percent}%
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition shrink-0" />
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-1 bg-base-2 rounded-full overflow-hidden border border-border/60 relative pointer-events-none">
        <div
          className="h-full bg-commito-coral transition-all duration-200 ease-out rounded-full relative"
          style={{ width: `${Math.max(4, percent)}%` }}
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse" />
        </div>
      </div>

      {/* Details & ETA */}
      <div className="flex items-center justify-between text-[10px] text-text-muted font-mono pointer-events-none">
        <span className="truncate max-w-[60%]">
          {primaryTask.progress.detail || primaryTask.progress.stage || 'Downloading objects...'}
        </span>
        {eta && (
          <div className="flex items-center gap-1 text-commito-coral font-semibold shrink-0">
            <Clock className="w-2.5 h-2.5 shrink-0 opacity-80" />
            <span>{eta}</span>
          </div>
        )}
      </div>
    </div>
  );
};
