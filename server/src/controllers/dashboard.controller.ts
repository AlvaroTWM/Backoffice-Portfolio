import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'

// ─── Filtros del dashboard ────────────────────────────────────────────────────

type DashboardPeriod = '12m' | '6m' | 'ytd'

interface DashboardFilters {
  period: DashboardPeriod
  servicio: string | null
}

function parseDashboardFilters(req: Request): DashboardFilters {
  const rawPeriod = typeof req.query.period === 'string' ? req.query.period : '12m'
  const period: DashboardPeriod = rawPeriod === '6m' || rawPeriod === 'ytd' ? rawPeriod : '12m'

  const rawServicio = typeof req.query.servicio === 'string' ? req.query.servicio.trim() : 'todos'
  const servicio = !rawServicio || rawServicio === 'todos' ? null : rawServicio

  return { period, servicio }
}

function periodStartExpr(period: DashboardPeriod): string {
  switch (period) {
    case '6m':
      return `(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months')::date`
    case 'ytd':
      return `DATE_TRUNC('year', CURRENT_DATE)::date`
    default:
      return `(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months')::date`
  }
}

function servicioClause(alias: string, servicio: string | null): string {
  if (!servicio) return ''
  const escaped = servicio.replace(/'/g, "''")
  if (servicio === 'Sin clasificar') {
    return ` AND (${alias}.servicio IS NULL OR TRIM(COALESCE(${alias}.servicio, '')) = '') `
  }
  return ` AND COALESCE(${alias}.servicio, 'Sin clasificar') = '${escaped}' `
}

/** Deudas abiertas con saldo — misma base que el KPI "Deuda pendiente". */
const FACTURA_ABIERTA_SQL = `
  LOWER(f.estado_deuda) NOT IN ('pagada', 'pagado', 'anulada', 'anulado')
  AND f.saldo_pendiente > 0
`

function facturacionServicioWhere(servicio: string | null) {
  if (!servicio) return {}
  if (servicio === 'Sin clasificar') {
    return { OR: [{ servicio: null }, { servicio: '' }] }
  }
  return { servicio }
}

// ─── Raw query result types ───────────────────────────────────────────────────

interface MesRow        { mes: Date | string; total: bigint | number }
interface AgingRow      { al_dia: bigint; d1_30: bigint; d31_60: bigint; d61_90: bigint; mas_90: bigint }
interface MorosidadRow  { deuda_vencida: bigint; deuda_total: bigint }
interface ProyecRow     { d30: bigint; d60: bigint; d90: bigint; d120: bigint }
interface ServicioRow   { servicio: string | null; monto: bigint }
interface CriticaRow    { cod_aliado: string; aliado_nombre: string; deuda_vencida: bigint; dias_max: number | null; ultima_fecha_pago: Date | null }
interface VencimientoRow { cuota_id: string; cod_aliado: string; aliado_nombre: string; monto: bigint; fecha_vencimiento: Date | string; dias_restantes: number }
interface ParetoRow     { cod_aliado: string; aliado_nombre: string; deuda: bigint }
interface CompromisoMesRow {
  mes: Date | string
  pagado_a_tiempo: bigint
  vencido: bigint
  pendiente: bigint
}
interface IncumplidoRow {
  cod_aliado: string
  aliado_nombre: string
  monto_incumplido: bigint
  cantidad_compromisos: number
}
interface EjecutivaDeudaRow {
  ejecutiva_nombre: string
  deuda: bigint
}
interface HistoricoRecobroRow {
  mes: Date | string
  pagado: bigint
  vencido: bigint
  vigente: bigint
}

function n(v: bigint | number | null | undefined): number {
  return Number(v ?? 0)
}

function mesIso(row: MesRow | CompromisoMesRow): string {
  const mes = row.mes
  return (mes instanceof Date ? mes.toISOString() : String(mes)).slice(0, 7)
}

/** Clasifica compromisos cruzando pagos (a tiempo / vencido / pendiente). */
const COMPROMISO_CLASIFICADO_SQL = `
  WITH compromiso_clasificado AS (
    SELECT
      c.compromiso_id,
      c.cuota_id,
      c.fecha_promesa,
      c.monto_promesa,
      DATE_TRUNC('month', c.fecha_promesa)::date AS mes,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM   pagos p
          WHERE  p.compromiso_id = c.compromiso_id
            AND  p.estado_pago = 'Aplicado'
            AND  p.fecha_pago <= c.fecha_promesa
        ) THEN 'pagado_a_tiempo'
        WHEN c.fecha_promesa < CURRENT_DATE THEN 'vencido'
        ELSE 'pendiente'
      END AS bucket
    FROM compromisos c
  )
`

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const filters = parseDashboardFilters(req)
    const periodStart = periodStartExpr(filters.period)
    const sf = servicioClause('f', filters.servicio)
    const servicioWhere = facturacionServicioWhere(filters.servicio)

    const [
      aliadosActivos,
      deudaPendiente,
      totalCobrado,
      aprobacionesPendientes,
      evolucionRaw,
      agingRaw,
      morosidadRaw,
      proyecRaw,
      servicioRaw,
      criticasRaw,
      vencimientosRaw,
      paretoRaw,
      aliadosConDeudaRaw,
      deudasSinFactura,
      compromisosHistoricoRaw,
      compromisosIncumplidosRaw,
      deudaPorEjecutivaRaw,
      historicoRecobroRaw,
      serviciosDisponiblesRaw,
    ] = await Promise.all([

      // 1. Aliados activos
      prisma.directorioAliado.count({ where: { estado_actual: 'Activo' } }),

      // 2. Deuda total pendiente
      prisma.facturacion.aggregate({
        _sum: { saldo_pendiente: true },
        where: {
          estado_deuda: { notIn: ['Pagada', 'Pagado', 'Anulada'] },
          ...servicioWhere,
        },
      }),

      // 3. Total cobrado (pagos aplicados en el período)
      filters.servicio
        ? prisma.$queryRawUnsafe<{ total: bigint }[]>(`
            SELECT COALESCE(SUM(ap.monto_aplicado), 0) AS total
            FROM   aplicacion_pago ap
            JOIN   pagos p ON p.pago_id = ap.pago_id
            JOIN   facturacion f ON f.deuda_id = COALESCE(
              ap.deuda_id,
              (SELECT cu.deuda_id FROM cuotas cu WHERE cu.cuota_id = ap.cuota_id)
            )
            WHERE  p.estado_pago = 'Aplicado'
              AND  p.fecha_pago >= ${periodStart}
              ${sf}
          `)
        : prisma.$queryRawUnsafe<{ total: bigint }[]>(`
            SELECT COALESCE(SUM(ap.monto_aplicado), 0) AS total
            FROM   aplicacion_pago ap
            JOIN   pagos p ON p.pago_id = ap.pago_id
            WHERE  p.estado_pago = 'Aplicado'
              AND  p.fecha_pago >= ${periodStart}
          `),

      // 4. Aprobaciones pendientes
      prisma.aprobacion.count({ where: { estado: 'Pendiente' } }),

      // 5. Evolución mensual de pagos
      filters.servicio
        ? prisma.$queryRawUnsafe<MesRow[]>(`
            SELECT DATE_TRUNC('month', p.fecha_pago)::date AS mes,
                   SUM(ap.monto_aplicado)                   AS total
            FROM   aplicacion_pago ap
            JOIN   pagos p ON p.pago_id = ap.pago_id
            JOIN   facturacion f ON f.deuda_id = COALESCE(
              ap.deuda_id,
              (SELECT cu.deuda_id FROM cuotas cu WHERE cu.cuota_id = ap.cuota_id)
            )
            WHERE  p.estado_pago = 'Aplicado'
              AND  p.fecha_pago >= ${periodStart}
              ${sf}
            GROUP  BY DATE_TRUNC('month', p.fecha_pago)
            ORDER  BY mes ASC
          `)
        : prisma.$queryRawUnsafe<MesRow[]>(`
            SELECT DATE_TRUNC('month', p.fecha_pago)::date AS mes,
                   SUM(ap.monto_aplicado)                   AS total
            FROM   aplicacion_pago ap
            JOIN   pagos p ON p.pago_id = ap.pago_id
            WHERE  p.estado_pago = 'Aplicado'
              AND  p.fecha_pago >= ${periodStart}
            GROUP  BY DATE_TRUNC('month', p.fecha_pago)
            ORDER  BY mes ASC
          `),

      // 6. Aging de deuda (cuotas con saldo + deudas sin cuotas activas en "al día")
      prisma.$queryRawUnsafe<AgingRow[]>(`
        SELECT
          COALESCE(SUM(CASE WHEN cu.fecha_vencimiento IS NULL OR cu.fecha_vencimiento >= CURRENT_DATE THEN cu.saldo_cuota ELSE 0 END), 0)
          + COALESCE((
            SELECT SUM(f.saldo_pendiente)
            FROM   facturacion f
            WHERE  ${FACTURA_ABIERTA_SQL}
              AND  NOT EXISTS (
                SELECT 1 FROM cuotas cu2
                WHERE  cu2.deuda_id = f.deuda_id
                  AND  cu2.saldo_cuota > 0
                  AND  LOWER(cu2.estado_cuota) NOT IN ('pagada', 'refinanciada')
              )
              ${sf}
          ), 0) AS al_dia,
          COALESCE(SUM(CASE WHEN cu.fecha_vencimiento < CURRENT_DATE AND (CURRENT_DATE - cu.fecha_vencimiento) <= 30  THEN cu.saldo_cuota ELSE 0 END), 0) AS d1_30,
          COALESCE(SUM(CASE WHEN cu.fecha_vencimiento < CURRENT_DATE AND (CURRENT_DATE - cu.fecha_vencimiento) BETWEEN 31 AND 60  THEN cu.saldo_cuota ELSE 0 END), 0) AS d31_60,
          COALESCE(SUM(CASE WHEN cu.fecha_vencimiento < CURRENT_DATE AND (CURRENT_DATE - cu.fecha_vencimiento) BETWEEN 61 AND 90  THEN cu.saldo_cuota ELSE 0 END), 0) AS d61_90,
          COALESCE(SUM(CASE WHEN cu.fecha_vencimiento < CURRENT_DATE AND (CURRENT_DATE - cu.fecha_vencimiento) > 90  THEN cu.saldo_cuota ELSE 0 END), 0) AS mas_90
        FROM   cuotas cu
        JOIN   facturacion f ON f.deuda_id = cu.deuda_id
        WHERE  LOWER(cu.estado_cuota) NOT IN ('pagada', 'refinanciada')
          AND  cu.saldo_cuota > 0
          ${sf}
      `),

      // 7. Deuda vencida y total para tasa de morosidad (total = saldo pendiente en facturación)
      prisma.$queryRawUnsafe<MorosidadRow[]>(`
        SELECT
          COALESCE(SUM(CASE WHEN cu.fecha_vencimiento < CURRENT_DATE THEN cu.saldo_cuota ELSE 0 END), 0) AS deuda_vencida,
          COALESCE((
            SELECT SUM(f.saldo_pendiente)
            FROM   facturacion f
            WHERE  ${FACTURA_ABIERTA_SQL}
              ${sf}
          ), 0) AS deuda_total
        FROM   cuotas cu
        JOIN   facturacion f ON f.deuda_id = cu.deuda_id
        WHERE  LOWER(cu.estado_cuota) NOT IN ('pagada', 'refinanciada')
          AND  cu.saldo_cuota > 0
          ${sf}
      `),

      // 8. Proyección de cobros: cuotas con vencimiento real (plan de pagos), ventanas acumuladas hacia adelante.
      // Excluye: sin fecha, vencidas, y cuotas placeholder al asignar N° de factura.
      prisma.$queryRawUnsafe<ProyecRow[]>(`
        SELECT
          COALESCE(SUM(CASE
            WHEN cu.fecha_vencimiento IS NOT NULL
             AND cu.fecha_vencimiento >= CURRENT_DATE
             AND cu.fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days'
            THEN cu.saldo_cuota ELSE 0 END), 0) AS d30,
          COALESCE(SUM(CASE
            WHEN cu.fecha_vencimiento IS NOT NULL
             AND cu.fecha_vencimiento >= CURRENT_DATE
             AND cu.fecha_vencimiento <= CURRENT_DATE + INTERVAL '60 days'
            THEN cu.saldo_cuota ELSE 0 END), 0) AS d60,
          COALESCE(SUM(CASE
            WHEN cu.fecha_vencimiento IS NOT NULL
             AND cu.fecha_vencimiento >= CURRENT_DATE
             AND cu.fecha_vencimiento <= CURRENT_DATE + INTERVAL '90 days'
            THEN cu.saldo_cuota ELSE 0 END), 0) AS d90,
          COALESCE(SUM(CASE
            WHEN cu.fecha_vencimiento IS NOT NULL
             AND cu.fecha_vencimiento >= CURRENT_DATE
             AND cu.fecha_vencimiento <= CURRENT_DATE + INTERVAL '120 days'
            THEN cu.saldo_cuota ELSE 0 END), 0) AS d120
        FROM   cuotas cu
        JOIN   facturacion f ON f.deuda_id = cu.deuda_id
        WHERE  LOWER(cu.estado_cuota) NOT IN ('pagada', 'refinanciada')
          AND  cu.saldo_cuota > 0
          AND  cu.fecha_vencimiento IS NOT NULL
          AND  cu.fecha_vencimiento >= CURRENT_DATE
          AND  COALESCE(cu.motivo_cambio, '') NOT ILIKE '%vencimiento inicial%'
          AND  LOWER(f.estado_deuda) = 'financiada'
          ${sf}
      `),

      // 9. Mix de deuda por tipo de servicio (saldo pendiente en facturación)
      prisma.$queryRawUnsafe<ServicioRow[]>(`
        SELECT COALESCE(NULLIF(TRIM(f.servicio), ''), 'Sin clasificar') AS servicio,
               COALESCE(SUM(f.saldo_pendiente), 0)                    AS monto
        FROM   facturacion f
        WHERE  ${FACTURA_ABIERTA_SQL}
          ${sf}
        GROUP  BY COALESCE(NULLIF(TRIM(f.servicio), ''), 'Sin clasificar')
        ORDER  BY monto DESC
      `),

      // 10. Cuentas críticas: top 20 aliados con mayor deuda vencida
      prisma.$queryRawUnsafe<CriticaRow[]>(`
        SELECT
          da.cod_aliado,
          da.brand                                      AS aliado_nombre,
          COALESCE(SUM(cu.saldo_cuota), 0)             AS deuda_vencida,
          MAX(CURRENT_DATE - cu.fecha_vencimiento)     AS dias_max,
          MAX(p.fecha_pago)                            AS ultima_fecha_pago
        FROM   cuotas cu
        JOIN   facturacion f  ON cu.deuda_id    = f.deuda_id
        JOIN   directorio_aliados da ON f.cod_aliado = da.cod_aliado
        LEFT   JOIN pagos p   ON p.cod_aliado   = da.cod_aliado AND p.estado_pago = 'Aplicado'
        WHERE  cu.fecha_vencimiento < CURRENT_DATE
          AND  LOWER(cu.estado_cuota) != 'pagada'
          AND  cu.saldo_cuota > 0
          ${sf}
        GROUP  BY da.cod_aliado, da.brand
        ORDER  BY deuda_vencida DESC
        LIMIT  20
      `),

      // 11. Próximos vencimientos: top 10 por monto en los próximos 30 días
      prisma.$queryRawUnsafe<VencimientoRow[]>(`
        SELECT
          cu.cuota_id,
          da.cod_aliado,
          da.brand                                      AS aliado_nombre,
          cu.saldo_cuota                               AS monto,
          cu.fecha_vencimiento::text                   AS fecha_vencimiento,
          (cu.fecha_vencimiento - CURRENT_DATE)::int   AS dias_restantes
        FROM   cuotas cu
        JOIN   facturacion f  ON cu.deuda_id    = f.deuda_id
        JOIN   directorio_aliados da ON f.cod_aliado = da.cod_aliado
        WHERE  cu.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
          AND  LOWER(cu.estado_cuota) != 'pagada'
          AND  cu.saldo_cuota > 0
          ${sf}
        ORDER  BY cu.saldo_cuota DESC
        LIMIT  10
      `),

      // 12. Pareto: todos los aliados con deuda pendiente para calcular concentración
      prisma.$queryRawUnsafe<ParetoRow[]>(`
        SELECT
          da.cod_aliado,
          da.brand                                      AS aliado_nombre,
          COALESCE(SUM(f.saldo_pendiente), 0)           AS deuda
        FROM   facturacion f
        JOIN   directorio_aliados da ON f.cod_aliado = da.cod_aliado
        WHERE  ${FACTURA_ABIERTA_SQL}
          ${sf}
        GROUP  BY da.cod_aliado, da.brand
        ORDER  BY deuda DESC
      `),

      // 12b. Aliados con deuda pendiente (conteo real, misma base que pareto)
      prisma.$queryRawUnsafe<{ total: bigint }[]>(`
        SELECT COUNT(DISTINCT f.cod_aliado) AS total
        FROM   facturacion f
        WHERE  ${FACTURA_ABIERTA_SQL}
          ${sf}
      `),

      // 13. Deudas con saldo pendiente sin número de factura asignado
      prisma.facturacion.count({
        where: {
          estado_deuda: { notIn: ['Pagada', 'Pagado', 'Anulada', 'Anulado'] },
          saldo_pendiente: { gt: 0 },
          OR: [
            { num_factura: null },
            { num_factura: '' },
          ],
          ...servicioWhere,
        },
      }),

      // 14. Compromisos de pago — histórico mensual apilado
      prisma.$queryRawUnsafe<CompromisoMesRow[]>(`
        ${COMPROMISO_CLASIFICADO_SQL},
        compromisos_filtrados AS (
          SELECT cc.*
          FROM   compromiso_clasificado cc
          JOIN   cuotas cu ON cu.cuota_id = cc.cuota_id
          JOIN   facturacion f ON f.deuda_id = cu.deuda_id
          WHERE  cc.mes >= ${periodStart}
            ${sf}
        )
        SELECT
          mes,
          COALESCE(SUM(CASE WHEN bucket = 'pagado_a_tiempo' THEN monto_promesa ELSE 0 END), 0) AS pagado_a_tiempo,
          COALESCE(SUM(CASE WHEN bucket = 'vencido'         THEN monto_promesa ELSE 0 END), 0) AS vencido,
          COALESCE(SUM(CASE WHEN bucket = 'pendiente'       THEN monto_promesa ELSE 0 END), 0) AS pendiente
        FROM compromisos_filtrados
        GROUP BY mes
        ORDER BY mes ASC
      `),

      // 15. Compromisos incumplidos — top 10 aliados por monto
      prisma.$queryRawUnsafe<IncumplidoRow[]>(`
        ${COMPROMISO_CLASIFICADO_SQL},
        incumplidos AS (
          SELECT
            da.cod_aliado,
            da.brand AS aliado_nombre,
            cc.monto_promesa
          FROM compromiso_clasificado cc
          JOIN cuotas cu ON cu.cuota_id = cc.cuota_id
          JOIN facturacion f ON f.deuda_id = cu.deuda_id
          JOIN directorio_aliados da ON da.cod_aliado = f.cod_aliado
          WHERE cc.bucket = 'vencido'
            ${sf}
        )
        SELECT
          cod_aliado,
          aliado_nombre,
          COALESCE(SUM(monto_promesa), 0) AS monto_incumplido,
          COUNT(*)::int                   AS cantidad_compromisos
        FROM incumplidos
        GROUP BY cod_aliado, aliado_nombre
        ORDER BY monto_incumplido DESC
        LIMIT 10
      `),

      // 16. Deuda pendiente por ejecutiva (mes en curso)
      prisma.$queryRawUnsafe<EjecutivaDeudaRow[]>(`
        SELECT
          COALESCE(ae.ejecutiva_nombre, 'Sin asignar') AS ejecutiva_nombre,
          COALESCE(SUM(f.saldo_pendiente), 0)          AS deuda
        FROM   facturacion f
        JOIN   directorio_aliados da ON da.cod_aliado = f.cod_aliado
        LEFT   JOIN aliado_ejecutiva_mensual ae
               ON ae.cod_aliado = da.cod_aliado
              AND ae.mes = DATE_TRUNC('month', CURRENT_DATE)::date
        WHERE  ${FACTURA_ABIERTA_SQL}
          ${sf}
        GROUP  BY ae.ejecutiva_nombre
        ORDER  BY deuda DESC
      `),

      // 17. Histórico de recobro por mes de vencimiento
      prisma.$queryRawUnsafe<HistoricoRecobroRow[]>(`
        SELECT
          DATE_TRUNC('month', cu.fecha_vencimiento)::date AS mes,
          COALESCE(SUM(cu.monto_cuota - cu.saldo_cuota), 0) AS pagado,
          COALESCE(SUM(CASE
            WHEN cu.saldo_cuota > 0 AND cu.fecha_vencimiento < CURRENT_DATE
            THEN cu.saldo_cuota ELSE 0 END), 0) AS vencido,
          COALESCE(SUM(CASE
            WHEN cu.saldo_cuota > 0 AND cu.fecha_vencimiento >= CURRENT_DATE
            THEN cu.saldo_cuota ELSE 0 END), 0) AS vigente
        FROM   cuotas cu
        JOIN   facturacion f ON f.deuda_id = cu.deuda_id
        WHERE  cu.fecha_vencimiento IS NOT NULL
          AND  LOWER(cu.estado_cuota) NOT IN ('refinanciada')
          AND  cu.fecha_vencimiento >= ${periodStart}
          AND  cu.fecha_vencimiento <  DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month')::date
          ${sf}
        GROUP  BY DATE_TRUNC('month', cu.fecha_vencimiento)
        ORDER  BY mes ASC
      `),

      // 18. Servicios disponibles (siempre sin filtro, para el dropdown)
      prisma.$queryRaw<{ servicio: string }[]>`
        SELECT DISTINCT COALESCE(NULLIF(TRIM(servicio), ''), 'Sin clasificar') AS servicio
        FROM   facturacion
        ORDER  BY servicio ASC
      `,
    ])

    // ── Derivados ──────────────────────────────────────────────────────────────

    const aging = agingRaw[0] ?? { al_dia: 0n, d1_30: 0n, d31_60: 0n, d61_90: 0n, mas_90: 0n }
    const mor   = morosidadRaw[0] ?? { deuda_vencida: 0n, deuda_total: 0n }
    const proy  = proyecRaw[0]    ?? { d30: 0n, d60: 0n, d90: 0n, d120: 0n }

    const deudaVencida    = n(mor.deuda_vencida)
    const deudaTotalCuota = n(mor.deuda_total)
    const tasaMorosidad   = deudaTotalCuota > 0 ? (deudaVencida / deudaTotalCuota) * 100 : 0

    // Pareto: concentración top-10
    const paretoOrdenado = paretoRaw.map(r => n(r.deuda))
    const totalPareto    = paretoOrdenado.reduce((s, v) => s + v, 0)
    const top10Deuda      = paretoOrdenado.slice(0, 10).reduce((s, v) => s + v, 0)
    const concentracionTop10 = totalPareto > 0 ? (top10Deuda / totalPareto) * 100 : 0
    const porcentajeResto    = totalPareto > 0 ? ((totalPareto - top10Deuda) / totalPareto) * 100 : 0

    // DSO: días promedio de cobro = (deuda vencida / cobrado en el período) × 365
    const cobradoPeriodo = n((totalCobrado as { total: bigint }[])[0]?.total)
    const dso          = cobradoPeriodo > 0 ? (deudaVencida / cobradoPeriodo) * 365 : 0

    // Pareto para gráfico: top 10 + "Resto"
    const paretoPuntos = paretoRaw.slice(0, 10).map((r, i) => ({
      cod_aliado: r.cod_aliado,
      aliado:     r.aliado_nombre,
      deuda:      n(r.deuda),
      acumulado:  totalPareto > 0
        ? (paretoRaw.slice(0, i + 1).reduce((s, x) => s + n(x.deuda), 0) / totalPareto) * 100
        : 0,
    }))
    if (paretoRaw.length > 10) {
      const restoDeuda = paretoRaw.slice(10).reduce((s, r) => s + n(r.deuda), 0)
      paretoPuntos.push({ cod_aliado: 'resto', aliado: 'Resto', deuda: restoDeuda, acumulado: 100 })
    }

    res.json({
      // ── Resumen ──
      aliadosActivos,
      aliadosConDeuda:       n(aliadosConDeudaRaw[0]?.total),
      deudaTotalPendiente:   n(deudaPendiente._sum.saldo_pendiente),
      totalCobrado:          cobradoPeriodo,
      aprobacionesPendientes,
      deudasSinFactura,

      filtros: {
        period:  filters.period,
        servicio: filters.servicio ?? 'todos',
      },

      serviciosDisponibles: serviciosDisponiblesRaw.map(r => r.servicio),

      // ── Riesgo ──
      deudaVencida,
      tasaMorosidad:         Math.round(tasaMorosidad * 10) / 10,
      concentracionTop10:    Math.round(concentracionTop10 * 10) / 10,
      porcentajeResto:       Math.round(porcentajeResto * 10) / 10,
      dso:                   Math.round(dso),

      // ── Proyección (cuotas con vencimiento a futuro, ventanas acumuladas) ──
      proyeccion: {
        d30:  n(proy.d30),
        d60:  n(proy.d60),
        d90:  n(proy.d90),
        d120: n(proy.d120),
      },

      historicoRecobro: historicoRecobroRaw.map((row: HistoricoRecobroRow) => ({
        mes:     (row.mes instanceof Date ? row.mes.toISOString() : String(row.mes)).slice(0, 7),
        pagado:  n(row.pagado),
        vencido: n(row.vencido),
        vigente: n(row.vigente),
      })),

      // ── Gráficos ──
      evolucion: evolucionRaw.map((row: MesRow) => ({
        mes:   mesIso(row),
        total: n(row.total),
      })),

      compromisosHistorico: compromisosHistoricoRaw.map((row: CompromisoMesRow) => ({
        mes:            mesIso(row),
        pagadoATiempo:  n(row.pagado_a_tiempo),
        vencido:        n(row.vencido),
        pendiente:      n(row.pendiente),
      })),

      aging: {
        alDia:  n(aging.al_dia),
        d1_30:  n(aging.d1_30),
        d31_60: n(aging.d31_60),
        d61_90: n(aging.d61_90),
        mas90:  n(aging.mas_90),
      },

      mixServicio: servicioRaw.map((r: ServicioRow) => ({
        servicio: r.servicio ?? 'Sin clasificar',
        monto:    n(r.monto),
      })),

      pareto: paretoPuntos,

      compromisosIncumplidos: compromisosIncumplidosRaw.map((r: IncumplidoRow) => ({
        cod_aliado:           r.cod_aliado,
        aliado_nombre:        r.aliado_nombre,
        monto_incumplido:     n(r.monto_incumplido),
        cantidad_compromisos: Number(r.cantidad_compromisos),
      })),

      deudaPorEjecutiva: deudaPorEjecutivaRaw.map((r: EjecutivaDeudaRow) => ({
        ejecutiva_nombre: r.ejecutiva_nombre,
        deuda:            n(r.deuda),
      })),

      // ── Tablas ──
      cuentasCriticas: criticasRaw.map((r: CriticaRow) => ({
        cod_aliado:       r.cod_aliado,
        aliado_nombre:    r.aliado_nombre,
        deuda_vencida:    n(r.deuda_vencida),
        dias_max:         Number(r.dias_max ?? 0),
        ultima_fecha_pago: r.ultima_fecha_pago
          ? (r.ultima_fecha_pago instanceof Date
            ? r.ultima_fecha_pago.toISOString().slice(0, 10)
            : String(r.ultima_fecha_pago).slice(0, 10))
          : null,
      })),

      proximosVencimientos: vencimientosRaw.map((r: VencimientoRow) => ({
        cuota_id:          r.cuota_id,
        cod_aliado:        r.cod_aliado,
        aliado_nombre:     r.aliado_nombre,
        monto:             n(r.monto),
        fecha_vencimiento: typeof r.fecha_vencimiento === 'string'
          ? r.fecha_vencimiento.slice(0, 10)
          : r.fecha_vencimiento instanceof Date
            ? r.fecha_vencimiento.toISOString().slice(0, 10)
            : String(r.fecha_vencimiento),
        dias_restantes: Number(r.dias_restantes),
      })),
    })
  } catch (err) {
    console.error('[getDashboardStats]', err)
    res.status(500).json({ message: 'Error al obtener estadísticas del dashboard.' })
  }
}
