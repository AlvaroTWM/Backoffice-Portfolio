import type { PaymentDocument } from './paymentModel'

export function serializePayment(payment: PaymentDocument & { _id: unknown }) {
  return {
    aliado_id: payment.aliado_id,
    comercio: payment.comercio,
    comentarios: payment.comentarios,
    estado: payment.estado,
    fecha_subida: payment.fecha_subida.toISOString(),
    id: String(payment._id),
    monto: payment.monto,
    nro_factura: payment.nro_factura,
    url_imagen: payment.url_imagen,
  }
}

export function parseComments(value: unknown) {
  return Array.isArray(value)
    ? value.filter((comment): comment is string => typeof comment === 'string')
    : []
}
