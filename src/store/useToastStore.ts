import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
  count?: number;
}

interface ToastState {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (toast) => {
    // Deduplicate identical toasts by title + message
    const existingIndex = get().toasts.findIndex(
      (t) => t.title === toast.title && t.message === toast.message && t.type === toast.type
    );

    if (existingIndex !== -1) {
      // Increment count on existing toast rather than stacking duplicates
      set((state) => {
        const next = [...state.toasts];
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          count: (existing.count || 1) + 1,
        };
        return { toasts: next };
      });
      return;
    }

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const duration = toast.durationMs ?? 4500;
    const newToast: ToastItem = { ...toast, id, count: 1 };

    set((state) => ({
      toasts: [...state.toasts, newToast].slice(-4), // Keep max 4 visible toasts
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
