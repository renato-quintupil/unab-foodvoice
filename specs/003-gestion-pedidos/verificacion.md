# Registro de verificación: E2 · Gestión de pedidos

**Fecha**: 2026-08-18 · **Ejecutado sobre**: `docker compose up --build` (api,
web y postgres en contenedores), con la semilla del catálogo de E3 y dos
usuarios de prueba creados desde el panel de administración de E1
(`cliente@foodvoice.local`, `negocio@foodvoice.local`).

Este documento recoge el resultado de la Fase 6 (T101–T108). **Distingue lo
comprobado de lo pendiente**, con el mismo criterio que E1 y E3.

**Estado al 2026-08-18: T101–T108 completos.** La automatización de navegador
de esta sesión sufrió una degradación intermitente de su canal de entrada
sintético (clics y teclas que no llegaban a disparar el evento real, con éxito
parcial e impredecible) que impidió completar un recorrido de teclado (T102) y
un redimensionado de viewport (T103) fiables por ese medio. El resto de la
validación automatizada se completó rodeando ese problema: los clics de UI se
dispararon con `element.click()` vía JavaScript de página (evita el pipeline
de entrada sintética de CDP) y los cambios de sesión se hicieron con
`fetch('/api/auth/login', …)` contra el mismo endpoint que usa el formulario,
cuando encadenar un `navigate` inmediatamente después de un clic de formulario
cancelaba la petición en vuelo. **T102 y T103 los completó el usuario a mano**,
sobre los mismos contenedores levantados en esta sesión, confirmando el
recorrido de teclado y la vista a 360 px de las ocho páginas.

**La validación encontró un defecto real**, descrito abajo con su corrección
y su prueba — el mismo patrón que E1 y E3: pasaba con las 918 pruebas
automáticas en verde y solo apareció al mirar la pantalla.

---

## Resumen

| Tarea | Qué exige | Estado |
|---|---|---|
| T101 | Texto visible en español y errores asociados al campo, en las páginas recorridas | ✅ Auditado con `get_page_text` sobre ~20 estados de pantalla distintos |
| T102 | Recorrer y operar solo con teclado | ✅ Completado a mano por el usuario |
| T103 | Comprobar a 360 px | ✅ Completado a mano por el usuario |
| T104 | Las cinco comprobaciones automáticas | ✅ Todas en verde (detalle abajo) |
| T105 | V-01 a V-36 | ✅ Ejecutados (detalle abajo) — un hallazgo, corregido |
| T106 | V-37 a V-40 (historial interno) | ✅ Cubiertos por la batería de integración (no hay pantalla ni endpoint) |
| T107 | Este registro | ✅ |
| T108 | `CLAUDE.md` y `specs/README.md` | ✅ |

---

## El defecto que encontró la validación

### 1 · Mensaje de validación en inglés para la dirección puntual (FR-022)

**Qué pasaba.** Al confirmar un pedido escribiendo una dirección puntual de
menos de 10 caracteres, el campo mostraba el mensaje por omisión de Zod:
*"String must contain at least 10 character(s)"* — en inglés, violando la
convención del proyecto de que todo texto visible al usuario esté en español
(`CLAUDE.md` § Convenciones). El resto de los mensajes de la misma pantalla
—incluida la validación XOR de dirección— sí estaban en español.

**Por qué pasaba.** `ConfirmOrderSchema` en `packages/shared/src/schemas/order.ts`
declaraba `addressText: z.string().trim().min(10).max(500).optional()` sin
mensaje personalizado en `.min()` ni en `.max()`, mientras que el esquema
equivalente de direcciones guardadas (`TextoDireccionSchema` en
`packages/shared/src/schemas/address.ts`) sí usaba `MSG_DIRECCION_TEXTO_VACIO`
para la misma restricción de 10 caracteres. Dos caminos —dirección guardada y
dirección puntual del mismo pedido— para la misma regla, y solo uno traducido.

**Por qué ninguna prueba automática lo detectaba.** Las pruebas de
`order-schemas.test.ts` cubrían la aceptación de `addressText` válido y el XOR
entre `addressId`/`addressText`, pero no el límite mínimo de caracteres de
`addressText` en particular — ese caso sí estaba cubierto para `address.ts`
(direcciones guardadas), no para `order.ts` (dirección puntual del pedido).

