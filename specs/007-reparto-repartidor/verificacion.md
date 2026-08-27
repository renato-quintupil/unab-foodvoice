# Registro de verificación: E5 · Reparto

**Fecha**: 2026-08-27 · **Ejecutado sobre**: `docker compose up --build` (api, web y postgres en
contenedores), con el catálogo y los pedidos de épicas anteriores ya sembrados en el volumen
`foodvoice_pgdata`. Usuarios de prueba creados desde el panel de administración para esta
validación: `repartidor-a@foodvoice.cl`, `repartidor-b@foodvoice.cl`, `cliente-reparto@foodvoice.cl`
(con teléfono `+56999998888`, para poder distinguirlo en las capturas) y `negocio-reparto@foodvoice.cl`.

Este documento recoge el resultado de T031–T032 de `tasks.md`: las cinco comprobaciones
automáticas y los catorce pasos V-01 a V-14 de `quickstart.md`, recorridos contra la aplicación
real, no contra el código.

**Aclaración sobre quién ejecutó el recorrido**: lo hizo Claude, manejando el navegador real
(Claude in Chrome: clics, formularios, cambios de sesión) contra los contenedores reconstruidos
con el código de esta épica — no lectura de código ni de logs, que es lo que el Principio IV
exige. La condición de carrera (V-05) se verifica con la prueba de integración de concurrencia
real, no manualmente — es lo que `quickstart.md` ya declara, porque disparar dos solicitudes HTTP
verdaderamente simultáneas no es algo que la interacción humana con un navegador pueda producir
de forma confiable.

---

## Resumen

