import type { NextFunction, Request, Response } from 'express'

export type AppRole = 'admin' | 'alianzas' | 'gerencia' | 'operaciones'

function hasRequiredRole(userRole: string, roles: AppRole[]): boolean {
  if (roles.includes(userRole as AppRole)) return true
  // Por ahora gerencia tiene los mismos permisos que admin
  return userRole === 'gerencia' && roles.includes('admin')
}

export function requireRole(roles: AppRole[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    const userRole = request.user?.rol

    if (!userRole) {
      response.status(401).json({ message: 'No autorizado. Token requerido.' })
      return
    }

    if (!hasRequiredRole(userRole, roles)) {
      response.status(403).json({
        message: `No tenés permisos para esta acción. Se requiere rol: ${roles.join(' o ')}.`,
      })
      return
    }

    next()
  }
}
