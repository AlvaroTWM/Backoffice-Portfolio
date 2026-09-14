const EJECUTIVA_ALIASES: Record<string, string> = {
  constanza: 'Constanza',
  connie: 'Constanza',
  belen: 'Belen',
  belu: 'Belen',
  chi: 'Chiara',
  chiara: 'Chiara',
  vale: 'Valeria',
  valeria: 'Valeria',
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
}

function aliasKey(value: string): string {
  return stripAccents(value).toLowerCase().trim()
}

/** Unifica variantes de nombre de ejecutiva (Excel / importaciones). */
export function normalizeEjecutivaName(raw?: string | null): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null

  const canonical = EJECUTIVA_ALIASES[aliasKey(trimmed)]
  return canonical ?? trimmed
}
