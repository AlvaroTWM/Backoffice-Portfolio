import type { Request, Response } from 'express'
import * as XLSX from 'xlsx'
import { prisma } from '../lib/prisma.js'
import { findFacturacionForImport } from '../services/importDebtHelpers.js'
import { normalizeEjecutivaName } from '../services/ejecutivaName.js'

// ─── Shared parsing (mirrors devImport.controller) ───────────────────────────

const MONTHS_MAP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
}

type ParsedRow = Record<string, string>

function parsePeriodo(periodo: string): { mes?: number; anio?: number } {
  const lower = String(periodo ?? '').toLowerCase().trim()

  let mes: number | undefined
  for (const [name, num] of Object.entries(MONTHS_MAP)) {
    if (lower.includes(name)) { mes = num; break }
  }

  const yearMatch = lower.match(/(20\d{2})/)
  const anio = yearMatch ? Number(yearMatch[1]) : undefined
  if (mes !== undefined) return { mes, anio }

  const numericFull = lower.match(/^(\d{4})[/-](\d{1,2})$/)
  if (numericFull) return { mes: Number(numericFull[2]), anio: Number(numericFull[1]) }

  const numericShort = lower.match(/^(\d{1,2})[/-](\d{4})$/)
  if (numericShort) return { mes: Number(numericShort[1]), anio: Number(numericShort[2]) }

  const serial = Number(lower)
  if (!isNaN(serial) && serial > 40000) {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000))
    return { mes: date.getUTCMonth() + 1, anio: date.getUTCFullYear() }
  }

  return { mes, anio }
}

function parseMonto(raw: unknown): bigint {
  if (typeof raw === 'number') return isFinite(raw) && raw > 0 ? BigInt(Math.round(raw)) : 0n
  const str = String(raw ?? '').trim()
  if (!str) return 0n
  const cleaned = str.replace(/[^\d,.-]/g, '')
  const dotCount   = (cleaned.match(/\./g) ?? []).length
  const commaCount = (cleaned.match(/,/g) ?? []).length
  let normalized: string
  if (dotCount > 1) normalized = cleaned.replace(/\./g, '').replace(',', '.')
  else if (commaCount > 1) normalized = cleaned.replace(/,/g, '')
  else if (dotCount === 1 && commaCount === 1) {
    const lastDot   = cleaned.lastIndexOf('.')
    const lastComma = cleaned.lastIndexOf(',')
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  } else normalized = cleaned.replace(',', '.')
  const n = parseFloat(normalized)
  return isNaN(n) || n <= 0 ? 0n : BigInt(Math.round(n))
}

