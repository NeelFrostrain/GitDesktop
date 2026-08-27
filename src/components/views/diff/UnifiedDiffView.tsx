import React from 'react';
import { DiffLine } from '../../../types/git';
import { buildDiffHunks, highlightCodeLine } from './diffUtils';

interface UnifiedDiffViewProps {
  lines: DiffLine[];
}

/**
 * Line-by-line unified diff table with syntax highlighting and line numbers.
 */
export const UnifiedDiffView: React.FC<UnifiedDiffViewProps> = ({ lines }) => {
  const hunks = buildDiffHunks(lines);

  if (hunks.length === 0 || lines.length === 0) {
    return (
      <div className="p-6 text-text-muted text-center font-mono text-xs">
        No textual line changes detected.
      </div>
    );
  }

  return (
    <div className="w-full font-mono text-[12px] leading-6 select-text">
      {hunks.map((hunk) => (
        <div key={hunk.id} className="relative">
          {/* Hunk Header Bar */}
          {hunk.headerContent && (
            <div className="bg-base-2/90 text-diff-highlight font-semibold px-3 py-1 border-y border-border/60 text-[11px] font-mono sticky top-0 z-10 select-none shadow-2xs backdrop-blur-xs">
              <span className="truncate">{hunk.headerContent}</span>
            </div>
          )}

          {/* Hunk Lines */}
          <div className="relative">
            {hunk.lines.map(({ line, originalIndex }) => {
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
                  key={originalIndex}
                  className={`flex w-full border-b border-border/20 transition-colors ${lineBg}`}
                >
                  {/* Old Line Number */}
                  <div className="w-12 px-2.5 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 shrink-0">
                    {line.old_line_num ?? ''}
                  </div>

                  {/* New Line Number */}
                  <div className="w-12 px-2.5 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 shrink-0">
                    {line.new_line_num ?? ''}
                  </div>

                  {/* Prefix Column */}
                  <div className="w-6 px-1 py-0.5 text-center select-none font-bold shrink-0">
                    {prefix}
                  </div>

                  {/* Code Content */}
                  <div
                    className={`flex-1 min-w-0 px-2 py-0.5 whitespace-pre-wrap break-all ${textColor}`}
                  >
                    {highlightCodeLine(line.content)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
