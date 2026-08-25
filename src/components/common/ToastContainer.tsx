import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
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
        return <CheckCircle2 className="w-4 h-4 text-git-added flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-git-modified flex-shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-git-removed flex-shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />;
    }
  };

  const getBorderAndBg = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-base-1 border-git-added/30 text-text-primary';
      case 'warning':
        return 'bg-base-1 border-git-modified/30 text-text-primary';
      case 'error':
        return 'bg-base-1 border-git-removed/40 text-text-primary';
      default:
        return 'bg-base-1 border-border-strong text-text-primary';
    }
  };

  return (
    <div
      className={`pointer-events-auto p-3 rounded-sm border shadow-2xl flex items-start gap-2.5 animate-in slide-in-from-bottom-2 fade-in duration-200 ${getBorderAndBg()}`}
    >
      <div className="mt-0.5">{getIcon()}</div>

      <div className="min-w-0 flex-1">
        {toast.title && (
          <h4 className="text-xs font-semibold leading-tight text-text-primary mb-0.5">
            {toast.title}
          </h4>
        )}
        <p className="text-[11px] text-text-secondary leading-relaxed break-words">
          {toast.message}
        </p>

        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onClose();
            }}
            className="mt-2 text-[11px] font-semibold text-commito-coral hover:underline cursor-pointer flex items-center gap-1"
          >
            {toast.actionLabel}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer flex-shrink-0 -mr-1 -mt-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
