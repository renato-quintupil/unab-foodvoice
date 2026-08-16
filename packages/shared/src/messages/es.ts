/**
 * Los mensajes fijos en español (FR-008, SC-018, api CHK015).
 *
 * **Este archivo es su única fuente.** Ningún otro módulo ni documento
 * reproduce su texto: un texto copiado en dos sitios es un texto que puede
 * divergir, y la igualdad literal que exige SC-018 dejaría de estar garantizada
 * por construcción para pasar a depender de que nadie edite solo una copia.
 *
 * Los doce primeros son de E1 · Acceso y usuarios; a partir de § E3 vienen los
 * del catálogo. Ninguno de los de E1 cambia.
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

// ---------------------------------------------------------------------------
// E3 · Administración de menú (`002-administracion-menu-productos`)
//
// Se añaden a este archivo, y no a uno propio del catálogo, porque la regla que
// lo gobierna no cambia: **una sola fuente para todo texto fijo en español**.
// Dos archivos de mensajes serían dos sitios donde buscar antes de escribir uno
// nuevo, y el segundo acabaría repitiendo lo que el primero ya dice.
// ---------------------------------------------------------------------------

/** FR-004, RN-014. La unicidad es **por dimensión**, y el mensaje lo dice. */
export const MSG_CATEGORIA_YA_EXISTE =
  'Ya existe una categoría con ese nombre en esa clasificación.';

/** FR-014, RN-005. Alcanza a los productos dados de baja, cuyo nombre queda reservado. */
export const MSG_PRODUCTO_YA_EXISTE = 'Ya existe un producto con ese nombre en el catálogo.';

/** FR-030, SC-022. El catálogo no tiene ningún producto activo. */
export const MSG_MENU_VACIO = 'Todavía no hay productos en el menú.';

/** FR-035, SC-018. Una combinación de filtros o una búsqueda sin resultados. */
export const MSG_SIN_RESULTADOS_CATALOGO =
  'No hay productos que coincidan con los criterios seleccionados.';

/**
 * FR-017, RN-019, SC-020. **Obligatoria y no configurable** siempre que se
 * muestren ingredientes.
 *
 * Sin ella, un cliente con una alergia podría tomar la ausencia de un
 * ingrediente en la lista como una garantía que el sistema no da: certificar la
 * ausencia de un componente es seguridad alimentaria, no software.
 */
export const MSG_INGREDIENTES_REFERENCIALES =
  'Los ingredientes son información referencial y no una declaración de alérgenos. ' +
  'Si tienes una alergia, consúltalo con el local antes de pedir.';

/** FR-034, D-032. Ficha de un producto inexistente o no activo, sin distinguirlos. */
export const MSG_PRODUCTO_NO_ENCONTRADO = 'No encontramos el producto que buscas.';

/**
 * FR-007, RN-015. Rechazo de la desactivación, **con el número de productos que
 * la bloquean**.
 *
 * Es una función y no una cadena porque su texto incorpora un dato variable. El
 * número importa: le dice al negocio el tamaño del trabajo que tiene por
 * delante, en lugar de que lo descubra producto a producto.
 */
export const MSG_CATEGORIA_EN_USO = (productos: number): string =>
  productos === 1
    ? 'No puedes desactivar esta categoría: 1 producto activo la tiene como su única clasificación. ' +
      'Reclasifícalo o dalo de baja antes de desactivarla.'
    : `No puedes desactivar esta categoría: ${productos} productos activos la tienen como su única clasificación. ` +
      'Reclasifícalos o dalos de baja antes de desactivarla.';

/**
 * FR-012, FR-021, SC-010. Una categoría del producto está desactivada, **con la
 * dimensión afectada nombrada**.
 *
 * Recibe el nombre visible de la dimensión, no su identificador interno: lo
 * traduce `ETIQUETA_DIMENSION` antes de llamar aquí (SC-029).
 */
export const MSG_CATEGORIA_INACTIVA = (dimension: string): string =>
  `La categoría de ${dimension} de este producto está desactivada. ` +
  'Elige una categoría activa para poder guardarlo.';

