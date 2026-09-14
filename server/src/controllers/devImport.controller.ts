import type { Request, Response } from 'express'
import * as XLSX from 'xlsx'
import { prisma } from '../lib/prisma.js'
import { normalizeEjecutivaName } from '../services/ejecutivaName.js'
import { ensureCuotaVencimientoOnFacturaAssign, generateDeudaId } from '../services/alliesService.js'
import {
  normalizeServicio,
  saldoPendienteTrasActualizarMonto,
} from '../services/importDebtHelpers.js'

// ─── Column aliases ───────────────────────────────────────────────────────────

const ALIASES: Record<string, string> = {
  cod_aliado:      'cod_aliado',
  codigo_aliado:   'cod_aliado',
  codigo:          'cod_aliado',
  deuda_id:        'deuda_id',
  id_deuda:        'deuda_id',
  aliado:          'aliado',
  brand:           'aliado',
  nombre_aliado:   'aliado',
  nombre:          'aliado',
  estado_aliado:   'estado_aliado',
  estado_aliad:    'estado_aliado',
  estado:          'estado_aliado',
  estado_deuda:    'estado_deuda',
  estado_deud:     'estado_deuda',
  ruc:             'ruc',
  ruc_aliado:      'ruc',
  periodo:         'periodo',
  'período':       'periodo',
  periodo_pago:    'periodo',
  'período pago':  'periodo',
  mes:             'periodo',
  servicio:        'servicio',
  tipo_servicio:   'servicio',
  deuda_total:     'deuda_total',
  'deuda total':   'deuda_total',
  total:           'deuda_total',
  monto:           'deuda_total',
  monto_deuda:     'deuda_total',
  monto_neto:      'deuda_total',
  deuda:           'deuda_total',
  importe:         'deuda_total',
  monto_compra:    'monto_compra',
  'monto compra':  'monto_compra',
  monto_de_compra: 'monto_compra',
  absorbe_ueno:    'absorbe_ueno',
  'absorbe ueno':  'absorbe_ueno',
  absorbe_uenó:    'absorbe_ueno',
  clientes:        'clientes',
  cliente:         'clientes',
  trx:             'trx',
  transacciones:   'trx',
  transaccion:     'trx',
  bolsa:           'bolsa',
  cartera:         'bolsa',
  rubro:           'rubro',
  categoria:       'rubro',
  categoría:       'rubro',
  ejecutiva:          'ejecutiva',
  ejecutiva_nombre:   'ejecutiva',
  nombre_ejecutiva:   'ejecutiva',
  ejecutivo:          'ejecutiva',
  asesor:             'ejecutiva',
  asesora:            'ejecutiva',
}

const MONTHS_MAP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
}

function parsePeriodo(periodo: string): { mes?: number; anio?: number } {
  const lower = String(periodo ?? '').toLowerCase().trim()

  // Spanish month name  (e.g. "Enero 2025", "enero-2025")
  let mes: number | undefined
  for (const [name, num] of Object.entries(MONTHS_MAP)) {
    if (lower.includes(name)) { mes = num; break }
  }

  // Year from any 4-digit year
  const yearMatch = lower.match(/(20\d{2})/)
  const anio = yearMatch ? Number(yearMatch[1]) : undefined

  if (mes !== undefined) return { mes, anio }

  // Numeric formats: YYYY-MM, MM/YYYY, MM-YYYY
  const numericFull = lower.match(/^(\d{4})[/-](\d{1,2})$/)
  if (numericFull) return { mes: Number(numericFull[2]), anio: Number(numericFull[1]) }

  const numericShort = lower.match(/^(\d{1,2})[/-](\d{4})$/)
  if (numericShort) return { mes: Number(numericShort[1]), anio: Number(numericShort[2]) }

  // Excel serial date (number stored as string, e.g. "45658")
  const serial = Number(lower)
  if (!isNaN(serial) && serial > 40000) {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000))
    return { mes: date.getUTCMonth() + 1, anio: date.getUTCFullYear() }
  }

  return { mes, anio }
}

