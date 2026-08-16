# Modelo de datos: E3 · Administración de menú

Dos entidades nuevas —`category` y `product`— y un enum nuevo, `dimension`. **Ninguna tabla de
E1 cambia**: no se añaden columnas a `user`, `session`, `login_attempt_control` ni
`admin_audit_log`.

Se conservan las convenciones de E1: nombres de tabla y columna en `snake_case` singular,
cliente TypeScript en `camelCase` con `@map`/`@@map`, identificadores UUID v4, marcas de tiempo
`timestamptz(3)`, y sin borrado físico en ninguna entidad.

## Visión general

```text
          ┌───────────────────────────┐
          │  dimension (enum fijo)    │
          │  TIPO_COMIDA              │
          │  PERFIL_SALUD             │
          └─────────────┬─────────────┘
                        │ es un valor de la columna
                        ▼
          ┌───────────────────────────┐
          │  category                 │
          │  · dimension              │
          │  · name / name_normalized │
          │  · description            │
          │  · active                 │
          └───┬───────────────────┬───┘
              │                   │
  food_type_category_id   health_profile_category_id
     (NOT NULL)                (NOT NULL)
              │                   │
              ▼                   ▼
          ┌───────────────────────────┐
          │  product                  │
          │  · name / name_normalized │
          │  · description            │
          │  · ingredients (opcional) │
          │  · price (entero CLP)     │
          │  · active · available     │
          └───────────────────────────┘

  price_tier (Económico · Medio · Caro) — NO ESTÁ AQUÍ.
  Se deriva en cada consulta (FR-032, D-023); no hay columna ni tabla.
```

Las dos claves foráneas son **obligatorias**, y esa es la decisión central del modelo (D-024):
hace irrepresentable el estado que RN-011 prohíbe. Un producto sin clasificar, o con dos
categorías de la misma dimensión, no es un dato que el sistema rechace: es un dato que no se
puede escribir.

## Enum `dimension` — Dimensión de clasificación

| Valor | Nombre visible | Qué responde |
|---|---|---|
| `TIPO_COMIDA` | Tipo de comida | ¿Qué es este producto? |
| `PERFIL_SALUD` | Perfil de salud | ¿Cómo cae? |

Es un enum de PostgreSQL y de TypeScript, no una tabla (D-020, FR-001). No es administrable
por ningún rol: no se crea, no se edita, no se desactiva y no se reordena desde la aplicación.
Los nombres visibles viven en `packages/shared/src/messages/etiquetas.ts`; la base guarda el
identificador técnico.

Añadir una tercera dimensión sería una migración —enum, columna en `product`, desplegable y
filtro—, no una fila. Es la contrapartida aceptada de D-024.

## Entidad `category` — Categoría

Valor administrable de una dimensión. La crea, edita, desactiva y reactiva el rol negocio; los
demás roles solo la ven como filtro.

| Columna | Tipo | Reglas | Requisito |
|---|---|---|---|
| `id` | `uuid` PK | Generado por la aplicación (UUID v4) | — |
| `dimension` | `dimension` | Obligatoria. **No editable tras la creación** | FR-001, FR-006 |
| `name` | `text` | 2–60 caracteres, recortado. Se guarda tal como lo escribió el negocio | FR-003 |
| `name_normalized` | `text` | Derivada de `normalizarBusqueda(name)`. Única dentro de su dimensión | FR-004, D-021 |
| `description` | `text` | 30–500 caracteres, recortada. Cumple las tres condiciones de FR-039 | FR-003, FR-039 |
| `active` | `boolean` | `true` al crear. `false` la retira del uso sin borrarla | FR-002, FR-007, FR-008 |
| `created_at` | `timestamptz(3)` | — | — |
| `updated_at` | `timestamptz(3)` | — | — |

**Índices**:

- `UNIQUE (dimension, name_normalized)` — la unicidad es **por dimensión**, no global: expresa
  en una sola línea las dos mitades de la regla, que «Saludable» pueda existir a la vez como
  tipo de comida y como perfil de salud (HU14-E05) y no dos veces dentro de la misma
  (HU14-E04). Alcanza también a las desactivadas, para que su reactivación sea siempre posible
  (RN-014).
- `INDEX (dimension, active)` — sirve al desplegable del alta y al filtro del cliente, que
  siempre piden las categorías activas de una dimensión.