/**
 * FR-012, HU14-E19, SC-010. Una dimensión sin ninguna categoría activa, en el
 * alta de productos.
 *
 * No se muestra un desplegable vacío: se explica qué falta y se ofrece ir a
 * crearlo, que es la diferencia entre una pantalla que enseña y una que
 * bloquea sin decir por qué.
 */
export const MSG_DIMENSION_SIN_CATEGORIAS = (dimension: string): string =>
  `Todavía no hay ninguna categoría de ${dimension}. ` +
  'Crea la primera para poder dar de alta productos.';

/**
 * FR-039, SC-031. Un mensaje por cada motivo de rechazo de una descripción.
 *
 * Cada uno nombra **la condición incumplida** y qué hacer, porque «demasiado
 * corta» y «repite el nombre» piden correcciones distintas y un mensaje único
 * obligaría a adivinar cuál.
 */
export const MSG_DESCRIPCION_AUSENTE = 'La descripción es obligatoria.';

export const MSG_DESCRIPCION_DEMASIADO_CORTA = (minimo: number): string =>
  `La descripción debe tener al menos ${minimo} caracteres. ` +
  'Es el texto con el que el cliente podrá encontrar esto hablando.';

export const MSG_DESCRIPCION_DEMASIADO_LARGA = (maximo: number): string =>
  `La descripción no puede superar los ${maximo} caracteres.`;

export const MSG_DESCRIPCION_POCAS_PALABRAS =
  'La descripción debe tener al menos cinco palabras. Cuenta qué es y cómo es, no solo cómo se llama.';

export const MSG_DESCRIPCION_PALABRAS_REPETIDAS =
  'La descripción repite las mismas palabras. Necesita al menos cinco palabras distintas que digan algo.';

export const MSG_DESCRIPCION_REPITE_EL_NOMBRE =
  'La descripción solo repite el nombre. Agrega algo que el nombre no diga.';

/**
 * Ayuda contextual de los campos de descripción (FR-005, FR-016, SC-019,
 * § Ayuda contextual de los campos de descripción).
 *
 * Cada una lleva **un ejemplo real y completo** del largo que se espera y **una
 * explicación de para qué se usa**. Las dos cosas deben mostrarse junto al campo
 * y ser legibles **sin escribir nada** —no dentro del propio campo como marca de
 * agua, que desaparece al escribir—.
 *
 * Que vivan aquí y no en cada formulario es lo que garantiza que las dos
 * pantallas enseñen lo mismo y que SC-019 se pueda comprobar en un solo sitio.
 * El ejemplo no es decorativo: es la única vía por la que el producto puede
 * pedir prosa útil, porque las tres condiciones de FR-039 descartan la basura
 * evidente pero no enseñan a escribir.
 */
export const AYUDA_DESCRIPCION_PRODUCTO = {
  explicacion:
    'Esta descripción es lo que permitirá encontrar el producto cuando el cliente lo pida ' +
    'hablando. Cuenta de qué está hecho y cómo es —el sabor, el tamaño, para cuántos alcanza—. ' +
    'Una descripción pobre hará que el cliente no lo encuentre.',
  ejemplo:
    'Masa delgada con salsa de tomate, mozzarella fresca, albahaca y un hilo de aceite de oliva. ' +
    'Contundente y para compartir entre dos.',
} as const;

export const AYUDA_DESCRIPCION_CATEGORIA = {
  explicacion:
    'Esta descripción es lo que permitirá encontrar la categoría cuando el cliente pida algo ' +
    'con sus propias palabras. Describe qué agrupa y cómo se siente comerlo, no solo su nombre: ' +
    'así frases como «algo grasoso» o «para pecar» darán con ella sin que nadie las escriba aquí.',
  ejemplo:
    'Hamburguesas, papas fritas, completos y frituras en general. Comida contundente, calórica ' +
    'y sabrosa; lo que la gente pide cuando quiere algo rico sin pensar en la dieta.',
} as const;
