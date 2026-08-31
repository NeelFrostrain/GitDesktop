import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DiffLine } from '../../../types/git';
import { buildDiffHunks, highlightCodeLine } from './diffUtils';

interface UnifiedDiffViewProps {
  lines: DiffLine[];
  wordWrap?: boolean;
}

type VirtualDiffItem =
  | { type: 'header'; id: string; headerContent: string }
  | { type: 'line'; id: string; line: DiffLine; originalIndex: number };

/**
 * Line-by-line unified diff table with syntax highlighting, line numbers,
 * dynamic line height measurement, word wrapping, and high-performance TanStack Virtual windowing.
 */
export const UnifiedDiffView: React.FC<UnifiedDiffViewProps> = React.memo(({ lines, wordWrap = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Group into hunks, then flatten into virtual items
  const hunks = useMemo(() => buildDiffHunks(lines), [lines]);

  const flattenedItems = useMemo<VirtualDiffItem[]>(() => {
    const items: VirtualDiffItem[] = [];
    for (const hunk of hunks) {
      if (hunk.headerContent) {
        items.push({
          type: 'header',
          id: hunk.id,
          headerContent: hunk.headerContent,
        });
      }
      for (const lineObj of hunk.lines) {
        items.push({
          type: 'line',
          id: `line-${lineObj.originalIndex}`,
          line: lineObj.line,
          originalIndex: lineObj.originalIndex,
        });
      }
    }
    return items;
  }, [hunks]);

  const rowVirtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 24,
    overscan: 25,
  });

  if (flattenedItems.length === 0 || lines.length === 0) {
    return (
      <div className="p-6 text-text-muted text-center font-mono text-xs">
        No textual line changes detected.
      </div>
    );
  }

  // Syntax highlighting enabled for all lines; fast-path automatically handles huge lines
  const shouldHighlight = lines.length <= 5000;

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-0 overflow-auto font-mono text-[12px] leading-5 select-text bg-base-0 scrollbar-thin"
    >
      <div
        className="w-full relative"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = flattenedItems[virtualRow.index];

          if (item.type === 'header') {
            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="bg-base-2 text-diff-highlight font-semibold px-3 py-0.5 border-y border-border/60 text-[11px] font-mono select-none shadow-2xs backdrop-blur-xs z-10"
              >
                <span className="truncate">{item.headerContent}</span>
              </div>
            );
          }

          const { line } = item;
          const isAddition = line.line_type === 'addition';
          const isDeletion = line.line_type === 'deletion';

          let lineBg = 'hover:bg-base-3/30';
          let textColor = 'text-text-primary';
          let prefix = ' ';

          if (isAddition) {
            lineBg = 'bg-diff-add-bg text-diff-add-text';
            textColor = 'text-diff-add-text';
            prefix = '+';
          } else if (isDeletion) {
            lineBg = 'bg-diff-remove-bg text-diff-remove-text';
            textColor = 'text-diff-remove-text';
            prefix = '-';
          }

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={`flex w-full border-b border-border/20 transition-colors ${lineBg} min-h-[24px]`}
            >
              {/* Old Line Number */}
              <div className="w-12 px-2.5 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 shrink-0 self-stretch flex items-start justify-end">
                {line.old_line_num ?? ''}
              </div>

              {/* New Line Number */}
              <div className="w-12 px-2.5 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 shrink-0 self-stretch flex items-start justify-end">
                {line.new_line_num ?? ''}
              </div>

              {/* Prefix Column */}
              <div className="w-6 px-1 py-0.5 text-center select-none font-bold shrink-0 self-stretch flex items-start justify-center">
                {prefix}
              </div>

              {/* Code Content */}
              <div
                className={`flex-1 min-w-0 px-2 py-0.5 font-mono leading-5 ${textColor} ${
                  wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
                }`}
              >
                {highlightCodeLine(line.content, shouldHighlight)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

UnifiedDiffView.displayName = 'UnifiedDiffView';
