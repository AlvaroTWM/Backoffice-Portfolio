import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import type { ChartOptions } from 'chart.js'
import { Bar, Chart } from 'react-chartjs-2'
import { useEffect, useMemo, useState } from 'react'

import type { DashboardStats } from '../../services/loyaltyBackend'
import { fetchDashboardStats } from '../../services/loyaltyBackend'
import { getChartPalette } from '../../constants/chartPalette'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Tooltip,
  Legend,
  Filler,
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('es-PY', {
    currency: 'PYG',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Math.round(n || 0))
}

function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function mesLabel(iso: string): string {
  const [, month] = iso.split('-')
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return names[Number(month) - 1] ?? iso
}

interface ChartTheme {
  gridColor: string
  tickColor: string
  tooltipBg: string
  tooltipTitle: string
  tooltipBody: string
  tooltipBorder: string
}

function getChartTheme(isDark: boolean): ChartTheme {
  return isDark
    ? {
        gridColor: 'rgba(203, 213, 225, 0.2)',
        tickColor: '#e2e8f0',
        tooltipBg: '#334155',
        tooltipTitle: '#f8fafc',
        tooltipBody: '#f1f5f9',
        tooltipBorder: '#64748b',
      }
    : {
        gridColor: 'rgba(148, 163, 184, 0.35)',
        tickColor: '#64748b',
        tooltipBg: '#ffffff',
        tooltipTitle: '#334155',
        tooltipBody: '#475569',
        tooltipBorder: '#e2e8f0',
      }
}

function baseChartOptions(theme: ChartTheme, extra?: object): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: theme.tickColor, boxWidth: 10, boxHeight: 10, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.tooltipTitle,
        bodyColor: theme.tooltipBody,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: { color: theme.gridColor },
        ticks: { color: theme.tickColor, font: { size: 10 } },
      },
      y: {
        grid: { color: theme.gridColor },
        ticks: {
          color: theme.tickColor,
          font: { size: 10 },
          callback: (v: string | number) => fmt(Number(v)),
        },
      },
    },
    ...extra,
  } as ChartOptions<'bar'>
}

//Apartado que utilizamos para mostrar el ejemplo de facturas con cuotas
const MOCK_FACTURAS_CUOTAS = [
  { cuotas: '1', cantidad: 42 },
  { cuotas: '2', cantidad: 28 },
  { cuotas: '3', cantidad: 19 },
  { cuotas: '4', cantidad: 11 },
  { cuotas: '5+', cantidad: 7 },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-600 ${className}`} />
}

function ChartPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:shadow-md dark:shadow-black/25 ${className}`}>
      {children}
    </div>
  )
}

function PanelTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{children}</p>
      {subtitle && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-300">{subtitle}</p>}
    </div>
  )
}

function KpiCard({ label, loading, value }: { label: string; loading: boolean; value: string }) {
  return (
    <ChartPanel className="!p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : (
        <p className="mt-1 text-base font-black tabular-nums text-slate-900 dark:text-slate-50 sm:text-lg">{value}</p>
      )}
    </ChartPanel>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="h-4 w-1 rounded-full bg-[#519964] dark:bg-[#8EC79B]" />
      <h2 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-100">{children}</h2>
    </div>
  )
}

