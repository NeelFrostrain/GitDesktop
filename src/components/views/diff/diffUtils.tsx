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
      className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-border bg-base-1 hover:bg-base-3 text-text-muted hover:text-text-primary transition cursor-pointer ${className}`}
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
 * Lightweight regex-based syntax highlighter for diff code lines.
 */
export function highlightCodeLine(text: string): React.ReactNode {
  if (!text) return text;

  const commentIdx = text.indexOf('//');
  if (commentIdx !== -1) {
    const codePart = text.substring(0, commentIdx);
    const commentPart = text.substring(commentIdx);
    return (
      <>
        {highlightCodeLine(codePart)}
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

    return <span key={i}>{token}</span>;
  });
}

export interface SplitRow {
  type: 'header' | 'code';
  headerText?: string;
  oldNum?: number;
  oldContent?: string;
  newNum?: number;
  newContent?: string;
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
        rows.push({ type: 'header', headerText: line.content });
      }
      i++;
      continue;
    }

    if (line.line_type === 'context') {
      rows.push({
        type: 'code',
        oldNum: line.old_line_num ?? undefined,
        oldContent: line.content,
        newNum: line.new_line_num ?? undefined,
        newContent: line.content,
      });
      i++;
      continue;
    }

    const delChunk: DiffLine[] = [];
    const addChunk: DiffLine[] = [];

    while (i < lines.length && lines[i].line_type === 'deletion') {
      delChunk.push(lines[i]);
      i++;
    }
    while (i < lines.length && lines[i].line_type === 'addition') {
      addChunk.push(lines[i]);
      i++;
    }

    const delCount = delChunk.length;
    const addCount = addChunk.length;

    if (delCount === addCount) {
      for (let j = 0; j < delCount; j++) {
        rows.push({
          type: 'code',
          oldNum: delChunk[j].old_line_num ?? undefined,
          oldContent: delChunk[j].content,
          newNum: addChunk[j].new_line_num ?? undefined,
          newContent: addChunk[j].content,
        });
      }
    } else if (delCount > addCount) {
      const unalignedDels = delCount - addCount;
      for (let j = 0; j < unalignedDels; j++) {
        rows.push({
          type: 'code',
          oldNum: delChunk[j].old_line_num ?? undefined,
          oldContent: delChunk[j].content,
          newNum: undefined,
          newContent: undefined,
        });
      }
      for (let j = 0; j < addCount; j++) {
        const delIndex = unalignedDels + j;
        rows.push({
          type: 'code',
          oldNum: delChunk[delIndex].old_line_num ?? undefined,
          oldContent: delChunk[delIndex].content,
          newNum: addChunk[j].new_line_num ?? undefined,
          newContent: addChunk[j].content,
        });
      }
    } else {
      for (let j = 0; j < delCount; j++) {
        rows.push({
          type: 'code',
          oldNum: delChunk[j].old_line_num ?? undefined,
          oldContent: delChunk[j].content,
          newNum: addChunk[j].new_line_num ?? undefined,
          newContent: addChunk[j].content,
        });
      }
      for (let j = delCount; j < addCount; j++) {
        rows.push({
          type: 'code',
          oldNum: undefined,
          oldContent: undefined,
          newNum: addChunk[j].new_line_num ?? undefined,
          newContent: addChunk[j].content,
        });
      }
    }
  }

  return rows;
}