**Por qué `active` es un booleano y no un enum**, a diferencia de `user.status` en E1: la spec
de E3 nombra los estados del catálogo como interruptores (`activo`, `disponible`) y no prevé un
tercer valor. Un enum de dos valores no aportaría nada sobre un booleano y obligaría a
mantener un tipo más. El estado **visible** —«Activa» / «Desactivada»— se deriva en la
interfaz desde `etiquetas.ts`, nunca se guarda.

### Lo que la desactivación no hace

Desactivar una categoría **no modifica ningún producto** (RN-009, FR-011). Los que la tenían la
conservan. Solo puede ocurrir con productos dados de baja, porque FR-007 impide desactivar una
categoría de la que dependa un producto activo. La consecuencia es la regla de FR-021: ese
producto no se puede reactivar hasta reclasificarlo.

## Entidad `product` — Producto

| Columna | Tipo | Reglas | Requisito |
|---|---|---|---|
| `id` | `uuid` PK | Generado por la aplicación | — |
| `name` | `text` | 2–120 caracteres, recortado. Se guarda tal como se escribió | FR-013 |
| `name_normalized` | `text` | Derivada de `normalizarBusqueda(name)`. **Única en todo el catálogo** | FR-014, D-021 |
| `description` | `text` | 20–1.000 caracteres, recortada. Cumple FR-039 | FR-016, FR-039 |
| `ingredients` | `text` NULL | **Opcional**. Hasta 500 caracteres. `NULL` cuando no se declaran | FR-017 |
| `price` | `integer` | Entero en pesos chilenos, `1 ≤ price ≤ 10.000.000` | FR-015, D-026 |
| `food_type_category_id` | `uuid` FK → `category` | **Obligatoria**. Categoría de dimensión `TIPO_COMIDA` | FR-012, RN-011 |
| `health_profile_category_id` | `uuid` FK → `category` | **Obligatoria**. Categoría de dimensión `PERFIL_SALUD` | FR-012, RN-011 |
| `active` | `boolean` | `true` al crear. Está en el menú | FR-012, FR-020, RN-007 |
| `available` | `boolean` | `true` al crear. Se puede preparar ahora | FR-012, FR-019, RN-007 |
| `created_at` | `timestamptz(3)` | Fija el orden del listado de administración | FR-023 |
| `updated_at` | `timestamptz(3)` | — | — |

**Restricciones e índices**:

- `CHECK (price >= 1 AND price <= 10000000)` — segunda línea de defensa tras el esquema Zod:
  garantiza que ninguna vía de escritura —una migración, la semilla, una consulta a mano— deje
  un precio inválido (D-026).
- `UNIQUE (name_normalized)` — global, incluidos los dados de baja (RN-005).
- `INDEX (active, available)` — toda consulta del menú filtra por ahí.
- `INDEX (price)` — sirve a las dos consultas de corte de D-023.
- `INDEX (created_at DESC, id DESC)` — el orden del listado de administración, que debe ser
  estable para que la paginación sea determinista (FR-023).
- `INDEX (food_type_category_id)`, `INDEX (health_profile_category_id)` — el filtro por
  categoría y el conteo de bloqueadores de FR-007.

### Los dos interruptores

| | `active` | `available` |
|---|---|---|
| Qué significa | Está en el menú | Se puede preparar ahora |
| Estado visible si es `false` | **Dado de baja** | **Agotado** |
| Lo ve el cliente | No, por ningún medio | Sí, marcado |
| Se puede pedir | No | No |
| Cambia | Rara vez, con confirmación | Varias veces al día, sin confirmación |

Los tres estados visibles del producto —**Disponible**, **Agotado**, **Dado de baja**— se
derivan de esos dos booleanos y **no se guardan**. Un producto dado de baja conserva su
`available` tal como estaba; al reactivarse vuelve al estado disponible (FR-020).

### La invariante que el modelo no puede expresar solo

Las claves foráneas garantizan que ambas columnas apunten a una categoría existente, pero **no**
que cada una apunte a una categoría de **su** dimensión: PostgreSQL no expresa eso con una
clave foránea simple. Lo comprueba el servicio en toda escritura, y hay una batería de
integración que intenta guardar un producto cuyo `food_type_category_id` apunta a una categoría
de perfil de salud y espera el rechazo.

Tampoco expresa la base que las categorías de un producto **activo** estén activas. Es lo que
imponen FR-012 al dar de alta y FR-021 al reactivar, ambos en el servicio, y lo que hace que
FR-007 —no desactivar una categoría en uso— sea imprescindible: es la tercera pata que impide
llegar a ese estado por el otro lado.

