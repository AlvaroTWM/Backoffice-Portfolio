import { useEffect, useState } from 'react'

import {
  agregarCuota,
  anularPagoCuota,
  asignarNumFactura,
  actualizarServicioDeuda,
  crearPlanPagos,
  crearCompromiso,
  crearFactura,
  importarDeudasMasivo,
  listarAliadosPaginado,
  obtenerDetalleAliado,
  registrarPago,
  refinanciarDeuda,
  solicitarAprobacion,
} from '../services/alliesApi'
import type {
  AgregarCuotaPayload,
  AsignarNumFacturaPayload,
  ActualizarServicioPayload,
  CrearPlanPagosPayload,
  RefinanciarDeudaPayload,
  AliadoDetalle,
  AliadosListQuery,
  AliadoResumen,
  CrearCompromisoPayload,
  CrearFacturaPayload,
  ImportarDeudasPayload,
  ImportarDeudasResult,
  RegistrarPagoPayload,
  SolicitarAprobacionPayload,
} from '../types/allyDebt'

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Ocurrio un error inesperado al cargar el panel.'
}

export function useAllies() {
  const [listQuery, setListQuery] = useState<AliadosListQuery>({
    allyStatus: 'all',
    debtStatus: 'all',
    bolsa: 'all',
    rubro: 'all',
    servicio: 'all',
    name: '',
    page: 1,
    pageSize: 50,
    periodOrder: 'recent',
  })
  const [allies, setAllies] = useState<AliadoResumen[]>([])
  const [totalAllies, setTotalAllies] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedAllyId, setSelectedAllyId] = useState<string | number | null>(null)
  const [selectedAllyDetail, setSelectedAllyDetail] = useState<AliadoDetalle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAllies = async (query = listQuery) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await listarAliadosPaginado(query)
      setAllies(response.items)
      setTotalAllies(response.total)
      setTotalPages(response.totalPages)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void fetchAllies(listQuery) }, [listQuery])

  const setPage = (page: number) => {
    setListQuery((prev) => ({ ...prev, page: Math.max(1, page) }))
  }

  const setNameFilter = (name: string) => {
    setListQuery((prev) => ({ ...prev, name, page: 1 }))
  }

  const setDebtStatusFilter = (debtStatus: AliadosListQuery['debtStatus']) => {
    setListQuery((prev) => ({ ...prev, debtStatus, page: 1 }))
  }

  const setAllyStatusFilter = (allyStatus: AliadosListQuery['allyStatus']) => {
    setListQuery((prev) => ({ ...prev, allyStatus, page: 1 }))
  }

  const setBolsaFilter = (bolsa: string) => {
    setListQuery((prev) => ({ ...prev, bolsa, page: 1 }))
  }

  const setRubroFilter = (rubro: string) => {
    setListQuery((prev) => ({ ...prev, rubro, page: 1 }))
  }

  const setServicioFilter = (servicio: string) => {
    setListQuery((prev) => ({ ...prev, servicio, page: 1 }))
  }

  const setEjecutivaFilter = (ejecutiva: string) => {
    setListQuery((prev) => ({ ...prev, ejecutiva, page: 1 }))
  }

  const setPeriodOrder = (periodOrder: AliadosListQuery['periodOrder']) => {
    setListQuery((prev) => ({ ...prev, periodOrder, page: 1 }))
  }

  const loadAllyDetail = async (allyId: string | number) => {
    setIsDetailLoading(true)
    setError(null)
    try {
      setSelectedAllyDetail(await obtenerDetalleAliado(allyId))
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setIsDetailLoading(false)
    }
  }

  const selectAlly = async (allyId: string | number) => {
    setSelectedAllyId(allyId)
    await loadAllyDetail(allyId)
  }

  const refreshDetail = async () => {
    if (selectedAllyId !== null) await loadAllyDetail(selectedAllyId)
  }

  const registerPayment = async (payload: RegistrarPagoPayload) => {
    setError(null)
    try {
      await registrarPago(payload)
      await fetchAllies(listQuery)
      await refreshDetail()
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const voidPaymentOnCuota = async (cuotaId: string) => {
    setError(null)
    try {
      await anularPagoCuota(cuotaId)
      await fetchAllies(listQuery)
      await refreshDetail()
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const createFactura = async (payload: CrearFacturaPayload) => {
    setError(null)
    try {
      await crearFactura(payload)
      await fetchAllies(listQuery)
      await refreshDetail()
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const createCompromiso = async (payload: CrearCompromisoPayload) => {
    setError(null)
    try {
      await crearCompromiso(payload)
      await refreshDetail()
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const addCuota = async (payload: AgregarCuotaPayload) => {
    setError(null)
    try {
      await agregarCuota(payload)
      await fetchAllies(listQuery)
      await refreshDetail()
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const createPlan = async (payload: CrearPlanPagosPayload) => {
    setError(null)
    try {
      await crearPlanPagos(payload)
      await fetchAllies(listQuery)
      await refreshDetail()
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const refinanceDebt = async (payload: RefinanciarDeudaPayload) => {
    setError(null)
    try {
      await refinanciarDeuda(payload)
      await fetchAllies(listQuery)
      await refreshDetail()
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const importDebts = async (payload: ImportarDeudasPayload): Promise<ImportarDeudasResult> => {
    setError(null)
    try {
      const result = await importarDeudasMasivo(payload)
      await fetchAllies(listQuery)
      await refreshDetail()
      return result
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const updateService = async (payload: ActualizarServicioPayload) => {
    setError(null)
    try {
      setAllies((prev) =>
        prev.map((ally) =>
          String(ally.deuda_activa_id || '') === String(payload.deudaId)
            ? { ...ally, servicio: payload.servicio }
            : ally,
        ),
      )
      await actualizarServicioDeuda(payload)
      await fetchAllies(listQuery)
      await refreshDetail()
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const assignInvoiceNumber = async (payload: AsignarNumFacturaPayload) => {
    setError(null)
    try {
      await asignarNumFactura(payload)
      await fetchAllies(listQuery)
      await refreshDetail()
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const pedirAprobacion = async (payload: SolicitarAprobacionPayload) => {
    setError(null)
    try {
      return await solicitarAprobacion(payload)
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  return {
    addCuota,
    allies,
    createPlan,
    createCompromiso,
    createFactura,
    assignInvoiceNumber,
    updateService,
    error,
    isDetailLoading,
    isLoading,
    importDebts,
    listQuery,
    pedirAprobacion,
    refinanceDebt,
    registerPayment,
    refetch: () => fetchAllies(listQuery),
    setAllyStatusFilter,
    setBolsaFilter,
    setDebtStatusFilter,
    setEjecutivaFilter,
    setNameFilter,
    setPage,
    setPeriodOrder,
    setRubroFilter,
    setServicioFilter,
    selectedAllyDetail,
    selectedAllyId,
    selectAlly,
    totalAllies,
    totalPages,
    voidPaymentOnCuota,
  }
}
