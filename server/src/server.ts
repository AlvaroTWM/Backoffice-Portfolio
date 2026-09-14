import { app } from './app.js'
import { env } from './config/env.js'

async function bootstrap() {
  // Escuchar YA: el startup probe de K8s/NullPlatform pega a /api/health/
  // y no puede esperar a que la DB responda.
  await new Promise<void>((resolve) => {
    app.listen(env.port, env.host, () => {
      console.log(`API escuchando en http://${env.host}:${env.port}`)
      resolve()
    })
  })

  // DB en background — no bloquea el puerto ni el healthcheck
  void checkDatabase()
}

async function checkDatabase() {
  try {
    const { prisma } = await import('./lib/prisma.js')
    await prisma.$queryRaw`SELECT 1`
    console.log('[DB] Conexión a PostgreSQL OK')
  } catch (err) {
    console.error('[DB] ERROR al conectar con PostgreSQL:', err)
  }
}

bootstrap().catch((error) => {
  console.error('No fue posible iniciar la API:', error)
  process.exit(1)
})