## Transacciones

Tres operaciones exigen atomicidad. Fuera de ellas, cada escritura es una sentencia.

| Operación | Qué abarca la transacción | Por qué | Requisito |
|---|---|---|---|
| **Desactivar categoría** | Contar los productos activos que dependen de ella en su dimensión y, solo si el conteo es cero, aplicar `active = false` | Contar fuera permitiría dar de alta un producto entre el conteo y la escritura, dejando una categoría desactivada de la que depende un producto activo | FR-007, D-027 |
| **Alta y edición de producto** | Comprobar que ambas categorías existen, son de la dimensión correcta y están activas, y escribir | Una categoría desactivada entre la comprobación y la escritura produciría un producto activo con categoría inactiva | FR-012, FR-018 |
| **Reactivar producto** | Comprobar que ambas categorías siguen activas y aplicar `active = true` | Ídem, y es exactamente el caso de HU02-E15 | FR-021 |

La unicidad de nombres **no** se resuelve con transacciones sino con el índice único: el
servicio intenta escribir y traduce la violación del índice al error de negocio
correspondiente. Es lo que hace que un doble envío simultáneo produzca un solo registro sin
depender de que las dos peticiones se serialicen (SC-027).

## Tipos compartidos sin persistencia

### `PriceTier` — Tramo de precio

```text
ECONOMICO · MEDIO · CARO
```

Existe como enum en `packages/shared` **solo para nombrar el filtro** de la consulta y las
etiquetas visibles. **No hay columna, ni tabla, ni índice**: el tramo se deriva en cada
consulta a partir de la distribución de precios de los productos activos (FR-032, D-023). Que
no sea una entidad es la decisión de diseño central de HU-14: un tramo persistido envejece con
la inflación y obliga a recalcular todo el catálogo cada vez que cambia un precio.

Con menos de tres productos activos, o con todos al mismo precio, **no hay tramos**: cada
producto pertenece a los tres y una intención de precio no descarta ninguno (RN-016).

### `CategoryDto` y `ProductDto`

La forma en que las dos entidades cruzan la frontera de la API. `ProductDto` **no expone**
`updatedAt` —metadato operativo sin superficie funcional, mismo criterio que `UserDto` en E1—
ni `name_normalized`, que es un detalle de almacenamiento. Sí expone el estado derivado, para
que la interfaz no tenga que reimplementar la tabla de los dos interruptores. El detalle está
en [`contracts/shared.md`](./contracts/shared.md).

## Esquema Prisma (referencia)

```prisma
enum Dimension {
  TIPO_COMIDA
  PERFIL_SALUD
}

/// Valor administrable de una dimensión (HU-14). No hay borrado físico
/// (RN-004): `active = false` la retira del uso conservando su contenido.
model Category {
  id             String    @id @default(uuid()) @db.Uuid
  /// No editable tras la creación (FR-006): cambiarla movería de golpe todos
  /// los productos clasificados con ella a otra pregunta distinta.
  dimension      Dimension
  name           String
  /// Derivada de `normalizarBusqueda(name)` (D-021).
  /// ⚠️ Cambiar esa función exige una migración que repueble esta columna.
  nameNormalized String    @map("name_normalized")
  /// El dato que hará funcionar la búsqueda por voz de E6 (FR-003, FR-039).
  description    String
  active         Boolean   @default(true)
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  productsAsFoodType      Product[] @relation("foodType")
  productsAsHealthProfile Product[] @relation("healthProfile")

  /// La unicidad es por dimensión, no global (FR-004, RN-014).
  @@unique([dimension, nameNormalized])
  @@index([dimension, active])
  @@map("category")
}

/// Elemento del catálogo (HU-02). Nunca se borra (RN-004): un producto que
/// estuvo en un pedido debe seguir siendo legible en ese pedido para siempre.
model Product {
  id             String  @id @default(uuid()) @db.Uuid
  name           String
  /// Única en todo el catálogo, incluidos los dados de baja (RN-005).
  nameNormalized String  @unique @map("name_normalized")
  description    String
  /// Informativo, nunca una declaración de alérgenos (RN-019, FR-017).
  /// Su ausencia no significa que el producto no contenga el ingrediente.
  ingredients    String?
  /// Entero en pesos chilenos. La restricción de rango se añade en la
  /// migración; Prisma no la expresa en el esquema (D-026).
  price          Int

  /// Exactamente una categoría por dimensión, obligatoria (RN-011, D-024).
  /// Que sean columnas y no una tabla de unión hace irrepresentable el estado
  /// que la regla prohíbe. Que cada una apunte a su propia dimensión lo
  /// comprueba el servicio: la clave foránea no puede expresarlo.
  foodTypeCategoryId      String   @map("food_type_category_id") @db.Uuid
  healthProfileCategoryId String   @map("health_profile_category_id") @db.Uuid
  foodTypeCategory        Category @relation("foodType", fields: [foodTypeCategoryId], references: [id])
  healthProfileCategory   Category @relation("healthProfile", fields: [healthProfileCategoryId], references: [id])

  /// Está en el menú.
  active    Boolean  @default(true)
  /// Se puede preparar ahora. Si es false, el producto sigue visible,
  /// marcado «Agotado», y no se puede pedir (FR-029).
  available Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([active, available])
  @@index([price])
  @@index([createdAt(sort: Desc), id(sort: Desc)])
  @@index([foodTypeCategoryId])
  @@index([healthProfileCategoryId])
  @@map("product")
}
```

