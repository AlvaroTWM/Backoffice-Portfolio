export const invoiceStatuses = ['Pendiente', 'Verificado', 'Rechazado'] as const

export type InvoiceStatus = (typeof invoiceStatuses)[number]

export interface InvoiceResponse {
  aliado_id: string
  comercio: string
  comentarios: string[]
  estado: InvoiceStatus
  fecha_subida: string
  id: string
  monto: number
  nro_factura: string
  url_imagen: string
}

export interface CreateInvoiceInput {
  aliado_id: string
  comercio: string
  comentarios?: string[]
  monto: number
  nro_factura: string
  url_imagen: string
}
