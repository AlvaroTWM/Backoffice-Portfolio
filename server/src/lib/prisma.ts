import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

function createClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  // AWS RDS requiere SSL con certificado self-signed
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
  })

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Lazy init: el cliente se crea en la primera operación, no al importar el módulo.
// Esto evita que una DATABASE_URL faltante crashee el servidor antes de que levante.
function getOrCreatePrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient()
  }
  return globalForPrisma.prisma
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getOrCreatePrisma()
    const value = Reflect.get(client, prop, client)
    // Bind client methods ($transaction, $connect, …). Without this, `this` is the
    // Proxy and interactive transactions / raw queries can fail at runtime.
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value ?? Reflect.get(client, prop, receiver)
  },
})
