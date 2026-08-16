/**
 * Utilidades compartidas de la capa de integración.
 *
 * Levanta la aplicación real —con sus guards, pipes, filtro e interceptor— y no
 * un doble: lo que estos tests verifican son garantías del motor y del
 * transporte, que un doble no puede demostrar (D-009).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Dimension, Role, UserStatus } from '@prisma/client';
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

// ---------------------------------------------------------------------------
// E3 · Catálogo
//
// Los helpers escriben **directamente en la base**, no por la API: preparar el
// escenario de una prueba no debe depender de que el endpoint que se está
// probando funcione. Es el mismo criterio de `crearUsuario`.
// ---------------------------------------------------------------------------

/** Descripciones que cumplen FR-039 sin ser el objeto de la prueba. */
export const DESCRIPCION_CATEGORIA =
  'Agrupa preparaciones horneadas de masa con distintas combinaciones de queso y verduras.';
export const DESCRIPCION_PRODUCTO =
  'Masa delgada con salsa de tomate, mozzarella fresca y hojas de albahaca.';

/** Crea una categoría activa en la dimensión indicada. */
export async function crearCategoria(datos: {
  dimension: Dimension;
  name: string;
  description?: string;
  active?: boolean;
}) {
  return prisma.category.create({
    data: {
      dimension: datos.dimension,
      name: datos.name,
      nameNormalized: normalizarBusqueda(datos.name),
      description: datos.description ?? DESCRIPCION_CATEGORIA,
      active: datos.active ?? true,
    },
  });
}

/**
 * Crea **una categoría activa por cada dimensión**, que es el mínimo con el que
 * se puede dar de alta un producto (RN-012). Casi toda batería de productos
 * empieza por aquí.
 */
export async function crearClasificacionMinima(sufijo = '') {
  const foodType = await crearCategoria({
    dimension: Dimension.TIPO_COMIDA,
    name: `Pizzas${sufijo}`,
  });
  const healthProfile = await crearCategoria({
    dimension: Dimension.PERFIL_SALUD,
    name: `Indulgente${sufijo}`,
  });
  return { foodType, healthProfile };
}

/** Crea un producto activo y disponible, con su clasificación completa. */
export async function crearProducto(datos: {
  name: string;
  foodTypeCategoryId: string;
  healthProfileCategoryId: string;
  description?: string;
  ingredients?: string | null;
  price?: number;
  active?: boolean;
  available?: boolean;
}) {
  return prisma.product.create({
    data: {
      name: datos.name,
      nameNormalized: normalizarBusqueda(datos.name),
      description: datos.description ?? DESCRIPCION_PRODUCTO,
      // Se distingue «no indicado» de `null` **explícito**: con `??`, pedir un
      // producto sin ingredientes habría recibido los de por omisión, y la
      // prueba del caso opcional de FR-017 no habría probado nada.
      ingredients: 'ingredients' in datos ? datos.ingredients : 'Masa, tomate, mozzarella, albahaca',
      price: datos.price ?? 8990,
      foodTypeCategoryId: datos.foodTypeCategoryId,
      healthProfileCategoryId: datos.healthProfileCategoryId,
      active: datos.active ?? true,
      available: datos.available ?? true,
    },
  });
}

/**
 * Crea un usuario de rol negocio y devuelve su cookie de sesión: el punto de
 * partida de toda prueba de administración del catálogo (FR-027).
 */
export async function sesionNegocio(entorno: Entorno, email = 'negocio@foodvoice.test') {
  await crearUsuario({ email, role: Role.NEGOCIO, fullName: 'Local De Prueba' });
  return conSesion(await iniciarSesion(entorno, email));
}

/** Crea un usuario del rol indicado y devuelve su cookie de sesión. */
export async function sesionDeRol(entorno: Entorno, role: Role) {
  const email = `${role.toLowerCase()}@foodvoice.test`;
  await crearUsuario({ email, role });
  return conSesion(await iniciarSesion(entorno, email));
}
