import type {
  AgregarCuotaPayload,
  AsignarNumFacturaPayload,
  ActualizarServicioPayload,
  ActualizarCuotaPayload,
  AliadoDetalle,
  AliadosListQuery,
  AliadoResumen,
  CrearPlanPagosPayload,
  FacturaCuotasResponse,
  RefinanciarDeudaPayload,
  CrearCompromisoPayload,
  CrearFacturaPayload,
  ImportarDeudasPayload,
  ImportarDeudasResult,
  FacturasListQuery,
  PaginatedFacturasResponse,
  PaginatedAliadosResponse,
  PreviewAplicacionPagoResponse,
  RegistrarPagoPayload,
  ReportePendienteRow,
  SolicitarAprobacionPayload,
} from '../types/allyDebt'
import type { AuthUser } from '../types/auth'
import { isPortfolioDemo } from '../config/portfolio'
import { getStoredJwt, getStoredSession } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (isPortfolioDemo) {
    const { handlePortfolioApi } = await import('./portfolioDemo/apiRouter')
    await new Promise((resolve) => window.setTimeout(resolve, 100))
    return (await handlePortfolioApi(path, init)) as T
  }

  const jwt = getStoredJwt()
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as {
      message?: string
      detail?: string
      code?: string
      destinos?: unknown
    }
    console.error('[apiFetch] Server error:', JSON.stringify(body))
    const detail = body.detail ? ` | ${body.detail}` : ''
    const err = new Error((body.message ?? `Error ${response.status}: ${path}`) + detail) as Error & {
      status?: number
      code?: string
      destinos?: unknown
    }
    err.status = response.status
    err.code = body.code
    err.destinos = body.destinos
    throw err
  }

  return response.json() as Promise<T>
}

// ─── Session ──────────────────────────────────────────────────────────────────

export async function getSessionContext(): Promise<AuthUser> {
  const stored = getStoredSession()
  if (stored) return stored
  throw new Error('No hay sesión activa.')
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  // Resumen
  aliadosActivos:          number
  aliadosConDeuda:         number
  deudaTotalPendiente:     number
  totalCobrado:            number
  aprobacionesPendientes:  number
  deudasSinFactura:        number
  filtros: {
    period: '12m' | '6m' | 'ytd'
    servicio: string
  }
  serviciosDisponibles: string[]
  // Riesgo
  deudaVencida:            number
  tasaMorosidad:           number
  concentracionTop10:      number
  porcentajeResto:         number
  dso:                     number
  // Proyección (solo cuotas con fecha_vencimiento a futuro, ventanas acumuladas)
  proyeccion: { d30: number; d60: number; d90: number; d120: number }
  historicoRecobro: {
    mes: string
    pagado: number
    vencido: number
    vigente: number
  }[]
  // Gráficos
  evolucion:    { mes: string; total: number }[]
  compromisosHistorico: {
    mes: string
    pagadoATiempo: number
    vencido: number
    pendiente: number
  }[]
  aging:        { alDia: number; d1_30: number; d31_60: number; d61_90: number; mas90: number }
  mixServicio:  { servicio: string; monto: number }[]
  pareto:       { cod_aliado: string; aliado: string; deuda: number; acumulado: number }[]
  compromisosIncumplidos: {
    cod_aliado: string
    aliado_nombre: string
    monto_incumplido: number
    cantidad_compromisos: number
  }[]
  deudaPorEjecutiva: {
    ejecutiva_nombre: string
    deuda: number
  }[]
  // Tablas
  cuentasCriticas: {
    cod_aliado:        string
    aliado_nombre:     string
    deuda_vencida:     number
    dias_max:          number
    ultima_fecha_pago: string | null
  }[]
  proximosVencimientos: {
    cuota_id:          string
    cod_aliado:        string
    aliado_nombre:     string
    monto:             number
    fecha_vencimiento: string
    dias_restantes:    number
  }[]
}

export interface DashboardFilters {
  period?: '12m' | '6m' | 'ytd'
  servicio?: string
}

export async function fetchDashboardStats(filters: DashboardFilters = {}): Promise<DashboardStats> {
  const params = new URLSearchParams()
  if (filters.period)   params.set('period', filters.period)
  if (filters.servicio) params.set('servicio', filters.servicio)
  const qs = params.toString()
  return apiFetch<DashboardStats>(`/api/dashboard/stats${qs ? `?${qs}` : ''}`)
}

// ─── Allies ───────────────────────────────────────────────────────────────────

export async function listarAliadosBackend(): Promise<AliadoResumen[]> {
  const data = await apiFetch<PaginatedAliadosResponse>('/api/allies?pageSize=500')
  return data.items
}

