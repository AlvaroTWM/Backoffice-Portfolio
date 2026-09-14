import { ArrowLeftIcon, BanknotesIcon, ChevronDownIcon, ClockIcon, EllipsisVerticalIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useCallback, useEffect, useRef, useState, Fragment } from 'react'
import { createPortal } from 'react-dom'

import {
  exportarFacturasAliado,
  listarFacturasAliado,
  obtenerCuotasFactura,
} from '../../services/alliesApi'
import type {
  AliadoDetalle,
  AsignarNumFacturaPayload,
  CompromisosRecord,
  CrearCompromisoPayload,
  CrearPlanPagosPayload,
  RefinanciarDeudaPayload,
  CuotaInput,
  CuotaRecord,
  FacturaEstadoFilter,
  FacturaRecord,
  RegistrarPagoPayload,
  SolicitarAprobacionPayload,
} from '../../types/allyDebt'
import type { UserRole } from '../../types/auth'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Input } from '../ui/Input'
import { RegistrarPagoModal, type RegistrarPagoModalTarget } from './RegistrarPagoModal'

// ─── Role helpers ─────────────────────────────────────────────────────────────

const APPROVER_LABEL: Record<UserRole, string | null> = {
  admin:       null,          // ejecuta directo, sin aprobación
  gerencia:    'Admin',
  alianzas:    'Operaciones',
  operaciones: 'Gerencia',
}

function requiresApproval(role: UserRole): boolean {
  return role !== 'admin'
}

function getApproverLabel(role: UserRole): string | null {
  return APPROVER_LABEL[role] ?? null
}

interface AllyDetailPageProps {
  allyDetail: AliadoDetalle
  isLoading?: boolean
  onAssignInvoiceNumber: (payload: AsignarNumFacturaPayload) => Promise<void>
  onBack: () => void
  onCreateCompromiso: (payload: CrearCompromisoPayload) => Promise<void>
  onCreatePlan: (payload: CrearPlanPagosPayload) => Promise<void>
  onRefinanciar: (payload: RefinanciarDeudaPayload) => Promise<void>
  onRegisterPayment: (payload: RegistrarPagoPayload) => Promise<void>
  onAnularPagoDirecto?: (cuotaId: string) => Promise<void>
  onSolicitarAprobacion: (payload: SolicitarAprobacionPayload) => Promise<{ aprobacion_id: string }>
  userRole: UserRole
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-PY', {
    currency: 'PYG',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(n)
}

function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-PY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const estadoBadge: Record<string, string> = {
  pagada:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  parcial:      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  pendiente:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  refinanciada: 'bg-violet-100 text-violet-800 dark:bg-violet-500/25 dark:text-violet-200 dark:ring-1 dark:ring-inset dark:ring-violet-400/45',
}

const cuotaRefinanciadaMontoClass = 'text-violet-600 dark:text-violet-300'

const CUOTA_ESTADO_LABEL: Record<string, string> = {
  pagada:       'Pagada',
  parcial:      'Parcial',
  pendiente:    'Pendiente',
  refinanciada: 'Refinanciada',
}

function cuotaMontoPagadoReal(cuota: CuotaRecord): number {
  if (cuota.monto_pagado != null) return Math.max(0, Number(cuota.monto_pagado))
  const montoCuota = Math.max(0, Number(cuota.monto_cuota || 0))
  const saldo = Math.max(0, Number(cuota.saldo_cuota || 0))
  const estado = String(cuota.estado_cuota || '').toLowerCase()
  // En BD el saldo queda en 0 al refinanciar; el pagado real viene de aplicacion_pago.
  if (estado === 'refinanciada') return 0
  return Math.max(0, montoCuota - saldo)
}

function isCuotaRefinanciada(cuota: CuotaRecord): boolean {
  const estado = String(cuota.estado_cuota || '').toLowerCase()
  if (estado === 'refinanciada') return true

  const montoCuota = Math.max(0, Number(cuota.monto_cuota || 0))
  const saldo = Math.max(0, Number(cuota.saldo_cuota || 0))
  const pagado = cuotaMontoPagadoReal(cuota)

  // Cerrada sin cubrir el monto total → refinanciada (incluye registros legacy mal etiquetados).
  return saldo <= 0 && montoCuota > 0 && pagado < montoCuota
}

function cuotaMontoPagado(cuota: CuotaRecord): number {
  return cuotaMontoPagadoReal(cuota)
}

/** Saldo vigente o, si la cuota fue refinanciada, lo no pagado al momento (solo registro). */
function cuotaSaldoRegistro(cuota: CuotaRecord): number {
  if (cuota.saldo_refinanciado != null) {
    return Math.max(0, Number(cuota.saldo_refinanciado))
  }
  const montoCuota = Math.max(0, Number(cuota.monto_cuota || 0))
  if (isCuotaRefinanciada(cuota)) {
    return Math.max(0, montoCuota - cuotaMontoPagado(cuota))
  }
  return Math.max(0, Number(cuota.saldo_cuota || 0))
}

function cuotaDisplayStatus(cuota: CuotaRecord) {
  if (isCuotaRefinanciada(cuota)) return 'refinanciada'
  const saldo = Math.max(0, Number(cuota.saldo_cuota || 0))
  if (saldo <= 0) return 'pagada'
  const monto = Math.max(0, Number(cuota.monto_cuota || 0))
  if (monto > 0 && saldo < monto) return 'parcial'
  const estado = String(cuota.estado_cuota || '').toLowerCase()
  return estado === 'pagada' || estado === 'parcial' ? estado : 'pendiente'
}

const FACTURAS_PAGE_SIZE = 10
const ACTIONS_MENU_WIDTH = 208

function positionActionsMenu(button: HTMLElement) {
  const rect = button.getBoundingClientRect()
  let left = rect.right - ACTIONS_MENU_WIDTH
  left = Math.max(8, Math.min(left, window.innerWidth - ACTIONS_MENU_WIDTH - 8))
  return { top: rect.bottom + 4, left }
}

const FACTURA_FILTER_LABELS: Record<FacturaEstadoFilter, string> = {
  pendientes: 'Pendientes',
  parciales:  'Parciales',
  pagadas:    'Pagadas',
  anuladas:   'Anuladas',
  todas:      'Todas',
}

function resolveFechaVencimientoFactura(factura: FacturaRecord, cuotas: CuotaRecord[]): string {
  if (factura.fecha_vencimiento_ultima) return factura.fecha_vencimiento_ultima
  if (cuotas.length === 0) return ''
  const ultima = [...cuotas].sort((a, b) => b.numero_cuota - a.numero_cuota)[0]
  return ultima?.fecha_vencimiento ?? ''
}

function formatFacturaTitulo(factura: FacturaRecord, servicio: string): string {
  if (factura.periodo?.trim()) return factura.periodo.trim()
  if (factura.num_factura?.trim()) return `Factura N° ${factura.num_factura.trim()}`
  if (servicio && servicio !== 'Sin especificar') return servicio
  return 'Deuda registrada'
}

function formatFacturaSubtitulo(factura: FacturaRecord, servicio: string): string {
  const parts: string[] = []
  if (factura.periodo?.trim() && factura.num_factura?.trim()) {
    parts.push(`N° ${factura.num_factura.trim()}`)
  }
  if (servicio && servicio !== 'Sin especificar') parts.push(servicio)
  return parts.join(' · ') || '—'
}

function isCuotaInicialPlaceholder(cuotas: CuotaRecord[]): boolean {
  if (cuotas.length !== 1) return false
  const c = cuotas[0]
  const texto = String(c.motivo_cambio || c.observacion || '').toLowerCase()
  if (texto.includes('vencimiento inicial')) return true
  return c.numero_cuota === 1
    && String(c.estado_cuota || '').toLowerCase() === 'pendiente'
}

function tieneNumFacturaAsignada(numFactura?: string | null): boolean {
  return Boolean(String(numFactura ?? '').trim())
}

function VenceCell({ fecha }: { fecha: string }) {
  if (!fecha) {
    return <span className="text-slate-300 dark:text-slate-600">—</span>
  }
  return (
    <span className="inline-flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400">
      <ClockIcon className="size-3.5 shrink-0" />
      {formatDate(fecha)}
    </span>
  )
}

