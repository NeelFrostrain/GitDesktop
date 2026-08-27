import React from 'react';
import { DiffLine } from '../../../types/git';
import { buildSplitRows, highlightCodeLine } from './diffUtils';

interface SplitDiffViewProps {
  lines: DiffLine[];
}

/**
 * Side-by-side split diff layout table with aligned chunks and syntax highlighting.
 */
export const SplitDiffView: React.FC<SplitDiffViewProps> = ({ lines }) => {
  const splitRows = buildSplitRows(lines);

  if (splitRows.length === 0) {
    return (
      <div className="p-6 text-text-muted text-center font-mono text-xs">
        No textual line changes detected.
      </div>
    );
  }

  return (
    <div className="w-full font-mono text-[12px] leading-6 select-text">
      {splitRows.map((row, idx) => {
        if (row.type === 'header') {
          return (
            <div
              key={idx}
              className="bg-base-2 text-diff-highlight font-semibold px-4 py-0.5 border-y border-border/50 text-[11px] font-mono sticky top-0 z-10 select-none shadow-2xs backdrop-blur-xs"
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
          <div key={idx} className="flex w-full border-b border-border/20 leading-6 text-[12px] font-mono">
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
              <div className="w-12 px-2.5 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 shrink-0 min-h-[24px]">
                {row.oldNum ?? ''}
              </div>
              <div className="w-5 px-1 py-0.5 text-center select-none font-bold text-diff-remove-text shrink-0">
                {!isOldEmpty && (isDel || isModified) ? '-' : ''}
              </div>
              <div className="flex-1 min-w-0 px-2 py-0.5 whitespace-pre-wrap break-all min-h-[24px]">
                {row.oldContent !== undefined ? highlightCodeLine(row.oldContent) : '\u00A0'}
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
              <div className="w-12 px-2.5 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 shrink-0 min-h-[24px]">
                {row.newNum ?? ''}
              </div>
              <div className="w-5 px-1 py-0.5 text-center select-none font-bold text-diff-add-text shrink-0">
                {!isNewEmpty && (isAdd || isModified) ? '+' : ''}
              </div>
              <div className="flex-1 min-w-0 px-2 py-0.5 whitespace-pre-wrap break-all min-h-[24px]">
                {row.newContent !== undefined ? highlightCodeLine(row.newContent) : '\u00A0'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