function normalizeEstadoDeuda(raw: string): string {
  const v = raw.trim().toLowerCase()
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

function formatPeriodo(mes?: number | null, anio?: number | null): string {
  if (!mes || !anio) return ''
  const names = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${names[mes]} ${anio}`
}

function parseMesEjecutiva(raw: string): Date | null {
  const trimmed = raw.trim()
  if (!trimmed) return new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))

  const iso = trimmed.match(/^(\d{4})-(\d{2})/)
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, 1))

  const { mes, anio } = parsePeriodo(trimmed)
  if (mes && anio) return new Date(Date.UTC(anio, mes - 1, 1))
  return null
}

function xlsxToRows(buffer: Buffer, aliases: Record<string, string>): ParsedRow[] {
  const workbook  = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet     = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  return raw.map((row) => {
    const normalized: ParsedRow = {}
    for (const [key, val] of Object.entries(row)) {
      const alias = aliases[key.toLowerCase().trim()]
      if (alias) normalized[alias] = String(val).trim()
    }
    return normalized
  })
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

interface ChangeEntry {
  row:    number
  key:    string
  field:  string
  from:   string
  to:     string
}

// ─── Column aliases ───────────────────────────────────────────────────────────

const UPDATE_ALIADOS_ALIASES: Record<string, string> = {
  cod_aliado: 'cod_aliado', codigo_aliado: 'cod_aliado', codigo: 'cod_aliado',
  aliado: 'aliado', brand: 'aliado', nombre_aliado: 'aliado', nombre: 'aliado',
  bolsa: 'bolsa', cartera: 'bolsa',
  rubro: 'rubro', categoria: 'rubro', categoría: 'rubro',
  estado_aliado: 'estado_aliado', estado: 'estado_aliado',
  ruc: 'ruc', ruc_aliado: 'ruc',
  cod_persona: 'cod_persona', codigo_persona: 'cod_persona',
  ejecutiva: 'ejecutiva', ejecutiva_nombre: 'ejecutiva', nombre_ejecutiva: 'ejecutiva',
}

const UPDATE_DEUDAS_ALIASES: Record<string, string> = {
  deuda_id: 'deuda_id', id_deuda: 'deuda_id',
  cod_aliado: 'cod_aliado', codigo_aliado: 'cod_aliado',
  periodo: 'periodo', período: 'periodo', mes: 'periodo',
  servicio: 'servicio', tipo_servicio: 'servicio',
  estado_deuda: 'estado_deuda', estado_deud: 'estado_deuda',
  deuda_total: 'deuda_total', 'deuda total': 'deuda_total', monto: 'deuda_total', monto_neto: 'deuda_total',
}

const UPDATE_EJECUTIVAS_ALIASES: Record<string, string> = {
  cod_aliado: 'cod_aliado', codigo_aliado: 'cod_aliado',
  mes: 'mes', periodo: 'mes', período: 'mes',
  ejecutiva: 'ejecutiva', ejecutiva_nombre: 'ejecutiva', nombre_ejecutiva: 'ejecutiva',
}

async function findDeuda(row: ParsedRow) {
  const deudaId = row.deuda_id?.trim()
  if (deudaId) {
    return prisma.facturacion.findUnique({ where: { deuda_id: deudaId } })
  }
  const cod = row.cod_aliado?.trim()
  const { mes, anio } = parsePeriodo(row.periodo ?? '')
  if (!cod || !mes || !anio) return null
  return findFacturacionForImport(cod, mes, anio, row.servicio)
}

async function deudaHasPagos(deudaId: string): Promise<boolean> {
  const count = await prisma.aplicacionPago.count({ where: { deuda_id: deudaId } })
  return count > 0
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportAliadosXlsx(_request: Request, response: Response) {
  const allies = await prisma.directorioAliado.findMany({
    include: { rucs: { orderBy: [{ principal: 'desc' }, { ruc: 'asc' }] } },
    orderBy: { brand: 'asc' },
  })

  const rows = allies.map((a) => ({
    cod_aliado:    a.cod_aliado,
    aliado:        a.brand,
    bolsa:         a.bolsa ?? '',
    rubro:         a.rubro ?? '',
    estado_aliado: a.estado_actual,
    ruc:           a.rucs.map((r) => r.ruc).join('\n'),
    cod_persona:   a.cod_persona ?? '',
  }))

  sendXlsx(response, 'aliados-actualizar.xlsx', rows)
}

export async function exportDeudasXlsx(_request: Request, response: Response) {
  const facturas = await prisma.facturacion.findMany({
    include: { aliado: true },
    orderBy: [{ periodo_anio: 'desc' }, { periodo_mes: 'desc' }],
  })

  const rows = facturas.map((f) => ({
    deuda_id:     f.deuda_id,
    cod_aliado:   f.cod_aliado,
    aliado:       f.aliado.brand,
    periodo:      formatPeriodo(f.periodo_mes, f.periodo_anio),
    servicio:     f.servicio ?? '',
    estado_deuda: f.estado_deuda,
    deuda_total:  Number(f.monto_original),
    num_factura:  f.num_factura ?? '',
  }))

  sendXlsx(response, 'deudas-actualizar.xlsx', rows)
}

export async function exportEjecutivasXlsx(_request: Request, response: Response) {
  const registros = await prisma.aliadoEjecutivaMensual.findMany({
    include: { aliado: true },
    orderBy: [{ mes: 'desc' }, { cod_aliado: 'asc' }],
  })

  const rows = registros.map((r) => ({
    cod_aliado: r.cod_aliado,
    aliado:     r.aliado.brand,
    mes:        r.mes.toISOString().slice(0, 7),
    ejecutiva:  r.ejecutiva_nombre,
  }))

  sendXlsx(response, 'ejecutivas-actualizar.xlsx', rows)
}

// ─── Update handlers ──────────────────────────────────────────────────────────

export async function updateAliadosXlsx(request: Request, response: Response) {
  try {
    if (!request.file) {
      response.status(400).json({ message: 'Adjuntá un archivo .xlsx en el campo "file".' })
      return
    }

    const dryRun = request.query.dryRun === 'true'
    const rows   = xlsxToRows(request.file.buffer, UPDATE_ALIADOS_ALIASES)
    if (rows.length === 0) {
      response.status(400).json({ message: 'El archivo está vacío o no tiene el formato esperado.' })
      return
    }

    const results = { updated: 0, skipped: 0, errors: [] as string[], changes: [] as ChangeEntry[] }

    for (let i = 0; i < rows.length; i++) {
      const row     = rows[i]
      const rowNum  = i + 2
      const cod     = row.cod_aliado?.trim()
      if (!cod) {
        results.errors.push(`Fila ${rowNum}: cod_aliado es obligatorio.`)
        continue
      }

      try {
        const existing = await prisma.directorioAliado.findUnique({ where: { cod_aliado: cod } })
        if (!existing) {
          results.errors.push(`Fila ${rowNum}: no existe el aliado ${cod}. Solo se permiten actualizaciones.`)
          continue
        }

        const updateData: Record<string, unknown> = {}
        const rowChanges: ChangeEntry[] = []

        if (row.aliado?.trim()) {
          updateData.brand = row.aliado.trim()
          if (existing.brand !== row.aliado.trim()) {
            rowChanges.push({ row: rowNum, key: cod, field: 'aliado', from: existing.brand, to: row.aliado.trim() })
          }
        }
        if (row.bolsa?.trim()) {
          updateData.bolsa = row.bolsa.trim()
          if ((existing.bolsa ?? '') !== row.bolsa.trim()) {
            rowChanges.push({ row: rowNum, key: cod, field: 'bolsa', from: existing.bolsa ?? '', to: row.bolsa.trim() })
          }
        }
        if (row.rubro?.trim()) {
          updateData.rubro = row.rubro.trim()
          if ((existing.rubro ?? '') !== row.rubro.trim()) {
            rowChanges.push({ row: rowNum, key: cod, field: 'rubro', from: existing.rubro ?? '', to: row.rubro.trim() })
          }
        }
        if (row.estado_aliado?.trim()) {
          const estado = normalizeEstado(row.estado_aliado)
          updateData.estado_actual = estado
          if (existing.estado_actual !== estado) {
            rowChanges.push({ row: rowNum, key: cod, field: 'estado_aliado', from: existing.estado_actual, to: estado })
          }
        }
        if (row.cod_persona?.trim()) {
          const n = parseInt(row.cod_persona, 10)
          if (!isNaN(n)) {
            updateData.cod_persona = n
            if (existing.cod_persona !== n) {
              rowChanges.push({ row: rowNum, key: cod, field: 'cod_persona', from: String(existing.cod_persona ?? ''), to: String(n) })
            }
          }
        }

        if (row.ruc?.trim()) {
          const rucs = row.ruc.split(/[\n\r,;]+/).map((r) => r.trim()).filter(Boolean)
          if (rucs.length > 0) {
            rowChanges.push({ row: rowNum, key: cod, field: 'ruc', from: '(actual)', to: rucs.join(', ') })
          }
        }

        if (row.ejecutiva?.trim()) {
          const ejecutivaNorm = normalizeEjecutivaName(row.ejecutiva)
          if (ejecutivaNorm) {
            rowChanges.push({ row: rowNum, key: cod, field: 'ejecutiva', from: '(mes actual)', to: ejecutivaNorm })
          }
        }

        if (rowChanges.length === 0) {
          results.skipped++
          continue
        }

        results.changes.push(...rowChanges)

        if (!dryRun) {
          if (Object.keys(updateData).length > 0) {
            await prisma.directorioAliado.update({ where: { cod_aliado: cod }, data: updateData })
          }
          if (row.ruc?.trim()) {
            const rucs = row.ruc.split(/[\n\r,;]+/).map((r) => r.trim()).filter(Boolean)
            for (let j = 0; j < rucs.length; j++) {
              await prisma.aliadorRuc.upsert({
                where:  { cod_aliado_ruc: { cod_aliado: cod, ruc: rucs[j] } },
                update: { principal: j === 0 },
                create: { cod_aliado: cod, ruc: rucs[j], principal: j === 0 },
              })
            }
          }
          if (row.ejecutiva?.trim()) {
            const ejecutivaNorm = normalizeEjecutivaName(row.ejecutiva)
            if (ejecutivaNorm) {
              await prisma.$executeRaw`
                INSERT INTO aliado_ejecutiva_mensual (cod_aliado, ejecutiva_nombre, mes)
                VALUES (
                  ${cod},
                  ${ejecutivaNorm.slice(0, 150)},
                  DATE_TRUNC('month', CURRENT_DATE)::date
                )
                ON CONFLICT (cod_aliado, mes)
                DO UPDATE SET ejecutiva_nombre = EXCLUDED.ejecutiva_nombre
              `
            }
          }
        }

        results.updated++
      } catch (rowErr) {
        results.errors.push(`Fila ${rowNum}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`)
      }
    }

    response.status(200).json({
      message: dryRun
        ? `Vista previa: ${results.updated} filas con cambios, ${results.skipped} sin cambios, ${results.errors.length} errores.`
        : `Actualización completada: ${results.updated} actualizados, ${results.skipped} sin cambios, ${results.errors.length} errores.`,
      total:    rows.length,
      inserted: 0,
      updated:  results.updated,
      skipped:  results.skipped,
      errors:   results.errors,
      changes:  results.changes,
      dryRun,
    })
  } catch (err) {
    console.error('[updateAliadosXlsx]', err)
    response.status(500).json({ message: 'Error al procesar el archivo.' })
  }
}

export async function updateDeudasXlsx(request: Request, response: Response) {
  try {
    if (!request.file) {
      response.status(400).json({ message: 'Adjuntá un archivo .xlsx en el campo "file".' })
      return
    }

    const dryRun = request.query.dryRun === 'true'
    const rows   = xlsxToRows(request.file.buffer, UPDATE_DEUDAS_ALIASES)
    if (rows.length === 0) {
      response.status(400).json({ message: 'El archivo está vacío o no tiene el formato esperado.' })
      return
    }

    const results = { updated: 0, skipped: 0, errors: [] as string[], changes: [] as ChangeEntry[] }

    for (let i = 0; i < rows.length; i++) {
      const row    = rows[i]
      const rowNum = i + 2

      try {
        const factura = await findDeuda(row)
        if (!factura) {
          const key = row.deuda_id?.trim() || `${row.cod_aliado}+${row.periodo}`
          results.errors.push(`Fila ${rowNum}: no se encontró la deuda (${key}). Usá deuda_id o cod_aliado + periodo.`)
          continue
        }

        const updateData: Record<string, unknown> = {}
        const rowChanges: ChangeEntry[] = []
        const key = factura.deuda_id

        if (row.servicio?.trim()) {
          updateData.servicio = row.servicio.trim()
          if ((factura.servicio ?? '') !== row.servicio.trim()) {
            rowChanges.push({ row: rowNum, key, field: 'servicio', from: factura.servicio ?? '', to: row.servicio.trim() })
          }
        }
        if (row.estado_deuda?.trim()) {
          const estado = normalizeEstadoDeuda(row.estado_deuda)
          updateData.estado_deuda = estado
          if (factura.estado_deuda !== estado) {
            rowChanges.push({ row: rowNum, key, field: 'estado_deuda', from: factura.estado_deuda, to: estado })
          }
        }
        if (row.periodo?.trim()) {
          const { mes, anio } = parsePeriodo(row.periodo)
          if (mes && anio) {
            updateData.periodo_mes  = mes
            updateData.periodo_anio = anio
            const from = formatPeriodo(factura.periodo_mes, factura.periodo_anio)
            const to   = formatPeriodo(mes, anio)
            if (from !== to) {
              rowChanges.push({ row: rowNum, key, field: 'periodo', from, to })
            }
          }
        }

        const newMonto = parseMonto(row.deuda_total)
        if (newMonto > 0n && newMonto !== factura.monto_original) {
          const hasPagos = await deudaHasPagos(factura.deuda_id)
          if (hasPagos) {
            results.errors.push(`Fila ${rowNum} (${key}): no se puede cambiar deuda_total porque ya hay pagos registrados.`)
            continue
          }
          updateData.monto_original  = newMonto
          updateData.saldo_pendiente = newMonto
          rowChanges.push({
            row: rowNum, key, field: 'deuda_total',
            from: factura.monto_original.toString(), to: newMonto.toString(),
          })
        }

        if (rowChanges.length === 0) {
          results.skipped++
          continue
        }

        results.changes.push(...rowChanges)

        if (!dryRun) {
          await prisma.facturacion.update({ where: { deuda_id: factura.deuda_id }, data: updateData })
        }

        results.updated++
      } catch (rowErr) {
        results.errors.push(`Fila ${rowNum}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`)
      }
    }

    response.status(200).json({
      message: dryRun
        ? `Vista previa: ${results.updated} filas con cambios, ${results.skipped} sin cambios, ${results.errors.length} errores.`
        : `Actualización completada: ${results.updated} actualizados, ${results.skipped} sin cambios, ${results.errors.length} errores.`,
      total:    rows.length,
      inserted: 0,
      updated:  results.updated,
      skipped:  results.skipped,
      errors:   results.errors,
      changes:  results.changes,
      dryRun,
    })
  } catch (err) {
    console.error('[updateDeudasXlsx]', err)
    response.status(500).json({ message: 'Error al procesar el archivo.' })
  }
}

export async function updateEjecutivasXlsx(request: Request, response: Response) {
  try {
    if (!request.file) {
      response.status(400).json({ message: 'Adjuntá un archivo .xlsx en el campo "file".' })
      return
    }

    const dryRun = request.query.dryRun === 'true'
    const rows   = xlsxToRows(request.file.buffer, UPDATE_EJECUTIVAS_ALIASES)
    if (rows.length === 0) {
      response.status(400).json({ message: 'El archivo está vacío o no tiene el formato esperado.' })
      return
    }

    const results = { updated: 0, skipped: 0, errors: [] as string[], changes: [] as ChangeEntry[] }

    for (let i = 0; i < rows.length; i++) {
      const row    = rows[i]
      const rowNum = i + 2
      const cod    = row.cod_aliado?.trim()
      const nombre = normalizeEjecutivaName(row.ejecutiva)

      if (!cod || !nombre) {
        results.errors.push(`Fila ${rowNum}: cod_aliado y ejecutiva son obligatorios.`)
        continue
      }

      try {
        const aliado = await prisma.directorioAliado.findUnique({ where: { cod_aliado: cod } })
        if (!aliado) {
          results.errors.push(`Fila ${rowNum}: no existe el aliado ${cod}.`)
          continue
        }

        const mesDate = parseMesEjecutiva(row.mes ?? '')
        if (!mesDate) {
          results.errors.push(`Fila ${rowNum}: mes inválido (usá YYYY-MM o "Mes Año").`)
          continue
        }

        const mesIso = mesDate.toISOString().slice(0, 10)
        const existing = await prisma.aliadoEjecutivaMensual.findFirst({
          where: { cod_aliado: cod, mes: mesDate },
        })

        if (!existing) {
          results.errors.push(`Fila ${rowNum}: no hay registro de ejecutiva para ${cod} en ${mesIso.slice(0, 7)}. Solo actualización, no alta.`)
          continue
        }

        if (existing.ejecutiva_nombre === nombre) {
          results.skipped++
          continue
        }

        results.changes.push({
          row: rowNum, key: cod, field: `ejecutiva (${mesIso.slice(0, 7)})`,
          from: existing.ejecutiva_nombre, to: nombre,
        })

        if (!dryRun) {
          await prisma.aliadoEjecutivaMensual.update({
            where: { id: existing.id },
            data:  { ejecutiva_nombre: nombre.slice(0, 150) },
          })
        }

        results.updated++
      } catch (rowErr) {
        results.errors.push(`Fila ${rowNum}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`)
      }
    }

    response.status(200).json({
      message: dryRun
        ? `Vista previa: ${results.updated} filas con cambios, ${results.skipped} sin cambios, ${results.errors.length} errores.`
        : `Actualización completada: ${results.updated} actualizados, ${results.skipped} sin cambios, ${results.errors.length} errores.`,
      total:    rows.length,
      inserted: 0,
      updated:  results.updated,
      skipped:  results.skipped,
      errors:   results.errors,
      changes:  results.changes,
      dryRun,
    })
  } catch (err) {
    console.error('[updateEjecutivasXlsx]', err)
    response.status(500).json({ message: 'Error al procesar el archivo.' })
  }
}
