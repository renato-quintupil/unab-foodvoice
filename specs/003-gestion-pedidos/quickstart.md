# Guía de puesta en marcha y validación: E2 · Gestión de pedidos

Esta guía sirve a dos propósitos: levantar la épica en local y **recorrer los 12 criterios de
éxito** uno por uno. Los pasos de validación llevan identificador estable (`V-nn`) y la tabla
final los enlaza con su criterio.

## Requisitos previos

Los mismos de E1 y E3, sin añadidos: Node.js 22 LTS, pnpm 9, Docker con Compose. **E2 no
introduce ninguna variable de entorno nueva** ni ninguna clave de servicio.

## Puesta en marcha

```bash
cp .env.example .env               # si aún no existe
pnpm install
docker compose up -d postgres
pnpm --filter api db:migrate       # aplica la migración de carrito, direcciones y pedidos
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
**cliente** y la del **negocio**. La mitad de esta épica consiste en confirmar que lo que hace
uno aparece de inmediato en lo que ve el otro (SC-004).

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
| **V-07** | Con un producto en el carrito, marcarlo agotado desde la sesión de negocio y recargar el carrito del cliente | La línea queda marcada como no disponible; el botón de confirmar se bloquea |
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
| **V-21** | Cliente: armar carrito, elegir dirección y confirmar, cronometrando desde el inicio vacío | Menos de 2 minutos, sin ayuda técnica; el pedido queda `creado` y el carrito vacío |
| **V-22** | Con el carrito vacío, intentar confirmar | El sistema lo impide con mensaje en español |
| **V-23** | Con productos en el carrito pero sin ninguna dirección, intentar confirmar | El sistema lo impide y pide una dirección |
| **V-24** | Negocio: revisar la bandeja de pedidos pendientes | Ve el pedido de V-21 con productos, cantidades, precios y dirección — en la siguiente carga de pantalla, sin recargar dos veces |
| **V-25** | Negocio: aceptar el pedido, cronometrando los clics | 2 clics o menos; el pedido pasa a `en_preparacion`; el cliente ve "En preparación" en su siguiente carga |
| **V-26** | Cliente: confirmar un segundo pedido; negocio: rechazarlo con un motivo | El pedido pasa a "Rechazado" con el motivo visible para el cliente, sin que el negocio avise por otro medio; desaparece de la cola de pendientes |
| **V-27** | Negocio: intentar rechazar un pedido sin escribir motivo | El sistema lo impide con mensaje en español |
| **V-28** | Negocio: intentar aceptar el pedido ya rechazado de V-26 | El sistema lo impide |
| **V-29** | Negocio: intentar rechazar el pedido ya aceptado de V-25 | El sistema lo impide |
| **V-30** | Cliente: intentar aceptar o rechazar cualquier pedido (llamando al endpoint o buscando la opción) | El sistema lo impide con mensaje en español |
| **V-31** | Negocio: intentar confirmar un pedido a partir de un carrito | El sistema lo impide — el negocio no tiene carrito |
| **V-32** | Confirmar un pedido con un producto a un precio dado; cambiar después su precio desde negocio; volver a mirar el pedido ya confirmado | Sigue mostrando el precio original |
| **V-33** | Con el pedido de V-21 en cualquier estado, buscar alguna forma de editar sus productos, cantidades o dirección | No existe ninguna |
| **V-34** | Negocio: sin pedidos pendientes, abrir la bandeja | Mensaje en español explicando que no hay pedidos por ahora |
| **V-35** | Sembrar 21 pedidos pendientes (script de prueba) y recorrer las dos páginas de la bandeja | 20 en la primera, 1 en la segunda, del más antiguo al más reciente, sin repetidos ni omitidos |
| **V-36** | Cliente: revisar el carrito; negocio: cambiar el precio de un producto del carrito; cliente: confirmar con el precio anterior (usando un cliente HTTP, sin recargar la pantalla) | No se crea ningún pedido, el carrito no se vacía, y la siguiente carga del carrito muestra el precio actualizado |

## Cobertura de los criterios de éxito

| Criterio | Pasos que lo cubren | Cobertura automática |
|---|---|---|
| SC-001 | V-21 | Parcial — el cronómetro es manual |
| SC-002 | V-32 | Sí, con integración |
| SC-003 | Escenario HU11-E09 de la spec, cubierto por integración | Sí |
| SC-004 | V-24 | Parcial — la latencia se observa a ojo |
| SC-005 | V-25 | Parcial — el cronómetro y el conteo de clics son manuales |
| SC-006 | V-02, V-07 | Sí, con integración |
| SC-007 | V-26 | Sí |
| SC-008 | V-33 | Sí |
| SC-009 | V-21 a V-23 (sin usar voz en ningún paso) | Manual por definición — no hay voz en E2 |
| SC-010 | V-27 | Sí, con integración |
| SC-011 | V-14 (elegir "Trabajo" en un clic al confirmar un pedido) | Manual — cuenta de clics |
| SC-012 | V-08, V-36 | Sí, con integración |

Los criterios sin cobertura automática **no son un vacío de la implementación**: SC-001, SC-005,
SC-009 y SC-011 son experiencias que un cronómetro o un contador de clics de una persona mide
mejor que una aserción — mismo criterio que E1 y E3 declararon para sus propios criterios de
tiempo y de clics.
