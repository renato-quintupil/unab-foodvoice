/**
 * Los doce mensajes fijos en español (FR-008, SC-018, api CHK015).
 *
 * **Este archivo es su única fuente.** Ningún otro módulo ni documento
 * reproduce su texto: un texto copiado en dos sitios es un texto que puede
 * divergir, y la igualdad literal que exige SC-018 dejaría de estar garantizada
 * por construcción para pasar a depender de que nadie edite solo una copia.
 */

/** FR-008. Cubre correo inexistente, contraseña incorrecta, cuenta desactivada y cualquier otra causa. */
export const MSG_CREDENCIALES_INVALIDAS = 'Correo electrónico o contraseña incorrectos.';

/** FR-033, SC-018. Idéntico palabra por palabra para correo registrado e inexistente. */
export const MSG_CUENTA_BLOQUEADA =
  'Demasiados intentos fallidos. Vuelve a intentarlo en 15 minutos.';

/** FR-003, FR-018. */
export const MSG_SIN_PERMISO = 'No tienes permiso para acceder a esta función.';

/** FR-005, FR-030. */
export const MSG_SESION_EXPIRADA = 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.';

/** FR-015, SC-020. */
export const MSG_SIN_RESULTADOS_USUARIOS =
  'No hay usuarios que coincidan con los criterios seleccionados.';

/** FR-022, SC-020. */
export const MSG_SIN_RESULTADOS_PEDIDOS = 'No hay pedidos para los filtros seleccionados.';

/** FR-017. */
export const MSG_CORREO_YA_EXISTE = 'Ya existe un usuario registrado con ese correo electrónico.';

/** FR-027. */
export const MSG_AUTOPROTECCION = 'No puedes desactivar tu propia cuenta ni cambiar tu propio rol.';

/**
 * Principio II. Cubre el `500` de la API y el `502` del proxy: para quien lo
 * lee, «el servicio falló» y «el servicio no respondió» son la misma situación
 * y admiten la misma reacción; distinguirlos revelaría la topología interna.
 */
export const MSG_ERROR_INESPERADO =
  'No pudimos completar la operación. Vuelve a intentarlo en unos momentos.';

/**
 * FR-026. Aviso permanente de la pantalla de inicio de sesión: se muestra
 * **antes** de cualquier intento fallido. No es un mensaje de error.
 */
export const MSG_CONTRASENA_OLVIDADA =
  'Si olvidaste tu contraseña, solicita al administrador que te la restablezca.';

/** FR-020. */
export const MSG_RANGO_FECHAS_INVALIDO = 'La fecha inicial no puede ser posterior a la final.';

/** FR-022. Estado del panel mientras no existan pedidos (D-012). */
export const MSG_SIN_DATOS_PEDIDOS = 'Todavía no hay pedidos registrados.';
