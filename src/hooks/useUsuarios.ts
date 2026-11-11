import { useCallback, useEffect, useState } from 'react'
import { getStoredJwt } from '../services/auth'

export interface Usuario {
  user_id:    string
  email:      string
  nombre:     string
  rol:        'admin' | 'gerencia' | 'alianzas' | 'operaciones'
  created_at: string
  updated_at: string
}

export type UsuarioRole = Usuario['rol']

export const ROLE_LABELS: Record<UsuarioRole, string> = {
  admin:       'Administrador',
  gerencia:    'Gerencia',
  alianzas:    'Alianzas',
  operaciones: 'Operaciones',
}

export const ROLE_ORDER: UsuarioRole[] = ['admin', 'gerencia', 'operaciones', 'alianzas']

const API_BASE = import.meta.env.VITE_API_URL?.trim() ?? ''

function authHeaders() {
  const token = getStoredJwt()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function useUsuarios() {
  const [usuarios, setUsuarios]   = useState<Usuario[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const fetchUsuarios = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/usuarios`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Error al obtener usuarios.')
      const data = (await res.json()) as { usuarios: Usuario[] }
      setUsuarios(data.usuarios)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void fetchUsuarios() }, [fetchUsuarios])

  const createUsuario = useCallback(async (payload: { email: string; nombre: string; rol: UsuarioRole }) => {
    const res = await fetch(`${API_BASE}/api/usuarios`, {
      method: 'POST',
      headers: authHeaders(),
      body:    JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string }
      throw new Error(body.message ?? 'Error al crear usuario.')
    }
    await fetchUsuarios()
  }, [fetchUsuarios])

  const updateUsuario = useCallback(async (id: string, payload: Partial<{ email: string; nombre: string; rol: UsuarioRole }>) => {
    const res = await fetch(`${API_BASE}/api/usuarios/${id}`, {
      method:  'PATCH',
      headers: authHeaders(),
      body:    JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string }
      throw new Error(body.message ?? 'Error al actualizar usuario.')
    }
    await fetchUsuarios()
  }, [fetchUsuarios])

  const deleteUsuario = useCallback(async (id: string) => {
    const res = await fetch(`${API_BASE}/api/usuarios/${id}`, {
      method:  'DELETE',
      headers: authHeaders(),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string }
      throw new Error(body.message ?? 'Error al eliminar usuario.')
    }
    await fetchUsuarios()
  }, [fetchUsuarios])

  const byRole = ROLE_ORDER.reduce<Record<UsuarioRole, Usuario[]>>((acc, role) => {
    acc[role] = usuarios.filter((u) => u.rol === role)
    return acc
  }, { admin: [], gerencia: [], alianzas: [], operaciones: [] })

  return { usuarios, byRole, isLoading, error, refetch: fetchUsuarios, createUsuario, updateUsuario, deleteUsuario }
}
