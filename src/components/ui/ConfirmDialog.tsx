import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button } from './Button'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setLoading(false)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [loading, onCancel, open])

  if (!open) return null

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error.')
      setLoading(false)
    }
  }

  const confirmButtonClass =
    variant === 'danger'
      ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 focus-visible:outline-rose-600'
      : undefined

  return createPortal(
    <div
      aria-labelledby="confirm-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <button
        aria-label="Cerrar"
        className="absolute inset-0 cursor-default"
        disabled={loading}
        onClick={loading ? undefined : onCancel}
        type="button"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-start gap-3">
          {variant === 'danger' ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40">
              <svg className="size-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white" id="confirm-dialog-title">
              {title}
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{message}</p>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button disabled={loading} onClick={onCancel} type="button" variant="ghost">
            {cancelLabel}
          </Button>
          <Button
            className={confirmButtonClass}
            disabled={loading}
            isLoading={loading}
            onClick={() => void handleConfirm()}
            type="button"
            variant="primary"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
