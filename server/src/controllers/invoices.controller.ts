import type { Request, Response } from 'express'

import {
  createInvoice,
  listInvoices,
  updateInvoiceStatus,
} from '../services/mockInvoiceStore.js'
import { saveInvoiceImage } from '../services/localFileStorage.js'

function parseRequiredText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseComments(value: unknown) {
  return Array.isArray(value)
    ? value.filter((comment): comment is string => typeof comment === 'string')
    : []
}

export function getInvoices(_request: Request, response: Response) {
  response.status(200).json(listInvoices())
}

function getPublicImageUrl(request: Request, relativeUrl: string) {
  return `${request.protocol}://${request.get('host')}${relativeUrl}`
}

export async function postInvoice(request: Request, response: Response) {
  const nro_factura = parseRequiredText(request.body.nro_factura)
  const comercio = parseRequiredText(request.body.comercio)
  const aliado_id = parseRequiredText(request.body.aliado_id)
  const monto = Number(request.body.monto)

  if (!nro_factura || !comercio || !aliado_id || !Number.isFinite(monto) || monto <= 0) {
    response.status(400).json({
      message: 'Completa referencia de pago, comercio, aliado y monto valido.',
    })
    return
  }

  if (!request.file) {
    response.status(400).json({
      message: 'Adjunta una evidencia de pago.',
    })
    return
  }

  const storedFile = await saveInvoiceImage(request.file)
  const invoice = createInvoice({
    aliado_id,
    comercio,
    comentarios: ['Evidencia recibida y almacenada localmente para revision.'],
    monto,
    nro_factura,
    url_imagen: getPublicImageUrl(request, storedFile.relativeUrl),
  })

  response.status(201).json(invoice)
}

export function verifyInvoice(request: Request, response: Response) {
  const invoiceId = parseRequiredText(request.params.invoiceId)
  const invoice = updateInvoiceStatus(
    invoiceId,
    'Verificado',
    parseComments(request.body.comentarios),
  )

  if (!invoice) {
    response.status(404).json({
      message: 'Pago no encontrado.',
    })
    return
  }

  response.status(200).json(invoice)
}

export function rejectInvoice(request: Request, response: Response) {
  const invoiceId = parseRequiredText(request.params.invoiceId)
  const invoice = updateInvoiceStatus(
    invoiceId,
    'Rechazado',
    parseComments(request.body.comentarios),
  )

  if (!invoice) {
    response.status(404).json({
      message: 'Pago no encontrado.',
    })
    return
  }

  response.status(200).json(invoice)
}