function parseMonto(raw: unknown): bigint {
  // XLSX already parsed it as a JS number — use directly
  if (typeof raw === 'number') return isFinite(raw) && raw > 0 ? BigInt(Math.round(raw)) : 0n

  const str = String(raw ?? '').trim()
  if (!str) return 0n

  // Remove currency symbols, spaces, non-numeric chars except . , -
  const cleaned = str.replace(/[^\d,.-]/g, '')

  // Detect format:
  //   Paraguay/ES: dots = thousands, comma = decimal  e.g. "1.500.000" or "1.500.000,50"
  //   EN:          commas = thousands, dot = decimal   e.g. "1,500,000" or "1,500,000.50"
  const dotCount   = (cleaned.match(/\./g) ?? []).length
  const commaCount = (cleaned.match(/,/g) ?? []).length

  let normalized: string
  if (dotCount > 1) {
    // Multiple dots → dots are thousands separators (Paraguay format)
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (commaCount > 1) {
    // Multiple commas → commas are thousands separators (EN format)
    normalized = cleaned.replace(/,/g, '')
  } else if (dotCount === 1 && commaCount === 1) {
    // Both present: whichever comes last is the decimal separator
    const lastDot   = cleaned.lastIndexOf('.')
    const lastComma = cleaned.lastIndexOf(',')
    if (lastComma > lastDot) {
      // comma is decimal  →  Paraguay
      normalized = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // dot is decimal  →  EN
      normalized = cleaned.replace(/,/g, '')
    }
  } else {
    // Single separator or none
    normalized = cleaned.replace(',', '.')
  }

  const n = parseFloat(normalized)
  return isNaN(n) || n <= 0 ? 0n : BigInt(Math.round(n))
}

type ParsedRow = Record<string, string>

const MONTO_ALIASES = new Set(['deuda_total', 'monto_compra', 'absorbe_ueno'])

function normalizeCell(alias: string, val: unknown): string {
  if (val == null || val === '') return ''
  if (MONTO_ALIASES.has(alias) && typeof val === 'number') {
    return isFinite(val) ? String(Math.round(val)) : ''
  }
  return String(val).trim()
}

function parseOptionalMonto(raw?: string): bigint | null | undefined {
  if (raw === undefined) return undefined
  if (!raw.trim()) return null
  const monto = parseMonto(raw)
  return monto > 0n ? monto : null
}

function parseOptionalInt(raw?: string): number | null | undefined {
  if (raw === undefined) return undefined
  const cleaned = String(raw ?? '').trim().replace(/[^\d-]/g, '')
  if (!cleaned) return null
  const n = parseInt(cleaned, 10)
  return Number.isFinite(n) ? n : null
}

function buildImportMetrics(row: ParsedRow) {
  const hasMontoCompra = 'monto_compra' in row
  const hasAbsorbeUeno = 'absorbe_ueno' in row
  const hasClientes    = 'clientes' in row
  const hasTrx         = 'trx' in row

  const data: {
    monto_compra?: bigint | null
    absorbe_ueno?: bigint | null
    clientes?: number | null
    trx?: number | null
  } = {}

  if (hasMontoCompra) data.monto_compra = parseOptionalMonto(row.monto_compra)
  if (hasAbsorbeUeno) data.absorbe_ueno = parseOptionalMonto(row.absorbe_ueno)
  if (hasClientes)    data.clientes     = parseOptionalInt(row.clientes)
  if (hasTrx)         data.trx          = parseOptionalInt(row.trx)

  return Object.keys(data).length > 0 ? data : {}
}

function xlsxToRows(buffer: Buffer): ParsedRow[] {
  const workbook  = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet     = workbook.Sheets[sheetName]

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  return raw.map((row) => {
    const normalized: ParsedRow = {}
    for (const [key, val] of Object.entries(row)) {
      const alias = ALIASES[key.toLowerCase().trim()]
      if (alias) normalized[alias] = normalizeCell(alias, val)
    }
    return normalized
  })
}

/** Alinea con CHECK facturacion_estado_deuda_check: Pendiente | Financiada | Pagada | Anulada */
function normalizeEstadoDeuda(raw: string): string {
  const v = raw.trim().toLowerCase()
  if (v === 'sin deuda' || v === 'sin_deuda' || v === 'sindeuda') return 'Pagada'
  if (v === 'pendiente') return 'Pendiente'
  if (v === 'pagado' || v === 'pagada') return 'Pagada'
  if (v === 'parcial' || v === 'financiada' || v === 'financiado') return 'Financiada'
  if (v === 'anulado' || v === 'anulada') return 'Anulada'
  return 'Pendiente'
}

function normalizeEstado(raw: string): string {
  const v = raw.trim().toLowerCase()
  if (v === 'activo'   || v === 'active'   || v === 'a' || v === '1') return 'Activo'
  if (v === 'inactivo' || v === 'inactive' || v === 'i' || v === '0') return 'Inactivo'
  return 'Activo'
}

const FACTURA_ALIASES: Record<string, string> = {
  aliado:    'aliado',
  brand:     'aliado',
  nombre:    'aliado',
  deuda_id:  'deuda_id',
  factura:   'factura',
}

function normalizeAliadoName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function upsertEjecutivaMensual(codAliado: string, ejecutivaRaw?: string) {
  const ejecutivaNombre = normalizeEjecutivaName(ejecutivaRaw)
  if (!ejecutivaNombre) return

  await prisma.$executeRaw`
    INSERT INTO aliado_ejecutiva_mensual (cod_aliado, ejecutiva_nombre, mes)
    VALUES (
      ${codAliado},
      ${ejecutivaNombre.slice(0, 150)},
      DATE_TRUNC('month', CURRENT_DATE)::date
    )
    ON CONFLICT (cod_aliado, mes)
    DO UPDATE SET ejecutiva_nombre = EXCLUDED.ejecutiva_nombre
  `
}

function xlsxToFacturaRows(buffer: Buffer): ParsedRow[] {
  const workbook  = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet     = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  return raw.map((row) => {
    const normalized: ParsedRow = {}
    for (const [key, val] of Object.entries(row)) {
      const alias = FACTURA_ALIASES[key.toLowerCase().trim()]
      if (alias) normalized[alias] = String(val).trim()
    }
    return normalized
  })
}

// POST /api/dev/import-facturas  (multipart: field "file")
export async function importAsignarFacturasXlsx(request: Request, response: Response) {
  try {
    if (!request.file) {
      response.status(400).json({ message: 'Adjuntá un archivo .xlsx en el campo "file".' })
      return
    }

    const rows = xlsxToFacturaRows(request.file.buffer)
    if (rows.length === 0) {
      response.status(400).json({ message: 'El archivo está vacío o no tiene el formato esperado.' })
      return
    }

    const results = { updated: 0, skipped: 0, errors: [] as string[] }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowLabel = `Fila ${i + 2}`

      const deudaId = row.deuda_id?.trim()
      const aliado = row.aliado?.trim()
      const factura = row.factura?.trim()

      if (!aliado || !deudaId || !factura) {
        results.errors.push(`${rowLabel}: las columnas aliado, deuda_id y factura son obligatorias.`)
        continue
      }

      try {
        const registro = await prisma.facturacion.findUnique({
          where:   { deuda_id: deudaId },
          include: { aliado: true },
        })

        if (!registro) {
          results.errors.push(`${rowLabel}: no se encontró la deuda ${deudaId}.`)
          continue
        }

        if (normalizeAliadoName(registro.aliado.brand) !== normalizeAliadoName(aliado)) {
          results.errors.push(
            `${rowLabel}: el aliado "${aliado}" no coincide con la deuda ${deudaId} (esperado: "${registro.aliado.brand}").`,
          )
          continue
        }

        if (registro.num_factura === factura) {
          results.skipped++
          continue
        }

        const esPrimeraAsignacion = !registro.num_factura?.trim()

        await prisma.facturacion.update({
          where: { deuda_id: deudaId },
          data:  { num_factura: factura },
        })

        if (esPrimeraAsignacion && registro.saldo_pendiente > 0n) {
          await ensureCuotaVencimientoOnFacturaAssign(deudaId)
        }
        results.updated++
      } catch (rowErr) {
        results.errors.push(
          `${rowLabel}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`,
        )
      }
    }

    response.status(200).json({
      message:  `Asignación completada: ${results.updated} actualizadas, ${results.skipped} sin cambios, ${results.errors.length} errores.`,
      total:    rows.length,
      inserted: 0,
      updated:  results.updated,
      skipped:  results.skipped,
      errors:   results.errors,
    })
  } catch (err) {
    console.error('[importAsignarFacturasXlsx]', err)
    response.status(500).json({ message: 'Error al procesar el archivo.' })
  }
}

