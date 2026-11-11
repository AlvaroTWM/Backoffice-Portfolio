import { XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useState } from 'react'

import { listarAliadosPaginado } from '../../services/alliesApi'
import type { AliadoResumen, AliadosListQuery } from '../../types/allyDebt'
import { PILL_TONE_CLASS, formatGs, pluralDays, toTitleCase } from '../../utils/allyFormat'

interface OverdueAlliesPopoverProps {
  /** Filtros activos de la vista: la lista respeta todos menos "Estado de deuda". */
  filters: AliadosListQuery
  onClose: () => void
  onSelect: (ally: AliadoResumen) => void
}

export function OverdueAlliesPopover({ filters, onClose, onSelect }: OverdueAlliesPopoverProps) {
  const [items, setItems] = useState<AliadoResumen[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    listarAliadosPaginado({
      ...filters,
      page: 1,
      pageSize: 100,
      debtStatus: 'con_vencimiento',
    })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar la lista.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
    // se pide una vez por apertura (el popover se desmonta al cerrar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = useMemo(() => [...items].sort((a, b) => b.saldo_pendiente - a.saldo_pendiente), [items])

  return (
    <div
      role="dialog"
      aria-label="Aliados en mora"
      className="absolute left-0 top-full z-30 mt-2 w-[min(28rem,90vw)] animate-soft-pop overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Aliados en mora</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isLoading ? 'Cargando…' : `${total} ${total === 1 ? 'aliado' : 'aliados'} · según los filtros activos`}
          </p>
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[22rem] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            ))}
          </div>
        ) : error ? (
          <p className="px-4 py-6 text-center text-sm text-rose-600 dark:text-rose-300">{error}</p>
        ) : sorted.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No hay aliados en mora.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {sorted.map((ally) => {
              const late = ally.dias_vencido
              return (
                <li key={String(ally.aliado_id)}>
                  <button
                    type="button"
                    onClick={() => onSelect(ally)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-800/60 dark:focus-visible:bg-slate-800/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                        {toTitleCase(ally.aliado_nombre)}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {ally.ruc ? `${ally.ruc} · ` : ''}{ally.bolsa || '—'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-300">
                        {formatGs(ally.saldo_pendiente)}
                      </span>
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL_TONE_CLASS.danger}`}>
                        {late && late > 0 ? `Vencido hace ${pluralDays(late)}` : 'Con vencimiento'}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
