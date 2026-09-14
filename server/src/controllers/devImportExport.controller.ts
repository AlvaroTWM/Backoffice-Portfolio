import type { Request, Response } from 'express'
import * as XLSX from 'xlsx'
import { prisma } from '../lib/prisma.js'

const MONTHS = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function formatPeriodo(mes?: number | null, anio?: number | null): string {
  if (!mes || !anio) return ''
  return `${MONTHS[mes]} ${anio}`
}

function currentMonthStartUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

async function ejecutivaMapForMonth(mes: Date): Promise<Map<string, string>> {
  const rows = await prisma.aliadoEjecutivaMensual.findMany({
    where: { mes },
    select: { cod_aliado: true, ejecutiva_nombre: true },
  })
  return new Map(rows.map((r) => [r.cod_aliado, r.ejecutiva_nombre]))
}

function sendXlsx(response: Response, filename: string, rows: Record<string, unknown>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book  = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'datos')
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  response.send(buffer)
}

/** Formato de importación aliados: una fila por deuda con deuda_id. */
export async function exportImportAliadosXlsx(_request: Request, response: Response) {
  const mesStart = currentMonthStartUtc()
  const ejMap    = await ejecutivaMapForMonth(mesStart)

  const facturas = await prisma.facturacion.findMany({
    include: {
      aliado: {
        include: { rucs: { orderBy: [{ principal: 'desc' }, { ruc: 'asc' }] } },
      },
    },
    orderBy: [{ periodo_anio: 'desc' }, { periodo_mes: 'desc' }, { deuda_id: 'asc' }],
    take: 1000,
  })

  const rows = facturas.map((f) => ({
    cod_aliado:    f.cod_aliado,
    deuda_id:      f.deuda_id,
    aliado:        f.aliado.brand,
    bolsa:         f.aliado.bolsa ?? '',
    rubro:         f.aliado.rubro ?? '',
    estado_aliado: f.aliado.estado_actual,
    estado_deuda:  f.estado_deuda,
    ruc:           f.aliado.rucs[0]?.ruc ?? '',
    periodo:       formatPeriodo(f.periodo_mes, f.periodo_anio),
    servicio:      f.servicio ?? '',
    monto_compra:  f.monto_compra != null ? Number(f.monto_compra) : '',
    absorbe_ueno:  f.absorbe_ueno != null ? Number(f.absorbe_ueno) : '',
    deuda_total:   Number(f.monto_original),
    clientes:      f.clientes ?? '',
    trx:           f.trx ?? '',
    ejecutiva:     ejMap.get(f.cod_aliado) ?? '',
  }))

  sendXlsx(response, 'import-aliados-ejemplo.xlsx', rows)
}

/** Formato de asignación de facturas: aliado, deuda_id, factura. */
export async function exportImportFacturasXlsx(_request: Request, response: Response) {
  const facturas = await prisma.facturacion.findMany({
    where: { saldo_pendiente: { gt: 0 } },
    include: { aliado: true },
    orderBy: [{ periodo_anio: 'desc' }, { periodo_mes: 'desc' }],
    take: 1000,
  })

  const rows = facturas.map((f) => ({
    aliado:   f.aliado.brand,
    deuda_id: f.deuda_id,
    factura:  f.num_factura ?? '',
  }))

  sendXlsx(response, 'import-facturas-ejemplo.xlsx', rows)
}

/** Formato de pagos masivos: deudas con factura y saldo pendiente. */
export async function exportImportPagosXlsx(_request: Request, response: Response) {
  const facturas = await prisma.facturacion.findMany({
    where: {
      saldo_pendiente: { gt: 0 },
      num_factura:     { not: null },
    },
    orderBy: [{ periodo_anio: 'desc' }, { periodo_mes: 'desc' }],
    take: 1000,
  })

  const rows = facturas.map((f) => ({
    deuda_id:     f.deuda_id,
    cod_aliado:   f.cod_aliado,
    num_factura:  f.num_factura ?? '',
    nro_cuota:    '',
    monto_pagado: '',
    fecha_pago:   '',
    referencia:   '',
    medio_pago:   '',
    observacion:  '',
  }))

  sendXlsx(response, 'import-pagos-ejemplo.xlsx', rows)
}
