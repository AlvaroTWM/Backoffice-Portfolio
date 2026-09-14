import { SERVICIOS_TIPO } from '../types/allyDebt'
import type {
  AgregarCuotaPayload,
  AsignarNumFacturaPayload,
  ActualizarServicioPayload,
  AliadoDetalle,
  AliadoRecord,
  AliadoResumen,
  CompromisosRecord,
  CrearCompromisoPayload,
  CrearFacturaPayload,
  CuotaRecord,
  EstadoGeneralDeuda,
  FacturaRecord,
  ImportarDeudasPayload,
  ImportarDeudasResult,
  PagoRecord,
  RegistrarPagoPayload,
} from '../types/allyDebt'
import type { AuthUser } from '../types/auth'

const localSessionUser: AuthUser = {
  email: 'ana.demo@portfolio.local',
  id: 'local-dev-001',
  name: 'Ana Demo',
  role: 'alianzas',
}

const mockAlliesBase: AliadoRecord[] = [
  { aliado_id: 'A-001', aliado_nombre: 'Maxifarma Encarnacion', ruc: '80012345-1', codigo_persona: 'P-001', estado: 'activo', fecha_alta: '2024-01-15' },
  { aliado_id: 'A-002', aliado_nombre: 'Bacon',                 ruc: '80023456-2', codigo_persona: 'P-002', estado: 'activo', fecha_alta: '2024-02-10' },
  { aliado_id: 'A-003', aliado_nombre: 'Starbucks',             ruc: '80034567-3', codigo_persona: 'P-003', estado: 'activo', fecha_alta: '2024-03-01' },
  { aliado_id: 'A-004', aliado_nombre: 'Burguer King',          ruc: '80045678-4', codigo_persona: 'P-004', estado: 'activo', fecha_alta: '2024-03-15' },
  { aliado_id: 'A-005', aliado_nombre: 'Pizza Hut',             ruc: '80056789-5', codigo_persona: 'P-005', estado: 'activo', fecha_alta: '2024-04-01' },
  { aliado_id: 'A-006', aliado_nombre: 'Don Vito',              ruc: '80067890-6', codigo_persona: 'P-006', estado: 'activo', fecha_alta: '2024-04-20' },
  { aliado_id: 'A-007', aliado_nombre: 'Lomy',                  ruc: '80078901-7', codigo_persona: 'P-007', estado: 'activo', fecha_alta: '2024-05-01' },
]

let mockFacturas: FacturaRecord[] = [
  // A-001
  { factura_id: 'F-1001', aliado_id: 'A-001', periodo: 'Abril 2026',       fecha_deuda: '2026-04-12', monto_neto: 4500000, tipo_factura: 'Publicidad digital', estado_factura: 'parcial',   saldo_factura: 3000000, observacion: 'Plan especial de abril.' },
  { factura_id: 'F-1007', aliado_id: 'A-001', periodo: 'Marzo 2026',       fecha_deuda: '2026-03-01', monto_neto:  800000, tipo_factura: 'Publicidad digital', estado_factura: 'pagado',    saldo_factura:       0, observacion: 'Servicio de marzo cancelado.' },
  // A-002
  { factura_id: 'F-1002', aliado_id: 'A-002', periodo: 'Mayo 2026',        fecha_deuda: '2026-05-05', monto_neto: 1800000, tipo_factura: 'Publicidad digital', estado_factura: 'pendiente', saldo_factura: 1800000, observacion: 'Pendiente de primer pago.' },
  // A-003
  { factura_id: 'F-1003', aliado_id: 'A-003', periodo: 'Mayo 2026',        fecha_deuda: '2026-05-20', monto_neto: 2200000, tipo_factura: 'Publicidad digital', estado_factura: 'pendiente', saldo_factura: 2200000, observacion: 'Pago unico acordado.' },
  // A-004
  { factura_id: 'F-1004', aliado_id: 'A-004', periodo: 'Marzo-Junio 2026', fecha_deuda: '2026-03-15', monto_neto: 6000000, tipo_factura: 'Publicidad digital', estado_factura: 'parcial',   saldo_factura: 3000000, observacion: 'Acuerdo trimestral. Mitad abonada.' },
  // A-005
  { factura_id: 'F-1005', aliado_id: 'A-005', periodo: 'Junio 2026',       fecha_deuda: '2026-06-01', monto_neto: 9000000, tipo_factura: 'Publicidad digital', estado_factura: 'pendiente', saldo_factura: 9000000, observacion: 'Primer acuerdo del aliado. Sin pagos aun.' },
  // A-006
  { factura_id: 'F-1006', aliado_id: 'A-006', periodo: 'Mayo 2026',        fecha_deuda: '2026-05-01', monto_neto: 3500000, tipo_factura: 'Publicidad digital', estado_factura: 'pendiente', saldo_factura: 3500000, observacion: 'Acuerdo reciente. Sin pagos registrados.' },
  // A-007
  { factura_id: 'F-1008', aliado_id: 'A-007', periodo: 'Abril-Mayo 2026',  fecha_deuda: '2026-04-01', monto_neto: 2600000, tipo_factura: 'Publicidad digital', estado_factura: 'parcial',   saldo_factura: 2000000, observacion: 'Primera cuota abonada parcialmente.' },
]

