import { isPortfolioDemo } from '../../config/portfolio'
import { getStoredJwt } from '../auth'

const API_BASE = import.meta.env.VITE_API_URL?.trim() ?? ''

export async function portfolioAwareFetch(path: string, init?: RequestInit): Promise<Response> {
  if (isPortfolioDemo) {
    const { handlePortfolioApi } = await import('./apiRouter')
    await new Promise((r) => window.setTimeout(r, 80))
    const data = await handlePortfolioApi(path, init)
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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
