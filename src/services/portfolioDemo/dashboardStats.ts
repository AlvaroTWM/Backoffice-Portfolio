import type { DashboardStats } from '../loyaltyBackend'

export function getPortfolioDashboardStats(): DashboardStats {
  return {
    aliadosActivos: 7,
    aliadosConDeuda: 6,
    deudaTotalPendiente: 24_500_000,
    totalCobrado: 5_900_000,
    aprobacionesPendientes: 2,
    deudasSinFactura: 1,
    filtros: { period: '12m', servicio: 'all' },
    serviciosDisponibles: ['upys', 'Marketing', 'Cupones', 'Reintegros'],
    deudaVencida: 3_200_000,
    tasaMorosidad: 13.1,
    concentracionTop10: 78,
    porcentajeResto: 22,
    dso: 42,
    proyeccion: { d30: 7_100_000, d60: 11_400_000, d90: 14_800_000, d120: 18_200_000 },
    historicoRecobro: [
      { mes: 'Oct', pagado: 2_100_000, vencido: 800_000, vigente: 4_200_000 },
      { mes: 'Nov', pagado: 2_400_000, vencido: 950_000, vigente: 3_900_000 },
      { mes: 'Dic', pagado: 1_800_000, vencido: 1_100_000, vigente: 4_500_000 },
      { mes: 'Ene', pagado: 2_600_000, vencido: 700_000, vigente: 4_000_000 },
      { mes: 'Feb', pagado: 2_900_000, vencido: 600_000, vigente: 3_700_000 },
      { mes: 'Mar', pagado: 3_100_000, vencido: 1_200_000, vigente: 4_100_000 },
    ],
    evolucion: [
      { mes: 'Oct', total: 18_000_000 },
      { mes: 'Nov', total: 19_200_000 },
      { mes: 'Dic', total: 20_100_000 },
      { mes: 'Ene', total: 21_500_000 },
      { mes: 'Feb', total: 22_800_000 },
      { mes: 'Mar', total: 24_500_000 },
    ],
    compromisosHistorico: [
      { mes: 'Ene', pagadoATiempo: 1_200_000, vencido: 400_000, pendiente: 900_000 },
      { mes: 'Feb', pagadoATiempo: 1_400_000, vencido: 350_000, pendiente: 1_100_000 },
      { mes: 'Mar', pagadoATiempo: 1_600_000, vencido: 500_000, pendiente: 1_300_000 },
    ],
    aging: { alDia: 12_000_000, d1_30: 5_500_000, d31_60: 3_800_000, d61_90: 2_200_000, mas90: 1_000_000 },
    mixServicio: [
      { servicio: 'Marketing', monto: 9_800_000 },
      { servicio: 'upys', monto: 7_200_000 },
      { servicio: 'Cupones', monto: 4_500_000 },
      { servicio: 'Reintegros', monto: 3_000_000 },
    ],
    pareto: [
      { cod_aliado: 'A-005', aliado: 'Pizza Hut', deuda: 9_000_000, acumulado: 37 },
      { cod_aliado: 'A-001', aliado: 'Maxifarma Encarnacion', deuda: 3_000_000, acumulado: 49 },
      { cod_aliado: 'A-004', aliado: 'Burguer King', deuda: 3_000_000, acumulado: 61 },
      { cod_aliado: 'A-006', aliado: 'Don Vito', deuda: 3_500_000, acumulado: 75 },
      { cod_aliado: 'A-007', aliado: 'Lomy', deuda: 2_000_000, acumulado: 83 },
    ],
    compromisosIncumplidos: [
      { cod_aliado: 'A-002', aliado_nombre: 'Bacon', monto_incumplido: 900_000, cantidad_compromisos: 1 },
    ],
    deudaPorEjecutiva: [
      { ejecutiva_nombre: 'Valeria', deuda: 8_500_000 },
      { ejecutiva_nombre: 'Constanza', deuda: 6_200_000 },
      { ejecutiva_nombre: 'Sin asignar', deuda: 9_800_000 },
    ],
    cuentasCriticas: [
      {
        cod_aliado: 'A-002',
        aliado_nombre: 'Bacon',
        deuda_vencida: 900_000,
        dias_max: 12,
        ultima_fecha_pago: null,
      },
    ],
    proximosVencimientos: [
      {
        cuota_id: 'C-2002',
        cod_aliado: 'A-001',
        aliado_nombre: 'Maxifarma Encarnacion',
        monto: 1_500_000,
        fecha_vencimiento: '2026-06-01',
        dias_restantes: 18,
      },
    ],
  }
}
