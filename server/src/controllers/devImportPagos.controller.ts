import type { Request, Response } from 'express'
import * as XLSX from 'xlsx'
import { prisma } from '../lib/prisma.js'
import type { JwtPayload } from '../middlewares/authJwt.middleware.js'
import {
  PagoValidationError,
  normalizeMetodoPago,
  previewAplicacionPago,
  registrarPagoConAplicacion,
  type DestinoPreview,
} from '../services/pagoApplication.js'

const PAGO_ALIASES: Record<string, string> = {
  deuda_id:        'deuda_id',
  id_deuda:        'deuda_id',
  factura_id:      'deuda_id',
  cod_aliado:      'cod_aliado',
  codigo_aliado:   'cod_aliado',
  num_factura:     'num_factura',
  factura:         'num_factura',
  nro_factura:     'num_factura',
  cuota_id:        'cuota_id',
  id_cuota:        'cuota_id',
  nro_cuota:       'nro_cuota',
  monto_pagado:    'monto_pagado',
  monto:           'monto_pagado',
  importe:         'monto_pagado',
  fecha_pago:      'fecha_pago',
  fecha:           'fecha_pago',
  referencia:      'referencia',
  comprobante:     'referencia',
  nro_comprobante: 'referencia',
  medio_pago:      'medio_pago',
  metodo_pago:     'medio_pago',
  medio:           'medio_pago',
  observacion:     'observacion',
  obs:             'observacion',
}

type ParsedRow = Record<string, string>

function normalizeCell(alias: string, val: unknown): string {
  if (val == null || val === '') return ''
  if ((alias === 'monto_pagado' || alias === 'nro_cuota') && typeof val === 'number') {
    return isFinite(val) ? String(Math.round(val)) : ''
  }
  return String(val).trim()
}

function xlsxToRows(buffer: Buffer): ParsedRow[] {
  const workbook  = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet     = workbook.Sheets[sheetName]
  const raw       = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  return raw.map((row) => {
    const normalized: ParsedRow = {}
    for (const [key, val] of Object.entries(row)) {
      const alias = PAGO_ALIASES[key.toLowerCase().trim()]
      if (alias) normalized[alias] = normalizeCell(alias, val)
    }
    return normalized
  })
}

function parseMonto(raw: unknown): bigint {
  if (typeof raw === 'number') return isFinite(raw) && raw > 0 ? BigInt(Math.round(raw)) : 0n

  const str = String(raw ?? '').trim()
  if (!str) return 0n

  const cleaned = str.replace(/[^\d,.-]/g, '')
  const dotCount   = (cleaned.match(/\./g) ?? []).length
  const commaCount = (cleaned.match(/,/g) ?? []).length

  let normalized: string
  if (dotCount > 1) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (commaCount > 1) {
    normalized = cleaned.replace(/,/g, '')
  } else if (dotCount === 1 && commaCount === 1) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  } else {
    normalized = cleaned.replace(',', '.')
  }

  const n = parseFloat(normalized)
  return isNaN(n) || n <= 0 ? 0n : BigInt(Math.round(n))
}

function parseFechaPago(raw: unknown): string | null {
  if (raw == null || raw === '') return null

  if (typeof raw === 'number' && raw > 40000) {
    const date = new Date(Math.round((raw - 25569) * 86400 * 1000))
    return date.toISOString().slice(0, 10)
  }

  const str = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const mm = dmy[2].padStart(2, '0')
    const dd = dmy[1].padStart(2, '0')
    return `${dmy[3]}-${mm}-${dd}`
  }

  const serial = Number(str)
  if (!isNaN(serial) && serial > 40000) {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000))
    return date.toISOString().slice(0, 10)
  }

  return null
}

async function resolveFacturaId(row: ParsedRow): Promise<string | null> {
  const deudaId = row.deuda_id?.trim()
  if (deudaId) return deudaId

  const numFactura = row.num_factura?.trim()
  const codAliado  = row.cod_aliado?.trim()
  if (!numFactura) return null

  if (codAliado) {
    const factura = await prisma.facturacion.findFirst({
      where: { cod_aliado: codAliado, num_factura: numFactura },
      select: { deuda_id: true },
    })
    return factura?.deuda_id ?? null
  }

  const matches = await prisma.facturacion.findMany({
    where: { num_factura: numFactura },
    select: { deuda_id: true },
    take: 2,
  })
  if (matches.length === 1) return matches[0].deuda_id
  return null
}

async function resolveCuotaId(facturaId: string, row: ParsedRow): Promise<string | undefined> {
  const cuotaId = row.cuota_id?.trim()
  if (cuotaId) return cuotaId

  const nroRaw = row.nro_cuota?.trim()
  if (!nroRaw) return undefined

  const nro = parseInt(nroRaw, 10)
  if (!Number.isFinite(nro)) return undefined

  const cuota = await prisma.cuota.findFirst({
    where: { deuda_id: facturaId, nro_cuota: nro },
    select: { cuota_id: true },
  })
  return cuota?.cuota_id
}

function formatDestinos(destinos: DestinoPreview[]): string {
  return destinos.map((d) => {
    if (d.tipo === 'SALDO_A_FAVOR') return `saldo a favor ${d.monto}`
    if (d.tipo === 'DEUDA') return `deuda ${d.numFactura ?? d.deudaId} ${d.monto}${d.esCascada ? ' (cascada)' : ''}`
    return `cuota ${d.nro ?? ''} ${d.monto}${d.esCascada ? ' (cascada)' : ''}`
  }).join('; ')
}

function isRowEmpty(row: ParsedRow): boolean {
  return Object.values(row).every((v) => !v?.trim())
}

