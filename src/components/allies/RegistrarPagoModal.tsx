import { useEffect, useMemo, useRef, useState } from 'react'

import type {
  CuotaRecord,
  DestinoAplicacionPago,
  RegistrarPagoPayload,
} from '../../types/allyDebt'
import { previewAplicacionPago } from '../../services/alliesApi'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

const MEDIOS = [
  'Transferencia',
  'Efectivo',
  'Cheque',
  'NC',
  'Saldo a Favor',
] as const

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(Math.round(n))
}

const today = () => new Date().toISOString().slice(0, 10)

export type RegistrarPagoModalTarget =
  | {
      mode: 'cuota'
      facturaId: string
      cuota: CuotaRecord
      numFactura?: string
    }
  | {
      mode: 'deuda'
      facturaId: string
      saldoFactura: number
      numFactura?: string
    }

type Props = {
  open: boolean
  target: RegistrarPagoModalTarget | null
  saldoAFavorActual?: number
  onClose: () => void
  onSubmit: (payload: RegistrarPagoPayload) => Promise<void>
}

export function RegistrarPagoModal({
  open,
  target,
  saldoAFavorActual = 0,
  onClose,
  onSubmit,
}: Props) {
  const [monto, setMonto] = useState('')
  const [fechaPago, setFechaPago] = useState(today)
  const [medioPago, setMedioPago] = useState<string>('Transferencia')
  const [referencia, setReferencia] = useState('')
  const [observacion, setObservacion] = useState('')
  const [confirmarCascada, setConfirmarCascada] = useState(false)
  const [destinos, setDestinos] = useState<DestinoAplicacionPago[]>([])
  const [requiereConfirmacion, setRequiereConfirmacion] = useState(false)
  const [previewSaldoFavor, setPreviewSaldoFavor] = useState(saldoAFavorActual)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitLockRef = useRef(false)

  const montoNum = useMemo(() => {
    const n = Number(monto)
    return Number.isFinite(n) ? Math.round(n) : 0
  }, [monto])

  const saldoCuota =
    target?.mode === 'cuota' ? Math.max(0, Number(target.cuota.saldo_cuota || 0)) : 0
  const superaSaldoCuota = target?.mode === 'cuota' && montoNum > saldoCuota

  useEffect(() => {
    if (!open || !target) return
    setMonto('')
    setFechaPago(today())
    setMedioPago('Transferencia')
    setReferencia('')
    setObservacion('')
    setConfirmarCascada(false)
    setDestinos([])
    setRequiereConfirmacion(false)
    setPreviewSaldoFavor(saldoAFavorActual)
    setError(null)
    submitLockRef.current = false
  }, [open, target, saldoAFavorActual])

  useEffect(() => {
    if (!open || !target || montoNum <= 0) {
      setDestinos([])
      setRequiereConfirmacion(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        setPreviewLoading(true)
        try {
          const preview = await previewAplicacionPago({
            facturaId: target.facturaId,
            cuotaId: target.mode === 'cuota' ? target.cuota.cuota_id : undefined,
            montoPagado: montoNum,
          })
          if (cancelled) return
          setDestinos(preview.destinos)
          setRequiereConfirmacion(preview.requiereConfirmacionCascada)
          setPreviewSaldoFavor(preview.saldoAFavorActual)
          if (!preview.requiereConfirmacionCascada) setConfirmarCascada(false)
        } catch (err) {
          if (cancelled) return
          setDestinos([])
          setRequiereConfirmacion(superaSaldoCuota)
          setError(err instanceof Error ? err.message : 'No se pudo previsualizar la aplicación.')
        } finally {
          if (!cancelled) setPreviewLoading(false)
        }
      })()
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, target, montoNum, superaSaldoCuota])

  if (!open || !target) return null

  const titulo =
    target.mode === 'cuota'
      ? `Registrar pago · Cuota ${target.cuota.numero_cuota}`
      : 'Registrar pago directo de deuda'

  const subtitle =
    target.mode === 'cuota'
      ? `Factura ${target.numFactura || target.facturaId} · Saldo cuota ${formatCurrency(saldoCuota)}`
      : `Factura ${target.numFactura || target.facturaId} · Saldo ${formatCurrency(target.saldoFactura)}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!target || montoNum <= 0) {
      setError('Ingresá un monto válido en PYG.')
      return
    }
    if (!fechaPago) {
      setError('La fecha de pago es obligatoria.')
      return
    }
    if (!referencia.trim()) {
      setError('El nro. de comprobante es obligatorio.')
      return
    }
    if (requiereConfirmacion && !confirmarCascada) {
      setError('Confirmá la aplicación del excedente según la vista previa.')
      return
    }
    if (submitLockRef.current) return

    submitLockRef.current = true
    setSubmitting(true)
    try {
      await onSubmit({
        facturaId: target.facturaId,
        cuotaId: target.mode === 'cuota' ? target.cuota.cuota_id : undefined,
        fechaPago,
        montoPagado: montoNum,
        medioPago: medioPago || undefined,
        referencia: referencia.trim(),
        observacion: observacion.trim() || undefined,
        confirmarCascada: requiereConfirmacion ? confirmarCascada : false,
      })
      onClose()
    } catch (err) {
      submitLockRef.current = false
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 dark:bg-black/60">
      <div
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">{titulo}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          {previewSaldoFavor > 0 && (
            <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Saldo a favor del aliado: {formatCurrency(previewSaldoFavor)}
            </p>
          )}
        </div>

        <form className="space-y-4 px-5 py-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              id="pago-modal-monto"
              inputMode="numeric"
              label="Monto (PYG) *"
              min="0"
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              type="number"
              value={monto}
            />
            <Input
              id="pago-modal-fecha"
              label="Fecha de pago *"
              onChange={(e) => setFechaPago(e.target.value)}
              type="date"
              value={fechaPago}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id="pago-modal-medio"
              label="Método de pago *"
              onChange={(e) => setMedioPago(e.target.value)}
              value={medioPago}
            >
              {MEDIOS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
            <Input
              id="pago-modal-comprobante"
              label="Nro. comprobante *"
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej: TRX-12345"
              value={referencia}
            />
          </div>

          <Input
            id="pago-modal-obs"
            label="Observación"
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Opcional"
            value={observacion}
          />

          {superaSaldoCuota && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              El monto supera el saldo de esta cuota. El excedente se aplicará a la siguiente
              cuota (misma factura) y, si corresponde, a facturas vencidas. Lo que reste quedará
              como saldo a favor.
            </div>
          )}

          {montoNum > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Vista previa de aplicación
                </p>
                {previewLoading && (
                  <span className="text-[11px] font-semibold text-slate-400">Calculando…</span>
                )}
              </div>
              {destinos.length === 0 && !previewLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Sin destinos para este monto.</p>
              ) : (
                <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  {destinos.map((d, i) =>
                    d.tipo === 'CUOTA' ? (
                      <li key={`${d.cuotaId}-${i}`} className="flex justify-between gap-2">
                        <span>
                          {d.esCascada ? '↳ ' : ''}
                          Cuota {d.nro}
                          {d.numFactura ? ` · Factura ${d.numFactura}` : ''}
                          {d.esCascada ? ' (cascada)' : ''}
                        </span>
                        <span className="font-bold tabular-nums">{formatCurrency(d.monto)}</span>
                      </li>
                    ) : d.tipo === 'DEUDA' ? (
                      <li key={`deuda-${d.deudaId}-${i}`} className="flex justify-between gap-2">
                        <span>
                          {d.esCascada ? '↳ ' : ''}
                          Deuda directa
                          {d.numFactura ? ` · Factura ${d.numFactura}` : ''}
                          {d.esCascada ? ' (cascada)' : ''}
                        </span>
                        <span className="font-bold tabular-nums">{formatCurrency(d.monto)}</span>
                      </li>
                    ) : (
                      <li
                        key={`favor-${i}`}
                        className="flex justify-between gap-2 text-emerald-700 dark:text-emerald-400"
                      >
                        <span>Saldo a favor</span>
                        <span className="font-bold tabular-nums">{formatCurrency(d.monto)}</span>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
          )}

          {requiereConfirmacion && (
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
              <input
                checked={confirmarCascada}
                className="mt-0.5 size-4"
                onChange={(e) => setConfirmarCascada(e.target.checked)}
                type="checkbox"
              />
              <span className="text-slate-700 dark:text-slate-300">
                Confirmo la aplicación del excedente según la vista previa.
              </span>
            </label>
          )}

          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button onClick={onClose} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={submitting} isLoading={submitting} type="submit" variant="primary">
              Registrar pago
              {montoNum > 0 ? ` — ${formatCurrency(montoNum)}` : ''}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
