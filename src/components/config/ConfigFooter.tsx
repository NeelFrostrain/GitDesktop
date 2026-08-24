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
    <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
      <button
        type="button"
        onClick={onClose}
        className="px-3 py-1.5 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-xs font-semibold text-text-secondary transition cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className={`px-4 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 transition shadow-sm ${
          isValid && !isSubmitting
            ? 'bg-commito-coral hover:bg-commito-coralHover text-white cursor-pointer'
            : 'bg-base-2 text-text-muted border border-border cursor-not-allowed'
        }`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>{isSubmitting ? 'Saving...' : 'Save & Continue'}</span>
      </button>
    </div>
  );
};
