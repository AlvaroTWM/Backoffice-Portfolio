import type { AliadosListQuery } from '../../types/allyDebt'
import {
  listarAliadosLocal,
  obtenerDetalleAliadoLocal,
  registrarPagoLocal,
  crearFacturaLocal,
  crearCompromisoLocal,
  agregarCuotaLocal,
  asignarNumFacturaLocal,
  importarDeudasMasivoLocal,
} from '../localAlliesMock'
import { getPortfolioDashboardStats } from './dashboardStats'
import { PORTFOLIO_REPORTS } from './reports'

const DEMO_APROBACIONES = [
  {
    aprobacion_id: 'APR-DEMO-1',
    accion: 'MODIFICAR_ALIADO',
    tabla: 'directorio_aliados',
    registro_id: 'A-002',
    observacion: 'Solicitud de cambio de rubro (demo).',
    estado: 'Pendiente' as const,
    fecha_solicitud: '2026-03-10T14:00:00.000Z',
    fecha_resolucion: null,
    solicitante_nombre: 'Ana Demo',
    solicitante_email: 'ana.demo@portfolio.local',
    solicitante_rol: 'alianzas',
    aprobador_nombre: null,
    datos_solicitud: { campo_modificar: 'rubro', valor_nuevo: 'Gastronomía' },
  },
  {
    aprobacion_id: 'APR-DEMO-2',
    accion: 'REFINANCIAR_DEUDA',
    tabla: 'facturacion',
    registro_id: 'F-1005',
    observacion: 'Refinanciación en 4 cuotas (demo).',
    estado: 'Pendiente' as const,
    fecha_solicitud: '2026-03-08T10:30:00.000Z',
    fecha_resolucion: null,
    solicitante_nombre: 'Carlos Demo',
    solicitante_email: 'carlos.demo@portfolio.local',
    solicitante_rol: 'operaciones',
    aprobador_nombre: null,
  },
]

const DEMO_USUARIOS = [
  { user_id: 'u1', nombre: 'Admin Demo', email: 'admin@portfolio.local', rol: 'admin' },
  { user_id: 'u2', nombre: 'Ana Demo', email: 'ana.demo@portfolio.local', rol: 'alianzas' },
  { user_id: 'u3', nombre: 'Gerencia Demo', email: 'gerencia@portfolio.local', rol: 'gerencia' },
  { user_id: 'u4', nombre: 'Carlos Demo', email: 'carlos.demo@portfolio.local', rol: 'operaciones' },
]

const DEMO_CLIENTES: Record<string, { campanas: string[]; informaciones: string[] }> = {
  '1234567': {
    campanas: ['Cashback Gastronomía', 'Reintegro Supermercados'],
    informaciones: ['Cliente activo desde 2023', 'Segmento: Frecuente'],
  },
  '7654321': {
    campanas: ['Cupones Retail'],
    informaciones: ['Cliente nuevo', 'Segmento: Ocasional'],
  },
}

const DAY_MS = 24 * 60 * 60 * 1000

