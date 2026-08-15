/**
 * Utilidades compartidas de la capa de integración.
 *
 * Levanta la aplicación real —con sus guards, pipes, filtro e interceptor— y no
 * un doble: lo que estos tests verifican son garantías del motor y del
 * transporte, que un doble no puede demostrar (D-009).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role, UserStatus } from '@prisma/client';
import { normalizarBusqueda } from '@foodvoice/shared';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClockService } from '../src/common/clock.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { DateInterceptor } from '../src/common/interceptors/date.interceptor';
import { COOKIE_SESION } from '../src/auth/session.service';
import { prisma } from './setup';

export { COOKIE_SESION };

/**
 * Reloj sustituible: permite adelantar el tiempo sin esperarlo de verdad
 * (D-009). Empieza siguiendo al reloj del sistema y solo se congela cuando un
 * caso lo pide.
 */
export class RelojDePrueba extends ClockService {
  private fijo: Date | null = null;

  override ahora(): Date {
    return this.fijo ?? new Date();
  }

  fijar(instante: Date): void {
    this.fijo = instante;
  }

  avanzarMinutos(minutos: number): void {
    this.fijar(new Date(this.ahora().getTime() + minutos * 60_000));
  }

  liberar(): void {
    this.fijo = null;
  }
}

export type Entorno = {
  app: INestApplication;
  reloj: RelojDePrueba;
  http: () => request.Agent;
};

export async function crearEntorno(): Promise<Entorno> {
  const reloj = new RelojDePrueba();

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ClockService)
    .useValue(reloj)
    .compile();

  const app = modulo.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new DateInterceptor());
  await app.init();

  return { app, reloj, http: () => request(app.getHttpServer()) };
}

export const CONTRASENA = 'contrasena8';

/** Crea un usuario directamente en la base, con la contraseña ya hasheada. */
export async function crearUsuario(datos: {
  fullName?: string;
  email: string;
  phone?: string;
  password?: string;
  role?: Role;
  status?: UserStatus;
}) {
  const fullName = datos.fullName ?? 'Usuario De Prueba';
  const email = datos.email.trim().toLowerCase();

  return prisma.user.create({
    data: {
      fullName,
      email,
      phone: datos.phone ?? '+56911112222',
      passwordHash: await bcrypt.hash(datos.password ?? CONTRASENA, 12),
      role: datos.role ?? Role.CLIENTE,
      status: datos.status ?? UserStatus.ACTIVO,
      searchNormalized: normalizarBusqueda(`${fullName} ${email}`),
    },
  });
}

/** Extrae el valor de la cookie de sesión de una respuesta. */
export function cookieDe(respuesta: request.Response): string | undefined {
  const cabeceras = respuesta.headers['set-cookie'];
  const lista = Array.isArray(cabeceras) ? cabeceras : cabeceras ? [cabeceras] : [];
  const cookie = lista.find((c) => c.startsWith(`${COOKIE_SESION}=`));
  const valor = cookie?.split(';')[0]?.split('=')[1];
  return valor === '' ? undefined : valor;
}

/** Inicia sesión por la API y devuelve la cookie resultante. */
export async function iniciarSesion(
  entorno: Entorno,
  email: string,
  password = CONTRASENA,
): Promise<string> {
  const respuesta = await entorno
    .http()
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  const cookie = cookieDe(respuesta);
  if (!cookie) throw new Error(`El inicio de sesión de ${email} no devolvió cookie.`);
  return cookie;
}

/** Cabecera de cookie lista para adjuntar a una petición. */
export function conSesion(cookie: string): string {
  return `${COOKIE_SESION}=${cookie}`;
}
