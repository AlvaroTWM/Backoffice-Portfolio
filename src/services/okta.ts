import { OktaAuth } from '@okta/okta-auth-js'

export interface OktaPublicConfig {
  clientId: string
  issuer: string
  redirectUri: string
}

const API_BASE = import.meta.env.VITE_API_URL?.trim() ?? ''

let cachedConfig: OktaPublicConfig | null = null
let oktaAuth: OktaAuth | null = null
let loadPromise: Promise<OktaPublicConfig> | null = null

function fallbackRedirectUri() {
  return typeof window !== 'undefined' ? `${window.location.origin}/callback` : ''
}

/** Carga clientId/issuer desde el backend (Parameters de Null en runtime). */
export async function loadOktaConfig(): Promise<OktaPublicConfig> {
  if (cachedConfig) return cachedConfig
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const response = await fetch(`${API_BASE}/api/auth/okta-config`)
    const body = (await response.json().catch(() => ({}))) as {
      configured?: boolean
      clientId?: string
      issuer?: string
      redirectUri?: string
      message?: string
    }

    if (!response.ok || !body.configured || !body.clientId || !body.issuer) {
      throw new Error(body.message ?? 'Okta no está configurado en este entorno.')
    }

    cachedConfig = {
      clientId: body.clientId,
      issuer: body.issuer,
      redirectUri: body.redirectUri?.trim() || fallbackRedirectUri(),
    }
    return cachedConfig
  })()

  try {
    return await loadPromise
  } finally {
    loadPromise = null
  }
}

export function isOktaConfigured() {
  return Boolean(cachedConfig?.clientId && cachedConfig?.issuer)
}

export async function getOktaAuth(): Promise<OktaAuth> {
  const config = await loadOktaConfig()

  if (!oktaAuth) {
    oktaAuth = new OktaAuth({
      clientId: config.clientId,
      issuer: config.issuer,
      redirectUri: config.redirectUri,
      scopes: ['openid', 'profile', 'email', 'groups'],
      pkce: true,
      tokenManager: {
        storage: 'sessionStorage',
      },
    })
  }

  return oktaAuth
}

export function getOktaRedirectUri() {
  return cachedConfig?.redirectUri || fallbackRedirectUri()
}
