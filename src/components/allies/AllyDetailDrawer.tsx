import { ArrowTopRightOnSquareIcon, BanknotesIcon, CalendarDaysIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { AliadoDetalle, AliadoResumen, CuotaRecord } from '../../types/allyDebt'
import { activeCuotas } from '../../utils/allyPayment'
import {
  PILL_TONE_CLASS,
  daysUntil,
  formatGs,
  formatNumber,
  formatShortDate,
  percent,
  pluralDays,
  toTitleCase,
  type PillTone,
} from '../../utils/allyFormat'

const CLOSE_MS = 180

interface AllyDetailDrawerProps {
  /** Fila del listado: permite pintar la cabecera antes de que llegue el detalle. */
  summary?: AliadoResumen
  detail: AliadoDetalle | null
  isLoading: boolean
  canRegisterPayment: boolean
  onClose: () => void
  onOpenFullPage: () => void
  onRegisterPayment: () => void
}

function cuotaPill(c: CuotaRecord): { label: string; tone: PillTone } {
  const saldo = Number(c.saldo_cuota) || 0
  const monto = Number(c.monto_cuota) || 0
  if (String(c.estado_cuota).toLowerCase() === 'pagada' || saldo <= 0) return { label: 'Pagada', tone: 'success' }
  const days = daysUntil(c.fecha_vencimiento)
  if (days !== null && days < 0) return { label: `Vencida hace ${pluralDays(Math.abs(days))}`, tone: 'danger' }
  if (days !== null && days <= 7) {
    return { label: days === 0 ? 'Vence hoy' : `Vence en ${pluralDays(days)}`, tone: 'warning' }
  }
  if (monto > 0 && saldo < monto) return { label: 'Parcial', tone: 'neutral' }
  return { label: 'Pendiente', tone: 'neutral' }
}

function Pill({ children, tone }: { children: React.ReactNode; tone: PillTone }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL_TONE_CLASS[tone]}`}>
      {children}
    </span>
  )
}

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`} />
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  )
}

