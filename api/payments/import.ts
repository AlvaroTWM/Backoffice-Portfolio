import { handleOptions, setCorsHeaders } from '../_lib/cors'
import type { ApiRequest, ApiResponse } from '../_lib/http'
import { isRecord } from '../_lib/http'

const requiredColumns = ['MES', 'ALIADO', 'MONTO_PAGAR']

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

export default function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method === 'OPTIONS') {
    handleOptions(request, response)
    return
  }

  setCorsHeaders(request, response)

  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Metodo no permitido.' })
    return
  }

  const body = isRecord(request.body) ? request.body : {}
  const filename = typeof body.filename === 'string' ? body.filename : 'archivo-pagos-pendientes'
  const rows = Array.isArray(body.rows) ? body.rows.filter(isValidPaymentRow) : []

  if (!rows.length) {
    response.status(400).json({
      message:
        'No encontramos pagos validos en el archivo. Verifica las columnas MES, ALIADO y MONTO_PAGAR.',
      requiredColumns,
    })
    return
  }

  response.status(202).json({
    filename,
    message:
      'Archivo procesado de forma segura. Validamos las filas y no almacenamos el archivo original.',
    mode: 'memory-only',
    rowsReceived: rows.length,
    requiredColumns,
  })
}
