import {
  ArrowPathIcon,
  BanknotesIcon,
  BellAlertIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { useEffect, useMemo, useRef, useState } from 'react'

import { exportarAliados, exportarAliadosDeudaDetalle, obtenerFiltrosAliados } from '../../services/alliesApi'
import type {
  AliadoDetalle,
  AliadosListQuery,
  AliadosListTotales,
  AliadoResumen,
  CrearFacturaPayload,
  ImportarDeudasPayload,
  ImportarDeudasResult,
  RegistrarPagoPayload,
} from '../../types/allyDebt'
import {
  PILL_TONE_CLASS,
  formatGs,
  formatNumber,
  percent,
  pluralDays,
  relativeMinutes,
  toTitleCase,
  type PillTone,
} from '../../utils/allyFormat'
import { useAllyPlan } from '../../hooks/useAllyPlan'
import { pickPaymentTarget } from '../../utils/allyPayment'
import { parseCatalogMulti, serializeCatalogMulti } from '../../utils/catalogNormalize'
import { Input } from '../ui/Input'
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown'
import { Select } from '../ui/Select'
import { AllyDetailDrawer } from './AllyDetailDrawer'
import { OverdueAlliesPopover } from './OverdueAlliesPopover'
import { RegistrarPagoModal, type RegistrarPagoModalTarget } from './RegistrarPagoModal'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [25, 50, 100]
const ACTIVE_FILTER_BORDER = '!border-loyalty-fresh'
const COMPACT_CONTROL = '!py-2'

function readAllyParam(): string | null {
  return new URLSearchParams(window.location.search).get('aliado')
}

function writeAllyParam(id: string | null) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('aliado', id)
  else url.searchParams.delete('aliado')
  window.history.replaceState(null, '', url)
}

/** El color comunica urgencia: gris = sin urgencia, ámbar = vence pronto, rojo = vencido, verde = pagado. */
function debtPill(ally: AliadoResumen): { label: string; tone: PillTone } {
  const { estado_general: estado, dias_para_vencer: soon, dias_vencido: late } = ally
  if (estado === 'pagado') return { label: 'Pagado', tone: 'success' }
  if (estado === 'con_vencimiento') {
    return late && late > 0
      ? { label: `Vencido hace ${pluralDays(late)}`, tone: 'danger' }
      : { label: 'Con vencimiento', tone: 'danger' }
  }
  if (estado !== 'sin_deuda' && soon != null && soon >= 0 && soon <= 7) {
    return { label: soon === 0 ? 'Vence hoy' : `Vence en ${pluralDays(soon)}`, tone: 'warning' }
  }
  if (estado === 'parcial') return { label: 'Parcial', tone: 'neutral' }
  if (estado === 'pendiente') return { label: 'Pendiente', tone: 'neutral' }
  return { label: 'Sin deuda', tone: 'neutral' }
}

function allyStatusDot(estado: string): { className: string; title: string } | null {
  const key = (estado || '').trim().toLowerCase()
  if (!key || key === 'activo') return null
  if (key === 'suspendido') return { className: 'bg-rose-500', title: 'Aliado suspendido' }
  return { className: 'bg-slate-400', title: key === 'inactivo' ? 'Aliado inactivo' : `Aliado ${key}` }
}

