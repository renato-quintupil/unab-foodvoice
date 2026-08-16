# Contrato HTTP: catálogo (E3)

Amplía la superficie declarada en
[`../../001-acceso-y-usuarios/contracts/api.md`](../../001-acceso-y-usuarios/contracts/api.md),
cuyas convenciones —formato de error, límite de cuerpo, versionado, fechas— rigen aquí sin
cambios. Prefijo común: `/api/v1`.

## Quién puede llamar a qué

| Grupo de rutas | Roles admitidos | Guard | Requisito |
|---|---|---|---|
| `/business/**` | **Solo `NEGOCIO`** | `SessionGuard` + `RolesGuard(NEGOCIO)` | FR-027, RN-001 |
| `/menu/**` | Los cuatro roles autenticados | `SessionGuard` | Supuesto 12 |

Dos precisiones que FR-027 exige y que no son decorativas:

1. **El rechazo se produce al procesar la acción, no al pintar la pantalla.** Ocultar la opción
   en la interfaz no cumple el requisito. Los guards se aplican en el controlador, de modo que
   la llamada directa al endpoint sin pasar por la interfaz recibe el mismo `403`.
2. **No hay menú público.** `/menu/**` exige sesión como todo lo demás; E1 no contempla ninguna
   pantalla accesible sin autenticarse y añadirla aquí sería alcance no pedido.

## Códigos de error que E3 añade

Se suman al catálogo cerrado de E1, sin modificar ninguno de los existentes.

| HTTP | `code` | Significado | Quién lo produce |
|---|---|---|---|
| 409 | `CATEGORY_NAME_ALREADY_EXISTS` | Ya existe una categoría con ese nombre en esa dimensión, activa o desactivada (FR-004) | `POST /business/categories`, `PATCH /business/categories/:id` |
| 409 | `PRODUCT_NAME_ALREADY_EXISTS` | Ya existe un producto con ese nombre, activo o dado de baja (FR-014) | `POST /business/products`, `PATCH /business/products/:id` |
| 409 | `CATEGORY_IN_USE` | La categoría es la única de su dimensión para al menos un producto activo (FR-007) | `PUT /business/categories/:id/status` |
| 409 | `CATEGORY_INACTIVE` | Alguna categoría del producto está desactivada (FR-012, FR-021) | `POST`/`PATCH /business/products`, `PUT /business/products/:id/status` |

Los cuatro son `409` porque describen un conflicto con el estado actual de los datos, no un
error de forma de la petición: el cuerpo es válido y el esquema lo aceptó. `VALIDATION_ERROR`
(400) sigue siendo el de los esquemas Zod, incluidas las tres condiciones de FR-039.

### El `409 CATEGORY_IN_USE` lleva el conteo

Es la única respuesta de error de la épica con un dato en el cuerpo además del mensaje:

```json
{
  "error": {
    "code": "CATEGORY_IN_USE",
    "message": "…",
    "blockingProducts": 3
  }
}
```

FR-007 exige decir **cuántos** productos activos bloquean la desactivación, «para que el
negocio sepa el tamaño del trabajo que tiene por delante y no descubra el problema producto a
producto». El `message` lo incorpora ya redactado —lo compone la constante correspondiente de
`packages/shared`—; `blockingProducts` va aparte para que la interfaz pueda usarlo sin analizar
el texto.

### El `409 CATEGORY_INACTIVE` nombra la dimensión

```json
{
  "error": {
    "code": "CATEGORY_INACTIVE",
    "message": "…",
    "fields": { "foodTypeCategoryId": "…" }
  }
}
```

FR-021 y SC-010 exigen que el mensaje **nombre la dimensión afectada**. Se envía además en
`fields` con la clave del campo correspondiente, de modo que el formulario pueda asociar el
error a su desplegable en lugar de mostrarlo suelto (FR-037).

---

## Categorías — HU-14

