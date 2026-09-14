import { useState } from 'react'
import {
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useUsuarios, ROLE_LABELS, ROLE_ORDER } from '../../hooks/useUsuarios'
import type { Usuario, UsuarioRole } from '../../hooks/useUsuarios'

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<UsuarioRole, string> = {
  admin:       'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  gerencia:    'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  alianzas:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  operaciones: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

function RoleBadge({ rol }: { rol: UsuarioRole }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_COLORS[rol]}`}>
      {ROLE_LABELS[rol]}
    </span>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  title:       string
  onClose:     () => void
  onSubmit:    () => Promise<void>
  isLoading:   boolean
  error:       string | null
  submitLabel: string
  children:    React.ReactNode
}

function Modal({ title, onClose, onSubmit, isLoading, error, submitLabel, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-800 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <XMarkIcon className="size-5" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          {children}
          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button type="button" onClick={onClose} disabled={isLoading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button type="button" onClick={() => void onSubmit()} disabled={isLoading}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
            {isLoading ? 'Procesando...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-slate-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-slate-500'
const selectCls = inputCls

// ─── Main view ────────────────────────────────────────────────────────────────

export function UsersView() {
  const { byRole, isLoading, error, createUsuario, updateUsuario, deleteUsuario } = useUsuarios()

  // ── Create modal
  const [showCreate, setShowCreate]   = useState(false)
  const [newEmail, setNewEmail]       = useState('')
  const [newNombre, setNewNombre]     = useState('')
  const [newRol, setNewRol]           = useState<UsuarioRole>('alianzas')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError]     = useState<string | null>(null)

  async function handleCreate() {
    setCreateError(null)
    if (!newEmail.trim() || !newNombre.trim()) { setCreateError('Email y nombre son requeridos.'); return }
    setCreateLoading(true)
    try {
      await createUsuario({ email: newEmail, nombre: newNombre, rol: newRol })
      setShowCreate(false); setNewEmail(''); setNewNombre(''); setNewRol('alianzas')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear.')
    } finally {
      setCreateLoading(false)
    }
  }

  // ── Edit modal
  const [editing, setEditing]           = useState<Usuario | null>(null)
  const [editNombre, setEditNombre]     = useState('')
  const [editEmail, setEditEmail]       = useState('')
  const [editRol, setEditRol]           = useState<UsuarioRole>('alianzas')
  const [editLoading, setEditLoading]   = useState(false)
  const [editError, setEditError]       = useState<string | null>(null)

  function openEdit(u: Usuario) {
    setEditing(u); setEditNombre(u.nombre); setEditEmail(u.email); setEditRol(u.rol); setEditError(null)
  }

  async function handleEdit() {
    if (!editing) return
    setEditError(null)
    setEditLoading(true)
    try {
      await updateUsuario(editing.user_id, { nombre: editNombre, email: editEmail, rol: editRol })
      setEditing(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al actualizar.')
    } finally {
      setEditLoading(false)
    }
  }

  // ── Delete confirm
  const [deleting, setDeleting]         = useState<Usuario | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError]   = useState<string | null>(null)

  async function handleDelete() {
    if (!deleting) return
    setDeleteError(null)
    setDeleteLoading(true)
    try {
      await deleteUsuario(deleting.user_id)
      setDeleting(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const totalUsers = Object.values(byRole).reduce((s, arr) => s + arr.length, 0)

  return (
    <section className="animate-fade-up space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            Administración
          </p>
          <h1 className="mt-0.5 text-2xl font-black text-slate-900 dark:text-white">Usuarios</h1>
          {!isLoading && (
            <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
              {totalUsers} usuario{totalUsers !== 1 ? 's' : ''} registrado{totalUsers !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setShowCreate(true); setCreateError(null) }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          <PlusIcon className="size-4" />
          Nuevo usuario
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-sm text-slate-400">Cargando usuarios...</div>
      ) : (
        <div className="space-y-6">
          {ROLE_ORDER.map((role) => {
            const users = byRole[role]
            return (
              <div key={role} className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                {/* Role header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <RoleBadge rol={role} />
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {users.length} usuario{users.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {users.length === 0 ? (
                  <p className="px-5 py-6 text-center text-xs text-slate-400 dark:text-slate-600">
                    Sin usuarios con este rol.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-50 dark:divide-slate-800">
                    {users.map((u) => (
                      <li key={u.user_id} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {/* Avatar */}
                        <div className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${ROLE_COLORS[u.rol].split(' ')[0].replace('bg-', 'bg-').replace('100', '500')}`}>
                          {u.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{u.nombre}</p>
                          <p className="truncate text-xs text-slate-400 dark:text-slate-500">{u.email}</p>
                        </div>

                        {/* Date */}
                        <p className="hidden text-[11px] text-slate-300 dark:text-slate-600 sm:block">
                          desde {new Date(u.created_at).toLocaleDateString('es-PY', { month: 'short', year: 'numeric' })}
                        </p>

                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => openEdit(u)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          >
                            <PencilSquareIcon className="size-4" />
                          </button>
                          <button
                            type="button"
                            title="Dar de baja"
                            onClick={() => { setDeleting(u); setDeleteError(null) }}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400"
                          >
                            <TrashIcon className="size-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create modal */}
      {showCreate && (
        <Modal
          title="Nuevo usuario"
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          isLoading={createLoading}
          error={createError}
          submitLabel="Crear usuario"
        >
          <Field label="Nombre completo">
            <input className={inputCls} placeholder="Ej: María González" value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)} />
          </Field>
          <Field label="Email corporativo">
            <input className={inputCls} type="email" placeholder="maria@itti.digital" value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)} />
          </Field>
          <Field label="Rol">
            <select className={selectCls} value={newRol} onChange={(e) => setNewRol(e.target.value as UsuarioRole)}>
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </Field>
        </Modal>
      )}

      {/* ── Edit modal */}
      {editing && (
        <Modal
          title="Editar usuario"
          onClose={() => setEditing(null)}
          onSubmit={handleEdit}
          isLoading={editLoading}
          error={editError}
          submitLabel="Guardar cambios"
        >
          <Field label="Nombre completo">
            <input className={inputCls} value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
          </Field>
          <Field label="Email">
            <input className={inputCls} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          </Field>
          <Field label="Rol">
            <select className={selectCls} value={editRol} onChange={(e) => setEditRol(e.target.value as UsuarioRole)}>
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </Field>
        </Modal>
      )}

      {/* ── Delete confirm */}
      {deleting && (
        <Modal
          title="Dar de baja al usuario"
          onClose={() => setDeleting(null)}
          onSubmit={handleDelete}
          isLoading={deleteLoading}
          error={deleteError}
          submitLabel="Confirmar baja"
        >
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
            <UserCircleIcon className="size-10 shrink-0 text-slate-300 dark:text-slate-600" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{deleting.nombre}</p>
              <p className="text-xs text-slate-400">{deleting.email}</p>
              <RoleBadge rol={deleting.rol} />
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Esta acción elimina el usuario del sistema. No podrá volver a ingresar hasta que sea registrado nuevamente.
          </p>
        </Modal>
      )}

    </section>
  )
}
