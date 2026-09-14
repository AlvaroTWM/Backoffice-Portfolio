import { randomUUID } from 'node:crypto'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'

type Tx = Prisma.TransactionClient

export type DestinoPreview =
  | {
      tipo: 'CUOTA'
      cuotaId: string
      deudaId: string
      nro: number
      numFactura?: string | null
      monto: number
      esCascada: boolean
    }
  | {
      tipo: 'DEUDA'
      deudaId: string
      numFactura?: string | null
      monto: number
      esCascada: boolean
    }
  | { tipo: 'SALDO_A_FAVOR'; monto: number }

export class PagoConfirmacionRequeridaError extends Error {
  readonly code = 'CONFIRMACION_CASCADA_REQUERIDA'
  readonly destinos: DestinoPreview[]

  constructor(destinos: DestinoPreview[]) {
    super('Se requiere confirmación explícita para aplicar el excedente.')
    this.name = 'PagoConfirmacionRequeridaError'
    this.destinos = destinos
  }
}

export class PagoValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PagoValidationError'
  }
}

type CuotaCandidata = {
  cuota_id: string
  deuda_id: string
  nro_cuota: number
  saldo_cuota: bigint
  monto_cuota: bigint
  estado_cuota: string
  fecha_vencimiento: Date | null
  num_factura?: string | null
}

function n(value: bigint | null | undefined): number {
  if (value == null) return 0
  return Number(value)
}

function assertFacturaConNumero(numFactura: string | null | undefined): void {
  if (!numFactura?.trim()) {
    throw new PagoValidationError(
      'No se puede registrar un pago hasta asignar el N° de factura a la deuda.',
    )
  }
}

