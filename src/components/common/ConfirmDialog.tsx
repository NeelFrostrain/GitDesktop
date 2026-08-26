import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Info, AlertCircle, X, Check, Trash2 } from 'lucide-react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  description?: string;
  variant?: 'warning' | 'danger' | 'info';
  discardText?: string;
  saveText?: string;
  cancelText?: string;
  isSaving?: boolean;
  onDiscard: () => void;
  onSave?: () => void;
  onCancel: () => void;
}

/**
 * Compact Deep Dark Obsidian Confirmation Dialog matching the application's unified modal style.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = 'Unsaved Changes',
  subtitle = 'Unsaved changes',
  description = 'You have unsaved changes. If you leave now, your modifications will be lost.',
  variant = 'warning',
  discardText = 'Discard Changes',
  saveText,
  cancelText = 'Keep Editing',
  isSaving = false,
  onDiscard,
  onSave,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertCircle className="w-3 h-3" />;
      case 'info':
        return <Info className="w-3 h-3" />;
      case 'warning':
      default:
        return <AlertTriangle className="w-3 h-3" />;
    }
  };

  const getBadgeStyle = () => {
    switch (variant) {
      case 'danger':
        return 'bg-git-removed-bg border-git-removed/30 text-git-removed';
      case 'info':
        return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
      case 'warning':
      default:
        return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-100 select-none font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="w-full max-w-[420px] bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact 1-Row Header */}
        <div className="px-3.5 py-2 border-b border-border bg-base-1 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-5 h-5 rounded-sm flex items-center justify-center border shrink-0 ${getBadgeStyle()}`}
            >
              {getIcon()}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h2
                id="confirm-dialog-title"
                className="text-xs font-bold text-text-primary leading-none truncate"
              >
                {title}
              </h2>
              <span className="text-border">•</span>
              <span className="text-[10.5px] text-text-muted truncate">
                {subtitle}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer shrink-0 disabled:opacity-50"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-3.5 flex flex-col gap-2 bg-base-0">
          <p
            id="confirm-dialog-desc"
            className="text-xs text-text-secondary leading-relaxed"
          >
            {description}
          </p>
        </div>

        {/* Slim Footer Actions with 3D Glossy Buttons */}
        <div className="px-3.5 py-2.5 bg-base-1 border-t border-border flex items-center justify-between gap-2 shrink-0 min-h-[42px]">
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onDiscard}
            disabled={isSaving}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            {discardText}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
            >
              {cancelText}
            </Button>

            {onSave && saveText && (
              <Button
                type="button"
                variant="coral"
                size="sm"
                onClick={onSave}
                disabled={isSaving}
                isLoading={isSaving}
                leftIcon={!isSaving ? <Check className="w-3.5 h-3.5" /> : undefined}
              >
                {saveText}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
