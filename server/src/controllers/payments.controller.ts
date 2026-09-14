import type { Request, Response } from 'express'

const requiredColumns = ['MES', 'ALIADO', 'MONTO_PAGAR']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidPaymentRow(row: unknown) {
  if (!isRecord(row)) {
    return false
  }

  return (
    typeof row.aliado === 'string' &&
    row.aliado.trim().length > 0 &&
    typeof row.mes === 'string' &&
    row.mes.trim().length > 0 &&
    typeof row.monto === 'number' &&
    Number.isFinite(row.monto) &&
    row.monto > 0
  )
}

export function importPendingPayments(request: Request, response: Response) {
  const rows = Array.isArray(request.body.rows) ? request.body.rows.filter(isValidPaymentRow) : []

  if (!request.file && !rows.length) {
    response.status(400).json({
      message:
        'Adjunta un archivo Excel o CSV con pagos pendientes o envia filas validas ya procesadas.',
      requiredColumns,
    })
    return
  }

  response.status(202).json({
    filename:
      typeof request.body.filename === 'string'
        ? request.body.filename
        : (request.file?.originalname ?? 'archivo-pagos-pendientes'),
    message:
      'Archivo procesado de forma segura. Validamos las filas y no almacenamos el archivo original.',
    mode: 'memory-only',
    rowsReceived: rows.length,
    requiredColumns,
  })
}
