import React from 'react';
import { DiffLine } from '../../../types/git';
import { highlightCodeLine, isVerbosePatchHeader } from './diffUtils';

interface UnifiedDiffViewProps {
  lines: DiffLine[];
}

/**
 * Line-by-line unified diff table with syntax highlighting and line numbers.
 */
export const UnifiedDiffView: React.FC<UnifiedDiffViewProps> = ({ lines }) => {
  const filteredLines = lines.filter(
    (l) =>
      !(l.line_type === 'header' && isVerbosePatchHeader(l.content)) &&
      !l.content.trim().startsWith('\\ No newline at end of file')
  );

  if (filteredLines.length === 0) {
    return (
      <div className="p-6 text-text-muted text-center font-mono text-xs">
        No textual line changes detected.
      </div>
    );
  }

  return (
    <div className="w-full font-mono text-[12px] leading-6 select-text">
      {filteredLines.map((line, idx) => {
        let lineBg = 'hover:bg-base-3/30';
        let textColor = 'text-text-primary';
        let prefix = ' ';

        if (line.line_type === 'addition') {
          lineBg = 'bg-green-950/40 text-green-300';
          textColor = 'text-green-300';
          prefix = '+';
        } else if (line.line_type === 'deletion') {
          lineBg = 'bg-red-950/40 text-red-300';
          textColor = 'text-red-300';
          prefix = '-';
        } else if (line.line_type === 'header') {
          lineBg = 'bg-base-2 text-gitlab-blue font-semibold text-[11px] py-0.5';
        }

        return (
          <div key={idx} className={`flex w-full border-b border-border/20 ${lineBg}`}>
            <div className="w-12 px-2 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 flex-shrink-0">
              {line.old_line_num ?? ''}
            </div>
            <div className="w-12 px-2 py-0.5 text-right text-text-faint select-none border-r border-border/30 bg-base-1/50 flex-shrink-0">
              {line.new_line_num ?? ''}
            </div>
            <div className="w-6 px-1 py-0.5 text-center select-none font-bold flex-shrink-0">
              {prefix}
            </div>
            <div className={`flex-1 min-w-0 px-2 py-0.5 whitespace-pre-wrap break-all ${textColor}`}>
              {line.line_type === 'header' ? line.content : highlightCodeLine(line.content)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
