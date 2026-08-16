import React from 'react';
import { Columns, AlignJustify, FileText, Image as ImageIcon, Binary } from 'lucide-react';
import { DiffResult } from '../../../types/git';
import { isImageFile } from './diffUtils';

interface DiffHeaderProps {
  filePath: string;
  diffResult: DiffResult | null;
  diffViewMode: 'unified' | 'split';
  onChangeViewMode: (mode: 'unified' | 'split') => void;
  staged?: boolean;
}

/**
 * Header toolbar for active file diff, displaying file path, stats, and layout switcher.
 */
export const DiffHeader: React.FC<DiffHeaderProps> = ({
  filePath,
  diffResult,
  diffViewMode,
  onChangeViewMode,
  staged = false,
}) => {
  const isImage = isImageFile(filePath);
  const isBinary = diffResult?.is_binary || false;

  const additions = diffResult?.lines?.filter((l) => l.line_type === 'addition').length || 0;
  const deletions = diffResult?.lines?.filter((l) => l.line_type === 'deletion').length || 0;

  return (
    <div className="h-10 px-4 bg-base-1 border-b border-border flex items-center justify-between shrink-0 select-none">
      {/* File info */}
      <div className="flex items-center gap-2 min-w-0">
        {isImage ? (
          <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />
        ) : isBinary ? (
          <Binary className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-commito-coral shrink-0" />
        )}

        <span className="font-mono text-xs font-semibold text-text-primary truncate">{filePath}</span>

        {staged && (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-medium">
            Staged
          </span>
        )}

        {!isBinary && !isImage && (additions > 0 || deletions > 0) && (
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {additions > 0 && <span className="text-git-added font-semibold">+{additions}</span>}
            {deletions > 0 && <span className="text-git-removed font-semibold">-{deletions}</span>}
          </div>
        )}
      </div>

      {/* View mode toggle */}
      {!isImage && !isBinary && (
        <div className="flex items-center bg-base-0 border border-border rounded-md p-0.5">
          <button
            type="button"
            onClick={() => onChangeViewMode('unified')}
            className={`p-1 rounded text-xs transition cursor-pointer ${diffViewMode === 'unified'
              ? 'bg-base-2 text-text-primary shadow-xs'
              : 'text-text-muted hover:text-text-primary'
              }`}
            title="Unified View"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('split')}
            className={`p-1 rounded text-xs transition cursor-pointer ${diffViewMode === 'split'
              ? 'bg-base-2 text-text-primary shadow-xs'
              : 'text-text-muted hover:text-text-primary'
              }`}
            title="Split (Side-by-Side) View"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