let mockCuotas: CuotaRecord[] = [
  // F-1001 (A-001)
  { cuota_id: 'C-2001', factura_id: 'F-1001', numero_cuota: 1, fecha_vencimiento: '2026-05-01', monto_cuota: 1500000, estado_cuota: 'pagada',   saldo_cuota:       0 },
  { cuota_id: 'C-2002', factura_id: 'F-1001', numero_cuota: 2, fecha_vencimiento: '2026-06-01', monto_cuota: 1500000, estado_cuota: 'pendiente', saldo_cuota: 1500000 },
  { cuota_id: 'C-2003', factura_id: 'F-1001', numero_cuota: 3, fecha_vencimiento: '2026-07-01', monto_cuota: 1500000, estado_cuota: 'pendiente', saldo_cuota: 1500000 },
  // F-1007 (A-001)
  { cuota_id: 'C-2011', factura_id: 'F-1007', numero_cuota: 1, fecha_vencimiento: '2026-03-31', monto_cuota:  800000, estado_cuota: 'pagada',   saldo_cuota:       0 },
  // F-1002 (A-002)
  { cuota_id: 'C-2004', factura_id: 'F-1002', numero_cuota: 1, fecha_vencimiento: '2026-06-15', monto_cuota:  900000, estado_cuota: 'pendiente', saldo_cuota:  900000 },
  { cuota_id: 'C-2005', factura_id: 'F-1002', numero_cuota: 2, fecha_vencimiento: '2026-07-15', monto_cuota:  900000, estado_cuota: 'pendiente', saldo_cuota:  900000 },
  // F-1003 (A-003)
  { cuota_id: 'C-2006', factura_id: 'F-1003', numero_cuota: 1, fecha_vencimiento: '2026-06-30', monto_cuota: 2200000, estado_cuota: 'pendiente', saldo_cuota: 2200000 },
  // F-1004 (A-004)
  { cuota_id: 'C-2007', factura_id: 'F-1004', numero_cuota: 1, fecha_vencimiento: '2026-04-01', monto_cuota: 1500000, estado_cuota: 'pagada',   saldo_cuota:       0 },
  { cuota_id: 'C-2008', factura_id: 'F-1004', numero_cuota: 2, fecha_vencimiento: '2026-05-01', monto_cuota: 1500000, estado_cuota: 'pagada',   saldo_cuota:       0 },
  { cuota_id: 'C-2009', factura_id: 'F-1004', numero_cuota: 3, fecha_vencimiento: '2026-06-01', monto_cuota: 1500000, estado_cuota: 'pendiente', saldo_cuota: 1500000 },
  { cuota_id: 'C-2010', factura_id: 'F-1004', numero_cuota: 4, fecha_vencimiento: '2026-07-01', monto_cuota: 1500000, estado_cuota: 'pendiente', saldo_cuota: 1500000 },
  // F-1005 (A-005)
  { cuota_id: 'C-2012', factura_id: 'F-1005', numero_cuota: 1, fecha_vencimiento: '2026-07-01', monto_cuota: 3000000, estado_cuota: 'pendiente', saldo_cuota: 3000000 },
  { cuota_id: 'C-2013', factura_id: 'F-1005', numero_cuota: 2, fecha_vencimiento: '2026-08-01', monto_cuota: 3000000, estado_cuota: 'pendiente', saldo_cuota: 3000000 },
  { cuota_id: 'C-2014', factura_id: 'F-1005', numero_cuota: 3, fecha_vencimiento: '2026-09-01', monto_cuota: 3000000, estado_cuota: 'pendiente', saldo_cuota: 3000000 },
  // F-1006 (A-006)
  { cuota_id: 'C-2015', factura_id: 'F-1006', numero_cuota: 1, fecha_vencimiento: '2026-06-15', monto_cuota: 1750000, estado_cuota: 'pendiente', saldo_cuota: 1750000 },
  { cuota_id: 'C-2016', factura_id: 'F-1006', numero_cuota: 2, fecha_vencimiento: '2026-07-15', monto_cuota: 1750000, estado_cuota: 'pendiente', saldo_cuota: 1750000 },
  // F-1008 (A-007)
  { cuota_id: 'C-2017', factura_id: 'F-1008', numero_cuota: 1, fecha_vencimiento: '2026-05-01', monto_cuota: 1300000, estado_cuota: 'parcial',   saldo_cuota:  700000 },
  { cuota_id: 'C-2018', factura_id: 'F-1008', numero_cuota: 2, fecha_vencimiento: '2026-06-01', monto_cuota: 1300000, estado_cuota: 'pendiente', saldo_cuota: 1300000 },
]

