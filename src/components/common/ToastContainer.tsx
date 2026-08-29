import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, ExternalLink } from 'lucide-react';
import { useToastStore, ToastItem } from '../../store/useToastStore';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[99999] flex flex-col gap-2 pointer-events-none max-w-sm w-full select-none font-sans">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-git-added shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-git-modified shrink-0" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-git-removed shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
  };

  const getBorderAndBg = () => {
    switch (toast.type) {
      case 'success':
        return 'border-git-added/40';
      case 'warning':
        return 'border-git-modified/40';
      case 'error':
        return 'border-git-removed/50';
      default:
        return 'border-border-strong';
    }
  };

  return (
    <div
      className={`pointer-events-auto p-3 rounded-sm border bg-base-0 shadow-2xl flex items-start gap-2.5 animate-in slide-in-from-bottom-2 fade-in duration-150 ${getBorderAndBg()}`}
    >
      {/* Icon Chip */}
      <div className="w-6 h-6 rounded-sm bg-base-1 border border-border flex items-center justify-center shrink-0 mt-0.5">
        {getIcon()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          {toast.title && (
            <h4 className="text-xs font-semibold leading-tight text-text-primary">{toast.title}</h4>
          )}
          {toast.count && toast.count > 1 && (
            <span className="px-1 py-0.2 rounded-xs bg-base-1 border border-border text-[9.5px] font-mono font-bold text-text-muted">
              ×{toast.count}
            </span>
          )}
        </div>

        <p className="text-[11px] text-text-muted leading-relaxed break-words">{toast.message}</p>

        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onClose();
            }}
            className="mt-2 px-2.5 py-0.8 rounded-sm bg-base-1 hover:bg-base-2 border border-border text-[11px] font-semibold text-commito-coral hover:text-commito-coralLight transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
          >
            <span>{toast.actionLabel}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-5.5 h-5.5 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-1 transition cursor-pointer flex items-center justify-center shrink-0 -mr-1 -mt-1"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