function CuotaRows({
  cuotas,
  isLoading,
  permitePago = false,
  onOpenPay,
  onAnularPago,
}: {
  cuotas: CuotaRecord[]
  isLoading?: boolean
  permitePago?: boolean
  onOpenPay: (cuota: CuotaRecord) => void
  onAnularPago?: (cuotaId: string, cuotaNumero: number) => void
}) {
  if (isLoading) {
    return (
      <tr className="bg-slate-50/60 dark:bg-slate-900/20">
        <td className="px-4 py-3 text-center text-xs text-slate-400 dark:text-slate-500" colSpan={7}>
          Cargando cuotas...
        </td>
      </tr>
    )
  }

  if (cuotas.length === 0) {
    return (
      <tr className="bg-slate-50/60 dark:bg-slate-900/20">
        <td className="px-4 py-3 text-center text-xs text-slate-400 dark:text-slate-500" colSpan={7}>
          Sin cuotas para esta factura.
        </td>
      </tr>
    )
  }

  return (
    <>
      {cuotas.map((cuota) => {
        const montoCuota = Math.max(0, Number(cuota.monto_cuota || 0))
        const refinanciada = isCuotaRefinanciada(cuota)
        const montoPagado = cuotaMontoPagado(cuota)
        const saldoRegistro = cuotaSaldoRegistro(cuota)
        const cuotaEstado = cuotaDisplayStatus(cuota)
        const puedePagar = permitePago && !refinanciada && cuotaEstado !== 'pagada'
        const puedeAnular = montoPagado > 0

        return (
          <tr key={cuota.cuota_id} className="bg-slate-50/60 text-xs dark:bg-slate-900/20">
            <td className="px-4 py-2.5 align-middle pl-8">
              <p className="font-bold text-slate-700 dark:text-slate-200">Cuota {cuota.numero_cuota}</p>
            </td>
            <td className="px-3 py-2.5 text-center align-middle">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${estadoBadge[cuotaEstado] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                {CUOTA_ESTADO_LABEL[cuotaEstado] ?? cuotaEstado}
              </span>
            </td>
            <td className="px-3 py-2.5 text-right align-middle font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {formatCurrency(montoCuota)}
            </td>
            <td className="px-3 py-2.5 text-right align-middle font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(montoPagado)}
            </td>
            <td className={`px-3 py-2.5 text-right align-middle font-semibold tabular-nums ${refinanciada ? cuotaRefinanciadaMontoClass : saldoRegistro > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
              {formatCurrency(saldoRegistro)}
            </td>
            <td className="px-3 py-2.5 text-center align-middle">
              <VenceCell fecha={cuota.fecha_vencimiento} />
            </td>
            <td className="px-4 py-2.5 text-center align-middle">
              <div className="flex items-center justify-center gap-1.5">
                {puedePagar && (
                  <button
                    className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
                    onClick={() => onOpenPay(cuota)}
                    type="button"
                  >
                    Pagar
                  </button>
                )}
                {puedeAnular && onAnularPago && (
                  <button
                    className="rounded-md border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
                    onClick={() => onAnularPago(cuota.cuota_id, cuota.numero_cuota)}
                    type="button"
                  >
                    Anular
                  </button>
                )}
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}

function PlanPagosForm({
  deudaId,
  isSubmitting,
  maxAmount,
  numFactura,
  onClose,
  onSubmit,
  submitLabel = 'Guardar plan',
  balanceLabel = 'Saldo pendiente a financiar',
}: {
  deudaId: string
  isSubmitting: boolean
  maxAmount: number
  numFactura?: string
  onClose?: () => void
  onSubmit: (payload: CrearPlanPagosPayload) => Promise<void>
  submitLabel?: string
  balanceLabel?: string
}) {
  const [rows, setRows] = useState<(CuotaInput & { key: number })[]>([
    { key: Date.now(), numero_cuota: 1, fecha_vencimiento: '', monto_cuota: 0 },
  ])
  const [error, setError] = useState<string | null>(null)
  const total = rows.reduce((sum, r) => sum + Number(r.monto_cuota || 0), 0)
  const diff = total - maxAmount
  const isBalanced = Math.abs(diff) <= 1000
  const rowsValid = rows.length > 0
    && rows.every((r) => r.fecha_vencimiento && Number(r.monto_cuota) > 0)
  const canSubmit = isBalanced && rowsValid && maxAmount > 0

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/30'

  const updateRow = (key: number, field: keyof CuotaInput, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key
          ? { ...r, [field]: field === 'monto_cuota' || field === 'numero_cuota' ? Number(value) || 0 : value }
          : r,
      ),
    )
  }

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { key: Date.now() + prev.length, numero_cuota: prev.length + 1, fecha_vencimiento: '', monto_cuota: 0 },
    ])
  }

  const removeRow = (key: number) => {
    setRows((prev) =>
      prev
        .filter((r) => r.key !== key)
        .map((r, index) => ({ ...r, numero_cuota: index + 1 })),
    )
  }

  const handleSubmit = async () => {
    setError(null)
    if (rows.length === 0) return setError('Debes agregar al menos una cuota.')
    if (!rowsValid) {
      return setError('Todas las cuotas deben tener monto mayor a 0 y fecha.')
    }
    if (!isBalanced) {
      return setError(
        `La suma de cuotas (${formatCurrency(total)}) debe ser igual a ${formatCurrency(maxAmount)}. Diferencia: ${formatCurrency(Math.abs(diff))}.`,
      )
    }
    await onSubmit({
      deudaId,
      numFactura,
      cuotas: rows.map(({ key: _k, ...r }) => r),
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Plan de pagos</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {balanceLabel}:{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(maxAmount)}</span>
          </p>
        </div>
        {onClose ? (
          <button
            className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            onClick={onClose}
            type="button"
          >
            Cerrar
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:bg-slate-900/50 dark:text-slate-500">
            <tr>
              <th className="w-12 px-4 py-2.5 text-center">#</th>
              <th className="px-3 py-2.5 text-left">Monto</th>
              <th className="px-3 py-2.5 text-left">Vencimiento</th>
              <th className="w-12 px-3 py-2.5 text-center" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td className="px-4 py-2 text-center align-middle text-xs font-bold text-slate-400 tabular-nums">{index + 1}</td>
                <td className="px-3 py-2 align-middle">
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    min="0"
                    onChange={(e) => updateRow(row.key, 'monto_cuota', e.target.value)}
                    placeholder="0"
                    type="number"
                    value={row.monto_cuota === 0 ? '' : String(row.monto_cuota)}
                  />
                </td>
                <td className="px-3 py-2 align-middle">
                  <input
                    className={inputClass}
                    onChange={(e) => updateRow(row.key, 'fecha_vencimiento', e.target.value)}
                    type="date"
                    value={row.fecha_vencimiento}
                  />
                </td>
                <td className="px-3 py-2 text-center align-middle">
                  <button
                    className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 dark:hover:bg-rose-900/20 dark:hover:text-rose-400"
                    disabled={rows.length === 1}
                    onClick={() => removeRow(row.key)}
                    title="Quitar cuota"
                    type="button"
                  >
                    <XMarkIcon className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs ${
        isBalanced
          ? 'border-slate-100 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300'
          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300'
      }`}>
        <span className="font-semibold">Total cuotas: {formatCurrency(total)}</span>
        <span className="font-medium">
          {isBalanced ? 'Cuadra con el monto requerido' : `Diferencia: ${formatCurrency(Math.abs(diff))} — debe sumar exactamente ${formatCurrency(maxAmount)}`}
        </span>
      </div>

      {error ? (
        <p className={`px-4 pb-1 text-xs font-semibold ${error.startsWith('Aviso:') ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-700">
        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          onClick={addRow}
          type="button"
        >
          <PlusIcon className="size-4" />
          Agregar cuota
        </button>
        <Button
          className="interactive-lift !rounded-xl !px-5 !py-2.5"
          disabled={!canSubmit}
          isLoading={isSubmitting}
          onClick={() => void handleSubmit()}
          type="button"
          variant="primary"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

function isCuotaRefinanciable(cuota: CuotaRecord): boolean {
  const saldo = Math.max(0, Number(cuota.saldo_cuota || 0))
  const estado = String(cuota.estado_cuota || '').toLowerCase()
  return saldo > 0 && estado !== 'pagada' && estado !== 'refinanciada'
}

function hasCuotasRealesActivas(cuotas: CuotaRecord[]): boolean {
  if (cuotas.length === 0) return false
  if (isCuotaInicialPlaceholder(cuotas)) return false
  return cuotas.some(isCuotaRefinanciable)
}

function RefinanciarForm({
  deudaId,
  cuotas,
  refinanciacionesPrevias,
  isSubmitting,
  numFactura,
  onClose,
  onSubmit,
}: {
  deudaId: string
  cuotas: CuotaRecord[]
  refinanciacionesPrevias: number
  isSubmitting: boolean
  numFactura?: string
  onClose?: () => void
  onSubmit: (payload: RefinanciarDeudaPayload) => Promise<void>
}) {
  const refinanciables = cuotas.filter(isCuotaRefinanciable)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selectedIds = refinanciables
    .filter((c) => selected[c.cuota_id])
    .map((c) => c.cuota_id)

  const montoRefinanciar = refinanciables
    .filter((c) => selected[c.cuota_id])
    .reduce((sum, c) => sum + Math.max(0, Number(c.saldo_cuota || 0)), 0)

  const esSegundaRefinanciacion = refinanciacionesPrevias >= 1
  const limiteAlcanzado = refinanciacionesPrevias >= 2

  const toggleCuota = (cuotaId: string) => {
    setSelected((prev) => ({ ...prev, [cuotaId]: !prev[cuotaId] }))
  }

  const handlePlanSubmit = async (plan: CrearPlanPagosPayload) => {
    setError(null)
    if (selectedIds.length === 0) {
      setError('Seleccioná al menos una cuota para refinanciar.')
      return
    }
    if (!motivo.trim()) {
      setError('El motivo de la refinanciación es obligatorio.')
      return
    }
    await onSubmit({
      deudaId: plan.deudaId,
      cuotaIds: selectedIds,
      cuotas: plan.cuotas,
      numFactura: plan.numFactura,
      motivoCambio: motivo.trim(),
    })
  }

  if (limiteAlcanzado) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
        Esta deuda ya alcanzó el máximo de 2 refinanciaciones aprobadas.
      </div>
    )
  }

  if (refinanciables.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
        No hay cuotas con saldo pendiente para refinanciar.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {esSegundaRefinanciacion && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          ⚠️ Esta será la <strong>última refinanciación</strong> permitida para esta deuda (2 de 2).
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Refinanciar cuotas</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Refinanciaciones previas: {refinanciacionesPrevias} de 2
            </p>
          </div>
          {onClose ? (
            <button
              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={onClose}
              type="button"
            >
              Cerrar
            </button>
          ) : null}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {refinanciables.map((cuota) => {
            const saldo = Math.max(0, Number(cuota.saldo_cuota || 0))
            const estado = String(cuota.estado_cuota || '').toLowerCase()
            return (
              <label
                key={cuota.cuota_id}
                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <input
                  checked={Boolean(selected[cuota.cuota_id])}
                  className="size-4 rounded border-slate-300"
                  onChange={() => toggleCuota(cuota.cuota_id)}
                  type="checkbox"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Cuota {cuota.numero_cuota}
                    <span className="ml-2 text-xs font-medium uppercase text-slate-400">{estado}</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Vence {formatDate(cuota.fecha_vencimiento)} · Saldo {formatCurrency(saldo)}
                  </p>
                </div>
              </label>
            )
          })}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-200">
          Monto a refinanciar: {formatCurrency(montoRefinanciar)}
          {selectedIds.length > 0 && montoRefinanciar > 0 ? (
            <span className="ml-2 text-xs font-medium text-slate-500">(el plan debe sumar exactamente este monto)</span>
          ) : null}
        </div>
      </div>

      <Input
        id="refinanciar-motivo"
        label="Motivo de refinanciación *"
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Ej: El aliado no puede cumplir el calendario actual"
        value={motivo}
      />

      {error ? (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}

      {montoRefinanciar > 0 ? (
        <PlanPagosForm
          balanceLabel="Monto a refinanciar"
          deudaId={deudaId}
          isSubmitting={isSubmitting}
          maxAmount={montoRefinanciar}
          numFactura={numFactura}
          onSubmit={handlePlanSubmit}
          submitLabel="Solicitar refinanciación"
        />
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">Seleccioná cuotas para armar el nuevo plan.</p>
      )}
    </div>
  )
}

// ─── SolicitudModal ───────────────────────────────────────────────────────────

interface UsuarioOption { user_id: string; nombre: string; email: string }

interface SolicitudModalProps {
  accion: string
  titulo: string
  descripcion: string
  approverRole: string    // rol que aprueba, para cargar la lista
  approverLabel: string   // label legible (Admin, Gerencia…)
  campoOptions?: { value: string; label: string }[]
  valoresActuales?: Record<string, string>
  onConfirmar: (
    observacion: string,
    asignadoUserId?: string,
    campo?: string,
    valorAnterior?: string,
    valorNuevo?: string,
  ) => Promise<void>
  onCerrar: () => void
}

const API_BASE = import.meta.env.VITE_API_URL?.trim() ?? ''
const DEFAULT_APPROVAL_ASSIGNEE_EMAIL = 'alvaro.arambulo@itti.digital'

function getSessionJwt(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const s = sessionStorage.getItem('loyalty-facturas-session')
    return s ? (JSON.parse(s) as { jwtToken?: string }).jwtToken ?? null : null
  } catch {
    return null
  }
}

function mergeAssigneeOptions(roleUsers: UsuarioOption[], alwaysInclude: UsuarioOption | null): UsuarioOption[] {
  if (!alwaysInclude) return roleUsers
  const alreadyListed = roleUsers.some(
    (user) =>
      user.user_id === alwaysInclude.user_id
      || user.email.toLowerCase() === alwaysInclude.email.toLowerCase(),
  )
  if (alreadyListed) return roleUsers
  return [alwaysInclude, ...roleUsers]
}

function normalizeEstadoDisplay(estado: string): string {
  const v = estado.trim().toLowerCase()
  if (v === 'activo' || v === 'active') return 'Activo'
  if (v === 'inactivo' || v === 'inactive') return 'Inactivo'
  return estado
}

function SolicitudModal({
  accion: _accion,
  titulo,
  descripcion,
  approverRole,
  approverLabel,
  campoOptions = [],
  valoresActuales = {},
  onConfirmar,
  onCerrar,
}: SolicitudModalProps) {
  const [obs, setObs] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedCampo, setSelectedCampo] = useState(campoOptions[0]?.value ?? '')
  const [valorNuevo, setValorNuevo] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)

  const esModificacionAliado = campoOptions.length > 0 && Object.keys(valoresActuales).length > 0
  const valorActual = valoresActuales[selectedCampo] ?? ''
  const requiereValorNuevo = esModificacionAliado && selectedCampo !== 'otro'

  useEffect(() => {
    setSelectedCampo(campoOptions[0]?.value ?? '')
    setValorNuevo('')
  }, [campoOptions])

  useEffect(() => {
    setValorNuevo('')
    setError(null)
  }, [selectedCampo])

  useEffect(() => {
    if (!approverRole) return
    setLoadingUsers(true)
    const jwt = getSessionJwt()
    const headers = { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) }

    Promise.all([
      fetch(`${API_BASE}/api/usuarios/por-rol?rol=${approverRole}`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/api/usuarios/por-email?email=${encodeURIComponent(DEFAULT_APPROVAL_ASSIGNEE_EMAIL)}`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([roleData, emailData]: [{ usuarios?: UsuarioOption[] }, { usuario?: UsuarioOption } | null]) => {
        const merged = mergeAssigneeOptions(roleData.usuarios ?? [], emailData?.usuario ?? null)
        setUsuarios(merged)
        const preferred = merged.find(
          (user) => user.email.toLowerCase() === DEFAULT_APPROVAL_ASSIGNEE_EMAIL.toLowerCase(),
        )
        setSelectedUserId(preferred?.user_id ?? merged[0]?.user_id ?? '')
      })
      .catch(() => { /* silent */ })
      .finally(() => setLoadingUsers(false))
  }, [approverRole])

  const handleSubmit = async () => {
    if (!obs.trim()) { setError('Ingresá una observación para continuar.'); return }
    if (campoOptions.length > 0 && !selectedCampo) {
      setError('Seleccioná qué dato querés modificar.')
      return
    }
    if (requiereValorNuevo) {
      if (!valorNuevo.trim()) {
        setError('Ingresá el nuevo valor.')
        return
      }
      if (valorNuevo.trim() === valorActual.trim()) {
        setError('El nuevo valor debe ser distinto al actual.')
        return
      }
    }
    setLoading(true); setError(null)
    try {
      await onConfirmar(
        obs.trim(),
        selectedUserId || undefined,
        selectedCampo || undefined,
        requiereValorNuevo ? valorActual : undefined,
        requiereValorNuevo ? valorNuevo.trim() : undefined,
      )
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar la solicitud.')
    } finally {
      setLoading(false)
    }
  }

  const selectedUser = usuarios.find((user) => user.user_id === selectedUserId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {done ? (
          <div className="text-center space-y-3 py-2">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <svg className="size-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-black text-slate-900 dark:text-white">Solicitud enviada</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pendiente de aprobación por <span className="font-semibold">{selectedUser?.nombre ?? approverLabel}</span>.
            </p>
            <Button className="interactive-lift w-full" onClick={onCerrar} type="button" variant="ghost">Cerrar</Button>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{titulo}</p>
            <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{descripcion}</p>

            {campoOptions.length > 0 ? (
              <div className="mt-4">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">
                  Qué querés modificar
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  onChange={(e) => setSelectedCampo(e.target.value)}
                  value={selectedCampo}
                >
                  {campoOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {requiereValorNuevo ? (
              <>
                <div className="mt-4">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">
                    Valor actual
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                    readOnly
                    type="text"
                    value={valorActual}
                  />
                </div>
                <div className="mt-4">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">
                    Nuevo valor
                  </label>
                  {selectedCampo === 'estado' ? (
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      onChange={(e) => setValorNuevo(e.target.value)}
                      value={valorNuevo}
                    >
                      <option value="">Seleccioná el nuevo estado</option>
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  ) : (
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      onChange={(e) => setValorNuevo(e.target.value)}
                      placeholder={
                        selectedCampo === 'nombre'
                          ? 'Nuevo nombre del aliado'
                          : selectedCampo === 'ruc'
                            ? 'Nuevo RUC'
                            : selectedCampo === 'codigo_persona'
                              ? 'Nuevo código de persona'
                              : 'Nuevo valor'
                      }
                      type="text"
                      value={valorNuevo}
                    />
                  )}
                </div>
              </>
            ) : null}

            <div className="mt-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">
                Enviar a ({approverLabel})
              </label>
              {loadingUsers ? (
                <p className="text-xs text-slate-400">Cargando usuarios...</p>
              ) : usuarios.length > 0 ? (
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  value={selectedUserId}
                >
                  {usuarios.map((user) => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.nombre} ({user.email})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-400">No hay usuarios disponibles para enviar la solicitud.</p>
              )}
            </div>

            <textarea
              autoFocus
              className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              onChange={(e) => setObs(e.target.value)}
              placeholder="Motivo u observación (requerido)..."
              rows={3}
              value={obs}
            />
            {error && <p className="mt-1.5 text-xs text-rose-500">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" disabled={loading} onClick={onCerrar} type="button" variant="ghost">Cancelar</Button>
              <button
                className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                disabled={loading || !obs.trim() || (requiereValorNuevo && !valorNuevo.trim())}
                onClick={() => void handleSubmit()}
                type="button"
              >
                {loading ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── CompromisosSection ───────────────────────────────────────────────────────

function CompromisosSection({
  compromisos,
  cuotas,
  aliadoId,
  approverLabel,
  onSolicitar,
}: {
  compromisos: CompromisosRecord[]
  cuotas: CuotaRecord[]
  aliadoId: string
  approverLabel: string | null
  onSolicitar: (payload: SolicitarAprobacionPayload) => Promise<{ aprobacion_id: string }>
}) {
  const [cuotaId, setCuotaId] = useState(cuotas[0]?.cuota_id ?? '')
  const [fecha, setFecha] = useState('')
  const [monto, setMonto] = useState('')
  const [obs, setObs] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCrear = async () => {
    if (!cuotaId || !fecha || !monto || Number(monto) <= 0) {
      setError('Completá cuota, fecha y monto.'); return
    }
    setLoading(true); setError(null)
    try {
      await onSolicitar({
        tabla: 'compromisos',
        registro_id: aliadoId,
        accion: 'CREAR_COMPROMISO',
        datos_solicitud: { cuota_id: cuotaId, fecha_compromiso: fecha, monto_compromiso: Number(monto), observacion: obs },
        observacion: obs || undefined,
      })
      setDone(true)
      setMonto(''); setFecha(''); setObs('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Compromisos de pago</h3>
      {compromisos.length > 0 ? (
        <div className="space-y-2">
          {compromisos.map((c) => (
            <div key={c.compromiso_id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex-1 text-sm">
                <span className="font-semibold text-slate-800 dark:text-white">{formatCurrency(c.monto_compromiso)}</span>
                <span className="ml-2 text-xs text-slate-400">· {formatDate(c.fecha_compromiso)}</span>
                {c.observacion && <p className="mt-0.5 text-xs text-slate-400">{c.observacion}</p>}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase ${estadoBadge[c.estado_compromiso?.toLowerCase()] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                {c.estado_compromiso}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 dark:text-slate-500">Sin compromisos registrados.</p>
      )}

      {/* Form nuevo compromiso */}
      {approverLabel !== null && (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-4 space-y-3 dark:border-slate-700 dark:bg-slate-800/60">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Solicitar nuevo compromiso</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Cuota</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              onChange={(e) => setCuotaId(e.target.value)}
              value={cuotaId}
            >
              {cuotas.map((c) => (
                <option key={c.cuota_id} value={c.cuota_id}>Cuota {c.numero_cuota} — {formatCurrency(c.monto_cuota)}</option>
              ))}
            </select>
          </div>
          <Input id="comp-fecha" label="Fecha compromiso" onChange={(e) => setFecha(e.target.value)} type="date" value={fecha} />
          <Input id="comp-monto" inputMode="decimal" label="Monto *" min="0" onChange={(e) => setMonto(e.target.value)} placeholder="Ej: 500000" type="number" value={monto} />
        </div>
        <Input id="comp-obs" label="Observación" onChange={(e) => setObs(e.target.value)} placeholder="Opcional" value={obs} />
        {error && <p className="text-xs text-rose-500">{error}</p>}
        {done && <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Solicitud enviada, pendiente de aprobación.</p>}
        <Button className="interactive-lift" isLoading={loading} onClick={() => void handleCrear()} type="button" variant="primary">
          Solicitar compromiso
        </Button>
      </div>
      )}
    </section>
  )
}

export function AllyDetailPage({
  allyDetail,
  isLoading = false,
  onAssignInvoiceNumber,
  onBack,
  onCreateCompromiso: _onCreateCompromiso,
  onCreatePlan,
  onRefinanciar,
  onRegisterPayment,
  onAnularPagoDirecto,
  onSolicitarAprobacion,
  userRole,
}: AllyDetailPageProps) {
  const [invoiceTargetFacturaId, setInvoiceTargetFacturaId] = useState<string | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [applyInvoiceToCuotas, setApplyInvoiceToCuotas] = useState(true)
  const [assigningInvoice, setAssigningInvoice] = useState(false)
  const [planTargetFacturaId, setPlanTargetFacturaId] = useState<string | null>(null)
  const [expandedCuotasIds, setExpandedCuotasIds] = useState<Record<string, boolean>>({})
  const [cuotasByFactura, setCuotasByFactura] = useState<Record<string, CuotaRecord[]>>({})
  const [cuotasLoading, setCuotasLoading] = useState<Record<string, boolean>>({})
  const [facturas, setFacturas] = useState<FacturaRecord[]>([])
  const [facturasTotal, setFacturasTotal] = useState(0)
  const [facturasTotalPages, setFacturasTotalPages] = useState(1)
  const [facturasLoading, setFacturasLoading] = useState(false)
  const [facturasError, setFacturasError] = useState<string | null>(null)
  const [exportingFacturas, setExportingFacturas] = useState(false)
  const [facturaFilter, setFacturaFilter] = useState<FacturaEstadoFilter>('pendientes')
  const [facturaSearch, setFacturaSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [facturaPage, setFacturaPage] = useState(1)
  const [openActionsId, setOpenActionsId]             = useState<string | null>(null)
  const [actionsMenuPos, setActionsMenuPos] = useState<{ top: number; left: number } | null>(null)
  const actionsMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false)
  const [refinanciarTargetFacturaId, setRefinanciarTargetFacturaId] = useState<string | null>(null)
  const [refinanciacionesByFactura, setRefinanciacionesByFactura] = useState<Record<string, number>>({})
  const [isSubmittingRefinanciar, setIsSubmittingRefinanciar] = useState(false)
  const [pagoModalTarget, setPagoModalTarget] = useState<RegistrarPagoModalTarget | null>(null)

  // Cerrar dropdown de acciones al hacer click fuera
  useEffect(() => {
    if (!openActionsId) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-actions-menu]')) {
        setOpenActionsId(null)
        setActionsMenuPos(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openActionsId])

  // Reposicionar menú flotante al scrollear o redimensionar
  useEffect(() => {
    if (!openActionsId || !actionsMenuButtonRef.current) return
    const updatePosition = () => {
      if (actionsMenuButtonRef.current) {
        setActionsMenuPos(positionActionsMenu(actionsMenuButtonRef.current))
      }
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [openActionsId])

  type ModalConfig = {
    titulo: string
    descripcion: string
    accion: SolicitarAprobacionPayload['accion']
    tabla: string
    registro_id: string
    datos?: Record<string, unknown>
    campoOptions?: { value: string; label: string }[]
    valoresActuales?: Record<string, string>
    approverRole?: string
    approverLabel?: string
  }
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null)
  const [anularPagoConfirm, setAnularPagoConfirm] = useState<{
    cuotaId: string
    cuotaNumero: number
    facturaId: string
  } | null>(null)

  const { aliado, compromisos, resumen } = allyDetail
  const approverLabel = getApproverLabel(userRole)
  const needsApproval = requiresApproval(userRole)
  const prevDetailLoading = useRef(isLoading)

  const loadFacturas = useCallback(async () => {
    setFacturasLoading(true)
    setFacturasError(null)
    try {
      const result = await listarFacturasAliado(aliado.aliado_id, {
        page: facturaPage,
        pageSize: FACTURAS_PAGE_SIZE,
        estado: facturaFilter,
        search: debouncedSearch,
      })
      setFacturas(result.items)
      setFacturasTotal(result.total)
      setFacturasTotalPages(result.totalPages)
      if (result.page !== facturaPage) {
        setFacturaPage(result.page)
      }
    } catch (e) {
      setFacturasError(e instanceof Error ? e.message : 'Error al cargar facturas.')
    } finally {
      setFacturasLoading(false)
    }
  }, [aliado.aliado_id, debouncedSearch, facturaFilter, facturaPage])

  const loadCuotas = useCallback(async (facturaId: string) => {
    setCuotasLoading((prev) => ({ ...prev, [facturaId]: true }))
    try {
      const result = await obtenerCuotasFactura(aliado.aliado_id, facturaId)
      setCuotasByFactura((prev) => ({ ...prev, [facturaId]: result.items }))
      setRefinanciacionesByFactura((prev) => ({
        ...prev,
        [facturaId]: result.refinanciaciones_previas ?? 0,
      }))
    } catch (e) {
      setFacturasError(e instanceof Error ? e.message : 'Error al cargar cuotas.')
    } finally {
      setCuotasLoading((prev) => ({ ...prev, [facturaId]: false }))
    }
  }, [aliado.aliado_id])

  const invalidateCuotasCache = useCallback((facturaId: string) => {
    setCuotasByFactura((prev) => {
      const next = { ...prev }
      delete next[facturaId]
      return next
    })
    setRefinanciacionesByFactura((prev) => {
      const next = { ...prev }
      delete next[facturaId]
      return next
    })
  }, [])

  const handleAnularPago = useCallback((
    factura: FacturaRecord,
    cuotaId: string,
    cuotaNumero: number,
  ) => {
    if (needsApproval) {
      setModalConfig({
        accion: 'ANULAR_PAGO',
        tabla: 'pagos',
        registro_id: cuotaId,
        titulo: 'Solicitar anulación de pago',
        descripcion: `Solicitás anular el pago de la Cuota ${cuotaNumero} de ${factura.factura_id}. Indicá el motivo.`,
        datos: {
          aliado_id:     String(aliado.aliado_id),
          aliado_nombre: aliado.aliado_nombre,
          cuota_id:      cuotaId,
          numero_cuota:  cuotaNumero,
          factura_id:    factura.factura_id,
          monto_neto:    Number(factura.monto_neto),
        },
      })
      return
    }

    if (!onAnularPagoDirecto) return
    setAnularPagoConfirm({
      cuotaId,
      cuotaNumero,
      facturaId: factura.factura_id,
    })
  }, [
    aliado.aliado_id,
    aliado.aliado_nombre,
    needsApproval,
    onAnularPagoDirecto,
  ])

  const handleConfirmAnularPago = useCallback(async () => {
    if (!onAnularPagoDirecto || !anularPagoConfirm) return

    await onAnularPagoDirecto(anularPagoConfirm.cuotaId)
    invalidateCuotasCache(anularPagoConfirm.facturaId)
    if (expandedCuotasIds[anularPagoConfirm.facturaId]) {
      void loadCuotas(anularPagoConfirm.facturaId)
    }
    void loadFacturas()
    setAnularPagoConfirm(null)
  }, [
    anularPagoConfirm,
    expandedCuotasIds,
    invalidateCuotasCache,
    loadCuotas,
    loadFacturas,
    onAnularPagoDirecto,
  ])

  const toggleCuotas = (facturaId: string) => {
    const willExpand = !expandedCuotasIds[facturaId]
    if (willExpand) {
      setInvoiceTargetFacturaId(null)
      setPlanTargetFacturaId(null)
      setRefinanciarTargetFacturaId(null)
    }
    setExpandedCuotasIds((prev) => ({
      ...prev,
      [facturaId]: willExpand,
    }))
    if (willExpand && !cuotasByFactura[facturaId]) {
      void loadCuotas(facturaId)
    }
  }

  const openAssignInvoice = (facturaId: string, currentNumFactura?: string | null) => {
    setPlanTargetFacturaId(null)
    setRefinanciarTargetFacturaId(null)
    setExpandedCuotasIds((prev) => ({ ...prev, [facturaId]: false }))
    setInvoiceTargetFacturaId(facturaId)
    setInvoiceNumber(currentNumFactura?.trim() || '')
    setOpenActionsId(null)
    setActionsMenuPos(null)
  }

  const closeAssignInvoice = () => {
    setInvoiceTargetFacturaId(null)
    setInvoiceNumber('')
    setApplyInvoiceToCuotas(true)
  }

  const openPlanPagos = (facturaId: string) => {
    setInvoiceTargetFacturaId(null)
    setRefinanciarTargetFacturaId(null)
    setExpandedCuotasIds((prev) => ({ ...prev, [facturaId]: false }))
    setPlanTargetFacturaId(facturaId)
    setOpenActionsId(null)
    setActionsMenuPos(null)
  }

  const closePlanPagos = () => {
    setPlanTargetFacturaId(null)
  }

  const openRefinanciar = (facturaId: string) => {
    setInvoiceTargetFacturaId(null)
    setPlanTargetFacturaId(null)
    setExpandedCuotasIds((prev) => ({ ...prev, [facturaId]: false }))
    setRefinanciarTargetFacturaId(facturaId)
    setOpenActionsId(null)
    setActionsMenuPos(null)
    if (!cuotasByFactura[facturaId]) {
      void loadCuotas(facturaId)
    }
  }

  const closeRefinanciar = () => {
    setRefinanciarTargetFacturaId(null)
  }

  const canAutoExecuteRefinance = userRole === 'admin' || userRole === 'gerencia'

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(facturaSearch.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [facturaSearch])

  useEffect(() => {
    setFacturaPage(1)
    setFacturaSearch('')
    setDebouncedSearch('')
    setFacturaFilter('pendientes')
    setExpandedCuotasIds({})
    setCuotasByFactura({})
    setCuotasLoading({})
    setRefinanciacionesByFactura({})
  }, [allyDetail.aliado.aliado_id])

  useEffect(() => {
    setFacturaPage(1)
  }, [facturaFilter, debouncedSearch])

  useEffect(() => {
    setInvoiceTargetFacturaId(null)
    setPlanTargetFacturaId(null)
    setRefinanciarTargetFacturaId(null)
    setOpenActionsId(null)
    setActionsMenuPos(null)
  }, [facturaPage, facturaFilter, debouncedSearch])

  useEffect(() => {
    void loadFacturas()
  }, [loadFacturas])

  useEffect(() => {
    if (prevDetailLoading.current && !isLoading) {
      setExpandedCuotasIds({})
      setCuotasByFactura({})
      void loadFacturas()
    }
    prevDetailLoading.current = isLoading
  }, [isLoading, loadFacturas])

  const handleExportFacturas = async () => {
    setExportingFacturas(true)
    setFacturasError(null)
    try {
      await exportarFacturasAliado(aliado.aliado_id, {
        estado: facturaFilter,
        search: debouncedSearch,
      })
    } catch (e) {
      setFacturasError(e instanceof Error ? e.message : 'Error al exportar facturas.')
    } finally {
      setExportingFacturas(false)
    }
  }

  const handlePayCuota = (cuota: CuotaRecord) => {
    const factura = facturas.find((f) => String(f.factura_id) === String(cuota.factura_id))
    if (!tieneNumFacturaAsignada(factura?.num_factura)) {
      setFacturasError('Asigná el N° de factura antes de registrar un pago.')
      return
    }
    setPagoModalTarget({
      mode: 'cuota',
      facturaId: String(cuota.factura_id),
      cuota,
      numFactura: factura?.num_factura || undefined,
    })
  }

  const handleOpenPayDeuda = (facturaId: string) => {
    const factura = facturas.find((f) => String(f.factura_id) === String(facturaId))
    if (!factura) return
    if (!tieneNumFacturaAsignada(factura.num_factura)) {
      setFacturasError('Asigná el N° de factura antes de registrar un pago.')
      return
    }
    setPagoModalTarget({
      mode: 'deuda',
      facturaId: String(factura.factura_id),
      saldoFactura: Number(factura.saldo_factura || 0),
      numFactura: factura.num_factura || undefined,
    })
  }

  const handleRegisterPayment = async (payload: RegistrarPagoPayload) => {
    await onRegisterPayment(payload)
    await loadFacturas()
    if (payload.cuotaId) {
      const facturaId = payload.facturaId
      if (expandedCuotasIds[facturaId] || cuotasByFactura[facturaId]) {
        await loadCuotas(facturaId)
      }
    } else if (expandedCuotasIds[payload.facturaId]) {
      await loadCuotas(payload.facturaId)
    }
  }

  const handleAssignInvoiceNumber = async (facturaId: string) => {
    const deudaId = String(
      facturas.find((f) => String(f.factura_id) === String(facturaId))?.deuda_id || facturaId,
    ).trim()
    if (!deudaId || !invoiceNumber.trim()) return
    setAssigningInvoice(true)
    try {
      await onAssignInvoiceNumber({
        deudaId,
        numFactura: invoiceNumber.trim(),
        aplicarEnCuotas: applyInvoiceToCuotas,
      })
      closeAssignInvoice()
    } finally {
      setAssigningInvoice(false)
    }
  }

  const saldoAFavor = Number(
    resumen.saldo_a_favor ?? aliado.saldo_a_favor ?? 0,
  )

  return (
    <>
    <div className="flex w-full flex-col gap-5">

      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          onClick={onBack}
          type="button"
        >
          <ArrowLeftIcon className="size-4" />
          Volver
        </button>
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Detalle del aliado</p>
          <p className="text-lg font-black text-slate-950 leading-tight dark:text-white">
            {aliado.aliado_nombre}
            <span className="ml-2 text-sm font-medium text-slate-400 dark:text-slate-500">ID {aliado.aliado_id}</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          {aliado.ruc && (
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">RUC: {aliado.ruc}</span>
          )}
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ${aliado.estado === 'activo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
            {aliado.estado}
          </span>
          {needsApproval && (
            <>
              <button
                className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-400"
                onClick={() => setModalConfig({
                  accion: 'MODIFICAR_ALIADO', tabla: 'directorio_aliados', registro_id: String(aliado.aliado_id),
                  titulo: 'Solicitar modificación',
                  descripcion: `Indicá qué dato de ${aliado.aliado_nombre} querés modificar y el nuevo valor.`,
                  datos: {
                    aliado_id:     String(aliado.aliado_id),
                    aliado_nombre: aliado.aliado_nombre,
                    ruc:           aliado.ruc ?? null,
                    estado_actual: aliado.estado,
                  },
                  valoresActuales: {
                    nombre:         aliado.aliado_nombre,
                    ruc:            aliado.ruc ?? '',
                    estado:         normalizeEstadoDisplay(aliado.estado),
                    codigo_persona: aliado.codigo_persona ?? '',
                  },
                  campoOptions: [
                    { value: 'nombre', label: 'Nombre del aliado' },
                    { value: 'ruc', label: 'RUC' },
                    { value: 'estado', label: 'Estado del aliado' },
                    { value: 'codigo_persona', label: 'Código de persona' },
                    { value: 'otro', label: 'Otro' },
                  ],
                })}
                type="button"
              >
                Solicitar modificación
              </button>
              <button
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                onClick={() => setModalConfig({
                  accion: 'BAJA_ALIADO', tabla: 'directorio_aliados', registro_id: String(aliado.aliado_id),
                  titulo: 'Solicitar baja del aliado',
                  descripcion: `Estás solicitando la baja de ${aliado.aliado_nombre}. Indicá el motivo.`,
                  datos: {
                    aliado_id:     String(aliado.aliado_id),
                    aliado_nombre: aliado.aliado_nombre,
                    ruc:           aliado.ruc ?? null,
                    estado_actual: aliado.estado,
                  },
                })}
                type="button"
              >
                Solicitar baja
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Deuda total',  value: formatCurrency(resumen.deuda_total),           color: 'text-slate-950 dark:text-white' },
          { label: 'Pagado',       value: formatCurrency(Math.max(0, Number(resumen.monto_total_pagado || 0))), color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Saldo',        value: formatCurrency(resumen.saldo_pendiente),        color: 'text-amber-600 dark:text-amber-400' },
          { label: 'A favor',      value: formatCurrency(saldoAFavor),                   color: 'text-emerald-700 dark:text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{s.label}</p>
            <p className={`mt-1 text-lg font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Facturas / cuotas */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-3 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1">
              {(Object.keys(FACTURA_FILTER_LABELS) as FacturaEstadoFilter[]).map((filter) => (
                <button
                  key={filter}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                    facturaFilter === filter
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                  onClick={() => setFacturaFilter(filter)}
                  type="button"
                >
                  {FACTURA_FILTER_LABELS[filter]}
                </button>
              ))}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:min-w-[340px]">
              <input
                className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/30"
                onChange={(e) => setFacturaSearch(e.target.value)}
                placeholder="Buscar período, N°, servicio..."
                value={facturaSearch}
              />
              <button
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                disabled={exportingFacturas || facturasLoading}
                onClick={() => void handleExportFacturas()}
                type="button"
              >
                {exportingFacturas ? 'Exportando...' : 'Exportar CSV'}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-[11px] font-medium text-slate-400 dark:border-slate-700 dark:text-slate-500">
            <span>
              Mostrando {facturas.length} de {facturasTotal} facturas
              {facturaFilter === 'pendientes' ? ' pendientes' : ''}
              {facturasLoading ? ' · actualizando...' : ''}
            </span>
            {facturasError ? <span className="text-rose-500">{facturasError}</span> : null}
          </div>

          {facturasLoading && facturas.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              Cargando facturas...
            </p>
          ) : facturas.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              No hay facturas con el filtro seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Factura / Cuota</th>
                    <th className="w-28 px-3 py-2.5 text-center">Estado</th>
                    <th className="w-28 px-3 py-2.5 text-right">Monto</th>
                    <th className="w-28 px-3 py-2.5 text-right">Pagado</th>
                    <th className="w-28 px-3 py-2.5 text-right">Saldo</th>
                    <th className="w-32 px-3 py-2.5 text-center">Vence</th>
                    <th className="w-44 px-4 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {facturas.map((factura) => {
                const totalFactura = factura.cuotas_total ?? 0
                const pagadasFactura = factura.cuotas_pagadas ?? 0
                const pendientesFactura = factura.cuotas_pendientes ?? 0
                const cuotasFactura = cuotasByFactura[factura.factura_id] ?? []
                const servicioFactura = factura.servicio || factura.tipo_factura || 'Sin especificar'
                const isAssignInvoiceHere = invoiceTargetFacturaId === factura.factura_id
                const isPlanHere = planTargetFacturaId === factura.factura_id
                const isRefinanciarHere = refinanciarTargetFacturaId === factura.factura_id
                const deudaId = String(factura.deuda_id || factura.factura_id)
                const refinanciacionesPrevias = refinanciacionesByFactura[factura.factura_id] ?? 0
                const montoNeto = Number(factura.monto_neto || 0)
                const saldoPendiente = Number(factura.saldo_factura || 0)
                const hasActiveCuotas = hasCuotasRealesActivas(cuotasFactura)
                const canCreatePlan = Boolean(String(deudaId || '').trim())
                  && saldoPendiente > 0
                  && !hasActiveCuotas
                const canRefinanciar = Boolean(String(deudaId || '').trim())
                  && saldoPendiente > 0
                  && hasActiveCuotas
                  && refinanciacionesPrevias < 2
                const cuotasExpanded = Boolean(expandedCuotasIds[factura.factura_id])
                const montoPagado = Math.max(0, montoNeto - saldoPendiente)
                const estadoKey = String(factura.estado_factura || '').toLowerCase()
                const fechaVencimiento = resolveFechaVencimientoFactura(factura, cuotasFactura)
                const puedeRegistrarPago = tieneNumFacturaAsignada(factura.num_factura) && saldoPendiente > 0

                return (
                  <Fragment key={factura.factura_id}>
                    <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 align-middle">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {formatFacturaTitulo(factura, servicioFactura)}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                          {formatFacturaSubtitulo(factura, servicioFactura)}
                        </p>
                        {saldoPendiente > 0 && (
                          <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                            {!factura.num_factura?.trim()
                              ? 'Sin N° factura · el vencimiento inicia al asignarlo'
                              : isCuotaInicialPlaceholder(cuotasFactura)
                                ? 'Vencimiento a 30 días desde asignación de factura'
                                : totalFactura > 0
                                  ? `${pagadasFactura}/${totalFactura} cuotas${pendientesFactura > 0 ? ` · ${pendientesFactura} pend.` : ''}`
                                  : 'Sin cuotas · asigná N° factura o creá un plan'}
                          </p>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center align-middle">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${estadoBadge[estadoKey] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                          {factura.estado_factura}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-right align-middle text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                        {formatCurrency(montoNeto)}
                      </td>

                      <td className="px-3 py-3 text-right align-middle text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(montoPagado)}
                      </td>

                      <td className={`px-3 py-3 text-right align-middle text-sm font-bold tabular-nums ${saldoPendiente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                        {formatCurrency(saldoPendiente)}
                      </td>

                      <td className="px-3 py-3 text-center align-middle">
                        <VenceCell fecha={fechaVencimiento} />
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {totalFactura > 0 && (
                            <button
                              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                              onClick={() => toggleCuotas(factura.factura_id)}
                              type="button"
                            >
                              <ChevronDownIcon className={`size-3.5 shrink-0 transition-transform ${cuotasExpanded ? 'rotate-180' : ''}`} />
                              {cuotasExpanded
                                ? 'Ocultar'
                                : pendientesFactura > 0
                                  ? `Cuotas (${pendientesFactura})`
                                  : `Cuotas (${totalFactura})`}
                            </button>
                          )}
                          {puedeRegistrarPago && (
                            <button
                              className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                              onClick={() => handleOpenPayDeuda(factura.factura_id)}
                              type="button"
                            >
                              <BanknotesIcon className="size-3.5" />
                              Pagar
                            </button>
                          )}
                          <div data-actions-menu>
                            <button
                              ref={openActionsId === factura.factura_id ? actionsMenuButtonRef : undefined}
                              className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                              onClick={(e) => {
                                if (openActionsId === factura.factura_id) {
                                  setOpenActionsId(null)
                                  setActionsMenuPos(null)
                                  return
                                }
                                actionsMenuButtonRef.current = e.currentTarget
                                setActionsMenuPos(positionActionsMenu(e.currentTarget))
                                setOpenActionsId(factura.factura_id)
                              }}
                              type="button"
                            >
                              <EllipsisVerticalIcon className="size-4" />
                            </button>
                            {openActionsId === factura.factura_id && actionsMenuPos && typeof document !== 'undefined' && createPortal(
                              <div
                                className="fixed z-[200] w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-800 dark:ring-white/10"
                                data-actions-menu
                                style={{ top: actionsMenuPos.top, left: actionsMenuPos.left }}
                              >
                              <button
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                                onClick={() => {
                                  if (isAssignInvoiceHere) closeAssignInvoice()
                                  else openAssignInvoice(factura.factura_id, factura.num_factura)
                                }}
                                type="button"
                              >
                                <span className="text-slate-400">#</span>
                                {isAssignInvoiceHere ? 'Cancelar asignación' : 'Asignar N° factura'}
                              </button>
                              <button
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
                                disabled={!canCreatePlan}
                                onClick={() => {
                                  if (isPlanHere) closePlanPagos()
                                  else openPlanPagos(factura.factura_id)
                                }}
                                type="button"
                              >
                                <span className="text-slate-400">📅</span>
                                {isPlanHere ? 'Cerrar plan' : 'Plan de pagos'}
                              </button>
                              <button
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
                                disabled={!canRefinanciar}
                                onClick={() => {
                                  if (isRefinanciarHere) closeRefinanciar()
                                  else openRefinanciar(factura.factura_id)
                                }}
                                type="button"
                              >
                                <span className="text-slate-400">↻</span>
                                {isRefinanciarHere ? 'Cerrar refinanciación' : 'Refinanciar'}
                              </button>
                              {needsApproval && (
                                <>
                                  <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                                  <button
                                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                                    onClick={() => {
                                      setOpenActionsId(null)
                                      setActionsMenuPos(null)
                                      setModalConfig({
                                        accion: 'ANULAR_DEUDA', tabla: 'facturacion', registro_id: deudaId,
                                        titulo: 'Solicitar anulación de deuda',
                                        descripcion: `Solicitás anular la deuda ${factura.factura_id} (${formatCurrency(Number(factura.monto_neto))}). Indicá el motivo.`,
                                        datos: {
                                          aliado_id:     String(aliado.aliado_id),
                                          aliado_nombre: aliado.aliado_nombre,
                                          factura_id:    factura.factura_id,
                                          deuda_id:      deudaId,
                                          monto_neto:    Number(factura.monto_neto),
                                          saldo_factura: Number(factura.saldo_factura),
                                          periodo:       factura.periodo ?? null,
                                          tipo_factura:  factura.tipo_factura ?? null,
                                          estado_actual: factura.estado_factura,
                                        },
                                      })
                                    }}
                                    type="button"
                                  >
                                    <span>⚠</span>
                                    Solicitar anulación
                                  </button>
                                </>
                              )}
                              </div>,
                              document.body,
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {cuotasExpanded && (
                      <CuotaRows
                        cuotas={cuotasFactura}
                        isLoading={Boolean(cuotasLoading[factura.factura_id])}
                        permitePago={puedeRegistrarPago}
                        onOpenPay={handlePayCuota}
                        onAnularPago={(cuotaId, cuotaNumero) => handleAnularPago(factura, cuotaId, cuotaNumero)}
                      />
                    )}

                    {(isAssignInvoiceHere || isPlanHere || isRefinanciarHere) && (
                      <tr>
                        <td className="bg-slate-50/70 p-3 dark:bg-slate-900/25" colSpan={7}>
                        {isAssignInvoiceHere ? (
                          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                              <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Asignar N° de factura</p>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Completá el número fiscal de la deuda.</p>
                              </div>
                              <button
                                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                                onClick={closeAssignInvoice}
                                type="button"
                              >
                                Cerrar
                              </button>
                            </div>
                            <div className="space-y-3 px-4 py-4">
                              <Input
                                id={`assign-invoice-${factura.factura_id}`}
                                label="Número de factura"
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                placeholder="Ej: 0001-00123456"
                                value={invoiceNumber}
                              />
                              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                                <input
                                  checked={applyInvoiceToCuotas}
                                  className="size-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                  onChange={(e) => setApplyInvoiceToCuotas(e.target.checked)}
                                  type="checkbox"
                                />
                                Aplicar también a cuotas
                              </label>
                              <div className="flex justify-end border-t border-slate-100 pt-3 dark:border-slate-700">
                                <Button
                                  className="interactive-lift !rounded-xl !px-5 !py-2.5"
                                  isLoading={assigningInvoice}
                                  onClick={() => void handleAssignInvoiceNumber(factura.factura_id)}
                                  type="button"
                                  variant="primary"
                                >
                                  Guardar número
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {isPlanHere ? (
                          <PlanPagosForm
                            deudaId={deudaId}
                            isSubmitting={isSubmittingPlan}
                            maxAmount={Math.max(0, Number(factura.saldo_factura || 0))}
                            numFactura={factura.num_factura || ''}
                            onClose={closePlanPagos}
                            onSubmit={async (payload) => {
                                setIsSubmittingPlan(true)
                                try {
                                  if (needsApproval) {
                                    const saldoPendiente = Math.max(0, Number(factura.saldo_factura || 0))
                                    setModalConfig({
                                      accion: 'CREAR_PLAN',
                                      titulo: 'Solicitar plan de pagos',
                                      descripcion: `Plan de ${payload.cuotas.length} cuotas por saldo pendiente ${formatCurrency(saldoPendiente)} (deuda ${factura.factura_id}).`,
                                      tabla: 'facturacion',
                                      registro_id: deudaId,
                                      datos: {
                                        aliado_id:       String(aliado.aliado_id),
                                        aliado_nombre:   aliado.aliado_nombre,
                                        factura_id:      factura.factura_id,
                                        deuda_id:        deudaId,
                                        monto_neto:      Number(factura.monto_neto),
                                        saldo_pendiente: saldoPendiente,
                                        cuotas:          payload.cuotas,
                                        num_factura:     payload.numFactura,
                                      },
                                    })
                                    closePlanPagos()
                                  } else {
                                    await onCreatePlan(payload)
                                    invalidateCuotasCache(factura.factura_id)
                                    closePlanPagos()
                                  }
                                } finally {
                                  setIsSubmittingPlan(false)
                                }
                              }}
                            />
                        ) : null}

                        {isRefinanciarHere ? (
                          <RefinanciarForm
                            cuotas={cuotasFactura}
                            deudaId={deudaId}
                            isSubmitting={isSubmittingRefinanciar}
                            numFactura={factura.num_factura || ''}
                            onClose={closeRefinanciar}
                            refinanciacionesPrevias={refinanciacionesPrevias}
                            onSubmit={async (payload) => {
                              setIsSubmittingRefinanciar(true)
                              try {
                                const montoRefinanciar = cuotasFactura
                                  .filter((c) => payload.cuotaIds.includes(c.cuota_id))
                                  .reduce((sum, c) => sum + Math.max(0, Number(c.saldo_cuota || 0)), 0)

                                if (canAutoExecuteRefinance) {
                                  await onRefinanciar(payload)
                                  invalidateCuotasCache(factura.factura_id)
                                  closeRefinanciar()
                                } else {
                                  setModalConfig({
                                    accion: 'REFINANCIAR_DEUDA',
                                    titulo: 'Solicitar refinanciación',
                                    descripcion: `Refinanciación de ${payload.cuotaIds.length} cuota(s) por ${formatCurrency(montoRefinanciar)} (deuda ${factura.factura_id}).`,
                                    tabla: 'facturacion',
                                    registro_id: deudaId,
                                    approverRole: 'gerencia',
                                    approverLabel: 'Gerencia',
                                    datos: {
                                      aliado_id:       String(aliado.aliado_id),
                                      aliado_nombre:   aliado.aliado_nombre,
                                      factura_id:      factura.factura_id,
                                      deuda_id:        deudaId,
                                      cuota_ids:       payload.cuotaIds,
                                      cuotas:          payload.cuotas,
                                      motivo:          payload.motivoCambio,
                                      monto_refinanciar: montoRefinanciar,
                                      refinanciaciones_previas: refinanciacionesPrevias,
                                      ...(payload.numFactura ? { num_factura: payload.numFactura } : {}),
                                    },
                                  })
                                  closeRefinanciar()
                                }
                              } finally {
                                setIsSubmittingRefinanciar(false)
                              }
                            }}
                          />
                        ) : null}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
                </tbody>
              </table>
            </div>
          )}

          {facturasTotalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Página {facturaPage} de {facturasTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300"
                  disabled={facturaPage <= 1 || facturasLoading}
                  onClick={() => setFacturaPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  Anterior
                </button>
                <button
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300"
                  disabled={facturaPage >= facturasTotalPages || facturasLoading}
                  onClick={() => setFacturaPage((p) => Math.min(facturasTotalPages, p + 1))}
                  type="button"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
      </div>

      {/* Compromisos ocultos: se reemplaza por el flujo de plan de pagos */}
      {false && (
        <CompromisosSection
          aliadoId={String(aliado.aliado_id)}
          approverLabel={approverLabel}
          compromisos={compromisos}
          cuotas={Object.values(cuotasByFactura).flat()}
          onSolicitar={onSolicitarAprobacion}
        />
      )}

    </div>

    {/* Modal de aprobación */}
    {modalConfig && (
      <SolicitudModal
        accion={modalConfig.accion}
        approverLabel={modalConfig.approverLabel ?? approverLabel ?? 'Admin'}
        approverRole={
          modalConfig.approverRole
            ?? (approverLabel === 'Admin'
              ? 'admin'
              : approverLabel === 'Gerencia'
                ? 'gerencia'
                : approverLabel === 'Operaciones'
                  ? 'operaciones'
                  : 'alianzas')
        }
        campoOptions={modalConfig.campoOptions}
        valoresActuales={modalConfig.valoresActuales}
        descripcion={modalConfig.descripcion}
        onCerrar={() => setModalConfig(null)}
        onConfirmar={async (observacion, asignadoUserId, campo, valorAnterior, valorNuevo) => {
          const datosSolicitud =
            modalConfig.accion === 'MODIFICAR_ALIADO'
              ? {
                  ...modalConfig.datos,
                  campo_modificar: campo || null,
                  ...(valorAnterior !== undefined ? { valor_anterior: valorAnterior } : {}),
                  ...(valorNuevo !== undefined ? { valor_nuevo: valorNuevo } : {}),
                }
              : modalConfig.datos
          await onSolicitarAprobacion({
            accion: modalConfig.accion,
            tabla: modalConfig.tabla,
            registro_id: modalConfig.registro_id,
            datos_solicitud: datosSolicitud,
            observacion,
            asignado_a_user_id: asignadoUserId,
          })
        }}
        titulo={modalConfig.titulo}
      />
    )}

    <RegistrarPagoModal
      open={pagoModalTarget !== null}
      target={pagoModalTarget}
      saldoAFavorActual={saldoAFavor}
      onClose={() => setPagoModalTarget(null)}
      onSubmit={handleRegisterPayment}
    />

    <ConfirmDialog
      cancelLabel="Cancelar"
      confirmLabel="Anular pago"
      message={
        anularPagoConfirm
          ? `Se revertirá el pago registrado en la Cuota ${anularPagoConfirm.cuotaNumero} y se actualizará el saldo pendiente.`
          : ''
      }
      open={anularPagoConfirm !== null}
      title="¿Anular el pago registrado?"
      variant="danger"
      onCancel={() => setAnularPagoConfirm(null)}
      onConfirm={handleConfirmAnularPago}
    />
  </>
  )
}
