import { useCallback, useEffect, useState } from 'react'
import { AllyDetailPage } from './components/allies/AllyDetailPage'
import { AlliesPaymentsView } from './components/allies/AlliesPaymentsView'
import { AprobacionesView } from './components/aprobaciones/AprobacionesView'
import { LandingPage } from './components/auth/LandingPage'
import { OktaCallbackPage } from './components/auth/OktaCallbackPage'
import { RoleSelectPage } from './components/auth/RoleSelectPage'
import { DashboardView } from './components/dashboard/DashboardView'
import { CsvImportView } from './components/dev/CsvImportView'
import { USER_ROLE_LABELS } from './types/auth'
import { Sidebar } from './components/layout/Sidebar'
import type { AppView } from './components/layout/Sidebar'
import { ToastContainer } from './components/ui/ToastContainer'
import { UsersView } from './components/users/UsersView'
import { useAllies } from './hooks/useAllies'
import { useAprobaciones } from './hooks/useAprobaciones'
import { useDarkMode } from './hooks/useDarkMode'
import { useSessionContext } from './hooks/useSessionContext'
import { isPortfolioDemo } from './config/portfolio'
import {
  clearStoredSession,
  loadOktaConfig,
  loginPortfolioDemo,
  loginWithOkta,
  selectAppRole,
  type OktaLoginResult,
} from './services/auth'
import { toast } from './services/toast'
import type { AuthUser, UserRole } from './types/auth'

type AuthView = 'landing' | 'session' | 'okta-callback' | 'role-select'

function SessionGate({
  error,
  isLoading,
}: {
  error: string | null
  isLoading: boolean
}) {
  return (
    <main className="app-shell grid min-h-screen place-items-center px-5 py-8 text-slate-950">
      <section className="surface-shine w-full max-w-xl rounded-[2rem] border border-emerald-950/10 bg-white/85 p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-800">
          Loyalty Pagos
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
          {isLoading ? 'Validando acceso corporativo' : 'Acceso restringido'}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          {isLoading
            ? 'Estamos comprobando tu sesión de Okta para validar el acceso corporativo.'
            : error || 'No pudimos validar tu acceso a esta aplicacion.'}
        </p>
      </section>
    </main>
  )
}