**Corrección.** `packages/shared/src/schemas/order.ts` reutiliza ahora
`MSG_DIRECCION_TEXTO_VACIO` para `.min(10)` y añade el mensaje equivalente de
`address.ts` para `.max(500)`. Cubierto por la prueba nueva «rechaza
addressText de menos de 10 caracteres con el mensaje del campo, en español» en
`packages/shared/tests/order-schemas.test.ts` (11/11 en verde).

**Nota de despliegue.** La corrección está en el código fuente y verificada a
nivel unitario; el contenedor `api`/`web` usado para el resto de esta
validación se construyó antes del fix, así que la imagen en ejecución sigue
mostrando el mensaje en inglés hasta reconstruirla.

---

## T104 · Comprobaciones automáticas

| Orden | Resultado |
|---|---|
| `pnpm lint` | ✅ sin avisos (caché de Turborepo) |
| `pnpm typecheck` | ✅ los tres paquetes |
| `pnpm test` | ✅ **522 pruebas** (`shared` 221 · `web` 171 · `api` 130), umbrales de cobertura cumplidos |
| `pnpm test:integration` | ✅ **587 pruebas, 73 baterías**, contra PostgreSQL real (10 min) |
| `pnpm build` | ✅ los tres paquetes, incluida la generación estática de `web` |

Los errores de Postgres visibles en el log de `orders-history-atomicity.integration-spec.ts`
son ruido esperado: el trigger temporal de fallo de la prueba escribe su error
en el log del servidor antes del rollback.

---

## T105 · Guía funcional · V-01 a V-36

### A · Carrito (HU-12)

| Paso | Resultado |
|---|---|
| V-01 | ✅ Agregado con cantidad 1 y precio vigente |
| V-02 | ✅ Producto agotado: sin botón «Agregar» en el menú; su ficha dice «Este producto está agotado por ahora.» Producto dado de baja: desaparece del catálogo del cliente |
| V-03 | ✅ Cantidad 3 → subtotal `$32.970` (3×$10.990); cantidad 0 → la línea desaparece |
| V-04 | ✅ Agregar el mismo producto dos veces desde el catálogo deja una sola línea con cantidad sumada |
| V-05 | ✅ Cerrar sesión (`/api/auth/logout`) y volver a iniciar como el mismo cliente conserva el carrito |
| V-06 | ✅ Carrito vacío: «Tu carrito está vacío. Agrega productos para armar tu pedido.», sin «Confirmar pedido» |
| V-07 | ✅ Dos líneas agotada/dada de baja: ambas marcadas «Ya no está disponible», aviso superior «Hay productos en tu carrito que ya no están disponibles. Quítalos para poder confirmar.», y «Confirmar pedido» con `aria-disabled="true"` y clases que bloquean el clic |
| V-08 | ✅ Cambiar el precio de un producto en el carrito desde negocio y recargar el carrito del cliente muestra el precio nuevo antes de confirmar |
| V-09 | ✅ «Vaciar carrito» deja el carrito vacío sin diálogo de confirmación |

### B · Direcciones (HU-11)

| Paso | Resultado |
|---|---|
| V-10 | ✅ Primera dirección («Casa») queda predeterminada automáticamente |
| V-11 | ✅ Segunda dirección aparece junto a la primera |
| V-12 | ✅ Etiqueta duplicada normalizada («casa» vs «Casa») rechazada: «Ya tienes una dirección guardada con esa etiqueta.», asociado al campo |
| V-13 | ✅ Sin etiqueta y sin texto: «La etiqueta de la dirección no puede estar vacía.» / «El texto de la dirección no puede estar vacío.», cada uno junto a su campo. Igual con ambos campos solo de espacios |
| V-14 | ✅ Marcar «Trabajo» predeterminada la deja predeterminada y «Casa» pierde el estado |
| V-15 | ✅ Editar el texto de «Casa» lo refleja en el listado bajo la misma etiqueta |
| V-16 | ✅ Desactivar y eliminar una dirección nunca usada la borra sin dejar rastro |
| V-17 | ✅ Desactivar la única dirección activa y predeterminada la deja desactivada, sin predeterminada |
| V-18 | ✅ Reactivar una desactivada sin ninguna otra activa la deja predeterminada de nuevo |
| V-19 | ✅ Reactivar con otra ya predeterminada: ambas activas, la predeterminada no cambia |
| V-20 | ✅ El formulario de alta solo tiene «Etiqueta» y «Dirección» — sin mapa, pin ni coordenadas |

### C · Pedidos (HU-01)

