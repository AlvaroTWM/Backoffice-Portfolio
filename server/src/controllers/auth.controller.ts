import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import { prisma } from '../lib/prisma.js'
import { env } from '../config/env.js'
import { listRolesFromOktaGroups } from '../services/oktaGroups.js'
import {
  exchangeOktaAuthorizationCode,
  extractEmail,
  extractGroups,
  extractName,
  verifyOktaAccessToken,
  verifyOktaIdToken,
} from '../services/oktaJwt.js'

const ALLOWED_DOMAIN = (process.env.GOOGLE_ALLOWED_DOMAIN ?? 'itti.digital').toLowerCase()

interface GoogleUserInfo {
  sub: string
  email: string
  name: string
  picture?: string
  hd?: string
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Token de Google inválido o expirado.')
  return response.json() as Promise<GoogleUserInfo>
}

async function resolveRoleFromDb(email: string): Promise<string | null> {
  const usuario = await prisma.usuario.findUnique({ where: { email } })
  return usuario?.rol ?? null
}

function issueAppToken(
  usuario: { user_id: string; email: string; nombre: string; rol: string },
  options?: { picture?: string; availableRoles?: string[] },
) {
  return jwt.sign(
    {
      userId: usuario.user_id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      availableRoles: options?.availableRoles ?? [usuario.rol],
      picture: options?.picture,
    },
    env.jwtSecret,
    { expiresIn: '8h' },
  )
}

function toAuthUserPayload(
  usuario: { user_id: string; email: string; nombre: string; rol: string },
  availableRoles: string[],
  picture?: string,
) {
  return {
    id: usuario.user_id,
    email: usuario.email,
    name: usuario.nombre,
    role: usuario.rol,
    availableRoles,
    picture,
  }
}

// ─── POST /api/auth/okta ──────────────────────────────────────────────────────

export async function verifyOktaToken(request: Request, response: Response) {
  try {
    const body = request.body as {
      accessToken?: string
      idToken?: string
      code?: string
      codeVerifier?: string
      redirectUri?: string
    }

    let accessToken = body.accessToken
    let idToken = body.idToken

    // Flujo confidential client: el browser manda code+PKCE, el backend pone el secret
    if (!accessToken && body.code && body.codeVerifier) {
      const redirectUri =
        body.redirectUri?.trim() ||
        env.okta.redirectUri ||
        'http://localhost:8080/callback'

      const tokens = await exchangeOktaAuthorizationCode({
        code: body.code,
        codeVerifier: body.codeVerifier,
        redirectUri,
      })
      accessToken = tokens.access_token
      idToken = tokens.id_token
    }

    if (!accessToken) {
      response.status(400).json({
        message: 'Se requiere accessToken o (code + codeVerifier).',
      })
      return
    }

    const accessClaims = await verifyOktaAccessToken(accessToken)
    const idClaims = idToken ? await verifyOktaIdToken(idToken) : null

    const email = extractEmail(idClaims ?? {}) ?? extractEmail(accessClaims)

    if (!email) {
      response.status(403).json({ message: 'El token de Okta no incluye email.' })
      return
    }

    const emailDomain = email.split('@')[1]?.toLowerCase()
    if (emailDomain !== ALLOWED_DOMAIN) {
      response.status(403).json({ message: `Solo se permiten cuentas del dominio @${ALLOWED_DOMAIN}.` })
      return
    }

    const groups = [...extractGroups(accessClaims), ...extractGroups(idClaims ?? {})]
    const uniqueGroups = [...new Set(groups)]

    const availableRoles = listRolesFromOktaGroups(uniqueGroups)
    const rol = availableRoles[0] ?? null
    if (!rol) {
      response.status(403).json({
        message: 'Tu cuenta no pertenece a ningún grupo autorizado del sistema.',
        groups: uniqueGroups,
      })
      return
    }

    const nombre = extractName(idClaims ?? accessClaims, email)

    const usuario = await prisma.usuario.upsert({
      where: { email },
      update: { nombre, rol },
      create: { email, nombre, rol },
    })

    const token = issueAppToken(usuario, { availableRoles })

    response.status(200).json({
      token,
      availableRoles,
      needsRoleSelection: availableRoles.length > 1,
      user: toAuthUserPayload(usuario, availableRoles),
    })
  } catch (err) {
    console.error('[verifyOktaToken]', err)
    response.status(401).json({
      message: err instanceof Error ? err.message : 'Token de Okta inválido.',
    })
  }
}

// ─── POST /api/auth/verify (Google legacy) ────────────────────────────────────

