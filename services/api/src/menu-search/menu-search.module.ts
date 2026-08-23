import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { MenuModule } from '../menu/menu.module';
import { MenuSearchController } from './menu-search.controller';
import { MenuSearchService } from './menu-search.service';
import { SearchThrottlerGuard } from './search-throttler.guard';
import { AnthropicSemanticIntentProvider } from './providers/anthropic-semantic-intent.provider';
import { SEMANTIC_INTENT_PROVIDER } from './providers/semantic-intent.provider';

/**
 * Búsqueda por voz (E6). Módulo separado de `MenuModule`, deliberadamente
 * (D-055): aísla la dependencia de un proveedor externo, el rate limiting y
 * la telemetría del resto de los cuatro roles que consultan el menú sin
 * necesitarlos.
 */
@Module({
  imports: [
    AuthModule,
    CategoriesModule,
    MenuModule,
    // 20 solicitudes / 5 min (FR-014, D-058). El tracker por sesión, no por
    // IP, se define en SearchThrottlerGuard.
    ThrottlerModule.forRoot([{ ttl: 300_000, limit: 20 }]),
  ],
  controllers: [MenuSearchController],
  providers: [
    MenuSearchService,
    SearchThrottlerGuard,
    { provide: SEMANTIC_INTENT_PROVIDER, useClass: AnthropicSemanticIntentProvider },
  ],
})
export class MenuSearchModule {}