// ─── Piezas visuales ─────────────────────────────────────────────────────────

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`} />
}

interface KpiCardProps {
  label: string
  value: string
  detail: string
  loading: boolean
  danger?: boolean
  /** Si se pasa, la tarjeta es un botón que aplica un filtro de la tabla. */
  onClick?: () => void
  active?: boolean
  title?: string
}

function KpiCard({ active = false, danger = false, detail, label, loading, onClick, title, value }: KpiCardProps) {
  const interactive = Boolean(onClick)
  const Tag = interactive ? 'button' : 'div'
  return (
    <Tag
      {...(interactive ? { type: 'button' as const, onClick, 'aria-expanded': active, 'aria-haspopup': 'dialog' as const, title } : {})}
      className={`block h-full w-full rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition-[colors,box-shadow,transform] duration-150 dark:bg-slate-800/60 ${
        danger
          ? 'border-rose-300/70 dark:border-rose-500/40'
          : 'border-slate-200 dark:border-slate-700'
      } ${
        interactive
          ? 'cursor-pointer hover:shadow-md active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400'
          : ''
      } ${active ? 'ring-2 ring-rose-400 dark:ring-rose-500' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        {danger ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-rose-500" /> : null}
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      {loading ? (
        <>
          <SkeletonBlock className="mt-2 h-7 w-36" />
          <SkeletonBlock className="mt-2 h-3.5 w-28" />
        </>
      ) : (
        <>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              danger ? 'text-rose-600 dark:text-rose-300' : 'text-slate-900 dark:text-slate-50'
            }`}
          >
            {value}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">{detail}</p>
        </>
      )}
    </Tag>
  )
}

interface ExportMenuProps {
  disabled: boolean
  exporting: boolean
  onExportDetalle: () => void
  onExportResumen: () => void
}

function ExportMenu({ disabled, exporting, onExportDetalle, onExportResumen }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const itemClass =
    'block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700'

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-loyalty-fresh disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {exporting ? 'Exportando…' : 'Exportar'}
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div
          className="animate-soft-pop absolute right-0 z-30 mt-1 w-64 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
          role="menu"
        >
          <button
            className={itemClass}
            onClick={() => { setOpen(false); onExportDetalle() }}
            role="menuitem"
            type="button"
          >
            Exportar desglose pendientes
          </button>
          <button
            className={itemClass}
            onClick={() => { setOpen(false); onExportResumen() }}
            role="menuitem"
            type="button"
          >
            Exportar resumen
          </button>
        </div>
      ) : null}
    </div>
  )
}

// ─── Fila ────────────────────────────────────────────────────────────────────

interface AllyRowProps {
  ally: AliadoResumen
  isSelected: boolean
  onOpen: (ally: AliadoResumen) => void
  onPay: (ally: AliadoResumen) => void
}

const actionBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-loyalty-fresh disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'

function AllyRow({ ally, isSelected, onOpen, onPay }: AllyRowProps) {
  const dot = allyStatusDot(ally.estado)
  const pill = debtPill(ally)
  const pct = percent(ally.monto_total_pagado, ally.deuda_total)
  const name = toTitleCase(ally.aliado_nombre)

  return (
    <tr
      className={`group cursor-pointer transition-colors duration-150 ${
        isSelected
          ? 'bg-loyalty-fresh/10 dark:bg-loyalty-fresh/10'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
      }`}
      onClick={() => onOpen(ally)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(ally)
      }}
      tabIndex={0}
    >
      <td className="px-4 py-2 align-middle">
        <div className="flex min-w-0 items-center gap-2">
          {dot ? (
            <span
              aria-label={dot.title}
              className={`h-2 w-2 shrink-0 rounded-full ${dot.className}`}
              role="img"
              title={dot.title}
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50" title={ally.aliado_nombre}>
              {name}
            </p>
            <p className="truncate text-[13px] text-slate-500 dark:text-slate-400">{ally.ruc || '—'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-2 align-middle">
        <p className="truncate text-sm text-slate-800 dark:text-slate-200">{ally.bolsa || '—'}</p>
        <p className="truncate text-[13px] text-slate-500 dark:text-slate-400">{ally.rubro || '—'}</p>
      </td>
      <td className="px-4 py-2 align-middle">
        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL_TONE_CLASS[pill.tone]}`}>
          {pill.label}
        </span>
      </td>
      <td className="px-4 py-2 text-right align-middle">
        <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
          {formatNumber(ally.saldo_pendiente)}
        </p>
        <div className="my-1 flex items-center justify-end gap-2">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full rounded-full bg-loyalty-fresh" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-8 text-right text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            {Math.round(pct)}%
          </span>
        </div>
        <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">de {formatNumber(ally.deuda_total)}</p>
      </td>
      <td className="px-3 py-2 align-middle">
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <button
            aria-label="Ver detalle"
            className={actionBtn}
            onClick={(e) => { e.stopPropagation(); onOpen(ally) }}
            title="Ver detalle"
            type="button"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            aria-label="Registrar pago"
            className={actionBtn}
            disabled={ally.saldo_pendiente <= 0}
            onClick={(e) => { e.stopPropagation(); onPay(ally) }}
            title={ally.saldo_pendiente <= 0 ? 'Sin saldo pendiente' : 'Registrar pago'}
            type="button"
          >
            <BanknotesIcon className="h-4 w-4" />
          </button>
          <button
            aria-label="Enviar recordatorio"
            className={actionBtn}
            disabled
            onClick={(e) => e.stopPropagation()}
            title="Enviar recordatorio (próximamente)"
            type="button"
          >
            <BellAlertIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      <td className="px-4 py-2">
        <SkeletonBlock className="h-4 w-44" />
        <SkeletonBlock className="mt-1.5 h-3 w-24" />
      </td>
      <td className="px-4 py-2">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="mt-1.5 h-3 w-20" />
      </td>
      <td className="px-4 py-2"><SkeletonBlock className="h-5 w-24 rounded-full" /></td>
      <td className="px-4 py-2">
        <SkeletonBlock className="ml-auto h-4 w-24" />
        <SkeletonBlock className="ml-auto mt-1.5 h-2 w-28" />
        <SkeletonBlock className="ml-auto mt-1.5 h-3 w-20" />
      </td>
      <td className="px-3 py-2" />
    </tr>
  )
}

