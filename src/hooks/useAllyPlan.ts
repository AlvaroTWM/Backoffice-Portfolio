import { useEffect, useState } from 'react'

import { listarFacturasAliado, obtenerCuotasFactura } from '../services/alliesApi'
import type { AliadoDetalle, CuotaRecord, FacturaRecord } from '../types/allyDebt'

interface PlanState {
  /** aliado_id del detalle al que pertenece el plan cargado */
  key: string | null
  facturas: FacturaRecord[]
  cuotas: CuotaRecord[]
}

/**
 * El endpoint `GET /api/allies/:id` devuelve facturas/cuotas/pagos vacíos (se cargan bajo demanda).
 * Este hook completa el detalle con las deudas y cuotas vigentes, igual que la página completa.
 */
export function useAllyPlan(detail: AliadoDetalle | null): { detail: AliadoDetalle | null; isLoading: boolean } {
  const [plan, setPlan] = useState<PlanState>({ key: null, facturas: [], cuotas: [] })

  const allyId = detail ? String(detail.aliado.aliado_id) : null

  useEffect(() => {
    if (!detail || !allyId) return
    let cancelled = false

    async function load(id: string) {
      try {
        const facturasRes = await listarFacturasAliado(id, { page: 1, pageSize: 100, estado: 'todas' })
        const facturas = facturasRes.items.filter((f) => String(f.estado_factura).toLowerCase() !== 'anulada')

        const conCuotas = facturas.filter(
          (f) => Number(f.cuotas_total ?? f.cant_cuotas ?? 0) > 0 || String(f.estado_factura).toLowerCase() === 'financiada',
        )
        const grupos = await Promise.all(
          conCuotas.map((f) =>
            obtenerCuotasFactura(id, String(f.deuda_id ?? f.factura_id))
              .then((r) => r.items)
              .catch(() => [] as CuotaRecord[]),
          ),
        )
        if (!cancelled) setPlan({ key: id, facturas, cuotas: grupos.flat() })
      } catch {
        if (!cancelled) setPlan({ key: id, facturas: [], cuotas: [] })
      }
    }

    void load(allyId)
    return () => { cancelled = true }
    // `detail` cambia (nuevo objeto) tras registrar un pago: se recarga el plan
  }, [detail, allyId])

  if (!detail || !allyId) return { detail: null, isLoading: false }
  if (plan.key !== allyId) return { detail: null, isLoading: true }

  return { detail: { ...detail, facturas: plan.facturas, cuotas: plan.cuotas }, isLoading: false }
}
