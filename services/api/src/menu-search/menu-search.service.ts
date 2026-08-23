import { Inject, Injectable } from '@nestjs/common';
import { SearchIntent as SearchIntentPrisma, SearchOutcome } from '@prisma/client';
import type {
  AddResolutionResponse,
  ProductDto,
  SearchRequest,
  SemanticSearchResponse,
} from '@foodvoice/shared';
import type { SesionValida } from '../auth/session.service';
import { busquedaNoDisponible } from '../common/errors';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from '../menu/menu.service';
import { calcularCortes } from '../products/price-tier';
import { productoADto } from '../products/products.service';
import {
  SEMANTIC_INTENT_PROVIDER,
  type ContextoBusqueda,
  type SemanticIntentProvider,
} from './providers/semantic-intent.provider';

/**
 * Búsqueda por voz (E6, D-056): un solo servicio para las Historias 1/3
 * (`buscar`) y 2 (`resolverAgregado`), porque ambas comparten la proyección
 * del catálogo, la llamada al proveedor y la reconsulta de disponibilidad —
 * los cuatro puntos donde vive la seguridad del diseño.
 *
 * **Nunca escribe en `product`, `cart`, `cart_line` ni `order`.** La única
 * tabla que este servicio escribe es `search_log` (D-060), y siempre —
 * incluso cuando el proveedor falla— para poder medir SC-004 y SC-007.
 */
@Injectable()
export class MenuSearchService {
  constructor(
    private readonly menu: MenuService,
    private readonly categorias: CategoriesService,
    private readonly prisma: PrismaService,
    @Inject(SEMANTIC_INTENT_PROVIDER) private readonly proveedor: SemanticIntentProvider,
  ) {}

  /** `intent: 'SEARCH'` — Historia 1 y 3 (FR-001, FR-003 a FR-011, FR-013). */
  async buscar(sesion: SesionValida, datos: SearchRequest): Promise<SemanticSearchResponse> {
    const inicio = Date.now();
    const { contexto, idsPermitidos } = await this.armarContexto(datos.query);

    let resultado: Awaited<ReturnType<SemanticIntentProvider['interpretarBusqueda']>>;
    try {
      resultado = await this.proveedor.interpretarBusqueda(contexto);
    } catch (error) {
      await this.registrar(sesion, datos, SearchOutcome.ERROR, Date.now() - inicio, null, error);
      throw busquedaNoDisponible();
    }

    if (resultado.kind === 'CLARIFICATION') {
      await this.registrar(
        sesion,
        datos,
        SearchOutcome.CLARIFICATION,
        Date.now() - inicio,
        resultado.tokensUsed,
      );
      return { status: 'CLARIFICATION', question: resultado.question, options: resultado.options };
    }

    if (resultado.kind === 'NO_RESULTS') {
      await this.registrar(
        sesion,
        datos,
        SearchOutcome.NO_RESULTS,
        Date.now() - inicio,
        resultado.tokensUsed,
      );
      return { status: 'NO_RESULTS', interpretation: resultado.interpretation };
    }

    // RESULTS: allowlist (D-062) antes de reconsultar.
    const idsFiltrados = resultado.productIds.filter((id) => idsPermitidos.has(id));
    const vigentes = await this.reconsultarVigentes(idsFiltrados, resultado.interpretation.vegan);
    // Conserva el orden que devolvió el proveedor entre los que siguen vigentes.
    const items = idsFiltrados
      .map((id) => vigentes.find((producto) => producto.id === id))
      .filter((producto): producto is ProductDto => producto !== undefined);

    const outcome = items.length > 0 ? SearchOutcome.RESULTS : SearchOutcome.NO_RESULTS;
    await this.registrar(sesion, datos, outcome, Date.now() - inicio, resultado.tokensUsed);

    if (items.length === 0) {
      return { status: 'NO_RESULTS', interpretation: resultado.interpretation };
    }
    return { status: 'RESULTS', interpretation: resultado.interpretation, items };
  }

