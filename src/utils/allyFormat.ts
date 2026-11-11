const LOWERCASE_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a', 'para', 'por', 'con'])

/** "ACADEMIA OLIMPIA" → "Academia Olimpia". Solo presentación: el dato original no se toca. */
export function toTitleCase(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, index) => {
      const letters = word.replace(/[^\p{L}]/gu, '')
      if (letters.length === 0) return word
      const isUpper = word === word.toUpperCase()
      // Siglas cortas (AF, SA) o con puntos (S.A.) se conservan
      if (isUpper && (letters.length <= 2 || word.includes('.'))) return word
      const lower = word.toLowerCase()
      if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower
      return lower.replace(/(^|[-/(])(\p{L})/gu, (_m, prefix: string, char: string) => prefix + char.toUpperCase())
    })
    .join(' ')
}

/** Número con separador de miles, sin prefijo de moneda (el "Gs." va en el encabezado). */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Math.round(amount || 0))
}

export function formatGs(amount: number): string {
  return `Gs. ${formatNumber(amount)}`
}

export function percent(part: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.max(0, Math.min(100, (part / total) * 100))
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Días hasta el vencimiento (negativo = vencida). */
export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null
  const due = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(due.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

export function pluralDays(n: number): string {
  return `${n} ${n === 1 ? 'día' : 'días'}`
}

export function relativeMinutes(since: number, now: number): string {
  const minutes = Math.floor((now - since) / 60_000)
  if (minutes < 1) return 'Actualizado hace un momento'
  if (minutes === 1) return 'Actualizado hace 1 min'
  if (minutes < 60) return `Actualizado hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `Actualizado hace ${hours} h`
}

export type PillTone = 'neutral' | 'warning' | 'danger' | 'success'

/** Pastilla: fondo al 15% del color, texto en color pleno. */
export const PILL_TONE_CLASS: Record<PillTone, string> = {
  neutral: 'bg-slate-500/15 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300',
  warning: 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  danger: 'bg-rose-500/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
  success: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
}
