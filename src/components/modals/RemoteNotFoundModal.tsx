import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Upload } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';

/**
 * Error modal dialog displayed when the remote Git repository was deleted,
 * renamed, or is inaccessible on GitHub, GitLab, or Bitbucket.
 */
export const RemoteNotFoundModal: React.FC = () => {
  const {
    isRemoteNotFoundModalOpen,
    setIsRemoteNotFoundModalOpen,
    setIsPublishRepoModalOpen,
    status,
    setStatus,
  } = useGitStore();

  const handleClose = useCallback(() => {
    // Unlink the dead remote so UI permanently recognizes it as ready to publish
    if (status) {
      setStatus({
        ...status,
        has_remote: false,
        remote_url: null,
      });
    }
    setIsRemoteNotFoundModalOpen(false);
  }, [status, setStatus, setIsRemoteNotFoundModalOpen]);

  const handlePublish = useCallback(() => {
    handleClose();
    setIsPublishRepoModalOpen(true);
  }, [handleClose, setIsPublishRepoModalOpen]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isRemoteNotFoundModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRemoteNotFoundModalOpen, handleClose]);

  if (!isRemoteNotFoundModalOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-md bg-base-1 border border-border/90 rounded-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remote-error-title"
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/80 bg-base-0/90">
          <h2 id="remote-error-title" className="text-xs font-semibold text-text-primary">
            Error
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-xs text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Compact Content Body */}
        <div className="px-4 py-3.5 flex items-start gap-3 bg-base-1/50">
          <div className="w-7 h-7 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0 text-red-400 shadow-2xs mt-0.5">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-[11.5px] text-text-secondary leading-relaxed font-normal">
              The repository does not seem to exist anymore. You may not have access, or it may have been deleted or renamed on the remote server.
            </p>
          </div>
        </div>

        {/* Compact Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-2 bg-base-0/80 border-t border-border/80">
          <button
            type="button"
            onClick={handlePublish}
            className="h-7 px-3 rounded-sm bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <Upload className="w-3 h-3" />
            <span>Publish repository</span>
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="h-7 px-3.5 rounded-sm bg-[#0969da] hover:bg-[#0860ca] active:bg-[#0757b8] text-white text-xs font-medium transition cursor-pointer shadow-xs active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
