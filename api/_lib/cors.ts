import type { ApiRequest, ApiResponse } from './http'

const defaultOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'https://julianxloyalty.vercel.app',
]

function getAllowedOrigins() {
  return (process.env.CLIENT_ORIGINS ?? defaultOrigins.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function setCorsHeaders(request: ApiRequest, response: ApiResponse) {
  const origin = request.headers.origin
  const allowedOrigins = getAllowedOrigins()
  const requestOrigin = Array.isArray(origin) ? origin[0] : origin

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    response.setHeader('Access-Control-Allow-Origin', requestOrigin)
  }

  response.setHeader('Vary', 'Origin')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export function handleOptions(request: ApiRequest, response: ApiResponse) {
  setCorsHeaders(request, response)
  response.status(204).end()
}
