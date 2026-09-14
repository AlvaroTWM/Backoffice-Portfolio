import { useState } from 'react'
import {
  ArrowUpTrayIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentChartBarIcon,
  UsersIcon,
  BuildingStorefrontIcon,
  ArrowRightStartOnRectangleIcon,
  CakeIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline'
import { isPortfolioDemo } from '../../config/portfolio'
import type { UserRole } from '../../types/auth'
import { USER_ROLE_LABELS } from '../../types/auth'

export type AppView = 'dashboard' | 'allies' | 'approvals' | 'users' | 'reports' | 'dev-import'

// ─── Cumpleaños del equipo ────────────────────────────────────────────────────

interface TeamMember {
  name: string
  birthday: string // MM-DD
  picture?: string
}

const TEAM_BIRTHDAYS: TeamMember[] = [
  { name: 'Chiara',   birthday: '01-22' },
  { name: 'Julián',   birthday: '02-01' },
  { name: 'Chicho',   birthday: '03-08' },
  { name: 'Guada',    birthday: '03-17' },
  { name: 'Rafa',     birthday: '03-18' },
  { name: 'Steven',   birthday: '04-26' },
  { name: 'Ailin',    birthday: '05-04' },
  { name: 'Cristian', birthday: '05-05' },
  { name: 'Valeria',  birthday: '05-14' },
  { name: 'Ana',      birthday: '05-21' },
  { name: 'Gio',      birthday: '06-14' },
  { name: 'Mateo',    birthday: '07-12' },
  { name: 'Sammu',    birthday: '08-15' },
  { name: 'Ara',      birthday: '09-07' },
  { name: 'Constanza', birthday: '09-09' },
  { name: 'Belen',    birthday: '10-26' },
  { name: 'Facu',     birthday: '11-28' },
]

function getUpcomingBirthdays(members: TeamMember[], days = 30) {
  const today = new Date()
  const year  = today.getFullYear()

  return members
    .map((m) => {
      const [month, day] = m.birthday.split('-').map(Number)
      let bday = new Date(year, month - 1, day)
      if (bday < today) bday = new Date(year + 1, month - 1, day)
      const diff = Math.ceil((bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return { ...m, daysLeft: diff, date: bday }
    })
    .filter((m) => m.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

function BirthdayWidget({ collapsed }: { collapsed: boolean }) {
  const upcoming = getUpcomingBirthdays(TEAM_BIRTHDAYS)

  if (collapsed || upcoming.length === 0) return null

  return (
    <div className="mx-2 mb-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/60 dark:bg-slate-800/50">
      <div className="mb-2 flex items-center gap-2">
        <CakeIcon className="size-4 text-pink-500 dark:text-pink-400" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Próximos cumpleaños</span>
      </div>
      <div className="flex flex-col gap-2">
        {upcoming.map((m) => {
          const initials = m.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
          const isToday  = m.daysLeft === 0
          const label    = isToday ? '🎉 Hoy!' : m.daysLeft === 1 ? 'Mañana' : `en ${m.daysLeft}d`
          return (
            <div key={m.name} className="flex items-center gap-2">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-pink-500/15 text-[10px] font-bold text-pink-600 dark:bg-pink-500/20 dark:text-pink-300">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-slate-700 dark:text-slate-200">{m.name.split(' ')[0]}</p>
              </div>
              <span className={`shrink-0 text-[10px] font-semibold ${isToday ? 'text-pink-500 dark:text-pink-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface NavItem {
  id: AppView
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard',        icon: ChartBarIcon,              roles: ['admin', 'gerencia'] },
  { id: 'allies',     label: 'Aliados',           icon: BuildingStorefrontIcon,    roles: ['admin', 'gerencia', 'alianzas', 'operaciones'] },
  { id: 'approvals',  label: 'Aprobaciones',      icon: CheckCircleIcon,           roles: ['admin', 'gerencia', 'alianzas', 'operaciones'] },
  { id: 'reports',    label: 'Reportes',          icon: DocumentChartBarIcon,      roles: ['admin', 'gerencia'] },
  { id: 'users',      label: 'Usuarios',          icon: UsersIcon,                 roles: ['admin', 'gerencia'] },
  { id: 'dev-import', label: 'Importar CSV',      icon: ArrowUpTrayIcon,           roles: ['admin', 'gerencia', 'alianzas', 'operaciones'] },
]

const ROLE_LABELS = USER_ROLE_LABELS

interface SidebarProps {
  activeView: AppView
  availableRoles?: UserRole[]
  isDark: boolean
  onNavigate: (view: AppView) => void
  onLogout: () => void
  onSwitchRole?: (role: UserRole) => Promise<void> | void
  onToggleDark: () => void
  userEmail?: string
  userName: string
  userPicture?: string
  userRole: UserRole
}

export function Sidebar({
  activeView,
  availableRoles = [],
  isDark,
  onNavigate,
  onLogout,
  onSwitchRole,
  onToggleDark,
  userEmail: _userEmail,
  userName,
  userPicture,
  userRole,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [switchingRole, setSwitchingRole] = useState(false)

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (isPortfolioDemo && item.id === 'dev-import') return false
    return item.roles.includes(userRole)
  })
  const canSwitchRole = Boolean(onSwitchRole) && availableRoles.length > 1

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleRoleChange = async (role: UserRole) => {
    if (!onSwitchRole || role === userRole) return
    setSwitchingRole(true)
    try {
      await onSwitchRole(role)
    } finally {
      setSwitchingRole(false)
    }
  }

  return (
    <aside
      className={`relative flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
        <img
          alt="Loyalty"
          className="size-8 shrink-0 rounded-lg object-contain"
          src="/loyalty-iso.png"
        />
        {!collapsed && (
          <span className="text-sm font-black tracking-wide text-slate-900 dark:text-white">Loyalty</span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 pt-4">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="size-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Birthday widget */}
      <BirthdayWidget collapsed={collapsed} />

      {/* Theme + user + logout */}
      <div className="space-y-1 border-t border-slate-200 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onToggleDark}
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          {isDark ? <SunIcon className="size-5 shrink-0" /> : <MoonIcon className="size-5 shrink-0" />}
          {!collapsed && <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>}
        </button>

        <div className={`flex items-center gap-3 rounded-lg px-2 py-2 ${collapsed ? 'justify-center' : ''}`}>
          {userPicture ? (
            <img src={userPicture} alt={userName} className="size-8 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
              {initials}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{userName}</p>
              {canSwitchRole ? (
                <select
                  aria-label="Cambiar rol"
                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  disabled={switchingRole}
                  onChange={(e) => void handleRoleChange(e.target.value as UserRole)}
                  value={userRole}
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="truncate text-[10px] text-slate-500">{ROLE_LABELS[userRole]}</p>
              )}
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={onLogout}
              title="Cerrar sesión"
              className="text-slate-400 transition-colors hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400"
            >
              <ArrowRightStartOnRectangleIcon className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-16 grid size-6 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        {collapsed
          ? <ChevronRightIcon className="size-3" />
          : <ChevronLeftIcon className="size-3" />
        }
      </button>
    </aside>
  )
}
