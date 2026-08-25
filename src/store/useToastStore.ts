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
}

interface ToastState {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (toast) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const duration = toast.durationMs ?? 4500;
    const newToast: ToastItem = { ...toast, id };

    set((state) => ({
      toasts: [...state.toasts, newToast].slice(-5), // Keep max 5 visible toasts
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
