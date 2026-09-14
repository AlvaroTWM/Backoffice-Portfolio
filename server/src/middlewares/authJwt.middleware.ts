import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import { env } from '../config/env.js'

export interface JwtPayload {
  userId: string
  email: string
  nombre: string
  rol: string
  availableRoles?: string[]
  picture?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authMiddleware(request: Request, response: Response, next: NextFunction) {
  const authHeader = request.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    response.status(401).json({ message: 'No autorizado. Token requerido.' })
    return
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload
    request.user = payload
    next()
  } catch {
    response.status(401).json({ message: 'Token inválido o expirado.' })
  }
}
