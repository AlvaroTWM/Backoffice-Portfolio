import type { RegistrarPagoModalTarget } from '../components/allies/RegistrarPagoModal'
import type { AliadoDetalle, CuotaRecord } from '../types/allyDebt'

/** Cuotas vigentes (se excluyen las refinanciadas, que son solo histórico). */
export function activeCuotas(detail: AliadoDetalle): CuotaRecord[] {
  return detail.cuotas
    .filter((c) => String(c.estado_cuota).trim().toLowerCase() !== 'refinanciada')
    .sort((a, b) => String(a.fecha_vencimiento).localeCompare(String(b.fecha_vencimiento)))
}

/** Cuota con saldo más antigua: destino natural de "Registrar pago" (el modal resuelve la cascada). */
export function pickPaymentTarget(detail: AliadoDetalle | null): RegistrarPagoModalTarget | null {
  if (!detail) return null
  const cuota = activeCuotas(detail).find((c) => Number(c.saldo_cuota) > 0)
  if (!cuota) return null
  const factura = detail.facturas.find((f) => String(f.factura_id) === String(cuota.factura_id))
  return {
    mode: 'cuota',
    facturaId: String(cuota.factura_id),
    cuota,
    numFactura: factura?.num_factura,
  }
}