Todas bajo `/business/categories`, solo rol negocio.

### `GET /api/v1/business/categories`

Listado de administración (FR-010). **Sin paginación**: las categorías de un local se cuentan
por decenas como mucho, y ningún requisito la pide.

| Parámetro | Tipo | Por defecto |
|---|---|---|
| `dimension` | `TIPO_COMIDA` \| `PERFIL_SALUD` | Sin filtro: devuelve ambas |
| `active` | `boolean` | Sin filtro: **devuelve activas y desactivadas** |

Que las desactivadas aparezcan por defecto es deliberado y distinto del listado de productos:
FR-010 exige que sigan siendo visibles en la administración, y una categoría desactivada no
estorba una vista de decenas de filas como sí lo hace una baja en un catálogo paginado.

Respuesta `200`: `{ "items": CategoryDto[] }`. Orden: por dimensión y luego por nombre.

### `POST /api/v1/business/categories`

Crea una categoría (FR-002). Cuerpo: `CreateCategorySchema` — `dimension`, `name`,
`description`. Respuesta `201`: `CategoryDto`, ya `active`.

Errores: `400 VALIDATION_ERROR` (incluye las tres condiciones de FR-039),
`409 CATEGORY_NAME_ALREADY_EXISTS`.

### `PATCH /api/v1/business/categories/:id`

Edita **nombre y descripción** (FR-006). Cuerpo: `UpdateCategorySchema`. La **dimensión no es
editable**: el esquema no la acepta, y enviarla no produce un error sino que se descarta en
silencio, con la regla de E1 sobre campos desconocidos.

Errores: `400`, `404 NOT_FOUND`, `409 CATEGORY_NAME_ALREADY_EXISTS`.

### `PUT /api/v1/business/categories/:id/status`

Desactiva o reactiva (FR-007, FR-008). Cuerpo: `{ "active": boolean }`.

- Al **desactivar**, cuenta dentro de la misma transacción los productos activos que dependen
  de la categoría; si hay alguno, responde `409 CATEGORY_IN_USE` con `blockingProducts` y no
  aplica nada (D-027).
- Al **reactivar**, conserva nombre, descripción y dimensión.
- Poner el valor que ya tiene es **una petición sin efecto**, no un error: responde `200` con
  el estado actual. Es lo que FR-026 exige para que un doble envío no rompa nada.

**No existe `DELETE`**, en esta ni en ninguna otra ruta de la épica. FR-009 y SC-006 exigen que
no haya ninguna acción que elimine definitivamente, «en ninguna pantalla ni por ningún punto de
entrada»; que el verbo no exista es la forma más directa de cumplirlo.

---

## Productos — HU-02

Todas bajo `/business/products`, solo rol negocio.

### `GET /api/v1/business/products`

Listado de administración (FR-023). **Paginado de 20 en 20**, con la forma `Paginated<T>` que
E1 definió y el `PAGE_SIZE` compartido.

| Parámetro | Tipo | Por defecto |
|---|---|---|
| `search` | texto | Sin filtro. Coincidencia parcial sobre el nombre, sin distinguir mayúsculas ni acentos (D-022) |
| `status` | `DISPONIBLE` \| `AGOTADO` \| `DADO_DE_BAJA` | **Sin filtro: solo activos** (disponibles y agotados) |
| `categoryId` | uuid | Sin filtro. Vale para cualquiera de las dos dimensiones |
| `page` | entero ≥ 1 | 1 |

El valor por defecto de `status` es la tercera clarificación de la spec: sin filtro, el listado
**oculta los dados de baja**, porque el trabajo cotidiano del negocio es sobre el menú vigente.
Es la única diferencia de criterio con el listado de categorías, y responde a que aquí sí hay
paginación que las bajas ensuciarían.

Orden fijo: `created_at DESC, id DESC` (FR-023). No es elegible por el cliente, con el mismo
criterio de D-016 en E1: sin un orden declarado la paginación no es determinista.

