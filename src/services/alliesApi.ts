import type {
  AgregarCuotaPayload,
  AsignarNumFacturaPayload,
  ActualizarServicioPayload,
  ActualizarCuotaPayload,
  AliadoDetalle,
  AliadosListQuery,
  AliadoResumen,
  CrearPlanPagosPayload,
  RefinanciarDeudaPayload,
  CrearCompromisoPayload,
  CrearFacturaPayload,
  ImportarDeudasPayload,
  ImportarDeudasResult,
  FacturasListQuery,
  PaginatedFacturasResponse,
  PaginatedAliadosResponse,
  PreviewAplicacionPagoResponse,
  RegistrarPagoPayload,
  ReportePendienteRow,
  SolicitarAprobacionPayload,
} from '../types/allyDebt'
import {
  agregarCuotaBackend,
  anularPagoCuotaBackend,
  asignarNumFacturaBackend,
  actualizarServicioDeudaBackend,
  actualizarCuotaBackend,
  crearPlanPagosBackend,
  refinanciarDeudaBackend,
  crearCompromisoBackend,
  crearFacturaBackend,
  generarReporteBackend,
  importarDeudasMasivoBackend,
  listarAliadosPaginadoBackend,
  listarAliadosBackend,
  listarFacturasAliadoBackend,
  obtenerCuotasFacturaBackend,
  exportarFacturasAliadoBackend,
  exportarAliadosBackend,
  exportarAliadosDeudaDetalleBackend,
  obtenerDetalleAliadoBackend,
  obtenerFiltrosAliadosBackend,
  previewAplicacionPagoBackend,
  registrarPagoBackend,
  solicitarAprobacionBackend,
} from './loyaltyBackend'

export async function listarAliados() {
  return listarAliadosBackend() as Promise<AliadoResumen[]>
}

export async function listarAliadosPaginado(query: AliadosListQuery) {
  return listarAliadosPaginadoBackend(query) as Promise<PaginatedAliadosResponse>
}

export async function exportarAliados(query: Omit<AliadosListQuery, 'page' | 'pageSize'>) {
  return exportarAliadosBackend(query)
}

export async function exportarAliadosDeudaDetalle(query: Omit<AliadosListQuery, 'page' | 'pageSize'>) {
  return exportarAliadosDeudaDetalleBackend(query)
}

export async function obtenerFiltrosAliados() {
  return obtenerFiltrosAliadosBackend()
}

export async function obtenerDetalleAliado(aliadoId: string | number) {
  return obtenerDetalleAliadoBackend(aliadoId) as Promise<AliadoDetalle>
}

export async function listarFacturasAliado(aliadoId: string | number, query: FacturasListQuery) {
  return listarFacturasAliadoBackend(aliadoId, query) as Promise<PaginatedFacturasResponse>
}

export async function obtenerCuotasFactura(aliadoId: string | number, deudaId: string) {
  return obtenerCuotasFacturaBackend(aliadoId, deudaId)
}

export async function exportarFacturasAliado(
  aliadoId: string | number,
  query: Pick<FacturasListQuery, 'estado' | 'search'>,
) {
  return exportarFacturasAliadoBackend(aliadoId, query)
}

export async function previewAplicacionPago(payload: {
  facturaId: string
  cuotaId?: string
  montoPagado: number
}): Promise<PreviewAplicacionPagoResponse> {
  return previewAplicacionPagoBackend(payload)
}

export async function registrarPago(payload: RegistrarPagoPayload) {
  return registrarPagoBackend(payload)
}

export async function crearFactura(payload: CrearFacturaPayload) {
  return crearFacturaBackend(payload)
}

export async function crearCompromiso(payload: CrearCompromisoPayload) {
  return crearCompromisoBackend(payload)
}

export async function agregarCuota(payload: AgregarCuotaPayload) {
  return agregarCuotaBackend(payload)
}

export async function crearPlanPagos(payload: CrearPlanPagosPayload) {
  return crearPlanPagosBackend(payload)
}

export async function refinanciarDeuda(payload: RefinanciarDeudaPayload) {
  return refinanciarDeudaBackend(payload)
}

export async function actualizarCuota(payload: ActualizarCuotaPayload) {
  return actualizarCuotaBackend(payload)
}

export async function actualizarServicioDeuda(payload: ActualizarServicioPayload) {
  return actualizarServicioDeudaBackend(payload)
}

export async function generarReporte(): Promise<ReportePendienteRow[]> {
  return generarReporteBackend()
}

export async function importarDeudasMasivo(payload: ImportarDeudasPayload): Promise<ImportarDeudasResult> {
  return importarDeudasMasivoBackend(payload)
}

export async function asignarNumFactura(payload: AsignarNumFacturaPayload) {
  return asignarNumFacturaBackend(payload)
}

export async function anularPagoCuota(cuotaId: string) {
  return anularPagoCuotaBackend(cuotaId)
}

export async function solicitarAprobacion(payload: SolicitarAprobacionPayload) {
  return solicitarAprobacionBackend(payload)
}
