import { isPortfolioDemo } from '../config/portfolio'
import type { AuthUser, UserRole } from '../types/auth'
import {
  getOktaAuth,
  getOktaRedirectUri,
  isOktaConfigured,
  loadOktaConfig,
} from './okta'

const SESSION_STORAGE_KEY = 'loyalty-facturas-session'
const API_BASE = import.meta.env.VITE_API_URL?.trim() ?? ''

interface StoredSession extends AuthUser {
  jwtToken: string
}

export interface OktaLoginResult {
  user: AuthUser
  availableRoles: UserRole[]
  needsRoleSelection: boolean
}

function getSessionStorage() {
  return typeof window !== 'undefined' ? window.sessionStorage : null
}

function storeSession(session: StoredSession) {
  getSessionStorage()?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

function parseStoredSession() {
  const rawSession = getSessionStorage()?.getItem(SESSION_STORAGE_KEY)

  if (!rawSession) {
    return null
  }

  try {
    const parsedSession = JSON.parse(rawSession) as StoredSession

    if (!parsedSession.jwtToken || !parsedSession.email) {
      clearStoredSession()
      return null
    }

    return parsedSession
  } catch {
    clearStoredSession()
    return null
  }
}

function normalizeRoles(roles: unknown, fallback?: string): UserRole[] {
  const list = Array.isArray(roles) ? roles.map(String) : []
  const cleaned = list.filter((r): r is UserRole =>
    r === 'admin' || r === 'gerencia' || r === 'alianzas' || r === 'operaciones',
  )
  if (cleaned.length > 0) return cleaned
  if (fallback === 'admin' || fallback === 'gerencia' || fallback === 'alianzas' || fallback === 'operaciones') {
    return [fallback]
  }
  return []
}

async function finishOktaLoginWithBackend(payload: Record<string, string>) {
  const response = await fetch(`${API_BASE}/api/auth/okta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      (body as { message?: string }).message ?? 'Error al verificar sesión con Okta.',
    )
  }

  return (await response.json()) as {
    token: string
    user: AuthUser
    availableRoles?: UserRole[]
    needsRoleSelection?: boolean
  }
}

/** Inicia el redirect a Okta (PKCE). */
export async function loginWithOkta() {
  await loadOktaConfig()
  const auth = await getOktaAuth()
  await auth.signInWithRedirect()
}

/**
 * Completa el login tras volver de Okta a /callback.
 * El code se intercambia en el backend con Client Secret (app confidential).
 */
export async function handleOktaCallback(): Promise<OktaLoginResult> {
  await loadOktaConfig()
  const auth = await getOktaAuth()
  const params = new URLSearchParams(window.location.search)

  const oauthError = params.get('error')
  if (oauthError) {
    throw new Error(params.get('error_description') || oauthError)
  }

  const code = params.get('code')
  if (!code) {
    throw new Error('Okta no devolvió authorization code.')
  }

  const meta = auth.transactionManager.load() as { codeVerifier?: string } | null
  const codeVerifier = meta?.codeVerifier
  if (!codeVerifier) {
    throw new Error('No se encontró code_verifier de PKCE. Reintentá el login.')
  }

  const data = await finishOktaLoginWithBackend({
    code,
    codeVerifier,
    redirectUri: getOktaRedirectUri(),
  })

  const availableRoles = normalizeRoles(
    data.availableRoles ?? data.user.availableRoles,
    data.user.role,
  )
  const user: AuthUser = { ...data.user, availableRoles }

  storeSession({ ...user, jwtToken: data.token })
  auth.transactionManager.clear()
  window.history.replaceState({}, document.title, '/')

  return {
    user,
    availableRoles,
    needsRoleSelection: Boolean(data.needsRoleSelection) || availableRoles.length > 1,
  }
}

/** Acceso demo para despliegue en portafolio (sin Okta ni backend). */
export async function loginPortfolioDemo(role: UserRole = 'admin'): Promise<AuthUser> {
  const availableRoles: UserRole[] = ['admin', 'gerencia', 'alianzas', 'operaciones']
  const user: AuthUser = {
    id: 'portfolio-demo',
    email: 'demo@portfolio.local',
    name: 'Demo Portfolio',
    role,
    availableRoles,
  }
  storeSession({ ...user, jwtToken: 'portfolio-demo-token' })
  return user
}

export async function selectAppRole(role: UserRole): Promise<AuthUser> {
  if (isPortfolioDemo) {
    const current = getStoredSession()
    if (!current) throw new Error('No hay sesión activa.')
    const user: AuthUser = { ...current, role }
    storeSession({ ...user, jwtToken: getStoredJwt() ?? 'portfolio-demo-token' })
    return user
  }

  const jwt = getStoredJwt()
  if (!jwt) throw new Error('No hay sesión activa para cambiar el rol.')

  const response = await fetch(`${API_BASE}/api/auth/select-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ role }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Error al seleccionar rol.')
  }

  const data = (await response.json()) as {
    token: string
    user: AuthUser
    availableRoles?: UserRole[]
  }

  const availableRoles = normalizeRoles(
    data.availableRoles ?? data.user.availableRoles,
    data.user.role,
  )
  const user: AuthUser = { ...data.user, availableRoles }
  storeSession({ ...user, jwtToken: data.token })
  return user
}

export async function loginWithEmail(email: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Error al iniciar sesión.')
  }

  const data = (await response.json()) as { token: string; user: AuthUser; availableRoles?: UserRole[] }
  const availableRoles = normalizeRoles(data.availableRoles ?? data.user.availableRoles, data.user.role)
  const user: AuthUser = { ...data.user, availableRoles }
  storeSession({ ...user, jwtToken: data.token })
  return user
}

export function getStoredSession(): AuthUser | null {
  const session = parseStoredSession()
  if (!session) return null
  const { jwtToken: _jwtToken, ...user } = session
  return {
    ...user,
    availableRoles: normalizeRoles(user.availableRoles, user.role),
  }
}

export function getStoredJwt() {
  return parseStoredSession()?.jwtToken ?? null
}

export function clearStoredSession() {
  getSessionStorage()?.removeItem(SESSION_STORAGE_KEY)
  if (isOktaConfigured()) {
    void getOktaAuth()
      .then((auth) => auth.tokenManager.clear())
      .catch(() => undefined)
  }
}

export { isOktaConfigured, loadOktaConfig }

/** @deprecated Usar isOktaConfigured */
export function isGoogleLoginConfigured() {
  return isOktaConfigured()
}
