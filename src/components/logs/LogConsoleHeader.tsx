import React, { useState } from 'react';
import { Terminal, Copy, Check, Trash2, X } from 'lucide-react';

interface LogConsoleHeaderProps {
  totalCount: number;
  filteredCount: number;
  onCopy: () => void;
  onClear: () => void;
  onClose: () => void;
}

export const LogConsoleHeader: React.FC<LogConsoleHeaderProps> = ({
  totalCount,
  filteredCount,
  onCopy,
  onClear,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const handleCopyClick = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearClick = () => {
    if (isConfirmingClear) {
      onClear();
      setIsConfirmingClear(false);
    } else {
      setIsConfirmingClear(true);
    }
  };

  return (
    <div className="h-11 bg-base-0 border-b border-border px-4 flex items-center justify-between flex-shrink-0 select-none">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-sm bg-commito-coral/20 border border-commito-coral/40 text-commito-coral flex items-center justify-center flex-shrink-0">
          <Terminal className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-text-primary leading-tight">
            Activity & Action Logs
          </h2>
          <span className="text-[10px] px-2 py-0.5 bg-base-2 border border-border rounded-sm font-mono text-commito-coral font-bold">
            {filteredCount !== totalCount ? `${filteredCount} of ${totalCount}` : totalCount} events
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopyClick}
          className="px-2.5 py-1 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-xs font-semibold text-text-primary flex items-center gap-1.5 transition cursor-pointer"
          title="Copy visible logs to clipboard"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-text-muted" />
          )}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>

        {/* Clear Button / Confirmation */}
        {isConfirmingClear ? (
          <div className="flex items-center gap-1 bg-red-950/40 border border-red-800/60 p-0.5 rounded-sm animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => setIsConfirmingClear(false)}
              className="px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary rounded"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClearClick}
              className="px-2 py-0.5 text-[10px] font-bold bg-commito-coral hover:bg-commito-coralHover text-white rounded cursor-pointer"
            >
              Confirm Clear
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClearClick}
            className="px-2.5 py-1 bg-base-2 hover:bg-base-3 text-text-muted hover:text-red-400 border border-border rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Clear all logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text-primary rounded-sm hover:bg-base-2 transition cursor-pointer ml-1"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
