import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const uploadsRootDir = path.resolve(currentDir, '../../uploads')
const invoiceUploadsDir = path.join(uploadsRootDir, 'invoices')

const extensionByMimeType: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export function getUploadsRootDir() {
  return uploadsRootDir
}

export async function saveInvoiceImage(file: Express.Multer.File) {
  const extension = extensionByMimeType[file.mimetype] ?? path.extname(file.originalname) ?? ''
  const filename = `${Date.now()}-${randomUUID()}${extension}`
  const absolutePath = path.join(invoiceUploadsDir, filename)

  await mkdir(invoiceUploadsDir, { recursive: true })
  await writeFile(absolutePath, file.buffer)

  return {
    filename,
    relativeUrl: `/uploads/invoices/${filename}`,
  }
}
