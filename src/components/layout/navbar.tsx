import { useEffect, useRef, useState } from 'react'
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'

import type { UserRole } from '../../types/auth'

interface NavbarProps {
  activeView?: string
  isDark: boolean
  onLogout: () => void
  onNavigate: (view: string) => void
  onToggleDark: () => void
  userEmail?: string
  userName: string
  userPicture?: string
  userRole: UserRole
}

export function Navbar({ activeView: _activeView, isDark, onLogout, onNavigate, onToggleDark, userEmail, userName, userPicture, userRole: _userRole }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleNavigate(view: string) {
    onNavigate(view)
    setMenuOpen(false)
  }

  return (
    <Disclosure as="nav" className="animate-fade-down border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-900/60">
      <div className="mx-auto w-full max-w-[92vw] px-2">
        <div className="flex h-14 items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-500 text-xs font-black text-white">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">Loyalty</span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Gestor de Pagos</span>
            </div>
          </div>

          {/* Right side */}
          <div className="hidden items-center gap-2 sm:flex">
            {/* Dark/Light toggle */}
            <button
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              onClick={onToggleDark}
              type="button"
            >
              {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
            </button>

            {/* User dropdown */}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700"
              >
                {userPicture ? (
                  <img src={userPicture} alt={userName} className="size-6 rounded-md object-cover" />
                ) : (
                  <div className="grid size-6 place-items-center rounded-md bg-emerald-500 text-[10px] font-black text-white">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{userName.split(' ')[0]}</span>
                <svg className={`size-3 text-slate-400 transition ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {/* User info */}
                  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
                    {userPicture ? (
                      <img src={userPicture} alt={userName} className="size-8 rounded-lg object-cover" />
                    ) : (
                      <div className="grid size-8 place-items-center rounded-lg bg-emerald-500 text-xs font-black text-white">
                        {userName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800 dark:text-white">{userName}</p>
                      {userEmail && (
                        <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">{userEmail}</p>
                      )}
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => handleNavigate('aprobaciones')}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Aprobaciones
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate('perfil')}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Perfil
                    </button>
                  </div>

                  <div className="border-t border-slate-100 py-1 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onLogout() }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 sm:hidden">
            <button
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              onClick={onToggleDark}
              type="button"
            >
              {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
            </button>
            <DisclosureButton className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
              <span className="sr-only">Abrir menu</span>
              <Bars3Icon aria-hidden="true" className="block size-5 group-data-open:hidden" />
              <XMarkIcon aria-hidden="true" className="hidden size-5 group-data-open:block" />
            </DisclosureButton>
          </div>
        </div>
      </div>

      {/* Mobile panel */}
      <DisclosurePanel className="border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:hidden">
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            {userPicture ? (
              <img src={userPicture} alt={userName} className="size-8 rounded-lg object-cover" />
            ) : (
              <div className="grid size-8 place-items-center rounded-lg bg-emerald-500 text-xs font-black text-white">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-white">{userName}</p>
              {userEmail && <p className="text-[10px] text-slate-400">{userEmail}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('list')}
            className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Aliados
          </button>
          <button
            type="button"
            onClick={() => onNavigate('aprobaciones')}
            className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Aprobaciones
          </button>
          <button
            type="button"
            onClick={() => onNavigate('perfil')}
            className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Perfil
          </button>
          <button
            className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={onLogout}
            type="button"
          >
            Cerrar sesión
          </button>
        </div>
      </DisclosurePanel>
    </Disclosure>
  )
}