// ─── Vista ───────────────────────────────────────────────────────────────────

interface AlliesPaymentsViewProps {
  allies: AliadoResumen[]
  filters: AliadosListQuery
  error?: string | null
  isDetailLoading?: boolean
  isLoading?: boolean
  onCreateFactura: (payload: CrearFacturaPayload) => Promise<void>
  onFiltersChange: (filters: {
    allyStatus?: AliadosListQuery['allyStatus']
    bolsa?: string
    debtStatus?: AliadosListQuery['debtStatus']
    ejecutiva?: string
    name?: string
    periodOrder?: AliadosListQuery['periodOrder']
    rubro?: string
    servicio?: string
  }) => void
  onImportDebts?: (payload: ImportarDeudasPayload) => Promise<ImportarDeudasResult>
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  /** Carga el detalle sin salir de la lista (drawer). */
  onPreviewAlly: (allyId: string | number) => Promise<void>
  onRegisterPayment: (payload: RegistrarPagoPayload) => Promise<void>
  onRefresh: () => Promise<void>
  /** Carga el detalle y abre la página completa. */
  onSelectAlly: (allyId: string | number) => Promise<void>
  page: number
  pageSize: number
  selectedAllyDetail: AliadoDetalle | null
  selectedAllyId: string | number | null
  totalAllies: number
  totales?: AliadosListTotales | null
  totalPages: number
}

