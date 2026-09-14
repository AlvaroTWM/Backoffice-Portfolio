import { useState } from 'react'

import type { UserRole } from '../../types/auth'
import { USER_ROLE_LABELS } from '../../types/auth'
import { Button } from '../ui/Button'

interface RoleSelectPageProps {
  availableRoles: UserRole[]
  userName: string
  onSelect: (role: UserRole) => Promise<void>
  onCancel?: () => void
}

const ROLE_HINTS: Record<UserRole, string> = {
  admin: 'Acceso completo: usuarios, importación y operaciones.',
  gerencia: 'Dashboard, reportes y aprobaciones operativas.',
  alianzas: 'Registro de pagos y operación diaria.',
  operaciones: 'Gestión de aliados, importación y solicitudes.',
}

export function RoleSelectPage({
  availableRoles,
  userName,
  onSelect,
  onCancel,
}: RoleSelectPageProps) {
  const [selected, setSelected] = useState<UserRole>(availableRoles[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    setLoading(true)
    try {
      await onSelect(selected)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cambiar el rol.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell grid min-h-screen place-items-center px-5 py-8 text-slate-950">
      <section className="surface-shine w-full max-w-xl rounded-[2rem] border border-emerald-950/10 bg-white/85 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-800">
          Loyalty Pagos
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
          Elegí con qué rol entrar
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Hola {userName}. Tu cuenta Okta tiene más de un rol. Seleccioná con cuál querés
          trabajar en esta sesión.
        </p>

        <div className="mt-6 space-y-3">
          {availableRoles.map((role) => {
            const active = selected === role
            return (
              <button
                key={role}
                type="button"
                onClick={() => setSelected(role)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-black text-slate-950">{USER_ROLE_LABELS[role]}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{ROLE_HINTS[role]}</p>
              </button>
            )
          })}
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
            isLoading={loading}
            onClick={() => void handleConfirm()}
            type="button"
            variant="primary"
          >
            Continuar como {USER_ROLE_LABELS[selected]}
          </Button>
          {onCancel && (
            <Button
              className="sm:w-auto"
              disabled={loading}
              onClick={onCancel}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
          )}
        </div>
      </section>
    </main>
  )
}
