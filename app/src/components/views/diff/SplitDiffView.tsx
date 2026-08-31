import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DiffLine } from '../../../types/git';
import { buildSplitRows, highlightCodeLine } from './diffUtils';

interface SplitDiffViewProps {
  lines: DiffLine[];
  wordWrap?: boolean;
}

/**
 * Side-by-side split diff layout table with aligned chunks, syntax highlighting,
 * dynamic line height measurement, word wrapping, and high-performance TanStack Virtual windowing.
 */
export const SplitDiffView: React.FC<SplitDiffViewProps> = React.memo(({ lines, wordWrap = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const splitRows = useMemo(() => buildSplitRows(lines), [lines]);

  const rowVirtualizer = useVirtualizer({
    count: splitRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 24,
    overscan: 25,
  });

  if (splitRows.length === 0) {
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
          const row = splitRows[virtualRow.index];

          if (row.type === 'header') {
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
                className="bg-base-2 text-diff-highlight font-semibold px-4 py-0.5 border-y border-border/50 text-[11px] font-mono select-none shadow-2xs backdrop-blur-xs z-10"
              >
                {row.headerText}
              </div>
            );
          }

          const isOldEmpty = row.oldContent === undefined;
          const isNewEmpty = row.newContent === undefined;
          const isDel = !isOldEmpty && isNewEmpty;
          const isAdd = isOldEmpty && !isNewEmpty;
          const isModified = !isOldEmpty && !isNewEmpty && row.oldContent !== row.newContent;

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
              className="flex w-full border-b border-border/20 leading-5 text-[12px] font-mono min-h-[24px]"
            >
              {/* Left Side (Old/Deleted) */}
              <div
                className={`w-1/2 min-w-0 flex border-r border-border/40 ${
                  isDel || isModified
                    ? 'bg-diff-remove-bg text-diff-remove-text'
                    : isOldEmpty
                      ? 'bg-base-1/20'
                      : 'bg-base-0 text-text-primary'
                }`}
              >
                <div className="w-12 px-2.5 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 shrink-0 self-stretch flex items-start justify-end">
                  {row.oldNum ?? ''}
                </div>
                <div className="w-5 px-1 py-0.5 text-center select-none font-bold text-diff-remove-text shrink-0 self-stretch flex items-start justify-center">
                  {!isOldEmpty && (isDel || isModified) ? '-' : ''}
                </div>
                <div
                  className={`flex-1 min-w-0 px-2 py-0.5 font-mono leading-5 ${
                    wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
                  }`}
                >
                  {row.oldContent !== undefined
                    ? highlightCodeLine(row.oldContent, shouldHighlight)
                    : '\u00A0'}
                </div>
              </div>

              {/* Right Side (New/Added) */}
              <div
                className={`w-1/2 min-w-0 flex ${
                  isAdd || isModified
                    ? 'bg-diff-add-bg text-diff-add-text'
                    : isNewEmpty
                      ? 'bg-base-1/20'
                      : 'bg-base-0 text-text-primary'
                }`}
              >
                <div className="w-12 px-2.5 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 shrink-0 self-stretch flex items-start justify-end">
                  {row.newNum ?? ''}
                </div>
                <div className="w-5 px-1 py-0.5 text-center select-none font-bold text-diff-add-text shrink-0 self-stretch flex items-start justify-center">
                  {!isNewEmpty && (isAdd || isModified) ? '+' : ''}
                </div>
                <div
                  className={`flex-1 min-w-0 px-2 py-0.5 font-mono leading-5 ${
                    wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
                  }`}
                >
                  {row.newContent !== undefined
                    ? highlightCodeLine(row.newContent, shouldHighlight)
                    : '\u00A0'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

SplitDiffView.displayName = 'SplitDiffView';
