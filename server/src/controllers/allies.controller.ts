import type { Request, Response } from 'express'

import {
  asignarNumFactura,
  createFactura,
  exportAlliesCsv,
  exportAlliesDeudaDetalleCsv,
  exportAllyFacturasCsv,
  getAllyDetail,
  getFacturaCuotasForAlly,
  listAllyFacturas,
  listAllies,
  listAlliesFilterOptions,
  PagoConfirmacionRequeridaError,
  PagoValidationError,
  previewAplicacionPago,
  registrarPago,
  type FacturaEstadoFilter,
  type AliadosDebtStatusFilter,
} from '../services/alliesService.js'
import { AnularPagoError, anularPagoCuota } from '../services/pagoApplication.js'

function parseText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseNumber(value: unknown): number {
  return Number(value)
}

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    return v === 'true' || v === '1' || v === 'yes'
  }
  return false
}

function parseDebtStatus(value: unknown): AliadosDebtStatusFilter | undefined {
  const status = parseText(value) as AliadosDebtStatusFilter
  const allowed: AliadosDebtStatusFilter[] = ['all', 'con_saldo', 'sin_deuda', 'pendiente', 'parcial', 'pagado', 'con_vencimiento']
  return allowed.includes(status) ? status : undefined
}

function parseCatalogFilter(value: unknown): string | undefined {
  const v = parseText(value)
  return v && v !== 'all' ? v : undefined
}

function buildListQuery(query: Request['query']) {
  const { page, pageSize, name, debtStatus, allyStatus, bolsa, rubro, servicio, ejecutiva, periodOrder } = query
  const sort = parseText(periodOrder)
  const allowedSort = new Set(['recent', 'oldest', 'amount_desc', 'amount_asc'])
  return {
    allyStatus:  allyStatus  as 'all' | 'activo' | 'inactivo' | undefined,
    debtStatus:  parseDebtStatus(debtStatus),
    bolsa:       parseCatalogFilter(bolsa),
    rubro:       parseCatalogFilter(rubro),
    servicio:    parseCatalogFilter(servicio),
    ejecutiva:   parseCatalogFilter(ejecutiva),
    name:        typeof name === 'string' ? name : undefined,
    page:        page     ? Number(page)     : undefined,
    pageSize:    pageSize ? Number(pageSize) : undefined,
    periodOrder: allowedSort.has(sort) ? sort as 'recent' | 'oldest' | 'amount_desc' | 'amount_asc' : undefined,
  }
}

// GET /api/allies
export async function getAllies(request: Request, response: Response) {
  try {
    const result = await listAllies(buildListQuery(request.query))

    response.status(200).json(result)
  } catch (err) {
    console.error('[getAllies]', err)
    response.status(500).json({ message: 'Error al obtener aliados.' })
  }
}

// GET /api/allies/export
export async function getAlliesExport(request: Request, response: Response) {
  try {
    const { page: _p, pageSize: _ps, ...filters } = buildListQuery(request.query)
    const csv = await exportAlliesCsv(filters)

    const stamp = new Date().toISOString().slice(0, 10)
    response
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="aliados-deuda-${stamp}.csv"`)
      .send(csv)
  } catch (err) {
    console.error('[getAlliesExport]', err)
    response.status(500).json({ message: 'Error al exportar aliados.' })
  }
}

// GET /api/allies/export/detalle
export async function getAlliesDeudaDetalleExport(request: Request, response: Response) {
  try {
    const { page: _p, pageSize: _ps, ...filters } = buildListQuery(request.query)
    const csv = await exportAlliesDeudaDetalleCsv(filters)

    const stamp = new Date().toISOString().slice(0, 10)
    response
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="deudas-pendientes-${stamp}.csv"`)
      .send(csv)
  } catch (err) {
    console.error('[getAlliesDeudaDetalleExport]', err)
    response.status(500).json({ message: 'Error al exportar desglose de deudas.' })
  }
}

// GET /api/allies/filter-options
export async function getAlliesFilterOptions(_request: Request, response: Response) {
  try {
    const options = await listAlliesFilterOptions()
    response.status(200).json(options)
  } catch (err) {
    console.error('[getAlliesFilterOptions]', err)
    response.status(500).json({ message: 'Error al obtener opciones de filtro.' })
  }
}

const FACTURA_ESTADO_FILTERS = new Set<FacturaEstadoFilter>([
  'pendientes',
  'parciales',
  'pagadas',
  'anuladas',
  'todas',
])

function parseFacturaEstado(value: unknown): FacturaEstadoFilter {
  const estado = parseText(value) as FacturaEstadoFilter
  return FACTURA_ESTADO_FILTERS.has(estado) ? estado : 'pendientes'
}

