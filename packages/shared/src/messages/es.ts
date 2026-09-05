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

// ---------------------------------------------------------------------------
// E2 · Gestión de pedidos (`003-gestion-pedidos`)
// ---------------------------------------------------------------------------

/** FR-002. Producto agotado o dado de baja: no se puede agregar al carrito. */
export const MSG_PRODUCTO_NO_DISPONIBLE = 'Este producto no está disponible en este momento.';

/** FR-009, HU12-E08. Carrito vacío: no se puede confirmar. */
export const MSG_CARRITO_VACIO = 'Tu carrito está vacío. Agrega productos para armar tu pedido.';

/** FR-007. Al menos una línea del carrito dejó de estar activa/disponible. */
export const MSG_CARRITO_CON_PRODUCTOS_NO_DISPONIBLES =
  'Hay productos en tu carrito que ya no están disponibles. Quítalos para poder confirmar.';

/** FR-028. El precio de al menos un producto cambió desde la última revisión. */
export const MSG_PRECIO_CAMBIO =
  'El precio de uno o más productos cambió. Revisa tu carrito y confirma nuevamente.';

/**
 * D-036. `expectedLines` no describe el carrito real del servidor —típicamente
 * porque otra pestaña lo modificó entre que se cargó la pantalla y se
 * confirmó—. Error de forma de la petición, distinto de un cambio de precio.
 */
export const MSG_CARRITO_DESACTUALIZADO =
  'Tu carrito cambió mientras revisabas el pedido. Actualiza la página y vuelve a confirmar.';

/** FR-013. */
export const MSG_DIRECCION_ETIQUETA_VACIA = 'La etiqueta de la dirección no puede estar vacía.';

/** FR-013. */
export const MSG_DIRECCION_TEXTO_VACIO = 'El texto de la dirección no puede estar vacío.';

/** FR-014. Alcanza a las direcciones activas y a las desactivadas (D-040). */
export const MSG_DIRECCION_ETIQUETA_DUPLICADA = 'Ya tienes una dirección guardada con esa etiqueta.';

/** FR-022. Ninguna dirección —guardada ni puntual— elegida al confirmar. */
export const MSG_DIRECCION_REQUERIDA = 'Indica una dirección de entrega para confirmar tu pedido.';

/** FR-020. Retirar la predeterminada mientras existen otras direcciones activas. */
export const MSG_DIRECCION_ELIGE_NUEVA_PREDETERMINADA =
  'Elige otra dirección como predeterminada antes de desactivar esta.';

/** FR-019. Solo se puede desactivar una dirección ya usada, no eliminarla. */
export const MSG_DIRECCION_EN_USO =
  'Esta dirección ya se usó en un pedido y no se puede eliminar. Puedes desactivarla.';

/** FR-033. Motivo de rechazo vacío o solo espacios. */
export const MSG_MOTIVO_RECHAZO_REQUERIDO = 'Escribe el motivo del rechazo.';

/** FR-032, D-038. El pedido ya no está en `creado`, o perdió una carrera. */
export const MSG_PEDIDO_NO_PENDIENTE =
  'Este pedido ya no está pendiente. Actualiza la página para ver su estado actual.';

/** FR-040. Bandeja del negocio sin pedidos pendientes ni en preparación. */
export const MSG_SIN_PEDIDOS_PENDIENTES = 'No tienes pedidos pendientes por ahora.';

/** FR-039. El negocio todavía no rechazó ningún pedido. */
export const MSG_SIN_PEDIDOS_RECHAZADOS = 'Todavía no has rechazado ningún pedido.';

// ---------------------------------------------------------------------------
// E6 · Búsqueda por voz
// ---------------------------------------------------------------------------

/** FR-015. `query` vacío o solo espacios. */
export const MSG_BUSQUEDA_VACIA = 'Escribe o dicta lo que quieres comer para poder buscarlo.';

/** FR-015. `query` de más de 300 caracteres. */
export const MSG_BUSQUEDA_MUY_LARGA =
  'Tu búsqueda es demasiado larga. Prueba con una frase más corta.';

/** FR-014. Más de 20 búsquedas en 5 minutos para la misma sesión. */
export const MSG_LIMITE_BUSQUEDAS =
  'Hiciste demasiadas búsquedas seguidas. Espera unos minutos e inténtalo de nuevo.';

