import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { dedupeCatalogOptions, normalizeCatalogKey } from '../../utils/catalogNormalize'

interface MultiSelectDropdownProps {
  id?: string
  label: string
  options: string[]
  /** Valores canónicos seleccionados (labels visibles). */
  selected: string[]
  onChange: (next: string[]) => void
  allLabel?: string
  searchable?: boolean
  className?: string
  /** Clases extra para el botón (p. ej. altura compacta). */
  buttonClassName?: string
}

export function MultiSelectDropdown({
  id,
  label,
  options,
  selected,
  onChange,
  allLabel = 'Todos',
  searchable = true,
  className = '',
  buttonClassName = '',
}: MultiSelectDropdownProps) {
  const autoId = useId()
  const rootId = id ?? autoId
  const buttonId = `${rootId}-button`
  const menuId = `${rootId}-menu`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const deduped = useMemo(() => dedupeCatalogOptions(options), [options])

  const filtered = useMemo(() => {
    const q = normalizeCatalogKey(query)
    if (!q) return deduped
    return deduped.filter((opt) => normalizeCatalogKey(opt).includes(q))
  }, [deduped, query])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selectedKeys = useMemo(
    () => new Set(selected.map(normalizeCatalogKey)),
    [selected],
  )

  const toggle = (option: string) => {
    const key = normalizeCatalogKey(option)
    const already = selected.some((s) => normalizeCatalogKey(s) === key)
    if (already) {
      onChange(selected.filter((s) => normalizeCatalogKey(s) !== key))
    } else {
      onChange([...selected, option])
    }
  }

  const clear = () => onChange([])

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? selected[0]
        : `${selected.length} seleccionados`

  return (
    <div className={`relative flex min-w-[130px] flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 ${className}`} ref={rootRef}>
      <span id={`${rootId}-label`}>{label}</span>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${rootId}-label`}
        className={`inline-flex items-center justify-between gap-1.5 rounded-2xl border bg-white px-4 py-3 text-left text-sm font-medium text-slate-900 shadow-sm outline-none transition hover:bg-slate-50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40 ${
          selected.length > 0
            ? 'border-loyalty-fresh dark:border-loyalty-fresh'
            : 'border-slate-200 dark:border-slate-700'
        } ${buttonClassName}`}
        id={buttonId}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="truncate">{summary}</span>
        <svg
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="m19 9-7 7-7-7"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
          id={menuId}
          role="listbox"
        >
          {searchable ? (
            <div className="border-b border-slate-100 p-2 dark:border-slate-700">
              <input
                autoFocus
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                type="search"
                value={query}
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-2 py-1.5 dark:border-slate-700">
            <button
              className="text-[11px] font-bold text-emerald-700 hover:underline dark:text-emerald-400"
              onClick={clear}
              type="button"
            >
              {allLabel}
            </button>
            {selected.length > 0 ? (
              <span className="text-[10px] font-semibold text-slate-400">{selected.length}</span>
            ) : null}
          </div>

          <ul className="max-h-56 overflow-y-auto p-1.5 text-sm">
            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-xs text-slate-400">Sin coincidencias</li>
            ) : (
              filtered.map((option) => {
                const key = normalizeCatalogKey(option)
                const checked = selectedKeys.has(key)
                const inputId = `${rootId}-opt-${key}`
                return (
                  <li key={key}>
                    <label
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700/80"
                      htmlFor={inputId}
                    >
                      <input
                        checked={checked}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-500 dark:bg-slate-900"
                        id={inputId}
                        onChange={() => toggle(option)}
                        type="checkbox"
                      />
                      <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {option}
                      </span>
                    </label>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