function AuthenticatedApp({
  onLogout,
  onSwitchRole,
  user,
}: {
  onLogout: () => void
  onSwitchRole?: (role: UserRole) => Promise<void>
  user: AuthUser
}) {
  const { isDark, toggle: toggleDark } = useDarkMode()
  const {
    assignInvoiceNumber,
    allies,
    createCompromiso,
    createFactura,
    createPlan,
    error,
    importDebts,
    isDetailLoading,
    isLoading,
    listQuery,
    pedirAprobacion,
    refinanceDebt,
    registerPayment,
    refetch,
    setAllyStatusFilter,
    setBolsaFilter,
    setDebtStatusFilter,
    setEjecutivaFilter,
    setNameFilter,
    setPage,
    setPeriodOrder,
    setRubroFilter,
    setServicioFilter,
    selectedAllyDetail,
    selectedAllyId,
    selectAlly,
    totalAllies,
    totalPages,
    voidPaymentOnCuota,
  } = useAllies()

  const {
    aprobaciones,
    isLoading: isLoadingAprobaciones,
    error: errorAprobaciones,
    refetch: refetchAprobaciones,
    resolver,
  } = useAprobaciones()

  const [appView, setAppView] = useState<AppView>(() => {
    if (user.role === 'admin' || user.role === 'gerencia') return 'dashboard'
    return 'allies'
  })
  const [allyView, setAllyView] = useState<'list' | 'detail'>('list')

  const handleSelectAlly = async (allyId: string | number) => {
    await selectAlly(allyId)
    setAllyView('detail')
  }

  const handleNavigate = (view: AppView) => {
    setAppView(view)
    setAllyView('list')
  }

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? 'dark' : ''}`}>
      <Sidebar
        activeView={appView}
        availableRoles={user.availableRoles ?? [user.role]}
        isDark={isDark}
        onNavigate={handleNavigate}
        onLogout={onLogout}
        onSwitchRole={onSwitchRole}
        onToggleDark={toggleDark}
        userEmail={user.email}
        userName={user.name}
        userPicture={user.picture}
        userRole={user.role}
      />

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        <div className="px-6 py-6">

          {appView === 'dashboard' && <DashboardView isDark={isDark} />}

          {appView === 'allies' && allyView === 'detail' && selectedAllyDetail ? (
            <AllyDetailPage
              allyDetail={selectedAllyDetail}
              isLoading={isDetailLoading}
              onAssignInvoiceNumber={assignInvoiceNumber}
              onBack={() => setAllyView('list')}
              onCreateCompromiso={createCompromiso}
              onCreatePlan={async (payload) => {
                await createPlan(payload)
                toast.success('Plan de pagos creado', 'Las cuotas fueron registradas.')
              }}
              onRefinanciar={async (payload) => {
                await refinanceDebt(payload)
                toast.success('Refinanciación aplicada', 'Las cuotas seleccionadas fueron reprogramadas.')
              }}
              onRegisterPayment={registerPayment}
              onAnularPagoDirecto={voidPaymentOnCuota}
              onSolicitarAprobacion={async (payload) => {
                const result = await pedirAprobacion(payload)
                if (result.auto_ejecutada) {
                  toast.success('Acción ejecutada', 'Se aplicó directamente sin aprobación.')
                  await refetch()
                } else {
                  toast.success('Solicitud enviada', 'Quedó pendiente de aprobación.')
                }
                return result
              }}
              userRole={user.role}
            />
          ) : appView === 'allies' && (
            <AlliesPaymentsView
              allies={allies}
              error={error}
              filters={listQuery}
              isDetailLoading={isDetailLoading}
              isLoading={isLoading}
              onCreateFactura={createFactura}
              onFiltersChange={({ allyStatus, bolsa, debtStatus, ejecutiva, name, periodOrder, rubro, servicio }) => {
                if (name !== undefined) setNameFilter(name)
                if (debtStatus !== undefined) setDebtStatusFilter(debtStatus)
                if (allyStatus !== undefined) setAllyStatusFilter(allyStatus)
                if (bolsa !== undefined) setBolsaFilter(bolsa)
                if (rubro !== undefined) setRubroFilter(rubro)
                if (servicio !== undefined) setServicioFilter(servicio)
                if (ejecutiva !== undefined) setEjecutivaFilter(ejecutiva)
                if (periodOrder !== undefined) setPeriodOrder(periodOrder)
              }}
              onPageChange={setPage}
              onImportDebts={importDebts}
              onRegisterPayment={registerPayment}
              onRefresh={refetch}
              onSelectAlly={handleSelectAlly}
              page={listQuery.page}
              selectedAllyDetail={selectedAllyDetail}
              selectedAllyId={selectedAllyId}
              totalAllies={totalAllies}
              totalPages={totalPages}
            />
          )}

          {appView === 'approvals' && (
            <AprobacionesView
              aprobaciones={aprobaciones}
              isLoading={isLoadingAprobaciones}
              error={errorAprobaciones}
              onBack={() => setAppView('allies')}
              onResolver={async (id, estado, motivo) => {
                await resolver(id, estado, motivo)
                toast.success(
                  estado === 'Aprobado' ? 'Solicitud aprobada' : 'Solicitud rechazada',
                  'El historial fue actualizado.',
                )
              }}
              onRefresh={refetchAprobaciones}
            />
          )}

          {appView === 'reports' && (
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Reportes</h1>
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                Próximamente
              </div>
            </div>
          )}

          {appView === 'users' && <UsersView />}

          {appView === 'dev-import' && (
            <CsvImportView
              canUseUpdateTabs={user.role === 'admin' || user.role === 'gerencia'}
              roleLabel={USER_ROLE_LABELS[user.role]}
            />
          )}

        </div>
      </main>
    </div>
  )
}

function SessionApp({
  onBackToLanding,
  onLogout,
}: {
  onBackToLanding: () => void
  onLogout: () => void
}) {
  const { error, isLoading, user } = useSessionContext()

  if (isLoading || error) {
    return <SessionGate error={error} isLoading={isLoading} />
  }

  if (!user) {
    onBackToLanding()
    return null
  }

  const handleSwitchRole = async (role: UserRole) => {
    await selectAppRole(role)
    window.location.reload()
  }

  return <AuthenticatedApp onLogout={onLogout} onSwitchRole={handleSwitchRole} user={user} />
}

function isOktaCallbackPath() {
  return typeof window !== 'undefined' && window.location.pathname === '/callback'
}

function App() {
  const [authView, setAuthView] = useState<AuthView>(() =>
    isOktaCallbackPath() ? 'okta-callback' : 'landing',
  )
  const [sessionAttempt, setSessionAttempt] = useState(0)
  const [oktaError, setOktaError] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [pendingRoleUser, setPendingRoleUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL
    if (!baseUrl) return

    fetch(`${baseUrl}/api/health`)
      .then((response) => response.json())
      .then((data) => console.log('API health:', data))
      .catch((error) => console.error('Health error:', error))
  }, [])

  const startLogin = async () => {
    setOktaError(null)
    setIsSigningIn(true)
    try {
      if (isPortfolioDemo) {
        await loginPortfolioDemo('admin')
        setIsSigningIn(false)
        enterSession()
        return
      }
      await loadOktaConfig()
      await loginWithOkta()
    } catch (err) {
      setIsSigningIn(false)
      setOktaError(err instanceof Error ? err.message : 'No pudimos iniciar sesión con Okta.')
    }
  }

  const enterSession = () => {
    setPendingRoleUser(null)
    setOktaError(null)
    setIsSigningIn(false)
    setSessionAttempt((n) => n + 1)
    setAuthView('session')
  }

  const backToLanding = () => {
    setIsSigningIn(false)
    setPendingRoleUser(null)
    setAuthView('landing')
  }

  const logoutToLanding = () => {
    clearStoredSession()
    setIsSigningIn(false)
    setPendingRoleUser(null)
    setSessionAttempt((currentAttempt) => currentAttempt + 1)
    setAuthView('landing')
  }

  const handleOktaSuccess = useCallback((result: OktaLoginResult) => {
    setOktaError(null)
    setIsSigningIn(false)
    if (result.needsRoleSelection && result.availableRoles.length > 1) {
      setPendingRoleUser(result.user)
      setAuthView('role-select')
      return
    }
    setPendingRoleUser(null)
    setSessionAttempt((n) => n + 1)
    setAuthView('session')
  }, [])

  const handleOktaError = useCallback((message: string) => {
    setOktaError(message)
    setIsSigningIn(false)
    setPendingRoleUser(null)
    setAuthView('landing')
  }, [])

  const handleSelectRole = async (role: UserRole) => {
    await selectAppRole(role)
    enterSession()
  }

  if (authView === 'okta-callback') {
    return <OktaCallbackPage onSuccess={handleOktaSuccess} onError={handleOktaError} />
  }

  if (authView === 'role-select' && pendingRoleUser) {
    return (
      <RoleSelectPage
        availableRoles={pendingRoleUser.availableRoles ?? [pendingRoleUser.role]}
        userName={pendingRoleUser.name}
        onSelect={handleSelectRole}
        onCancel={logoutToLanding}
      />
    )
  }

  if (authView === 'landing') {
    return (
      <LandingPage
        error={oktaError}
        isSigningIn={isSigningIn}
        onGetStarted={() => void startLogin()}
        onSignIn={() => void startLogin()}
      />
    )
  }

  return (
    <>
      <SessionApp
        key={sessionAttempt}
        onBackToLanding={backToLanding}
        onLogout={logoutToLanding}
      />
      <ToastContainer />
    </>
  )
}

export default App
