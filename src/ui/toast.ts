import { useEffect, useState } from 'preact/hooks'
import { nextId } from '../core/ids'

// Tiny module-level toast store so any code (even non-component) can show toasts.
export type ToastKind = 'info' | 'success' | 'error'
export interface Toast {
  id: string
  message: string
  kind: ToastKind
  duration: number
}

let toasts: Toast[] = []
const listeners = new Set<(t: Toast[]) => void>()

function emit() {
  for (const l of listeners) l(toasts)
}

export function showToast(message: string, kind: ToastKind = 'info', duration = 3500): string {
  const id = nextId('toast')
  toasts = [...toasts, { id, message, kind, duration }]
  emit()
  if (duration > 0) setTimeout(() => dismissToast(id), duration)
  return id
}

export function dismissToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export const toast = {
  info: (m: string, d?: number) => showToast(m, 'info', d),
  success: (m: string, d?: number) => showToast(m, 'success', d),
  error: (m: string, d?: number) => showToast(m, 'error', d ?? 6000),
}

export function useToasts(): Toast[] {
  const [list, setList] = useState<Toast[]>(toasts)
  useEffect(() => {
    listeners.add(setList)
    return () => {
      listeners.delete(setList)
    }
  }, [])
  return list
}
