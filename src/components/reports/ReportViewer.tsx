import { useEffect, useState } from 'react'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

import { fetchReportHtml } from '../../services/loyaltyBackend'
import type { ReportRoute } from './reportRoute'

interface ReportViewerProps {
  route: ReportRoute
  onSessionExpired: () => void
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; html: string }
  | { status: 'error'; message: string }

export function ReportViewer({ route, onSessionExpired }: ReportViewerProps) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchReportHtml(route.category, route.slug)
      .then((html) => {
        if (cancelled) return
        document.title = /<title>([^<]*)<\/title>/i.exec(html)?.[1].trim() || route.slug
        setState({ status: 'ready', html })
      })
      .catch((error: Error & { status?: number }) => {
        if (cancelled) return
        if (error.status === 401) {
          onSessionExpired()
          return
        }
        setState({ status: 'error', message: error.message })
      })
    return () => {
      cancelled = true
    }
  }, [route.category, route.slug, onSessionExpired])

  if (state.status === 'ready') {
    // Sin allow-same-origin: el HTML del reporte no puede leer la sesión ni llamar a la API como el usuario.
    return (
      <iframe
        className="fixed inset-0 size-full border-0"
        sandbox="allow-scripts allow-popups"
        srcDoc={state.html}
        title={document.title}
        // El reporte navega con flechas: el foco tiene que estar adentro.
        onLoad={(event) => event.currentTarget.focus()}
      />
    )
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center">
      {state.status === 'loading' ? (
        <p className="text-sm font-medium text-slate-500">Cargando reporte…</p>
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-4">
          <p role="alert" className="text-sm text-slate-700">
            {state.message}
          </p>
          <a
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-emerald-500"
            href="/"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-4" />
            Ir al backoffice
          </a>
        </div>
      )}
    </main>
  )
}