export function AllyDetailDrawer({
  summary,
  detail,
  isLoading,
  canRegisterPayment,
  onClose,
  onOpenFullPage,
  onRegisterPayment,
}: AllyDetailDrawerProps) {
  const [visible, setVisible] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const closingRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const requestClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    setVisible(false)
    window.setTimeout(() => onCloseRef.current(), CLOSE_MS)
  }
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setVisible(true))
    closeRef.current?.focus()
    return () => window.cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const ally = detail?.aliado
  const name = toTitleCase(ally?.aliado_nombre ?? summary?.aliado_nombre)
  const ruc = ally?.ruc ?? summary?.ruc
  const bolsa = summary?.bolsa ?? ally?.bolsa
  const rubro = summary?.rubro ?? ally?.rubro
  const estado = ally?.estado ?? summary?.estado
  const ejecutiva = ally?.ejecutiva_nombre
  const showRubro = Boolean(rubro) && String(rubro).trim().toLowerCase() !== String(bolsa ?? '').trim().toLowerCase()

  const resumen = detail?.resumen
  const deudaTotal = resumen?.deuda_total ?? summary?.deuda_total ?? 0
  const pagado = resumen?.monto_total_pagado ?? summary?.monto_total_pagado ?? 0
  const saldo = resumen?.saldo_pendiente ?? summary?.saldo_pendiente ?? 0
  const pct = percent(pagado, deudaTotal)

  const cuotas = detail ? activeCuotas(detail) : []
  const pagos = detail
    ? [...detail.pagos].sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago)))
    : []

  const estadoKey = String(estado ?? '').toLowerCase()
  const estadoTone: PillTone = estadoKey === 'activo' ? 'success' : estadoKey === 'suspendido' ? 'danger' : 'neutral'
  const waiting = isLoading && !detail
  const multiDeuda = (detail?.facturas.length ?? 0) > 1
  const periodoOf = (c: CuotaRecord) =>
    detail?.facturas.find((f) => String(f.factura_id) === String(c.factura_id))?.periodo ?? 'Deuda'
  const nothingYet = Boolean(detail) && cuotas.length === 0 && pagos.length === 0

  // Portal a <body>: un ancestro con `transform` (animate-fade-up) rompe el `fixed` y el drawer
  // mediría lo mismo que la lista, dejando el footer fuera de la pantalla.
  return createPortal(
    <div className="fixed inset-0 z-40" role="presentation">
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-slate-950/40 transition-opacity duration-200 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={requestClose}
      />
      <aside
        aria-label={`Detalle de ${name || 'aliado'}`}
        aria-modal="true"
        className={`absolute right-0 top-0 flex h-full w-full max-w-[30rem] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 ${visible ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            {name ? (
              <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">{name}</h3>
            ) : (
              <SkeletonLine className="h-5 w-48" />
            )}
            <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">RUC {ruc || '—'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-600 dark:text-slate-300">
              <span>{bolsa || '—'}{showRubro ? ` · ${rubro}` : ''}</span>
              {ejecutiva ? <span>Ejecutiva: {toTitleCase(ejecutiva)}</span> : null}
              {estado ? <Pill tone={estadoTone}>{estado}</Pill> : null}
            </div>
          </div>
          <button
            ref={closeRef}
            aria-label="Cerrar detalle"
            className="rounded-lg p-1.5 text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-loyalty-fresh dark:hover:bg-slate-800 dark:hover:text-slate-100"
            onClick={requestClose}
            type="button"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className={`flex-1 overflow-y-auto px-5 py-5 ${nothingYet ? 'flex flex-col gap-6' : 'space-y-6'}`}>
          <section aria-label="Resumen" className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="grid grid-cols-3 gap-4">
              <StatBlock label="Deuda total" value={formatGs(deudaTotal)} />
              <StatBlock label="Pagado" value={formatGs(pagado)} />
              <StatBlock label="Saldo" value={formatGs(saldo)} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-loyalty-fresh transition-[width] duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">{Math.round(pct)}%</span>
            </div>
          </section>

          {nothingYet ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
              <CalendarDaysIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Todavía no hay cuotas ni pagos</p>
              <p className="max-w-[280px] text-xs text-slate-500 dark:text-slate-400">
                Esta deuda no tiene plan de pagos. Podés crearlo desde la página completa del aliado.
              </p>
            </div>
          ) : (
          <>
          <section aria-label="Cuotas">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cuotas</h4>
            {waiting ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonLine key={i} className="h-10 w-full" />)}
              </div>
            ) : !detail ? (
              <p className="rounded-lg border border-dashed border-rose-300 px-3 py-4 text-center text-sm text-rose-600 dark:border-rose-800 dark:text-rose-300">
                No se pudo cargar el detalle de este aliado.
              </p>
            ) : cuotas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400 dark:border-slate-700">
                Sin cuotas registradas.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                {cuotas.map((c) => {
                  const pill = cuotaPill(c)
                  return (
                    <li key={c.cuota_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                          Cuota {c.numero_cuota}
                          <span className="ml-2 text-[13px] font-normal text-slate-500 dark:text-slate-400">
                            {formatShortDate(c.fecha_vencimiento)}
                          </span>
                        </p>
                        <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                          {multiDeuda ? `${periodoOf(c)} · ` : ''}Saldo {formatNumber(Number(c.saldo_cuota) || 0)} de {formatNumber(Number(c.monto_cuota) || 0)}
                        </p>
                      </div>
                      <Pill tone={pill.tone}>{pill.label}</Pill>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {waiting || pagos.length > 0 ? (
          <section aria-label="Historial de pagos">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Historial de pagos</h4>
            {waiting ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonLine key={i} className="h-9 w-full" />)}
              </div>
            ) : pagos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400 dark:border-slate-700">
                Aún no hay pagos registrados.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                {pagos.map((p) => (
                  <li key={p.pago_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800 dark:text-slate-100">{formatShortDate(p.fecha_pago)}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {p.medio_pago || 'Pago'}{p.referencia ? ` · ${p.referencia}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {formatGs(Number(p.monto_pagado) || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          ) : null}
          </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-loyalty-fresh disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            disabled={!detail}
            onClick={onOpenFullPage}
            type="button"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            Ver página completa
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl bg-loyalty-fresh px-3.5 py-2 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-loyalty-fresh-strong active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-loyalty-fresh disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canRegisterPayment}
            onClick={onRegisterPayment}
            title={canRegisterPayment ? undefined : 'No hay cuotas con saldo pendiente'}
            type="button"
          >
            <BanknotesIcon className="h-4 w-4" />
            Registrar pago
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  )
}
