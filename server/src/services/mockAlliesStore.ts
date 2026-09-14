import { randomUUID } from 'node:crypto'

// ─── Types (mirrors src/types/allyDebt.ts) ───────────────────────────────────

export interface AliadoRecord {
  aliado_id: string
  aliado_nombre: string
  ruc?: string
  codigo_persona?: string
  estado: string
  fecha_alta?: string
}

export interface FacturaRecord {
  factura_id: string
  aliado_id: string
  cant_cuotas?: number
  num_factura?: string
  periodo?: string
  fecha_deuda?: string
  monto_neto: number
  tipo_factura?: string
  servicio?: string
  estado_factura: string
  saldo_factura: number
  observacion?: string
}

export interface CuotaRecord {
  cuota_id: string
  factura_id: string
  numero_cuota: number
  monto_cuota: number
  fecha_vencimiento: string
  estado_cuota: string
  saldo_cuota: number
  observacion?: string
}

export interface PagoRecord {
  pago_id: string
  factura_id: string
  fecha_pago: string
  monto_pagado: number
  medio_pago?: string
  referencia?: string
  observacion?: string
}

export interface CompromisosRecord {
  compromiso_id: string
  cuota_id: string
  fecha_compromiso: string
  monto_compromiso: number
  estado_compromiso: string
  observacion?: string
}

export type EstadoGeneralDeuda = 'sin_deuda' | 'pendiente' | 'parcial' | 'pagado' | 'con_vencimiento'

// ─── Seed data ────────────────────────────────────────────────────────────────

let allies: AliadoRecord[] = [
  { aliado_id: 'A-001', aliado_nombre: 'Maxifarma Encarnacion', ruc: '80012345-1', codigo_persona: 'P-001', estado: 'activo', fecha_alta: '2024-01-15' },
  { aliado_id: 'A-002', aliado_nombre: 'Bacon',                 ruc: '80023456-2', codigo_persona: 'P-002', estado: 'activo', fecha_alta: '2024-02-10' },
  { aliado_id: 'A-003', aliado_nombre: 'Starbucks',             ruc: '80034567-3', codigo_persona: 'P-003', estado: 'activo', fecha_alta: '2024-03-01' },
  { aliado_id: 'A-004', aliado_nombre: 'Burguer King',          ruc: '80045678-4', codigo_persona: 'P-004', estado: 'activo', fecha_alta: '2024-03-15' },
  { aliado_id: 'A-005', aliado_nombre: 'Pizza Hut',             ruc: '80056789-5', codigo_persona: 'P-005', estado: 'activo', fecha_alta: '2024-04-01' },
  { aliado_id: 'A-006', aliado_nombre: 'Don Vito',              ruc: '80067890-6', codigo_persona: 'P-006', estado: 'activo', fecha_alta: '2024-04-20' },
  { aliado_id: 'A-007', aliado_nombre: 'Lomy',                  ruc: '80078901-7', codigo_persona: 'P-007', estado: 'activo', fecha_alta: '2024-05-01' },
]

