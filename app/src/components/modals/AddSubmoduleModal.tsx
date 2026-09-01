import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Boxes,
  X,
  AlertCircle,
  GitBranch,
  Folder,
  Globe,
  Check,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { useToastStore } from '../../store/useToastStore';
import { GitService } from '../../services/git/gitService';
import { Button } from '../common/Button';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { ConfirmDialog } from '../common/ConfirmDialog';

export interface AddSubmoduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Deep Dark Obsidian Modal Dialog matching application style for adding new Git submodules.
 */
export const AddSubmoduleModal: React.FC<AddSubmoduleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeRepoPath, setStatus, setSubmodules } = useGitStore();
  const { showToast } = useToastStore();

  const [url, setUrl] = useState('');
  const [path, setPath] = useState('');
  const [branch, setBranch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus and reset state when opening
  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setPath('');
      setBranch('');
      setError(null);
      setTimeout(() => urlInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const isDirty = useMemo(() => {
    return url.trim() !== '' || path.trim() !== '' || branch.trim() !== '';
  }, [url, path, branch]);

  const { showConfirm, requestClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard({
    isDirty,
    onClose,
  });

  // Derive suggested destination path from URL
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    setError(null);

    const clean = newUrl.trim().replace(/\.git$/, '');
    const parts = clean.split(/[/:]/);
    const lastPart = parts[parts.length - 1];

    if (lastPart && (!path || path === '' || path === lastPart.slice(0, -1))) {
      setPath(lastPart);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath) return;

    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setError('Please enter a valid Git repository clone URL.');
      return;
    }

    const cleanPath = path.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleanPath) {
      setError('Please specify a destination folder path.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await GitService.addSubmodule(
        activeRepoPath,
        cleanUrl,
        cleanPath,
        branch.trim() || undefined
      );

      useLogStore
        .getState()
        .addLog('success', 'Git', `Added submodule '${cleanPath}' from ${cleanUrl}`);

      showToast({
        type: 'success',
        title: 'Submodule Added',
        message: `Successfully added '${cleanPath}' to repository.`,
      });

      // Refresh submodules & status in background
      try {
        const [subs, newStatus] = await Promise.all([
          GitService.listSubmodules(activeRepoPath),
          GitService.getRepoStatus(activeRepoPath),
        ]);
        if (subs) setSubmodules(subs);
        if (newStatus) setStatus(newStatus);
      } catch {}

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to add submodule. Verify the repository URL is reachable.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none animate-in fade-in duration-100 font-sans">
        <div
          className="w-full max-w-lg bg-base-1 border border-border-strong rounded-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100"
          role="dialog"
          aria-modal="true"
        >
          {/* Modal Header */}
          <div className="px-5 py-4 border-b border-border bg-base-2/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-base-2 border border-border text-gitlab-teal flex items-center justify-center shrink-0">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Add Git Submodule</h2>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Nest an external Git repository into your current project (.gitmodules)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={requestClose}
              disabled={isSubmitting}
              className="p-1 rounded-xs text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-git-removed-bg border border-git-removed/40 rounded-sm text-xs text-git-removed flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed flex-1">{error}</span>
                </div>
              )}

              {/* Repository URL */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-text-muted" />
                  <span>Repository URL</span>
                  <span className="text-commito-coral">*</span>
                </label>
                <input
                  ref={urlInputRef}
                  type="text"
                  required
                  disabled={isSubmitting}
                  placeholder="e.g. https://github.com/CyronicStudio/git-desktop.git"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="w-full h-8 px-3 bg-base-0 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-2xs"
                />
                <p className="text-[11px] text-text-muted">
                  Supports HTTPS and SSH clone URLs.
                </p>
              </div>

              {/* Destination Path */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-text-muted" />
                  <span>Destination Path</span>
                  <span className="text-commito-coral">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  placeholder="e.g. git-desktop-public or plugins/HealthSystem"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  className="w-full h-8 px-3 bg-base-0 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-2xs"
                />
                <p className="text-[11px] text-text-muted">
                  The directory path inside this repository where the submodule will reside.
                </p>
              </div>

              {/* Branch (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-text-muted" />
                  <span>Branch to Track <span className="text-text-muted font-normal">(Optional)</span></span>
                </label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  placeholder="e.g. main, dev, or leave empty for default"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full h-8 px-3 bg-base-0 border border-border hover:border-border-strong focus:border-border-strong rounded-sm text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-2xs"
                />
                <p className="text-[11px] text-text-muted">
                  If set, updates can pull changes directly from this upstream branch.
                </p>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-5 py-3 border-t border-border bg-base-2/20 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isSubmitting}
                onClick={requestClose}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="coral"
                size="sm"
                disabled={isSubmitting || !url.trim() || !path.trim()}
                isLoading={isSubmitting}
                leftIcon={!isSubmitting ? <Check className="w-3.5 h-3.5" /> : undefined}
              >
                {isSubmitting ? 'Adding Submodule...' : 'Add Submodule'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Unsaved Changes Guard Dialog */}
      <ConfirmDialog
        isOpen={showConfirm}
        title="Discard Submodule Form"
        subtitle="Unsaved inputs"
        description="You have unsaved changes in this form. Are you sure you want to discard them and close?"
        discardText="Discard"
        cancelText="Keep Editing"
        variant="warning"
        onDiscard={confirmDiscard}
        onCancel={cancelDiscard}
      />
    </>,
    document.body
  );
};
