import { ArrowRightIcon, ArrowUpRightIcon } from '@heroicons/react/24/outline'

import { isPortfolioDemo } from '../../config/portfolio'
import { WalletCard } from './WalletCards'

interface LandingPageProps {
  error?: string | null
  isSigningIn?: boolean
  onGetStarted: () => void
}

export function LandingPage({
  error = null,
  isSigningIn = false,
  onGetStarted,
}: LandingPageProps) {
  return (
    <main className="landing-shell relative flex min-h-screen flex-col overflow-hidden px-5 py-6 text-slate-950 sm:px-8">
      <header className="animate-fade-down relative z-10 flex items-center gap-3 text-emerald-950">
        <span className="grid size-9 place-items-center rounded-lg border border-emerald-800/15 bg-white/65 text-sm font-black shadow-sm">
          L
        </span>
        <span className="text-sm font-black tracking-[0.24em]">LOYALTY</span>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center pb-6 pt-2 text-center">
        {/* El bolsillo es el botón de login. Las tarjetas son decoración. */}
        <div className="wallet animate-fade-up">
          <div className="contents" aria-hidden="true">
            <div className="wallet-back" />
            <WalletCard variant="striped" />
            <WalletCard variant="black" />
            <WalletCard variant="gray" />
            <WalletCard variant="bank" />
            <svg className="wallet-pocket" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0 43H12.5A3.5 3.5 0 0 0 16 39.5A3.5 3.5 0 0 1 19.5 36H80.5A3.5 3.5 0 0 1 84 39.5A3.5 3.5 0 0 0 87.5 43H100V87A13 13 0 0 1 87 100H13A13 13 0 0 1 0 87Z" />
            </svg>
          </div>
          <button
            type="button"
            disabled={isSigningIn}
            onClick={onGetStarted}
            className="landing-cta absolute inset-x-0 bottom-0 top-[43%] flex items-end justify-between rounded-b-[13%] p-[1.6em] text-left text-white outline-offset-4 focus-visible:outline-2 focus-visible:outline-white disabled:cursor-wait"
          >
            <span>
              <span className="block text-[2.3em] font-black leading-tight">
                {isSigningIn ? (isPortfolioDemo ? 'Entrando…' : 'Redirigiendo…') : isPortfolioDemo ? 'Ver demo' : 'Iniciar sesión'}
              </span>
              <span className="block text-[1.1em] font-medium text-white/70">{isPortfolioDemo ? 'modo demo' : 'con Okta'}</span>
            </span>
            <span className="grid size-[3.4em] place-items-center rounded-full bg-white/15 text-white">
              <ArrowRightIcon aria-hidden="true" className="size-[1.6em]" />
            </span>
          </button>
        </div>

        <h1 className="animate-fade-up animate-delay-2 mt-8 text-5xl font-black leading-[1.02] tracking-normal text-slate-950 sm:text-6xl">
          Loyalty HUB
        </h1>
        <p className="animate-fade-up animate-delay-3 mt-5 max-w-md text-base font-medium leading-7 text-slate-600">
          {isPortfolioDemo
            ? 'Demo interactiva de un backoffice de deudas y pagos. Datos ficticios, sin acceso corporativo.'
            : 'Gestiona validaciones, seguimiento e importaciones desde el panel del equipo de Alianzas.'}
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-6 w-full max-w-md rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : null}
      </section>

      <a className="landing-tool-link" href="/clientes">
        Base única de clientes
        <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
      </a>
    </main>
  )
}
