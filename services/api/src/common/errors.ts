import { HttpException } from '@nestjs/common';
import {
  MSG_AUTOPROTECCION,
  MSG_CATEGORIA_EN_USO,
  MSG_CATEGORIA_INACTIVA,
  MSG_CATEGORIA_YA_EXISTE,
  MSG_CORREO_YA_EXISTE,
  MSG_CREDENCIALES_INVALIDAS,
  MSG_CUENTA_BLOQUEADA,
  MSG_ERROR_INESPERADO,
  MSG_PRODUCTO_NO_ENCONTRADO,
  MSG_PRODUCTO_YA_EXISTE,
  MSG_SESION_EXPIRADA,
  MSG_SIN_PERMISO,
} from '@foodvoice/shared';

/**
 * Catálogo **cerrado** de códigos de error de la API (`contracts/api.md`).
 *
 * La API no produce ningún `code` fuera de esta lista, y ninguno queda sin
 * productor. `UPSTREAM_UNAVAILABLE` lo produce **exclusivamente** el proxy de
 * Next.js y nunca NestJS; figura aquí solo para que el catálogo sea uno y no
 * dos, y para que el tipo compartido cubra lo que la interfaz puede recibir.
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  SELF_PROTECTION: 'SELF_PROTECTION',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  // E3 · Catálogo. Los cuatro son `409` porque describen un conflicto con el
  // estado actual de los datos, no un error de forma: el cuerpo era válido y el
  // esquema lo aceptó. `VALIDATION_ERROR` sigue siendo el de Zod, incluidas las
  // tres condiciones de FR-039.
  CATEGORY_NAME_ALREADY_EXISTS: 'CATEGORY_NAME_ALREADY_EXISTS',
  PRODUCT_NAME_ALREADY_EXISTS: 'PRODUCT_NAME_ALREADY_EXISTS',
  CATEGORY_IN_USE: 'CATEGORY_IN_USE',
  CATEGORY_INACTIVE: 'CATEGORY_INACTIVE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Excepción de dominio con su código del catálogo y su mensaje en español.
 *
 * El `message` sale siempre de una constante de `packages/shared`: ningún
 * módulo escribe el texto que verá el usuario.
 */
export class AppError extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    readonly mensaje: string,
    readonly fields?: Record<string, string>,
    /**
     * Datos adicionales del cuerpo, **fuera de `fields`** (E3,
     * `contracts/api.md` § El `409 CATEGORY_IN_USE` lleva el conteo).
     *
     * Solo lo usa `CATEGORY_IN_USE`, con `blockingProducts`. Va aparte de
     * `fields` porque no es un error asociado a un campo del formulario sino un
     * dato que la interfaz necesita **sin analizar el texto** del mensaje.
     */
    readonly extra?: Record<string, unknown>,
  ) {
    super(mensaje, status);
  }
}

/** `401 INVALID_CREDENTIALS`. **Exclusivamente** `POST /auth/login` (FR-008). */
export const credencialesInvalidas = (): AppError =>
  new AppError(401, ErrorCode.INVALID_CREDENTIALS, MSG_CREDENCIALES_INVALIDAS);

/**
 * `423 ACCOUNT_LOCKED` (FR-033, SC-018).
 *
 * **No revela cuánto falta**: ni en el cuerpo ni en una cabecera `Retry-After`.
 * SC-018 exige que el mensaje sea idéntico palabra por palabra entre dos
 * intentos, y un tiempo restante lo haría distinto en cada uno.
 */
export const cuentaBloqueada = (): AppError =>
  new AppError(423, ErrorCode.ACCOUNT_LOCKED, MSG_CUENTA_BLOQUEADA);

/** `401 UNAUTHENTICATED`. Los seis casos de cookie inválida son indistinguibles. */
export const sesionInvalida = (): AppError =>
  new AppError(401, ErrorCode.UNAUTHENTICATED, MSG_SESION_EXPIRADA);

/** `403 FORBIDDEN` (FR-003, FR-018). */
export const sinPermiso = (): AppError =>
  new AppError(403, ErrorCode.FORBIDDEN, MSG_SIN_PERMISO);