export function AlliesPaymentsView({
  allies,
  filters,
  error = null,
  isDetailLoading = false,
  isLoading = false,
  onFiltersChange,
  onPageChange,
  onPageSizeChange,
  onPreviewAlly,
  onRefresh,
  onRegisterPayment,
  onSelectAlly,
  page,
  pageSize,
  selectedAllyDetail,
  totalAllies,
  totales = null,
  totalPages,
}: AlliesPaymentsViewProps) {
  const [nameInput, setNameInput] = useState(filters.name ?? '')
  const [bolsas, setBolsas] = useState<string[]>([])
  const [rubros, setRubros] = useState<string[]>([])
  const [servicios, setServicios] = useState<string[]>([])
  const [ejecutivas, setEjecutivas] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportingDetalle, setExportingDetalle] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [drawerAllyId, setDrawerAllyId] = useState<string | null>(() => readAllyParam())
  const [pagoTarget, setPagoTarget] = useState<RegistrarPagoModalTarget | null>(null)
  const pendingPagoRef = useRef(false)
  const [overdueOpen, setOverdueOpen] = useState(false)
  const overdueRef = useRef<HTMLDivElement>(null)

  // Cierra el panel de mora al hacer click afuera o con Esc
  useEffect(() => {
    if (!overdueOpen) return
    const onDown = (e: MouseEvent) => {
      if (overdueRef.current && !overdueRef.current.contains(e.target as Node)) setOverdueOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverdueOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [overdueOpen])

  useEffect(() => {
    void obtenerFiltrosAliados()
      .then(({ bolsas: b, rubros: r, servicios: s, ejecutivas: e }) => {
        setBolsas(b)
        setRubros(r)
        setServicios(s)
        setEjecutivas(e)
      })
      .catch(() => {
        setBolsas([])
        setRubros([])
        setServicios([])
        setEjecutivas([])
      })
  }, [])

  useEffect(() => {
    setNameInput(filters.name ?? '')
  }, [filters.name])

  // Búsqueda por nombre con debounce (~300 ms)
  useEffect(() => {
    const currentName = filters.name ?? ''
    if (nameInput === currentName) return

    const timeoutId = window.setTimeout(() => {
      onFiltersChange({ name: nameInput })
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [nameInput, filters.name, onFiltersChange])

  // "Actualizado hace X min"
  useEffect(() => {
    if (!isLoading) setUpdatedAt(Date.now())
  }, [isLoading])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // Link compartido (?aliado=ID): carga el detalle al montar
  useEffect(() => {
    const id = readAllyParam()
    if (id) void onPreviewAlly(id)
    // solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const detailMatches =
    selectedAllyDetail !== null && drawerAllyId !== null && String(selectedAllyDetail.aliado.aliado_id) === drawerAllyId
  const { detail: drawerDetail, isLoading: isPlanLoading } = useAllyPlan(detailMatches ? selectedAllyDetail : null)
  const drawerSummary = drawerAllyId
    ? allies.find((a) => String(a.aliado_id) === drawerAllyId)
    : undefined
  const drawerPaymentTarget = useMemo(() => pickPaymentTarget(drawerDetail), [drawerDetail])

  // "Registrar pago" desde la fila: abre el modal apenas llega el detalle
  useEffect(() => {
    if (!pendingPagoRef.current || !drawerDetail) return
    pendingPagoRef.current = false
    setPagoTarget(pickPaymentTarget(drawerDetail))
  }, [drawerDetail])

  const openDrawer = (ally: AliadoResumen) => {
    const id = String(ally.aliado_id)
    setDrawerAllyId(id)
    writeAllyParam(id)
    void onPreviewAlly(ally.aliado_id)
  }

  const closeDrawer = () => {
    setDrawerAllyId(null)
    writeAllyParam(null)
  }

  const openFullPage = () => {
    if (!drawerAllyId) return
    writeAllyParam(null)
    void onSelectAlly(drawerAllyId)
  }

  const payFromRow = (ally: AliadoResumen) => {
    pendingPagoRef.current = true
    openDrawer(ally)
  }

  // KPIs: totales de todos los aliados que cumplen el filtro, no de la página visible.
  const kpis = useMemo(() => {
    if (totales) {
      return {
        original: totales.deuda_total,
        balance: totales.saldo_pendiente,
        paid: totales.monto_pagado,
        overdue: totales.vencido,
        overdueAllies: totales.aliados_en_mora,
        paidPct: percent(totales.monto_pagado, totales.deuda_total),
      }
    }
    let original = 0
    let balance = 0
    let paid = 0
    let overdue = 0
    let overdueAllies = 0
    for (const a of allies) {
      original += a.deuda_total
      balance += a.saldo_pendiente
      paid += a.monto_total_pagado
      if (a.estado_general === 'con_vencimiento') {
        overdue += a.saldo_pendiente
        overdueAllies += 1
      }
    }
    return { original, balance, paid, overdue, overdueAllies, paidPct: percent(paid, original) }
  }, [allies, totales])

  // Filtros activos (solo presentación: no cambia valores ni orden)
  const bolsaSel = parseCatalogMulti(filters.bolsa)
  const rubroSel = parseCatalogMulti(filters.rubro)
  const servicioSel = parseCatalogMulti(filters.servicio)
  const ejecutivaSel = parseCatalogMulti(filters.ejecutiva)
  const nameActive = nameInput.trim() !== ''
  const debtActive = (filters.debtStatus ?? 'all') !== 'all'
  const allyStatusActive = (filters.allyStatus ?? 'all') !== 'all'
  const hasActiveFilters =
    nameActive ||
    debtActive ||
    allyStatusActive ||
    bolsaSel.length > 0 ||
    rubroSel.length > 0 ||
    servicioSel.length > 0 ||
    ejecutivaSel.length > 0

  const clearFilters = () => {
    setNameInput('')
    onFiltersChange({
      name: '',
      debtStatus: 'all',
      allyStatus: 'all',
      bolsa: 'all',
      rubro: 'all',
      servicio: 'all',
      ejecutiva: 'all',
    })
  }

  const handleExportCsv = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await exportarAliados({
        name: filters.name,
        debtStatus: filters.debtStatus,
        allyStatus: filters.allyStatus,
        bolsa: filters.bolsa,
        rubro: filters.rubro,
        servicio: filters.servicio,
        ejecutiva: filters.ejecutiva,
        periodOrder: filters.periodOrder,
      })
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Error al exportar aliados.')
    } finally {
      setExporting(false)
    }
  }

  const handleExportDetalleCsv = async () => {
    setExportingDetalle(true)
    setExportError(null)
    try {
      await exportarAliadosDeudaDetalle({
        name: filters.name,
        debtStatus: filters.debtStatus === 'all' ? 'con_saldo' : filters.debtStatus,
        allyStatus: filters.allyStatus,
        bolsa: filters.bolsa,
        rubro: filters.rubro,
        servicio: filters.servicio,
        ejecutiva: filters.ejecutiva,
        periodOrder: filters.periodOrder,
      })
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Error al exportar desglose de deudas.')
    } finally {
      setExportingDetalle(false)
    }
  }

  const rangeStart = allies.length === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = allies.length === 0 ? 0 : rangeStart + allies.length - 1
  const pageSizeOptions = PAGE_SIZE_OPTIONS.includes(pageSize)
    ? PAGE_SIZE_OPTIONS
    : [...PAGE_SIZE_OPTIONS, pageSize].sort((a, b) => a - b)
  const skeletonRows = Math.min(Math.max(allies.length, 8), 12)
  const showEmpty = !isLoading && allies.length === 0 && !error

  const thClass =
    'px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400'

  return (
    <section className="animate-fade-up animate-delay-2 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Aliados</p>
          <h2 className="mt-0.5 text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Seguimiento general de deuda y pagos
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">
            Revisá el estado de cada aliado y abrí su detalle para ver cuotas y pagos.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            aria-label="Actualizar datos"
            className="inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-loyalty-fresh disabled:cursor-wait dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            disabled={isLoading}
            onClick={() => void onRefresh()}
            type="button"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="tabular-nums">{isLoading ? 'Actualizando…' : relativeMinutes(updatedAt, now)}</span>
          </button>
          <ExportMenu
            disabled={isLoading || exporting || exportingDetalle}
            exporting={exporting || exportingDetalle}
            onExportDetalle={() => void handleExportDetalleCsv()}
            onExportResumen={() => void handleExportCsv()}
          />
        </div>
      </div>

      {/* Filtros (sin cambios funcionales: mismos campos, orden y valores) */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="min-w-[140px] flex-1">
          <Input
            className={`${COMPACT_CONTROL} ${nameActive ? ACTIVE_FILTER_BORDER : ''}`}
            id="allyNameFilter"
            label="Aliado"
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Buscar por nombre"
            value={nameInput}
          />
        </div>
        <div className="min-w-[130px]">
          <Select
            className={`${COMPACT_CONTROL} ${debtActive ? ACTIVE_FILTER_BORDER : ''}`}
            id="debtStatusFilter"
            label="Estado de deuda"
            onChange={(e) => onFiltersChange({
              debtStatus: e.target.value as AliadosListQuery['debtStatus'],
            })}
            value={filters.debtStatus ?? 'all'}
          >
            <option value="all">Todos</option>
            <option value="con_saldo">Con saldo pendiente</option>
            <option value="pendiente">Pendiente</option>
            <option value="parcial">Parcial</option>
            <option value="con_vencimiento">Con vencimiento</option>
            <option value="pagado">Pagado</option>
            <option value="sin_deuda">Sin deuda</option>
          </Select>
        </div>
        <div className="min-w-[130px]">
          <MultiSelectDropdown
            allLabel="Todas"
            buttonClassName={COMPACT_CONTROL}
            id="bolsaFilter"
            label="Bolsa"
            onChange={(next) => onFiltersChange({ bolsa: serializeCatalogMulti(next) })}
            options={bolsas}
            selected={bolsaSel}
          />
        </div>
        <div className="min-w-[130px]">
          <MultiSelectDropdown
            allLabel="Todos"
            buttonClassName={COMPACT_CONTROL}
            id="rubroFilter"
            label="Rubro"
            onChange={(next) => onFiltersChange({ rubro: serializeCatalogMulti(next) })}
            options={rubros}
            selected={rubroSel}
          />
        </div>
        <div className="min-w-[130px]">
          <MultiSelectDropdown
            allLabel="Todos"
            buttonClassName={COMPACT_CONTROL}
            id="servicioFilter"
            label="Tipo de servicio"
            onChange={(next) => onFiltersChange({ servicio: serializeCatalogMulti(next) })}
            options={servicios}
            selected={servicioSel}
          />
        </div>
        <div className="min-w-[130px]">
          <MultiSelectDropdown
            allLabel="Todas"
            buttonClassName={COMPACT_CONTROL}
            id="ejecutivaFilter"
            label="Ejecutiva"
            onChange={(next) => onFiltersChange({ ejecutiva: serializeCatalogMulti(next) })}
            options={ejecutivas}
            selected={ejecutivaSel}
          />
        </div>
        <div className="min-w-[130px]">
          <Select
            className={`${COMPACT_CONTROL} ${allyStatusActive ? ACTIVE_FILTER_BORDER : ''}`}
            id="allyStatusFilter"
            label="Estado del aliado"
            onChange={(e) => onFiltersChange({ allyStatus: e.target.value as 'all' | 'activo' | 'inactivo' })}
            value={filters.allyStatus ?? 'all'}
          >
            <option value="all">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </Select>
        </div>
        <div className="min-w-[150px]">
          <Select
            className={COMPACT_CONTROL}
            id="periodOrderFilter"
            label="Ordenar por"
            onChange={(e) => onFiltersChange({
              periodOrder: e.target.value as AliadosListQuery['periodOrder'],
            })}
            value={filters.periodOrder ?? 'recent'}
          >
            <option value="recent">Período: más reciente</option>
            <option value="oldest">Período: más antiguo</option>
            <option value="amount_desc">Saldo: mayor a menor</option>
            <option value="amount_asc">Saldo: menor a mayor</option>
          </Select>
        </div>
        {hasActiveFilters ? (
          <button
            className="animate-soft-pop mb-2 ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-loyalty-fresh-strong underline-offset-2 transition-colors duration-150 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-loyalty-fresh dark:text-loyalty-fresh-soft"
            onClick={clearFilters}
            type="button"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          detail={`de ${formatGs(kpis.original)} original`}
          label="Saldo pendiente"
          loading={isLoading}
          value={formatGs(kpis.balance)}
        />
        <div ref={overdueRef} className="relative h-full">
          <KpiCard
            active={overdueOpen}
            danger
            onClick={() => setOverdueOpen((open) => !open)}
            title="Ver aliados en mora"
            detail={`${kpis.overdueAllies} ${kpis.overdueAllies === 1 ? 'aliado' : 'aliados'} en mora`}
            label="Vencido"
            loading={isLoading}
            value={formatGs(kpis.overdue)}
          />
          {overdueOpen ? (
            <OverdueAlliesPopover
              filters={filters}
              onClose={() => setOverdueOpen(false)}
              onSelect={(ally) => {
                setOverdueOpen(false)
                openDrawer(ally)
              }}
            />
          ) : null}
        </div>
        <KpiCard
          detail={`${Math.round(kpis.paidPct)}% del total original`}
          label="Cobrado"
          loading={isLoading}
          value={formatGs(kpis.paid)}
        />
        <KpiCard
          detail={`Mostrando ${allies.length}`}
          label="Aliados"
          loading={isLoading}
          value={formatNumber(totalAllies)}
        />
      </div>

      {error ? (
        <div className="animate-soft-pop rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      ) : null}

      {exportError ? (
        <div className="animate-soft-pop rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
          {exportError}
        </div>
      ) : null}

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        {showEmpty ? (
          <div className="animate-soft-pop flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <MagnifyingGlassIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No hay aliados con estos filtros</p>
            {hasActiveFilters ? (
              <button
                className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-loyalty-fresh dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={clearFilters}
                type="button"
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>
        ) : (
          <div className="max-h-[calc(100vh-22rem)] min-h-[20rem] overflow-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgba(148,163,184,0.25)] dark:bg-slate-800">
                <tr>
                  <th className={`${thClass} w-[30%]`}>Aliado</th>
                  <th className={`${thClass} w-[20%]`}>Bolsa</th>
                  <th className={`${thClass} w-[17%]`}>Estado deuda</th>
                  <th className={`${thClass} w-[23%] text-right`}>Saldo (Gs.)</th>
                  <th className={`${thClass} w-[10%]`}><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 bg-white text-slate-700 dark:divide-white/5 dark:bg-slate-900 dark:text-slate-300">
                {isLoading
                  ? Array.from({ length: skeletonRows }, (_, i) => <SkeletonRow key={`sk-${i}`} />)
                  : allies.map((ally) => (
                    <AllyRow
                      key={ally.aliado_id}
                      ally={ally}
                      isSelected={drawerAllyId === String(ally.aliado_id)}
                      onOpen={openDrawer}
                      onPay={payFromRow}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          <span className="font-medium tabular-nums">
            {rangeStart}–{rangeEnd} de {formatNumber(totalAllies)}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">Filas por página</span>
              <select
                aria-label="Filas por página"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none transition-colors duration-150 focus:border-loyalty-fresh dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                value={pageSize}
              >
                {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button
                aria-label="Página anterior"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white transition-colors duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                disabled={page <= 1 || isLoading}
                onClick={() => onPageChange(page - 1)}
                type="button"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[4.5rem] text-center tabular-nums">Pág. {page} / {totalPages}</span>
              <button
                aria-label="Página siguiente"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white transition-colors duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                disabled={page >= totalPages || isLoading}
                onClick={() => onPageChange(page + 1)}
                type="button"
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {drawerAllyId ? (
        <AllyDetailDrawer
          key={drawerAllyId}
          canRegisterPayment={drawerPaymentTarget !== null}
          detail={drawerDetail}
          isLoading={isDetailLoading || isPlanLoading}
          onClose={closeDrawer}
          onOpenFullPage={openFullPage}
          onRegisterPayment={() => setPagoTarget(drawerPaymentTarget)}
          summary={drawerSummary}
        />
      ) : null}

      <RegistrarPagoModal
        onClose={() => setPagoTarget(null)}
        onSubmit={onRegisterPayment}
        open={pagoTarget !== null}
        saldoAFavorActual={drawerDetail?.resumen.saldo_a_favor ?? 0}
        target={pagoTarget}
      />
    </section>
  )
}