// GET /api/allies/:id/facturas
export async function getAllyFacturas(request: Request, response: Response) {
  try {
    const aliadoId = parseText(request.params.id)
    if (!aliadoId) {
      response.status(400).json({ message: 'ID de aliado requerido.' })
      return
    }

    const { page, pageSize, estado, search } = request.query
    const result = await listAllyFacturas(aliadoId, {
      page:     page     ? Number(page)     : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      estado:   parseFacturaEstado(estado),
      search:   typeof search === 'string' ? search : undefined,
    })

    if (!result) {
      response.status(404).json({ message: 'Aliado no encontrado.' })
      return
    }

    response.status(200).json(result)
  } catch (err) {
    console.error('[getAllyFacturas]', err)
    response.status(500).json({ message: 'Error al obtener facturas del aliado.' })
  }
}

// GET /api/allies/:id/facturas/export
export async function getAllyFacturasExport(request: Request, response: Response) {
  try {
    const aliadoId = parseText(request.params.id)
    if (!aliadoId) {
      response.status(400).json({ message: 'ID de aliado requerido.' })
      return
    }

    const { estado, search } = request.query
    const csv = await exportAllyFacturasCsv(aliadoId, {
      estado: parseFacturaEstado(estado || 'todas'),
      search: typeof search === 'string' ? search : undefined,
    })

    if (csv === null) {
      response.status(404).json({ message: 'Aliado no encontrado.' })
      return
    }

    response
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="facturas-${aliadoId}.csv"`)
      .send(csv)
  } catch (err) {
    console.error('[getAllyFacturasExport]', err)
    response.status(500).json({ message: 'Error al exportar facturas.' })
  }
}

// GET /api/allies/:id/facturas/:deudaId/cuotas
export async function getFacturaCuotasHandler(request: Request, response: Response) {
  try {
    const aliadoId = parseText(request.params.id)
    const deudaId  = parseText(request.params.deudaId)
    if (!aliadoId || !deudaId) {
      response.status(400).json({ message: 'ID de aliado y deuda requeridos.' })
      return
    }

    const result = await getFacturaCuotasForAlly(aliadoId, deudaId)
    if (result === null) {
      response.status(404).json({ message: 'Deuda no encontrada para este aliado.' })
      return
    }

    response.status(200).json(result)
  } catch (err) {
    console.error('[getFacturaCuotas]', err)
    response.status(500).json({ message: 'Error al obtener cuotas.' })
  }
}

// GET /api/allies/:id
export async function getAllyById(request: Request, response: Response) {
  try {
    const aliadoId = parseText(request.params.id)

    if (!aliadoId) {
      response.status(400).json({ message: 'ID de aliado requerido.' })
      return
    }

    const detail = await getAllyDetail(aliadoId)

    if (!detail) {
      response.status(404).json({ message: 'Aliado no encontrado.' })
      return
    }

    response.status(200).json(detail)
  } catch (err) {
    console.error('[getAllyById]', err)
    response.status(500).json({ message: 'Error al obtener detalle del aliado.' })
  }
}

// POST /api/allies/facturas
export async function postFactura(request: Request, response: Response) {
  try {
    const aliadoId  = parseText(request.body.aliadoId)
    const montoNeto = parseNumber(request.body.montoNeto)

    if (!aliadoId || !Number.isFinite(montoNeto) || montoNeto <= 0) {
      response.status(400).json({ message: 'aliadoId y montoNeto (positivo) son requeridos.' })
      return
    }

    const result = await createFactura({
      aliadoId,
      cuotas:      Array.isArray(request.body.cuotas) ? request.body.cuotas : [],
      fechaDeuda:  parseText(request.body.fechaDeuda)  || undefined,
      montoNeto,
      numFactura:  parseText(request.body.numFactura)  || undefined,
      observacion: parseText(request.body.observacion) || undefined,
      periodo:     parseText(request.body.periodo)     || undefined,
      servicio:    parseText(request.body.servicio)    || undefined,
      tipoFactura: parseText(request.body.tipoFactura) || undefined,
    })

    if (!result) {
      response.status(404).json({ message: 'Aliado no encontrado.' })
      return
    }

    response.status(201).json(result)
  } catch (err) {
    console.error('[postFactura]', err)
    response.status(500).json({ message: 'Error al crear factura.' })
  }
}

// POST /api/allies/pagos/preview
export async function postPagoPreview(request: Request, response: Response) {
  try {
    const facturaId   = parseText(request.body.facturaId)
    const montoPagado = parseNumber(request.body.montoPagado)
    const cuotaId     = parseText(request.body.cuotaId) || undefined

    if (!facturaId || !Number.isFinite(montoPagado) || montoPagado <= 0) {
      response.status(400).json({ message: 'facturaId y montoPagado (positivo) son requeridos.' })
      return
    }

    const result = await previewAplicacionPago({ facturaId, cuotaId, montoPagado })
    response.status(200).json(result)
  } catch (err) {
    if (err instanceof PagoValidationError) {
      response.status(400).json({ message: err.message })
      return
    }
    console.error('[postPagoPreview]', err)
    response.status(500).json({
      message: 'Error al previsualizar aplicación del pago.',
      detail: formatErrorDetail(err),
    })
  }
}

// POST /api/allies/pagos
export async function postPago(request: Request, response: Response) {
  try {
    const facturaId   = parseText(request.body.facturaId)
    const fechaPago   = parseText(request.body.fechaPago)
    const montoPagado = parseNumber(request.body.montoPagado)
    const referencia  = parseText(request.body.referencia)

    if (!facturaId || !fechaPago || !Number.isFinite(montoPagado) || montoPagado <= 0) {
      response.status(400).json({ message: 'facturaId, fechaPago y montoPagado (positivo) son requeridos.' })
      return
    }
    if (!referencia) {
      response.status(400).json({ message: 'referencia (nro. de comprobante) es obligatoria.' })
      return
    }

    const result = await registrarPago({
      cuotaId:           parseText(request.body.cuotaId) || undefined,
      facturaId,
      fechaPago,
      medioPago:         parseText(request.body.medioPago) || undefined,
      montoPagado,
      observacion:       parseText(request.body.observacion) || undefined,
      referencia,
      confirmarCascada:  parseBool(request.body.confirmarCascada),
      userId:            typeof request.user?.userId === 'string' ? request.user.userId : undefined,
    })

    if (!result) {
      response.status(404).json({ message: 'Factura no encontrada.' })
      return
    }

    response.status(201).json(result)
  } catch (err) {
    if (err instanceof PagoConfirmacionRequeridaError) {
      response.status(409).json({
        message: err.message,
        code: err.code,
        destinos: err.destinos,
      })
      return
    }
    if (err instanceof PagoValidationError) {
      response.status(400).json({ message: err.message })
      return
    }
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      err.code === 'P2002'
    ) {
      response.status(409).json({
        message: 'Ya existe un pago registrado con ese nro. de comprobante para este aliado.',
      })
      return
    }
    console.error('[postPago]', err)
    response.status(500).json({
      message: 'Error al registrar pago.',
      detail: formatErrorDetail(err),
    })
  }
}

// PATCH /api/allies/facturas/:deudaId/num-factura
export async function patchNumFactura(request: Request, response: Response) {
  try {
    const deudaId    = parseText(request.params.deudaId)
    const numFactura = parseText(request.body.numFactura)

    if (!deudaId || !numFactura) {
      response.status(400).json({ message: 'deudaId y numFactura son requeridos.' })
      return
    }

    const result = await asignarNumFactura({
      deudaId,
      numFactura,
      aplicarEnCuotas: Boolean(request.body.aplicarEnCuotas),
    })

    if (!result) {
      response.status(404).json({ message: 'Factura/deuda no encontrada.' })
      return
    }

    response.status(200).json(result)
  } catch (err) {
    console.error('[patchNumFactura]', err)
    response.status(500).json({
      message: 'Error al asignar número de factura.',
      detail: formatErrorDetail(err),
    })
  }
}

// POST /api/allies/cuotas/:cuotaId/anular-pago
export async function postAnularPagoCuota(request: Request, response: Response) {
  try {
    const cuotaId = parseText(request.params.cuotaId)
    if (!cuotaId) {
      response.status(400).json({ message: 'cuotaId es requerido.' })
      return
    }

    const result = await anularPagoCuota(cuotaId)
    response.status(200).json(result)
  } catch (err) {
    if (err instanceof AnularPagoError) {
      response.status(400).json({ message: err.message })
      return
    }
    console.error('[postAnularPagoCuota]', err)
    response.status(500).json({
      message: 'Error al anular el pago.',
      detail: formatErrorDetail(err),
    })
  }
}

function formatErrorDetail(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const prismaErr = err as Error & { code?: string; meta?: unknown }
  const parts = [prismaErr.message]
  if (prismaErr.code) parts.push(`code=${prismaErr.code}`)
  if (prismaErr.meta !== undefined) parts.push(`meta=${JSON.stringify(prismaErr.meta)}`)
  return parts.join(' | ')
}
