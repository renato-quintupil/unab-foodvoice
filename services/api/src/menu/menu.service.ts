import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { MenuQuery, MenuResponse, ProductDto } from '@foodvoice/shared';
import { productoNoEncontrado } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { calcularCortes, filtroDeTramo } from '../products/price-tier';
import { productoADto } from '../products/products.service';

/**
 * Consulta del menú, para los cuatro roles autenticados (T062, T063, T064).
 *
 * **`active: true` no es un filtro más**: es la condición que RN-018 impone a
 * toda consulta de este servicio. Va escrita en cada método, y no delegada a
 * quien llame, porque la regla es «un producto no ofrecible no sale por ninguna
 * vía» y la vía que E6 añadirá pasará por aquí: si la exclusión viviera en el
 * controlador o en la pantalla, bastaría una entrada nueva para saltársela.
 *
 * Los agotados **sí** salen (RN-003, FR-029): agotado es activo con
 * `available = false`, y el cliente debe seguir viéndolos, marcados.
 */
@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `GET /menu/products` (FR-028, FR-031, FR-032, FR-035).
   *
   * **Sin paginación** (D-029): el menú se recorre entero en una pantalla
   * desplazable, y paginarlo obligaría al cliente a saber en qué página está lo
   * que busca —justo lo que los filtros existen para evitar—.
   *
   * Los tres filtros son **conjuntivos**: se acumulan en un solo `where`, de modo
   * que la consulta devuelve lo que cumple todas las condiciones o no devuelve
   * nada. En ningún punto hay una rama que sustituya el resultado vacío por
   * productos que cumplan solo parte (FR-035, SC-018): la sustitución no está
   * escrita, que es la única forma de garantizar que no ocurra.
   *
   * Los cortes se calculan sobre el **catálogo activo completo**, dentro de la
   * misma transacción y con independencia de los filtros: si dependieran del
   * resultado, un filtro estrecho movería los tramos y el mismo producto
   * aparecería en tramos distintos según qué más se estuviera mirando.
   */
  async consultar(consulta: MenuQuery): Promise<MenuResponse> {
    return this.prisma.$transaction(async (tx) => {
      const cortes = await calcularCortes(tx);

      const where: Prisma.ProductWhereInput = {
        active: true,
        ...(consulta.foodTypeCategoryId
          ? { foodTypeCategoryId: consulta.foodTypeCategoryId }
          : {}),
        ...(consulta.healthProfileCategoryId
          ? { healthProfileCategoryId: consulta.healthProfileCategoryId }
          : {}),
        // El tramo se traduce a una condición **sobre el precio**, aplicada en la
        // consulta: filtrar en memoria lo ya traído daría el mismo resultado hoy
        // y dejaría de darlo en cuanto el catálogo crezca.
        ...filtroDeTramo(consulta.priceTier, cortes),
      };

      const filas = await tx.product.findMany({
        where,
        include: { foodTypeCategory: true, healthProfileCategory: true },
        // Orden estable, igual que en la administración: sin el desempate por
        // `id`, dos productos creados en el mismo instante podrían intercambiarse
        // entre consultas.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });

      return { items: filas.map((fila) => productoADto(fila, cortes)), priceTiers: cortes };
    });
  }

  /**
   * `GET /menu/products/:id` (FR-034, D-032).
   *
   * Responde `404` cuando el producto **no existe o no está activo**, con
   * exactamente el mismo cuerpo en ambos casos. La condición va en el `where` y
   * no en un `if` posterior: así no existe ninguna ruta de código que llegue a
   * tener en la mano un producto retirado y decida qué hacer con él.
   */
  async ficha(id: string): Promise<ProductDto> {
    return this.prisma.$transaction(async (tx) => {
      const producto = await tx.product.findFirst({
        where: { id, active: true },
        include: { foodTypeCategory: true, healthProfileCategory: true },
      });
      if (!producto) throw productoNoEncontrado();

      return productoADto(producto, await calcularCortes(tx));
    });
  }
}
