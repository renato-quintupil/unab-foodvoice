# Guía de puesta en marcha y validación: E2 · Gestión de pedidos

Esta guía sirve a dos propósitos: levantar la épica en local y **recorrer los 12 criterios de
éxito** uno por uno. Los pasos `V-01` a `V-36` validan la experiencia y `V-37` a `V-40`
comprueban automáticamente el historial interno exigido por FR-042–FR-044.

## Requisitos previos

Los mismos de E1 y E3, sin añadidos: Node.js 22 LTS, pnpm 9, Docker con Compose. **E2 no
introduce ninguna variable de entorno nueva** ni ninguna clave de servicio.

## Puesta en marcha

```bash
cp .env.example .env               # si aún no existe
pnpm install
docker compose up -d postgres
pnpm --filter api db:migrate       # aplica carrito, direcciones, pedidos e historial de estados
pnpm --filter api db:seed          # administrador de E1 + catálogo de E3, idempotente
pnpm dev                           # api :3001 · web :3000
```

Alternativa íntegra en contenedores: `docker compose up --build`.

Para la validación hace falta un usuario de rol **cliente** y uno de rol **negocio** —creados
desde el panel de administración de E1— y el catálogo activo de la semilla de E3.

## Comprobaciones automáticas

```bash
pnpm test              # unitarios; falla si no se cumplen los umbrales de cobertura
pnpm test:integration  # API contra PostgreSQL efímera en Docker
pnpm lint && pnpm typecheck && pnpm build
```

Deben pasar antes de empezar la validación funcional. E1 y E3 encontraron cada una **dos
defectos** que solo la validación manual detectó (`CLAUDE.md` § Estado del código): que las
cuatro comprobaciones pasen no es evidencia de que el flujo completo, de punta a punta, se vea y
se sienta como la spec promete.

## Validación funcional

### Preparación

Dos sesiones a la vez —dos navegadores, o uno normal y otro en ventana privada—: la del
**cliente** y la del **negocio**. Para SC-004 se comprueba que el pedido aparece al abrir la
bandeja después de confirmar o, si ya estaba abierta, tras una única recarga.

### A · Carrito (HU-12)

Con la sesión del **cliente**.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-01** | Agregar un producto activo y disponible al carrito | Aparece con cantidad 1 y el precio vigente |
| **V-02** | Intentar agregar un producto agotado, y luego uno dado de baja | El sistema lo impide en ambos casos, con mensaje en español |
| **V-03** | Subir la cantidad de una línea a 3, luego bajarla a 0 | El subtotal se actualiza; en 0 la línea desaparece |
| **V-04** | Agregar el mismo producto dos veces desde el catálogo | Una sola línea, con la cantidad sumada — no dos líneas |
| **V-05** | Cerrar sesión y volver a iniciar sesión como el mismo cliente | El carrito conserva los mismos productos y cantidades |
| **V-06** | Con el carrito vacío, abrir la pantalla de carrito | Mensaje en español indicando que está vacío; no hay forma de confirmar |
| **V-07** | Agregar dos productos disponibles; desde negocio agotar uno y dar de baja el otro; recargar el carrito e intentar confirmar | Las dos líneas quedan no disponibles, confirmar se bloquea y ninguno de los dos productos entra en un pedido |
| **V-08** | Con un producto en el carrito a un precio dado, cambiarle el precio desde negocio y recargar el carrito | El carrito muestra el precio nuevo, antes de confirmar |
| **V-09** | Vaciar el carrito con la acción explícita | Queda vacío |

### B · Direcciones (HU-11)

Con la sesión del **cliente**, en la pantalla de direcciones.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-10** | Sin direcciones guardadas, registrar "Casa" con un texto válido | Queda guardada y marcada predeterminada automáticamente |
| **V-11** | Registrar "Departamento de mi papá" | Ambas direcciones aparecen en la lista |
| **V-12** | Intentar guardar otra con etiqueta "casa" (minúscula) | Rechazo asociado al campo de la etiqueta |
| **V-13** | Intentar guardar sin etiqueta, y luego con el texto en blanco (solo espacios) | Rechazo asociado al campo, en ambos casos |
| **V-14** | Marcar "Trabajo" (una tercera dirección) como predeterminada | "Trabajo" queda predeterminada; "Casa" deja de estarlo |
| **V-15** | Editar el texto de "Casa" | La lista muestra el texto nuevo bajo la misma etiqueta |
| **V-16** | Desactivar una dirección que nunca se usó en un pedido, y comprobar si se puede eliminar | Se puede eliminar sin dejar rastro |
| **V-17** | Desactivar la única dirección activa y predeterminada | Queda desactivada; no hay predeterminada; el cliente puede registrar otra o usar una puntual |
| **V-18** | Reactivar una dirección desactivada sin ninguna otra activa | Vuelve a ofrecerse y queda predeterminada |
| **V-19** | Con otra dirección activa ya predeterminada, reactivar una desactivada | Ambas quedan activas; la predeterminada no cambia |
| **V-20** | Abrir el formulario de alta de dirección | Solo hay campos de texto para etiqueta y dirección — ningún mapa, pin ni coordenadas |

### C · Pedidos (HU-01)