function daysFromToday(isoDate: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${isoDate}T00:00:00`).getTime() - today.getTime()) / DAY_MS)
}

type AllyDetail = Awaited<ReturnType<typeof obtenerDetalleAliadoLocal>>

function isPendingCuota(estado: string) {
  const e = estado.toLowerCase()
  return e !== 'pagada' && e !== 'pagado' && e !== 'anulada'
}

/** Completa las facturas del mock con los contadores de cuotas que espera la UI nueva. */
function enrichFacturas(detail: AllyDetail) {
  return detail.facturas.map((f) => {
    const cuotas = detail.cuotas.filter((c) => c.factura_id === f.factura_id)
    const pagadas = cuotas.filter((c) => !isPendingCuota(c.estado_cuota)).length
    const parciales = cuotas.filter((c) => c.estado_cuota.toLowerCase() === 'parcial').length
    const ultima = cuotas.map((c) => c.fecha_vencimiento).sort().at(-1)
    return {
      ...f,
      deuda_id: f.deuda_id ?? f.factura_id,
      servicio: f.servicio || 'Marketing',
      cant_cuotas: cuotas.length,
      cuotas_total: cuotas.length,
      cuotas_pagadas: pagadas,
      cuotas_parciales: parciales,
      cuotas_pendientes: cuotas.length - pagadas,
      fecha_vencimiento_ultima: ultima,
    }
  })
}

async function getAllies() {
  const items = await listarAliadosLocal()
  return Promise.all(
    items.map(async (a) => {
      const detail = await obtenerDetalleAliadoLocal(a.aliado_id)
      const pendientes = detail.cuotas
        .filter((c) => isPendingCuota(c.estado_cuota))
        .map((c) => daysFromToday(c.fecha_vencimiento))
        .sort((x, y) => x - y)
      const proxima = pendientes[0]
      const vencida = proxima !== undefined && proxima < 0
      return {
        ...a,
        servicio: a.servicio || 'Marketing',
        estado_general: vencida && a.saldo_pendiente > 0 ? ('con_vencimiento' as const) : a.estado_general,
        dias_para_vencer: proxima !== undefined && proxima >= 0 ? proxima : null,
        dias_vencido: vencida ? -proxima : null,
      }
    }),
  )
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
}

function paginate<T>(items: T[], params: URLSearchParams) {
  const pageSize = Math.max(1, Number(params.get('pageSize') || 50))
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, Number(params.get('page') || 1)), totalPages)
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), page, pageSize, total, totalPages }
}

function matchPath(path: string, pattern: string): string | null {
  const re = new RegExp(`^${pattern.replace(/:[^/]+/g, '([^/]+)')}$`)
  const m = path.match(re)
  return m?.[1] ?? null
}

export async function handlePortfolioApi(path: string, init?: RequestInit): Promise<unknown> {
  const [pathname, search] = path.split('?')
  const method = (init?.method ?? 'GET').toUpperCase()
  const params = new URLSearchParams(search ?? '')

  if (pathname.startsWith('/api/dashboard/stats')) {
    return getPortfolioDashboardStats()
  }

  if (pathname === '/api/allies/filter-options') {
    return {
      bolsas: ['A', 'B'],
      rubros: ['Retail', 'Gastronomía'],
      servicios: ['Marketing', 'upys', 'Cupones'],
      ejecutivas: ['Sin asignar', 'Valeria', 'Constanza'],
    }
  }

  if (pathname === '/api/allies/export' || pathname === '/api/allies/export/detalle') {
    const items = await getAllies()
    return toCsv(items.map((a) => ({
      aliado: a.aliado_nombre,
      ruc: a.ruc,
      estado: a.estado_general,
      deuda_total: a.deuda_total,
      pagado: a.monto_total_pagado,
      saldo_pendiente: a.saldo_pendiente,
    })))
  }

  if (pathname === '/api/allies') {
    const query: AliadosListQuery = {
      page: Number(params.get('page') || 1),
      pageSize: Number(params.get('pageSize') || 50),
      name: params.get('name') ?? '',
      debtStatus: (params.get('debtStatus') as AliadosListQuery['debtStatus']) ?? 'all',
      allyStatus: (params.get('allyStatus') as AliadosListQuery['allyStatus']) ?? 'all',
      bolsa: params.get('bolsa') ?? 'all',
      rubro: params.get('rubro') ?? 'all',
      servicio: params.get('servicio') ?? 'all',
      ejecutiva: params.get('ejecutiva') ?? 'all',
      periodOrder: (params.get('periodOrder') as AliadosListQuery['periodOrder']) ?? 'recent',
    }
    const items = await getAllies()
    let filtered = [...items]
    const name = (query.name ?? '').trim().toLowerCase()
    if (name) filtered = filtered.filter((a) => a.aliado_nombre.toLowerCase().includes(name))
    if (query.debtStatus && query.debtStatus !== 'all') {
      filtered = query.debtStatus === 'con_saldo'
        ? filtered.filter((a) => a.saldo_pendiente > 0)
        : filtered.filter((a) => a.estado_general === query.debtStatus)
    }
    if (query.bolsa && query.bolsa !== 'all') filtered = filtered.filter((a) => a.bolsa === query.bolsa)
    if (query.rubro && query.rubro !== 'all') filtered = filtered.filter((a) => a.rubro === query.rubro)
    if (query.allyStatus && query.allyStatus !== 'all') {
      filtered = filtered.filter((a) => a.estado.toLowerCase() === query.allyStatus)
    }
    if (query.periodOrder === 'amount_desc') filtered.sort((a, b) => b.saldo_pendiente - a.saldo_pendiente)
    if (query.periodOrder === 'amount_asc') filtered.sort((a, b) => a.saldo_pendiente - b.saldo_pendiente)
    const totales = {
      deuda_total: filtered.reduce((s, a) => s + a.deuda_total, 0),
      saldo_pendiente: filtered.reduce((s, a) => s + a.saldo_pendiente, 0),
      monto_pagado: filtered.reduce((s, a) => s + a.monto_total_pagado, 0),
      vencido: filtered.filter((a) => a.dias_vencido).reduce((s, a) => s + a.saldo_pendiente, 0),
      aliados_en_mora: filtered.filter((a) => a.dias_vencido).length,
    }
    return { ...paginate(filtered, params), totales }
  }

  const facturasExportId = matchPath(pathname, '/api/allies/:id/facturas/export')
  if (facturasExportId && method === 'GET') {
    const detail = await obtenerDetalleAliadoLocal(decodeURIComponent(facturasExportId))
    return toCsv(enrichFacturas(detail).map((f) => ({
      factura: f.num_factura ?? f.factura_id,
      periodo: f.periodo,
      monto: f.monto_neto,
      saldo: f.saldo_factura,
      estado: f.estado_factura,
    })))
  }

  const cuotasMatch = pathname.match(/^\/api\/allies\/([^/]+)\/facturas\/([^/]+)\/cuotas$/)
  if (cuotasMatch && method === 'GET') {
    const detail = await obtenerDetalleAliadoLocal(decodeURIComponent(cuotasMatch[1]))
    const deudaId = decodeURIComponent(cuotasMatch[2])
    const items = detail.cuotas
      .filter((c) => (c.deuda_id ?? c.factura_id) === deudaId)
      .map((c) => ({
        ...c,
        deuda_id: c.deuda_id ?? c.factura_id,
        vigente: true,
        monto_pagado: c.monto_cuota - c.saldo_cuota,
      }))
    return {
      items,
      refinanciaciones_previas: 0,
      saldo_pendiente: items.reduce((s, c) => s + c.saldo_cuota, 0),
    }
  }

  const facturasAllyId = matchPath(pathname, '/api/allies/:id/facturas')
  if (facturasAllyId && method === 'GET') {
    const detail = await obtenerDetalleAliadoLocal(decodeURIComponent(facturasAllyId))
    const estado = params.get('estado') ?? 'pendientes'
    const search = (params.get('search') ?? '').trim().toLowerCase()
    const byEstado: Record<string, (e: string) => boolean> = {
      pendientes: (e) => e === 'pendiente' || e === 'parcial',
      parciales: (e) => e === 'parcial',
      pagadas: (e) => e === 'pagado' || e === 'pagada',
      anuladas: (e) => e === 'anulada',
      todas: () => true,
    }
    const keep = byEstado[estado] ?? byEstado.todas
    const items = enrichFacturas(detail)
      .filter((f) => keep(f.estado_factura.toLowerCase()))
      .filter((f) => !search || `${f.factura_id} ${f.num_factura ?? ''} ${f.periodo ?? ''}`.toLowerCase().includes(search))
    return { ...paginate(items, params), estado }
  }

  if (pathname === '/api/allies/pagos/preview' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}')) as { facturaId: string; cuotaId?: string; montoPagado: number }
    const monto = Number(body.montoPagado) || 0
    return {
      destinos: body.cuotaId
        ? [{ tipo: 'CUOTA', cuotaId: body.cuotaId, deudaId: body.facturaId, nro: 1, monto, esCascada: false }]
        : [{ tipo: 'DEUDA', deudaId: body.facturaId, monto, esCascada: false }],
      requiereConfirmacionCascada: false,
      saldoAFavorActual: 0,
    }
  }

  const anularCuota = matchPath(pathname, '/api/allies/cuotas/:id/anular-pago')
  if (anularCuota && method === 'POST') {
    return { cuota_id: decodeURIComponent(anularCuota), deuda_id: '', monto_revertido: 0 }
  }

  const allyId = matchPath(pathname, '/api/allies/:id')
  if (allyId && method === 'GET') {
    return obtenerDetalleAliadoLocal(allyId)
  }

  if (pathname === '/api/aprobaciones' && method === 'GET') {
    return { items: DEMO_APROBACIONES }
  }

  const aprobId = matchPath(pathname, '/api/aprobaciones/:id/resolver')
  if (aprobId && method === 'PATCH') {
    return { ok: true }
  }

  if (pathname === '/api/usuarios' && method === 'GET') {
    const now = new Date().toISOString()
    return { usuarios: DEMO_USUARIOS.map((u) => ({ ...u, created_at: now, updated_at: now })) }
  }

  if (pathname === '/api/usuarios/por-rol') {
    const rol = params.get('rol')
    return { usuarios: DEMO_USUARIOS.filter((u) => !rol || u.rol === rol) }
  }

  if (pathname === '/api/usuarios/por-email') {
    const email = (params.get('email') ?? '').toLowerCase()
    return { usuario: DEMO_USUARIOS.find((u) => u.email === email) ?? null }
  }

  if (pathname.startsWith('/api/usuarios') && method !== 'GET') {
    return { ok: true }
  }

  if (pathname === '/api/reports' && method === 'GET') {
    return { categories: PORTFOLIO_REPORTS }
  }

  if (pathname === '/api/clientes' && method === 'GET') {
    const documento = (params.get('documento') ?? '').replace(/\D/g, '')
    const found = DEMO_CLIENTES[documento]
    if (!found) {
      const err = new Error('Documento no encontrado en la base de demo. Probá con 1234567 o 7654321.') as Error & { status?: number }
      err.status = 404
      throw err
    }
    return { documento, ...found }
  }

  if (pathname.startsWith('/api/dev/')) {
    return { message: 'Operación simulada (demo).', aliado_creado: false, deuda_id: `DEMO-${Date.now()}` }
  }

  if (pathname === '/api/payments/register' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}'))
    return registrarPagoLocal(body)
  }

  if (pathname === '/api/allies/facturas' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}'))
    return crearFacturaLocal(body)
  }

  if (pathname.includes('/compromisos') && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}'))
    return crearCompromisoLocal(body)
  }

  if (pathname.includes('/cuotas') && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}'))
    return agregarCuotaLocal(body)
  }

  if (pathname.includes('/asignar-factura') && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}'))
    return asignarNumFacturaLocal(body)
  }

  if (pathname === '/api/allies/import-deudas' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}'))
    return importarDeudasMasivoLocal(body)
  }

  if (pathname === '/api/allies/pagos' && method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '{}'))
    return registrarPagoLocal(body)
  }

  if (pathname === '/api/aprobaciones' && method === 'POST') {
    return { auto_ejecutada: true, aprobacion_id: `APR-${Date.now()}` }
  }

  const numFactura = matchPath(pathname, '/api/allies/facturas/:deudaId/num-factura')
  if (numFactura && method === 'PATCH') {
    const body = JSON.parse(String(init?.body ?? '{}'))
    return asignarNumFacturaLocal({
      deudaId: decodeURIComponent(numFactura),
      numFactura: body.numFactura ?? body.num_factura ?? '',
      aplicarEnCuotas: body.aplicarEnCuotas,
    })
  }

  console.warn('[portfolio demo] unhandled API:', method, pathname)
  return {}
}
