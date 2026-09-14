import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { contarRefinanciacionesAprobadas } from './planPagosService.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function formatPeriodo(mes?: number | null, anio?: number | null): string | undefined {
  if (!mes || !anio) return undefined
  return `${MONTHS[(mes - 1) % 12]} ${anio}`
}

function n(value: bigint | null | undefined): number {
  if (value == null) return 0
  return Number(value)
}

/** ID interno de deuda — número secuencial único (sin cod_aliado). */
let deudaSeqReady = false

async function ensureDeudaIdSequence(): Promise<void> {
  if (deudaSeqReady) return

  await prisma.$executeRaw`
    CREATE SEQUENCE IF NOT EXISTS facturacion_deuda_num_seq
    START WITH 100001 INCREMENT BY 1
  `

  // Alinear la secuencia con el máximo numérico ya existente
  await prisma.$executeRaw`
    SELECT setval(
      'facturacion_deuda_num_seq',
      GREATEST(
        100000,
        COALESCE(
          (SELECT MAX(deuda_id::bigint) FROM facturacion WHERE deuda_id ~ '^[0-9]+$'),
          100000
        )
      )
    )
  `

  deudaSeqReady = true
}

export async function generateDeudaId(): Promise<string> {
  await ensureDeudaIdSequence()
  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('facturacion_deuda_num_seq') AS nextval
  `
  return String(rows[0].nextval)
}

export type EstadoGeneralDeuda = 'sin_deuda' | 'pendiente' | 'parcial' | 'pagado' | 'con_vencimiento'
export type AliadosDebtStatusFilter = 'all' | 'con_saldo' | EstadoGeneralDeuda

function startOfTodayUtc(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function isCuotaActivaVencida(c: {
  saldo_cuota: bigint | null
  fecha_vencimiento: Date | null
  estado_cuota: string
}): boolean {
  if (n(c.saldo_cuota) <= 0) return false
  const estado = c.estado_cuota.trim().toLowerCase()
  if (estado === 'pagada' || estado === 'refinanciada') return false
  if (!c.fecha_vencimiento) return false
  return c.fecha_vencimiento.getTime() < startOfTodayUtc().getTime()
}

function computeEstadoGeneral(
  saldoPendiente: number,
  deudaTotal: number,
  tieneCuotaVencida: boolean,
): EstadoGeneralDeuda {
  if (deudaTotal <= 0)             return 'sin_deuda'
  if (saldoPendiente <= 0)         return 'pagado'
  if (tieneCuotaVencida)           return 'con_vencimiento'
  if (saldoPendiente < deudaTotal) return 'parcial'
  return 'pendiente'
}

function isDeudaCerrada(estado: string) {
  const e = estado.trim().toLowerCase()
  return e === 'pagada' || e === 'pagado' || e === 'anulada' || e === 'anulado'
}

/** Suma días en UTC para fechas @db.Date consistentes. */
export function addDaysUtc(base: Date, days: number): Date {
  const result = new Date(base)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function parseFechaDeudaInput(fechaDeuda?: string): Date {
  if (fechaDeuda) return new Date(`${fechaDeuda}T12:00:00.000Z`)
  const today = new Date()
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
}

/** Sin plan de pagos: la cuota inicial se crea al asignar N° de factura (+30 días). */
function resolveCuotasIniciales(
  input: Pick<CrearFacturaInput, 'cuotas'>,
): Array<{ numero_cuota: number; monto_cuota: number; fecha_vencimiento: string }> {
  if (input.cuotas && input.cuotas.length > 0) return input.cuotas
  return []
}

const MOTIVO_VENCIMIENTO_INICIAL = 'Vencimiento inicial a 30 días desde asignación de factura'

/** Crea o actualiza la cuota placeholder al asignar num_factura (vencimiento = fechaBase + 30 días). */
export async function ensureCuotaVencimientoOnFacturaAssign(
  deudaId: string,
  fechaBase: Date = new Date(),
) {
  const factura = await prisma.facturacion.findUnique({ where: { deuda_id: deudaId } })
  if (!factura || factura.saldo_pendiente <= 0n) return

  const cuotasActivas = await prisma.cuota.findMany({
    where: {
      deuda_id: deudaId,
      saldo_cuota: { gt: 0 },
      estado_cuota: { notIn: ['Pagada', 'Refinanciada'] },
    },
    orderBy: { nro_cuota: 'asc' },
  })

  if (cuotasActivas.length > 1) return

  const vencimiento = addDaysUtc(fechaBase, 30)
  const monto = factura.saldo_pendiente

  if (cuotasActivas.length === 1) {
    const motivo = cuotasActivas[0].motivo_cambio || ''
    const esPlaceholder = motivo.includes('Vencimiento inicial')
    if (!esPlaceholder && factura.estado_deuda === 'Financiada') return
    if (!esPlaceholder) return

    await prisma.cuota.update({
      where: { cuota_id: cuotasActivas[0].cuota_id },
      data:  {
        fecha_vencimiento: vencimiento,
        monto_cuota:       monto,
        saldo_cuota:       monto,
        motivo_cambio:     MOTIVO_VENCIMIENTO_INICIAL,
      },
    })
    return
  }

  await prisma.cuota.create({
    data: {
      cuota_id:          `C-${randomUUID().slice(0, 8)}-1`,
      deuda_id:          deudaId,
      nro_cuota:         1,
      monto_cuota:       monto,
      saldo_cuota:       monto,
      estado_cuota:      'Pendiente',
      fecha_vencimiento: vencimiento,
      motivo_cambio:     MOTIVO_VENCIMIENTO_INICIAL,
    },
  })
}

/** @deprecated Usar ensureCuotaVencimientoOnFacturaAssign al asignar num_factura. */
export async function ensureCuotaVencimientoInicial(
  deudaId: string,
  monto: bigint,
  fechaBase?: Date,
) {
  void monto
  await ensureCuotaVencimientoOnFacturaAssign(deudaId, fechaBase)
}

function isDeudaConSaldoPendiente(estado: string, saldo: number) {
  if (estado.trim().toLowerCase().includes('anulad')) return false
  return saldo > 0
}

function parsePeriodString(period?: string): number {
  if (!period) return 0
  const lower = period.toLowerCase()
  const years = [...lower.matchAll(/(20\d{2})/g)]
  const year  = years.length > 0 ? Number(years[years.length - 1][1]) : 0
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','setiembre','octubre','noviembre','diciembre']
  let month = 0
  months.forEach((m, i) => { if (lower.includes(m)) month = Math.max(month, m === 'setiembre' ? 9 : i + 1) })
  return year * 100 + month
}

function parsePeriodoInput(periodo?: string): { mes?: number; anio?: number } {
  if (!periodo) return {}
  const lower = periodo.toLowerCase()
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  let mes: number | undefined
  months.forEach((m, i) => { if (lower.includes(m)) mes = i + 1 })
  const yearMatch = lower.match(/(20\d{2})/)
  const anio = yearMatch ? Number(yearMatch[1]) : undefined
  return { mes, anio }
}

// ─── listAllies ───────────────────────────────────────────────────────────────

export interface AliadosListQuery {
  page?: number
  pageSize?: number
  name?: string
  debtStatus?: AliadosDebtStatusFilter
  allyStatus?: 'all' | 'activo' | 'inactivo'
  bolsa?: string
  rubro?: string
  servicio?: string
  ejecutiva?: string
  periodOrder?: 'recent' | 'oldest' | 'amount_desc' | 'amount_asc'
}

function currentMonthStartUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export async function listAllies(query: AliadosListQuery = {}) {
  const page       = Math.max(1, Number(query.page)     || 1)
  const pageSize   = Math.max(1, Number(query.pageSize) || 50)
  const sorted     = await listAlliesFiltered(query)
  const total      = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage   = Math.min(page, totalPages)
  const start      = (safePage - 1) * pageSize

  return { items: sorted.slice(start, start + pageSize), page: safePage, pageSize, total, totalPages }
}

async function listAlliesFiltered(query: AliadosListQuery = {}) {
  const name       = query.name        ?? ''
  const debtStatus = query.debtStatus  ?? 'all'
  const allyStatus = query.allyStatus  ?? 'all'
  const bolsa      = query.bolsa?.trim()
  const rubro      = query.rubro?.trim()
  const servicio   = query.servicio?.trim()
  const ejecutiva  = query.ejecutiva?.trim()
  const order      = query.periodOrder ?? 'recent'

  const matchesServicio = (raw: string | null | undefined) => {
    if (!servicio) return true
    const s = (raw ?? '').trim()
    if (!s) return servicio === 'Sin clasificar'
    return s.toLowerCase() === servicio.toLowerCase()
  }

  const alliesRaw = await prisma.directorioAliado.findMany({
    where: {
      ...(name ? { brand: { contains: name, mode: 'insensitive' } } : {}),
      ...(allyStatus !== 'all' ? { estado_actual: allyStatus === 'activo' ? 'Activo' : 'Inactivo' } : {}),
      ...(bolsa ? { bolsa: { equals: bolsa, mode: 'insensitive' } } : {}),
      ...(rubro ? { rubro: { equals: rubro, mode: 'insensitive' } } : {}),
    },
    include: {
      rucs: true,
      facturas: {
        select: {
          deuda_id:        true,
          monto_original:  true,
          saldo_pendiente: true,
          estado_deuda:    true,
          periodo_mes:     true,
          periodo_anio:    true,
          servicio:        true,
          num_factura:     true,
          monto_compra:    true,
          absorbe_ueno:    true,
          clientes:        true,
          trx:             true,
          cuotas: {
            select: {
              saldo_cuota:       true,
              fecha_vencimiento: true,
              estado_cuota:      true,
            },
          },
        },
      },
    },
    orderBy: { brand: 'asc' },
  })

  const items = alliesRaw.map((ally) => {
    const facturas = servicio
      ? ally.facturas.filter((f) => matchesServicio(f.servicio))
      : ally.facturas

    const deuda_total     = facturas.reduce((s, f) => s + n(f.monto_original),  0)
    const saldo_pendiente = facturas.reduce((s, f) => s + n(f.saldo_pendiente), 0)
    const monto_total_pagado = facturas.reduce((s, f) => {
      const monto = n(f.monto_original)
      const saldo = n(f.saldo_pendiente)
      return s + Math.max(0, monto - saldo)
    }, 0)
    const activa = facturas.find((f) => !isDeudaCerrada(f.estado_deuda)) ?? facturas[0]
    const cuotasActivas = facturas.flatMap((f) => f.cuotas)
    const tieneCuotaVencida = cuotasActivas.some(isCuotaActivaVencida)
    const estado_general  = computeEstadoGeneral(saldo_pendiente, deuda_total, tieneCuotaVencida)

    return {
      aliado_id:          ally.cod_aliado,
      aliado_nombre:      ally.brand,
      bolsa:              ally.bolsa ?? null,
      rubro:              ally.rubro ?? null,
      codigo_persona:     ally.cod_persona?.toString(),
      estado:             ally.estado_actual,
      estado_general,
      ruc:                ally.rucs.find(r => r.principal)?.ruc ?? ally.rucs[0]?.ruc ?? null,
      rucs:               ally.rucs.map(r => r.ruc),
      deuda_activa_id:    activa?.deuda_id ?? '',
      deuda_total,
      monto_total_pagado,
      saldo_pendiente,
      servicio:           activa?.servicio ?? '',
      ultimo_periodo:     formatPeriodo(activa?.periodo_mes, activa?.periodo_anio),
      monto_compra:       activa?.monto_compra != null ? n(activa.monto_compra) : null,
      absorbe_ueno:       activa?.absorbe_ueno != null ? n(activa.absorbe_ueno) : null,
      clientes:           activa?.clientes ?? null,
      trx:                activa?.trx ?? null,
      detalles_deuda:     facturas.map((f) => ({
        deuda_id:       f.deuda_id,
        periodo:        formatPeriodo(f.periodo_mes, f.periodo_anio),
        servicio:       f.servicio ?? '',
        estado_deuda:   f.estado_deuda,
        num_factura:    f.num_factura,
        monto_original: n(f.monto_original),
        pagado:         Math.max(0, n(f.monto_original) - n(f.saldo_pendiente)),
        saldo_pendiente: n(f.saldo_pendiente),
      })),
    }
  })

  const withServicio = servicio
    ? items.filter((a) => a.detalles_deuda.length > 0)
    : items

  let withEjecutiva = withServicio
  if (ejecutiva && ejecutiva !== 'all') {
    const mesStart = currentMonthStartUtc()
    const ejRows = await prisma.aliadoEjecutivaMensual.findMany({
      where: { mes: mesStart },
      select: { cod_aliado: true, ejecutiva_nombre: true },
    })
    const ejMap = new Map(ejRows.map((r) => [r.cod_aliado, r.ejecutiva_nombre]))
    if (ejecutiva === 'Sin asignar') {
      withEjecutiva = withServicio.filter((a) => !ejMap.has(String(a.aliado_id)))
    } else {
      withEjecutiva = withServicio.filter((a) => ejMap.get(String(a.aliado_id)) === ejecutiva)
    }
  }

  const filtered = debtStatus === 'all'
    ? withEjecutiva
    : debtStatus === 'con_saldo'
      ? withEjecutiva.filter((a) => a.saldo_pendiente > 0)
      : withEjecutiva.filter((a) => a.estado_general === debtStatus)

  const sorted = [...filtered].sort((a, b) => {
    if (order === 'amount_desc') return b.saldo_pendiente - a.saldo_pendiente
    if (order === 'amount_asc') return a.saldo_pendiente - b.saldo_pendiente
    const aRank = parsePeriodString(a.ultimo_periodo)
    const bRank = parsePeriodString(b.ultimo_periodo)
    return order === 'oldest' ? aRank - bRank : bRank - aRank
  })

  return sorted
}

export async function listAlliesFilterOptions() {
  const mesStart = currentMonthStartUtc()
  const [bolsasRaw, rubrosRaw, serviciosRaw, ejecutivasRaw] = await Promise.all([
    prisma.directorioAliado.findMany({
      where:   { bolsa: { not: null } },
      select:  { bolsa: true },
      distinct: ['bolsa'],
      orderBy: { bolsa: 'asc' },
    }),
    prisma.directorioAliado.findMany({
      where:   { rubro: { not: null } },
      select:  { rubro: true },
      distinct: ['rubro'],
      orderBy: { rubro: 'asc' },
    }),
    prisma.facturacion.findMany({
      select:  { servicio: true },
      distinct: ['servicio'],
      orderBy: { servicio: 'asc' },
    }),
    prisma.aliadoEjecutivaMensual.findMany({
      where:   { mes: mesStart },
      select:  { ejecutiva_nombre: true },
      distinct: ['ejecutiva_nombre'],
      orderBy: { ejecutiva_nombre: 'asc' },
    }),
  ])

  const servicios = serviciosRaw
    .map((r) => r.servicio?.trim())
    .filter((v): v is string => Boolean(v))

  const ejecutivas = ejecutivasRaw
    .map((r) => r.ejecutiva_nombre?.trim())
    .filter((v): v is string => Boolean(v))

  return {
    bolsas: bolsasRaw.map((r) => r.bolsa).filter((v): v is string => Boolean(v?.trim())),
    rubros: rubrosRaw.map((r) => r.rubro).filter((v): v is string => Boolean(v?.trim())),
    servicios,
    ejecutivas: ['Sin asignar', ...ejecutivas],
  }
}

const DEBT_STATUS_LABELS: Record<EstadoGeneralDeuda, string> = {
  sin_deuda:       'Sin deuda',
  pendiente:       'Pendiente',
  parcial:         'Parcial',
  pagado:          'Pagado',
  con_vencimiento: 'Con vencimiento',
}

export async function exportAlliesCsv(
  query: Omit<AliadosListQuery, 'page' | 'pageSize'> = {},
): Promise<string> {
  const items = await listAlliesFiltered(query)

  const header = [
    'cod_aliado',
    'deuda_id',
    'aliado',
    'bolsa',
    'rubro',
    'estado_aliado',
    'estado_deuda',
    'ruc',
    'ultimo_periodo',
    'servicio',
    'monto_compra',
    'absorbe_ueno',
    'deuda_total',
    'clientes',
    'trx',
    'monto_pagado',
    'saldo_pendiente',
    'cantidad_deudas',
  ].join(',')

  const lines = items.map((ally) => [
    escapeCsv(ally.aliado_id),
    escapeCsv(ally.deuda_activa_id ?? ''),
    escapeCsv(ally.aliado_nombre),
    escapeCsv(ally.bolsa),
    escapeCsv(ally.rubro),
    escapeCsv(ally.estado),
    escapeCsv(DEBT_STATUS_LABELS[ally.estado_general as EstadoGeneralDeuda] ?? ally.estado_general),
    escapeCsv(ally.ruc),
    escapeCsv(ally.ultimo_periodo),
    escapeCsv(ally.servicio),
    escapeCsv(ally.monto_compra ?? ''),
    escapeCsv(ally.absorbe_ueno ?? ''),
    escapeCsv(ally.deuda_total),
    escapeCsv(ally.clientes ?? ''),
    escapeCsv(ally.trx ?? ''),
    escapeCsv(ally.monto_total_pagado),
    escapeCsv(ally.saldo_pendiente),
    escapeCsv(ally.detalles_deuda.length),
  ].join(','))

  return [header, ...lines].join('\n')
}

export async function exportAlliesDeudaDetalleCsv(
  query: Omit<AliadosListQuery, 'page' | 'pageSize'> = {},
): Promise<string> {
  const allies = await listAlliesFiltered(query)
  const allyIds = allies.map((a) => String(a.aliado_id))

  const header = [
    'cod_aliado',
    'aliado',
    'estado_aliado',
    'ruc',
    'deuda_id',
    'num_factura_manual',
    'periodo',
    'servicio',
    'estado_deuda',
    'monto_total',
    'monto_pagado',
    'saldo_pendiente',
    'cuotas_total',
    'cuotas_pagadas',
    'cuotas_pendientes',
    'cuotas_parciales',
    'fecha_vencimiento_ultima',
  ].join(',')

  if (allyIds.length === 0) return header

  const facturas = await prisma.facturacion.findMany({
    where: { cod_aliado: { in: allyIds } },
    include: {
      cuotas: {
        select: {
          saldo_cuota: true,
          monto_cuota: true,
          estado_cuota: true,
          fecha_vencimiento: true,
          nro_cuota: true,
        },
      },
    },
    orderBy: [{ cod_aliado: 'asc' }, { periodo_anio: 'desc' }, { periodo_mes: 'desc' }],
  })

  const allyMap = new Map(allies.map((a) => [String(a.aliado_id), a]))

  const lines = facturas
    .filter((f) => isDeudaConSaldoPendiente(f.estado_deuda, n(f.saldo_pendiente)))
    .map((f) => {
      const ally = allyMap.get(f.cod_aliado)
      if (!ally) return null

      const stats = computeCuotaStats(f.cuotas)
      const montoTotal = n(f.monto_original)
      const saldo = n(f.saldo_pendiente)

      return [
        escapeCsv(ally.aliado_id),
        escapeCsv(ally.aliado_nombre),
        escapeCsv(ally.estado),
        escapeCsv(ally.ruc),
        escapeCsv(f.deuda_id),
        escapeCsv(f.num_factura),
        escapeCsv(formatPeriodo(f.periodo_mes, f.periodo_anio)),
        escapeCsv(f.servicio),
        escapeCsv(f.estado_deuda),
        escapeCsv(montoTotal),
        escapeCsv(montoTotal - saldo),
        escapeCsv(saldo),
        escapeCsv(stats.cuotas_total),
        escapeCsv(stats.cuotas_pagadas),
        escapeCsv(stats.cuotas_pendientes),
        escapeCsv(stats.cuotas_parciales),
        escapeCsv(getUltimaFechaVencimientoCuotas(f.cuotas)),
      ].join(',')
    })
    .filter((line): line is string => line !== null)

  return [header, ...lines].join('\n')
}

// ─── Facturas (paginadas / lazy) ─────────────────────────────────────────────

export type FacturaEstadoFilter = 'pendientes' | 'parciales' | 'pagadas' | 'anuladas' | 'todas'

type FacturaDbRow = {
  deuda_id: string
  cod_aliado: string
  num_factura: string | null
  periodo_mes: number | null
  periodo_anio: number | null
  monto_original: bigint
  saldo_pendiente: bigint
  estado_deuda: string
  servicio: string | null
  cuotas: Array<{ saldo_cuota: bigint; monto_cuota: bigint; estado_cuota: string; fecha_vencimiento: Date | null; nro_cuota: number }>
}

function matchesFacturaEstadoFilter(factura: FacturaDbRow, filter: FacturaEstadoFilter): boolean {
  const estado = String(factura.estado_deuda || '').toLowerCase()
  const saldo = n(factura.saldo_pendiente)

  if (filter === 'anuladas') return estado.includes('anulad')
  if (filter === 'pagadas') return estado.includes('pagad') || saldo <= 0
  if (filter === 'parciales') return estado.includes('parcial')
  if (filter === 'pendientes') {
    if (estado.includes('anulad')) return false
    if ((estado.includes('pagad') || estado.includes('pagado')) && saldo <= 0) return false
    return saldo > 0 || estado.includes('pendiente')
  }
  return true
}

function computeCuotaStats(cuotas: FacturaDbRow['cuotas']) {
  let cuotas_pagadas = 0
  let cuotas_pendientes = 0
  let cuotas_parciales = 0

  for (const c of cuotas) {
    const estado = c.estado_cuota.trim().toLowerCase()
    if (estado === 'refinanciada') continue
    const saldo = n(c.saldo_cuota)
    const monto = n(c.monto_cuota)
    if (estado === 'pagada' || saldo <= 0) cuotas_pagadas++
    else if (monto > 0 && saldo < monto) cuotas_parciales++
    else cuotas_pendientes++
  }

  return {
    cuotas_total:      cuotas.length,
    cuotas_pagadas,
    cuotas_pendientes,
    cuotas_parciales,
  }
}

function getUltimaFechaVencimientoCuotas(
  cuotas: Array<{ fecha_vencimiento: Date | null; nro_cuota: number }>,
): string | undefined {
  if (cuotas.length === 0) return undefined
  const ultima = [...cuotas].sort((a, b) => b.nro_cuota - a.nro_cuota)[0]
  return ultima?.fecha_vencimiento?.toISOString().slice(0, 10)
}

function mapFacturaRecord(f: FacturaDbRow) {
  return {
    factura_id:     f.deuda_id,
    deuda_id:       f.deuda_id,
    aliado_id:      f.cod_aliado,
    num_factura:    f.num_factura,
    periodo:        formatPeriodo(f.periodo_mes, f.periodo_anio),
    monto_neto:     n(f.monto_original),
    tipo_factura:   f.servicio,
    servicio:       f.servicio,
    estado_factura: f.estado_deuda,
    saldo_factura:  n(f.saldo_pendiente),
    fecha_vencimiento_ultima: getUltimaFechaVencimientoCuotas(f.cuotas),
    ...computeCuotaStats(f.cuotas),
  }
}

function mapCuotaRecord(
  c: {
    cuota_id: string
    deuda_id: string
    nro_cuota: number
    monto_cuota: bigint
    fecha_vencimiento: Date | null
    estado_cuota: string
    saldo_cuota: bigint
    motivo_cambio: string | null
  },
  montoPagado = 0,
) {
  const montoCuotaN = n(c.monto_cuota)
  const refinanciada = c.estado_cuota === 'Refinanciada'
  return {
    cuota_id:          c.cuota_id,
    factura_id:        c.deuda_id,
    deuda_id:          c.deuda_id,
    numero_cuota:      c.nro_cuota,
    monto_cuota:       montoCuotaN,
    monto_pagado:      montoPagado,
    ...(refinanciada ? { saldo_refinanciado: Math.max(0, montoCuotaN - montoPagado) } : {}),
    fecha_vencimiento: c.fecha_vencimiento?.toISOString().slice(0, 10) ?? '',
    estado_cuota:      c.estado_cuota,
    saldo_cuota:       n(c.saldo_cuota),
    observacion:       c.motivo_cambio,
  }
}

async function fetchAllyFacturasRows(aliadoId: string): Promise<FacturaDbRow[] | null> {
  const ally = await prisma.directorioAliado.findUnique({ where: { cod_aliado: aliadoId } })
  if (!ally) return null

  return prisma.facturacion.findMany({
    where: { cod_aliado: aliadoId },
    include: {
      cuotas: {
        select: {
          saldo_cuota: true,
          monto_cuota: true,
          estado_cuota: true,
          fecha_vencimiento: true,
          nro_cuota: true,
        },
      },
    },
    orderBy: [{ periodo_anio: 'desc' }, { periodo_mes: 'desc' }],
  })
}

function filterFacturasBySearch(rows: FacturaDbRow[], search?: string): FacturaDbRow[] {
  const query = String(search || '').trim().toLowerCase()
  if (!query) return rows

  return rows.filter((f) => {
    const servicio = String(f.servicio || '').toLowerCase()
    return (
      f.deuda_id.toLowerCase().includes(query)
      || String(formatPeriodo(f.periodo_mes, f.periodo_anio) || '').toLowerCase().includes(query)
      || String(f.num_factura || '').toLowerCase().includes(query)
      || servicio.includes(query)
    )
  })
}

export interface ListAllyFacturasOptions {
  page?: number
  pageSize?: number
  estado?: FacturaEstadoFilter
  search?: string
}

export async function listAllyFacturas(aliadoId: string, options: ListAllyFacturasOptions = {}) {
  const rows = await fetchAllyFacturasRows(aliadoId)
  if (!rows) return null

  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 10))
  const estado = options.estado ?? 'pendientes'
  const filtered = filterFacturasBySearch(
    rows.filter((f) => matchesFacturaEstadoFilter(f, estado)),
    options.search,
  )

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, options.page ?? 1), totalPages)
  const start = (page - 1) * pageSize

  return {
    items: filtered.slice(start, start + pageSize).map(mapFacturaRecord),
    page,
    pageSize,
    total,
    totalPages,
    estado,
  }
}

export async function getFacturaCuotasForAlly(aliadoId: string, deudaId: string) {
  const factura = await prisma.facturacion.findFirst({
    where: { deuda_id: deudaId, cod_aliado: aliadoId },
  })
  if (!factura) return null

  const [cuotas, refinanciaciones_previas, pagosPorCuota] = await Promise.all([
    prisma.cuota.findMany({
      where: { deuda_id: deudaId },
      orderBy: { nro_cuota: 'asc' },
    }),
    contarRefinanciacionesAprobadas(prisma, deudaId),
    prisma.aplicacionPago.groupBy({
      by: ['cuota_id'],
      where: {
        cuota_id: { not: null },
        cuota: { deuda_id: deudaId },
      },
      _sum: { monto_aplicado: true },
    }),
  ])

  const montoPagadoByCuota = new Map(
    pagosPorCuota
      .filter((row): row is typeof row & { cuota_id: string } => Boolean(row.cuota_id))
      .map((row) => [row.cuota_id, n(row._sum.monto_aplicado)]),
  )

  return {
    items: cuotas.map((c) => mapCuotaRecord(c, montoPagadoByCuota.get(c.cuota_id) ?? 0)),
    refinanciaciones_previas,
    saldo_pendiente: n(factura.saldo_pendiente),
  }
}

function escapeCsv(value: string | number | null | undefined): string {
  const s = String(value ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function exportAllyFacturasCsv(
  aliadoId: string,
  options: Pick<ListAllyFacturasOptions, 'estado' | 'search'> = {},
): Promise<string | null> {
  const rows = await fetchAllyFacturasRows(aliadoId)
  if (!rows) return null

  const estado = options.estado ?? 'todas'
  const filtered = filterFacturasBySearch(
    rows.filter((f) => matchesFacturaEstadoFilter(f, estado)),
    options.search,
  ).map(mapFacturaRecord)

  const header = [
    'factura_id',
    'periodo',
    'num_factura',
    'servicio',
    'estado_factura',
    'monto_neto',
    'saldo_factura',
    'cuotas_total',
    'cuotas_pagadas',
    'cuotas_pendientes',
    'cuotas_parciales',
  ].join(',')

  const lines = filtered.map((f) => [
    escapeCsv(f.factura_id),
    escapeCsv(f.periodo),
    escapeCsv(f.num_factura),
    escapeCsv(f.servicio),
    escapeCsv(f.estado_factura),
    escapeCsv(f.monto_neto),
    escapeCsv(f.saldo_factura),
    escapeCsv(f.cuotas_total),
    escapeCsv(f.cuotas_pagadas),
    escapeCsv(f.cuotas_pendientes),
    escapeCsv(f.cuotas_parciales),
  ].join(','))

  return [header, ...lines].join('\n')
}

// ─── getAllyDetail ────────────────────────────────────────────────────────────

export async function getAllyDetail(aliadoId: string) {
  const ally = await prisma.directorioAliado.findUnique({
    where: { cod_aliado: aliadoId },
    include: { rucs: true },
  })
  if (!ally) return null

  const [agg, activaRow] = await Promise.all([
    prisma.facturacion.aggregate({
      where: { cod_aliado: aliadoId },
      _sum: { monto_original: true, saldo_pendiente: true },
    }),
    prisma.facturacion.findFirst({
      where: {
        cod_aliado: aliadoId,
        NOT: { estado_deuda: { in: ['Pagada', 'Pagado', 'Anulada', 'Anulado'] } },
      },
      orderBy: [{ periodo_anio: 'desc' }, { periodo_mes: 'desc' }],
    }),
  ])

  const deuda_total     = n(agg._sum.monto_original)
  const saldo_pendiente = n(agg._sum.saldo_pendiente)

  const resumen = {
    deuda_activa_id:    activaRow?.deuda_id ?? '',
    deuda_total,
    monto_total_pagado: deuda_total - saldo_pendiente,
    saldo_pendiente,
    saldo_a_favor:      n(ally.saldo_a_favor),
    servicio:           activaRow?.servicio ?? '',
    ultimo_periodo:     activaRow
      ? formatPeriodo(activaRow.periodo_mes, activaRow.periodo_anio)
      : undefined,
  }

  return {
    aliado: {
      aliado_id:      ally.cod_aliado,
      aliado_nombre:  ally.brand,
      bolsa:          ally.bolsa ?? null,
      rubro:          ally.rubro ?? null,
      ruc:            ally.rucs.find(r => r.principal)?.ruc ?? ally.rucs[0]?.ruc ?? null,
      rucs:           ally.rucs.map(r => ({ ruc: r.ruc, principal: r.principal })),
      codigo_persona: ally.cod_persona?.toString(),
      estado:         ally.estado_actual,
      fecha_alta:     ally.fecha_registro_inicial?.toISOString().slice(0, 10),
      saldo_a_favor:  n(ally.saldo_a_favor),
    },
    compromisos: [],
    cuotas:      [],
    facturas:    [],
    pagos:       [],
    resumen,
  }
}

// ─── createFactura ────────────────────────────────────────────────────────────

export interface CrearFacturaInput {
  aliadoId: string
  montoNeto: number
  numFactura?: string
  periodo?: string
  fechaDeuda?: string
  tipoFactura?: string
  cuotas?: Array<{ numero_cuota: number; monto_cuota: number; fecha_vencimiento: string }>
  observacion?: string
  servicio?: string
}

export async function createFactura(input: CrearFacturaInput) {
  const ally = await prisma.directorioAliado.findUnique({ where: { cod_aliado: input.aliadoId } })
  if (!ally) return null

  const { mes, anio } = parsePeriodoInput(input.periodo)
  const deudaId = await generateDeudaId()
  const cuotasIniciales = resolveCuotasIniciales(input)

  const factura = await prisma.facturacion.create({
    data: {
      deuda_id:        deudaId,
      cod_aliado:      input.aliadoId,
      monto_original:  BigInt(Math.round(input.montoNeto)),
      saldo_pendiente: BigInt(Math.round(input.montoNeto)),
      estado_deuda:    'Pendiente',
      num_factura:     input.numFactura,
      servicio:        input.servicio ?? input.tipoFactura,
      periodo_mes:     mes,
      periodo_anio:    anio,
      ...(cuotasIniciales.length > 0
        ? {
            cuotas: {
              create: cuotasIniciales.map((c, i) => ({
                cuota_id:          `C-${randomUUID().slice(0, 8)}-${i + 1}`,
                nro_cuota:         c.numero_cuota,
                monto_cuota:       BigInt(Math.round(c.monto_cuota)),
                saldo_cuota:       BigInt(Math.round(c.monto_cuota)),
                estado_cuota:      'Pendiente',
                fecha_vencimiento: new Date(`${c.fecha_vencimiento}T12:00:00.000Z`),
              })),
            },
          }
        : {}),
    },
    include: { cuotas: true },
  })

  if (input.numFactura?.trim()) {
    await ensureCuotaVencimientoOnFacturaAssign(deudaId)
  }

  return {
    factura: {
      factura_id:     factura.deuda_id,
      aliado_id:      factura.cod_aliado,
      num_factura:    factura.num_factura,
      periodo:        formatPeriodo(factura.periodo_mes, factura.periodo_anio),
      monto_neto:     n(factura.monto_original),
      estado_factura: factura.estado_deuda,
      saldo_factura:  n(factura.saldo_pendiente),
      servicio:       factura.servicio,
    },
    cuotas: factura.cuotas.map((c) => ({
      cuota_id:          c.cuota_id,
      factura_id:        c.deuda_id,
      numero_cuota:      c.nro_cuota,
      monto_cuota:       n(c.monto_cuota),
      fecha_vencimiento: c.fecha_vencimiento?.toISOString().slice(0, 10) ?? '',
      estado_cuota:      c.estado_cuota,
      saldo_cuota:       n(c.saldo_cuota),
    })),
  }
}

// ─── registrarPago ────────────────────────────────────────────────────────────

export type { DestinoPreview } from './pagoApplication.js'
export {
  PagoConfirmacionRequeridaError,
  PagoValidationError,
  previewAplicacionPago,
} from './pagoApplication.js'
export { registrarPagoConAplicacion as registrarPago } from './pagoApplication.js'
export type { RegistrarPagoAplicadoInput as RegistrarPagoInput } from './pagoApplication.js'

// ─── asignarNumFactura ────────────────────────────────────────────────────────

export interface AsignarNumFacturaInput {
  deudaId: string
  numFactura: string
  /** Reservado: en el schema actual cuotas no tienen columna num_factura. */
  aplicarEnCuotas?: boolean
}

export async function asignarNumFactura(input: AsignarNumFacturaInput) {
  const numFactura = input.numFactura.trim()
  if (!input.deudaId || !numFactura) {
    throw new Error('deudaId y numFactura son requeridos.')
  }

  const existing = await prisma.facturacion.findUnique({
    where: { deuda_id: input.deudaId },
  })
  if (!existing) return null

  const esPrimeraAsignacion = !existing.num_factura?.trim()

  const updated = await prisma.facturacion.update({
    where: { deuda_id: input.deudaId },
    data:  { num_factura: numFactura },
  })

  if (esPrimeraAsignacion) {
    await ensureCuotaVencimientoOnFacturaAssign(input.deudaId)
  }

  return {
    ok: true,
    factura: {
      factura_id:  updated.deuda_id,
      aliado_id:   updated.cod_aliado,
      num_factura: updated.num_factura,
    },
  }
}
