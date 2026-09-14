import { useState } from 'react'
import type { Aprobacion } from '../../hooks/useAprobaciones'

export type { Aprobacion }

interface ResolucionState {
  aprobacion: Aprobacion
  tipo:       'Aprobado' | 'Rechazado'
  motivo:     string
}

interface AprobacionesViewProps {
  aprobaciones: Aprobacion[]
  isLoading?:   boolean
  error?:       string | null
  onResolver:   (aprobacion_id: string, estado: 'Aprobado' | 'Rechazado', motivo: string) => Promise<void>
  onRefresh:    () => void
  onBack:       () => void
}

const accionLabels: Record<string, string> = {
  CREAR_ALIADO:         'Crear aliado',
  MODIFICAR_ALIADO:     'Modificar aliado',
  BAJA_ALIADO:          'Baja de aliado',
  CREAR_COMPROMISO:     'Crear compromiso',
  MODIFICAR_COMPROMISO: 'Modificar compromiso',
  ANULAR_PAGO:          'Anular pago',
  ANULAR_DEUDA:         'Anular deuda',
  CREAR_PLAN:           'Plan de pagos',
  REFINANCIAR_DEUDA:    'Refinanciación',
}

const tablaLabels: Record<string, string> = {
  directorio_aliados: 'Aliados',
  compromisos:        'Compromisos',
  pagos:              'Pagos',
  facturacion:        'Facturación',
}

const rolLabels: Record<string, string> = {
  admin:       'Admin',
  gerencia:    'Gerencia',
  alianzas:    'Alianzas',
  operaciones: 'Operaciones',
}

