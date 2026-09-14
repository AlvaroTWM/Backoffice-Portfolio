import { randomUUID } from 'node:crypto'

import type { CreateInvoiceInput, InvoiceResponse } from '../types/invoice.js'

let invoices: InvoiceResponse[] = []

function createId() {
  return `inv-${randomUUID()}`
}

export function listInvoices() {
  return invoices
}

export function createInvoice(input: CreateInvoiceInput) {
  const invoice: InvoiceResponse = {
    aliado_id: input.aliado_id,
    comercio: input.comercio,
    comentarios:
      input.comentarios ?? ['Evidencia recibida y almacenada localmente para revision.'],
    estado: 'Pendiente',
    fecha_subida: new Date().toISOString(),
    id: createId(),
    monto: input.monto,
    nro_factura: input.nro_factura,
    url_imagen: input.url_imagen,
  }

  invoices = [invoice, ...invoices]

  return invoice
}

export function updateInvoiceStatus(
  invoiceId: string,
  estado: 'Verificado' | 'Rechazado',
  comentarios: string[] = [],
) {
  const invoice = invoices.find((currentInvoice) => currentInvoice.id === invoiceId)

  if (!invoice) {
    return null
  }

  invoice.estado = estado
  invoice.comentarios = comentarios.length > 0 ? comentarios : invoice.comentarios

  return invoice
}
