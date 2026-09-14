export interface ApiRequest {
  body?: unknown
  headers: Record<string, string | string[] | undefined>
  method?: string
  query: Record<string, string | string[] | undefined>
}

export interface ApiResponse {
  end: () => void
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
  status: (code: number) => ApiResponse
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
