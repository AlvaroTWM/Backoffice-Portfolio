import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'

const VALID_ROLES = ['admin', 'gerencia', 'alianzas', 'operaciones'] as const
type ValidRole = (typeof VALID_ROLES)[number]

export const DEFAULT_APPROVAL_ASSIGNEE_EMAIL = 'alvaro.arambulo@itti.digital'

function isValidRole(r: unknown): r is ValidRole {
  return VALID_ROLES.includes(r as ValidRole)
}

// GET /api/usuarios/por-email?email=...  (cualquier usuario autenticado puede consultar)
export async function getUsuarioPorEmail(request: Request, response: Response) {
  try {
    const { email } = request.query
    if (!email || typeof email !== 'string' || !email.trim()) {
      response.status(400).json({ message: 'email es requerido.' })
      return
    }

    const usuario = await prisma.usuario.findUnique({
      where:  { email: email.toLowerCase().trim() },
      select: { user_id: true, nombre: true, email: true, rol: true },
    })

    if (!usuario) {
      response.status(404).json({ message: 'Usuario no encontrado.' })
      return
    }

    response.status(200).json({ usuario })
  } catch (err) {
    console.error('[getUsuarioPorEmail]', err)
    response.status(500).json({ message: 'Error al obtener usuario.' })
  }
}

// GET /api/usuarios/por-rol?rol=gerencia  (cualquier usuario autenticado puede consultar)
export async function getUsuariosPorRol(request: Request, response: Response) {
  try {
    const { rol } = request.query
    if (!rol || typeof rol !== 'string' || !isValidRole(rol)) {
      response.status(400).json({ message: `rol inválido. Debe ser uno de: ${VALID_ROLES.join(', ')}.` })
      return
    }

    const usuarios = await prisma.usuario.findMany({
      where:   { rol },
      select:  { user_id: true, nombre: true, email: true },
      orderBy: { nombre: 'asc' },
    })

    const alwaysInclude = await prisma.usuario.findUnique({
      where:  { email: DEFAULT_APPROVAL_ASSIGNEE_EMAIL.toLowerCase() },
      select: { user_id: true, nombre: true, email: true },
    })

    const merged = alwaysInclude && !usuarios.some((user) => user.user_id === alwaysInclude.user_id)
      ? [alwaysInclude, ...usuarios]
      : usuarios

    response.status(200).json({ usuarios: merged })
  } catch (err) {
    console.error('[getUsuariosPorRol]', err)
    response.status(500).json({ message: 'Error al obtener usuarios.' })
  }
}

// GET /api/usuarios
export async function getUsuarios(_request: Request, response: Response) {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        user_id:    true,
        email:      true,
        nombre:     true,
        rol:        true,
        created_at: true,
        updated_at: true,
      },
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
    })
    response.status(200).json({ usuarios })
  } catch (err) {
    console.error('[getUsuarios]', err)
    response.status(500).json({ message: 'Error al obtener usuarios.' })
  }
}

// POST /api/usuarios
export async function createUsuario(request: Request, response: Response) {
  try {
    const { email, nombre, rol } = request.body as Record<string, unknown>

    if (!email || typeof email !== 'string') {
      response.status(400).json({ message: 'El email es requerido.' })
      return
    }
    if (!nombre || typeof nombre !== 'string') {
      response.status(400).json({ message: 'El nombre es requerido.' })
      return
    }
    if (!isValidRole(rol)) {
      response.status(400).json({ message: `Rol inválido. Debe ser uno de: ${VALID_ROLES.join(', ')}.` })
      return
    }

    const existing = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (existing) {
      response.status(409).json({ message: 'Ya existe un usuario con ese email.' })
      return
    }

    const usuario = await prisma.usuario.create({
      data: {
        email:  email.toLowerCase().trim(),
        nombre: nombre.trim(),
        rol,
      },
      select: { user_id: true, email: true, nombre: true, rol: true, created_at: true, updated_at: true },
    })

    response.status(201).json({ usuario })
  } catch (err) {
    console.error('[createUsuario]', err)
    response.status(500).json({ message: 'Error al crear usuario.' })
  }
}

// PATCH /api/usuarios/:id
export async function updateUsuario(request: Request, response: Response) {
  try {
    const id = request.params['id'] as string
    const { nombre, rol, email } = request.body as Record<string, unknown>

    const existing = await prisma.usuario.findUnique({ where: { user_id: id } })
    if (!existing) {
      response.status(404).json({ message: 'Usuario no encontrado.' })
      return
    }

    if (rol !== undefined && !isValidRole(rol)) {
      response.status(400).json({ message: `Rol inválido. Debe ser uno de: ${VALID_ROLES.join(', ')}.` })
      return
    }

    const updated = await prisma.usuario.update({
      where: { user_id: id },
      data: {
        ...(nombre && typeof nombre === 'string' ? { nombre: nombre.trim() } : {}),
        ...(email  && typeof email  === 'string' ? { email: email.toLowerCase().trim() } : {}),
        ...(rol    ? { rol: rol as ValidRole } : {}),
      },
      select: { user_id: true, email: true, nombre: true, rol: true, created_at: true, updated_at: true },
    })

    response.status(200).json({ usuario: updated })
  } catch (err) {
    console.error('[updateUsuario]', err)
    response.status(500).json({ message: 'Error al actualizar usuario.' })
  }
}

// DELETE /api/usuarios/:id
export async function deleteUsuario(request: Request, response: Response) {
  try {
    const id = request.params['id'] as string
    const currentUser = (request as Request & { user?: { userId: string } }).user

    if (currentUser?.userId === id) {
      response.status(400).json({ message: 'No podés darte de baja a vos mismo.' })
      return
    }

    const existing = await prisma.usuario.findUnique({ where: { user_id: id } })
    if (!existing) {
      response.status(404).json({ message: 'Usuario no encontrado.' })
      return
    }

    await prisma.usuario.delete({ where: { user_id: id } })
    response.status(200).json({ message: `Usuario ${existing.email} eliminado correctamente.` })
  } catch (err) {
    console.error('[deleteUsuario]', err)
    response.status(500).json({ message: 'Error al eliminar usuario.' })
  }
}
