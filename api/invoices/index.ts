import { handleOptions, setCorsHeaders } from '../_lib/cors'
import { connectToDatabase } from '../_lib/db'
import type { ApiRequest, ApiResponse } from '../_lib/http'
import { isRecord } from '../_lib/http'
import { PaymentModel } from '../_lib/paymentModel'
import { serializePayment } from '../_lib/payments'

const placeholderImageUrl =
  'https://placehold.co/900x1200/eafff2/064e3b?text=Evidencia+recibida'

function parseText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

async function listPayments(response: ApiResponse) {
  await connectToDatabase()
  const payments = await PaymentModel.find().sort({ fecha_subida: -1 }).lean()

  response.status(200).json(payments.map(serializePayment))
}

async function createPayment(request: ApiRequest, response: ApiResponse) {
  const body = isRecord(request.body) ? request.body : {}
  const nro_factura = parseText(body.nro_factura)
  const comercio = parseText(body.comercio)
  const aliado_id = parseText(body.aliado_id)
  const monto = Number(body.monto)

  if (!nro_factura || !comercio || !aliado_id || !Number.isFinite(monto) || monto <= 0) {
    response.status(400).json({
      message: 'Completa referencia de pago, comercio, aliado y monto valido.',
    })
    return
  }

  await connectToDatabase()

  const payment = await PaymentModel.create({
    aliado_id,
    comercio,
    comentarios: ['Evidencia recibida en modo demo. No se almaceno el archivo original.'],
    monto,
    nro_factura,
    url_imagen: placeholderImageUrl,
  })

  response.status(201).json(serializePayment(payment))
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method === 'OPTIONS') {
    handleOptions(request, response)
    return
  }

  setCorsHeaders(request, response)

  try {
    if (request.method === 'GET') {
      await listPayments(response)
      return
    }

    if (request.method === 'POST') {
      await createPayment(request, response)
      return
    }

    response.status(405).json({ message: 'Metodo no permitido.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    response.status(500).json({ message })
  }
}
