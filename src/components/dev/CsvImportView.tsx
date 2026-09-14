import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ArrowDownTrayIcon, ArrowUpTrayIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { getStoredJwt } from '../../services/auth'

const API_BASE = import.meta.env.VITE_API_URL?.trim() ?? ''

type ImportMode =
  | 'aliados'
  | 'facturas'
  | 'pagos'
  | 'update-aliados'
  | 'update-deudas'
  | 'update-ejecutivas'

type ParsedRow = Record<string, string>

interface ChangeEntry {
  row:   number
  key:   string
  field: string
  from:  string
  to:    string
}

interface ImportResult {
  message:  string
  total:    number
  inserted: number
  updated:  number
  skipped?: number
  deudas_creadas?: number
  deudas_actualizadas?: number
  deudas_omitidas?: number
  filas_sin_codigo?: number
  warnings?: string[]
  errors:   string[]
  changes?: ChangeEntry[]
  dryRun?:  boolean
}

function parseMontoPreview(raw: string | undefined): number {
  const n = Number(String(raw ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function summarizeAliadosImportRows(rows: ParsedRow[]) {
  const aliados = new Set<string>()
  let filasConDeuda = 0
  for (const row of rows) {
    if (row.cod_aliado?.trim()) aliados.add(row.cod_aliado.trim())
    if (parseMontoPreview(row.deuda_total) > 0) filasConDeuda++
  }
  return {
    filas: rows.length,
    aliadosUnicos: aliados.size,
    filasConDeuda,
  }
}

const ALIADOS_ALIASES: Record<string, string> = {
  cod_aliado: 'cod_aliado', deuda_id: 'deuda_id', id_deuda: 'deuda_id', aliado: 'aliado', brand: 'aliado',
  estado_aliado: 'estado_aliado', estado_aliad: 'estado_aliado',
  estado_deuda: 'estado_deuda', estado_deud: 'estado_deuda',
  ruc: 'ruc', ruc_aliado: 'ruc', periodo: 'periodo', servicio: 'servicio',
  deuda_total: 'deuda_total', 'deuda total': 'deuda_total', total: 'deuda_total',
  monto_compra: 'monto_compra', 'monto compra': 'monto_compra', monto_de_compra: 'monto_compra',
  absorbe_ueno: 'absorbe_ueno', 'absorbe ueno': 'absorbe_ueno', absorbe_uenó: 'absorbe_ueno',
  clientes: 'clientes', cliente: 'clientes',
  trx: 'trx', transacciones: 'trx', transaccion: 'trx',
  bolsa: 'bolsa', cartera: 'bolsa', rubro: 'rubro', categoria: 'rubro', categoría: 'rubro',
  ejecutiva: 'ejecutiva', ejecutiva_nombre: 'ejecutiva', nombre_ejecutiva: 'ejecutiva',
  ejecutivo: 'ejecutiva', asesor: 'ejecutiva', asesora: 'ejecutiva',
}

const FACTURA_ALIASES: Record<string, string> = {
  aliado: 'aliado', deuda_id: 'deuda_id', factura: 'factura',
}

const PAGOS_ALIASES: Record<string, string> = {
  deuda_id: 'deuda_id', id_deuda: 'deuda_id', factura_id: 'deuda_id',
  cod_aliado: 'cod_aliado', codigo_aliado: 'cod_aliado',
  num_factura: 'num_factura', factura: 'num_factura', nro_factura: 'num_factura',
  cuota_id: 'cuota_id', nro_cuota: 'nro_cuota',
  monto_pagado: 'monto_pagado', monto: 'monto_pagado', importe: 'monto_pagado',
  fecha_pago: 'fecha_pago', fecha: 'fecha_pago',
  referencia: 'referencia', comprobante: 'referencia', nro_comprobante: 'referencia',
  medio_pago: 'medio_pago', metodo_pago: 'medio_pago', medio: 'medio_pago',
  observacion: 'observacion', obs: 'observacion',
}

const UPDATE_ALIADOS_ALIASES: Record<string, string> = {
  cod_aliado: 'cod_aliado', aliado: 'aliado', brand: 'aliado',
  bolsa: 'bolsa', rubro: 'rubro', estado_aliado: 'estado_aliado', estado: 'estado_aliado',
  ruc: 'ruc', cod_persona: 'cod_persona', ejecutiva: 'ejecutiva', ejecutiva_nombre: 'ejecutiva',
}

const UPDATE_DEUDAS_ALIASES: Record<string, string> = {
  deuda_id: 'deuda_id', cod_aliado: 'cod_aliado', periodo: 'periodo',
  servicio: 'servicio', estado_deuda: 'estado_deuda', deuda_total: 'deuda_total',
}

const UPDATE_EJECUTIVAS_ALIASES: Record<string, string> = {
  cod_aliado: 'cod_aliado', mes: 'mes', periodo: 'mes',
  ejecutiva: 'ejecutiva', ejecutiva_nombre: 'ejecutiva',
}

const ALIADOS_METRICS_COLS = ['monto_compra', 'absorbe_ueno', 'deuda_total', 'clientes', 'trx']
const ALIADOS_DISPLAY_COLS = [
  'cod_aliado', 'deuda_id', 'aliado', 'bolsa', 'rubro', 'estado_aliado', 'estado_deuda',
  'ruc', 'periodo', 'servicio', ...ALIADOS_METRICS_COLS, 'ejecutiva',
]
const FACTURA_DISPLAY_COLS = ['aliado', 'deuda_id', 'factura']
const PAGOS_DISPLAY_COLS = ['deuda_id', 'cod_aliado', 'num_factura', 'nro_cuota', 'monto_pagado', 'fecha_pago', 'referencia', 'medio_pago', 'observacion']
const UPDATE_ALIADOS_COLS = ['cod_aliado', 'aliado', 'bolsa', 'rubro', 'estado_aliado', 'ruc', 'cod_persona', 'ejecutiva']
const UPDATE_DEUDAS_COLS = ['deuda_id', 'cod_aliado', 'periodo', 'servicio', 'estado_deuda', 'deuda_total']
const UPDATE_EJECUTIVAS_COLS = ['cod_aliado', 'mes', 'ejecutiva']

const MODE_CONFIG: Record<ImportMode, {
  title: string
  description: string
  endpoint: string
  exportEndpoint?: string
  displayCols: string[]
  aliases: Record<string, string>
  importLabel: string
  columnHint?: string
  isUpdate?: boolean
  supportsDryRun?: boolean
}> = {
  aliados: {
    title: 'Importar aliados',
    description: 'Subí un archivo .xlsx con aliados y deudas. Cada fila con monto genera una deuda independiente (aunque sea el mismo aliado y mes). El sistema asigna un deuda_id automático; incluí deuda_id en el archivo solo para actualizar una deuda existente.',
    endpoint: '/api/dev/import-aliados',
    exportEndpoint: '/api/dev/export-import-aliados',
    displayCols: ALIADOS_DISPLAY_COLS,
    aliases: ALIADOS_ALIASES,
    importLabel: 'Importar filas a la base de datos',
    columnHint: 'Los nombres de columna pueden variar: brand, cartera, categoría, ejecutiva_nombre, etc. Ejecutivas: Connie→Constanza, belu→Belen, Chi→Chiara, Vale→Valeria. Los campos monto_compra, absorbe_ueno, clientes y trx no se muestran en la app; solo en importación y en Exportar resumen.',
  },
  facturas: {
    title: 'Asignar números de factura',
    description: 'Subí un archivo .xlsx para asignar el N° de factura a cada deuda. Al asignarlo por primera vez, inicia el plazo de vencimiento a 30 días.',
    endpoint: '/api/dev/import-facturas',
    exportEndpoint: '/api/dev/export-import-facturas',
    displayCols: FACTURA_DISPLAY_COLS,
    aliases: FACTURA_ALIASES,
    importLabel: 'Asignar facturas en la base de datos',
    columnHint: 'Columnas: aliado, deuda_id y factura.',
  },
  pagos: {
    title: 'Pagos masivos',
    description: 'Registrá pagos contra deudas con factura asignada. El monto impacta la deuda principal y, si hay cuotas, aplica la cascada automáticamente (cuotas de la factura → saldo de deuda → cuotas vencidas de otras facturas → saldo a favor).',
    endpoint: '/api/dev/import-pagos',
    exportEndpoint: '/api/dev/export-import-pagos',
    displayCols: PAGOS_DISPLAY_COLS,
    aliases: PAGOS_ALIASES,
    importLabel: 'Registrar pagos en la base de datos',
    columnHint: 'Obligatorios: monto_pagado, fecha_pago, referencia y deuda_id (o cod_aliado + num_factura). La deuda debe tener factura asignada.',
    supportsDryRun: true,
  },
  'update-aliados': {
    title: 'Actualizar aliados',
    description: 'Admin y gerencia. Editá registros existentes por cod_aliado. Celdas vacías no sobrescriben. No crea aliados nuevos.',
    endpoint: '/api/dev/update-aliados',
    exportEndpoint: '/api/dev/export-aliados',
    displayCols: UPDATE_ALIADOS_COLS,
    aliases: UPDATE_ALIADOS_ALIASES,
    importLabel: 'Confirmar actualización',
    columnHint: 'Clave obligatoria: cod_aliado. Campos opcionales: aliado, bolsa, rubro, estado_aliado, ruc, cod_persona, ejecutiva.',
    isUpdate: true,
  },
  'update-deudas': {
    title: 'Actualizar deudas',
    description: 'Admin y gerencia. Editá deudas existentes por deuda_id o cod_aliado + periodo. El num_factura se asigna en la pestaña "Asignar facturas", no acá.',
    endpoint: '/api/dev/update-deudas',
    exportEndpoint: '/api/dev/export-deudas',
    displayCols: UPDATE_DEUDAS_COLS,
    aliases: UPDATE_DEUDAS_ALIASES,
    importLabel: 'Confirmar actualización',
    columnHint: 'No se puede cambiar deuda_total si ya hay pagos registrados.',
    isUpdate: true,
  },
  'update-ejecutivas': {
    title: 'Actualizar ejecutivas',
    description: 'Admin y gerencia. Corregí el histórico mensual de ejecutivas. Solo actualiza registros existentes (cod_aliado + mes).',
    endpoint: '/api/dev/update-ejecutivas',
    exportEndpoint: '/api/dev/export-ejecutivas',
    displayCols: UPDATE_EJECUTIVAS_COLS,
    aliases: UPDATE_EJECUTIVAS_ALIASES,
    importLabel: 'Confirmar actualización',
    columnHint: 'Mes en formato YYYY-MM o "Mes Año" (ej. 2026-09 o Septiembre 2026).',
    isUpdate: true,
  },
}

const MODE_TABS: { id: ImportMode; label: string; adminOnly?: boolean }[] = [
  { id: 'aliados',          label: 'Importar aliados' },
  { id: 'facturas',         label: 'Asignar facturas' },
  { id: 'pagos',            label: 'Pagos masivos' },
  { id: 'update-aliados',   label: 'Actualizar aliados',   adminOnly: true },
  { id: 'update-deudas',    label: 'Actualizar deudas',    adminOnly: true },
  { id: 'update-ejecutivas', label: 'Actualizar ejecutivas', adminOnly: true },
]

function parseXlsx(buffer: ArrayBuffer, aliases: Record<string, string>, displayCols: string[]) {
  const workbook  = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet     = workbook.Sheets[sheetName]
  const raw       = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  if (raw.length === 0) return { headers: [], rows: [] }

  const rows = raw.map((row) => {
    const out: ParsedRow = {}
    for (const [key, val] of Object.entries(row)) {
      const alias = aliases[key.toLowerCase().trim()]
      if (!alias) continue
      if ((alias === 'deuda_total' || alias === 'monto_compra' || alias === 'absorbe_ueno') && typeof val === 'number') {
        out[alias] = isFinite(val) ? String(Math.round(val)) : ''
      } else if (alias === 'monto_pagado' && typeof val === 'number') {
        out[alias] = isFinite(val) ? String(Math.round(val)) : ''
      } else {
        out[alias] = String(val).trim()
      }
    }
    return out
  })

  const headers = displayCols.filter((c) => rows.some((r) => c in r))
  return { headers, rows }
}

const TEMPLATE_EXAMPLES: Partial<Record<ImportMode, Record<string, string>>> = {
  aliados: {
    cod_aliado: '12345', deuda_id: '100523', aliado: 'EJEMPLO ALIADO SA',
    bolsa: 'A', rubro: 'Retail', estado_aliado: 'Activo', estado_deuda: 'Pendiente',
    ruc: '80012345-6', periodo: 'Septiembre 2026', servicio: 'upys',
    monto_compra: '2000000', absorbe_ueno: '500000', deuda_total: '1500000', clientes: '120', trx: '340',
    ejecutiva: 'Valeria',
  },
  facturas: { aliado: 'EJEMPLO ALIADO SA', deuda_id: '100523', factura: '001-001-0001234' },
  pagos: {
    deuda_id: '100523', cod_aliado: '12345', num_factura: '001-001-0001234',
    nro_cuota: '1', monto_pagado: '500000', fecha_pago: '2026-09-10', referencia: 'TRX-001', medio_pago: 'Transferencia',
  },
  'update-deudas': { deuda_id: '100523', cod_aliado: '12345', periodo: 'Septiembre 2026', servicio: 'upys', estado_deuda: 'Pendiente', deuda_total: '1500000' },
}

function downloadTemplate(cols: string[], filename: string, example?: Record<string, string>) {
  const rows = example
    ? [cols, cols.map((col) => example[col] ?? '')]
    : [cols]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const book  = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'plantilla')
  XLSX.writeFile(book, filename)
}

interface CsvImportViewProps {
  canUseUpdateTabs?: boolean
  roleLabel?: string
}

export function CsvImportView({ canUseUpdateTabs = false, roleLabel = 'Operaciones' }: CsvImportViewProps) {
  const inputRef                    = useRef<HTMLInputElement>(null)
  const [mode, setMode]             = useState<ImportMode>('aliados')
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile]             = useState<File | null>(null)
  const [rows, setRows]             = useState<ParsedRow[]>([])
  const [headers, setHeaders]       = useState<string[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExporting, setIsExporting]   = useState(false)
  const [result, setResult]         = useState<ImportResult | null>(null)
  const [previewDone, setPreviewDone] = useState(false)

  const config = MODE_CONFIG[mode]
  const visibleTabs = MODE_TABS.filter((t) => !t.adminOnly || canUseUpdateTabs)

  function clearFile() {
    setFile(null)
    setRows([])
    setHeaders([])
    setParseError(null)
    setResult(null)
    setPreviewDone(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function switchMode(next: ImportMode) {
    if (next === mode) return
    clearFile()
    setMode(next)
  }

  function handleFile(f: File) {
    setResult(null)
    setPreviewDone(false)
    setParseError(null)
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls'].includes(ext ?? '')) {
      setParseError('Solo se aceptan archivos .xlsx o .xls')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const { headers: h, rows: r } = parseXlsx(
          e.target!.result as ArrayBuffer,
          config.aliases,
          config.displayCols,
        )
        if (r.length === 0) {
          setParseError('El archivo está vacío o no tiene el formato esperado.')
          return
        }

        if (mode === 'facturas') {
          const missingCols = FACTURA_DISPLAY_COLS.filter((col) => !r.some((row) => row[col]))
          if (missingCols.length > 0) {
            setParseError(`Faltan columnas obligatorias: ${missingCols.join(', ')}`)
            return
          }
        }

        setFile(f)
        setHeaders(h.length > 0 ? h : config.displayCols)
        setRows(r)
      } catch {
        setParseError('No se pudo leer el archivo. Verificá que sea un Excel válido.')
      }
    }
    reader.readAsArrayBuffer(f)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  async function submitFile(dryRun: boolean) {
    if (!file) return
    setIsSubmitting(true)
    if (!dryRun) setResult(null)
    try {
      const token    = getStoredJwt()
      const formData = new FormData()
      formData.append('file', file)

      const url = `${API_BASE}${config.endpoint}${dryRun ? '?dryRun=true' : ''}`
      const res  = await fetch(url, {
        method:  'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    formData,
      })
      const data = (await res.json()) as ImportResult
      setResult(data)
      if (dryRun) setPreviewDone(true)
      else setPreviewDone(false)
    } catch {
      setResult({ message: 'Error de red al enviar el archivo.', total: 0, inserted: 0, updated: 0, errors: [] })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleExport() {
    if (!config.exportEndpoint) return
    setIsExporting(true)
    try {
      const token = getStoredJwt()
      const res   = await fetch(`${API_BASE}${config.exportEndpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = config.exportEndpoint.split('/').pop() + '.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setParseError('No se pudo exportar los datos actuales.')
    } finally {
      setIsExporting(false)
    }
  }

  const previewRows = rows.slice(0, 6)
  const importSummary = mode === 'aliados' ? summarizeAliadosImportRows(rows) : null
  const isUpdateMode = Boolean(config.isUpdate)
  const useDryRunFlow = isUpdateMode || Boolean(config.supportsDryRun)

  return (
    <section className="animate-fade-up space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Herramientas — {roleLabel}
        </p>
        <h1 className="mt-0.5 text-2xl font-black text-slate-900 dark:text-white">
          Importaciones desde Excel
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Elegí el tipo de carga y subí un archivo <strong>.xlsx</strong>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
              mode === tab.id
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
            onClick={() => switchMode(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-sm font-semibold text-slate-800 dark:text-white">{config.title}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{config.description}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadTemplate(config.displayCols, `plantilla-${mode}.xlsx`, TEMPLATE_EXAMPLES[mode])}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
          >
            <ArrowDownTrayIcon className="size-3.5" />
            Descargar plantilla
          </button>
          {config.exportEndpoint ? (
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleExport()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
            >
              <ArrowDownTrayIcon className="size-3.5" />
              {isExporting ? 'Exportando...' : 'Exportar datos actuales'}
            </button>
          ) : null}
        </div>

        <p className="mb-2 mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Columnas esperadas</p>
        <div className="flex flex-wrap gap-2">
          {config.displayCols.map((col) => (
            <code key={col} className="rounded-md bg-white px-2 py-0.5 font-mono text-xs text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600">
              {col}
            </code>
          ))}
        </div>
        {config.columnHint ? (
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">{config.columnHint}</p>
        ) : null}
        {mode === 'facturas' ? (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">aliado</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">deuda_id</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">factura</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">MAXI AVENTURA ENCARNACION</td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">100523</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">001-001-0001234</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 transition ${
            isDragging
              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
          }`}
        >
          <div className="grid size-14 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <ArrowUpTrayIcon className="size-7 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Arrastrá el archivo aquí</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">o hacé clic para seleccionar · .xlsx / .xls</p>
          </div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} />
        </div>
      )}

      {parseError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
          <XCircleIcon className="size-4 shrink-0" />
          {parseError}
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{file?.name}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {rows.length} filas
                {importSummary
                  ? ` · ${importSummary.aliadosUnicos} aliados únicos · ${importSummary.filasConDeuda} deudas a registrar`
                  : ''}
                {' · '}vista previa de las primeras {previewRows.length}
              </p>
              {importSummary && importSummary.filas > importSummary.aliadosUnicos ? (
                <p className="mt-1 text-[11px] text-sky-600 dark:text-sky-400">
                  El listado de aliados muestra 1 fila por comercio; las {importSummary.filasConDeuda} deudas por período quedan en el detalle de cada aliado.
                </p>
              ) : null}
            </div>
            <button type="button" onClick={clearFile}
              className="text-xs text-slate-400 transition hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400">
              Cambiar archivo
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  {headers.map((col) => (
                    <th key={col} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {previewRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    {headers.map((col) => (
                      <td key={col} className="max-w-[220px] truncate px-3 py-2.5 text-slate-700 dark:text-slate-300">
                        {row[col] || <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(!result || result.dryRun) && (
            <div className="flex flex-wrap gap-2">
              {useDryRunFlow ? (
                <>
                  <button
                    type="button"
                    onClick={() => void submitFile(true)}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Analizando...' : mode === 'pagos' ? `Vista previa de pagos (${rows.length})` : `Vista previa de cambios (${rows.length})`}
                  </button>
                  {previewDone && result?.dryRun && (
                    <button
                      type="button"
                      onClick={() => void submitFile(false)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                    >
                      {isSubmitting ? 'Procesando...' : config.importLabel}
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void submitFile(false)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Procesando {rows.length} filas...
                    </>
                  ) : (
                    <>
                      <ArrowUpTrayIcon className="size-4" />
                      {config.importLabel} ({rows.length})
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className={`space-y-3 rounded-2xl border p-5 ${
          result.errors.length > 0
            ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
            : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
        }`}>
          <div className="flex items-start gap-2">
            {result.errors.length > 0
              ? <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              : <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            }
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{result.message}</p>
          </div>

          <div className="flex flex-wrap gap-5 text-sm">
            {mode === 'aliados' && !result.dryRun ? (
              <>
                <div className="text-center">
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{result.inserted}</p>
                  <p className="text-xs text-slate-500">Aliados nuevos</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-sky-600 dark:text-sky-400">{result.updated}</p>
                  <p className="text-xs text-slate-500">Aliados actualizados</p>
                </div>
                {typeof result.deudas_creadas === 'number' ? (
                  <div className="text-center">
                    <p className="text-xl font-black text-violet-600 dark:text-violet-400">{result.deudas_creadas}</p>
                    <p className="text-xs text-slate-500">Deudas creadas</p>
                  </div>
                ) : null}
                {typeof result.deudas_actualizadas === 'number' ? (
                  <div className="text-center">
                    <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{result.deudas_actualizadas}</p>
                    <p className="text-xs text-slate-500">Deudas actualizadas</p>
                  </div>
                ) : null}
                {typeof result.deudas_omitidas === 'number' && result.deudas_omitidas > 0 ? (
                  <div className="text-center">
                    <p className="text-xl font-black text-slate-500">{result.deudas_omitidas}</p>
                    <p className="text-xs text-slate-500">Sin deuda (monto 0)</p>
                  </div>
                ) : null}
              </>
            ) : null}
            {mode === 'pagos' && !result.dryRun ? (
              <div className="text-center">
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{result.inserted}</p>
                <p className="text-xs text-slate-500">Pagos registrados</p>
              </div>
            ) : null}
            {mode !== 'aliados' && mode !== 'pagos' && !result.dryRun ? (
              <div className="text-center">
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{result.inserted}</p>
                <p className="text-xs text-slate-500">Nuevos</p>
              </div>
            ) : null}
            {mode !== 'aliados' && mode !== 'pagos' ? (
              <div className="text-center">
                <p className="text-xl font-black text-sky-600 dark:text-sky-400">{result.updated}</p>
                <p className="text-xs text-slate-500">{result.dryRun ? 'Con cambios' : 'Actualizados'}</p>
              </div>
            ) : null}
            {mode === 'pagos' && result.dryRun ? (
              <div className="text-center">
                <p className="text-xl font-black text-sky-600 dark:text-sky-400">{result.inserted}</p>
                <p className="text-xs text-slate-500">Pagos simulados</p>
              </div>
            ) : null}
            {typeof result.skipped === 'number' ? (
              <div className="text-center">
                <p className="text-xl font-black text-slate-500">{result.skipped}</p>
                <p className="text-xs text-slate-500">Sin cambios</p>
              </div>
            ) : null}
            <div className="text-center">
              <p className="text-xl font-black text-slate-400">{result.total}</p>
              <p className="text-xs text-slate-500">Total filas</p>
            </div>
            {result.errors.length > 0 && (
              <div className="text-center">
                <p className="text-xl font-black text-rose-500">{result.errors.length}</p>
                <p className="text-xs text-slate-500">Errores</p>
              </div>
            )}
            {(result.warnings?.length ?? 0) > 0 && (
              <div className="text-center">
                <p className="text-xl font-black text-amber-600 dark:text-amber-400">{result.warnings!.length}</p>
                <p className="text-xs text-slate-500">Avisos</p>
              </div>
            )}
          </div>

          {result.changes && result.changes.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg bg-white/60 p-3 dark:bg-slate-900/40">
              <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {result.dryRun ? 'Cambios detectados' : 'Cambios aplicados'}
              </p>
              {result.changes.slice(0, 50).map((c, i) => (
                <p key={i} className="text-xs text-slate-600 dark:text-slate-400">
                  Fila {c.row} · <span className="font-mono">{c.key}</span> · {c.field}:{' '}
                  <span className="text-rose-500 line-through">{c.from || '—'}</span>
                  {' → '}
                  <span className="text-emerald-600 dark:text-emerald-400">{c.to}</span>
                </p>
              ))}
              {result.changes.length > 50 && (
                <p className="mt-1 text-xs text-slate-400">... y {result.changes.length - 50} más</p>
              )}
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg bg-white/60 p-3 dark:bg-slate-900/40">
              <p className="mb-1 text-xs font-semibold text-rose-600 dark:text-rose-400">Errores</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-rose-600 dark:text-rose-400">{e}</p>
              ))}
            </div>
          )}

          {(result.warnings?.length ?? 0) > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg bg-white/60 p-3 dark:bg-slate-900/40">
              <p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-400">Avisos</p>
              {result.warnings!.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-400">{w}</p>
              ))}
            </div>
          )}

          {result.dryRun && previewDone && result.updated > 0 && rows.length > 0 && (
            <button
              type="button"
              onClick={() => void submitFile(false)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Aplicando...' : 'Confirmar actualización'}
            </button>
          )}

          {!result.dryRun && (
            <button type="button" onClick={clearFile}
              className="text-xs font-medium text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              {isUpdateMode ? 'Actualizar otro archivo' : 'Importar otro archivo'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