let mockPagos: PagoRecord[] = [
  { pago_id: 'P-3001', factura_id: 'F-1001', fecha_pago: '2026-05-01', monto_pagado: 1500000, medio_pago: 'Transferencia', referencia: 'TRX-15001', observacion: 'Pago inicial confirmado por tesoreria.' },
  { pago_id: 'P-3002', factura_id: 'F-1007', fecha_pago: '2026-03-30', monto_pagado:  800000, medio_pago: 'Transferencia', referencia: 'TRX-14880', observacion: 'Servicio de marzo cancelado en su totalidad.' },
  { pago_id: 'P-3003', factura_id: 'F-1004', fecha_pago: '2026-04-02', monto_pagado: 1500000, medio_pago: 'Cheque',        referencia: 'TRX-16200', observacion: 'Primera cuota abonada segun acuerdo.' },
  { pago_id: 'P-3004', factura_id: 'F-1004', fecha_pago: '2026-05-03', monto_pagado: 1500000, medio_pago: 'Transferencia', referencia: 'TRX-16450', observacion: 'Segunda cuota abonada.' },
  { pago_id: 'P-3005', factura_id: 'F-1008', fecha_pago: '2026-05-05', monto_pagado:  600000, medio_pago: 'Transferencia', referencia: 'TRX-17100', observacion: 'Abono parcial de primera cuota.' },
]

let mockCompromisos: CompromisosRecord[] = [
  { compromiso_id: 'K-001', cuota_id: 'C-2002', fecha_compromiso: '2026-06-01', monto_compromiso: 1500000, estado_compromiso: 'pendiente', observacion: 'Compromiso acordado con el aliado.' },
  { compromiso_id: 'K-002', cuota_id: 'C-2004', fecha_compromiso: '2026-06-15', monto_compromiso:  900000, estado_compromiso: 'pendiente', observacion: '' },
  { compromiso_id: 'K-003', cuota_id: 'C-2006', fecha_compromiso: '2026-06-30', monto_compromiso: 2200000, estado_compromiso: 'pendiente', observacion: 'Pago unico comprometido.' },
  { compromiso_id: 'K-004', cuota_id: 'C-2009', fecha_compromiso: '2026-06-01', monto_compromiso: 1500000, estado_compromiso: 'pendiente', observacion: '' },
]

let localDebtSeq = 2000000

function computeSummary(aliadoId: string) {
  const facturas = mockFacturas.filter((f) => String(f.aliado_id) === aliadoId)
  const activa = facturas.find((f) => f.estado_factura !== 'pagado') ?? facturas[0]
  const deuda_total = facturas.reduce((s, f) => s + f.monto_neto, 0)
  const saldo_pendiente = facturas.reduce((s, f) => s + f.saldo_factura, 0)
  return {
    deuda_total,
    deuda_activa_id:    activa?.deuda_id || activa?.factura_id || '',
    monto_total_pagado: deuda_total - saldo_pendiente,
    saldo_pendiente,
    servicio:          activa?.servicio || '',
    ultimo_periodo:     activa?.periodo,
  }
}

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

export async function getLocalSessionContext() {
  await new Promise((resolve) => window.setTimeout(resolve, 160))
  return localSessionUser
}