function startOfTodayUtc(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function isCuotaVencida(c: Pick<CuotaCandidata, 'estado_cuota' | 'fecha_vencimiento'>, hoy: Date): boolean {
  if (c.estado_cuota.trim().toLowerCase() === 'vencida') return true
  if (!c.fecha_vencimiento) return false
  return c.fecha_vencimiento.getTime() < hoy.getTime()
}

/** CHECK cuotas: Pendiente | Parcial | Pagada | Vencida | Refinanciada */
export function estadoCuotaFromSaldo(
  saldo: bigint,
  montoCuota: bigint,
  fechaVencimiento?: Date | null,
): string {
  if (saldo <= 0n) return 'Pagada'
  if (saldo < montoCuota) return 'Parcial'
  if (fechaVencimiento && fechaVencimiento.getTime() < startOfTodayUtc().getTime()) return 'Vencida'
  return 'Pendiente'
}

export function estadoDeudaFromSaldo(saldo: bigint): string {
  return saldo <= 0n ? 'Pagada' : 'Pendiente'
}

function resolveEstadoDeudaTrasRecalculo(saldo: bigint, estadoActual?: string | null): string {
  if (saldo <= 0n) return 'Pagada'
  const estado = estadoActual?.trim() ?? ''
  if (estado === 'Financiada') return 'Financiada'
  if (estado.toLowerCase() === 'anulada' || estado.toLowerCase() === 'anulado') return estado
  return 'Pendiente'
}

/** Suma saldos de cuotas cobrables (excluye Refinanciada). Sin cuotas activas, conserva factura. */
async function recalcularSaldoPendienteFactura(
  tx: Tx,
  deudaId: string,
): Promise<{ saldo: bigint; estado: string }> {
  const factura = await tx.facturacion.findUnique({ where: { deuda_id: deudaId } })
  if (!factura) return { saldo: 0n, estado: 'Pagada' }

  const cuotas = await tx.cuota.findMany({
    where: { deuda_id: deudaId },
    select: { saldo_cuota: true, estado_cuota: true },
  })

  const cuotasCobrables = cuotas.filter((c) => c.estado_cuota !== 'Refinanciada')

  if (cuotasCobrables.length === 0) {
    const saldo = factura.saldo_pendiente > 0n ? factura.saldo_pendiente : 0n
    return {
      saldo,
      estado: resolveEstadoDeudaTrasRecalculo(saldo, factura.estado_deuda),
    }
  }

  const saldo = cuotasCobrables.reduce(
    (sum, c) => sum + (c.saldo_cuota > 0n ? c.saldo_cuota : 0n),
    0n,
  )

  return {
    saldo,
    estado: resolveEstadoDeudaTrasRecalculo(saldo, factura.estado_deuda),
  }
}

const METODOS_PAGO_VALIDOS = new Set([
  'Transferencia',
  'Efectivo',
  'Cheque',
  'Nota de Credito',
  'Saldo a Favor',
])

export function normalizeMetodoPago(raw?: string): string | undefined {
  const v = raw?.trim()
  if (!v) return undefined
  if (METODOS_PAGO_VALIDOS.has(v)) return v
  const lower = v.toLowerCase()
  if (lower.startsWith('transf')) return 'Transferencia'
  if (lower.startsWith('efect')) return 'Efectivo'
  if (lower.startsWith('cheq')) return 'Cheque'
  if (lower.includes('credito') || lower.includes('crédito') || lower === 'nc') return 'Nota de Credito'
  if (lower.includes('favor') || lower.includes('saldo')) return 'Saldo a Favor'
  return undefined
}

function requiereConfirmacion(destinos: DestinoPreview[]): boolean {
  if (destinos.some((d) => d.tipo === 'SALDO_A_FAVOR')) return true
  const cuotasCascada = destinos.filter((d) => d.tipo === 'CUOTA' && d.esCascada)
  return cuotasCascada.length > 0 || destinos.filter((d) => d.tipo === 'CUOTA').length > 1
}

function sumAplicadoFactura(destinos: DestinoPreview[], deudaId: string): bigint {
  return destinos.reduce((sum, d) => {
    if (d.tipo === 'SALDO_A_FAVOR') return sum
    if (d.deudaId !== deudaId) return sum
    return sum + BigInt(d.monto)
  }, 0n)
}

function buildDestinos(
  monto: bigint,
  cuotasOrdenadas: CuotaCandidata[],
  facturaActual: {
    deudaId: string
    numFactura?: string | null
    saldoPendiente: bigint
  },
): DestinoPreview[] {
  let restante = monto
  const destinos: DestinoPreview[] = []
  let ordenPrimera = true

  const cuotasFacturaActual = cuotasOrdenadas.filter((c) => c.deuda_id === facturaActual.deudaId)
  const cuotasOtras = cuotasOrdenadas.filter((c) => c.deuda_id !== facturaActual.deudaId)

  const aplicarCuotas = (cuotas: CuotaCandidata[]) => {
    for (const cuota of cuotas) {
      if (restante <= 0n) break
      const saldo = cuota.saldo_cuota > 0n ? cuota.saldo_cuota : 0n
      if (saldo <= 0n) continue
      const aplicado = restante < saldo ? restante : saldo
      destinos.push({
        tipo: 'CUOTA',
        cuotaId: cuota.cuota_id,
        deudaId: cuota.deuda_id,
        nro: cuota.nro_cuota,
        numFactura: cuota.num_factura ?? null,
        monto: n(aplicado),
        esCascada: !ordenPrimera,
      })
      ordenPrimera = false
      restante -= aplicado
    }
  }

  // 1) Cuotas de la factura actual
  aplicarCuotas(cuotasFacturaActual)

  // 2) Saldo directo de la factura actual (sin cuotas o saldo no cubierto por cuotas)
  if (restante > 0n && facturaActual.saldoPendiente > 0n) {
    const yaAplicadoFactura = sumAplicadoFactura(destinos, facturaActual.deudaId)
    const saldoRestanteFactura =
      facturaActual.saldoPendiente > yaAplicadoFactura
        ? facturaActual.saldoPendiente - yaAplicadoFactura
        : 0n
    if (saldoRestanteFactura > 0n) {
      const aplicado = restante < saldoRestanteFactura ? restante : saldoRestanteFactura
      destinos.push({
        tipo: 'DEUDA',
        deudaId: facturaActual.deudaId,
        numFactura: facturaActual.numFactura ?? null,
        monto: n(aplicado),
        esCascada: !ordenPrimera,
      })
      ordenPrimera = false
      restante -= aplicado
    }
  }

  // 3) Cascada a cuotas vencidas de otras facturas
  aplicarCuotas(cuotasOtras)

  // 4) Excedente a saldo a favor
  if (restante > 0n) {
    destinos.push({ tipo: 'SALDO_A_FAVOR', monto: n(restante) })
  }

  return destinos
}

async function loadCuotasParaAplicacion(params: {
  tx: Tx
  codAliado: string
  facturaId: string
  cuotaId?: string
}): Promise<CuotaCandidata[]> {
  const { tx, codAliado, facturaId, cuotaId } = params
  const hoy = startOfTodayUtc()

  const facturas = await tx.facturacion.findMany({
    where: { cod_aliado: codAliado },
    select: {
      deuda_id: true,
      num_factura: true,
      cuotas: {
        orderBy: { nro_cuota: 'asc' },
        select: {
          cuota_id: true,
          deuda_id: true,
          nro_cuota: true,
          saldo_cuota: true,
          monto_cuota: true,
          estado_cuota: true,
          fecha_vencimiento: true,
        },
      },
    },
  })

  const facturaActual = facturas.find((f) => f.deuda_id === facturaId)
  if (!facturaActual) {
    throw new PagoValidationError(`Factura no encontrada: ${facturaId}`)
  }

  const mapCuota = (c: (typeof facturaActual.cuotas)[number], numFactura: string | null): CuotaCandidata => ({
    ...c,
    num_factura: numFactura,
  })

  const cola: CuotaCandidata[] = []
  const usados = new Set<string>()

  if (cuotaId) {
    const target = facturaActual.cuotas.find((c) => c.cuota_id === cuotaId)
    if (!target) {
      throw new PagoValidationError(`Cuota no encontrada en la factura: ${cuotaId}`)
    }
    cola.push(mapCuota(target, facturaActual.num_factura))
    usados.add(target.cuota_id)

    for (const c of facturaActual.cuotas) {
      if (usados.has(c.cuota_id)) continue
      if (c.nro_cuota <= target.nro_cuota) continue
      if (c.saldo_cuota <= 0n) continue
      if (c.estado_cuota === 'Pagada' || c.estado_cuota === 'Refinanciada') continue
      cola.push(mapCuota(c, facturaActual.num_factura))
      usados.add(c.cuota_id)
    }
  } else {
    for (const c of facturaActual.cuotas) {
      if (c.saldo_cuota <= 0n) continue
      if (c.estado_cuota === 'Pagada' || c.estado_cuota === 'Refinanciada') continue
      cola.push(mapCuota(c, facturaActual.num_factura))
      usados.add(c.cuota_id)
    }
  }

  // Otras facturas: solo cuotas vencidas (estado o fecha)
  const otras = facturas
    .filter((f) => f.deuda_id !== facturaId)
    .flatMap((f) => f.cuotas.map((c) => mapCuota(c, f.num_factura)))
    .filter((c) => {
      if (usados.has(c.cuota_id)) return false
      if (c.saldo_cuota <= 0n) return false
      if (c.estado_cuota === 'Pagada' || c.estado_cuota === 'Refinanciada') return false
      return isCuotaVencida(c, hoy)
    })
    .sort((a, b) => {
      const fa = a.fecha_vencimiento?.getTime() ?? Number.MAX_SAFE_INTEGER
      const fb = b.fecha_vencimiento?.getTime() ?? Number.MAX_SAFE_INTEGER
      if (fa !== fb) return fa - fb
      return a.nro_cuota - b.nro_cuota
    })

  for (const c of otras) {
    cola.push(c)
    usados.add(c.cuota_id)
  }

  return cola
}

export async function previewAplicacionPago(input: {
  facturaId: string
  cuotaId?: string
  montoPagado: number
}): Promise<{
  destinos: DestinoPreview[]
  requiereConfirmacionCascada: boolean
  saldoAFavorActual: number
}> {
  const monto = BigInt(Math.round(input.montoPagado))
  if (monto <= 0n) {
    throw new PagoValidationError('El monto del pago debe ser mayor a 0.')
  }

  const factura = await prisma.facturacion.findUnique({
    where: { deuda_id: input.facturaId },
    select: { deuda_id: true, cod_aliado: true, num_factura: true, saldo_pendiente: true },
  })
  if (!factura) {
    throw new PagoValidationError(`Factura no encontrada: ${input.facturaId}`)
  }
  assertFacturaConNumero(factura.num_factura)

  const aliado = await prisma.directorioAliado.findUnique({
    where: { cod_aliado: factura.cod_aliado },
    select: { saldo_a_favor: true },
  })

  const cuotas = await loadCuotasParaAplicacion({
    tx: prisma,
    codAliado: factura.cod_aliado,
    facturaId: input.facturaId,
    cuotaId: input.cuotaId,
  })

  const destinos = buildDestinos(monto, cuotas, {
    deudaId: factura.deuda_id,
    numFactura: factura.num_factura,
    saldoPendiente: factura.saldo_pendiente,
  })
  return {
    destinos,
    requiereConfirmacionCascada: requiereConfirmacion(destinos),
    saldoAFavorActual: n(aliado?.saldo_a_favor),
  }
}

export interface RegistrarPagoAplicadoInput {
  facturaId: string
  cuotaId?: string
  fechaPago: string
  montoPagado: number
  medioPago?: string
  referencia?: string
  observacion?: string
  confirmarCascada?: boolean
  userId?: string
}

export async function registrarPagoConAplicacion(input: RegistrarPagoAplicadoInput) {
  const monto = BigInt(Math.round(input.montoPagado))
  if (monto <= 0n) {
    throw new PagoValidationError('El monto del pago debe ser mayor a 0.')
  }

  const fechaPago = new Date(`${input.fechaPago}T12:00:00.000Z`)
  if (Number.isNaN(fechaPago.getTime())) {
    throw new PagoValidationError(`fechaPago inválida: ${input.fechaPago}`)
  }

  const referencia = input.referencia?.trim()
  if (!referencia) {
    throw new PagoValidationError('El nro. de comprobante (referencia) es obligatorio.')
  }

  const metodo = normalizeMetodoPago(input.medioPago)
  if (input.medioPago?.trim() && !metodo) {
    throw new PagoValidationError(`Método de pago inválido: ${input.medioPago}`)
  }

  return prisma.$transaction(async (tx) => {
    const factura = await tx.facturacion.findUnique({
      where: { deuda_id: input.facturaId },
    })
    if (!factura) return null
    assertFacturaConNumero(factura.num_factura)

    const aliado = await tx.directorioAliado.findUnique({
      where: { cod_aliado: factura.cod_aliado },
    })
    if (!aliado) {
      throw new PagoValidationError(`Aliado no encontrado: ${factura.cod_aliado}`)
    }

    // Solo "Saldo a Favor" consume el saldo acumulado del aliado.
    // "Nota de Credito" se procesa como medio de pago, sin bloquear por saldo_a_favor.
    if (metodo === 'Saldo a Favor') {
      if (aliado.saldo_a_favor < monto) {
        throw new PagoValidationError(
          `Saldo a favor insuficiente. Disponible: ${n(aliado.saldo_a_favor)} PYG.`,
        )
      }
    }

    const pagoDuplicado = await tx.pago.findFirst({
      where: {
        cod_aliado: factura.cod_aliado,
        nro_comprobante_banco: referencia,
        estado_pago: 'Aplicado',
      },
      select: { pago_id: true },
    })
    if (pagoDuplicado) {
      throw new PagoValidationError(
        `Ya existe un pago registrado con el comprobante "${referencia}".`,
      )
    }

    const cuotasCola = await loadCuotasParaAplicacion({
      tx,
      codAliado: factura.cod_aliado,
      facturaId: input.facturaId,
      cuotaId: input.cuotaId,
    })

    const destinos = buildDestinos(monto, cuotasCola, {
      deudaId: factura.deuda_id,
      numFactura: factura.num_factura,
      saldoPendiente: factura.saldo_pendiente,
    })
    if (requiereConfirmacion(destinos) && !input.confirmarCascada) {
      throw new PagoConfirmacionRequeridaError(destinos)
    }

    const totalDestinos = destinos.reduce((sum, d) => sum + BigInt(d.monto), 0n)
    if (totalDestinos !== monto) {
      throw new PagoValidationError(
        `La aplicación del pago no coincide con el monto ingresado (${n(monto)} vs ${n(totalDestinos)}).`,
      )
    }

    const pagoId = `P-${randomUUID().slice(0, 8)}`
    const nuevoPago = await tx.pago.create({
      data: {
        pago_id: pagoId,
        cod_aliado: factura.cod_aliado,
        fecha_pago: fechaPago,
        monto_recibido: monto,
        metodo_pago: metodo,
        nro_comprobante_banco: referencia,
        observacion: input.observacion?.trim() || undefined,
        estado_pago: 'Aplicado',
        user_id: input.userId,
      },
    })

    const saldosFacturaDelta = new Map<string, bigint>()
    let orden = 1
    let saldoFavorAlta = 0n

    for (const destino of destinos) {
      if (destino.tipo === 'CUOTA') {
        const aplicado = BigInt(destino.monto)
        // Solo insertar aplicación: trg_aplicar_pago_a_cuota actualiza la cuota y
        // trg_sync_facturacion_desde_cuotas recalcula saldo_pendiente de la factura.
        await tx.aplicacionPago.create({
          data: {
            pago_id: pagoId,
            cuota_id: destino.cuotaId,
            deuda_id: destino.deudaId,
            monto_aplicado: aplicado,
            tipo_aplicacion: 'CUOTA',
            orden_aplicacion: orden,
            es_cascada: destino.esCascada,
          },
        })
        orden += 1
      } else if (destino.tipo === 'DEUDA') {
        const aplicado = BigInt(destino.monto)
        await tx.aplicacionPago.create({
          data: {
            pago_id: pagoId,
            deuda_id: destino.deudaId,
            monto_aplicado: aplicado,
            tipo_aplicacion: 'DEUDA',
            orden_aplicacion: orden,
            es_cascada: destino.esCascada,
          },
        })
        saldosFacturaDelta.set(
          destino.deudaId,
          (saldosFacturaDelta.get(destino.deudaId) ?? 0n) + aplicado,
        )
        orden += 1
      } else {
        saldoFavorAlta = BigInt(destino.monto)
        orden += 1
      }
    }

    for (const [deudaId, delta] of saldosFacturaDelta) {
      const f = await tx.facturacion.findUnique({ where: { deuda_id: deudaId } })
      if (!f) continue
      const nuevoSaldo = f.saldo_pendiente > delta ? f.saldo_pendiente - delta : 0n
      await tx.facturacion.update({
        where: { deuda_id: deudaId },
        data: {
          saldo_pendiente: nuevoSaldo,
          estado_deuda: estadoDeudaFromSaldo(nuevoSaldo),
        },
      })
    }

    let saldoFavorResultante = aliado.saldo_a_favor

    if (metodo === 'Saldo a Favor') {
      saldoFavorResultante -= monto
      await tx.directorioAliado.update({
        where: { cod_aliado: factura.cod_aliado },
        data: { saldo_a_favor: saldoFavorResultante },
      })
      await tx.movimientoSaldoFavor.create({
        data: {
          movimiento_id: `MS-${randomUUID().slice(0, 8)}`,
          cod_aliado: factura.cod_aliado,
          tipo: 'CONSUMO_PAGO',
          monto: -monto,
          saldo_resultante: saldoFavorResultante,
          pago_id: pagoId,
          observacion: `Consumo por pago ${pagoId}`,
          user_id: input.userId,
        },
      })
    }

    if (saldoFavorAlta > 0n) {
      // Si el medio fue Saldo a Favor, el neto del bolsillo es -monto + excedente
      saldoFavorResultante += saldoFavorAlta
      await tx.directorioAliado.update({
        where: { cod_aliado: factura.cod_aliado },
        data: { saldo_a_favor: saldoFavorResultante },
      })
      await tx.movimientoSaldoFavor.create({
        data: {
          movimiento_id: `MS-${randomUUID().slice(0, 8)}`,
          cod_aliado: factura.cod_aliado,
          tipo: 'ALTA_EXCEDENTE',
          monto: saldoFavorAlta,
          saldo_resultante: saldoFavorResultante,
          pago_id: pagoId,
          observacion: `Excedente del pago ${pagoId}`,
          user_id: input.userId,
        },
      })
    }

    const facturaActualizada = await tx.facturacion.findUnique({
      where: { deuda_id: input.facturaId },
    })

    return {
      factura: {
        factura_id: facturaActualizada?.deuda_id ?? input.facturaId,
        aliado_id: factura.cod_aliado,
        monto_neto: n(factura.monto_original),
        saldo_factura: n(facturaActualizada?.saldo_pendiente),
        estado_factura: facturaActualizada?.estado_deuda ?? factura.estado_deuda,
      },
      pago: {
        pago_id: nuevoPago.pago_id,
        aliado_id: nuevoPago.cod_aliado,
        factura_id: input.facturaId,
        fecha_pago: nuevoPago.fecha_pago.toISOString().slice(0, 10),
        monto_pagado: n(nuevoPago.monto_recibido),
        medio_pago: nuevoPago.metodo_pago,
        referencia: nuevoPago.nro_comprobante_banco,
        observacion: nuevoPago.observacion,
      },
      aplicaciones: destinos,
      saldo_a_favor: n(saldoFavorResultante),
    }
  })
}

export class AnularPagoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnularPagoError'
  }
}

