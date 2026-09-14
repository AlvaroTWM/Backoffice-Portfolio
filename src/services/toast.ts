// Simple toast store — no external dependencies needed.

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id:       string
  type:     ToastType
  title:    string
  message?: string
}

type Listener = (items: ToastItem[]) => void

let items: ToastItem[] = []
const listeners = new Set<Listener>()

function notify() {
  const snapshot = [...items]
  listeners.forEach((l) => l(snapshot))
}

function add(type: ToastType, title: string, message?: string) {
  const id = String(Date.now()) + Math.random().toString(36).slice(2)
  items = [...items, { id, type, title, message }]
  notify()
  // auto-dismiss after 4 s
  setTimeout(() => dismiss(id), 4000)
}

function dismiss(id: string) {
  items = items.filter((t) => t.id !== id)
  notify()
}

export const toast = {
  success: (title: string, message?: string) => add('success', title, message),
  error:   (title: string, message?: string) => add('error',   title, message),
  info:    (title: string, message?: string) => add('info',    title, message),
  dismiss,
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getToastSnapshot() {
  return items
}
