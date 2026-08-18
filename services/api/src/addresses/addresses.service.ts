import { Injectable } from '@nestjs/common';
import { Address, Prisma } from '@prisma/client';
import {
  normalizarBusqueda,
  type AddressDto,
  type CreateAddressInput,
  type UpdateAddressInput,
} from '@foodvoice/shared';
import {
  direccionEnUso,
  direccionNecesitaNuevaPredeterminada,
  etiquetaDireccionYaExiste,
  noEncontrado,
} from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

/** Código de PostgreSQL para violación de restricción única. */
const VIOLACION_DE_UNICIDAD = 'P2002';

/**
 * Direcciones de entrega del cliente (HU-11, FR-012–FR-024).
 *
 * **Crear, reactivar, desactivar, eliminar y cambiar la predeterminada
 * bloquean primero la fila `User` del cliente** dentro de la transacción
 * (D-049): es lo que serializa dos altas o dos reactivaciones simultáneas del
 * mismo cliente, y lo que evita que "usar por primera vez" compita con
 * "eliminar por nunca usada". El índice único parcial de la migración es el
 * respaldo que PostgreSQL aplica si, por lo que sea, dos transacciones no se
 * serializaran.
 *
 * **Editar el texto o la etiqueta no toma el bloqueo**: no toca `isDefault`
 * ni `active`, así que no compite con ninguna de esas carreras; la unicidad
 * de la etiqueta la protege el índice único por sí solo (FR-016).
 */
@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  /** `GET /addresses` (FR-018). Todas, activas y desactivadas. */
  async listar(userId: string): Promise<{ items: AddressDto[] }> {
    const filas = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return { items: filas.map(aDto) };
  }

  /**
   * `POST /addresses` (FR-012, FR-015). Queda predeterminada automáticamente
   * si es la primera dirección activa del cliente.
   */
  async crear(userId: string, datos: CreateAddressInput): Promise<AddressDto> {
    try {
      const creada = await this.prisma.$transaction(async (tx) => {
        await bloquearUsuario(tx, userId);
        const hayActiva = (await tx.address.count({ where: { userId, active: true } })) > 0;

        return tx.address.create({
          data: {
            userId,
            label: datos.label,
            labelNormalized: normalizarBusqueda(datos.label),
            text: datos.text,
            isDefault: !hayActiva,
          },
        });
      });
      return aDto(creada);
    } catch (error) {
      throw traducirUnicidad(error);
    }
  }

  /**
   * `PATCH /addresses/:id` (FR-016). No toca `isDefault`, `active` ni
   * `usedInOrder`. Revalida unicidad de etiqueta igual que al crear.
   */
  async editar(userId: string, id: string, datos: UpdateAddressInput): Promise<AddressDto> {
    const actual = await this.prisma.address.findUnique({ where: { id } });
    if (!actual || actual.userId !== userId) throw noEncontrado();

    try {
      const editada = await this.prisma.address.update({
        where: { id },
        data: {
          label: datos.label,
          labelNormalized: normalizarBusqueda(datos.label),
          text: datos.text,
        },
      });
      return aDto(editada);
    } catch (error) {
      throw traducirUnicidad(error);
    }
  }

  /**
   * `PUT /addresses/:id/default` (FR-015, FR-024). Solo direcciones activas:
   * una desactivada no es un objetivo válido —la interfaz nunca ofrece esta
   * acción sobre una fila desactivada (FR-024)—, así que llegar aquí con una
   * significa una llamada directa a la API; se responde igual que un
   * identificador inexistente, sin revelar el estado (mismo criterio que
   * `noEncontrado()`). Ver checklist logica-negocio CHK019.
   */
  async cambiarPredeterminada(userId: string, id: string): Promise<AddressDto> {
    const actualizada = await this.prisma.$transaction(async (tx) => {
      await bloquearUsuario(tx, userId);
      const actual = await tx.address.findUnique({ where: { id } });
      if (!actual || actual.userId !== userId || !actual.active) throw noEncontrado();

      if (actual.isDefault) return actual;

      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
      return tx.address.update({ where: { id }, data: { isDefault: true } });
    });

    return aDto(actualizada);
  }

  /**
   * `PUT /addresses/:id/status` (FR-018, FR-020). Desactivar la
   * predeterminada mientras existen otras activas exige elegir primero una
   * nueva (FR-020); desactivar la última activa se permite y deja al cliente
   * sin predeterminada. Reactivar deja predeterminada solo si no existe
   * ninguna otra activa (FR-015).
   */
  async cambiarEstado(userId: string, id: string, active: boolean): Promise<AddressDto> {
    const actualizada = await this.prisma.$transaction(async (tx) => {
      await bloquearUsuario(tx, userId);
      const actual = await tx.address.findUnique({ where: { id } });
      if (!actual || actual.userId !== userId) throw noEncontrado();

      // Poner el valor que ya tiene es una petición sin efecto (mismo criterio
      // que `cambiarEstado` de E3).
      if (actual.active === active) return actual;

      if (!active) {
        if (actual.isDefault) {
          const otrasActivas = await tx.address.count({
            where: { userId, active: true, id: { not: id } },
          });
          if (otrasActivas > 0) throw direccionNecesitaNuevaPredeterminada();
        }
        return tx.address.update({
          where: { id },
          data: { active: false, isDefault: false },
        });
      }

      // Reactivar: predeterminada solo si no hay ninguna otra activa (FR-015).
      const hayActiva = (await tx.address.count({ where: { userId, active: true } })) > 0;
      return tx.address.update({
        where: { id },
        data: { active: true, isDefault: !hayActiva },
      });
    });

    return aDto(actualizada);
  }

  /** `DELETE /addresses/:id` (FR-019). Borrado físico, solo si nunca se usó. */
  async eliminar(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await bloquearUsuario(tx, userId);
      const actual = await tx.address.findUnique({ where: { id } });
      if (!actual || actual.userId !== userId) throw noEncontrado();
      if (actual.usedInOrder) throw direccionEnUso();

      await tx.address.delete({ where: { id } });
    });
  }
}

/**
 * Bloquea la fila del usuario dentro de la transacción (D-049). Serializa
 * las operaciones concurrentes de un mismo cliente sobre sus direcciones sin
 * afectar a las de otro.
 *
 * Un `UPDATE` toma el mismo bloqueo de fila que `SELECT ... FOR UPDATE` en
 * PostgreSQL. Se usa el cliente tipado de Prisma en lugar de una consulta
 * cruda por simplicidad; no hay ninguna razón funcional para preferir la raw
 * query aquí.
 */
async function bloquearUsuario(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.user.update({ where: { id: userId }, data: { updatedAt: new Date() } });
}

function aDto(direccion: Address): AddressDto {
  return {
    id: direccion.id,
    label: direccion.label,
    text: direccion.text,
    isDefault: direccion.isDefault,
    active: direccion.active,
    createdAt: direccion.createdAt.toISOString(),
  };
}

function traducirUnicidad(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === VIOLACION_DE_UNICIDAD
  ) {
    return etiquetaDireccionYaExiste();
  }
  return error;
}
