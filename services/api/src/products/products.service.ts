import { Injectable } from '@nestjs/common';
import { Category, Dimension, Prisma, Product } from '@prisma/client';
import {
  ETIQUETA_DIMENSION,
  PAGE_SIZE,
  ProductStatus,
  derivarEstadoProducto,
  escaparLike,
  normalizarBusqueda,
  type CreateProductInput,
  type ListProductsQuery,
  type Paginated,
  type ProductDto,
  type UpdateProductInput,
} from '@foodvoice/shared';
import { categoriaInactiva, noEncontrado, productoYaExiste } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { calcularCortes, tramoDe, type Cortes } from './price-tier';

/** Código de PostgreSQL para violación de restricción única. */
const VIOLACION_DE_UNICIDAD = 'P2002';

/** Producto con sus dos categorías cargadas, que es lo que `ProductDto` necesita. */
type ProductoConCategorias = Product & {
  foodTypeCategory: Category;
  healthProfileCategory: Category;
};

const CON_CATEGORIAS = {
  foodTypeCategory: true,
  healthProfileCategory: true,
} as const;

/**
 * Administración del catálogo de productos (HU-02).
 *
 * Tres operaciones abren transacción, y las tres por la misma razón: **comprobar
 * fuera y escribir dentro dejaría una ventana** en la que una categoría se
 * desactiva entre la comprobación y la escritura, produciendo un producto activo
 * con categoría inactiva —el estado que RN-011 prohíbe y que los filtros del
 * cliente harían invisible—.
 *
 * La unicidad del nombre **no** se resuelve con transacciones sino con el índice
 * único: el servicio intenta escribir y traduce la violación al error de negocio.
 * Es lo que hace que un doble envío simultáneo produzca un solo registro sin
 * depender de que las dos peticiones se serialicen (SC-027).
 *
 * **No existe ningún método que borre** (FR-009, RN-004).
 */
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `GET /business/products` (FR-023, D-022).
   *
   * **Sin filtro de estado muestra solo los activos** —disponibles y agotados—:
   * el trabajo cotidiano del negocio es sobre el menú vigente y una baja es la
   * excepción (supuesto 20). Que estén ocultos por defecto no los hace
   * inaccesibles: el filtro los recupera en un clic.
   *
   * El orden es fijo, `created_at DESC, id DESC`. El desempate por `id` es
   * obligatorio: sin él, dos altas con la misma marca de tiempo pueden
   * intercambiarse entre consultas y hacer que un producto aparezca en dos
   * páginas o en ninguna (FR-023, supuesto 14).
   */
  async listar(consulta: ListProductsQuery): Promise<Paginated<ProductDto>> {
    const where = this.filtrosDelListado(consulta);

    const [total, filas, cortes] = await this.prisma.$transaction(async (tx) => {
      return Promise.all([
        tx.product.count({ where }),
        tx.product.findMany({
          where,
          include: CON_CATEGORIAS,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (consulta.page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        // Los cortes se calculan sobre el catálogo activo completo, nunca sobre
        // la página devuelta (FR-032).
        calcularCortes(tx),
      ]);
    });

    return {
      items: filas.map((fila) => aDto(fila, cortes)),
      total,
      page: consulta.page,
      pageSize: PAGE_SIZE,
      // Pedir una página fuera de rango devuelve `items: []` con los valores
      // reales, igual que el padrón de E1: ocurre cuando un filtro se estrecha
      // mientras se navega, y no es un error de validación.
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  /** `POST /business/products` (FR-012, FR-014, RN-007). */
  async crear(datos: CreateProductInput): Promise<ProductDto> {
    try {
      const creado = await this.prisma.$transaction(async (tx) => {
        await this.exigirCategoriasUsables(tx, datos);

        const producto = await tx.product.create({
          data: {
            name: datos.name,
            nameNormalized: normalizarBusqueda(datos.name),
            description: datos.description,
            ingredients: datos.ingredients,
            price: datos.price,
            foodTypeCategoryId: datos.foodTypeCategoryId,
            healthProfileCategoryId: datos.healthProfileCategoryId,
            // Queda **activo y disponible** sin ninguna acción adicional
            // (RN-007): nadie tiene que «publicarlo» ni marcarlo disponible.
            active: true,
            available: true,
          },
          include: CON_CATEGORIAS,
        });

        return { producto, cortes: await calcularCortes(tx) };
      });

      return aDto(creado.producto, creado.cortes);
    } catch (error) {
      throw traducirUnicidad(error);
    }
  }

  /**
   * `PATCH /business/products/:id` (FR-018, FR-022).
   *
   * Reclasificar **es** editar: cambiar las dos claves de categoría no es una
   * acción aparte (FR-022). Los cambios rigen de inmediato para las consultas
   * siguientes y **no tocan ningún dato histórico** (FR-024, RN-010): un cambio
   * de precio rige hacia adelante, y E3 no tiene nada del pasado que reescribir.
   */
  async editar(id: string, datos: UpdateProductInput): Promise<ProductDto> {
    try {
      const editado = await this.prisma.$transaction(async (tx) => {
        const actual = await tx.product.findUnique({ where: { id } });
        if (!actual) throw noEncontrado();

        // Se comprueba dentro de la transacción, igual que en el alta: la misma
        // ventana existiría aquí.
        await this.exigirCategoriasUsables(tx, datos);

        const producto = await tx.product.update({
          where: { id },
          data: {
            name: datos.name,
            nameNormalized: normalizarBusqueda(datos.name),
            description: datos.description,
            ingredients: datos.ingredients,
            price: datos.price,
            foodTypeCategoryId: datos.foodTypeCategoryId,
            healthProfileCategoryId: datos.healthProfileCategoryId,
          },
          include: CON_CATEGORIAS,
        });

        return { producto, cortes: await calcularCortes(tx) };
      });

      return aDto(editado.producto, editado.cortes);
    } catch (error) {
      throw traducirUnicidad(error);
    }
  }

  /**
   * `PUT /business/products/:id/availability` (FR-019).
   *
   * Agotar y reponer. **No comprueba las categorías**: agotar un producto no
   * cambia su clasificación ni lo activa, de modo que no puede producir el estado
   * que FR-021 evita. Comprobarlas aquí impediría marcar «Agotado» un producto
   * cuya categoría alguien desactivó, que es justo cuando el negocio más necesita
   * poder hacerlo.
   *
   * Un producto agotado **sigue siendo activo**: permanece visible para el
   * cliente, marcado (FR-029).
   */
  async cambiarDisponibilidad(id: string, available: boolean): Promise<ProductDto> {
    const [producto, cortes] = await this.prisma.$transaction(async (tx) => {
      const actual = await tx.product.findUnique({ where: { id } });
      if (!actual) throw noEncontrado();

      // Poner el valor que ya tiene es una petición **sin efecto**, no un error
      // (FR-026): es lo que hace que un doble clic sobre «Agotado» no rompa nada.
      const fila =
        actual.available === available
          ? await tx.product.findUniqueOrThrow({ where: { id }, include: CON_CATEGORIAS })
          : await tx.product.update({
              where: { id },
              data: { available },
              include: CON_CATEGORIAS,
            });

      return [fila, await calcularCortes(tx)] as const;
    });

    return aDto(producto, cortes);
  }

  /**
   * `PUT /business/products/:id/status` (FR-020, FR-021).
   *
   * Dar de baja y reactivar. La baja **no elimina** el producto ni sus datos, y
   * conserva su `available` tal como estaba; al reactivarlo vuelve al estado
   * disponible con todos sus datos intactos (FR-020).
   *
   * **La reactivación comprueba que ambas categorías sigan activas**, dentro de la
   * transacción (FR-021, HU02-E15). Sin esta regla, reactivar produciría un
   * producto activo con una categoría inactiva: invisible para los filtros del
   * cliente y en contra de RN-011. Dar de **baja** no comprueba nada: retirar del
   * menú un producto mal clasificado siempre debe ser posible.
   */
  async cambiarEstado(id: string, active: boolean): Promise<ProductDto> {
    const [producto, cortes] = await this.prisma.$transaction(async (tx) => {
      const actual = await tx.product.findUnique({ where: { id } });
      if (!actual) throw noEncontrado();

      if (active) {
        await this.exigirCategoriasUsables(tx, {
          foodTypeCategoryId: actual.foodTypeCategoryId,
          healthProfileCategoryId: actual.healthProfileCategoryId,
        });
      }

      if (actual.active === active) {
        const fila = await tx.product.findUniqueOrThrow({ where: { id }, include: CON_CATEGORIAS });
        return [fila, await calcularCortes(tx)] as const;
      }

      const fila = await tx.product.update({
        where: { id },
        data: {
          active,
          // Al reactivar vuelve al estado **disponible** (FR-020). Al dar de
          // baja se conserva `available` tal como estaba, de modo que la
          // reactivación no herede un «Agotado» de hace meses.
          ...(active ? { available: true } : {}),
        },
        include: CON_CATEGORIAS,
      });

      return [fila, await calcularCortes(tx)] as const;
    });

    return aDto(producto, cortes);
  }

  /** Traduce la consulta a condiciones de Prisma (FR-023, D-022). */
  private filtrosDelListado(consulta: ListProductsQuery): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {};

    if (consulta.status === ProductStatus.DADO_DE_BAJA) {
      where.active = false;
    } else if (consulta.status === ProductStatus.AGOTADO) {
      where.active = true;
      where.available = false;
    } else if (consulta.status === ProductStatus.DISPONIBLE) {
      where.active = true;
      where.available = true;
    } else {
      // Sin filtro: solo los activos —disponibles y agotados— (supuesto 20).
      where.active = true;
    }

    if (consulta.categoryId) {
      // Vale para **cualquiera de las dos dimensiones**: el negocio filtra por
      // «Pizzas» o por «Saludable» sin tener que decir cuál de las dos es.
      where.OR = [
        { foodTypeCategoryId: consulta.categoryId },
        { healthProfileCategoryId: consulta.categoryId },
      ];
    }

    if (consulta.search && consulta.search.trim() !== '') {
      // La misma función que alimentó la columna al guardar, y el escape
      // **después** de normalizar: buscar `100%` busca ese texto literal y no
      // el catálogo completo (D-011, D-022).
      where.nameNormalized = { contains: escaparLike(normalizarBusqueda(consulta.search)) };
    }

    return where;
  }

  /**
   * Comprueba que **ambas** categorías existan, sean de **su** dimensión y estén
   * **activas** (FR-012, FR-021, RN-011, D-024).
   *
   * Es la invariante que el modelo de datos no puede expresar solo: las claves
   * foráneas garantizan que apunten a una categoría existente, pero no que cada
   * una apunte a una categoría de su dimensión —PostgreSQL no lo expresa con una
   * clave foránea simple— ni que estén activas.
   *
   * Una categoría de la **dimensión equivocada** se rechaza con el mismo
   * `CATEGORY_INACTIVE` que una desactivada, y no con un código propio: desde la
   * interfaz solo se pueden elegir categorías activas de la dimensión correcta, de
   * modo que llegar aquí con una cruzada significa que alguien llamó al endpoint a
   * mano. La corrección que se le pide es la misma —elegir una categoría válida de
   * ese desplegable— y el catálogo cerrado de errores no crece sin necesidad.
   */
  private async exigirCategoriasUsables(
    tx: Prisma.TransactionClient,
    clasificacion: { foodTypeCategoryId: string; healthProfileCategoryId: string },
  ): Promise<void> {
    const esperadas = [
      {
        campo: 'foodTypeCategoryId' as const,
        id: clasificacion.foodTypeCategoryId,
        dimension: Dimension.TIPO_COMIDA,
      },
      {
        campo: 'healthProfileCategoryId' as const,
        id: clasificacion.healthProfileCategoryId,
        dimension: Dimension.PERFIL_SALUD,
      },
    ];

    for (const esperada of esperadas) {
      const categoria = await tx.category.findUnique({ where: { id: esperada.id } });
      if (!categoria) throw noEncontrado();

      if (categoria.dimension !== esperada.dimension || !categoria.active) {
        throw categoriaInactiva(esperada.campo, ETIQUETA_DIMENSION[esperada.dimension]);
      }
    }
  }
}

/**
 * La **única** forma en que un producto sale de la API.
 *
 * `status` y `priceTier` viajan **calculados**: si se computaran en el cliente
 * habría dos implementaciones de la misma regla —una en la interfaz y otra para
 * la futura voz de E6— y bastaría que una cambiara para que un producto
 * apareciera en distinto tramo según quién preguntara.
 *
 * `description` viaja **completa**; el recorte de los listados es solo
 * presentación y lo aplica la interfaz (D-033).
 */
function aDto(producto: ProductoConCategorias, cortes: Cortes): ProductDto {
  return {
    id: producto.id,
    name: producto.name,
    description: producto.description,
    ingredients: producto.ingredients,
    price: producto.price,
    foodTypeCategory: {
      id: producto.foodTypeCategory.id,
      name: producto.foodTypeCategory.name,
      dimension: producto.foodTypeCategory.dimension,
    },
    healthProfileCategory: {
      id: producto.healthProfileCategory.id,
      name: producto.healthProfileCategory.name,
      dimension: producto.healthProfileCategory.dimension,
    },
    active: producto.active,
    available: producto.available,
    status: derivarEstadoProducto(producto),
    priceTier: tramoDe(producto.price, cortes),
    createdAt: producto.createdAt.toISOString(),
  };
}

/** Expuesta para que `MenuService` construya el mismo DTO, sin duplicar la forma. */
export { aDto as productoADto };

function traducirUnicidad(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === VIOLACION_DE_UNICIDAD
  ) {
    return productoYaExiste();
  }
  return error;
}
