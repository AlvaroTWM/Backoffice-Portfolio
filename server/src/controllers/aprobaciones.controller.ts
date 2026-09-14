import type { Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'
import type { JwtPayload } from '../middlewares/authJwt.middleware.js'
import {
  ejecutarCrearPlan,
  ejecutarRefinanciarDeuda,
  type CuotaPlanInput,
} from '../services/planPagosService.js'
import { anularPagoCuotaInTx } from '../services/pagoApplication.js'
import { ejecutarModificarAliado } from '../services/modificarAliadoService.js'

// ─── Jerarquía de roles ───────────────────────────────────────────────────────
//  alianzas     →  aprobado por  operaciones
//  operaciones  →  aprobado por  gerencia
//  gerencia     →  aprobado por  admin
//  admin        →  no requiere aprobación (ejecuta directo)

const APPROVER_FOR: Record<string, string | null> = {
  alianzas:    'operaciones',
  operaciones: 'gerencia',
  gerencia:    'admin',
  admin:       null,
}

function getApproverRole(requesterRole: string): string | null {
  return APPROVER_FOR[requesterRole.toLowerCase()] ?? null
}

function resolveRolAprobador(
  rolSolicitante: string,
  rolAprobadorDefault: string | null,
  accion: string,
): string | null {
  if (accion === 'REFINANCIAR_DEUDA') {
    return ['admin', 'gerencia'].includes(rolSolicitante) ? null : 'gerencia'
  }
  return rolAprobadorDefault
}

// POST /api/aprobaciones
export async function crearAprobacion(request: Request, response: Response) {
  try {
    const currentUser = (request as Request & { user?: JwtPayload }).user
    if (!currentUser?.userId) {
      response.status(401).json({ message: 'No autenticado.' })
      return
    }

    const rolSolicitante = currentUser.rol?.toLowerCase() ?? ''
    const rolAprobador   = getApproverRole(rolSolicitante)

    const { tabla, registro_id, accion, datos_solicitud, observacion, asignado_a_user_id } = request.body as {
      tabla?: string
      registro_id?: string
      accion?: string
      datos_solicitud?: Record<string, unknown>
      observacion?: string
      asignado_a_user_id?: string
    }

    if (!tabla || !registro_id || !accion) {
      response.status(400).json({ message: 'tabla, registro_id y accion son requeridos.' })
      return
    }

    // Limpiar undefined antes de pasarle a Prisma (JSON no admite undefined)
    // JSON.parse devuelve any, compatible con el tipo Json de Prisma
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rolAprobadorFinal = resolveRolAprobador(rolSolicitante, rolAprobador, accion)

    const cleanDatos = JSON.parse(JSON.stringify({
      ...(datos_solicitud ?? {}),
      rol_solicitante:   rolSolicitante,
      rol_aprobador_req: rolAprobadorFinal,
      ...(asignado_a_user_id ? { asignado_a_user_id } : {}),
    }))

    // Admin y gerencia ejecutan directo sin quedar pendiente.
    if (rolAprobadorFinal === null) {
      const aprobacion = await prisma.$transaction(async (tx) => {
        const creada = await tx.aprobacion.create({
          data: {
            tabla,
            registro_id,
            accion,
            datos_solicitud: cleanDatos,
            observacion: observacion?.trim() || null,
            user_id: currentUser.userId,
            estado: 'Aprobado',
            aprobador_id: currentUser.userId,
            fecha_resolucion: new Date(),
          },
        })
        await ejecutarAccionAprobada(accion, cleanDatos as Record<string, unknown>, currentUser.userId, tx)
        return creada
      })

      response.status(201).json({
        aprobacion_id: aprobacion.aprobacion_id,
        estado: aprobacion.estado,
        auto_ejecutada: true,
      })
      return
    }

    const aprobacion = await prisma.aprobacion.create({
      data: {
        tabla,
        registro_id,
        accion,
        datos_solicitud: cleanDatos,
        observacion: observacion?.trim() || null,
        user_id: currentUser.userId,
      },
    })

    response.status(201).json({ aprobacion_id: aprobacion.aprobacion_id, estado: aprobacion.estado })
  } catch (err) {
    console.error('[crearAprobacion] ERROR COMPLETO:', err)
    console.error('[crearAprobacion] Stack:', err instanceof Error ? err.stack : String(err))
    response.status(500).json({ 
      message: 'Error al crear la solicitud de aprobación.',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}

// GET /api/aprobaciones
// Lógica de visibilidad por rol:
//   admin     → ve todas las solicitudes
//   gerencia  → ve todas las solicitudes (mismos permisos que admin, por ahora)
//   operaciones  → ve lo que puede aprobar (submissions de alianzas) + sus propias solicitudes
//   alianzas → solo ve sus propias solicitudes (no pueden aprobar nada)
export async function getAprobaciones(request: Request, response: Response) {
  try {
    const currentUser = (request as Request & { user?: JwtPayload }).user
    const rolActual   = currentUser?.rol?.toLowerCase() ?? ''
    const userId      = currentUser?.userId ?? ''
    const { estado }  = request.query

    const estadoFilter = estado && typeof estado === 'string' ? { estado } : {}

    // alianzas solo ven las suyas (tras swap de responsabilidades)
    let whereClause: Record<string, unknown>
    if (rolActual === 'admin' || rolActual === 'gerencia') {
      // admin y gerencia ven todo
      whereClause = { ...estadoFilter }
    } else if (rolActual === 'alianzas') {
      // solo sus propias solicitudes
      whereClause = { ...estadoFilter, user_id: userId }
    } else {
      // gerencia / operaciones: ven lo que pueden aprobar + las suyas propias
      whereClause = {
        ...estadoFilter,
        OR: [
          { datos_solicitud: { path: ['rol_aprobador_req'], equals: rolActual } },
          { user_id: userId },
        ],
      }
    }

    const rows = await prisma.aprobacion.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: whereClause as any,
      include: {
        solicitante: { select: { nombre: true, email: true, rol: true } },
        aprobador:   { select: { nombre: true, email: true } },
      },
      orderBy: { fecha_solicitud: 'desc' },
    })

    const items = rows.map((r) => ({
      aprobacion_id:      r.aprobacion_id,
      accion:             r.accion,
      tabla:              r.tabla,
      registro_id:        r.registro_id,
      observacion:        r.observacion ?? '',
      estado:             r.estado,
      fecha_solicitud:    r.fecha_solicitud.toISOString(),
      fecha_resolucion:   r.fecha_resolucion?.toISOString() ?? null,
      solicitante_nombre: r.solicitante.nombre,
      solicitante_email:  r.solicitante.email,
      solicitante_rol:    r.solicitante.rol,
      aprobador_nombre:   r.aprobador?.nombre ?? null,
      rol_aprobador_req:  (r.datos_solicitud as Record<string, unknown>)?.rol_aprobador_req ?? null,
      datos_solicitud:    r.datos_solicitud,
    }))

    response.status(200).json({ items })
  } catch (err) {
    console.error('[getAprobaciones] ERROR COMPLETO:', err)
    console.error('[getAprobaciones] Stack:', err instanceof Error ? err.stack : String(err))
    response.status(500).json({ 
      message: 'Error al obtener aprobaciones.',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}

// ─── Ejecutar acción una vez aprobada ────────────────────────────────────────
async function ejecutarAccionAprobada(
  accion: string,
  datos: Record<string, unknown>,
  aprobadorId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any = prisma,
): Promise<void> {
  switch (accion) {

    // ── CREAR_PLAN: primer plan sobre saldo pendiente (sin cuotas activas) ───
    case 'CREAR_PLAN': {
      const deudaId = datos['deuda_id'] as string | undefined
      const rawCuotas = datos['cuotas'] as CuotaPlanInput[] | undefined
      const motivo = (datos['motivo'] ?? datos['observacion']) as string | undefined

      if (!deudaId || !Array.isArray(rawCuotas) || rawCuotas.length === 0) {
        throw new Error('datos_solicitud incompletos para CREAR_PLAN: falta deuda_id o cuotas.')
      }

      await ejecutarCrearPlan(tx, deudaId, rawCuotas, aprobadorId, motivo)
      break
    }

    // ── REFINANCIAR_DEUDA: reprogramar cuotas seleccionadas ──────────────────
    case 'REFINANCIAR_DEUDA': {
      const deudaId = datos['deuda_id'] as string | undefined
      const cuotaIds = datos['cuota_ids'] as string[] | undefined
      const rawCuotas = datos['cuotas'] as CuotaPlanInput[] | undefined
      const motivo = (datos['motivo'] ?? datos['observacion']) as string | undefined

      if (!deudaId || !Array.isArray(rawCuotas) || rawCuotas.length === 0) {
        throw new Error('datos_solicitud incompletos para REFINANCIAR_DEUDA: falta deuda_id o cuotas.')
      }

      await ejecutarRefinanciarDeuda(tx, deudaId, cuotaIds ?? [], rawCuotas, aprobadorId, motivo)
      break
    }

    // ── BAJA_ALIADO: marcar aliado como Inactivo ─────────────────────────────
    case 'BAJA_ALIADO': {
      const aliadoId = datos['aliado_id'] as string | undefined
      if (!aliadoId) throw new Error('datos_solicitud incompletos para BAJA_ALIADO: falta aliado_id.')
      await tx.directorioAliado.update({
        where: { cod_aliado: aliadoId },
        data:  { estado_actual: 'Inactivo', aprobador_id: aprobadorId || null },
      })
      break
    }

    // ── ANULAR_DEUDA: marcar factura como Anulada ────────────────────────────
    case 'ANULAR_DEUDA': {
      const deudaId = (datos['deuda_id'] ?? datos['factura_id']) as string | undefined
      if (!deudaId) throw new Error('datos_solicitud incompletos para ANULAR_DEUDA: falta deuda_id.')
      await tx.facturacion.update({
        where: { deuda_id: deudaId },
        data:  { estado_deuda: 'Anulada' },
      })
      break
    }

    // ── ANULAR_PAGO: revertir pagos aplicados a una cuota ───────────────────
    case 'ANULAR_PAGO': {
      const cuotaId = datos['cuota_id'] as string | undefined
      if (!cuotaId) throw new Error('datos_solicitud incompletos para ANULAR_PAGO: falta cuota_id.')
      await anularPagoCuotaInTx(tx, cuotaId)
      break
    }

    // ── CREAR_COMPROMISO: registrar un compromiso de pago ───────────────────
    case 'CREAR_COMPROMISO': {
      const cuotaId = datos['cuota_id'] as string | undefined
      const fecha   = datos['fecha_compromiso'] as string | undefined
      const monto   = datos['monto_compromiso'] as number | undefined

      if (!cuotaId || !fecha || monto === undefined) {
        throw new Error('datos_solicitud incompletos para CREAR_COMPROMISO.')
      }

      await tx.compromiso.create({
        data: {
          compromiso_id:     `COMP-${randomUUID().slice(0, 8)}`,
          cuota_id:          cuotaId,
          fecha_promesa:     new Date(fecha),
          monto_promesa:     BigInt(Math.round(Number(monto))),
          estado_compromiso: 'Pendiente',
          observacion:       (datos['observacion'] as string | undefined) ?? null,
          aprobador_id:      aprobadorId || null,
        },
      })
      break
    }

    case 'MODIFICAR_ALIADO':
      await ejecutarModificarAliado(tx, datos, aprobadorId)
      break

    case 'MODIFICAR_COMPROMISO':
      break

    default:
      console.warn(`[ejecutarAccionAprobada] Acción no manejada: ${accion}`)
  }
}

// PATCH /api/aprobaciones/:id/resolver
export async function resolverAprobacion(request: Request, response: Response) {
  try {
    const { id }     = request.params
    const { estado, observacion } = request.body as { estado?: string; observacion?: string }
    const currentUser = (request as Request & { user?: JwtPayload }).user
    const rolActual   = currentUser?.rol?.toLowerCase() ?? ''

    if (!estado || !['Aprobado', 'Rechazado'].includes(estado)) {
      response.status(400).json({ message: 'estado debe ser "Aprobado" o "Rechazado".' })
      return
    }

    const aprobacion = await prisma.aprobacion.findUnique({ where: { aprobacion_id: id as string } })

    if (!aprobacion) {
      response.status(404).json({ message: 'Aprobación no encontrada.' })
      return
    }

    if (aprobacion.estado !== 'Pendiente') {
      response.status(409).json({ message: 'Esta solicitud ya fue resuelta.' })
      return
    }

    // Verificar que el rol del usuario sea el requerido para aprobar esta solicitud
    const rolRequerido = (aprobacion.datos_solicitud as Record<string, unknown>)?.rol_aprobador_req as string | undefined
    if (rolRequerido && rolActual !== 'admin' && rolActual !== 'gerencia' && rolActual !== rolRequerido) {
      response.status(403).json({
        message: `No tenés permisos para resolver esta solicitud. Requiere rol: ${rolRequerido}.`,
      })
      return
    }

    // Envolver todo en una transacción: si ejecutarAccionAprobada falla,
    // el update de estado también se revierte y la solicitud queda en Pendiente
    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.aprobacion.update({
        where: { aprobacion_id: id as string },
        data: {
          estado,
          observacion:      observacion?.trim() || aprobacion.observacion,
          aprobador_id:     currentUser?.userId ?? null,
          fecha_resolucion: new Date(),
        },
      })

      if (estado === 'Aprobado') {
        const datos = (aprobacion.datos_solicitud ?? {}) as Record<string, unknown>
        await ejecutarAccionAprobada(aprobacion.accion, datos, currentUser?.userId ?? '', tx)
      }

      return upd
    })

    response.status(200).json({
      aprobacion_id:    updated.aprobacion_id,
      estado:           updated.estado,
      fecha_resolucion: updated.fecha_resolucion?.toISOString(),
      aprobador_nombre: null,
    })
  } catch (err) {
    console.error('[resolverAprobacion]', err)
    response.status(500).json({ message: 'Error al resolver aprobación.' })
  }
}
