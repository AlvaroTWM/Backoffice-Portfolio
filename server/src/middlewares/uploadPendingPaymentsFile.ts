import multer from 'multer'

const allowedMimeTypes = new Set([
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
])

export const uploadPendingPaymentsFile = multer({
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('Solo se permiten archivos Excel o CSV.'))
      return
    }

    callback(null, true)
  },
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
  storage: multer.memoryStorage(),
})
