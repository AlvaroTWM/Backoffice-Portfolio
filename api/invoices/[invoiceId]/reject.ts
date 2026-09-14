import { handleOptions, setCorsHeaders } from '../../_lib/cors'
import { connectToDatabase } from '../../_lib/db'
import type { ApiRequest, ApiResponse } from '../../_lib/http'
import { getStringParam, isRecord } from '../../_lib/http'
import { PaymentModel } from '../../_lib/paymentModel'
import { parseComments, serializePayment } from '../../_lib/payments'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method === 'OPTIONS') {
    handleOptions(request, response)
    return
  }

  setCorsHeaders(request, response)

  if (request.method !== 'PATCH') {
    response.status(405).json({ message: 'Metodo no permitido.' })
    return
  }

  try {
    await connectToDatabase()
    const body = isRecord(request.body) ? request.body : {}

    const payment = await PaymentModel.findByIdAndUpdate(
      getStringParam(request.query.invoiceId),
      {
        comentarios: parseComments(body.comentarios),
        estado: 'Rechazado',
      },
      { new: true },
    )

    if (!payment) {
      response.status(404).json({ message: 'Pago no encontrado.' })
      return
    }

    response.status(200).json(serializePayment(payment))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    response.status(500).json({ message })
  }
}
