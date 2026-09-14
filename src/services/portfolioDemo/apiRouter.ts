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

let alliesCache: Awaited<ReturnType<typeof listarAliadosLocal>> | null = null

async function getAllies() {
  if (!alliesCache) alliesCache = await listarAliadosLocal()
  return alliesCache
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
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.max(1, query.pageSize ?? 50)
    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    return {
      items: filtered.slice(start, start + pageSize),
      page: safePage,
      pageSize,
      total,
      totalPages,
    }
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
    return {
      usuarios: [
        { user_id: 'u1', nombre: 'Admin Demo', email: 'admin@portfolio.local', rol: 'admin', created_at: now, updated_at: now },
        { user_id: 'u2', nombre: 'Ana Demo', email: 'ana.demo@portfolio.local', rol: 'alianzas', created_at: now, updated_at: now },
      ],
    }
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
