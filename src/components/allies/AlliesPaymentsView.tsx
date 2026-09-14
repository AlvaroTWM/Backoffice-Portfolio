import { useEffect, useMemo, useState } from 'react'

import { exportarAliados, exportarAliadosDeudaDetalle, obtenerFiltrosAliados } from '../../services/alliesApi'
import type {
  AliadoDetalle,
  AliadosListQuery,
  AliadoResumen,
  CrearFacturaPayload,
  EstadoGeneralDeuda,
  ImportarDeudasPayload,
  ImportarDeudasResult,
  RegistrarPagoPayload,
} from '../../types/allyDebt'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const debtStatusLabels: Record<EstadoGeneralDeuda, string> = {
  pagado: 'Pagado',
  parcial: 'Parcial',
  pendiente: 'Pendiente',
  con_vencimiento: 'Con vencimiento',
  sin_deuda: 'Sin deuda',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-PY', {
    currency: 'PYG',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount)
}

function getStatusStyles(status: string) {
  switch (status) {
    case 'pagado':
    case 'pagada':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
    case 'parcial':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400'
    case 'vencida':
    case 'con_vencimiento':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
    case 'pendiente':
    default:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
  }
}

// ─── AllyRow (fila principal + fila expandida) ────────────────────────────────

interface AllyRowProps {
  ally: AliadoResumen
  isSelected: boolean
  onSelectAlly: (id: string | number) => Promise<void>
}

