import type { ErrorRequestHandler } from 'express'

import { env } from '../config/env.js'

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next

  const message = error instanceof Error ? error.message : 'Error interno del servidor'

  response.status(500).json({
    message,
    stack: env.nodeEnv === 'production' ? undefined : error instanceof Error ? error.stack : undefined,
  })
}
