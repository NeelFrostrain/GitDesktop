import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Edit3,
  X,
  Loader2,
  AlertCircle,
  CornerDownLeft,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useToastStore } from '../../store/useToastStore';
import { useLogStore } from '../../store/useLogStore';
import { useRepoStore } from '../../store/repoStore';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';

export interface RenameItemModalProps {
  isOpen: boolean;
  filePath: string;
  onClose: () => void;
  onSuccess?: (newPath: string) => void;
}

/**
 * Deep Dark Obsidian Modal Dialog with rounded-sm geometry for renaming files.
 */
export const RenameItemModal: React.FC<RenameItemModalProps> = ({
  isOpen,
  filePath,
  onClose,
  onSuccess,
}) => {
  const { activeRepoPath, setStatus, selectedFile, setSelectedFile } = useGitStore();
  const [newPathInput, setNewPathInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNewPathInput(filePath);
      setError(null);
      setIsSubmitting(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Select only the file name part before extension for convenience
          const lastSlash = filePath.lastIndexOf('/');
          const lastBackslash = filePath.lastIndexOf('\\');
          const startIdx = Math.max(lastSlash, lastBackslash) + 1;
          const dotIdx = filePath.lastIndexOf('.');
          const endIdx = dotIdx > startIdx ? dotIdx : filePath.length;
          inputRef.current.setSelectionRange(startIdx, endIdx);
        }
      }, 50);
    }
  }, [isOpen, filePath]);

  if (!isOpen) return null;

  const cleanOldPath = filePath.trim();
  const cleanNewPath = newPathInput.trim().replace(/^[/\\]+/, '');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cleanNewPath || isSubmitting) return;

    if (cleanNewPath === cleanOldPath) {
      onClose();
      return;
    }

    if (!activeRepoPath) {
      setError('No active repository open.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Rename file via Rust backend
      await GitService.renameFile(activeRepoPath, cleanOldPath, cleanNewPath);

      // 2. Refresh git repo status
      const latestStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(latestStatus);
      useRepoStore.getState().refreshStatus(activeRepoPath).catch(() => {});

      // 3. Update active selected file if this file was selected
      if (selectedFile === cleanOldPath) {
        setSelectedFile(cleanNewPath);
      }

      useLogStore
        .getState()
        .addLog('success', 'Git', `Renamed '${cleanOldPath}' to '${cleanNewPath}'`);

      useToastStore.getState().showToast({
        type: 'success',
        title: 'File Renamed',
        message: `Successfully renamed to '${cleanNewPath}'`,
      });

      onSuccess?.(cleanNewPath);
      onClose();
    } catch (err: unknown) {
      const appErr = toAppError(err);
      setError(appErr.message || getErrorMessage(err) || 'Failed to rename file.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-100 font-sans select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-md bg-base-0 border border-border-strong rounded-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-base-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral">
              <Edit3 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-text-primary leading-none">Rename File</h3>
              <p className="text-[10px] text-text-muted mt-0.5 leading-none">
                Update path or name in working tree
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer disabled:opacity-50"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {/* Current Path Info */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-text-muted block">
              Original Path
            </label>
            <div className="px-2.5 py-1.5 bg-base-1 border border-border/70 rounded-sm font-mono text-xs text-text-secondary truncate">
              {cleanOldPath}
            </div>
          </div>

          {/* New Path Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-text-primary block">
              New File Path
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={newPathInput}
                onChange={(e) => {
                  setNewPathInput(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSubmitting}
                placeholder="e.g. src/components/NewName.tsx"
                className="w-full h-8 px-2.5 font-mono text-xs text-text-primary bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm focus:outline-none focus:ring-1 focus:ring-commito-coral/30 transition shadow-inner placeholder:text-text-faint"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-2 rounded-sm bg-git-removed-bg border border-git-removed/30 text-git-removed text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-7 px-3 rounded-sm border border-border bg-base-1 hover:bg-base-2 text-text-secondary hover:text-text-primary text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !cleanNewPath || cleanNewPath === cleanOldPath}
              className="h-7 px-3.5 rounded-sm bg-commito-coral hover:bg-commito-coralLight text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Renaming...</span>
                </>
              ) : (
                <>
                  <span>Rename</span>
                  <CornerDownLeft className="w-3 h-3 opacity-75" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