// POST /api/dev/import-pagos
export async function importPagosXlsx(request: Request, response: Response) {
  try {
    const file = request.file
    if (!file) {
      response.status(400).json({ message: 'No se recibió ningún archivo.' })
      return
    }

    const dryRun = request.query.dryRun === 'true'
    const currentUser = (request as Request & { user?: JwtPayload }).user
    const userId = currentUser?.userId

    const rowsRaw = xlsxToRows(file.buffer)
    const rows = rowsRaw.filter((row) => !isRowEmpty(row))

    const results = {
      total: rowsRaw.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      warnings: [] as string[],
      dryRun,
    }

    const referenciasEnArchivo = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowLabel = `Fila ${i + 2}`

      try {
        const monto = parseMonto(row.monto_pagado)
        if (monto <= 0n) {
          results.errors.push(`${rowLabel}: monto_pagado inválido o vacío.`)
          continue
        }

        const fechaPago = parseFechaPago(row.fecha_pago)
        if (!fechaPago) {
          results.errors.push(`${rowLabel}: fecha_pago inválida ("${row.fecha_pago ?? ''}").`)
          continue
        }

        const referencia = row.referencia?.trim()
        if (!referencia) {
          results.errors.push(`${rowLabel}: referencia (comprobante) es obligatoria.`)
          continue
        }

        if (row.medio_pago?.trim() && !normalizeMetodoPago(row.medio_pago)) {
          results.errors.push(`${rowLabel}: medio_pago inválido ("${row.medio_pago}").`)
          continue
        }

        const facturaId = await resolveFacturaId(row)
        if (!facturaId) {
          const hint = row.deuda_id
            ? `deuda_id "${row.deuda_id}" no encontrada`
            : row.num_factura
              ? `no se encontró factura "${row.num_factura}"${row.cod_aliado ? ` para ${row.cod_aliado}` : ''}`
              : 'falta deuda_id o num_factura'
          results.errors.push(`${rowLabel}: ${hint}.`)
          continue
        }

        const factura = await prisma.facturacion.findUnique({
          where: { deuda_id: facturaId },
          select: { cod_aliado: true, num_factura: true, estado_deuda: true },
        })
        if (!factura) {
          results.errors.push(`${rowLabel}: factura ${facturaId} no encontrada.`)
          continue
        }
        if (row.cod_aliado?.trim() && factura.cod_aliado !== row.cod_aliado.trim()) {
          results.errors.push(`${rowLabel}: deuda_id no pertenece a cod_aliado ${row.cod_aliado}.`)
          continue
        }
        if (!factura.num_factura?.trim()) {
          results.errors.push(`${rowLabel}: la deuda ${facturaId} no tiene número de factura asignado.`)
          continue
        }
        if (factura.estado_deuda === 'Anulada') {
          results.errors.push(`${rowLabel}: la deuda ${facturaId} está anulada.`)
          continue
        }

        const refKey = `${factura.cod_aliado}::${referencia}`
        if (referenciasEnArchivo.has(refKey)) {
          results.errors.push(`${rowLabel}: comprobante "${referencia}" duplicado en el archivo para ${factura.cod_aliado}.`)
          continue
        }
        referenciasEnArchivo.add(refKey)

        const cuotaId = await resolveCuotaId(facturaId, row)
        if (row.nro_cuota?.trim() && !cuotaId) {
          results.errors.push(`${rowLabel}: cuota nro ${row.nro_cuota} no encontrada en ${facturaId}.`)
          continue
        }

        const montoPagado = Number(monto)
        const inputBase = {
          facturaId,
          cuotaId,
          fechaPago,
          montoPagado,
          referencia,
          medioPago: row.medio_pago?.trim() || undefined,
          observacion: row.observacion?.trim() || undefined,
          confirmarCascada: true,
          userId,
        }

        if (dryRun) {
          const preview = await previewAplicacionPago({
            facturaId,
            cuotaId,
            montoPagado,
          })
          results.inserted++
          if (preview.requiereConfirmacionCascada) {
            results.warnings.push(
              `${rowLabel} [${factura.cod_aliado} / ${factura.num_factura}]: ${formatDestinos(preview.destinos)}`,
            )
          }
        } else {
          const result = await registrarPagoConAplicacion(inputBase)
          if (!result) {
            results.errors.push(`${rowLabel}: no se pudo registrar el pago.`)
            continue
          }
          results.inserted++
          const cascada = result.aplicaciones.some((d) => d.tipo === 'CUOTA' && d.esCascada)
            || result.aplicaciones.some((d) => d.tipo === 'SALDO_A_FAVOR')
          if (cascada) {
            results.warnings.push(
              `${rowLabel} [${factura.cod_aliado}]: pago ${result.pago.pago_id} — ${formatDestinos(result.aplicaciones)}`,
            )
          }
        }
      } catch (rowErr) {
        const msg = rowErr instanceof PagoValidationError
          ? rowErr.message
          : rowErr instanceof Error ? rowErr.message : String(rowErr)
        results.errors.push(`${rowLabel}: ${msg}`)
      }
    }

    const action = dryRun ? 'Vista previa' : 'Importación'
    response.status(200).json({
      message: `${action} completada: ${results.inserted} pagos${dryRun ? ' simulados' : ' registrados'}${results.warnings.length ? `, ${results.warnings.length} avisos de cascada` : ''}${results.errors.length ? `, ${results.errors.length} errores` : ''}.`,
      ...results,
    })
  } catch (err) {
    console.error('[importPagosXlsx]', err)
    response.status(500).json({
      message: 'Error al importar pagos.',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}