const accionColors: Record<string, { dot: string; badge: string }> = {
  BAJA_ALIADO:  { dot: 'bg-rose-400',   badge: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
  ANULAR_DEUDA: { dot: 'bg-rose-400',   badge: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
  ANULAR_PAGO:  { dot: 'bg-rose-400',   badge: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
  MODIFICAR_ALIADO:     { dot: 'bg-sky-400',   badge: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' },
  CREAR_COMPROMISO:     { dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  MODIFICAR_COMPROMISO: { dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  CREAR_ALIADO: { dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  CREAR_PLAN: { dot: 'bg-violet-400', badge: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  REFINANCIAR_DEUDA: { dot: 'bg-violet-400', badge: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
}

function formatCurrency(value: unknown) {
  const n = Number(value)
  if (!n || isNaN(n)) return null
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(n)
}

// ─── Render de datos de la solicitud ─────────────────────────────────────────

const CAMPO_MODIFICAR_LABELS: Record<string, string> = {
  nombre:         'Nombre del aliado',
  ruc:            'RUC',
  estado:         'Estado del aliado',
  codigo_persona: 'Código de persona',
  otro:           'Otro',
}

function DetallesSolicitud({ datos, accion }: { datos?: Record<string, unknown>; accion: string }) {
  if (!datos) return null

  const rows: { label: string; value: string }[] = []

  if (datos.aliado_nombre) rows.push({ label: 'Aliado', value: String(datos.aliado_nombre) })
  if (datos.ruc)           rows.push({ label: 'RUC',    value: String(datos.ruc) })

  if (accion === 'MODIFICAR_ALIADO' || accion === 'BAJA_ALIADO') {
    if (datos.estado_actual) rows.push({ label: 'Estado actual', value: String(datos.estado_actual) })
  }

  if (accion === 'MODIFICAR_ALIADO') {
    if (datos.campo_modificar) {
      const campo = String(datos.campo_modificar)
      rows.push({
        label: 'Campo a modificar',
        value: CAMPO_MODIFICAR_LABELS[campo] ?? campo,
      })
    }
    if (datos.valor_anterior !== undefined && String(datos.valor_anterior) !== '') {
      rows.push({ label: 'Valor actual', value: String(datos.valor_anterior) })
    }
    if (datos.valor_nuevo !== undefined && String(datos.valor_nuevo) !== '') {
      rows.push({ label: 'Nuevo valor', value: String(datos.valor_nuevo) })
    } else if (datos.campo_modificar === 'otro') {
      rows.push({ label: 'Nuevo valor', value: 'Ver observación (gestión manual)' })
    }
  }

  if (accion === 'ANULAR_DEUDA') {
    if (datos.factura_id)   rows.push({ label: 'Factura',     value: String(datos.factura_id) })
    if (datos.periodo)      rows.push({ label: 'Período',     value: String(datos.periodo) })
    if (datos.tipo_factura) rows.push({ label: 'Tipo',        value: String(datos.tipo_factura) })
    if (datos.monto_neto)   rows.push({ label: 'Monto total', value: formatCurrency(datos.monto_neto) ?? '' })
    if (datos.saldo_factura !== undefined) rows.push({ label: 'Saldo pendiente', value: formatCurrency(datos.saldo_factura) ?? '' })
    if (datos.estado_actual) rows.push({ label: 'Estado', value: String(datos.estado_actual) })
  }

  if (accion === 'ANULAR_PAGO') {
    if (datos.factura_id)   rows.push({ label: 'Factura',      value: String(datos.factura_id) })
    if (datos.numero_cuota) rows.push({ label: 'Cuota N°',     value: String(datos.numero_cuota) })
    if (datos.monto_neto)   rows.push({ label: 'Monto cuota',  value: formatCurrency(datos.monto_neto) ?? '' })
  }

  if (accion === 'CREAR_COMPROMISO' || accion === 'MODIFICAR_COMPROMISO') {
    if (datos.cuota_id)         rows.push({ label: 'Cuota',             value: String(datos.cuota_id) })
    if (datos.fecha_compromiso) rows.push({ label: 'Fecha compromiso',  value: String(datos.fecha_compromiso) })
    if (datos.monto_compromiso) rows.push({ label: 'Monto compromiso',  value: formatCurrency(datos.monto_compromiso) ?? '' })
  }

  if (accion === 'CREAR_PLAN') {
    if (datos.factura_id)      rows.push({ label: 'Factura',          value: String(datos.factura_id) })
    if (datos.saldo_pendiente) rows.push({ label: 'Saldo pendiente',  value: formatCurrency(datos.saldo_pendiente) ?? '' })
    if (Array.isArray(datos.cuotas)) rows.push({ label: 'Cuotas',     value: String(datos.cuotas.length) })
  }

  if (accion === 'REFINANCIAR_DEUDA') {
    if (datos.factura_id)      rows.push({ label: 'Factura',          value: String(datos.factura_id) })
    if (datos.monto_refinanciar) rows.push({ label: 'Monto a refinanciar', value: formatCurrency(datos.monto_refinanciar) ?? '' })
    if (Array.isArray(datos.cuota_ids)) rows.push({ label: 'Cuotas seleccionadas', value: String(datos.cuota_ids.length) })
    if (Array.isArray(datos.cuotas)) rows.push({ label: 'Nuevo plan', value: `${String(datos.cuotas.length)} cuota(s)` })
    if (datos.refinanciaciones_previas !== undefined) {
      rows.push({ label: 'Refinanciaciones previas', value: `${String(datos.refinanciaciones_previas)} de 2` })
    }
    if (datos.motivo) rows.push({ label: 'Motivo', value: String(datos.motivo) })
  }

  if (rows.length === 0) return null

  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:grid-cols-3 dark:border-slate-700/60 dark:bg-slate-800/50">
      {rows.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
          <dd className="mt-0.5 truncate text-xs font-medium text-slate-700 dark:text-slate-200">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function EstadoDot({ estado }: { estado: string }) {
  if (estado === 'Aprobado') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        Aprobado
      </span>
    )
  }
  if (estado === 'Rechazado') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="size-1.5 rounded-full bg-red-400" />
        Rechazado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
      Pendiente
    </span>
  )
}

export function AprobacionesView({
  aprobaciones,
  isLoading = false,
  error = null,
  onResolver,
  onRefresh,
  onBack,
}: AprobacionesViewProps) {
  const [resolucion, setResolucion] = useState<ResolucionState | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const pendientes = aprobaciones.filter((a) => a.estado === 'Pendiente')
  const resueltas  = aprobaciones.filter((a) => a.estado !== 'Pendiente')

  function handleClickAccion(aprobacion: Aprobacion, tipo: 'Aprobado' | 'Rechazado') {
    setSubmitError(null)
    setResolucion({ aprobacion, tipo, motivo: '' })
  }

  async function handleConfirmar() {
    if (!resolucion) return
    if (!resolucion.motivo.trim()) {
      setSubmitError('Ingresá el motivo de la decisión.')
      return
    }
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await onResolver(resolucion.aprobacion.aprobacion_id, resolucion.tipo, resolucion.motivo.trim())
      setResolucion(null)
    } catch {
      setSubmitError('Ocurrió un error al procesar la resolución.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="animate-fade-up animate-delay-2 space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Panel
          </button>
          <span className="text-slate-200 dark:text-slate-700">/</span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Gestión
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-800 dark:text-white">
              Aprobaciones
              {pendientes.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}
                </span>
              )}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          Actualizar
        </button>
      </div>

      {error ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">{error}</p>
      ) : null}

      {isLoading ? (
        <p className="py-10 text-center text-xs text-slate-400 dark:text-slate-500">
          Cargando...
        </p>
      ) : (
        <div className="space-y-8">

          {/* Pendientes */}
          <div className="space-y-3">
            {pendientes.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                Sin solicitudes pendientes.
              </p>
            ) : pendientes.map((item) => {
              const colors = accionColors[item.accion] ?? { dot: 'bg-amber-400', badge: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' }
              return (
                <div
                  key={item.aprobacion_id}
                  className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/60"
                >
                  {/* Top row: accion + tabla + dot */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`size-2 shrink-0 animate-pulse rounded-full ${colors.dot}`} />
                    <span className="text-sm font-bold text-slate-800 dark:text-white">
                      {accionLabels[item.accion] ?? item.accion}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors.badge}`}>
                      {tablaLabels[item.tabla] ?? item.tabla}
                    </span>
                    {item.solicitante_rol && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                        {rolLabels[item.solicitante_rol] ?? item.solicitante_rol}
                      </span>
                    )}
                  </div>

                  {/* Detalles ricos */}
                  <DetallesSolicitud datos={item.datos_solicitud} accion={item.accion} />

                  {/* Observación del solicitante */}
                  {item.observacion && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-700/40 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Motivo: </span>
                      {item.observacion}
                    </p>
                  )}

                  {/* Footer: solicitante + acciones */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      <span className="font-medium text-slate-600 dark:text-slate-300">{item.solicitante_nombre}</span>
                      {' · '}
                      {new Date(item.fecha_solicitud).toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleClickAccion(item, 'Aprobado')}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClickAccion(item, 'Rechazado')}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Historial */}
          {resueltas.length > 0 && (
            <div className="space-y-1">
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-600">
                Historial
              </p>
              {resueltas.map((item) => (
                <div
                  key={item.aprobacion_id}
                  className="flex items-start gap-3 rounded-xl px-4 py-3 opacity-60"
                >
                  <span className={`mt-1 size-1.5 shrink-0 rounded-full ${item.estado === 'Aprobado' ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {accionLabels[item.accion] ?? item.accion}
                      </span>
                      {Boolean(item.datos_solicitud?.aliado_nombre) && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {String(item.datos_solicitud?.aliado_nombre)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-600">
                      {item.solicitante_nombre} · {new Date(item.fecha_solicitud).toLocaleDateString('es-PY')}
                    </p>
                  </div>
                  <EstadoDot estado={item.estado} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal resolución */}
      {resolucion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">

            <p className={`text-[11px] font-black uppercase tracking-widest ${resolucion.tipo === 'Aprobado' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {resolucion.tipo === 'Aprobado' ? 'Aprobar solicitud' : 'Rechazar solicitud'}
            </p>
            <h3 className="mt-1 text-base font-bold text-slate-800 dark:text-white">
              {accionLabels[resolucion.aprobacion.accion] ?? resolucion.aprobacion.accion}
            </h3>

            {/* Resumen de lo que se está aprobando */}
            <DetallesSolicitud
              datos={resolucion.aprobacion.datos_solicitud}
              accion={resolucion.aprobacion.accion}
            />

            {resolucion.aprobacion.observacion && (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <span className="font-semibold">Motivo solicitante: </span>
                {resolucion.aprobacion.observacion}
              </p>
            )}

            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              Ingresá el motivo de tu decisión. Quedará registrado en auditoría.
            </p>

            <textarea
              autoFocus
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-slate-300 focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-600"
              onChange={(e) => setResolucion({ ...resolucion, motivo: e.target.value })}
              placeholder="Escribe el motivo..."
              rows={3}
              value={resolucion.motivo}
            />

            {submitError ? (
              <p className="mt-2 text-xs text-rose-500">{submitError}</p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setResolucion(null); setSubmitError(null) }}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmar()}
                disabled={isSubmitting}
                className={`rounded-xl px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50 ${resolucion.tipo === 'Aprobado' ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600' : 'bg-slate-500 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500'}`}
              >
                {isSubmitting ? 'Procesando...' : resolucion.tipo === 'Aprobado' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