export async function listarAliadosLocal(): Promise<AliadoResumen[]> {
  await new Promise((resolve) => window.setTimeout(resolve, 220))
  return mockAlliesBase.map((ally) => {
    const summary = computeSummary(String(ally.aliado_id))
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
}

export async function obtenerDetalleAliadoLocal(aliadoId: string | number): Promise<AliadoDetalle> {
  await new Promise((resolve) => window.setTimeout(resolve, 180))
  const ally = mockAlliesBase.find((a) => String(a.aliado_id) === String(aliadoId))
  if (!ally) throw new Error('No encontramos ese aliado en el entorno local.')

  const facturas    = mockFacturas.filter((f) => String(f.aliado_id) === String(aliadoId))
  const facturaIds  = new Set(facturas.map((f) => f.factura_id))
  const cuotas      = mockCuotas.filter((c) => facturaIds.has(c.factura_id))
  const cuotaIds    = new Set(cuotas.map((c) => c.cuota_id))
  const compromisos = mockCompromisos.filter((k) => cuotaIds.has(k.cuota_id))
  const pagos       = mockPagos.filter((p) => facturaIds.has(p.factura_id))
  const summary     = computeSummary(String(aliadoId))

  return { aliado: ally, compromisos, cuotas, facturas, pagos, resumen: summary }
}

export async function registrarPagoLocal(payload: RegistrarPagoPayload) {
  await new Promise((resolve) => window.setTimeout(resolve, 240))
  if (!payload.referencia?.trim()) {
    throw new Error('El nro. de comprobante (referencia) es obligatorio.')
  }
  const factura = mockFacturas.find((f) => f.factura_id === payload.facturaId)
  if (!factura) throw new Error('No encontramos la factura seleccionada en el entorno local.')
  if (!String(factura.num_factura || '').trim()) {
    throw new Error('No se puede registrar un pago hasta asignar el N° de factura a la deuda.')
  }

  const monto = Number(payload.montoPagado)

  if (payload.cuotaId) {
    const cuota = mockCuotas.find((c) => c.cuota_id === payload.cuotaId)
    if (cuota) {
      const nuevoSaldoCuota = Math.max(0, Number(cuota.saldo_cuota || 0) - monto)
      cuota.saldo_cuota = nuevoSaldoCuota
      cuota.estado_cuota =
        nuevoSaldoCuota <= 0 ? 'pagada'
        : nuevoSaldoCuota < Number(cuota.monto_cuota || 0) ? 'parcial'
        : 'pendiente'
    }
  } else {
    const cuotasFactura = mockCuotas
      .filter((c) => c.factura_id === payload.facturaId)
      .sort((a, b) => Number(a.numero_cuota || 0) - Number(b.numero_cuota || 0))
    let restante = monto
    for (const cuota of cuotasFactura) {
      if (restante <= 0) break
      const saldoActual = Math.max(0, Number(cuota.saldo_cuota || 0))
      if (saldoActual <= 0) continue
      const aplicado = Math.min(restante, saldoActual)
      const nuevoSaldoCuota = Math.max(0, saldoActual - aplicado)
      cuota.saldo_cuota = nuevoSaldoCuota
      cuota.estado_cuota =
        nuevoSaldoCuota <= 0 ? 'pagada'
        : nuevoSaldoCuota < Number(cuota.monto_cuota || 0) ? 'parcial'
        : 'pendiente'
      restante -= aplicado
    }
  }

  factura.saldo_factura = Math.max(0, factura.saldo_factura - monto)
  const montoNeto = factura.monto_neto
  factura.estado_factura =
    factura.saldo_factura <= 0 ? 'pagado'
    : factura.saldo_factura < montoNeto ? 'parcial'
    : 'pendiente'

  mockPagos = [
    {
      factura_id:  payload.facturaId,
      fecha_pago:  payload.fechaPago,
      medio_pago:  payload.medioPago,
      monto_pagado: monto,
      observacion: payload.observacion,
      pago_id:     `P-${Date.now()}`,
      referencia:  payload.referencia,
    },
    ...mockPagos,
  ]
  return { factura }
}

export async function crearFacturaLocal(payload: CrearFacturaPayload) {
  await new Promise((resolve) => window.setTimeout(resolve, 280))
  const facturaId = `F-${Date.now()}`
  const cuotasPayload = payload.cuotas ?? []

  const nuevaFactura: FacturaRecord = {
    aliado_id:      payload.aliadoId,
    estado_factura: 'pendiente',
    factura_id:     facturaId,
    fecha_deuda:    payload.fechaDeuda,
    monto_neto:     payload.montoNeto,
    observacion:    payload.observacion,
    periodo:        payload.periodo,
    servicio:       payload.servicio,
    saldo_factura:  payload.montoNeto,
    tipo_factura:   payload.tipoFactura,
  }

  mockFacturas = [...mockFacturas, nuevaFactura]

  const nuevasCuotas: CuotaRecord[] = cuotasPayload.map((c, i) => ({
    cuota_id:          `C-${Date.now()}-${i + 1}`,
    estado_cuota:      'pendiente',
    factura_id:        facturaId,
    fecha_vencimiento: c.fecha_vencimiento,
    monto_cuota:       c.monto_cuota,
    numero_cuota:      c.numero_cuota,
    saldo_cuota:       c.monto_cuota,
  }))
  mockCuotas = [...mockCuotas, ...nuevasCuotas]

  return { factura: nuevaFactura }
}

export async function crearCompromisoLocal(payload: CrearCompromisoPayload) {
  await new Promise((resolve) => window.setTimeout(resolve, 200))
  const cuota = mockCuotas.find((c) => c.cuota_id === payload.cuotaId)
  if (!cuota) throw new Error('No encontramos esa cuota en el entorno local.')

  const nuevoCompromiso: CompromisosRecord = {
    compromiso_id:     `K-${Date.now()}`,
    cuota_id:          payload.cuotaId,
    estado_compromiso: 'pendiente',
    fecha_compromiso:  payload.fechaCompromiso,
    monto_compromiso:  payload.montoCompromiso,
    observacion:       payload.observacion,
  }

  mockCompromisos = [...mockCompromisos, nuevoCompromiso]
  return { compromiso: nuevoCompromiso }
}

export async function agregarCuotaLocal(payload: AgregarCuotaPayload) {
  await new Promise((resolve) => window.setTimeout(resolve, 200))
  const factura = mockFacturas.find((f) => f.factura_id === payload.facturaId)
  if (!factura) throw new Error('No encontramos esa factura en el entorno local.')

  const nextNumero = mockCuotas.filter((c) => c.factura_id === payload.facturaId).length + 1

  const nuevaCuota: CuotaRecord = {
    cuota_id:          `C-${Date.now()}`,
    estado_cuota:      'pendiente',
    factura_id:        payload.facturaId,
    fecha_vencimiento: payload.fecha_vencimiento,
    monto_cuota:       payload.monto_cuota,
    numero_cuota:      nextNumero,
    saldo_cuota:       payload.monto_cuota,
  }

  mockCuotas   = [...mockCuotas, nuevaCuota]
  factura.monto_neto    += payload.monto_cuota
  factura.saldo_factura += payload.monto_cuota

  return { cuota: nuevaCuota }
}

export async function actualizarServicioDeudaLocal(payload: ActualizarServicioPayload) {
  await new Promise((resolve) => window.setTimeout(resolve, 160))
  const allowed: readonly string[] = SERVICIOS_TIPO
  if (!allowed.includes(payload.servicio)) {
    throw new Error(`ServiceType invalido. Usa ${SERVICIOS_TIPO.join(', ')}.`)
  }
  const factura = mockFacturas.find(
    (f) => String(f.deuda_id || f.factura_id) === String(payload.deudaId),
  )
  if (!factura) throw new Error('No encontramos esa deuda para actualizar el ServiceType.')
  factura.servicio = payload.servicio
  return { ok: true }
}

export async function importarDeudasMasivoLocal(payload: ImportarDeudasPayload): Promise<ImportarDeudasResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 260))
  const today = new Date().toISOString().slice(0, 10)

  payload.rows.forEach((row) => {
    localDebtSeq += 1
    const deudaId = String(localDebtSeq)
    const nuevaFactura: FacturaRecord = {
      deuda_id: deudaId,
      factura_id: deudaId,
      aliado_id: row.cod_aliado,
      periodo: row.periodo_pago,
      fecha_deuda: today,
      monto_neto: Number(row.monto_neto || 0),
      servicio: row.servicio,
      estado_factura: 'pendiente',
      saldo_factura: Number(row.monto_neto || 0),
      cant_cuotas: 1,
      tipo_factura: 'Contado',
    }
    mockFacturas = [...mockFacturas, nuevaFactura]
  })

  return {
    total: payload.rows.length,
    inserted: payload.rows.length,
  }
}

export async function asignarNumFacturaLocal(payload: AsignarNumFacturaPayload) {
  await new Promise((resolve) => window.setTimeout(resolve, 140))
  const deudaId = String(payload.deudaId || '')
  const numFactura = String(payload.numFactura || '').trim()
  if (!deudaId || !numFactura) {
    throw new Error('Debes indicar deuda y numero de factura.')
  }

  const factura = mockFacturas.find((f) => String(f.deuda_id || f.factura_id) === deudaId)
  if (!factura) throw new Error('No encontramos la deuda para asignar numero de factura.')
  factura.num_factura = numFactura
  mockPagos = mockPagos.map((pago) =>
    String(pago.deuda_id || pago.factura_id || '') === deudaId
      ? { ...pago, deuda_id: deudaId, num_factura: numFactura }
      : pago,
  )

  if (payload.aplicarEnCuotas) {
    mockCuotas = mockCuotas.map((cuota) =>
      String(cuota.deuda_id || cuota.factura_id) === deudaId
        ? { ...cuota, num_factura: numFactura }
        : cuota,
    )
  }

  return { ok: true }
}
