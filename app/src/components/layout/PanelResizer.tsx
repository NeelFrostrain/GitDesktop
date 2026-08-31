import React, { useEffect, useRef, useState } from 'react';

interface Props {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  className?: string;
}

/**
 * A 6px drag-handle divider that sits as a flex sibling between panels.
 * It lives outside any panel with overflow-hidden so it is never clipped.
 */
export const PanelResizer: React.FC<Props> = ({
  direction,
  onResize,
  onResizeEnd,
  className = '',
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const lastPos = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    let rafId: number | null = null;

    const onMove = (e: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const cur = direction === 'horizontal' ? e.clientX : e.clientY;
        const delta = cur - lastPos.current;
        lastPos.current = cur;
        onResize(delta);
      });
    };

    const onUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsResizing(false);
      onResizeEnd?.();
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseup', onUp);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isResizing, direction, onResize, onResizeEnd]);

  const isH = direction === 'horizontal';

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`flex-shrink-0 flex items-center justify-center group select-none transition-colors ${
        isH ? 'w-[6px] h-full cursor-col-resize' : 'w-full h-[6px] cursor-row-resize'
      } ${isResizing ? 'bg-commito-coral/25' : 'hover:bg-commito-coral/20'} ${className}`}
    >
      <div
        className={`rounded-full transition-colors ${isH ? 'w-px h-10' : 'h-px w-12'} ${
          isResizing ? 'bg-commito-coral' : 'bg-border/50 group-hover:bg-commito-coral/70'
        }`}
      />
    </div>
  );
};
