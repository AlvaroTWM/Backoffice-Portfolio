export type UserRole = 'admin' | 'alianzas' | 'gerencia' | 'operaciones'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gerencia: 'Gerencia',
  alianzas: 'Alianzas',
  operaciones: 'Operaciones',
}

export interface AuthUser {
  email: string
  id: string
  name: string
  picture?: string
  role: UserRole
  /** Roles Okta disponibles para este usuario (puede ser > 1). */
  availableRoles?: UserRole[]
}