La restricción `CHECK (price >= 1 AND price <= 10000000)` se añade con SQL en la migración,
porque el esquema de Prisma no la expresa.

## Trazabilidad requisito → modelo

| Requisito | Elemento del modelo |
|---|---|
| FR-001, RN-013 | Enum `dimension`, fijo y no administrable |
| FR-002, FR-008 | `category.active` con valor inicial `true` |
| FR-003, FR-039 | `category.description` con sus límites y condiciones |
| FR-004, RN-014 | `UNIQUE (dimension, name_normalized)` |
| FR-006 | `category.dimension` no editable |
| FR-007, RN-015 | Conteo transaccional sobre los índices de clasificación |
| FR-009, RN-004 | Ausencia de toda operación de borrado en ambas entidades |
| FR-011, RN-009 | La desactivación no toca ninguna fila de `product` |
| FR-012, RN-011, RN-012 | Las dos claves foráneas obligatorias |
| FR-014, RN-005 | `UNIQUE (product.name_normalized)` |
| FR-015, RN-006 | `price integer` con `CHECK` |
| FR-016, FR-039 | `product.description` con sus límites y condiciones |
| FR-017, RN-019 | `product.ingredients` anulable |
| FR-019, RN-003 | `product.available` |
| FR-020, RN-008 | `product.active` |
| FR-022 | Reasignación de las dos claves foráneas |
| FR-023 | `INDEX (created_at DESC, id DESC)` y `name_normalized` para la búsqueda |
| FR-024, RN-010 | Ninguna columna histórica: el catálogo guarda el precio vigente y nada más |
| FR-028, FR-029, RN-018 | `active` y `available` como filtros de toda consulta de menú |
| FR-032, RN-016 | **Ausencia deliberada** de columna de tramo |
| FR-036 | Semilla que escribe sobre estas dos tablas |

## Elementos del modelo sin requisito

Se declaran para que ninguna columna quede sin justificar:

- **`created_at` y `updated_at` en ambas tablas**: metadatos operativos, con el mismo criterio
  que E1. `product.created_at` sí tiene requisito —fija el orden del listado (FR-023)—;
  `category.created_at`, `category.updated_at` y `product.updated_at` no aparecen en ninguna
  pantalla ni en ningún DTO. Existen porque diagnosticar un problema sin saber cuándo se tocó
  una fila es innecesariamente difícil, y su coste es nulo.
- **`INDEX (dimension, active)` en `category`**: no lo pide ningún requisito de forma explícita;
  sirve al desplegable del alta y al filtro del cliente, que son las dos consultas más
  frecuentes de la entidad.

## Lo que este modelo deja preparado para E2 y E6, sin construirlo

- **Para E2**: nada. FR-024 declara que el **pedido** guardará su propio precio; esa columna
  pertenece a la entidad `Pedido`, que E3 no crea ni toca. Lo único que E3 aporta es no
  reescribir nada hacia atrás.
- **Para E6**: las dos columnas `description`, con contenido exigido y validado. No hay columna
  de vectores, ni de sinónimos, ni de intención: todo eso está declarado fuera de alcance, y
  E6 leerá la prosa que esta épica garantiza que existe.