let facturas: FacturaRecord[] = [
  { factura_id: 'F-1001', aliado_id: 'A-001', periodo: 'Abril 2026',       fecha_deuda: '2026-04-12', monto_neto: 4500000, tipo_factura: 'Publicidad digital', estado_factura: 'parcial',   saldo_factura: 3000000, observacion: 'Plan especial de abril.' },
  { factura_id: 'F-1007', aliado_id: 'A-001', periodo: 'Marzo 2026',       fecha_deuda: '2026-03-01', monto_neto:  800000, tipo_factura: 'Publicidad digital', estado_factura: 'pagado',    saldo_factura:       0, observacion: 'Servicio de marzo cancelado.' },
  { factura_id: 'F-1002', aliado_id: 'A-002', periodo: 'Mayo 2026',        fecha_deuda: '2026-05-05', monto_neto: 1800000, tipo_factura: 'Publicidad digital', estado_factura: 'pendiente', saldo_factura: 1800000, observacion: 'Pendiente de primer pago.' },
  { factura_id: 'F-1003', aliado_id: 'A-003', periodo: 'Mayo 2026',        fecha_deuda: '2026-05-20', monto_neto: 2200000, tipo_factura: 'Publicidad digital', estado_factura: 'pendiente', saldo_factura: 2200000, observacion: 'Pago unico acordado.' },
  { factura_id: 'F-1004', aliado_id: 'A-004', periodo: 'Marzo-Junio 2026', fecha_deuda: '2026-03-15', monto_neto: 6000000, tipo_factura: 'Publicidad digital', estado_factura: 'parcial',   saldo_factura: 3000000, observacion: 'Acuerdo trimestral. Mitad abonada.' },
  { factura_id: 'F-1005', aliado_id: 'A-005', periodo: 'Junio 2026',       fecha_deuda: '2026-06-01', monto_neto: 9000000, tipo_factura: 'Publicidad digital', estado_factura: 'pendiente', saldo_factura: 9000000, observacion: 'Primer acuerdo del aliado. Sin pagos aun.' },
  { factura_id: 'F-1006', aliado_id: 'A-006', periodo: 'Mayo 2026',        fecha_deuda: '2026-05-01', monto_neto: 3500000, tipo_factura: 'Publicidad digital', estado_factura: 'pendiente', saldo_factura: 3500000, observacion: 'Acuerdo reciente. Sin pagos registrados.' },
  { factura_id: 'F-1008', aliado_id: 'A-007', periodo: 'Abril-Mayo 2026',  fecha_deuda: '2026-04-01', monto_neto: 2600000, tipo_factura: 'Publicidad digital', estado_factura: 'parcial',   saldo_factura: 2000000, observacion: 'Primera cuota abonada parcialmente.' },
]

let cuotas: CuotaRecord[] = [
  { cuota_id: 'C-2001', factura_id: 'F-1001', numero_cuota: 1, fecha_vencimiento: '2026-05-01', monto_cuota: 1500000, estado_cuota: 'pagada',   saldo_cuota:       0 },
  { cuota_id: 'C-2002', factura_id: 'F-1001', numero_cuota: 2, fecha_vencimiento: '2026-06-01', monto_cuota: 1500000, estado_cuota: 'pendiente', saldo_cuota: 1500000 },
  { cuota_id: 'C-2003', factura_id: 'F-1001', numero_cuota: 3, fecha_vencimiento: '2026-07-01', monto_cuota: 1500000, estado_cuota: 'pendiente', saldo_cuota: 1500000 },
  { cuota_id: 'C-2011', factura_id: 'F-1007', numero_cuota: 1, fecha_vencimiento: '2026-03-31', monto_cuota:  800000, estado_cuota: 'pagada',   saldo_cuota:       0 },
  { cuota_id: 'C-2004', factura_id: 'F-1002', numero_cuota: 1, fecha_vencimiento: '2026-06-15', monto_cuota:  900000, estado_cuota: 'pendiente', saldo_cuota:  900000 },
  { cuota_id: 'C-2005', factura_id: 'F-1002', numero_cuota: 2, fecha_vencimiento: '2026-07-15', monto_cuota:  900000, estado_cuota: 'pendiente', saldo_cuota:  900000 },
  { cuota_id: 'C-2006', factura_id: 'F-1003', numero_cuota: 1, fecha_vencimiento: '2026-06-30', monto_cuota: 2200000, estado_cuota: 'pendiente', saldo_cuota: 2200000 },
  { cuota_id: 'C-2007', factura_id: 'F-1004', numero_cuota: 1, fecha_vencimiento: '2026-04-01', monto_cuota: 1500000, estado_cuota: 'pagada',   saldo_cuota:       0 },
  { cuota_id: 'C-2008', factura_id: 'F-1004', numero_cuota: 2, fecha_vencimiento: '2026-05-01', monto_cuota: 1500000, estado_cuota: 'pagada',   saldo_cuota:       0 },
  { cuota_id: 'C-2009', factura_id: 'F-1004', numero_cuota: 3, fecha_vencimiento: '2026-06-01', monto_cuota: 1500000, estado_cuota: 'pendiente', saldo_cuota: 1500000 },
  { cuota_id: 'C-2010', factura_id: 'F-1004', numero_cuota: 4, fecha_vencimiento: '2026-07-01', monto_cuota: 1500000, estado_cuota: 'pendiente', saldo_cuota: 1500000 },
  { cuota_id: 'C-2012', factura_id: 'F-1005', numero_cuota: 1, fecha_vencimiento: '2026-07-01', monto_cuota: 3000000, estado_cuota: 'pendiente', saldo_cuota: 3000000 },
  { cuota_id: 'C-2013', factura_id: 'F-1005', numero_cuota: 2, fecha_vencimiento: '2026-08-01', monto_cuota: 3000000, estado_cuota: 'pendiente', saldo_cuota: 3000000 },
  { cuota_id: 'C-2014', factura_id: 'F-1005', numero_cuota: 3, fecha_vencimiento: '2026-09-01', monto_cuota: 3000000, estado_cuota: 'pendiente', saldo_cuota: 3000000 },
  { cuota_id: 'C-2015', factura_id: 'F-1006', numero_cuota: 1, fecha_vencimiento: '2026-06-15', monto_cuota: 1750000, estado_cuota: 'pendiente', saldo_cuota: 1750000 },
  { cuota_id: 'C-2016', factura_id: 'F-1006', numero_cuota: 2, fecha_vencimiento: '2026-07-15', monto_cuota: 1750000, estado_cuota: 'pendiente', saldo_cuota: 1750000 },
  { cuota_id: 'C-2017', factura_id: 'F-1008', numero_cuota: 1, fecha_vencimiento: '2026-05-01', monto_cuota: 1300000, estado_cuota: 'parcial',   saldo_cuota:  700000 },
  { cuota_id: 'C-2018', factura_id: 'F-1008', numero_cuota: 2, fecha_vencimiento: '2026-06-01', monto_cuota: 1300000, estado_cuota: 'pendiente', saldo_cuota: 1300000 },
]

