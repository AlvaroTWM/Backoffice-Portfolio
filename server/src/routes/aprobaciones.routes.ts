import { Router } from 'express'
import { crearAprobacion, getAprobaciones, resolverAprobacion } from '../controllers/aprobaciones.controller.js'
import { authMiddleware } from '../middlewares/authJwt.middleware.js'
import { requireRole } from '../middlewares/requireRole.middleware.js'

export const aprobacionesRouter = Router()

aprobacionesRouter.post(
  '/aprobaciones',
  authMiddleware,
  requireRole(['admin', 'gerencia', 'alianzas', 'operaciones']),
  crearAprobacion,
)

aprobacionesRouter.get(
  '/aprobaciones',
  authMiddleware,
  requireRole(['admin', 'gerencia', 'alianzas', 'operaciones']),
  getAprobaciones,
)

aprobacionesRouter.patch(
  '/aprobaciones/:id/resolver',
  authMiddleware,
  requireRole(['admin', 'gerencia', 'operaciones']),
  resolverAprobacion,
)
