import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente de Prisma con su conexión ligada al ciclo de vida de Nest.
 *
 * Conectar en `onModuleInit` y no de forma perezosa hace que un problema de
 * conectividad aparezca al arrancar, y no en la primera petición de un usuario.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
