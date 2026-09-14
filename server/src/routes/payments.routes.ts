import { Router } from 'express'

import { importPendingPayments } from '../controllers/payments.controller.js'
import { authMiddleware } from '../middlewares/authJwt.middleware.js'
import { requireRole } from '../middlewares/requireRole.middleware.js'
import { uploadPendingPaymentsFile } from '../middlewares/uploadPendingPaymentsFile.js'

export const paymentsRouter = Router()

// Importar pagos — solo admin y alianzas (swap alianzas <-> operaciones)
paymentsRouter.post(
  '/payments/import',
  authMiddleware,
  requireRole(['admin', 'alianzas']),
  uploadPendingPaymentsFile.single('archivo'),
  importPendingPayments,
)
