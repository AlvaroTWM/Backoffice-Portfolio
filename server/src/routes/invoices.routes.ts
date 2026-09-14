import { Router } from 'express'

import {
  getInvoices,
  postInvoice,
  rejectInvoice,
  verifyInvoice,
} from '../controllers/invoices.controller.js'
import { authMiddleware } from '../middlewares/authJwt.middleware.js'
import { requireRole } from '../middlewares/requireRole.middleware.js'
import { uploadInvoiceImage } from '../middlewares/uploadInvoiceImage.js'

export const invoicesRouter = Router()

// Lectura — todos los roles autenticados
invoicesRouter.get('/invoices', authMiddleware, getInvoices)

// Escritura — admin y alianzas (swap alianzas <-> operaciones)
invoicesRouter.post('/invoices',
  authMiddleware,
  requireRole(['admin', 'alianzas']),
  uploadInvoiceImage.single('imagen'),
  postInvoice,
)

invoicesRouter.patch('/invoices/:invoiceId/verify',
  authMiddleware,
  requireRole(['admin', 'gerencia', 'operaciones']),
  verifyInvoice,
)
invoicesRouter.patch('/invoices/:invoiceId/reject',
  authMiddleware,
  requireRole(['admin', 'gerencia', 'operaciones']),
  rejectInvoice,
)
