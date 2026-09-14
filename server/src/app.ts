import path from 'node:path'
import { fileURLToPath } from 'node:url'

import cors from 'cors'
import express from 'express'

import { env } from './config/env.js'
import { errorHandler } from './middlewares/errorHandler.js'
import { apiRouter } from './routes/index.js'
import { getUploadsRootDir } from './services/localFileStorage.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendDist = path.resolve(__dirname, '../../frontend-dist')

console.log('[app] frontendDist:', frontendDist)

// BigInt is not serializable by JSON.stringify by default
;(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString()
}

export const app = express()

app.use(express.json())
app.use('/uploads', express.static(getUploadsRootDir()))

// FE + API salen del mismo contenedor en NullPlatform. El browser igual envía
// Origin en POST; reflejamos ese Origin para no romper el login.
const corsMiddleware = cors({ origin: true })

// API routes
app.use('/api', corsMiddleware, apiRouter)

// Frontend static files
app.use(express.static(frontendDist))

// SPA fallback: rutas no reconocidas sirven index.html
app.use((_req, res, next) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next()
  })
})

app.use(errorHandler)
