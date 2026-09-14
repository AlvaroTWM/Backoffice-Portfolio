import { handleOptions, setCorsHeaders } from './_lib/cors'
import type { ApiRequest, ApiResponse } from './_lib/http'

export default function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method === 'OPTIONS') {
    handleOptions(request, response)
    return
  }

  setCorsHeaders(request, response)

  response.status(200).json({
    message: 'Loyalty Pagos API funcionando en Vercel Functions',
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}