/**
 * `404 NOT_FOUND`. El mensaje visible es el genérico: revelar «ese usuario no
 * existe» a un administrador es inocuo, pero no hay constante para ello y
 * `packages/shared` es la única fuente de textos (Principio II).
 */
export const noEncontrado = (): AppError =>
  new AppError(404, ErrorCode.NOT_FOUND, MSG_ERROR_INESPERADO);

/** `409 EMAIL_ALREADY_EXISTS` (FR-017, RN-005). */
export const correoYaExiste = (): AppError =>
  new AppError(409, ErrorCode.EMAIL_ALREADY_EXISTS, MSG_CORREO_YA_EXISTE, {
    email: MSG_CORREO_YA_EXISTE,
  });

/** `409 SELF_PROTECTION` (FR-027, RN-006). */
export const autoproteccion = (): AppError =>
  new AppError(409, ErrorCode.SELF_PROTECTION, MSG_AUTOPROTECCION);

/** `413 PAYLOAD_TOO_LARGE` (D-018). El cuerpo no llega a analizarse. */
export const cuerpoDemasiadoGrande = (): AppError =>
  new AppError(413, ErrorCode.PAYLOAD_TOO_LARGE, MSG_ERROR_INESPERADO);

// ---------------------------------------------------------------------------
// E3 · Catálogo (`contracts/api.md` § Códigos de error que E3 añade)
// ---------------------------------------------------------------------------

/**
 * `409 CATEGORY_NAME_ALREADY_EXISTS` (FR-004, RN-014).
 *
 * El error va **asociado al campo del nombre** y no suelto en la página, que es
 * lo que FR-003 y el Principio II exigen.
 */
export const categoriaYaExiste = (): AppError =>
  new AppError(409, ErrorCode.CATEGORY_NAME_ALREADY_EXISTS, MSG_CATEGORIA_YA_EXISTE, {
    name: MSG_CATEGORIA_YA_EXISTE,
  });

/** `409 PRODUCT_NAME_ALREADY_EXISTS` (FR-014, RN-005). */
export const productoYaExiste = (): AppError =>
  new AppError(409, ErrorCode.PRODUCT_NAME_ALREADY_EXISTS, MSG_PRODUCTO_YA_EXISTE, {
    name: MSG_PRODUCTO_YA_EXISTE,
  });

/**
 * `409 CATEGORY_IN_USE` (FR-007, RN-015, SC-015).
 *
 * La **única** respuesta de error de la épica con un dato en el cuerpo además
 * del mensaje. `blockingProducts` va aparte para que la interfaz pueda usarlo
 * sin analizar el texto, que es lo que la haría frágil ante una reescritura del
 * mensaje.
 */
export const categoriaEnUso = (productosQueBloquean: number): AppError =>
  new AppError(
    409,
    ErrorCode.CATEGORY_IN_USE,
    MSG_CATEGORIA_EN_USO(productosQueBloquean),
    undefined,
    { blockingProducts: productosQueBloquean },
  );

/**
 * `409 CATEGORY_INACTIVE` (FR-012, FR-021, SC-010).
 *
 * Nombra la dimensión afectada en el mensaje **y** la envía en `fields` con la
 * clave de su desplegable, de modo que el formulario pueda asociar el error al
 * control correcto en lugar de mostrarlo suelto (FR-037).
 */
export const categoriaInactiva = (
  campo: 'foodTypeCategoryId' | 'healthProfileCategoryId',
  dimensionVisible: string,
): AppError => {
  const mensaje = MSG_CATEGORIA_INACTIVA(dimensionVisible);
  return new AppError(409, ErrorCode.CATEGORY_INACTIVE, mensaje, { [campo]: mensaje });
};

/**
 * `404 NOT_FOUND` de un producto del menú (FR-034, D-032).
 *
 * Distinto de `noEncontrado()` solo en el texto visible: aquí sí hay una
 * constante propia, porque es un mensaje que **ve el cliente** en una pantalla
 * completa y «no pudimos completar la operación» no describe lo que ocurrió.
 * **El mismo cuerpo para un producto dado de baja y para uno inexistente**:
 * responder algo distinto revelaría que el identificador existe.
 */
export const productoNoEncontrado = (): AppError =>
  new AppError(404, ErrorCode.NOT_FOUND, MSG_PRODUCTO_NO_ENCONTRADO);