// POST /api/dev/import-aliados  (multipart: field "file")
export async function importAliadosXlsx(request: Request, response: Response) {
  try {
    if (!request.file) {
      response.status(400).json({ message: 'Adjuntá un archivo .xlsx en el campo "file".' })
      return
    }

    const rowsRaw = xlsxToRows(request.file.buffer)

    if (rowsRaw.length === 0) {
      response.status(400).json({ message: 'El archivo está vacío o no tiene el formato esperado.' })
      return
    }

    const rows = rowsRaw

    const results = {
      inserted: 0,
      updated: 0,
      deudas_creadas: 0,
      deudas_actualizadas: 0,
      deudas_omitidas: 0,
      filas_sin_codigo: 0,
      warnings: [] as string[],
      errors: [] as string[],
      debug: [] as unknown[],
    }

    const aliadosNuevos = new Set<string>()
    const aliadosExistentes = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowLabel = `Fila ${i + 2}`
      const cod = row.cod_aliado?.trim()
      if (!cod) {
        results.filas_sin_codigo++
        results.errors.push(`${rowLabel}: falta cod_aliado — fila omitida.`)
        continue
      }

      // Capture first 3 rows for diagnosis
      if (results.debug.length < 3) {
        const rawMonto = row.deuda_total
        const rawPeriodo = row.periodo
        const monto = parseMonto(rawMonto)
        const { mes, anio } = parsePeriodo(rawPeriodo ?? '')
        results.debug.push({ cod, rawMonto, rawPeriodo, parsedMonto: monto.toString(), mes, anio })
      }

      try {
        const existing = await prisma.directorioAliado.findUnique({ where: { cod_aliado: cod } })

        await prisma.directorioAliado.upsert({
          where:  { cod_aliado: cod },
          update: {
            brand:         row.aliado                             || undefined,
            estado_actual: row.estado_aliado ? normalizeEstado(row.estado_aliado) : undefined,
            bolsa:         row.bolsa?.trim()                      || undefined,
            rubro:         row.rubro?.trim()                      || undefined,
          },
          create: {
            cod_aliado:    cod,
            brand:         row.aliado        || cod,
            estado_actual: normalizeEstado(row.estado_aliado || 'Activo'),
            bolsa:         row.bolsa?.trim() || null,
            rubro:         row.rubro?.trim() || null,
          },
        })

        if (existing) aliadosExistentes.add(cod)
        else aliadosNuevos.add(cod)

        await upsertEjecutivaMensual(cod, row.ejecutiva)

        const rawRuc = String(row.ruc ?? '').trim()
        if (rawRuc) {
          const rucs = rawRuc.split(/[\n\r,;]+/).map(r => r.trim()).filter(Boolean)
          for (let r = 0; r < rucs.length; r++) {
            await prisma.aliadorRuc.upsert({
              where:  { cod_aliado_ruc: { cod_aliado: cod, ruc: rucs[r] } },
              update: { principal: r === 0 },
              create: { cod_aliado: cod, ruc: rucs[r], principal: r === 0 },
            })
          }
        }

        const monto = parseMonto(row.deuda_total)
        if (monto <= 0n) {
          results.deudas_omitidas++
        } else {
          const { mes, anio } = parsePeriodo(row.periodo ?? '')
          if (!mes || !anio) {
            results.errors.push(`${rowLabel} [${cod}]: periodo inválido o vacío ("${row.periodo ?? ''}") — deuda no registrada.`)
            results.deudas_omitidas++
          } else {
            const servicio = normalizeServicio(row.servicio)
            const deudaIdFromRow = row.deuda_id?.trim()
            let existingDeuda = null

            if (deudaIdFromRow) {
              existingDeuda = await prisma.facturacion.findUnique({ where: { deuda_id: deudaIdFromRow } })
              if (!existingDeuda) {
                results.errors.push(`${rowLabel} [${cod}]: deuda_id ${deudaIdFromRow} no encontrada — deuda no registrada.`)
                results.deudas_omitidas++
              } else if (existingDeuda.cod_aliado !== cod) {
                results.errors.push(`${rowLabel} [${cod}]: deuda_id ${deudaIdFromRow} pertenece a otro aliado — deuda no actualizada.`)
                results.deudas_omitidas++
                existingDeuda = null
              }
            }

            if (existingDeuda) {
              const deudaId = existingDeuda.deuda_id
              const nuevoSaldo = saldoPendienteTrasActualizarMonto(
                existingDeuda.monto_original,
                existingDeuda.saldo_pendiente,
                monto,
              )
              await prisma.facturacion.update({
                where: { deuda_id: deudaId },
                data:  {
                  monto_original:  monto,
                  saldo_pendiente: nuevoSaldo,
                  estado_deuda:    row.estado_deuda ? normalizeEstadoDeuda(row.estado_deuda) : undefined,
                  servicio:        servicio         || undefined,
                  periodo_mes:     mes,
                  periodo_anio:    anio,
                  ...buildImportMetrics(row),
                },
              })
              results.deudas_actualizadas++

              const facturaActiva = await prisma.facturacion.findUnique({ where: { deuda_id: deudaId } })
              if (facturaActiva?.num_factura?.trim() && facturaActiva.saldo_pendiente > 0n) {
                await ensureCuotaVencimientoOnFacturaAssign(deudaId)
              }
            } else if (!deudaIdFromRow) {
              const deudaId = await generateDeudaId()
              await prisma.facturacion.create({
                data: {
                  deuda_id:        deudaId,
                  cod_aliado:      cod,
                  monto_original:  monto,
                  saldo_pendiente: monto,
                  estado_deuda:    normalizeEstadoDeuda(row.estado_deuda || 'Pendiente'),
                  servicio:        servicio,
                  periodo_mes:     mes,
                  periodo_anio:    anio,
                  ...buildImportMetrics(row),
                },
              })
              results.deudas_creadas++
            }
          }
        }

      } catch (rowErr) {
        results.errors.push(`${rowLabel} [${cod}]: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`)
      }
    }

    results.inserted = aliadosNuevos.size
    results.updated = aliadosExistentes.size

    response.status(200).json({
      message:  `Ingesta completada: ${results.inserted} aliados nuevos, ${results.updated} aliados actualizados, ${results.deudas_creadas} deudas creadas, ${results.deudas_actualizadas} deudas actualizadas, ${results.deudas_omitidas} filas sin deuda registrable${results.warnings.length ? `, ${results.warnings.length} avisos` : ''}${results.errors.length ? `, ${results.errors.length} errores` : ''}.`,
      total:    rowsRaw.length,
      filas_procesadas: rows.length,
      inserted: results.inserted,
      updated:  results.updated,
      deudas_creadas: results.deudas_creadas,
      deudas_actualizadas: results.deudas_actualizadas,
      deudas_omitidas: results.deudas_omitidas,
      filas_sin_codigo: results.filas_sin_codigo,
      warnings: results.warnings,
      errors:   results.errors,
      debug:    results.debug,
    })
  } catch (err) {
    console.error('[importAliadosXlsx]', err)
    response.status(500).json({ message: 'Error al procesar el archivo.' })
  }
}
