import { useEffect, useState } from 'react'

import type { OktaLoginResult } from '../../services/auth'
import { handleOktaCallback } from '../../services/auth'

interface OktaCallbackPageProps {
  onSuccess: (result: OktaLoginResult) => void
  onError: (message: string) => void
}

export function OktaCallbackPage({ onSuccess, onError }: OktaCallbackPageProps) {
  const [message, setMessage] = useState('Completando inicio de sesión con Okta…')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const result = await handleOktaCallback()
        if (!cancelled) onSuccess(result)
      } catch (err) {
        const text = err instanceof Error ? err.message : 'No pudimos completar el login con Okta.'
        if (!cancelled) {
          setMessage(text)
          onError(text)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [onError, onSuccess])

  return (
    <main className="app-shell grid min-h-screen place-items-center px-5 py-8 text-slate-950">
      <section className="surface-shine w-full max-w-xl rounded-[2rem] border border-emerald-950/10 bg-white/85 p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-800">
          Loyalty Pagos
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
          Validando acceso Okta
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">{message}</p>
      </section>
    </main>
  )
}
