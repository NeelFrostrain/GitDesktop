import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ConfigFooterProps {
  onClose: () => void;
  isValid: boolean;
  isSubmitting: boolean;
}

export const ConfigFooter: React.FC<ConfigFooterProps> = ({
  onClose,
  isValid,
  isSubmitting,
}) => {
  return (
    <div className="pt-3.5 flex items-center justify-end gap-2 border-t border-border/80 font-sans select-none">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="h-7.5 px-3.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary transition cursor-pointer shadow-2xs disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className={`h-7.5 px-4 rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
          isValid && !isSubmitting
            ? 'bg-commito-coral hover:bg-commito-coralLight text-white active:scale-95'
            : 'bg-base-2 text-text-muted border border-border cursor-not-allowed opacity-60'
        }`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>{isSubmitting ? 'Saving...' : 'Save & Continue'}</span>
      </button>
    </div>
  );
};
