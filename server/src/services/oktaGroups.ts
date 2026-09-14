/** Grupos Okta → roles internos (prioridad: admin > gerencia > operaciones > alianzas) */
export const OKTA_GROUP_ROLE_MAP: Record<string, string> = {
  sg_backoffice_bi_loyalty_administradores: 'admin',
  sg_backoffice_bi_loyalty_gerencia: 'gerencia',
  sg_backoffice_bi_loyalty_alianzas: 'alianzas',
  sg_backoffice_bi_loyalty_operaciones: 'operaciones',
}

export const ROLE_PRIORITY = ['admin', 'gerencia', 'operaciones', 'alianzas'] as const

export type AppRoleName = (typeof ROLE_PRIORITY)[number]

/** Todos los roles del usuario, ordenados por prioridad. */
export function listRolesFromOktaGroups(groups: string[]): AppRoleName[] {
  const matched = new Set<string>()

  for (const group of groups) {
    const role = OKTA_GROUP_ROLE_MAP[group]
    if (role) matched.add(role)
  }

  return ROLE_PRIORITY.filter((role) => matched.has(role))
}

/** Rol por defecto = el de mayor prioridad entre los asignados. */
export function resolveRoleFromOktaGroups(groups: string[]): string | null {
  const roles = listRolesFromOktaGroups(groups)
  return roles[0] ?? null
}
