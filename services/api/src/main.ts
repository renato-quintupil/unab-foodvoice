import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validarEntorno } from './config/env.validation';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DateInterceptor } from './common/interceptors/date.interceptor';

/**
 * Límite de tamaño del cuerpo: **10 KB** para todos los endpoints (D-018).
 *
 * Ninguno recibe archivos ni texto largo —el campo más extenso es un nombre de
 * 120 caracteres—, de modo que el límite está dos órdenes de magnitud por
 * encima de cualquier petición legítima y aun así impide que una petición
 * desmedida consuma memoria antes de ser validada. Se fija explícitamente y no
 * se hereda el valor por defecto del framework, que nadie eligió y que puede
 * cambiar con una actualización (api CHK008).
 */
const LIMITE_CUERPO = '10kb';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const entorno = validarEntorno();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // El analizador se monta a mano para poder fijar el límite. Al excederse,
  // express lanza antes de analizar el cuerpo y el filtro lo traduce a
  // `413 PAYLOAD_TOO_LARGE`.
  app.use(express.json({ limit: LIMITE_CUERPO }));
  app.use(express.urlencoded({ limit: LIMITE_CUERPO, extended: true }));

  app.use(cookieParser());
  app.use(helmet());

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new DateInterceptor());
  // La validación de forma la hacen los esquemas Zod de `packages/shared`
  // (D-005); `ValidationPipe` solo transforma los tipos primitivos de las rutas.
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  await app.listen(entorno.PORT_API);
  logger.log(`API escuchando en el puerto ${entorno.PORT_API} · entorno ${entorno.NODE_ENV}`);
}

void bootstrap().catch((error: unknown) => {
  // Un fallo de configuración termina con código distinto de cero y nombra la
  // causa (ops CHK003). No hay arranque degradado.
  const logger = new Logger('Bootstrap');
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
