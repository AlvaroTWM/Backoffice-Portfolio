import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getToastSnapshot, subscribeToasts, toast, type ToastItem } from '../../services/toast'

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Tiny delay to trigger the slide-in animation
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const icons = {
    success: (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
        <svg className="size-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    ),
    error: (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40">
        <svg className="size-4 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    ),
    info: (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40">
        <svg className="size-4 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01" />
        </svg>
      </span>
    ),
  }

  return (
    <div
      className={`flex w-80 items-start gap-3 rounded-2xl border border-slate-200/60 bg-slate-900 px-4 py-3.5 shadow-2xl transition-all duration-300 dark:border-slate-700 dark:bg-slate-800 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      {icons[toast.type]}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-xs text-slate-400">{toast.message}</p>
        )}
      </div>
      <button
        className="shrink-0 text-slate-500 hover:text-slate-300 transition"
        onClick={onClose}
        type="button"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>(getToastSnapshot)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return subscribeToasts(setToasts)
  }, [])

  if (toasts.length === 0) return null

  return createPortal(
    <div
      ref={ref}
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => toast.dismiss(t.id)} />
      ))}
    </div>,
    document.body,
  )
}