| Tarea | Qué exige | Estado |
|---|---|---|
| T031 | `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | ✅ 146/146 pruebas unitarias de `services/api`, 238/238 de `packages/shared`, 220/220 de `apps/web` (con umbrales de cobertura, incluida la nueva `repartidor.test.tsx`); `tsc --noEmit` limpio en los tres paquetes; 86/86 baterías de integración en verde contra PostgreSQL real (633 pruebas), incluidas las seis nuevas de E5 |
| T032 | V-01 a V-14 de `quickstart.md` | ✅ Los 14 pasos ejecutados en vivo — **un defecto real encontrado y corregido antes de cerrar la épica** (ver abajo) |

---

## Un defecto real encontrado durante la propia validación

**V-04 falló en el primer recorrido**: la interfaz seguía ofreciendo el botón "Tomar" sobre
pedidos disponibles aunque el repartidor ya tuviera uno en curso. El servidor sí lo bloqueaba
(`409 DELIVERY_ALREADY_HAS_ORDER`), pero FR-004 exige que la interfaz **no ofrezca la acción en
absoluto**, no solo que la rechace al intentarla.

**Causa**: `PedidosDisponibles` y `PedidoEnCurso` se pedían de forma independiente en
`apps/web/src/app/repartidor/page.tsx`, sin que uno supiera del otro.

**Corrección**: `page.tsx` ahora hace una única consulta a `GET /delivery/orders/current` y
decide qué mostrar — la lista de disponibles **solo** si el repartidor no tiene ningún pedido en
curso; en caso contrario, únicamente su pedido en curso, sin ninguna lista debajo.
`PedidoEnCurso` pasó de pedir sus propios datos a recibir `order` como prop, evitando una segunda
llamada a la misma ruta. Se agregó una prueba unitaria (`apps/web/tests/repartidor.test.tsx`,
describe "Página del repartidor: una acción a la vez") que cubre ambos casos, y se reconstruyó la
imagen de `web` antes de continuar la validación. El resto de los catorce pasos se completó sin
encontrar ningún otro defecto — igual que E9 y E4 antes, el patrón se repite: cada pieza
funcionaba aislada (el 409 del servidor, la lista de disponibles, el pedido en curso) y aun así el
usuario no veía lo que la spec le promete hasta juntarlas.

---

## V-01 a V-14 · Guía funcional

### Preparación

Con la sesión de `cliente-reparto@foodvoice.cl` se confirmaron tres pedidos (Pizza Cuatro Quesos,
Pizza de Champiñones y Rúcula, Ensalada de Quinoa y Palta), los tres a "Los Aromos 123, depto
4B". Con la sesión de `negocio-reparto@foodvoice.cl` se **aceptaron** los tres (pasaron a
`en_preparacion`).

### A · Repartidor toma un pedido disponible (Historia 1, SC-001, SC-002, SC-004)

| Paso | Resultado |
|---|---|
| V-01 | ✅ Con la sesión de Repartidor A: la lista de disponibles muestra los tres pedidos nuevos (y los ya existentes de épicas anteriores), ninguno marcado como propio |
| V-02 | ✅ Un clic sobre "Tomar" (Ensalada de Quinoa y Palta): pasa a "Tu pedido en curso" con dirección, teléfono y producto; desaparece de disponibles |
| V-03 | ✅ Con la sesión de Repartidor B: la Ensalada ya no aparece como pedido individual disponible |
| V-04 | ⚠️→✅ **Encontró el defecto de arriba** en el primer recorrido — corregido, y reverificado: tras tomar un pedido (Pizza Cuatro Quesos), Repartidor B ya no ve ninguna lista de disponibles, solo su propio pedido en curso. Confirmado también a nivel de API: un segundo intento de `PUT .../take` sobre otro pedido responde `409 DELIVERY_ALREADY_HAS_ORDER` |

### B · Condición de carrera (Historia 1, SC-003)

| Paso | Resultado |
|---|---|
| V-05 | ✅ Cubierto por `services/api/test/delivery-orders-race.integration-spec.ts` (parte de las 633 pruebas de integración en verde de T031): dos repartidores tomando el mismo pedido — exactamente uno gana; el mismo repartidor tomando dos pedidos a la vez — exactamente uno gana, respaldado por el índice único parcial `order_one_active_delivery_per_user_key` |

### C · Repartidor consulta su pedido en curso (Historia 2, SC-006, SC-007)

| Paso | Resultado |
|---|---|
| V-06 | ✅ "Tu pedido en curso" de Repartidor A muestra el teléfono `+56999998888` del cliente de prueba |
| V-07 | ✅ Verificado en vivo contra la API real: `GET /delivery/orders/available` devolvió 6 pedidos, ninguno con el campo `customerPhone` (`algunoConTelefono: false`) |
| V-08 | ✅ `GET /cliente/pedidos/:id` de la Pizza Cuatro Quesos muestra la entrada nueva "Asignado a repartidor" con "Repartidor B · Repartidor" y su fecha — sin ningún cambio en la pantalla de trazabilidad de E4 |

### D · Repartidor suelta un pedido (Historia 3, SC-005)

| Paso | Resultado |
|---|---|
| V-09 | ✅ Diálogo de confirmación ("Soltar este pedido… puedes deshacer esta acción más adelante") antes de soltar (Principio IX); tras confirmar, Repartidor A vuelve a ver la lista de disponibles, sin ningún pedido en curso |
| V-10 | ✅ La Ensalada de Quinoa y Palta reapareció en disponibles de inmediato (recarga de la misma pantalla), muy por debajo de los 10 segundos de SC-005 |
| V-11 | ✅ El mismo Repartidor A la volvió a tomar sin ningún impedimento |
| V-12 | ✅ El detalle del pedido para el cliente muestra las **cinco** entradas en orden cronológico: creado → en_preparacion (negocio) → asignado_repartidor (Repartidor A) → en_preparacion (Repartidor A, el retroceso de la enmienda 3.0.0) → asignado_repartidor (Repartidor A, de nuevo) |

### E · Lo que el negocio no puede hacer (Edge Cases, FR-010, FR-011)

| Paso | Resultado |
|---|---|
| V-13 | ✅ `PUT /business/orders/:id/accept` sobre un pedido en `asignado_repartidor` responde `409 ORDER_NOT_PENDING` — el negocio no gana ninguna acción nueva sobre pedidos ya asignados |
| V-14 | ✅ Con sesión de negocio: `PUT /delivery/orders/:id/take`, `PUT /delivery/orders/:id/release` y `GET /delivery/orders/available` responden los tres `403` |

---

## Cobertura de los criterios de éxito

| Criterio | Pasos que lo cubren | Estado |
|---|---|---|
| SC-001 | V-02 | ✅ |
| SC-002 | V-01 a V-03 | ✅ |
| SC-003 | V-05 | ✅ |
| SC-004 | V-04 | ✅ (tras la corrección) |
| SC-005 | V-09, V-10 | ✅ |
| SC-006 | V-08, V-12 | ✅ |
| SC-007 | V-06, V-07 | ✅ |

### Lo que queda fuera de este registro

- **Auditoría formal de accesibilidad y lectores de pantalla reales**: fuera de v1 por decisión
  declarada, heredado de E1/E3/E2/E9/E4/E6.
- **Transiciones de E7** (`asignado_repartidor → entregado`, `entregado → cerrado`): no existen
  todavía; el mecanismo de trazabilidad de E4 ya queda preparado para mostrarlas sin cambios
  cuando E7 las agregue.

Con T031 y T032 completas, el defecto de V-04 corregido y reverificado, **E5 · Reparto queda
verificada** al 2026-08-27.
