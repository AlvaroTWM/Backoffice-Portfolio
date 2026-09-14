export function normalizeEstadoAliado(raw: string): 'Activo' | 'Inactivo' {
  const v = raw.trim().toLowerCase()
  if (v === 'activo' || v === 'active' || v === 'a' || v === '1') return 'Activo'
  if (v === 'inactivo' || v === 'inactive' || v === 'i' || v === '0') return 'Inactivo'
  throw new Error(`Estado de aliado inválido: "${raw}". Usá Activo o Inactivo.`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ejecutarModificarAliado(
  tx: any,
  datos: Record<string, unknown>,
  aprobadorId: string,
): Promise<void> {
  const aliadoId = datos['aliado_id'] as string | undefined
  const campo = datos['campo_modificar'] as string | undefined
  const valorNuevo = datos['valor_nuevo'] as string | undefined

  if (!aliadoId) {
    throw new Error('datos_solicitud incompletos para MODIFICAR_ALIADO: falta aliado_id.')
  }
  if (!campo || campo === 'otro') {
    throw new Error('Este tipo de modificación requiere gestión manual (campo "otro").')
  }
  if (!valorNuevo?.trim()) {
    throw new Error('datos_solicitud incompletos para MODIFICAR_ALIADO: falta valor_nuevo.')
  }

  const aliado = await tx.directorioAliado.findUnique({ where: { cod_aliado: aliadoId } })
  if (!aliado) {
    throw new Error(`Aliado no encontrado: ${aliadoId}`)
  }

  switch (campo) {
    case 'nombre':
      await tx.directorioAliado.update({
        where: { cod_aliado: aliadoId },
        data:  { brand: valorNuevo.trim(), aprobador_id: aprobadorId || null },
      })
      break

    case 'estado': {
      const estado = normalizeEstadoAliado(valorNuevo)
      await tx.directorioAliado.update({
        where: { cod_aliado: aliadoId },
        data:  { estado_actual: estado, aprobador_id: aprobadorId || null },
      })
      break
    }

    case 'codigo_persona': {
      const n = parseInt(valorNuevo.trim(), 10)
      if (!Number.isFinite(n)) {
        throw new Error('Código de persona inválido.')
      }
      await tx.directorioAliado.update({
        where: { cod_aliado: aliadoId },
        data:  { cod_persona: n, aprobador_id: aprobadorId || null },
      })
      break
    }

    case 'ruc': {
      const nuevoRuc = valorNuevo.trim()
      const principal = await tx.aliadorRuc.findFirst({
        where: { cod_aliado: aliadoId, principal: true },
      })

      await tx.aliadorRuc.upsert({
        where:  { cod_aliado_ruc: { cod_aliado: aliadoId, ruc: nuevoRuc } },
        update: { principal: true },
        create: { cod_aliado: aliadoId, ruc: nuevoRuc, principal: true },
      })

      if (principal && principal.ruc !== nuevoRuc) {
        await tx.aliadorRuc.update({
          where: { ruc_id: principal.ruc_id },
          data:  { principal: false },
        })
      }
      break
    }

    default:
      throw new Error(`Campo no soportado para modificación automática: ${campo}`)
  }
}
