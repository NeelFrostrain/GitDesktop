import { useState, useCallback } from 'react';

export interface UseUnsavedChangesGuardOptions {
  isDirty: boolean;
  onClose: () => void;
}

/**
 * Hook to guard against accidental modal dismissal when unsaved modifications exist.
 */
export function useUnsavedChangesGuard({ isDirty, onClose }: UseUnsavedChangesGuardOptions) {
  const [showConfirm, setShowConfirm] = useState(false);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setShowConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const confirmDiscard = useCallback(() => {
    setShowConfirm(false);
    onClose();
  }, [onClose]);

  const cancelDiscard = useCallback(() => {
    setShowConfirm(false);
  }, []);

  return {
    showConfirm,
    setShowConfirm,
    requestClose,
    confirmDiscard,
    cancelDiscard,
  };
}
