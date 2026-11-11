import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import {
  crearAliadoManualBackend,
  crearDeudaManualBackend,
  obtenerFiltrosAliadosBackend,
} from '../../services/loyaltyBackend'
import { toast } from '../../services/toast'
import { SERVICIOS_TIPO } from '../../types/allyDebt'

type EntryMode = 'aliado' | 'deuda'

const ESTADOS_ALIADO = ['Activo', 'Inactivo'] as const
const ESTADOS_DEUDA = ['Pendiente', 'Financiada', 'Pagada', 'Anulada'] as const

interface FormState {
  cod_aliado: string
  aliado: string
  ruc: string
  bolsa: string
  rubro: string
  ejecutiva: string
  estado_aliado: string
  estado_deuda: string
  periodo: string
  servicio: string
  /** Solo dígitos; se muestra con separador de miles. */
  deuda_total: string
}

type FieldKey = keyof FormState
type Errors = Partial<Record<FieldKey, string>>

function currentPeriodo(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function emptyForm(): FormState {
  return {
    cod_aliado: '',
    aliado: '',
    ruc: '',
    bolsa: '',
    rubro: '',
    ejecutiva: '',
    estado_aliado: 'Activo',
    estado_deuda: 'Pendiente',
    periodo: currentPeriodo(),
    servicio: SERVICIOS_TIPO[0],
    deuda_total: '',
  }
}

const REQUIRED_BY_MODE: Record<EntryMode, FieldKey[]> = {
  aliado: [
    'cod_aliado', 'aliado', 'ruc', 'bolsa', 'rubro', 'ejecutiva',
    'estado_aliado', 'estado_deuda', 'periodo', 'servicio', 'deuda_total',
  ],
  deuda: ['cod_aliado', 'estado_deuda', 'periodo', 'servicio', 'deuda_total'],
}

const CONTROL_CLASS =
  'w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500'
const CONTROL_OK =
  'border-slate-200 focus:border-emerald-400 focus:ring-emerald-100 dark:border-slate-700 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40'
const CONTROL_ERROR =
  'border-red-400 focus:border-red-400 focus:ring-red-100 dark:border-red-500 dark:focus:ring-red-900/40'

function controlClass(error?: string) {
  return `${CONTROL_CLASS} ${error ? CONTROL_ERROR : CONTROL_OK}`
}

function Field({
  label,
  htmlFor,
  required = true,
  error,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
      {error ? <span className="text-xs font-normal text-red-500">{error}</span> : null}
    </div>
  )
}

function formatThousands(digits: string): string {
  return digits ? Number(digits).toLocaleString('es-PY') : ''
}

export function ManualEntryPanel() {
  const uid = useId()
  const [entryMode, setEntryMode] = useState<EntryMode>('aliado')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<{ bolsas: string[]; rubros: string[]; ejecutivas: string[] }>({
    bolsas: [],
    rubros: [],
    ejecutivas: [],
  })

  // Sugerencias (datalist) a partir de los valores que ya existen en la base.
  useEffect(() => {
    let cancelled = false
    obtenerFiltrosAliadosBackend()
      .then((opts) => {
        if (!cancelled) setSuggestions({ bolsas: opts.bolsas, rubros: opts.rubros, ejecutivas: opts.ejecutivas })
      })
      .catch(() => { /* las sugerencias son opcionales */ })
    return () => { cancelled = true }
  }, [])

  const id = (key: FieldKey) => `${uid}-${key}`

  function setField(key: FieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function switchEntryMode(next: EntryMode) {
    if (next === entryMode) return
    setEntryMode(next)
    setErrors({})
  }

  function reset() {
    setForm(emptyForm())
    setErrors({})
  }

  function validate(): Errors {
    const next: Errors = {}
    for (const key of REQUIRED_BY_MODE[entryMode]) {
      if (!form[key].trim()) next[key] = 'Campo obligatorio.'
    }
    if (!next.deuda_total && Number(form.deuda_total) <= 0) {
      next.deuda_total = 'Ingresá un monto mayor a 0.'
    }
    return next
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (isSaving) return

    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setIsSaving(true)
    try {
      const debt = {
        periodo: form.periodo,
        servicio: form.servicio,
        estado_deuda: form.estado_deuda,
        deuda_total: Number(form.deuda_total),
      }

      if (entryMode === 'aliado') {
        const res = await crearAliadoManualBackend({
          cod_aliado: form.cod_aliado.trim(),
          aliado: form.aliado.trim(),
          ruc: form.ruc.trim(),
          bolsa: form.bolsa.trim(),
          rubro: form.rubro.trim(),
          ejecutiva: form.ejecutiva.trim(),
          estado_aliado: form.estado_aliado,
          ...debt,
        })
        toast.success(res.aliado_creado ? 'Aliado guardado' : 'Aliado actualizado', res.message)
      } else {
        const res = await crearDeudaManualBackend({ cod_aliado: form.cod_aliado.trim(), ...debt })
        toast.success('Deuda guardada', res.message)
      }
      reset()
    } catch (err) {
      const e = err as Error & { fieldErrors?: Record<string, string> }
      if (e.fieldErrors) setErrors(e.fieldErrors as Errors)
      toast.error('No se pudo guardar', e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const isAliado = entryMode === 'aliado'

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Tipo de carga manual"
        className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800"
      >
        {([
          ['aliado', 'Un aliado'],
          ['deuda', 'Una deuda'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={entryMode === value}
            onClick={() => switchEntryMode(value)}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
              entryMode === value
                ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/50"
      >
        <p className="text-base font-bold text-slate-900 dark:text-white">
          {isAliado ? 'Cargar aliado manualmente' : 'Cargar deuda manualmente'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {isAliado
            ? 'Se guarda directo en la base de datos, de a uno. Para cargas masivas usá las otras pestañas.'
            : 'Agrega una deuda a un aliado que ya existe. El código de aliado debe estar cargado.'}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Código de aliado" htmlFor={id('cod_aliado')} error={errors.cod_aliado}>
            <input
              id={id('cod_aliado')}
              className={controlClass(errors.cod_aliado)}
              value={form.cod_aliado}
              onChange={(e) => setField('cod_aliado', e.target.value)}
              autoComplete="off"
            />
          </Field>

          {isAliado ? (
            <>
              <Field label="Aliado" htmlFor={id('aliado')} error={errors.aliado}>
                <input
                  id={id('aliado')}
                  className={controlClass(errors.aliado)}
                  value={form.aliado}
                  onChange={(e) => setField('aliado', e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="RUC" htmlFor={id('ruc')} error={errors.ruc}>
                <input
                  id={id('ruc')}
                  className={controlClass(errors.ruc)}
                  value={form.ruc}
                  onChange={(e) => setField('ruc', e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Bolsa" htmlFor={id('bolsa')} error={errors.bolsa}>
                <input
                  id={id('bolsa')}
                  list={`${uid}-bolsas`}
                  className={controlClass(errors.bolsa)}
                  value={form.bolsa}
                  onChange={(e) => setField('bolsa', e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Rubro" htmlFor={id('rubro')} error={errors.rubro}>
                <input
                  id={id('rubro')}
                  list={`${uid}-rubros`}
                  className={controlClass(errors.rubro)}
                  value={form.rubro}
                  onChange={(e) => setField('rubro', e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Ejecutiva" htmlFor={id('ejecutiva')} error={errors.ejecutiva}>
                <input
                  id={id('ejecutiva')}
                  list={`${uid}-ejecutivas`}
                  className={controlClass(errors.ejecutiva)}
                  value={form.ejecutiva}
                  onChange={(e) => setField('ejecutiva', e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Estado del aliado" htmlFor={id('estado_aliado')} error={errors.estado_aliado}>
                <select
                  id={id('estado_aliado')}
                  className={controlClass(errors.estado_aliado)}
                  value={form.estado_aliado}
                  onChange={(e) => setField('estado_aliado', e.target.value)}
                >
                  {ESTADOS_ALIADO.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </>
          ) : null}

          <Field label="Estado de deuda" htmlFor={id('estado_deuda')} error={errors.estado_deuda}>
            <select
              id={id('estado_deuda')}
              className={controlClass(errors.estado_deuda)}
              value={form.estado_deuda}
              onChange={(e) => setField('estado_deuda', e.target.value)}
            >
              {ESTADOS_DEUDA.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>

          <Field label="Período" htmlFor={id('periodo')} error={errors.periodo}>
            <input
              id={id('periodo')}
              type="month"
              className={controlClass(errors.periodo)}
              value={form.periodo}
              onChange={(e) => setField('periodo', e.target.value)}
            />
          </Field>

          <Field label="Servicio" htmlFor={id('servicio')} error={errors.servicio}>
            <select
              id={id('servicio')}
              className={controlClass(errors.servicio)}
              value={form.servicio}
              onChange={(e) => setField('servicio', e.target.value)}
            >
              {SERVICIOS_TIPO.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>

          <Field label="Absorbe aliado (Gs.)" htmlFor={id('deuda_total')} error={errors.deuda_total}>
            <div
              className={`flex overflow-hidden rounded-2xl border bg-white shadow-sm transition focus-within:ring-4 dark:bg-slate-800 ${
                errors.deuda_total
                  ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-100 dark:border-red-500 dark:focus-within:ring-red-900/40'
                  : 'border-slate-200 focus-within:border-emerald-400 focus-within:ring-emerald-100 dark:border-slate-700 dark:focus-within:border-emerald-500 dark:focus-within:ring-emerald-900/40'
              }`}
            >
              <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                Gs.
              </span>
              <input
                id={id('deuda_total')}
                inputMode="numeric"
                className="min-w-0 flex-1 bg-transparent px-4 py-3 text-right text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="0"
                value={formatThousands(form.deuda_total)}
                onChange={(e) => setField('deuda_total', e.target.value.replace(/\D/g, '').slice(0, 13))}
                autoComplete="off"
              />
            </div>
          </Field>
        </div>

        {/* Sugerencias existentes (el usuario igual puede escribir un valor nuevo). */}
        <datalist id={`${uid}-bolsas`}>{suggestions.bolsas.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id={`${uid}-rubros`}>{suggestions.rubros.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id={`${uid}-ejecutivas`}>{suggestions.ejecutivas.map((v) => <option key={v} value={v} />)}</datalist>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            <span className="text-red-500">*</span> Campo obligatorio
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={isSaving}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              Limpiar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSaving ? 'Guardando...' : isAliado ? 'Guardar aliado' : 'Guardar deuda'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
