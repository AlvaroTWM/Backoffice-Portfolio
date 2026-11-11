import { isPortfolioDemo } from '../../config/portfolio'
import { getStoredJwt } from '../auth'

const API_BASE = import.meta.env.VITE_API_URL?.trim() ?? ''

async function demoResponse(path: string, init?: RequestInit): Promise<Response> {
  const { handlePortfolioApi } = await import('./apiRouter')
  await new Promise((r) => window.setTimeout(r, 80))
  try {
    const data = await handlePortfolioApi(path, init)
    if (typeof data === 'string') {
      return new Response(data, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
    }
    return new Response(JSON.stringify(data ?? {}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400
    const message = err instanceof Error ? err.message : 'Error en la demo.'
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function portfolioAwareFetch(path: string, init?: RequestInit): Promise<Response> {
  if (isPortfolioDemo) return demoResponse(path, init)

  const token = getStoredJwt()
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
}

/**
 * En modo demo intercepta cualquier `fetch('/api/...')` de la app y lo resuelve con
 * datos en memoria, así los componentes nuevos funcionan sin backend.
 */
export function installPortfolioFetchShim() {
  if (!isPortfolioDemo || typeof window === 'undefined') return
  const nativeFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw, window.location.origin)
    if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
      return demoResponse(`${url.pathname}${url.search}`, init)
    }
    return nativeFetch(input, init)
  }
}
