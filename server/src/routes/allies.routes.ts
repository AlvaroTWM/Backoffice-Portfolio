import { Router } from 'express'

import {
  getAllies,
  getAlliesExport,
  getAlliesDeudaDetalleExport,
  getAlliesFilterOptions,
  getAllyById,
  getAllyFacturas,
  getAllyFacturasExport,
  getFacturaCuotasHandler,
  patchNumFactura,
  postFactura,
  postPago,
  postPagoPreview,
  postAnularPagoCuota,
} from '../controllers/allies.controller.js'
import { authMiddleware } from '../middlewares/authJwt.middleware.js'
import { requireRole } from '../middlewares/requireRole.middleware.js'

export const alliesRouter = Router()

// Lectura — todos los roles autenticados
alliesRouter.get('/allies', getAllies)
alliesRouter.get('/allies/filter-options', getAlliesFilterOptions)
alliesRouter.get('/allies/export/detalle', getAlliesDeudaDetalleExport)
alliesRouter.get('/allies/export', getAlliesExport)
alliesRouter.get('/allies/:id/facturas/export', getAllyFacturasExport)
alliesRouter.get('/allies/:id/facturas/:deudaId/cuotas', getFacturaCuotasHandler)
alliesRouter.get('/allies/:id/facturas', getAllyFacturas)
alliesRouter.get('/allies/:id', getAllyById)

// Escritura — admin, alianzas y operaciones (swap alianzas <-> operaciones)
alliesRouter.post('/allies/facturas', authMiddleware, requireRole(['admin', 'alianzas']), postFactura)
alliesRouter.patch(
  '/allies/facturas/:deudaId/num-factura',
  authMiddleware,
  requireRole(['admin', 'alianzas', 'operaciones']),
  patchNumFactura,
)
alliesRouter.post(
  '/allies/pagos/preview',
  authMiddleware,
  requireRole(['admin', 'alianzas']),
  postPagoPreview,
)
alliesRouter.post('/allies/pagos', authMiddleware, requireRole(['admin', 'alianzas']), postPago)
alliesRouter.post(
  '/allies/cuotas/:cuotaId/anular-pago',
  authMiddleware,
  requireRole(['admin']),
  postAnularPagoCuota,
)