### `POST /api/v1/business/products`

Alta (FR-012). Cuerpo: `CreateProductSchema` — `name`, `description`, `ingredients` (opcional),
`price`, `foodTypeCategoryId`, `healthProfileCategoryId`. Respuesta `201`: `ProductDto`, ya
`active` y `available` (RN-007).

Errores: `400 VALIDATION_ERROR`, `404 NOT_FOUND` si alguna categoría no existe,
`409 PRODUCT_NAME_ALREADY_EXISTS`, `409 CATEGORY_INACTIVE` si alguna está desactivada o
pertenece a la dimensión equivocada.

### `PATCH /api/v1/business/products/:id`

Edita nombre, descripción, ingredientes, precio y clasificación (FR-018, FR-022). Las reglas de
validación son **idénticas** a las del alta, de modo que ninguna edición pueda dejar un
registro en un estado que su alta habría rechazado.

El cambio de precio **rige hacia adelante** y no reescribe nada (FR-024). E3 no tiene ningún
dato histórico que tocar; el compromiso se declara aquí como contrato hacia E2.

### `PUT /api/v1/business/products/:id/availability`

Agotar y reponer (FR-019). Cuerpo: `{ "available": boolean }`.

Es la acción de dos clics desde el listado que SC-002 mide, y **la única de la épica sin
confirmación**: ocurre varias veces al día en medio del servicio, es inmediatamente reversible
y no destruye ningún dato. Poner el valor que ya tiene responde `200` sin efecto.

No comprueba las categorías: agotar un producto no cambia su clasificación ni lo activa.

### `PUT /api/v1/business/products/:id/status`

Dar de baja y reactivar (FR-020). Cuerpo: `{ "active": boolean }`.

- Al **dar de baja**, el producto desaparece del menú y sigue en la administración. `available`
  se conserva tal como estaba.
- Al **reactivar**, se comprueba dentro de la transacción que **ambas categorías sigan
  activas**; si alguna no lo está, responde `409 CATEGORY_INACTIVE` nombrando la dimensión y no
  aplica nada (FR-021, HU02-E15). Si pasa, el producto vuelve en estado disponible.

La confirmación explícita y cancelable que FR-020 exige es de la interfaz; el contrato solo
declara que la operación es reversible con la llamada contraria.

---

## Consulta del menú

Bajo `/menu`, para los cuatro roles autenticados. **Ninguna de estas rutas devuelve jamás un
producto no ofrecible** (RN-018): la regla vive en la consulta, no en la pantalla, de modo que
ninguna vía —incluida la futura de voz— pueda saltársela.

### `GET /api/v1/menu/categories`

Categorías **activas** de cada dimensión, para construir los filtros (FR-031). Las desactivadas
no aparecen (FR-011). Respuesta `200`: `{ "items": CategoryDto[] }`.

### `GET /api/v1/menu/products`

El menú (FR-028, FR-031, FR-032). **Sin paginación**: devuelve todos los productos activos que
cumplen los filtros, en una sola respuesta (D-029, FR-031).

| Parámetro | Tipo | Efecto |
|---|---|---|
| `foodTypeCategoryId` | uuid | Filtra por categoría de tipo de comida |
| `healthProfileCategoryId` | uuid | Filtra por categoría de perfil de salud |
| `priceTier` | `ECONOMICO` \| `MEDIO` \| `CARO` | Filtra por tramo derivado |

Los tres son combinables entre sí, y la combinación es **conjuntiva**: devuelve solo los
productos que cumplen todas las condiciones aplicadas y **nunca** sustituye el resultado por
productos que cumplan solo una parte (FR-035, SC-018). Cuando no hay resultados, la respuesta
es una lista vacía y el mensaje lo pone la interfaz.

```json
{
  "items": [ /* ProductDto[] */ ],
  "priceTiers": { "c1": 3500, "c2": 8000 }
}
```