  /**
   * `intent: 'ADD'` — Historia 2 (FR-019 a FR-026). **Nunca** escribe en el
   * carrito: solo resuelve producto y cantidad para que `apps/web` confirme y
   * reutilice `POST /cart/lines` (D-063).
   */
  async resolverAgregado(
    sesion: SesionValida,
    datos: SearchRequest,
  ): Promise<AddResolutionResponse> {
    const inicio = Date.now();
    const { contexto, idsPermitidos } = await this.armarContexto(datos.query);

    let resultado: Awaited<ReturnType<SemanticIntentProvider['interpretarAgregado']>>;
    try {
      resultado = await this.proveedor.interpretarAgregado(contexto);
    } catch (error) {
      await this.registrar(sesion, datos, SearchOutcome.ERROR, Date.now() - inicio, null, error);
      throw busquedaNoDisponible();
    }

    if (resultado.kind === 'CLARIFICATION') {
      await this.registrar(
        sesion,
        datos,
        SearchOutcome.CLARIFICATION,
        Date.now() - inicio,
        resultado.tokensUsed,
      );
      return { status: 'CLARIFICATION', question: resultado.question, options: resultado.options };
    }

    if (resultado.kind === 'NOT_FOUND' || !idsPermitidos.has(resultado.productId)) {
      // Un `productId` fuera de la allowlist se trata como "no encontrado":
      // nunca se consulta fuera de los IDs que el servidor mismo envió (D-062).
      await this.registrar(
        sesion,
        datos,
        SearchOutcome.NOT_FOUND,
        Date.now() - inicio,
        resultado.tokensUsed,
      );
      return { status: 'NOT_FOUND' };
    }

    // RESOLVED: revalidar disponibilidad inmediatamente antes de responder (FR-021).
    const [vigente] = await this.reconsultarVigentes([resultado.productId], null);
    if (!vigente) {
      await this.registrar(
        sesion,
        datos,
        SearchOutcome.NOT_FOUND,
        Date.now() - inicio,
        resultado.tokensUsed,
      );
      return { status: 'NOT_FOUND' };
    }

    await this.registrar(sesion, datos, SearchOutcome.RESOLVED, Date.now() - inicio, resultado.tokensUsed);
    return { status: 'RESOLVED', item: vigente, quantity: resultado.quantity };
  }

  /** Proyección de solo lectura + allowlist en memoria (D-061, D-062). */
  private async armarContexto(
    query: string,
  ): Promise<{ contexto: ContextoBusqueda; idsPermitidos: Set<string> }> {
    const [{ items }, categorias] = await Promise.all([
      this.menu.candidatosParaBusqueda(),
      this.categorias.listar({ active: true }),
    ]);

    const contexto: ContextoBusqueda = {
      query,
      categories: categorias.items.map((categoria) => ({
        id: categoria.id,
        name: categoria.name,
        description: categoria.description,
        dimension: categoria.dimension,
      })),
      products: items.map((producto) => ({
        id: producto.id,
        name: producto.name,
        description: producto.description,
        ingredients: producto.ingredients,
        foodTypeCategoryId: producto.foodTypeCategory.id,
        healthProfileCategoryId: producto.healthProfileCategory.id,
        priceTier: producto.priceTier,
        dietaryTags: producto.dietaryTags,
      })),
    };

    return { contexto, idsPermitidos: new Set(items.map((producto) => producto.id)) };
  }

  /**
   * Reconsulta `active && available` en el instante de responder (FR-006,
   * FR-007, FR-021), no lo que decía la proyección enviada al proveedor. Si
   * `vegan === true`, agrega el filtro real de aptitud dietética como defensa
   * adicional (FR-013): nunca confía solo en que el modelo ya excluyó lo que
   * no correspondía.
   */
  private async reconsultarVigentes(
    ids: string[],
    vegan: boolean | null,
  ): Promise<ProductDto[]> {
    if (ids.length === 0) return [];

    return this.prisma.$transaction(async (tx) => {
      const cortes = await calcularCortes(tx);
      const filas = await tx.product.findMany({
        where: {
          id: { in: ids },
          active: true,
          available: true,
          ...(vegan === true ? { dietaryTags: { some: { name: 'Vegano' } } } : {}),
        },
        include: { foodTypeCategory: true, healthProfileCategory: true, dietaryTags: true },
      });
      return filas.map((fila) => productoADto(fila, cortes));
    });
  }

  /** Escribe `search_log`. Nunca incluye la frase del cliente ni audio (FR-027). */
  private async registrar(
    sesion: SesionValida,
    datos: SearchRequest,
    outcome: SearchOutcome,
    latencyMs: number,
    tokensUsed: number | null,
    error?: unknown,
  ): Promise<void> {
    await this.prisma.searchLog.create({
      data: {
        sessionId: sesion.sessionId,
        channel: datos.channel,
        intent: datos.intent as SearchIntentPrisma,
        outcome,
        latencyMs,
        tokensUsed,
        model: this.proveedor.nombreModelo,
        errorCode: error instanceof Error ? error.constructor.name : undefined,
      },
    });
  }
}
