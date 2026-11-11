import { useState, type FormEvent, type ReactNode } from 'react'
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline'

import { useDarkMode } from '../../hooks/useDarkMode'

const API_BASE = import.meta.env.VITE_API_URL?.trim() ?? ''

type ClienteConsulta = {
  documento: string
  campanas: string[]
  informaciones: string[]
}

export function BaseUnicaClientesPage() {
  const { isDark, toggle } = useDarkMode()
  const [documento, setDocumento] = useState('')
  const [consulta, setConsulta] = useState<ClienteConsulta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = documento.trim()
    if (!value) return
    setIsLoading(true)
    setError(null)
    setConsulta(null)
    try {
      const response = await fetch(`${API_BASE}/api/clientes?documento=${encodeURIComponent(value)}`)
      const data = (await response.json()) as ClienteConsulta & { message?: string }
      if (!response.ok) {
        setError(data.message ?? 'No se pudo consultar el documento.')
        return
      }
      setConsulta(data)
    } catch {
      setError('No se pudo consultar el documento.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-loyalty-beige p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <a href="/" className="flex items-center gap-3">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-500 text-xs font-black text-white">L</span>
            <span className="text-sm font-black tracking-wide text-slate-900 dark:text-white">Loyalty</span>
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              onClick={toggle}
              className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-transform duration-150 ease-loyalty-out hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
            </button>
            <form className="flex items-center gap-2" onSubmit={(event) => void onSubmit(event)}>
              <label className="sr-only" htmlFor="nro-documento">
                Nro. de documento
              </label>
              <input
                id="nro-documento"
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Nro. de documento"
                value={documento}
                onChange={(event) => setDocumento(event.target.value)}
                className="h-9 w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-loyalty-fresh focus:ring-2 focus:ring-loyalty-fresh/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="h-9 rounded-lg bg-loyalty-fresh px-4 text-sm font-semibold text-white transition-transform duration-150 ease-loyalty-out hover:bg-loyalty-fresh-strong active:scale-[0.97] disabled:opacity-70 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                Consultar
              </button>
            </form>
          </div>
        </header>

        <section className="grid items-start gap-4 lg:grid-cols-2">
          <Panel
            title="Campañas asignadas"
            count={consulta?.campanas.length}
            centered={!consulta?.campanas.length || Boolean(error)}
          >
            <PanelBody
              items={consulta?.campanas}
              empty="Sin campañas para este cliente."
              hint="Consultá un documento para ver las campañas."
              error={error}
            />
          </Panel>
          <Panel
            title="Información adicional del cliente"
            count={consulta?.informaciones.length}
            centered={!consulta?.informaciones.length || Boolean(error)}
          >
            <PanelBody
              items={consulta?.informaciones}
              empty="Sin información adicional para este cliente."
              hint="Consultá un documento para ver la información adicional."
              error={error}
            />
          </Panel>
        </section>
      </div>
    </main>
  )
}

function Panel({
  title,
  count,
  centered,
  children,
}: {
  title: string
  count?: number
  centered: boolean
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="bg-loyalty-jungle px-4 py-2.5 text-center text-sm font-semibold text-white">
        {title}
        {count ? ` · ${count}` : ''}
      </h2>
      <div className={`px-4 py-4 text-sm text-slate-500 dark:text-slate-400 ${centered ? 'grid min-h-36 place-items-center text-center' : 'max-h-[28rem] overflow-y-auto'}`}>
        {children}
      </div>
    </section>
  )
}

function PanelBody({
  items,
  empty,
  hint,
  error,
}: {
  items: string[] | undefined
  empty: string
  hint: string
  error: string | null
}) {
  if (error) return <p role="alert">{error}</p>
  if (!items) return <p>{hint}</p>
  if (items.length === 0) return <p>{empty}</p>
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}