export async function listarAliadosPaginadoBackend(
  query: AliadosListQuery,
): Promise<PaginatedAliadosResponse> {
  const params = new URLSearchParams()
  if (query.page)        params.set('page',        String(query.page))
  if (query.pageSize)    params.set('pageSize',     String(query.pageSize))
  if (query.name)        params.set('name',         query.name)
  if (query.debtStatus)  params.set('debtStatus',   query.debtStatus)
  if (query.allyStatus)  params.set('allyStatus',   query.allyStatus)
  if (query.bolsa && query.bolsa !== 'all') params.set('bolsa', query.bolsa)
  if (query.rubro && query.rubro !== 'all') params.set('rubro', query.rubro)
  if (query.servicio && query.servicio !== 'all') params.set('servicio', query.servicio)
  if (query.ejecutiva && query.ejecutiva !== 'all') params.set('ejecutiva', query.ejecutiva)
  if (query.periodOrder) params.set('periodOrder',  query.periodOrder)

  return apiFetch<PaginatedAliadosResponse>(`/api/allies?${params.toString()}`)
}

export async function exportarAliadosBackend(
  query: Omit<AliadosListQuery, 'page' | 'pageSize'>,
): Promise<void> {
  const params = new URLSearchParams()
  if (query.name)        params.set('name',         query.name)
  if (query.debtStatus)  params.set('debtStatus',   query.debtStatus)
  if (query.allyStatus)  params.set('allyStatus',   query.allyStatus)
  if (query.bolsa && query.bolsa !== 'all') params.set('bolsa', query.bolsa)
  if (query.rubro && query.rubro !== 'all') params.set('rubro', query.rubro)
  if (query.servicio && query.servicio !== 'all') params.set('servicio', query.servicio)
  if (query.ejecutiva && query.ejecutiva !== 'all') params.set('ejecutiva', query.ejecutiva)
  if (query.periodOrder) params.set('periodOrder',  query.periodOrder)

  const jwt = getStoredJwt()
  const response = await fetch(
    `${API_BASE}/api/allies/export?${params.toString()}`,
    {
      headers: {
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(body.message ?? `Error ${response.status} al exportar aliados.`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  anchor.href = url
  anchor.download = `aliados-deuda-${stamp}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function exportarAliadosDeudaDetalleBackend(
  query: Omit<AliadosListQuery, 'page' | 'pageSize'>,
): Promise<void> {
  const params = new URLSearchParams()
  if (query.name)        params.set('name',         query.name)
  if (query.debtStatus)  params.set('debtStatus',   query.debtStatus)
  if (query.allyStatus)  params.set('allyStatus',   query.allyStatus)
  if (query.bolsa && query.bolsa !== 'all') params.set('bolsa', query.bolsa)
  if (query.rubro && query.rubro !== 'all') params.set('rubro', query.rubro)
  if (query.servicio && query.servicio !== 'all') params.set('servicio', query.servicio)
  if (query.ejecutiva && query.ejecutiva !== 'all') params.set('ejecutiva', query.ejecutiva)
  if (query.periodOrder) params.set('periodOrder',  query.periodOrder)

  const jwt = getStoredJwt()
  const response = await fetch(
    `${API_BASE}/api/allies/export/detalle?${params.toString()}`,
    {
      headers: {
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(body.message ?? `Error ${response.status} al exportar desglose de deudas.`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  anchor.href = url
  anchor.download = `deudas-pendientes-${stamp}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function obtenerFiltrosAliadosBackend(): Promise<{ bolsas: string[]; rubros: string[]; servicios: string[]; ejecutivas: string[] }> {
  return apiFetch<{ bolsas: string[]; rubros: string[]; servicios: string[]; ejecutivas: string[] }>('/api/allies/filter-options')
}

export async function obtenerDetalleAliadoBackend(
  aliadoId: string | number,
): Promise<AliadoDetalle> {
  return apiFetch<AliadoDetalle>(`/api/allies/${aliadoId}`)
}

export async function listarFacturasAliadoBackend(
  aliadoId: string | number,
  query: FacturasListQuery,
): Promise<PaginatedFacturasResponse> {
  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('pageSize', String(query.pageSize))
  if (query.estado) params.set('estado', query.estado)
  if (query.search) params.set('search', query.search)
  return apiFetch<PaginatedFacturasResponse>(`/api/allies/${aliadoId}/facturas?${params.toString()}`)
}

export async function obtenerCuotasFacturaBackend(
  aliadoId: string | number,
  deudaId: string,
): Promise<FacturaCuotasResponse> {
  return apiFetch<FacturaCuotasResponse>(
    `/api/allies/${aliadoId}/facturas/${encodeURIComponent(deudaId)}/cuotas`,
  )
}

export async function exportarFacturasAliadoBackend(
  aliadoId: string | number,
  query: Pick<FacturasListQuery, 'estado' | 'search'>,
): Promise<void> {
  const params = new URLSearchParams()
  if (query.estado) params.set('estado', query.estado)
  if (query.search) params.set('search', query.search)

  const jwt = getStoredJwt()
  const response = await fetch(
    `${API_BASE}/api/allies/${aliadoId}/facturas/export?${params.toString()}`,
    {
      headers: {
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(body.message ?? `Error ${response.status} al exportar facturas.`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `facturas-${aliadoId}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

// ─── Facturas ─────────────────────────────────────────────────────────────────

export async function crearFacturaBackend(payload: CrearFacturaPayload) {
  return apiFetch<{ factura: unknown; cuotas: unknown[] }>('/api/allies/facturas', {
    body:   JSON.stringify(payload),
    method: 'POST',
  })
}

// ─── Pagos ────────────────────────────────────────────────────────────────────

export async function previewAplicacionPagoBackend(payload: {
  facturaId: string
  cuotaId?: string
  montoPagado: number
}): Promise<PreviewAplicacionPagoResponse> {
  return apiFetch<PreviewAplicacionPagoResponse>('/api/allies/pagos/preview', {
    body:   JSON.stringify(payload),
    method: 'POST',
  })
}

export async function registrarPagoBackend(payload: RegistrarPagoPayload) {
  return apiFetch<{ factura: unknown; pago: unknown; aplicaciones?: unknown; saldo_a_favor?: number }>(
    '/api/allies/pagos',
    {
      body:   JSON.stringify(payload),
      method: 'POST',
    },
  )
}

// ─── Compromisos ──────────────────────────────────────────────────────────────

export async function crearCompromisoBackend(_payload: CrearCompromisoPayload) {
  // Endpoint not yet implemented on the server — no-op until added.
  return { compromiso: null }
}

// ─── Cuotas ───────────────────────────────────────────────────────────────────

export async function agregarCuotaBackend(_payload: AgregarCuotaPayload) {
  return { cuota: null }
}

export async function crearPlanPagosBackend(payload: CrearPlanPagosPayload) {
  return solicitarAprobacionBackend({
    tabla: 'facturacion',
    registro_id: payload.deudaId,
    accion: 'CREAR_PLAN',
    datos_solicitud: {
      deuda_id: payload.deudaId,
      cuotas: payload.cuotas,
      motivo: payload.motivoCambio,
      ...(payload.numFactura ? { num_factura: payload.numFactura } : {}),
    },
    observacion: payload.motivoCambio,
  })
}

export async function refinanciarDeudaBackend(payload: RefinanciarDeudaPayload) {
  return solicitarAprobacionBackend({
    tabla: 'facturacion',
    registro_id: payload.deudaId,
    accion: 'REFINANCIAR_DEUDA',
    datos_solicitud: {
      deuda_id: payload.deudaId,
      cuota_ids: payload.cuotaIds,
      cuotas: payload.cuotas,
      motivo: payload.motivoCambio,
      ...(payload.numFactura ? { num_factura: payload.numFactura } : {}),
    },
    observacion: payload.motivoCambio,
  })
}

export async function actualizarCuotaBackend(_payload: ActualizarCuotaPayload) {
  return { ok: true }
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export async function actualizarServicioDeudaBackend(_payload: ActualizarServicioPayload) {
  return { ok: true }
}

export async function generarReporteBackend(): Promise<ReportePendienteRow[]> {
  return []
}

export async function importarDeudasMasivoBackend(
  _payload: ImportarDeudasPayload,
): Promise<ImportarDeudasResult> {
  return { inserted: 0, total: 0 }
}

export async function asignarNumFacturaBackend(payload: AsignarNumFacturaPayload) {
  const deudaId = encodeURIComponent(String(payload.deudaId || '').trim())
  return apiFetch<{ ok: boolean; factura: { factura_id: string; aliado_id: string; num_factura: string | null } }>(
    `/api/allies/facturas/${deudaId}/num-factura`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        numFactura: payload.numFactura,
        aplicarEnCuotas: payload.aplicarEnCuotas ?? true,
      }),
    },
  )
}

export async function anularPagoCuotaBackend(cuotaId: string) {
  const id = encodeURIComponent(cuotaId.trim())
  return apiFetch<{ cuota_id: string; deuda_id: string; monto_revertido: number }>(
    `/api/allies/cuotas/${id}/anular-pago`,
    { method: 'POST' },
  )
}

// ─── Aprobaciones ─────────────────────────────────────────────────────────────

export async function solicitarAprobacionBackend(
  payload: SolicitarAprobacionPayload,
): Promise<{ aprobacion_id: string; estado?: string; auto_ejecutada?: boolean }> {
  return apiFetch<{ aprobacion_id: string; estado?: string; auto_ejecutada?: boolean }>('/api/aprobaciones', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
