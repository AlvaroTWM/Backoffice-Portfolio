export type EstadoGeneralDeuda = 'sin_deuda' | 'pendiente' | 'parcial' | 'pagado' | 'con_vencimiento'

export const SERVICIOS_TIPO = ['upys', 'Reintegros', 'Marketing', 'Cupones'] as const
export type TipoServicio = (typeof SERVICIOS_TIPO)[number]

export interface AliadoRecord {
  aliado_id: string
  aliado_nombre: string
  bolsa?: string | null
  rubro?: string | null
  ruc?: string
  codigo_persona?: string
  estado: string
  fecha_alta?: string
  fecha_baja?: string
  observacion?: string
}

export interface DetalleDeuda {
  deuda_id: string
  periodo?: string
  servicio?: string
  estado_deuda: string
  num_factura?: string | null
  monto_original: number
  pagado: number
  saldo_pendiente: number
}

export interface AliadoResumen {
  aliado_id: number | string
  aliado_nombre: string
  bolsa?: string | null
  rubro?: string | null
  deuda_activa_id?: string
  servicio?: string
  ruc?: string
  codigo_persona?: string
  estado: string
  deuda_total: number
  monto_total_pagado: number
  saldo_pendiente: number
  estado_general: EstadoGeneralDeuda
  ultimo_periodo?: string
  detalles_deuda?: DetalleDeuda[]
}

export interface AliadosListQuery {
  page: number
  pageSize: number
  name?: string
  debtStatus?: 'all' | 'con_saldo' | EstadoGeneralDeuda
  allyStatus?: 'all' | 'activo' | 'inactivo'
  bolsa?: string
  rubro?: string
  servicio?: string
  ejecutiva?: string
  periodOrder?: 'recent' | 'oldest' | 'amount_desc' | 'amount_asc'
}

export interface PaginatedAliadosResponse {
  items: AliadoResumen[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface FacturaRecord {
  deuda_id?: string
  factura_id: string
  aliado_id: number | string
  cant_cuotas?: number
  cuotas_total?: number
  cuotas_pagadas?: number
  cuotas_pendientes?: number
  cuotas_parciales?: number
  fecha_vencimiento_ultima?: string
  num_factura?: string
  periodo?: string
  fecha_deuda?: string
  monto_neto: number
  tipo_factura?: string
  servicio?: string
  estado_factura: string
  saldo_factura: number
  observacion?: string
}

export type FacturaEstadoFilter = 'pendientes' | 'parciales' | 'pagadas' | 'anuladas' | 'todas'

export interface FacturasListQuery {
  page: number
  pageSize: number
  estado?: FacturaEstadoFilter
  search?: string
}

export interface PaginatedFacturasResponse {
  items: FacturaRecord[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  estado: FacturaEstadoFilter
}

export interface CuotaRecord {
  cuota_id: string
  deuda_id?: string
  factura_id: string
  numero_cuota: number
  version?: number
  vigente?: string | boolean
  fecha_registro?: string
  motivo_cambio?: string
  monto_cuota: number
  /** Suma real de aplicaciones de pago (no incluye monto refinanciado). */
  monto_pagado?: number
  /** Monto no pagado al refinanciar (solo registro histórico). */
  saldo_refinanciado?: number
  fecha_vencimiento: string
  estado_cuota: string
  saldo_cuota: number
  observacion?: string
}

export interface PagoRecord {
  pago_id: string
  factura_id: string
  deuda_id?: string
  num_factura?: string
  fecha_pago: string
  monto_pagado: number
  medio_pago?: string
  referencia?: string
  observacion?: string
}

export interface CompromisosRecord {
  compromiso_id: string
  cuota_id: string
  fecha_compromiso: string
  monto_compromiso: number
  estado_compromiso: string
  observacion?: string
}

export interface ReportePendienteRow {
  aliado_id: string
  ruc?: string
  fecha_deuda?: string
  fecha_compromiso?: string
  monto_compromiso?: number
  numero_cuota?: number
  factura_id: string
  estado: string
}

export interface AliadoDetalle {
  aliado: AliadoRecord & { saldo_a_favor?: number }
  facturas: FacturaRecord[]
  cuotas: CuotaRecord[]
  compromisos: CompromisosRecord[]
  pagos: PagoRecord[]
  resumen: {
    deuda_total: number
    monto_total_pagado: number
    saldo_pendiente: number
    saldo_a_favor?: number
  }
}

export type DestinoAplicacionPago =
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

export interface PreviewAplicacionPagoResponse {
  destinos: DestinoAplicacionPago[]
  requiereConfirmacionCascada: boolean
  saldoAFavorActual: number
}

export interface RegistrarPagoPayload {
  facturaId: string
  cuotaId?: string
  fechaPago: string
  montoPagado: number
  medioPago?: string
  referencia: string
  observacion?: string
  confirmarCascada?: boolean
}

export interface CuotaInput {
  numero_cuota: number
  monto_cuota: number
  fecha_vencimiento: string
}

export interface CrearFacturaPayload {
  aliadoId: string
  montoNeto: number
  numFactura?: string
  periodo?: string
  fechaDeuda?: string
  tipoFactura?: string
  cuotas?: CuotaInput[]
  observacion?: string
  servicio: TipoServicio
}

export interface ActualizarServicioPayload {
  deudaId: string
  servicio: TipoServicio
}

export interface ImportarDeudaRow {
  cod_aliado: string
  periodo_pago: string
  monto_neto: number
  servicio: TipoServicio
}

export interface ImportarDeudasPayload {
  rows: ImportarDeudaRow[]
}

export interface ImportarDeudasResult {
  total: number
  inserted: number
}

export interface AsignarNumFacturaPayload {
  deudaId: string
  numFactura: string
  aplicarEnCuotas?: boolean
}

export interface CrearCompromisoPayload {
  cuotaId: string
  fechaCompromiso: string
  montoCompromiso: number
  observacion?: string
}

export interface AgregarCuotaPayload {
  facturaId: string
  monto_cuota: number
  fecha_vencimiento: string
}

export interface CrearPlanPagosPayload {
  deudaId: string
  numFactura?: string
  cuotas: CuotaInput[]
  motivoCambio?: string
}

export interface RefinanciarDeudaPayload {
  deudaId: string
  cuotaIds: string[]
  cuotas: CuotaInput[]
  numFactura?: string
  motivoCambio?: string
}

export interface FacturaCuotasResponse {
  items: CuotaRecord[]
  refinanciaciones_previas?: number
  saldo_pendiente?: number
}

export interface ActualizarCuotaPayload {
  cuotaId: string
  fecha_vencimiento?: string
  monto_cuota?: number
  motivoCambio: string
}

export interface SolicitarAprobacionPayload {
  tabla: string
  registro_id: string
  accion: 'BAJA_ALIADO' | 'MODIFICAR_ALIADO' | 'CREAR_COMPROMISO' | 'MODIFICAR_COMPROMISO' | 'ANULAR_PAGO' | 'ANULAR_DEUDA' | 'CREAR_PLAN' | 'REFINANCIAR_DEUDA'
  datos_solicitud?: Record<string, unknown>
  observacion?: string
  asignado_a_user_id?: string
}
