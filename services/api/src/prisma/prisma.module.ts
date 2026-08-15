import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global para que ningún módulo tenga que importarlo: el acceso a datos es
 * infraestructura transversal, no una dependencia de dominio.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
