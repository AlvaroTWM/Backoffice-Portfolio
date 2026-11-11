import { useEffect, useState } from 'react'
import { ArrowTopRightOnSquareIcon, PresentationChartBarIcon } from '@heroicons/react/24/outline'

import { fetchReports } from '../../services/loyaltyBackend'
import type { ReportCategory } from '../../services/loyaltyBackend'
import { reportPath } from './reportRoute'

export function ReportsView() {
  const [categories, setCategories] = useState<ReportCategory[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReports()
      .then(setCategories)
      .catch((err: Error) => setError(err.message))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Reportes</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Se abren en una pestaña nueva, a pantalla completa. Cada reporte tiene su propia URL.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : !categories ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando reportes…</p>
      ) : (
        categories.map((category) => (
          <section key={category.name} className="flex flex-col gap-3">
            <h2 className="text-xs font-black tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {category.name}
            </h2>
            {category.reports.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Todavía no hay reportes.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {category.reports.map((report) => {
                  const href = reportPath(report)
                  return (
                    <li key={href}>
                      <a
                        className="group flex h-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-500"
                        href={href}
                        // "opener" hace que la pestaña nueva herede la sesión (sessionStorage); con noopener cae en el login.
                        rel="opener"
                        target="_blank"
                      >
                        <span className="flex items-center justify-between">
                          <span className="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <PresentationChartBarIcon aria-hidden="true" className="size-5" />
                          </span>
                          <ArrowTopRightOnSquareIcon
                            aria-hidden="true"
                            className="size-5 text-slate-400 group-hover:text-emerald-600"
                          />
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{report.title}</span>
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{href}</span>
                        <span className="sr-only">(se abre en una pestaña nueva)</span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  )
}
