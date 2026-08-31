import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { DiffLine } from '../../../types/git';

export const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'ico',
  'bmp',
  'avif',
  'icns',
]);

/**
 * Checks if a file path points to an image format.
 */
export function isImageFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

/**
 * Reusable clipboard copy button with temporary success feedback.
 */
export const CopyButton: React.FC<CopyButtonProps> = ({ text, label, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-border bg-base-1 hover:bg-base-3 text-text-muted hover:text-text-primary transition cursor-pointer leading-none ${className}`}
      title={copied ? 'Copied to clipboard!' : `Copy ${label || text}`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-gitlab-teal" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span>{label || 'Copy'}</span>
        </>
      )}
    </button>
  );
};

const HIGHLIGHT_KEYWORDS = new Set([
  'const',
  'let',
  'var',
  'function',
  'return',
  'export',
  'import',
  'from',
  'default',
  'type',
  'interface',
  'async',
  'await',
  'if',
  'else',
  'for',
  'while',
  'switch',
  'case',
  'break',
  'try',
  'catch',
  'pub',
  'fn',
  'struct',
  'enum',
  'impl',
  'use',
  'mod',
  'mut',
  'ref',
  'match',
  'self',
  'Self',
  'true',
  'false',
  'null',
  'undefined',
  'None',
  'Some',
  'Ok',
  'Err',
  'new',
  'delete',
  'void',
  'typeof',
  'instanceof',
  'as',
]);

/**
 * Lightweight regex-based syntax highlighter for diff code lines with fast-path optimization.
 */
export function highlightCodeLine(text: string, enableHighlight = true): React.ReactNode {
  if (!text) return text;
  // Fast path: skip expensive tokenization for massive lines or when highlighting is disabled for large diffs
  if (!enableHighlight || text.length > 200) return text;

  const commentIdx = text.indexOf('//');
  if (commentIdx !== -1) {
    const codePart = text.substring(0, commentIdx);
    const commentPart = text.substring(commentIdx);
    return (
      <>
        {highlightCodeLine(codePart, enableHighlight)}
        <span className="text-gray-500 italic">{commentPart}</span>
      </>
    );
  }

  const regex = /(".*?"|'.*?'|`.*?`|\b\d+\b|\b[a-zA-Z_]\w*\b|[^\s\w]+|\s+)/g;
  const matches = text.match(regex);

  if (!matches) return text;

  return matches.map((token, i) => {
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'")) ||
      (token.startsWith('`') && token.endsWith('`'))
    ) {
      return (
        <span key={i} className="text-amber-300">
          {token}
        </span>
      );
    }

    if (/^\d+$/.test(token)) {
      return (
        <span key={i} className="text-orange-300">
          {token}
        </span>
      );
    }

    if (HIGHLIGHT_KEYWORDS.has(token)) {
      return (
        <span key={i} className="text-pink-400 font-medium">
          {token}
        </span>
      );
    }

    if (/^[A-Z][a-zA-Z0-9_]*$/.test(token)) {
      return (
        <span key={i} className="text-cyan-300 font-medium">
          {token}
        </span>
      );
    }

    return token;
  });
}

export interface SplitRow {
  type: 'header' | 'code';
  headerText?: string;
  headerIndex?: number;
  oldNum?: number;
  oldContent?: string;
  oldIndex?: number;
  oldType?: 'deletion' | 'context';
  newNum?: number;
  newContent?: string;
  newIndex?: number;
  newType?: 'addition' | 'context';
}

export function isVerbosePatchHeader(content: string): boolean {
  const trimmed = content.trim();
  return (
    trimmed.startsWith('diff --git') ||
    trimmed.startsWith('new file mode') ||
    trimmed.startsWith('deleted file mode') ||
    trimmed.startsWith('index ') ||
    trimmed.startsWith('--- ') ||
    trimmed.startsWith('+++ ')
  );
}

export interface DiffHunk {
  id: string;
  headerIndex: number;
  headerContent: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: {
    line: DiffLine;
    originalIndex: number;
  }[];
}

/**
 * Organizes diff line stream into individual structured hunks.
 */
export function buildDiffHunks(lines: DiffLine[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let hunkCounter = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const l = lines[idx];
    if (l.line_type === 'header') {
      if (isVerbosePatchHeader(l.content)) continue;
      const match = l.content.match(/@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (match) {
        if (currentHunk && currentHunk.lines.length > 0) {
          hunks.push(currentHunk);
        }
        hunkCounter++;
        currentHunk = {
          id: `hunk-${hunkCounter}-${idx}`,
          headerIndex: idx,
          headerContent: l.content,
          oldStart: parseInt(match[1], 10),
          oldCount: match[2] !== undefined ? parseInt(match[2], 10) : 1,
          newStart: parseInt(match[3], 10),
          newCount: match[4] !== undefined ? parseInt(match[4], 10) : 1,
          lines: [],
        };
        continue;
      }
    }

    if (!currentHunk) {
      hunkCounter++;
      currentHunk = {
        id: `hunk-${hunkCounter}-${idx}`,
        headerIndex: -1,
        headerContent: '',
        oldStart: 1,
        oldCount: 0,
        newStart: 1,
        newCount: 0,
        lines: [],
      };
    }
    currentHunk.lines.push({ line: l, originalIndex: idx });
  }

  if (currentHunk && currentHunk.lines.length > 0) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Builds a valid Git unified patch containing ONLY the selected line modifications.
 */
export function buildCustomDiffPatch(
  filePath: string,
  lines: DiffLine[],
  selectedIndices: Set<number>
): string | null {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const hunks = buildDiffHunks(lines);

  if (hunks.length === 0) return null;

  const patchedHunkStrings: string[] = [];

  for (const hunk of hunks) {
    let hasSelectedChange = false;
    let oldLineCount = 0;
    let newLineCount = 0;
    const hunkBodyLines: string[] = [];

    for (const item of hunk.lines) {
      const { line, originalIndex } = item;
      const cleanContent = line.content.replace(/^[+\-\s]/, '');

      if (line.line_type === 'addition') {
        if (selectedIndices.has(originalIndex)) {
          hasSelectedChange = true;
          hunkBodyLines.push(`+${cleanContent}`);
          newLineCount++;
        }
        // Unselected addition is omitted from the patch
      } else if (line.line_type === 'deletion') {
        if (selectedIndices.has(originalIndex)) {
          hasSelectedChange = true;
          hunkBodyLines.push(`-${cleanContent}`);
          oldLineCount++;
        } else {
          // Unselected deletion is kept as unchanged context line
          hunkBodyLines.push(` ${cleanContent}`);
          oldLineCount++;
          newLineCount++;
        }
      } else {
        // Context line
        hunkBodyLines.push(` ${cleanContent}`);
        oldLineCount++;
        newLineCount++;
      }
    }

    if (hasSelectedChange && hunkBodyLines.length > 0) {
      const headerStr = `@@ -${hunk.oldStart},${oldLineCount} +${hunk.newStart},${newLineCount} @@`;
      patchedHunkStrings.push(`${headerStr}\n${hunkBodyLines.join('\n')}`);
    }
  }

  if (patchedHunkStrings.length === 0) return null;

  const patchHeader = [`--- a/${normalizedPath}`, `+++ b/${normalizedPath}`].join('\n');

  return `${patchHeader}\n${patchedHunkStrings.join('\n')}\n`;
}

/**
 * Aligns deletion and addition diff chunks into parallel rows for side-by-side split diff inspection.
 */
export function buildSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.line_type === 'header') {
      if (!isVerbosePatchHeader(line.content)) {
        rows.push({ type: 'header', headerText: line.content, headerIndex: i });
      }
      i++;
      continue;
    }

    if (line.line_type === 'context') {
      rows.push({
        type: 'code',
        oldNum: line.old_line_num ?? undefined,
        oldContent: line.content,
        oldIndex: i,
        oldType: 'context',
        newNum: line.new_line_num ?? undefined,
        newContent: line.content,
        newIndex: i,
        newType: 'context',
      });
      i++;
      continue;
    }

    const delChunk: { line: DiffLine; index: number }[] = [];
    const addChunk: { line: DiffLine; index: number }[] = [];

    while (i < lines.length && lines[i].line_type === 'deletion') {
      delChunk.push({ line: lines[i], index: i });
      i++;
    }
    while (i < lines.length && lines[i].line_type === 'addition') {
      addChunk.push({ line: lines[i], index: i });
      i++;
    }

    const delCount = delChunk.length;
    const addCount = addChunk.length;

    if (delCount === addCount) {
      for (let j = 0; j < delCount; j++) {
        rows.push({
          type: 'code',
          oldNum: delChunk[j].line.old_line_num ?? undefined,
          oldContent: delChunk[j].line.content,
          oldIndex: delChunk[j].index,
          oldType: 'deletion',
          newNum: addChunk[j].line.new_line_num ?? undefined,
          newContent: addChunk[j].line.content,
          newIndex: addChunk[j].index,
          newType: 'addition',
        });
      }
    } else if (delCount > addCount) {
      const unalignedDels = delCount - addCount;
      for (let j = 0; j < unalignedDels; j++) {
        rows.push({
          type: 'code',
          oldNum: delChunk[j].line.old_line_num ?? undefined,
          oldContent: delChunk[j].line.content,
          oldIndex: delChunk[j].index,
          oldType: 'deletion',
          newNum: undefined,
          newContent: undefined,
        });
      }
      for (let j = 0; j < addCount; j++) {
        const delIndex = unalignedDels + j;
        rows.push({
          type: 'code',
          oldNum: delChunk[delIndex].line.old_line_num ?? undefined,
          oldContent: delChunk[delIndex].line.content,
          oldIndex: delChunk[delIndex].index,
          oldType: 'deletion',
          newNum: addChunk[j].line.new_line_num ?? undefined,
          newContent: addChunk[j].line.content,
          newIndex: addChunk[j].index,
          newType: 'addition',
        });
      }
    } else {
      for (let j = 0; j < delCount; j++) {
        rows.push({
          type: 'code',
          oldNum: delChunk[j].line.old_line_num ?? undefined,
          oldContent: delChunk[j].line.content,
          oldIndex: delChunk[j].index,
          oldType: 'deletion',
          newNum: addChunk[j].line.new_line_num ?? undefined,
          newContent: addChunk[j].line.content,
          newIndex: addChunk[j].index,
          newType: 'addition',
        });
      }
      for (let j = delCount; j < addCount; j++) {
        rows.push({
          type: 'code',
          oldNum: undefined,
          oldContent: undefined,
          newNum: addChunk[j].line.new_line_num ?? undefined,
          newContent: addChunk[j].line.content,
          newIndex: addChunk[j].index,
          newType: 'addition',
        });
      }
    }
  }

  return rows;
}