let pagos: PagoRecord[] = [
  { pago_id: 'P-3001', factura_id: 'F-1001', fecha_pago: '2026-05-01', monto_pagado: 1500000, medio_pago: 'Transferencia', referencia: 'TRX-15001', observacion: 'Pago inicial confirmado.' },
  { pago_id: 'P-3002', factura_id: 'F-1007', fecha_pago: '2026-03-30', monto_pagado:  800000, medio_pago: 'Transferencia', referencia: 'TRX-14880', observacion: 'Servicio de marzo cancelado.' },
  { pago_id: 'P-3003', factura_id: 'F-1004', fecha_pago: '2026-04-02', monto_pagado: 1500000, medio_pago: 'Cheque',        referencia: 'TRX-16200', observacion: 'Primera cuota abonada.' },
  { pago_id: 'P-3004', factura_id: 'F-1004', fecha_pago: '2026-05-03', monto_pagado: 1500000, medio_pago: 'Transferencia', referencia: 'TRX-16450', observacion: 'Segunda cuota abonada.' },
  { pago_id: 'P-3005', factura_id: 'F-1008', fecha_pago: '2026-05-05', monto_pagado:  600000, medio_pago: 'Transferencia', referencia: 'TRX-17100', observacion: 'Abono parcial de primera cuota.' },
]

