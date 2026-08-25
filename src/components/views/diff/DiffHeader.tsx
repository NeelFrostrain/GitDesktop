import React from 'react';
import {
  Columns,
  AlignJustify,
  FileText,
  Image as ImageIcon,
  Binary,
  Code2,
  Save,
  RotateCcw,
  Check,
  Loader2,
} from 'lucide-react';
import { DiffResult } from '../../../types/git';
import { isImageFile } from './diffUtils';

export interface DiffHeaderProps {
  filePath: string;
  diffResult: DiffResult | null;
  diffViewMode: 'unified' | 'split' | 'edit';
  onChangeViewMode: (mode: 'unified' | 'split' | 'edit') => void;
  staged?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  saveSuccess?: boolean;
  onSave?: () => void;
  onRevert?: () => void;
}

function getReadableLanguageName(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.gitignore')) return 'Gitignore';
  if (lower.endsWith('.dockerignore')) return 'Dockerignore';
  if (lower.endsWith('.env')) return 'Env';
  if (lower.endsWith('.ts')) return 'TypeScript';
  if (lower.endsWith('.tsx')) return 'TSX';
  if (lower.endsWith('.js')) return 'JavaScript';
  if (lower.endsWith('.jsx')) return 'JSX';
  if (lower.endsWith('.rs')) return 'Rust';
  if (lower.endsWith('.py')) return 'Python';
  if (lower.endsWith('.json')) return 'JSON';
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'YAML';
  if (lower.endsWith('.css')) return 'CSS';
  if (lower.endsWith('.scss')) return 'SCSS';
  if (lower.endsWith('.html')) return 'HTML';
  if (lower.endsWith('.md')) return 'Markdown';
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'Shell';
  if (lower.endsWith('.toml')) return 'TOML';
  if (lower.endsWith('.sql')) return 'SQL';
  return 'Text';
}

/**
 * Unified Header Toolbar for Diff & Edit modes with compact icon-only view switcher.
 */
export const DiffHeader: React.FC<DiffHeaderProps> = ({
  filePath,
  diffResult,
  diffViewMode,
  onChangeViewMode,
  staged = false,
  isDirty = false,
  isSaving = false,
  saveSuccess = false,
  onSave,
  onRevert,
}) => {
  const isImage = isImageFile(filePath);
  const isBinary = diffResult?.is_binary || false;
  const langLabel = getReadableLanguageName(filePath);

  const additions = diffResult?.lines?.filter((l) => l.line_type === 'addition').length || 0;
  const deletions = diffResult?.lines?.filter((l) => l.line_type === 'deletion').length || 0;

  return (
    <div className="h-9 px-3 bg-base-1 border-b border-border flex items-center justify-between shrink-0 select-none text-xs">
      {/* Left: File info & state tags */}
      <div className="flex items-center gap-2 min-w-0">
        {isImage ? (
          <ImageIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        ) : isBinary ? (
          <Binary className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-commito-coral shrink-0" />
        )}

        <span className="font-mono text-xs font-semibold text-text-primary truncate max-w-[240px]">
          {filePath}
        </span>

        {/* Language badge in edit mode */}
        {diffViewMode === 'edit' && (
          <span className="px-1.5 py-0.2 bg-base-2 border border-border rounded-xs text-[10px] font-mono text-text-muted">
            {langLabel}
          </span>
        )}

        {/* Staged chip */}
        {staged && (
          <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-git-added-bg text-git-added border border-git-added/30 font-medium">
            Staged
          </span>
        )}

        {/* Diff Stats (when in unified / split mode) */}
        {diffViewMode !== 'edit' && !isBinary && !isImage && (additions > 0 || deletions > 0) && (
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {additions > 0 && <span className="text-git-added font-semibold">+{additions}</span>}
            {deletions > 0 && <span className="text-git-removed font-semibold">-{deletions}</span>}
          </div>
        )}

        {/* Dirty indicator (when in edit mode) */}
        {diffViewMode === 'edit' && (
          isDirty ? (
            <span className="flex items-center gap-1 text-[10px] font-medium text-git-modified bg-git-modified-bg border border-git-modified/30 px-1.5 py-0.2 rounded-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-git-modified animate-pulse" />
              Unsaved
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-medium text-git-added bg-git-added-bg border border-git-added/30 px-1.5 py-0.2 rounded-xs">
              <Check className="w-2.5 h-2.5" />
              Clean
            </span>
          )
        )}
      </div>

      {/* Right: Actions & Compact Icon Switcher */}
      {!isImage && !isBinary && (
        <div className="flex items-center gap-2">
          {/* Edit mode Save & Revert action buttons */}
          {diffViewMode === 'edit' && (
            <div className="flex items-center gap-1.5">
              {isDirty && onRevert && (
                <button
                  type="button"
                  onClick={onRevert}
                  className="h-6.5 px-2 flex items-center gap-1 bg-base-0/80 hover:bg-base-2 text-git-removed hover:bg-git-removed/10 rounded-sm border border-border transition cursor-pointer text-[11px] shadow-2xs"
                  title="Revert buffer to disk content"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Revert</span>
                </button>
              )}

              {onSave && (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!isDirty || isSaving}
                  className={`h-6.5 px-2.5 flex items-center gap-1.5 rounded-sm font-semibold text-[11px] transition shadow-xs cursor-pointer ${
                    saveSuccess
                      ? 'bg-git-added text-white'
                      : isDirty
                      ? 'bg-commito-coral hover:bg-commito-coralLight text-white active:scale-95'
                      : 'bg-base-2 text-text-faint border border-border cursor-not-allowed opacity-60'
                  }`}
                  title="Save file changes (Ctrl+S)"
                >
                  {isSaving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  <span>{saveSuccess ? 'Saved' : isSaving ? 'Saving...' : 'Save'}</span>
                </button>
              )}
            </div>
          )}

          {/* Compact Icon-Only View Mode Switcher */}
          <div className="h-6.5 flex items-center bg-base-0 border border-border rounded-sm p-0.5 gap-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => onChangeViewMode('unified')}
              className={`h-full w-6 rounded-xs transition cursor-pointer flex items-center justify-center ${
                diffViewMode === 'unified'
                  ? 'bg-base-2 text-text-primary shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-primary hover:bg-base-2/50'
              }`}
              title="Unified Diff View"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('split')}
              className={`h-full w-6 rounded-xs transition cursor-pointer flex items-center justify-center ${
                diffViewMode === 'split'
                  ? 'bg-base-2 text-text-primary shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-primary hover:bg-base-2/50'
              }`}
              title="Split (Side-by-Side) Diff View"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('edit')}
              className={`h-full w-6 rounded-xs transition cursor-pointer flex items-center justify-center ${
                diffViewMode === 'edit'
                  ? 'bg-commito-coral/20 text-commito-coral border border-commito-coral/40 shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-primary hover:bg-base-2/50'
              }`}
              title="Edit File / Mini IDE"
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