function AllyRow({ ally, isSelected, onSelectAlly }: AllyRowProps) {
  return (
    <tr
      className={`cursor-pointer transition-colors ${
        isSelected
          ? 'bg-emerald-50/60 dark:bg-emerald-900/20'
          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/50'
      }`}
      onClick={() => void onSelectAlly(ally.aliado_id)}
    >
      <td className="px-3 py-3">
        <p className="font-black text-slate-950 dark:text-white">{ally.aliado_nombre}</p>
      </td>
      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{ally.bolsa ?? '—'}</td>
      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{ally.rubro ?? '—'}</td>
      <td className="px-3 py-3">
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
          {ally.estado || 'Sin estado'}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusStyles(ally.estado_general)}`}>
          {debtStatusLabels[ally.estado_general]}
        </span>
      </td>
      <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{ally.ruc ?? '—'}</td>
      <td className="px-3 py-3">{formatCurrency(ally.deuda_total)}</td>
      <td className="px-3 py-3">{formatCurrency(ally.monto_total_pagado)}</td>
      <td className="px-3 py-3 font-bold text-slate-950 dark:text-white">
        {formatCurrency(ally.saldo_pendiente)}
      </td>
      <td className="px-3 py-3">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 dark:text-slate-500">
          <svg fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" className="h-4 w-4">
            <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </td>
    </tr>
  )
}

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
  onRegisterPayment: (payload: RegistrarPagoPayload) => Promise<void>
  onRefresh: () => Promise<void>
  onSelectAlly: (allyId: string | number) => Promise<void>
  page: number
  selectedAllyDetail: AliadoDetalle | null
  selectedAllyId: string | number | null
  totalAllies: number
  totalPages: number
}

export function AlliesPaymentsView({
  allies,
  filters,
  error = null,
  isLoading = false,
  onFiltersChange,
  onPageChange,
  onRefresh,
  onSelectAlly,
  page,
  selectedAllyId,
  totalAllies,
  totalPages,
}: AlliesPaymentsViewProps) {
  const filteredAllies = allies
  const [nameInput, setNameInput] = useState(filters.name ?? '')
  const [bolsas, setBolsas] = useState<string[]>([])
  const [rubros, setRubros] = useState<string[]>([])
  const [servicios, setServicios] = useState<string[]>([])
  const [ejecutivas, setEjecutivas] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportingDetalle, setExportingDetalle] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

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

  useEffect(() => {
    const currentName = filters.name ?? ''
    if (nameInput === currentName) return

    const timeoutId = window.setTimeout(() => {
      onFiltersChange({ name: nameInput })
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [nameInput, filters.name, onFiltersChange])

  const visibleDebt = useMemo(
    () => filteredAllies.reduce((total, ally) => total + ally.deuda_total, 0),
    [filteredAllies],
  )

  const visibleBalance = useMemo(
    () => filteredAllies.reduce((total, ally) => total + ally.saldo_pendiente, 0),
    [filteredAllies],
  )

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

  return (
    <section className="animate-fade-up animate-delay-2 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Aliados</p>
          <h2 className="mt-0.5 text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Seguimiento general de deuda y pagos
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">
            Revisá el estado de cada aliado y entrá al detalle para ver cuotas y pagos.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
            disabled={exportingDetalle || isLoading}
            onClick={() => void handleExportDetalleCsv()}
            type="button"
          >
            {exportingDetalle ? 'Exportando...' : 'Exportar desglose pendientes'}
          </button>
          <button
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            disabled={exporting || isLoading}
            onClick={() => void handleExportCsv()}
            type="button"
          >
            {exporting ? 'Exportando...' : 'Exportar resumen'}
          </button>
          <Button className="interactive-lift shrink-0" onClick={() => void onRefresh()} variant="ghost">
            Actualizar
          </Button>
        </div>
      </div>




      {/* Filtros en línea */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="flex-1 min-w-[140px]">
          <Input
            id="allyNameFilter"
            label="Aliado"
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Buscar por nombre"
            value={nameInput}
          />
        </div>
        <div className="min-w-[130px]">
          <Select
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
          <Select
            id="bolsaFilter"
            label="Bolsa"
            onChange={(e) => onFiltersChange({ bolsa: e.target.value })}
            value={filters.bolsa ?? 'all'}
          >
            <option value="all">Todas</option>
            {bolsas.map((bolsa) => (
              <option key={bolsa} value={bolsa}>{bolsa}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-[130px]">
          <Select
            id="rubroFilter"
            label="Rubro"
            onChange={(e) => onFiltersChange({ rubro: e.target.value })}
            value={filters.rubro ?? 'all'}
          >
            <option value="all">Todos</option>
            {rubros.map((rubro) => (
              <option key={rubro} value={rubro}>{rubro}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-[130px]">
          <Select
            id="servicioFilter"
            label="Tipo de servicio"
            onChange={(e) => onFiltersChange({ servicio: e.target.value })}
            value={filters.servicio ?? 'all'}
          >
            <option value="all">Todos</option>
            {servicios.map((svc) => (
              <option key={svc} value={svc}>{svc}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-[130px]">
          <Select
            id="ejecutivaFilter"
            label="Ejecutiva"
            onChange={(e) => onFiltersChange({ ejecutiva: e.target.value })}
            value={filters.ejecutiva ?? 'all'}
          >
            <option value="all">Todas</option>
            {ejecutivas.map((ej) => (
              <option key={ej} value={ej}>{ej}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-[130px]">
          <Select
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
        <div className="ml-auto flex flex-col items-end gap-0.5 text-xs font-black text-slate-700 dark:text-slate-300">
          <span>
            Mostrando: {filteredAllies.length} de {totalAllies}
          </span>
          <span>Monto original visible: {formatCurrency(visibleDebt)}</span>
          <span className="text-slate-500 dark:text-slate-400">Saldo pendiente visible: {formatCurrency(visibleBalance)}</span>
        </div>
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

      {isLoading ? (
        <div className="animate-soft-pop rounded-xl border border-dashed border-emerald-950/15 bg-emerald-50/45 px-6 py-14 text-center text-sm font-medium text-slate-500 dark:border-emerald-800/30 dark:bg-emerald-900/10 dark:text-slate-400">
          Cargando aliados y resumen de pagos...
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-slate-700">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">Aliado</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">Bolsa</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">Rubro</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">Estado aliado</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">Estado deuda</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">RUC</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">Deuda total</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">Pagado</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">Saldo</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700 dark:divide-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {filteredAllies.map((ally) => (
                  <AllyRow
                    key={ally.aliado_id}
                    ally={ally}
                    isSelected={selectedAllyId === ally.aliado_id}
                    onSelectAlly={onSelectAlly}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
              <button
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                type="button"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={`page-${p}`} className="flex items-center gap-2">
                    {idx > 0 && p - arr[idx - 1] > 1 ? (
                      <span className="px-1 text-xs text-slate-400 dark:text-slate-500">…</span>
                    ) : null}
                    <button
                      className={`h-9 min-w-9 rounded-md border px-3 text-sm font-black ${
                        p === page
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
                      }`}
                      onClick={() => onPageChange(p)}
                      type="button"
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                type="button"
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
