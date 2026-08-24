import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  SearchIntent,
  SearchRequestSchema,
  type AddResolutionResponse,
  type SearchRequest,
  type SemanticSearchResponse,
} from '@foodvoice/shared';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PeticionConSesion, SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MenuSearchService } from './menu-search.service';
import { SearchThrottlerGuard } from './search-throttler.guard';

/**
 * Búsqueda por voz (E6). `@Roles(CLIENTE)` a nivel de clase: solo el cliente
 * busca o agrega por voz (RN-11 de HU-06, decidido 2026-08-23) — negocio,
 * admin y repartidor no tienen caso de uso y cada búsqueda cuesta dinero de
 * proveedor.
 */
@Controller('menu/search')
@UseGuards(SessionGuard, RolesGuard, SearchThrottlerGuard)
@Roles(Role.CLIENTE)
export class MenuSearchController {
  constructor(private readonly busqueda: MenuSearchService) {}

  /**
   * `POST /api/v1/menu/search` (D-056). Un solo endpoint para las dos
   * historias: `intent: 'SEARCH'` (por omisión) resuelve una lista,
   * `intent: 'ADD'` resuelve un único candidato para HU-13.
   */
  @Post()
  @HttpCode(200)
  buscar(
    @Req() peticion: PeticionConSesion,
    @Body(new ZodValidationPipe(SearchRequestSchema)) datos: SearchRequest,
  ): Promise<SemanticSearchResponse | AddResolutionResponse> {
    if (datos.intent === SearchIntent.ADD) {
      return this.busqueda.resolverAgregado(peticion.sesion, datos);
    }
    return this.busqueda.buscar(peticion.sesion, datos);
  }
}