export async function verifyGoogleToken(request: Request, response: Response) {
  try {
    const { accessToken } = request.body as { accessToken?: string }
    if (!accessToken) {
      response.status(400).json({ message: 'accessToken es requerido.' })
      return
    }

    const profile = await fetchGoogleUserInfo(accessToken)

    const emailDomain = profile.email.split('@')[1]?.toLowerCase()
    if (emailDomain !== ALLOWED_DOMAIN) {
      response.status(403).json({ message: `Solo se permiten cuentas del dominio @${ALLOWED_DOMAIN}.` })
      return
    }

    const rol = await resolveRoleFromDb(profile.email.toLowerCase())
    if (!rol) {
      response.status(403).json({
        message: 'Tu cuenta no pertenece a ningún grupo autorizado del sistema.',
      })
      return
    }

    const usuario = await prisma.usuario.upsert({
      where: { email: profile.email.toLowerCase() },
      update: { nombre: profile.name, rol },
      create: { email: profile.email.toLowerCase(), nombre: profile.name, rol },
    })

    const availableRoles = [rol]
    const token = issueAppToken(usuario, { picture: profile.picture, availableRoles })

    response.status(200).json({
      token,
      availableRoles,
      needsRoleSelection: false,
      user: toAuthUserPayload(usuario, availableRoles, profile.picture),
    })
  } catch (err) {
    console.error('[verifyGoogleToken]', err)
    response.status(500).json({
      message: err instanceof Error ? err.message : 'Error al verificar sesión.',
    })
  }
}

// ─── POST /api/auth/login (dev / whitelist email) ─────────────────────────────

export async function loginWithEmail(request: Request, response: Response) {
  try {
    const { email } = request.body as { email?: string }
    if (!email) {
      response.status(400).json({ message: 'El email es requerido.' })
      return
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase().trim() },
    })
    if (!usuario) {
      response.status(403).json({
        message: 'Acceso denegado. Tu cuenta no está registrada en el sistema.',
      })
      return
    }

    const availableRoles = [usuario.rol]
    const token = issueAppToken(usuario, { availableRoles })

    response.status(200).json({
      token,
      availableRoles,
      needsRoleSelection: false,
      user: toAuthUserPayload(usuario, availableRoles),
    })
  } catch (err) {
    console.error('[loginWithEmail]', err)
    const detail = err instanceof Error ? err.message : 'Error al iniciar sesión.'
    const isConfig = detail.includes('DATABASE_URL')
    response.status(isConfig ? 503 : 500).json({
      message: isConfig
        ? 'Base de datos no configurada (DATABASE_URL). Revisá Parameters en NullPlatform.'
        : 'Error al iniciar sesión.',
    })
  }
}

// ─── POST /api/auth/select-role ───────────────────────────────────────────────

export async function selectRole(request: Request, response: Response) {
  try {
    const current = request.user
    if (!current?.userId) {
      response.status(401).json({ message: 'No autorizado.' })
      return
    }

    const role = typeof request.body?.role === 'string' ? request.body.role.trim().toLowerCase() : ''
    const availableRoles = Array.isArray(current.availableRoles) && current.availableRoles.length > 0
      ? current.availableRoles.map((r) => String(r).toLowerCase())
      : [current.rol]

    if (!role || !availableRoles.includes(role)) {
      response.status(403).json({
        message: 'No podés seleccionar ese rol. No está entre tus grupos Okta autorizados.',
        availableRoles,
      })
      return
    }

    const usuario = await prisma.usuario.update({
      where: { user_id: current.userId },
      data: { rol: role },
    })

    const token = issueAppToken(usuario, {
      picture: current.picture,
      availableRoles,
    })

    response.status(200).json({
      token,
      availableRoles,
      user: toAuthUserPayload(usuario, availableRoles, current.picture),
    })
  } catch (err) {
    console.error('[selectRole]', err)
    response.status(500).json({
      message: err instanceof Error ? err.message : 'Error al seleccionar rol.',
    })
  }
}

export async function getMe(request: Request, response: Response) {
  response.status(200).json({ user: (request as Request & { user?: unknown }).user })
}

/** Config pública de Okta para el SPA (sin client secret). */
export async function getOktaPublicConfig(_request: Request, response: Response) {
  if (!env.okta.issuer || !env.okta.clientId) {
    response.status(503).json({
      configured: false,
      message: 'Okta no está configurado en el backend (OKTA_ISSUER / OKTA_CLIENT_ID).',
    })
    return
  }

  response.status(200).json({
    configured: true,
    clientId: env.okta.clientId,
    issuer: env.okta.issuer,
    redirectUri: env.okta.redirectUri || undefined,
  })
}