export async function anularPagoCuotaInTx(tx: Tx, cuotaId: string) {
  const cuota = await tx.cuota.findUnique({ where: { cuota_id: cuotaId } })
  if (!cuota) {
    throw new AnularPagoError(`Cuota ${cuotaId} no encontrada.`)
  }

  if (cuota.estado_cuota === 'Refinanciada') {
    throw new AnularPagoError(
      'No se puede anular un pago sobre una cuota refinanciada. Usá las cuotas vigentes del plan actual.',
    )
  }

  const aplicaciones = await tx.aplicacionPago.findMany({
    where: { cuota_id: cuotaId },
    select: { aplicacion_id: true, monto_aplicado: true, pago_id: true },
  })

  if (aplicaciones.length === 0) {
    throw new AnularPagoError('No hay pagos aplicados a esta cuota.')
  }

  const totalRevertir = aplicaciones.reduce((sum, row) => sum + row.monto_aplicado, 0n)
  const pagoIds = [...new Set(aplicaciones.map((row) => row.pago_id))]

  await tx.aplicacionPago.deleteMany({ where: { cuota_id: cuotaId } })

  for (const pagoId of pagoIds) {
    const restantes = await tx.aplicacionPago.count({ where: { pago_id: pagoId } })
    if (restantes === 0) {
      await tx.pago.update({
        where: { pago_id: pagoId },
        data: { estado_pago: 'Anulado' },
      })
    }
  }

  const saldoRestaurado =
    cuota.saldo_cuota + totalRevertir > cuota.monto_cuota
      ? cuota.monto_cuota
      : cuota.saldo_cuota + totalRevertir

  await tx.cuota.update({
    where: { cuota_id: cuotaId },
    data: {
      saldo_cuota:  saldoRestaurado,
      estado_cuota: estadoCuotaFromSaldo(
        saldoRestaurado,
        cuota.monto_cuota,
        cuota.fecha_vencimiento,
      ),
    },
  })

  const { saldo: nuevoSaldoFactura, estado: nuevoEstadoFactura } =
    await recalcularSaldoPendienteFactura(tx, cuota.deuda_id)

  await tx.facturacion.update({
    where: { deuda_id: cuota.deuda_id },
    data: {
      saldo_pendiente: nuevoSaldoFactura,
      estado_deuda:    nuevoEstadoFactura,
    },
  })

  return {
    cuota_id:        cuotaId,
    deuda_id:        cuota.deuda_id,
    monto_revertido: n(totalRevertir),
    saldo_factura:   n(nuevoSaldoFactura),
  }
}

export async function anularPagoCuota(cuotaId: string) {
  return prisma.$transaction((tx) => anularPagoCuotaInTx(tx, cuotaId))
}
