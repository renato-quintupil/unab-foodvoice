import { Injectable } from '@nestjs/common';
import { Category, Dimension, Prisma } from '@prisma/client';
import {
  normalizarBusqueda,
  type CategoryDto,
  type CreateCategoryInput,
  type ListCategoriesQuery,
  type UpdateCategoryInput,
} from '@foodvoice/shared';
import { categoriaEnUso, categoriaYaExiste, noEncontrado } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

/** Código de PostgreSQL para violación de restricción única. */
const VIOLACION_DE_UNICIDAD = 'P2002';

/**
 * Administración de la clasificación (HU-14).
 *
 * Aquí viven **exactamente las reglas que exigen consultar el estado del
 * sistema**: la unicidad del nombre dentro de su dimensión, la existencia del
 * recurso y el conteo de productos que bloquean una desactivación. Todo lo que
 * puede decidirse mirando solo la petición lo validaron ya los esquemas
 * compartidos (D-005).
 *
 * **No existe ningún método que borre.** FR-009 lo exige «en ninguna pantalla ni
 * por ningún punto de entrada», y la forma más directa de cumplirlo es que la
 * operación no esté escrita.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `GET /business/categories` (FR-010).
   *
   * **Sin filtro de estado devuelve activas y desactivadas**, al contrario que
   * el listado de productos: FR-010 exige que las desactivadas sigan siendo
   * visibles en la administración, y una categoría desactivada no estorba una
   * vista de decenas de filas como sí lo hace una baja en un catálogo paginado.
   */
  async listar(consulta: ListCategoriesQuery): Promise<{ items: CategoryDto[] }> {
    const where: Prisma.CategoryWhereInput = {};
    if (consulta.dimension) where.dimension = consulta.dimension;
    if (consulta.active !== undefined) where.active = consulta.active;

    const filas = await this.prisma.category.findMany({
      where,
      // Por dimensión y luego por nombre: agrupa la vista como la spec pide y
      // hace que dos consultas iguales devuelvan el mismo orden.
      orderBy: [{ dimension: 'asc' }, { name: 'asc' }],
    });

    return { items: filas.map(aDto) };
  }

  /** `POST /business/categories` (FR-002, FR-003, FR-004). */
  async crear(datos: CreateCategoryInput): Promise<CategoryDto> {
    try {
      const creada = await this.prisma.category.create({
        data: {
          dimension: datos.dimension,
          name: datos.name,
          nameNormalized: normalizarBusqueda(datos.name),
          description: datos.description,
          // Queda **activa desde su creación** y disponible de inmediato, sin
          // ningún paso adicional de publicación (FR-002).
          active: true,
        },
      });
      return aDto(creada);
    } catch (error) {
      // La unicidad la garantiza el **índice**, no una consulta previa: entre
      // leer y escribir hay una ventana que dos peticiones simultáneas
      // aprovecharían (D-021, SC-027). Traducir la violación es obligatorio:
      // sin ello, un doble clic llegaría al negocio como un `500`.
      throw traducirUnicidad(error);
    }
  }

  /**
   * `PATCH /business/categories/:id` (FR-006).
   *
   * **La dimensión no se puede cambiar**, y no porque este método la ignore: el
   * esquema compartido no la incluye, de modo que un campo `dimension` en el
   * cuerpo se descarta antes de llegar aquí.
   *
   * Una categoría **desactivada sí se puede editar** (CHK037): sigue siendo
   * visible en la administración y su contenido debe poder corregirse mientras
   * está fuera de uso.
   */
  async editar(id: string, datos: UpdateCategoryInput): Promise<CategoryDto> {
    const existe = await this.prisma.category.findUnique({ where: { id } });
    if (!existe) throw noEncontrado();

    try {
      const actualizada = await this.prisma.category.update({
        where: { id },
        data: {
          name: datos.name,
          nameNormalized: normalizarBusqueda(datos.name),
          description: datos.description,
        },
      });
      return aDto(actualizada);
    } catch (error) {
      throw traducirUnicidad(error);
    }
  }

  /**
   * `PUT /business/categories/:id/status` (FR-007, FR-008, D-027).
   *
   * Al **desactivar**, cuenta los productos activos que dependen de esta
   * categoría **dentro de la misma transacción** que aplica el cambio. Contar
   * fuera permitiría dar de alta un producto entre el conteo y la escritura,
   * dejando una categoría desactivada de la que depende un producto activo —el
   * estado que RN-011 y FR-011 existen para evitar—. Si el conteo es mayor que
   * cero, la transacción se deshace y la respuesta incluye el número.
   *
   * Al **reactivar** no hay nada que comprobar: reactivar nunca puede producir
   * un estado inválido. Lo que sí puede es una reactivación de **producto**, y
   * de eso se encarga FR-021.
   *
   * Poner el valor que ya tiene es una petición **sin efecto**, no un error: es
   * lo que FR-026 exige para que un doble envío no rompa nada.
   */
  async cambiarEstado(id: string, active: boolean): Promise<CategoryDto> {
    const actualizada = await this.prisma.$transaction(async (tx) => {
      const actual = await tx.category.findUnique({ where: { id } });
      if (!actual) throw noEncontrado();

      if (!active) {
        const bloqueadores = await contarBloqueadores(tx, actual);
        if (bloqueadores > 0) throw categoriaEnUso(bloqueadores);
      }

      if (actual.active === active) return actual;

      return tx.category.update({ where: { id }, data: { active } });
    });

    return aDto(actualizada);
  }
}

/**
 * Cuenta los productos **activos** que tienen esta categoría en **su propia
 * dimensión** (FR-007, RN-015).
 *
 * Cuenta también los **agotados**: un producto agotado sigue siendo activo, y
 * desactivar su categoría lo dejaría fuera de los filtros del cliente sin que
 * nadie lo hubiera dado de baja.
 *
 * Se consulta por la columna que corresponde a la dimensión de la categoría, y
 * no por las dos: una categoría de tipo de comida solo puede estar referenciada
 * desde `food_type_category_id` en un producto bien formado, y buscar en ambas
 * columnas contaría los productos mal clasificados que D-024 declara
 * irrepresentables por la vía de la API.
 */
async function contarBloqueadores(
  tx: Prisma.TransactionClient,
  categoria: Category,
): Promise<number> {
  const porDimension =
    categoria.dimension === Dimension.TIPO_COMIDA
      ? { foodTypeCategoryId: categoria.id }
      : { healthProfileCategoryId: categoria.id };

  return tx.product.count({ where: { ...porDimension, active: true } });
}

/**
 * La forma en que una categoría cruza la frontera de la API.
 *
 * No expone `nameNormalized` —detalle de almacenamiento— ni `updatedAt`, con el
 * mismo criterio que `aDto` de usuarios en E1.
 */
function aDto(categoria: Category): CategoryDto {
  return {
    id: categoria.id,
    dimension: categoria.dimension,
    name: categoria.name,
    description: categoria.description,
    active: categoria.active,
    createdAt: categoria.createdAt.toISOString(),
  };
}

function traducirUnicidad(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === VIOLACION_DE_UNICIDAD
  ) {
    // La respuesta no incluye el nombre de la restricción, el de la columna ni
    // ningún fragmento del error del motor.
    return categoriaYaExiste();
  }
  return error;
}
