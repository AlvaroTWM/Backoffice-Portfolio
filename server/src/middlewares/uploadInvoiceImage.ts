import multer from 'multer'

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export const uploadInvoiceImage = multer({
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('Solo se permiten imagenes PNG, JPG o WEBP.'))
      return
    }

    callback(null, true)
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  storage: multer.memoryStorage(),
})
