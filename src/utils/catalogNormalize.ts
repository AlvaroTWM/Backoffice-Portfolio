/** Normaliza labels de catálogo para matching tipo "like" (Gastronomía ≈ GASTRONOMIA). */
export function normalizeCatalogKey(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Prefiere Title Case / con acentos frente a TODO MAYÚSCULAS. */
function preferDisplayLabel(candidate: string, current: string): boolean {
  const candUpper = candidate === candidate.toUpperCase()
  const currUpper = current === current.toUpperCase()
  if (candUpper !== currUpper) return !candUpper
  if (candidate.length !== current.length) return candidate.length > current.length
  return candidate.localeCompare(current, 'es') < 0
}

/** Deduplica opciones por clave normalizada (una entrada visible por familia). */
export function dedupeCatalogOptions(values: string[]): string[] {
  const byKey = new Map<string, string>()
  for (const raw of values) {
    const trimmed = raw?.trim()
    if (!trimmed) continue
    const key = normalizeCatalogKey(trimmed)
    if (!key) continue
    const existing = byKey.get(key)
    if (!existing || preferDisplayLabel(trimmed, existing)) {
      byKey.set(key, trimmed)
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}

export function parseCatalogMulti(value: string | null | undefined): string[] {
  if (!value || value === 'all') return []
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export function serializeCatalogMulti(values: string[]): string {
  return values.length > 0 ? values.join(',') : 'all'
}

export function matchesCatalogSelection(
  fieldValue: string | null | undefined,
  selected: string[],
): boolean {
  if (selected.length === 0) return true
  const fieldKey = normalizeCatalogKey(fieldValue)
  if (!fieldKey) return false
  const selectedKeys = new Set(selected.map(normalizeCatalogKey).filter(Boolean))
  return selectedKeys.has(fieldKey)
}
