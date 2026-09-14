import { Router } from 'express'
import {
  getUsuarios,
  getUsuariosPorRol,
  getUsuarioPorEmail,
  createUsuario,
  updateUsuario,
  deleteUsuario,
} from '../controllers/usuarios.controller.js'
import { authMiddleware } from '../middlewares/authJwt.middleware.js'
import { requireRole } from '../middlewares/requireRole.middleware.js'

export const usuariosRouter = Router()

const adminOnly = [authMiddleware, requireRole(['admin'])]
const anyRole   = [authMiddleware, requireRole(['admin', 'gerencia', 'alianzas', 'operaciones'])]

// Accesible a cualquier rol autenticado (para el selector del modal de aprobación)
usuariosRouter.get('/por-email', ...anyRole, getUsuarioPorEmail)
usuariosRouter.get('/por-rol', ...anyRole, getUsuariosPorRol)

usuariosRouter.get('/',      ...adminOnly, getUsuarios)
usuariosRouter.post('/',     ...adminOnly, createUsuario)
usuariosRouter.patch('/:id', ...adminOnly, updateUsuario)
usuariosRouter.delete('/:id', ...adminOnly, deleteUsuario)
