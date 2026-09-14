import { Router } from 'express'
import multer from 'multer'
import { importAliadosXlsx, importAsignarFacturasXlsx } from '../controllers/devImport.controller.js'
import { importPagosXlsx } from '../controllers/devImportPagos.controller.js'
import {
  exportImportAliadosXlsx,
  exportImportFacturasXlsx,
  exportImportPagosXlsx,
} from '../controllers/devImportExport.controller.js'
import {
  exportAliadosXlsx,
  exportDeudasXlsx,
  exportEjecutivasXlsx,
  updateAliadosXlsx,
  updateDeudasXlsx,
  updateEjecutivasXlsx,
} from '../controllers/devUpdate.controller.js'
import { authMiddleware } from '../middlewares/authJwt.middleware.js'
import { requireRole } from '../middlewares/requireRole.middleware.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se aceptan archivos .xlsx'))
    }
  },
})

export const devRouter = Router()

const UPDATE_ROLES = ['admin', 'gerencia'] as const
const IMPORT_ROLES = ['admin', 'operaciones', 'alianzas'] as const

devRouter.post(
  '/dev/import-aliados',
  authMiddleware,
  requireRole(['admin', 'operaciones', 'alianzas']),
  upload.single('file'),
  importAliadosXlsx,
)

devRouter.post(
  '/dev/import-facturas',
  authMiddleware,
  requireRole(['admin', 'operaciones', 'alianzas']),
  upload.single('file'),
  importAsignarFacturasXlsx,
)

devRouter.post(
  '/dev/import-pagos',
  authMiddleware,
  requireRole(['admin', 'operaciones', 'alianzas']),
  upload.single('file'),
  importPagosXlsx,
)

devRouter.get('/dev/export-import-aliados',   authMiddleware, requireRole([...IMPORT_ROLES]), exportImportAliadosXlsx)
devRouter.get('/dev/export-import-facturas', authMiddleware, requireRole([...IMPORT_ROLES]), exportImportFacturasXlsx)
devRouter.get('/dev/export-import-pagos',    authMiddleware, requireRole([...IMPORT_ROLES]), exportImportPagosXlsx)

devRouter.get('/dev/export-aliados',    authMiddleware, requireRole([...UPDATE_ROLES]), exportAliadosXlsx)
devRouter.get('/dev/export-deudas',    authMiddleware, requireRole([...UPDATE_ROLES]), exportDeudasXlsx)
devRouter.get('/dev/export-ejecutivas', authMiddleware, requireRole([...UPDATE_ROLES]), exportEjecutivasXlsx)

devRouter.post('/dev/update-aliados',    authMiddleware, requireRole([...UPDATE_ROLES]), upload.single('file'), updateAliadosXlsx)
devRouter.post('/dev/update-deudas',     authMiddleware, requireRole([...UPDATE_ROLES]), upload.single('file'), updateDeudasXlsx)
devRouter.post('/dev/update-ejecutivas', authMiddleware, requireRole([...UPDATE_ROLES]), upload.single('file'), updateEjecutivasXlsx)
