import { randomUUID } from 'node:crypto'

const TOLERANCIA_PYG = 1000n

export type CuotaPlanInput = {
  numero_cuota: number
  monto_cuota: number
  fecha_vencimiento: string
}

function n(value: bigint): number {
  return Number(value)
}

function sumCuotasInput(cuotas: CuotaPlanInput[]): bigint {
  return cuotas.reduce((sum, c) => sum + BigInt(Math.round(Number(c.monto_cuota))), 0n)
}

function assertSumaCuotas(cuotas: CuotaPlanInput[], esperado: bigint, etiqueta: string) {
  const total = sumCuotasInput(cuotas)
  const diff = total > esperado ? total - esperado : esperado - total
  if (diff > TOLERANCIA_PYG) {
    throw new Error(
      `La suma de cuotas (${n(total)}) debe ser igual al ${etiqueta} (${n(esperado)}). Diferencia: ${n(diff)} PYG.`,
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any

export async function contarRefinanciacionesAprobadas(tx: Tx, deudaId: string): Promise<number> {
  return tx.aprobacion.count({
    where: {
      registro_id: deudaId,
      accion: 'REFINANCIAR_DEUDA',
      estado: 'Aprobado',
    },
  }) as Promise<number>
}

async function getMaxNroCuota(tx: Tx, deudaId: string): Promise<number> {
  const agg = await tx.cuota.aggregate({
    where: { deuda_id: deudaId },
    _max: { nro_cuota: true },
  })
  return agg._max.nro_cuota ?? 0
}

async function crearCuotasNuevas(
  tx: Tx,
  deudaId: string,
  rawCuotas: CuotaPlanInput[],
  aprobadorId: string,
  baseNro: number,
) {
  if (rawCuotas.length === 0) return

  await tx.cuota.createMany({
    data: rawCuotas.map((c, i) => ({
      cuota_id:          `C-${randomUUID().slice(0, 8)}-${i + 1}`,
      deuda_id:          deudaId,
      nro_cuota:         baseNro + c.numero_cuota,
      monto_cuota:       BigInt(Math.round(Number(c.monto_cuota))),
      saldo_cuota:       BigInt(Math.round(Number(c.monto_cuota))),
      estado_cuota:      'Pendiente',
      fecha_vencimiento: c.fecha_vencimiento ? new Date(`${c.fecha_vencimiento}T12:00:00.000Z`) : null,
      user_id:           aprobadorId || null,
    })),
  })
}

async function marcarFacturaFinanciada(tx: Tx, deudaId: string) {
  await tx.facturacion.update({
    where: { deuda_id: deudaId },
    data:  { estado_deuda: 'Financiada' },
  })
}

/** Primer plan de pagos: cubre el saldo pendiente completo de la deuda. */
export async function ejecutarCrearPlan(
  tx: Tx,
  deudaId: string,
  rawCuotas: CuotaPlanInput[],
  aprobadorId: string,
  motivo?: string,
) {
  const factura = await tx.facturacion.findUnique({ where: { deuda_id: deudaId } })
  if (!factura) throw new Error(`Factura no encontrada: ${deudaId}`)

  const saldoPendiente = factura.saldo_pendiente > 0n ? factura.saldo_pendiente : 0n
  if (saldoPendiente <= 0n) {
    throw new Error('No hay saldo pendiente para financiar en esta deuda.')
  }

  assertSumaCuotas(rawCuotas, saldoPendiente, 'saldo pendiente')

  const motivoTxt = motivo?.trim() || 'Plan de pagos inicial'

  // Todas las cuotas activas pasan a Refinanciada (incluye las que tuvieron abono parcial).
  await tx.cuota.updateMany({
    where: {
      deuda_id: deudaId,
      estado_cuota: { notIn: ['Pagada', 'Refinanciada'] },
    },
    data: {
      estado_cuota: 'Refinanciada',
      saldo_cuota: 0,
      motivo_cambio: motivoTxt,
      user_id: aprobadorId || null,
    },
  })

  const baseNro = await getMaxNroCuota(tx, deudaId)
  await crearCuotasNuevas(tx, deudaId, rawCuotas, aprobadorId, baseNro)
  await marcarFacturaFinanciada(tx, deudaId)
}

/** Refinanciación: solo cuotas seleccionadas; el plan debe cubrir 100% de su saldo. */
export async function ejecutarRefinanciarDeuda(
  tx: Tx,
  deudaId: string,
  cuotaIds: string[],
  rawCuotas: CuotaPlanInput[],
  aprobadorId: string,
  motivo?: string,
) {
  if (!Array.isArray(cuotaIds) || cuotaIds.length === 0) {
    throw new Error('Debe seleccionar al menos una cuota para refinanciar.')
  }

  const refinPrevias = await contarRefinanciacionesAprobadas(tx, deudaId)
  if (refinPrevias >= 2) {
    throw new Error('Esta deuda ya alcanzó el máximo de 2 refinanciaciones aprobadas.')
  }

  const factura = await tx.facturacion.findUnique({ where: { deuda_id: deudaId } })
  if (!factura) throw new Error(`Factura no encontrada: ${deudaId}`)

  const cuotasSel = await tx.cuota.findMany({
    where: { cuota_id: { in: cuotaIds }, deuda_id: deudaId },
  })

  if (cuotasSel.length !== cuotaIds.length) {
    throw new Error('Una o más cuotas seleccionadas no pertenecen a esta deuda.')
  }

  const invalida = cuotasSel.find(
    (c: { saldo_cuota: bigint; estado_cuota: string }) =>
      c.saldo_cuota <= 0n || c.estado_cuota === 'Pagada' || c.estado_cuota === 'Refinanciada',
  )
  if (invalida) {
    throw new Error(
      `La cuota ${invalida.cuota_id} no tiene saldo refinanciable (estado: ${invalida.estado_cuota}).`,
    )
  }

  const montoRefinanciar = cuotasSel.reduce(
    (sum: bigint, c: { saldo_cuota: bigint }) => sum + c.saldo_cuota,
    0n,
  )
  if (montoRefinanciar <= 0n) {
    throw new Error('El saldo de las cuotas seleccionadas debe ser mayor a 0.')
  }

  assertSumaCuotas(rawCuotas, montoRefinanciar, 'saldo de cuotas seleccionadas')

  const motivoTxt = motivo?.trim() || `Refinanciación (${refinPrevias + 1}/2)`

  await tx.cuota.updateMany({
    where: { cuota_id: { in: cuotaIds } },
    data: {
      estado_cuota: 'Refinanciada',
      saldo_cuota: 0,
      motivo_cambio: motivoTxt,
      user_id: aprobadorId || null,
    },
  })

  const baseNro = await getMaxNroCuota(tx, deudaId)
  await crearCuotasNuevas(tx, deudaId, rawCuotas, aprobadorId, baseNro)
  await marcarFacturaFinanciada(tx, deudaId)
}