Con las sesiones de **cliente** y **negocio** abiertas a la vez.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-21** | Cliente: solo con clics y formularios, armar carrito, elegir en un clic una dirección guardada no predeterminada y confirmar, cronometrando desde el inicio vacío | Menos de 2 minutos, sin ayuda técnica; el pedido queda `creado` con la dirección elegida y el carrito vacío |
| **V-22** | Con el carrito vacío, intentar confirmar | El sistema lo impide con mensaje en español |
| **V-23** | Con productos en el carrito pero sin ninguna dirección, intentar confirmar | El sistema lo impide y pide una dirección |
| **V-24** | Confirmar dos pedidos: abrir la bandeja después del primero; dejarla abierta antes del segundo y recargarla una vez | El primero aparece al abrir y el segundo tras esa única recarga, con productos, cantidades, precios y dirección |
| **V-25** | Negocio: aceptar un pedido contando los clics; cliente: abrir o recargar "mis pedidos" | 2 clics o menos; el pedido pasa a `en_preparacion` y el cliente ve "En preparación" |
| **V-26** | Confirmar y rechazar tres pedidos con motivos distintos, contando los clics de cada rechazo | Cada rechazo toma 2 clics o menos; los tres aparecen al cliente como "Rechazado" con el motivo correcto |
| **V-27** | Intentar rechazar un pedido primero con motivo vacío y luego con solo espacios | En 2 de 2 intentos aparece un mensaje en español y el pedido continúa "Pendiente" |
| **V-28** | Negocio: intentar aceptar un pedido ya rechazado | El sistema lo impide |
| **V-29** | Negocio: intentar rechazar un pedido ya aceptado | El sistema lo impide |
| **V-30** | Revisar las pantallas con rol cliente, repartidor y administrador | Ninguna ofrece acciones de aceptar o rechazar; la autorización de peticiones manipuladas queda cubierta por integración |
| **V-31** | Revisar las pantallas con rol negocio | No existe carrito ni acción de confirmar pedido para ese rol |
| **V-32** | Confirmar al menos tres pedidos; después cambiar nombres/precios de sus productos y editar o desactivar sus direcciones guardadas | Los 3 pedidos conservan nombre, precio y texto de dirección originales |
| **V-33** | Con pedidos en `creado`, `en_preparacion` y `rechazado`, recorrer las vistas disponibles para cliente, negocio, repartidor y administrador | En los 12 cruces estado/rol no existe acción para editar productos, cantidades ni dirección |
| **V-34** | Negocio: sin pedidos pendientes, abrir la bandeja | Mensaje en español explicando que no hay pedidos por ahora |
| **V-35** | Sembrar 21 pedidos pendientes con el script de prueba y recorrer las dos páginas | 20 en la primera, 1 en la segunda, del más antiguo al más reciente, sin repetidos ni omitidos |
| **V-36** | Cliente: dejar abierta la confirmación con varias líneas; negocio: cambiar el precio de una; cliente: confirmar sin recargar | No se crea pedido, el carrito conserva todas sus líneas, muestra el precio actualizado y exige confirmar nuevamente |

### D · Historial interno (integración)

No hay pantalla ni endpoint de consulta en E2. Estos pasos se ejecutan contra la base efímera de
integración y demuestran FR-042–FR-044 sin ampliar el contrato público.

| Paso | Qué ejecutar | Qué debe ocurrir |
|---|---|---|
| **V-37** | Confirmar un pedido y consultar sus eventos desde la prueba de integración | Existe exactamente un evento inicial `NULL → creado`, con cliente, rol y fecha |
| **V-38** | Aceptar un pedido y rechazar otro | Cada uno agrega exactamente un evento `creado → resultado` con el negocio actor |
| **V-39** | Forzar un fallo de inserción del evento durante creación y transición | Toda la operación revierte; en creación, además, el carrito permanece intacto |
| **V-40** | Competir aceptar/rechazar, luego intentar actualizar y borrar eventos | Hay un ganador y un solo evento nuevo; `UPDATE` y `DELETE` son rechazados |

## Cobertura de los criterios de éxito

| Criterio | Pasos que lo cubren | Cobertura automática |
|---|---|---|
| SC-001 | V-21 | Parcial — el cronómetro es manual |
| SC-002 | V-32 | Sí, con integración; recorrido manual de 3 pedidos |
| SC-003 | V-32 | Sí, con integración; recorrido manual de 3 pedidos |
| SC-004 | V-24 | Manual/e2e — cuenta una apertura o recarga |
| SC-005 | V-25, V-26 | Manual — cuenta de clics |
| SC-006 | V-02, V-07 | Sí, con integración |
| SC-007 | V-26 | Sí, con integración; recorrido manual de 3 pedidos |
| SC-008 | V-33 | Parcial — matriz visual manual y pruebas automáticas de ausencia de operaciones de edición |
| SC-009 | V-21 a V-23 | Manual por definición — solo clics y formularios |
| SC-010 | V-27 | Sí, con integración |
| SC-011 | V-21 | Manual — elección de dirección en un clic |
| SC-012 | V-36 | Sí, con integración y recorrido e2e |

### Cobertura del historial obligatorio

| Requisito | Pasos |
|---|---|
| FR-042 | V-37 |
| FR-043 | V-38 |
| FR-044 | V-39, V-40 |

Los criterios de tiempo, clics y paridad manual se comprueban mejor mediante una persona usando
la aplicación. Las invariantes internas del historial se comprueban por integración porque E2,
deliberadamente, todavía no publica su consulta; eso no añade un criterio de éxito invisible.