let compromisos: CompromisosRecord[] = [
  { compromiso_id: 'K-001', cuota_id: 'C-2002', fecha_compromiso: '2026-06-01', monto_compromiso: 1500000, estado_compromiso: 'pendiente', observacion: 'Compromiso acordado con el aliado.' },
  { compromiso_id: 'K-002', cuota_id: 'C-2004', fecha_compromiso: '2026-06-15', monto_compromiso:  900000, estado_compromiso: 'pendiente', observacion: '' },
  { compromiso_id: 'K-003', cuota_id: 'C-2006', fecha_compromiso: '2026-06-30', monto_compromiso: 2200000, estado_compromiso: 'pendiente', observacion: 'Pago unico comprometido.' },
  { compromiso_id: 'K-004', cuota_id: 'C-2009', fecha_compromiso: '2026-06-01', monto_compromiso: 1500000, estado_compromiso: 'pendiente', observacion: '' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeEstadoGeneral(
  saldoPendiente: number,
  deudaTotal: number,
  tieneCuotaVencida = false,
): EstadoGeneralDeuda {
  if (deudaTotal <= 0)             return 'sin_deuda'
  if (saldoPendiente <= 0)         return 'pagado'
  if (tieneCuotaVencida)           return 'con_vencimiento'
  if (saldoPendiente < deudaTotal) return 'parcial'
  return 'pendiente'
}

function computeSummary(aliadoId: string) {
  const allyFacturas = facturas.filter((f) => f.aliado_id === aliadoId)
  const activa = allyFacturas.find((f) => f.estado_factura !== 'pagado') ?? allyFacturas[0]
  const deuda_total = allyFacturas.reduce((s, f) => s + f.monto_neto, 0)
  const saldo_pendiente = allyFacturas.reduce((s, f) => s + f.saldo_factura, 0)
  return {
    deuda_activa_id: activa?.factura_id ?? '',
    deuda_total,
    monto_total_pagado: deuda_total - saldo_pendiente,
    saldo_pendiente,
    servicio: activa?.servicio ?? '',
    ultimo_periodo: activa?.periodo,
  }
}

function parsePeriodRank(period?: string): number {
  if (!period) return 0
  const n = period.toLowerCase()
  const years = [...n.matchAll(/(20\d{2})/g)]
  const year = years.length > 0 ? Number(years[years.length - 1][1]) : 0
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','setiembre','octubre','noviembre','diciembre']
  let month = 0
  months.forEach((m, i) => { if (n.includes(m)) month = Math.max(month, m === 'setiembre' ? 9 : i + 1) })
  const ym = n.match(/(20\d{2})-(0[1-9]|1[0-2])/)
  if (ym) month = Math.max(month, Number(ym[2]))
  return year * 100 + month
}

// ─── Public query functions ───────────────────────────────────────────────────

export interface AliadosListQuery {
  page?: number
  pageSize?: number
  name?: string
  debtStatus?: 'all' | EstadoGeneralDeuda
  allyStatus?: 'all' | 'activo' | 'inactivo'
  periodOrder?: 'recent' | 'oldest'
}

export function listAllies(query: AliadosListQuery = {}) {
  const page       = Math.max(1, Number(query.page)     || 1)
  const pageSize   = Math.max(1, Number(query.pageSize) || 50)
  const name       = query.name        ?? ''
  const debtStatus = query.debtStatus  ?? 'all'
  const allyStatus = query.allyStatus  ?? 'all'
  const order      = query.periodOrder ?? 'recent'

  const items = allies.map((ally) => {
    const summary = computeSummary(ally.aliado_id)
    return {
      aliado_id:          ally.aliado_id,
      aliado_nombre:      ally.aliado_nombre,
      codigo_persona:     ally.codigo_persona,
      estado:             ally.estado,
      estado_general:     computeEstadoGeneral(summary.saldo_pendiente, summary.deuda_total),
      ruc:                ally.ruc,
      ...summary,
    }
  })

  const filtered = items.filter((a) => {
    const matchName  = name        ? a.aliado_nombre.toLowerCase().includes(name.toLowerCase()) : true
    const matchDebt  = debtStatus  === 'all' || a.estado_general === debtStatus
    const matchAlly  = allyStatus  === 'all' || String(a.estado).toLowerCase() === allyStatus
    return matchName && matchDebt && matchAlly
  })

  const sorted = [...filtered].sort((a, b) => {
    const aRank = parsePeriodRank(a.ultimo_periodo)
    const bRank = parsePeriodRank(b.ultimo_periodo)
    return order === 'oldest' ? aRank - bRank : bRank - aRank
  })

  const total      = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage   = Math.min(page, totalPages)
  const start      = (safePage - 1) * pageSize

  return { items: sorted.slice(start, start + pageSize), page: safePage, pageSize, total, totalPages }
}

export function getAllyDetail(aliadoId: string) {
  const ally = allies.find((a) => a.aliado_id === aliadoId)
  if (!ally) return null

  const allyFacturas  = facturas.filter((f) => f.aliado_id === aliadoId)
  const facturaIds    = new Set(allyFacturas.map((f) => f.factura_id))
  const allyCuotas    = cuotas.filter((c) => facturaIds.has(c.factura_id))
  const cuotaIds      = new Set(allyCuotas.map((c) => c.cuota_id))
  const allyComproms  = compromisos.filter((k) => cuotaIds.has(k.cuota_id))
  const allyPagos     = pagos.filter((p) => facturaIds.has(p.factura_id))
  const summary       = computeSummary(aliadoId)

  return { aliado: ally, compromisos: allyComproms, cuotas: allyCuotas, facturas: allyFacturas, pagos: allyPagos, resumen: summary }
}

// ─── Mutation functions ───────────────────────────────────────────────────────

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

export function createFactura(input: CrearFacturaInput) {
  const ally = allies.find((a) => a.aliado_id === input.aliadoId)
  if (!ally) return null

  const facturaId = `F-${randomUUID().slice(0, 8)}`
  const today = new Date().toISOString().slice(0, 10)

  const nuevaFactura: FacturaRecord = {
    aliado_id:      input.aliadoId,
    estado_factura: 'pendiente',
    factura_id:     facturaId,
    fecha_deuda:    input.fechaDeuda ?? today,
    monto_neto:     input.montoNeto,
    num_factura:    input.numFactura,
    observacion:    input.observacion,
    periodo:        input.periodo,
    saldo_factura:  input.montoNeto,
    servicio:       input.servicio,
    tipo_factura:   input.tipoFactura,
  }

  facturas = [...facturas, nuevaFactura]

  const nuevasCuotas: CuotaRecord[] = (input.cuotas ?? []).map((c, i) => ({
    cuota_id:          `C-${randomUUID().slice(0, 8)}-${i + 1}`,
    estado_cuota:      'pendiente',
    factura_id:        facturaId,
    fecha_vencimiento: c.fecha_vencimiento,
    monto_cuota:       c.monto_cuota,
    numero_cuota:      c.numero_cuota,
    saldo_cuota:       c.monto_cuota,
  }))

  cuotas = [...cuotas, ...nuevasCuotas]

  return { cuotas: nuevasCuotas, factura: nuevaFactura }
}

export interface RegistrarPagoInput {
  facturaId: string
  cuotaId?: string
  fechaPago: string
  montoPagado: number
  medioPago?: string
  referencia?: string
  observacion?: string
}

export function registrarPago(input: RegistrarPagoInput) {
  const factura = facturas.find((f) => f.factura_id === input.facturaId)
  if (!factura) return null

  const monto = Number(input.montoPagado)

  if (input.cuotaId) {
    const cuota = cuotas.find((c) => c.cuota_id === input.cuotaId)
    if (cuota) {
      const nuevoSaldo = Math.max(0, Number(cuota.saldo_cuota) - monto)
      cuota.saldo_cuota  = nuevoSaldo
      cuota.estado_cuota = nuevoSaldo <= 0 ? 'pagada' : nuevoSaldo < cuota.monto_cuota ? 'parcial' : 'pendiente'
    }
  } else {
    let restante = monto
    const cuotasOrdenadas = cuotas
      .filter((c) => c.factura_id === input.facturaId)
      .sort((a, b) => a.numero_cuota - b.numero_cuota)

    for (const cuota of cuotasOrdenadas) {
      if (restante <= 0) break
      const saldoActual = Math.max(0, Number(cuota.saldo_cuota))
      if (saldoActual <= 0) continue
      const aplicado     = Math.min(restante, saldoActual)
      const nuevoSaldo   = Math.max(0, saldoActual - aplicado)
      cuota.saldo_cuota  = nuevoSaldo
      cuota.estado_cuota = nuevoSaldo <= 0 ? 'pagada' : nuevoSaldo < cuota.monto_cuota ? 'parcial' : 'pendiente'
      restante -= aplicado
    }
  }

  factura.saldo_factura  = Math.max(0, factura.saldo_factura - monto)
  factura.estado_factura =
    factura.saldo_factura <= 0 ? 'pagado'
    : factura.saldo_factura < factura.monto_neto ? 'parcial'
    : 'pendiente'

  const nuevoPago: PagoRecord = {
    factura_id:   input.facturaId,
    fecha_pago:   input.fechaPago,
    medio_pago:   input.medioPago,
    monto_pagado: monto,
    observacion:  input.observacion,
    pago_id:      `P-${randomUUID().slice(0, 8)}`,
    referencia:   input.referencia,
  }

  pagos = [nuevoPago, ...pagos]

  return { factura, pago: nuevoPago }
}
