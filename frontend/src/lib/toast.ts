import { reactive } from 'vue';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export const toasts = reactive<Toast[]>([]);
let nextId = 1;

export function notify(message: string, kind: ToastKind = 'success', timeout = 4500): void {
  const id = nextId++;
  toasts.push({ id, kind, message });
  window.setTimeout(() => dismissToast(id), timeout);
}

export function dismissToast(id: number): void {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index >= 0) toasts.splice(index, 1);
}
