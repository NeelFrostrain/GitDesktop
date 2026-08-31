import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FilePlus,
  FolderPlus,
  X,
  Folder,
  AlertCircle,
  FileCode,
  CornerDownLeft,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useAppLogStore } from '../../core/logging/logStore';
import { GitService } from '../../services/git/gitService';
import { SystemService } from '../../services/system/systemService';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Button } from '../common/Button';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';

export interface CreateItemModalProps {
  isOpen: boolean;
  itemType: 'file' | 'folder';
  onClose: () => void;
  onSuccess?: (createdPath: string) => void;
}

const COMMON_FILE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.json',
  '.css',
  '.md',
  '.rs',
  '.py',
  '.gitignore',
  '.env',
];

/**
 * Deep Dark Obsidian Modal Dialog with crisp rounded-sm geometry for creating new files & folders.
 */
export const CreateItemModal: React.FC<CreateItemModalProps> = ({
  isOpen,
  itemType,
  onClose,
  onSuccess,
}) => {
  const { activeRepoPath, setStatus, setSelectedFile, setDiffViewMode } = useGitStore();
  const [pathInput, setPathInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDirty = pathInput.trim() !== '';

  const { showConfirm, requestClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard({
    isDirty,
    onClose,
  });

  useEffect(() => {
    if (isOpen) {
      setPathInput('');
      setError(null);
      setIsSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, itemType]);

  if (!isOpen) return null;

  const isFile = itemType === 'file';
  const cleanPath = pathInput.trim().replace(/^[/\\]+/, '');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cleanPath || isSubmitting) return;

    if (!activeRepoPath) {
      setError('No active repository open.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isFile) {
        // 1. Create file on disk via backend
        await GitService.saveFileContent(activeRepoPath, cleanPath, '');

        // 2. Refresh git repo status
        const latestStatus = await GitService.getRepoStatus(activeRepoPath);
        setStatus(latestStatus);

        // 3. Select file and switch to Edit mode immediately
        setSelectedFile(cleanPath);
        setDiffViewMode('edit');

        useAppLogStore.getState().addLog('Success', 'Git', `Created file: ${cleanPath}`);
      } else {
        // 1. Create folder on disk via backend
        await SystemService.createDirectory(activeRepoPath, cleanPath);
        useAppLogStore.getState().addLog('Success', 'Git', `Created folder: ${cleanPath}`);
      }

      if (onSuccess) onSuccess(cleanPath);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || `Failed to create ${itemType}`);
      useAppLogStore
        .getState()
        .addLog('Error', 'Git', `Failed to create ${itemType} ${cleanPath}: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppendExtension = (ext: string) => {
    if (ext === '.gitignore' || ext === '.env') {
      setPathInput(ext);
    } else if (!pathInput.endsWith(ext)) {
      setPathInput((prev) => `${prev.replace(/\.[^/.]+$/, '')}${ext}`);
    }
    inputRef.current?.focus();
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          requestClose();
        }
      }}
      className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-100 select-none"
    >
      {/* Modal Dialog Card */}
      <div
        className="w-full max-w-[390px] bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact 1-Row Header */}
        <div className="px-3.5 py-2 border-b border-border bg-base-1 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-5 h-5 rounded-sm flex items-center justify-center border shrink-0 ${
                isFile
                  ? 'bg-commito-coral/15 border-commito-coral/30 text-commito-coral'
                  : 'bg-git-added-bg border-git-added/30 text-git-added'
              }`}
            >
              {isFile ? <FilePlus className="w-3 h-3" /> : <FolderPlus className="w-3 h-3" />}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-xs font-bold text-text-primary leading-none">
                {isFile ? 'Create New File' : 'Create New Folder'}
              </h2>
              <span className="text-border">•</span>
              <span className="text-[10.5px] text-text-muted truncate">
                {isFile ? 'Repository root' : 'New directory'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={requestClose}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer shrink-0"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          id="create-item-form"
          onSubmit={handleSubmit}
          className="p-3.5 flex flex-col gap-2.5 bg-base-0 flex-1 overflow-y-auto"
        >
          {/* Text Input */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              <span>{isFile ? 'FILE PATH' : 'FOLDER PATH'}</span>
              <span className="font-mono text-[9px] text-text-faint font-normal">
                Relative to root
              </span>
            </div>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={pathInput}
                onChange={(e) => {
                  setPathInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={
                  isFile ? 'e.g. src/components/Header.tsx or .gitignore' : 'e.g. src/components'
                }
                className="w-full h-7.5 px-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-2xs"
              />
            </div>
          </div>

          {/* Quick extension chips for files */}
          {isFile && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-text-faint mr-0.5 flex items-center gap-1 font-mono">
                <FileCode className="w-2.5 h-2.5" /> Quick:
              </span>
              {COMMON_FILE_EXTENSIONS.map((ext) => (
                <button
                  key={ext}
                  type="button"
                  onClick={() => handleAppendExtension(ext)}
                  className="px-1.5 py-0.5 rounded-sm bg-base-1 hover:bg-base-2 border border-border text-[10px] font-mono text-text-muted hover:text-text-primary hover:border-border-strong transition cursor-pointer"
                >
                  {ext}
                </button>
              ))}
            </div>
          )}

          {/* Destination Path Preview */}
          {cleanPath && activeRepoPath && (
            <div className="px-2 py-1 bg-base-1 border border-border rounded-sm flex items-center gap-1.5 text-[10px] font-mono text-text-muted overflow-hidden">
              <Folder className="w-3 h-3 text-text-faint shrink-0" />
              <span className="truncate text-text-faint">{activeRepoPath}\</span>
              <span className="font-semibold text-commito-coral shrink-0">{cleanPath}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="px-2 py-1 bg-git-removed-bg border border-git-removed/40 rounded-sm flex items-center gap-1.5 text-xs text-git-removed animate-in fade-in duration-100">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}
        </form>

        {/* Pinned Bottom Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-3.5 py-2.5 bg-base-1 border-t border-border shrink-0 select-none">
          <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
            Cancel
          </Button>

          <Button
            type="submit"
            form="create-item-form"
            variant={isFile ? 'coral' : 'emerald'}
            size="sm"
            disabled={!cleanPath || isSubmitting}
            isLoading={isSubmitting}
            leftIcon={
              !isSubmitting ? (
                isFile ? (
                  <FilePlus className="w-3.5 h-3.5" />
                ) : (
                  <FolderPlus className="w-3.5 h-3.5" />
                )
              ) : undefined
            }
            rightIcon={
              !isSubmitting ? <CornerDownLeft className="w-3 h-3 opacity-75" /> : undefined
            }
          >
            {isFile ? 'Create File' : 'Create Folder'}
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirm}
        title={`Unsaved ${isFile ? 'File' : 'Folder'} Path`}
        description={`You have entered an unsaved path "${cleanPath}". If you discard, this will not be created.`}
        discardText="Discard Changes"
        saveText={cleanPath ? `Create ${isFile ? 'File' : 'Folder'}` : undefined}
        cancelText="Keep Editing"
        isSaving={isSubmitting}
        onDiscard={confirmDiscard}
        onSave={() => handleSubmit()}
        onCancel={cancelDiscard}
      />
    </div>,
    document.body
  );
};
