import { prisma } from '../lib/prisma.js'

export function normalizeServicio(raw?: string): string | null {
  const s = raw?.trim()
  if (!s) return null
  const lower = s.toLowerCase()
  if (lower === 'upys') return 'upys'
  if (lower === 'reintegros') return 'Reintegros'
  if (lower === 'cupones') return 'Cupones'
  if (lower === 'marketing') return 'Marketing'
  return s
}

/** Solo para actualizaciones manuales (update-deudas) sin deuda_id explícito. */
export async function findFacturacionForImport(
  codAliado: string,
  mes: number,
  anio: number,
  servicioRaw?: string,
) {
  const servicio = normalizeServicio(servicioRaw)
  if (servicio) {
    return prisma.facturacion.findFirst({
      where: { cod_aliado: codAliado, periodo_mes: mes, periodo_anio: anio, servicio },
    })
  }
  return prisma.facturacion.findFirst({
    where: {
      cod_aliado: codAliado,
      periodo_mes: mes,
      periodo_anio: anio,
      OR: [{ servicio: null }, { servicio: '' }],
    },
  })
}

export function saldoPendienteTrasActualizarMonto(
  montoAnterior: bigint,
  saldoAnterior: bigint,
  montoNuevo: bigint,
): bigint {
  if (saldoAnterior > montoAnterior) {
    return montoNuevo
  }
  const pagado = montoAnterior - saldoAnterior
  if (pagado <= 0n) return montoNuevo
  if (pagado >= montoNuevo) return 0n
  return montoNuevo - pagado
}
