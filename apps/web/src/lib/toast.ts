import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastStore>()((set, get) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const id = nextId++;
    // Replace an identical toast instead of stacking duplicates.
    set({ toasts: [...get().toasts.filter((t) => t.message !== message), { id, message, tone }].slice(-3) });
    setTimeout(() => get().dismiss(id), tone === 'error' ? 5000 : 2600);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  info: (message: string) => useToasts.getState().push(message, 'info'),
  success: (message: string) => useToasts.getState().push(message, 'success'),
  error: (message: string) => useToasts.getState().push(message, 'error'),
};