`priceTiers` son los dos precios de corte vigentes, calculados sobre **todos** los productos
activos —incluidos los agotados (supuesto 2) y con independencia de los filtros aplicados—, o
`null` cuando no hay tramos porque hay menos de tres productos activos o todos valen lo mismo
(RN-016). Se devuelven para que la interfaz pueda mostrar a qué tramo pertenece cada producto
sin recalcular nada, y para que la comprobación de SC-016 y SC-017 sea observable.

**Qué no devuelve nunca**: productos con `active = false`, por ningún filtro y por ninguna vía
(FR-028, SC-005). Los agotados **sí** se devuelven, marcados en `ProductDto`, porque el cliente
debe seguir viéndolos (RN-003) — y ninguna respuesta ofrece acción alguna para pedirlos.

### `GET /api/v1/menu/products/:id`

Ficha de producto (FR-034). Respuesta `200`: `ProductDto`.

Responde `404 NOT_FOUND` cuando el producto no existe **o no está activo**, con exactamente el
mismo cuerpo en ambos casos (D-032). Responder algo distinto revelaría que el identificador
existe, que es justo lo que FR-028 evita al exigir que un producto dado de baja no aparezca «ni
accediendo directamente a su ficha por su dirección».

---

## El proxy de Next.js

Sin cambios respecto de E1: `apps/web` reenvía `/api/**` al servicio por la red interna de
Docker, propaga la cookie de sesión y traduce una caída del servicio a
`502 UPSTREAM_UNAVAILABLE`. Las rutas de esta épica no necesitan ningún tratamiento especial.

## Trazabilidad

### Cada endpoint contra su requisito

| Endpoint | Requisitos |
|---|---|
| `GET /business/categories` | FR-010 |
| `POST /business/categories` | FR-002, FR-003, FR-004, FR-039 |
| `PATCH /business/categories/:id` | FR-006 |
| `PUT /business/categories/:id/status` | FR-007, FR-008, FR-011 |
| `GET /business/products` | FR-023 |
| `POST /business/products` | FR-012 a FR-017, FR-039 |
| `PATCH /business/products/:id` | FR-018, FR-022, FR-024 |
| `PUT /business/products/:id/availability` | FR-019 |
| `PUT /business/products/:id/status` | FR-020, FR-021 |
| `GET /menu/categories` | FR-011, FR-031 |
| `GET /menu/products` | FR-028, FR-029, FR-031, FR-032, FR-033, FR-035 |
| `GET /menu/products/:id` | FR-028, FR-034 |
| Guards de `/business/**` | FR-027 |

### Requisitos que no son un endpoint

- **FR-005 y FR-016 (ayuda contextual)**: son de la interfaz. La API no participa.
- **FR-009 (no se borra)**: se cumple por la **ausencia** de todo verbo `DELETE`.
- **FR-025 (confirmación de éxito)**: la compone la interfaz a partir de la respuesta correcta.
- **FR-026 (doble disparo)**: el resguardo de interfaz deshabilita el control; el contrato
  aporta su mitad —el índice único rechaza el duplicado y la petición sin efecto responde
  `200`—.
- **FR-030, FR-035 (mensajes de vacío)**: la API devuelve una lista vacía; el texto es de la
  interfaz.
- **FR-037, FR-038 (accesibilidad y anchos)**: enteramente de la interfaz.

### Superficie deliberadamente vacía en E3

No existe ningún endpoint de **dimensiones**: no se crean, ni se editan, ni se listan desde la
API. Los dos valores son un enum del código compartido y la interfaz los conoce sin
preguntarlos (FR-001, D-020). Un endpoint de solo lectura para devolver dos constantes fijas
sería una llamada de red para obtener algo que ya está compilado en el cliente.

Tampoco existe ningún endpoint relacionado con la voz, con pedidos o con el carrito: los tres
pertenecen a otras épicas.