function MockBadge() {
  return (
    <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:bg-amber-400/20 dark:text-amber-300">
      demo
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DashboardViewProps {
  isDark: boolean
}

export function DashboardView({ isDark }: DashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [serviciosOpciones, setServiciosOpciones] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroMes, setFiltroMes] = useState<'12m' | '6m' | 'ytd'>('12m')
  const [filtroServicio, setFiltroServicio] = useState('todos')

  const theme = useMemo(() => getChartTheme(isDark), [isDark])
  const palette = useMemo(() => getChartPalette(isDark), [isDark])

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchDashboardStats({
      period: filtroMes,
      servicio: filtroServicio === 'todos' ? undefined : filtroServicio,
    })
      .then((data) => {
        setStats(data)
        if (data.serviciosDisponibles.length > 0) {
          setServiciosOpciones(data.serviciosDisponibles)
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error al cargar el dashboard'))
      .finally(() => setLoading(false))
  }, [filtroMes, filtroServicio])

  const historicoRecobro = useMemo(
    () => (stats?.historicoRecobro ?? []).map(r => ({
      mes: mesLabel(r.mes),
      vencido: r.vencido,
      vigente: r.vigente,
      pagado: r.pagado,
    })),
    [stats?.historicoRecobro],
  )

  const compromisosHistorico = useMemo(
    () => (stats?.compromisosHistorico ?? []).map(r => ({
      mes: mesLabel(r.mes),
      pagadoATiempo: r.pagadoATiempo,
      vencido: r.vencido,
      pendiente: r.pendiente,
    })),
    [stats?.compromisosHistorico],
  )

  const paretoLabels = (stats?.pareto ?? []).map(p =>
    p.aliado.length > 10 ? `${p.aliado.slice(0, 10)}…` : p.aliado,
  )
  const paretoDeuda = (stats?.pareto ?? []).map(p => p.deuda)
  const paretoAcum = (stats?.pareto ?? []).map(p => p.acumulado)

  const mixLabels = (stats?.mixServicio ?? []).map(s => s.servicio)
  const mixMontos = (stats?.mixServicio ?? []).map(s => s.monto)

  const incumplidos = stats?.compromisosIncumplidos ?? []
  const deudaPorEjecutiva = stats?.deudaPorEjecutiva ?? []

  const chartKey = `${isDark ? 'dark' : 'light'}-${filtroMes}-${filtroServicio}`

  const selectClass =
    'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-[#519964] focus:outline-none dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100'

  const historicoOptions = useMemo(() => baseChartOptions(theme, {
    scales: {
      x: { stacked: true, grid: { color: theme.gridColor }, ticks: { color: theme.tickColor, font: { size: 10 } } },
      y: {
        stacked: true,
        grid: { color: theme.gridColor },
        ticks: { color: theme.tickColor, font: { size: 10 }, callback: (v: string | number) => fmt(Number(v)) },
      },
    },
  }), [theme])

  const facturasOptions = useMemo(() => baseChartOptions(theme, {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.tickColor } },
      y: { grid: { color: theme.gridColor }, ticks: { color: theme.tickColor, stepSize: 10 } },
    },
  }), [theme])

  const paretoOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: theme.tickColor, boxWidth: 10, font: { size: 10 } } },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.tooltipTitle,
        bodyColor: theme.tooltipBody,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            ctx.dataset.label === 'Acumulado %'
              ? `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(1)}%`
              : `${ctx.dataset.label}: ${fmt(Number(ctx.raw))}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.tickColor, font: { size: 9 }, maxRotation: 45 } },
      y: {
        position: 'left' as const,
        grid: { color: theme.gridColor },
        ticks: { color: theme.tickColor, font: { size: 9 }, callback: (v: string | number) => fmt(Number(v)) },
      },
      y1: {
        position: 'right' as const,
        min: 0,
        max: 100,
        grid: { drawOnChartArea: false },
        ticks: { color: palette.accentLine, font: { size: 9 }, callback: (v: string | number) => `${v}%` },
      },
    },
  }), [theme, palette.accentLine])

  const compromisosOptions = useMemo(() => baseChartOptions(theme, {
    scales: {
      x: { stacked: true, grid: { color: theme.gridColor }, ticks: { color: theme.tickColor, font: { size: 10 } } },
      y: {
        stacked: true,
        grid: { color: theme.gridColor },
        ticks: { color: theme.tickColor, font: { size: 10 }, callback: (v: string | number) => fmt(Number(v)) },
      },
    },
  }), [theme])

  const horizontalBarOptions = useMemo(() => baseChartOptions(theme, {
    indexAxis: 'y' as const,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { color: theme.gridColor },
        ticks: { color: theme.tickColor, font: { size: 10 }, callback: (v: string | number) => fmt(Number(v)) },
      },
      y: { grid: { display: false }, ticks: { color: theme.tickColor, font: { size: 11 } } },
    },
  }), [theme])

  const verticalBarOptions = useMemo(() => baseChartOptions(theme, {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.tickColor } },
      y: { grid: { color: theme.gridColor }, ticks: { color: theme.tickColor, callback: (v: string | number) => fmt(Number(v)) } },
    },
  }), [theme])

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* ── Fila 1: KPIs ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Aliados con deuda" loading={loading} value={loading ? '—' : String(stats?.aliadosConDeuda ?? 0)} />
        <KpiCard label="Deudas sin factura" loading={loading} value={loading ? '—' : String(stats?.deudasSinFactura ?? 0)} />
        <KpiCard label="Deuda pendiente" loading={loading} value={loading ? '—' : fmt(stats?.deudaTotalPendiente ?? 0)} />
        <KpiCard
          label={filtroMes === 'ytd' ? 'Total cobrado (año)' : filtroMes === '6m' ? 'Total cobrado (6m)' : 'Total cobrado (12m)'}
          loading={loading}
          value={loading ? '—' : fmt(stats?.totalCobrado ?? 0)}
        />
        <KpiCard label="Deuda vencida" loading={loading} value={loading ? '—' : fmt(stats?.deudaVencida ?? 0)} />
      </div>

      {/* ── Fila 2: Filtros ── */}
      <ChartPanel className="!py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-200">Filtros:</span>
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-200">
            Período
            <select
              className={selectClass}
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value as '12m' | '6m' | 'ytd')}
            >
              <option value="12m">Últimos 12 meses</option>
              <option value="6m">Últimos 6 meses</option>
              <option value="ytd">Año en curso</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-200">
            Tipo de servicio
            <select className={selectClass} value={filtroServicio} onChange={e => setFiltroServicio(e.target.value)}>
              <option value="todos">Todos</option>
              {serviciosOpciones.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          {loading ? (
            <span className="text-[10px] text-slate-400 dark:text-slate-400">Actualizando datos…</span>
          ) : null}
        </div>
      </ChartPanel>

      {/* ── Fila 3: Histórico Recobro ── */}
      <ChartPanel>
        <PanelTitle subtitle="Por mes de vencimiento: saldo vencido, vigente y cobrado">
          Histórico Recobro
        </PanelTitle>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : historicoRecobro.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
            Sin cuotas con fecha de vencimiento en los últimos 12 meses.
          </div>
        ) : (
          <div className="h-64">
            <Bar
              key={`historico-${chartKey}`}
              data={{
                labels: historicoRecobro.map(r => r.mes),
                datasets: [
                  { label: 'Vencido', data: historicoRecobro.map(r => r.vencido), backgroundColor: palette.stack.negative, stack: 'stack' },
                  { label: 'Vigente', data: historicoRecobro.map(r => r.vigente), backgroundColor: palette.stack.neutral, stack: 'stack' },
                  { label: 'Pagado', data: historicoRecobro.map(r => r.pagado), backgroundColor: palette.stack.positive, stack: 'stack' },
                ],
              }}
              options={historicoOptions}
            />
          </div>
        )}
      </ChartPanel>

      {/* ── Fila 4: 2 columnas ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel>
          <PanelTitle>
            Cantidad de facturas por cuotas
            <MockBadge />
          </PanelTitle>
          {loading ? <Skeleton className="h-52 w-full" /> : (
            <div className="h-52">
              <Bar
                key={`facturas-${chartKey}`}
                data={{
                  labels: MOCK_FACTURAS_CUOTAS.map(r => r.cuotas),
                  datasets: [{
                    label: 'Facturas',
                    data: MOCK_FACTURAS_CUOTAS.map(r => r.cantidad),
                    backgroundColor: palette.primary,
                    borderRadius: 4,
                  }],
                }}
                options={facturasOptions}
              />
            </div>
          )}
        </ChartPanel>

        <ChartPanel>
          <PanelTitle subtitle="Top 10 aliados + % del resto">
            Concentración de la deuda pendiente Top 10 %
          </PanelTitle>
          {loading ? <Skeleton className="h-52 w-full" /> : paretoLabels.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-500 dark:text-slate-300">Sin datos de deuda.</div>
          ) : (
            <div className="h-52">
              <Chart
                key={`pareto-${chartKey}`}
                type="bar"
                redraw
                data={{
                  labels: paretoLabels,
                  datasets: [
                    {
                      type: 'bar',
                      label: 'Deuda',
                      data: paretoDeuda,
                      backgroundColor: palette.primary,
                      borderRadius: 3,
                      yAxisID: 'y',
                    },
                    {
                      type: 'line',
                      label: 'Acumulado %',
                      data: paretoAcum,
                      borderColor: palette.accentLine,
                      backgroundColor: 'transparent',
                      pointRadius: 0,
                      borderWidth: 2,
                      yAxisID: 'y1',
                    },
                  ],
                }}
                options={paretoOptions}
              />
            </div>
          )}
        </ChartPanel>
      </div>

      {/* ── Proyección de cobros (ancho completo) ── */}
      <ChartPanel className="flex min-h-[10rem] flex-col">
        <PanelTitle subtitle="Saldo pendiente por fecha de vencimiento (acumulado)">
          Proyección de cobros
        </PanelTitle>
        {loading ? (
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (stats?.proyeccion.d30 ?? 0) === 0
          && (stats?.proyeccion.d60 ?? 0) === 0
          && (stats?.proyeccion.d90 ?? 0) === 0
          && (stats?.proyeccion.d120 ?? 0) === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
            Pagos pendientes con fecha de vencimiento.
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: '30 días', v: stats?.proyeccion.d30 ?? 0, color: palette.projection[0] },
              { label: '60 días', v: stats?.proyeccion.d60 ?? 0, color: palette.projection[1] },
              { label: '90 días', v: stats?.proyeccion.d90 ?? 0, color: palette.projection[2] },
              { label: '120 días', v: stats?.proyeccion.d120 ?? 0, color: palette.projection[3] },
            ].map(({ color, label, v }) => (
              <div
                key={label}
                className="flex h-full min-h-[5.5rem] flex-col justify-center rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-600 dark:bg-slate-900/40"
              >
                <div className="flex items-center gap-2">
                  <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-300">{label}</span>
                </div>
                <p className="mt-2 text-sm font-black tabular-nums text-slate-900 dark:text-slate-50 sm:text-base">{fmt(v)}</p>
              </div>
            ))}
          </div>
        )}
      </ChartPanel>

      {/* ── Fila 5: Compromisos de pago ── */}
      <ChartPanel>
        <PanelTitle subtitle="Apilado: Pagado a tiempo, Vencido sin pagar, Pendiente">
          Compromisos de pago
        </PanelTitle>
        {loading ? <Skeleton className="h-64 w-full" /> : compromisosHistorico.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
            Sin compromisos de pago registrados.
          </div>
        ) : (
          <div className="h-64">
            <Bar
              key={`compromisos-${chartKey}`}
              data={{
                labels: compromisosHistorico.map(r => r.mes),
                datasets: [
                  { label: 'Pagado a tiempo', data: compromisosHistorico.map(r => r.pagadoATiempo), backgroundColor: palette.stack.positive, stack: 'stack' },
                  { label: 'Vencido', data: compromisosHistorico.map(r => r.vencido), backgroundColor: palette.stack.negative, stack: 'stack' },
                  { label: 'Pendiente', data: compromisosHistorico.map(r => r.pendiente), backgroundColor: palette.stack.neutral, stack: 'stack' },
                ],
              }}
              options={compromisosOptions}
            />
          </div>
        )}
      </ChartPanel>

      {/* ── Fila 6: Concentración por comercio ── */}
      <ChartPanel>
        <PanelTitle>Concentración de deuda (comercio)</PanelTitle>
        {loading ? <Skeleton className="h-56 w-full" /> : mixLabels.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-slate-500 dark:text-slate-300">Sin datos por servicio.</div>
        ) : (
          <div className="h-56">
            <Bar
              key={`comercio-${chartKey}`}
              data={{
                labels: mixLabels,
                datasets: [{
                  label: 'Deuda pendiente',
                  data: mixMontos,
                  backgroundColor: palette.series.slice(0, mixLabels.length),
                  borderRadius: 4,
                }],
              }}
              options={horizontalBarOptions}
            />
          </div>
        )}
      </ChartPanel>

      {/* ── Fila 7: Ejecutiva + Compromisos incumplidos ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel>
          <PanelTitle subtitle="Mes en curso según asignación en aliado_ejecutiva_mensual">
            Deuda pendiente por ejecutiva
          </PanelTitle>
          {loading ? <Skeleton className="h-52 w-full" /> : deudaPorEjecutiva.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
              Sin asignaciones de ejecutiva para el mes actual.
            </div>
          ) : (
            <div className="h-52">
              <Bar
                key={`ejecutiva-${chartKey}`}
                data={{
                  labels: deudaPorEjecutiva.map(e => e.ejecutiva_nombre),
                  datasets: [{
                    label: 'Deuda',
                    data: deudaPorEjecutiva.map(e => e.deuda),
                    backgroundColor: palette.secondary,
                    borderRadius: 4,
                  }],
                }}
                options={verticalBarOptions}
              />
            </div>
          )}
        </ChartPanel>

        <ChartPanel>
          <PanelTitle subtitle="Top 10 aliados por monto en compromisos vencidos">
            Compromisos incumplidos
          </PanelTitle>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : incumplidos.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
              Sin compromisos incumplidos.
            </div>
          ) : (
            <div className="h-52">
              <Bar
                key={`incumplidos-${chartKey}`}
                data={{
                  labels: incumplidos.map(r =>
                    r.aliado_nombre.length > 12 ? `${r.aliado_nombre.slice(0, 12)}…` : r.aliado_nombre,
                  ),
                  datasets: [{
                    label: 'Monto incumplido',
                    data: incumplidos.map(r => r.monto_incumplido),
                    backgroundColor: palette.stack.negative,
                    borderRadius: 4,
                  }],
                }}
                options={verticalBarOptions}
              />
            </div>
          )}
        </ChartPanel>
      </div>

      {/* ── Fila 8: Cuentas críticas ── */}
      <div>
        <SectionTitle>Cuentas críticas — Top 20 por deuda vencida</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:shadow-md dark:shadow-black/20">
          {loading ? (
            <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !stats?.cuentasCriticas.length ? (
            <div className="flex h-24 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
              Sin cuentas vencidas. ¡Cartera sana!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#DCEFDE]/60 dark:border-slate-600 dark:bg-[#1D482C]/40">
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-200">#</th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-200">Aliado</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-200">Deuda vencida</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-200">Días máx.</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-200">Último pago</th>
                    <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-200">Nivel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
                  {stats.cuentasCriticas.map((c, i) => {
                    const nivel = c.dias_max > 90 ? { label: 'Crítico', cls: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200' }
                      : c.dias_max > 60 ? { label: 'Alto', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-200' }
                      : c.dias_max > 30 ? { label: 'Medio', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200' }
                      : { label: 'Bajo', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-200' }
                    return (
                      <tr key={c.cod_aliado} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60">
                        <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{c.aliado_nombre}</td>
                        <td className="px-4 py-3 text-right font-black text-rose-600 dark:text-rose-300">{fmt(c.deuda_vencida)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{c.dias_max}d</td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-300">{c.ultima_fecha_pago ? fmtDate(c.ultima_fecha_pago) : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${nivel.cls}`}>{nivel.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Fila 9: Próximos vencimientos ── */}
      <div>
        <SectionTitle>Próximos vencimientos — Top 10 por monto (30 días)</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:shadow-md dark:shadow-black/20">
          {loading ? (
            <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !stats?.proximosVencimientos.length ? (
            <div className="flex h-24 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
              Sin vencimientos en los próximos 30 días.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#DCEFDE]/60 dark:border-slate-600 dark:bg-[#1D482C]/40">
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-200">Aliado</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-200">Monto</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-200">Vence</th>
                    <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-200">Días restantes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
                  {stats.proximosVencimientos.map(v => {
                    const urgente = v.dias_restantes <= 7
                    return (
                      <tr key={v.cuota_id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60">
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{v.aliado_nombre}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-slate-50">{fmt(v.monto)}</td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-300">{fmtDate(v.fecha_vencimiento)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black
                            ${urgente ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200' : 'bg-[#DCEFDE] text-[#425A33] dark:bg-[#1D482C]/50 dark:text-[#B8DFC1]'}`}>
                            {urgente && '⚠ '}{v.dias_restantes === 0 ? 'Hoy' : `${v.dias_restantes}d`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
