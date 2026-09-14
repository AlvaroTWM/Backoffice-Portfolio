import { useState } from 'react'

import { SERVICIOS_TIPO, type CrearFacturaPayload } from '../../types/allyDebt'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

interface CreateAgreementFormProps {
  aliadoId: string
  aliadoNombre: string
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (payload: CrearFacturaPayload) => Promise<void>
  successMessage: string | null
}

const today = new Date().toISOString().slice(0, 10)

export function CreateAgreementForm({
  aliadoId,
  aliadoNombre,
  isSubmitting,
  onCancel,
  onSubmit,
  successMessage,
}: CreateAgreementFormProps) {
  const [periodo, setPeriodo] = useState('')
  const [fechaDeuda, setFechaDeuda] = useState(today)
  const [servicio, setServicio] = useState<CrearFacturaPayload['servicio'] | ''>('')
  const [montoNeto, setMontoNeto] = useState('')
  const [observacion, setObservacion] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const monto = Number(montoNeto) || 0

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-PY', {
      currency: 'PYG',
      maximumFractionDigits: 0,
      style: 'currency',
    }).format(n)

  const handleSubmit = async () => {
    setValidationError(null)

    if (!fechaDeuda) {
      setValidationError('La fecha de la factura es obligatoria.')
      return
    }
    if (!servicio) {
      setValidationError('El tipo de servicio es obligatorio.')
      return
    }
    if (!monto || monto <= 0) {
      setValidationError('El monto de la deuda debe ser mayor a 0.')
      return
    }

    await onSubmit({
      aliadoId,
      cuotas: [],
      fechaDeuda,
      montoNeto: monto,
      observacion: observacion || undefined,
      periodo:     periodo     || undefined,
      servicio,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          Identificación
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Input
            id="agPeriodo"
            label="Período"
            onChange={(e) => setPeriodo(e.target.value)}
            placeholder="Ej: Mayo 2026"
            value={periodo}
          />
          <Input
            id="agFechaDeuda"
            label="Fecha de factura *"
            onChange={(e) => setFechaDeuda(e.target.value)}
            type="date"
            value={fechaDeuda}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="agServicio">
              Tipo de servicio *
            </label>
            <Select
              id="agServicio"
              label="Tipo de servicio *"
              onChange={(e) => setServicio(e.target.value as CrearFacturaPayload['servicio'])}
              value={servicio}
            >
              <option value="">Seleccionar servicio</option>
              {SERVICIOS_TIPO.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          Monto de la deuda
        </p>
        <Input
          id="agMonto"
          inputMode="decimal"
          label="Monto neto *"
          min="0"
          onChange={(e) => setMontoNeto(e.target.value)}
          placeholder="Ej: 5000000"
          step="1"
          type="number"
          value={montoNeto}
        />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Se asignará vencimiento a <span className="font-semibold">30 días</span> desde la fecha de factura.
          El plan de pagos se define después con la acción <span className="font-semibold">Crear plan</span>.
        </p>
      </div>

      <Input
        id="agObs"
        label="Observación"
        onChange={(e) => setObservacion(e.target.value)}
        placeholder="Opcional"
        value={observacion}
      />

      {validationError ? (
        <p className="rounded-2xl border border-rose-200/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
          {validationError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {successMessage ? (
          <p className="text-sm font-semibold text-emerald-300">{successMessage}</p>
        ) : (
          <span className="text-sm text-slate-400">
            Total: <span className="font-black text-white">{formatCurrency(monto)}</span>
          </span>
        )}

        <div className="flex gap-3">
          <Button
            className="interactive-lift"
            onClick={onCancel}
            type="button"
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button
            className="interactive-lift min-w-[200px]"
            isLoading={isSubmitting}
            onClick={() => void handleSubmit()}
            type="button"
            variant="primary"
          >
            Confirmar — {aliadoNombre}
          </Button>
        </div>
      </div>
    </div>
  )
}
