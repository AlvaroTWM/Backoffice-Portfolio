import type { Request, Response } from 'express'

export function getHealth(_request: Request, response: Response) {
  response.status(200).json({
    message: 'Loyalty Pagos API funcionando',
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}
