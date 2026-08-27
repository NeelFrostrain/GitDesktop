import React from 'react';
import { Check, Loader2 } from 'lucide-react';

interface ConfigFooterProps {
  onClose: () => void;
  isValid: boolean;
  isSubmitting: boolean;
  submitLabel?: string;
  formId?: string;
}

export const ConfigFooter: React.FC<ConfigFooterProps> = ({
  onClose,
  isValid,
  isSubmitting,
  submitLabel = 'Save Configuration',
  formId = 'git-user-config-form',
}) => {
  return (
    <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-base-1 border-t border-border shrink-0 font-sans select-none">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="h-7.5 px-3.5 bg-base-0 hover:bg-base-2 border border-border rounded-sm text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer shadow-2xs disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        form={formId}
        disabled={!isValid || isSubmitting}
        className={`h-7.5 px-4 rounded-sm text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
          isValid && !isSubmitting
            ? 'bg-commito-coral hover:bg-commito-coralLight text-white active:scale-98'
            : 'bg-base-2 text-text-muted border border-border cursor-not-allowed opacity-60'
        }`}
      >
        {isSubmitting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Check className="w-3.5 h-3.5" />
        )}
        <span>{isSubmitting ? 'Saving...' : submitLabel}</span>
      </button>
    </div>
  );
};
