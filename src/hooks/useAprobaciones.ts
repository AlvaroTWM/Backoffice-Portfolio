import { useCallback, useEffect, useState } from 'react'
import { portfolioAwareFetch } from '../services/portfolioDemo/fetch'

export interface Aprobacion {
  aprobacion_id:      string
  accion:             string
  tabla:              string
  registro_id:        string
  observacion:        string
  estado:             'Pendiente' | 'Aprobado' | 'Rechazado'
  fecha_solicitud:    string
  fecha_resolucion:   string | null
  solicitante_nombre: string
  solicitante_email:  string
  solicitante_rol?:   string
  aprobador_nombre:   string | null
  datos_solicitud?:   Record<string, unknown>
}

export function useAprobaciones() {
  const [aprobaciones, setAprobaciones] = useState<Aprobacion[]>([])
  const [isLoading, setIsLoading]       = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const fetchAprobaciones = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await portfolioAwareFetch('/api/aprobaciones')
      if (!res.ok) throw new Error('Error al obtener aprobaciones.')
      const data = (await res.json()) as { items: Aprobacion[] }
      setAprobaciones(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void fetchAprobaciones() }, [fetchAprobaciones])

  const resolver = useCallback(
    async (aprobacion_id: string, estado: 'Aprobado' | 'Rechazado', observacion: string) => {
      const res = await portfolioAwareFetch(`/api/aprobaciones/${aprobacion_id}/resolver`, {
        method:  'PATCH',
        body:    JSON.stringify({ estado, observacion }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string }
        throw new Error(body.message ?? 'Error al resolver aprobación.')
      }
      await fetchAprobaciones()
    },
    [fetchAprobaciones],
  )

  return { aprobaciones, isLoading, error, refetch: fetchAprobaciones, resolver }
}
