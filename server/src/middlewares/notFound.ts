import type { Request, Response } from 'express'

export function notFound(request: Request, response: Response) {
  response.status(404).json({
    message: `Ruta no encontrada: ${request.method} ${request.originalUrl}`,
  })
}