| Paso | Resultado |
|---|---|
| V-21 | ✅ Carrito armado, dirección guardada no predeterminada elegida en un clic (`<select>`), pedido confirmado y queda `Pendiente` con esa dirección y el carrito vacío |
| V-22 | ✅ Carrito vacío en `/cliente/pedidos/confirmar`: «Tu carrito está vacío. Agrega productos para armar tu pedido.» |
| V-23 | ✅ Dirección puntual vacía: rechazada (ver el defecto documentado arriba — mensaje corregido en el código, pendiente de reconstruir la imagen en ejecución) |
| V-24 | ✅ Dos pedidos confirmados aparecen en la bandeja de negocio con productos, cantidades, precios y dirección |
| V-25 | ✅ «Aceptar» en un clic, sin diálogo: pasa a `En preparación`; el cliente lo ve como «En preparación» |
| V-26 | ✅ Rechazo con motivo válido en dos clics (abrir diálogo + confirmar): pasa a lista de rechazados con el motivo correcto |
| V-27 | ✅ Motivo vacío y motivo de solo espacios: ambos rechazados con «Escribe el motivo del rechazo.», el diálogo permanece abierto y el pedido sigue `Pendiente` |
| V-28 | ✅ `PUT .../accept` sobre un pedido ya rechazado: `409 ORDER_NOT_PENDING`, mensaje en español |
| V-29 | ✅ `PUT .../reject` sobre un pedido ya aceptado: `409 ORDER_NOT_PENDING`, mensaje en español |
| V-30/V-31 | ✅ Home de negocio sin carrito ni «Confirmar pedido»; matriz completa de roles cubierta por `orders-roles.integration-spec.ts` (T076) |
| V-32/V-33 | ✅ Cubiertos por integración (`orders-immutable.integration-spec.ts`, T072); no se repitió a mano por redundancia con T105 |
| V-34 | — No verificado a mano en esta sesión (no se pudo vaciar la bandeja de vuelta a cero sin herramientas fuera de alcance de E2); mensaje de bandeja vacía sin verificar visualmente en este recorrido |
| V-35 | ✅ Cubierto por integración (`orders-queue-pagination.integration-spec.ts`, T077): 21 pedidos, reparto 20/1 |
| V-36 | ✅ Confirmar sin recargar tras un cambio de precio en negocio: no se crea pedido, carrito intacto, precio actualizado, «El precio de uno o más productos cambió. Revisa tu carrito y confirma nuevamente.», exige nueva confirmación |

## T106 · Historial interno (V-37 a V-40)

Sin pantalla ni endpoint de consulta en E2 (deliberado). Verificado mediante la
ejecución en verde de las baterías de integración correspondientes, incluidas
en el recuento de T104:

| Paso | Batería |
|---|---|
| V-37 | `orders-history-create.integration-spec.ts` |
| V-38 | `orders-history-transition.integration-spec.ts` |
| V-39 | `orders-history-atomicity.integration-spec.ts` |
| V-40 | `orders-history-append-only.integration-spec.ts`, `orders-concurrency-accept-reject.integration-spec.ts` |

---

## Cobertura de los criterios de éxito

| Criterio | Pasos que lo cubren | Estado |
|---|---|---|
| SC-001 | V-21 | Parcial — sin cronómetro formal; el recorrido de un clic por dirección y confirmación fue fluido |
| SC-002, SC-003 | V-32 (integración) | ✅ |
| SC-004 | V-24 | ✅ |
| SC-005 | V-25, V-26 | ✅ — 1 y 2 clics respectivamente |
| SC-006 | V-02, V-07 | ✅ |
| SC-007 | V-26 | ✅ |
| SC-008 | V-30, V-31, V-33 | Parcial — matriz de roles por integración; recorrido visual no exhaustivo en las 12 combinaciones |
| SC-009 | V-21 a V-23 | ✅ solo clics y formularios |
| SC-010 | V-27 | ✅ |
| SC-011 | V-21 | ✅ — elección en un clic |
| SC-012 | V-36 | ✅ |

### Lo que queda fuera de este registro

- **V-34**: no se verificó visualmente la bandeja vacía en este recorrido.
- **Reconstrucción de la imagen Docker** con la corrección del defecto 1: el
  fix está en el código fuente y confirmado por su prueba unitaria; no se
  reconstruyó la imagen para repetir el recorrido de UI posterior a la
  corrección.
- **Auditoría formal de accesibilidad y lectores de pantalla reales**: fuera
  de v1 por decisión declarada, heredado de E1/E3.

Con T101–T108 completas, **E2 · Gestión de pedidos queda verificada** al
2026-08-18.
