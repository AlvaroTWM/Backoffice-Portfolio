import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

import { env } from '../config/env.js'

export interface OktaTokenClaims extends JWTPayload {
  email?: string
  preferred_username?: string
  name?: string
  groups?: string[] | string
  cid?: string
  uid?: string
}

export interface OktaTokenResponse {
  access_token: string
  id_token?: string
  token_type: string
  expires_in: number
  scope?: string
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJwks() {
  if (!env.okta.issuer) {
    throw new Error('OKTA_ISSUER no está configurado.')
  }
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${env.okta.issuer}/v1/keys`))
  }
  return jwks
}

function normalizeGroups(raw: string[] | string | undefined): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)
  return [String(raw)]
}

/**
 * Exchange authorization code → tokens en el backend (client confidential + PKCE).
 * Evita "Client authentication failed" del browser SPA sin secret.
 */
export async function exchangeOktaAuthorizationCode(params: {
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<OktaTokenResponse> {
  if (!env.okta.issuer || !env.okta.clientId || !env.okta.clientSecret) {
    throw new Error('OKTA_ISSUER, OKTA_CLIENT_ID y OKTA_CLIENT_SECRET son requeridos.')
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.okta.clientId,
    client_secret: env.okta.clientSecret,
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: params.redirectUri,
  })

  const response = await fetch(`${env.okta.issuer}/v1/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>

  if (!response.ok) {
    const description =
      (typeof payload.error_description === 'string' && payload.error_description) ||
      (typeof payload.error === 'string' && payload.error) ||
      'Error al intercambiar el code con Okta.'
    throw new Error(description)
  }

  if (typeof payload.access_token !== 'string') {
    throw new Error('Okta no devolvió access_token.')
  }

  return payload as unknown as OktaTokenResponse
}

export async function verifyOktaAccessToken(accessToken: string): Promise<OktaTokenClaims> {
  if (!env.okta.issuer || !env.okta.clientId) {
    throw new Error('OKTA_ISSUER y OKTA_CLIENT_ID son requeridos.')
  }

  const { payload } = await jwtVerify(accessToken, getJwks(), {
    issuer: env.okta.issuer,
  })

  const claims = payload as OktaTokenClaims

  if (claims.cid && claims.cid !== env.okta.clientId) {
    throw new Error('Token de Okta no corresponde a esta aplicación (cid).')
  }

  return claims
}

export async function verifyOktaIdToken(idToken: string): Promise<OktaTokenClaims> {
  if (!env.okta.issuer || !env.okta.clientId) {
    throw new Error('OKTA_ISSUER y OKTA_CLIENT_ID son requeridos.')
  }

  const { payload } = await jwtVerify(idToken, getJwks(), {
    issuer: env.okta.issuer,
    audience: env.okta.clientId,
  })

  return payload as OktaTokenClaims
}

export function extractGroups(claims: OktaTokenClaims): string[] {
  return normalizeGroups(claims.groups)
}

export function extractEmail(claims: OktaTokenClaims): string | null {
  const email = claims.email ?? claims.preferred_username
  return email ? String(email).toLowerCase().trim() : null
}

export function extractName(claims: OktaTokenClaims, email: string): string {
  if (claims.name && String(claims.name).trim()) return String(claims.name).trim()
  return email.split('@')[0] ?? email
}