/** FR-016. Timeout, error del proveedor, o JSON inválido tras el reintento. */
export const MSG_BUSQUEDA_NO_DISPONIBLE =
  'No pudimos interpretar tu búsqueda en este momento. Mientras tanto, puedes usar los filtros del menú.';

// ---------------------------------------------------------------------------
// E5 · Reparto
// ---------------------------------------------------------------------------

/** FR-006. Sin pedidos `en_preparacion` disponibles para tomar. */
export const MSG_SIN_PEDIDOS_DISPONIBLES = 'No hay pedidos disponibles por ahora.';

/** FR-005, D-068. El pedido ya no está en `en_preparacion` sin repartidor. */
export const MSG_PEDIDO_YA_NO_DISPONIBLE = 'Este pedido ya no está disponible.';

/** FR-004, D-069. El repartidor ya tiene un pedido en `asignado_repartidor` sin entregar. */
export const MSG_REPARTIDOR_YA_TIENE_PEDIDO =
  'Ya tienes un pedido en curso. Complétalo o suéltalo antes de tomar otro.';

/** FR-008. El pedido ya no está asignado al repartidor autenticado. */
export const MSG_PEDIDO_NO_ASIGNADO_A_TI = 'Este pedido ya no está asignado a ti.';

// ---------------------------------------------------------------------------
// E7 · Cierre del servicio
// ---------------------------------------------------------------------------

/** FR-007. Motivo de reclamo ausente o demasiado corto al cerrar un pedido entregado. */
export const MSG_MOTIVO_RECLAMO_REQUERIDO = 'Cuéntanos qué pasó para poder registrar tu reclamo.';

/** FR-009, D-076. El pedido no está en `entregado` (incluye uno ya `cerrado`). */
export const MSG_PEDIDO_NO_ENTREGADO =
  'Este pedido no está entregado. Actualiza la página para ver su estado actual.';

/** FR-011, D-081. El negocio todavía no tiene ningún pedido cerrado. */
export const MSG_SIN_PEDIDOS_CERRADOS = 'Todavía no tienes pedidos cerrados.';

/**
 * El negocio no tiene ningún pedido en reparto o entregado sin cerrar.
 * Corrección post-verificación: sin esta pantalla el negocio perdía de vista
 * un pedido desde que salía a reparto hasta que el cliente lo cerraba (o
 * nunca, si no actuaba) — mismo tipo de hueco que D-081 encontró para
 * `cerrado`, un estado más adelante en la máquina.
 */
export const MSG_SIN_PEDIDOS_EN_CURSO = 'No tienes pedidos en reparto por ahora.';

// ---------------------------------------------------------------------------
// E8 · Controles y administración
// ---------------------------------------------------------------------------

/**
 * FR-002, FR-004, FR-009, D-086. Motivo ausente o demasiado corto en las tres
 * acciones administrativas que lo exigen (forzar transición, cerrar
 * administrativamente, pausar el servicio) — un solo mensaje compartido:
 * mismo actor, misma superficie, mismo significado exacto.
 */
export const MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO = 'Escribe el motivo de esta acción administrativa.';

/** FR-001, FR-006. El estado destino no es una transición forzable desde el estado actual del pedido, o la carrera se perdió. */
export const MSG_TRANSICION_ADMINISTRATIVA_INVALIDA =
  'Esta transición no es válida para el estado actual del pedido.';

/** FR-003, FR-006. El pedido ya está en `cerrado` o `rechazado`, o perdió la carrera. */
export const MSG_PEDIDO_YA_ES_TERMINAL =
  'Este pedido ya está en un estado final y no admite intervenciones administrativas.';

/** FR-010. El servicio está pausado; el cliente no puede confirmar un pedido nuevo. */
export const MSG_SERVICIO_PAUSADO =
  'El servicio está temporalmente pausado. Intenta confirmar tu pedido más tarde.';

export const AYUDA_DESCRIPCION_CATEGORIA = {
  explicacion:
    'Esta descripción es lo que permitirá encontrar la categoría cuando el cliente pida algo ' +
    'con sus propias palabras. Describe qué agrupa y cómo se siente comerlo, no solo su nombre: ' +
    'así frases como «algo grasoso» o «para pecar» darán con ella sin que nadie las escriba aquí.',
  ejemplo:
    'Hamburguesas, papas fritas, completos y frituras en general. Comida contundente, calórica ' +
    'y sabrosa; lo que la gente pide cuando quiere algo rico sin pensar en la dieta.',
} as const;
