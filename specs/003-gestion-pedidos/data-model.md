# Fase 1 · Modelo de Datos: E2 · Gestión de pedidos

Cinco tablas nuevas. **Ninguna tabla de E1 ni de E3 cambia de forma**; `product` y `category`
solo ganan relaciones entrantes (`CartLine.product`, `OrderLine.product`). El enum `OrderStatus`
de `packages/shared` y de Prisma se **amplía**, no se reemplaza (D-035).

## Diagrama de entidades

```text
User (E1) ──1:1── Cart ──1:N── CartLine ──N:1── Product (E3)
  │
  ├──1:N── Address
  │
  └──1:N── Order ──1:N── OrderLine ──N:1── Product (E3)
```

## `OrderStatus` (enum, ampliado)

```text
creado ─┬─→ en_preparacion → asignado_repartidor → entregado → cerrado
        └─→ rechazado   (terminal, sin transiciones salientes)
```

`rechazado` es alcanzable **únicamente** desde `creado` (RN-008, RN-010). Ninguna otra
transición de la máquina existente cambia; E2 solo construye las dos que salen de `creado`
(`FR-030`, `FR-031`) — el resto (`en_preparacion → asignado_repartidor`, etc.) queda declarado
para que `transicionesValidas` sea correcta, pero ningún endpoint de E2 las dispara.

## `Cart`

Uno por cliente, creado perezosamente (D-046). No expone endpoint de "crear": nace con la
primera línea.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | `UNIQUE`, FK → `user.id`, `onDelete: Restrict` |
| `created_at` | `timestamptz(3)` | |
| `updated_at` | `timestamptz(3)` | |

**Invariante**: como máximo un `Cart` por `user_id` — lo garantiza la restricción `UNIQUE`, no
una comprobación de aplicación.

## `CartLine`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `cart_id` | `uuid` | FK → `cart.id`, `onDelete: Cascade` |
| `product_id` | `uuid` | FK → `product.id`, `onDelete: Restrict` |
| `quantity` | `int` | `CHECK (quantity >= 1)` en la migración |

`@@unique([cartId, productId])` — es lo que hace FR-004 ("sumar cantidad a la línea existente")
una operación de base de datos (`upsert`) y no una búsqueda-y-decide de la aplicación. **No
congela nombre ni precio** (FR-006): el DTO se construye uniendo contra el `Product` vigente en
cada lectura, igual que el `MenuService` de E3 deriva `priceTier` en cada consulta.

`onDelete: Cascade` en `cartId` (no `Restrict`, a diferencia de todo lo demás en el esquema):
cuando el carrito se vacía o se consume al confirmar, sus líneas deben desaparecer con él —
es la única relación del producto con borrado físico en cascada, y es intencional porque
`CartLine` no es un registro histórico, es estado transitorio (§ Entidades Clave de la spec).

## `Address`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `user.id`, `onDelete: Restrict` |
| `label` | `text` | 2–60 caracteres (Supuesto 2) |
| `label_normalized` | `text` | `normalizarBusqueda(label)` (D-040) |
| `text` | `text` | 10–500 caracteres, saltos de línea permitidos |
| `is_default` | `boolean` | `DEFAULT false` |
| `active` | `boolean` | `DEFAULT true` |
| `used_in_order` | `boolean` | `DEFAULT false` (D-039) |
| `created_at` | `timestamptz(3)` | |
| `updated_at` | `timestamptz(3)` | |

`@@unique([userId, labelNormalized])` — alcanza a las desactivadas (D-040).
`@@index([userId, active])` — la consulta de "direcciones activas para elegir al confirmar".

**Invariantes que el servicio garantiza, no la tabla** (mismo criterio que
`exigirCategoriasUsables` de E3 — lo que una clave foránea no puede expresar, lo comprueba el
servicio dentro de una transacción):

- **A lo sumo una fila con `is_default = true` y `active = true` por `user_id`** (FR-015). No es
  una restricción `UNIQUE` parcial porque cambiar la predeterminada es "quitarle la marca a una y
  dársela a otra" en la misma transacción, no una operación que una restricción de fila pueda
  arbitrar sola.
- **`used_in_order` nunca vuelve a `false`.**
- **Eliminar (DELETE físico) exige `used_in_order = false`** (FR-019); si es `true`, la única
  operación disponible es desactivar (`active = false`), que conserva la fila (FR-018).

## `Order`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `user.id`, `onDelete: Restrict` |
| `status` | `OrderStatus` | `DEFAULT 'creado'` |
| `address_text` | `text` | Snapshot (FR-023, RN-006), copiado al confirmar |
| `rejection_reason` | `text?` | `NULL` salvo cuando `status = 'rechazado'` (FR-033) |
| `created_at` | `timestamptz(3)` | |
| `updated_at` | `timestamptz(3)` | |

`@@index([status, createdAt, id])` — sirve la bandeja del negocio (D-043): `WHERE status IN
('creado', 'en_preparacion') ORDER BY created_at ASC, id ASC`, con el desempate por `id` que hace
el orden total y evita que la paginación repita u omita filas si dos pedidos comparten marca de
tiempo (FR-041).

`@@index([userId, createdAt])` — el propio historial del cliente.

**Invariante de negocio, no de esquema**: `rejection_reason IS NOT NULL ↔ status = 'rechazado'`.
No se expresa como `CHECK` porque acoplaría el esquema a un solo valor del enum de una forma que
Prisma no modela limpiamente; el servicio la garantiza — es la misma decisión que E3 tomó con la
clasificación de dos categorías (D-024): la comprobación vive en el código porque expresarla en
SQL sería más complejo que el problema que resuelve, y ninguna vía de escritura evita el
servicio (RN-009: un pedido confirmado nunca se edita por ningún camino).

**Nunca se edita tras confirmarse** (FR-035, RN-009), salvo las dos transiciones de estado que
`NEGOCIO` dispara (`aceptar`/`rechazar`) y que también son las únicas dos escrituras posibles
sobre una fila de `Order` en toda la vida del producto hasta E5.

## `OrderLine`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `order_id` | `uuid` | FK → `order.id`, `onDelete: Restrict` |
| `product_id` | `uuid` | FK → `product.id`, `onDelete: Restrict` |
| `product_name` | `text` | Snapshot (FR-027) |
| `product_price` | `int` | Snapshot, pesos chilenos (FR-027) |
| `quantity` | `int` | `CHECK (quantity >= 1)` |

`onDelete: Restrict` en `orderId` (no `Cascade`, a diferencia de `CartLine.cartId`): una línea de
pedido es un registro **histórico** — nunca se borra junto con nada, porque el pedido tampoco se
borra nunca.

`product_name` y `product_price` son **copias inmutables**, no una unión en tiempo de lectura
como `CartLine`: es la diferencia central entre las dos tablas, y la razón por la que existen dos
tablas de línea en lugar de una compartida (§ Entidades Clave de la spec, RN-003 vs. FR-027).

`@@index([orderId])`.

## Fragmento de `schema.prisma` (delta sobre el existente)

```prisma
enum OrderStatus {
  CREADO
  EN_PREPARACION
  ASIGNADO_REPARTIDOR
  ENTREGADO
  CERRADO
  RECHAZADO
}

model Cart {
  id     String @id @default(uuid()) @db.Uuid
  userId String @unique @map("user_id") @db.Uuid

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  user  User       @relation(fields: [userId], references: [id], onDelete: Restrict)
  lines CartLine[]

  @@map("cart")
}

model CartLine {
  id        String @id @default(uuid()) @db.Uuid
  cartId    String @map("cart_id") @db.Uuid
  productId String @map("product_id") @db.Uuid
  quantity  Int

  cart    Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@unique([cartId, productId], map: "cart_line_cart_id_product_id_key")
  @@map("cart_line")
}

model Address {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @map("user_id") @db.Uuid
  label            String
  labelNormalized  String   @map("label_normalized")
  text             String
  isDefault        Boolean  @default(false) @map("is_default")
  active           Boolean  @default(true)
  usedInOrder      Boolean  @default(false) @map("used_in_order")
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt        DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([userId, labelNormalized], map: "address_user_id_label_normalized_key")
  @@index([userId, active], map: "address_user_id_active_idx")
  @@map("address")
}

model Order {
  id               String      @id @default(uuid()) @db.Uuid
  userId           String      @map("user_id") @db.Uuid
  status           OrderStatus @default(CREADO)
  addressText      String      @map("address_text")
  rejectionReason  String?     @map("rejection_reason")
  createdAt        DateTime    @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt        DateTime    @updatedAt @map("updated_at") @db.Timestamptz(3)

  user  User        @relation(fields: [userId], references: [id], onDelete: Restrict)
  lines OrderLine[]

  @@index([status, createdAt, id], map: "order_status_created_at_id_idx")
  @@index([userId, createdAt], map: "order_user_id_created_at_idx")
  @@map("order")
}

model OrderLine {
  id           String @id @default(uuid()) @db.Uuid
  orderId      String @map("order_id") @db.Uuid
  productId    String @map("product_id") @db.Uuid
  productName  String @map("product_name")
  productPrice Int    @map("product_price")
  quantity     Int

  order   Order   @relation(fields: [orderId], references: [id], onDelete: Restrict)
  product Product @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@index([orderId], map: "order_line_order_id_idx")
  @@map("order_line")
}
```

`User` gana `cart Cart?`, `addresses Address[]` y `orders Order[]`; `Product` gana `cartLines
CartLine[]` y `orderLines OrderLine[]`. Ninguna columna existente de esas dos tablas cambia.

## Restricciones SQL añadidas en la migración (fuera del esquema Prisma)

Mismo patrón que E3 (D-026: el rango de precio no se expresa en `schema.prisma`):

```sql
ALTER TABLE cart_line ADD CONSTRAINT cart_line_quantity_check CHECK (quantity >= 1);
ALTER TABLE order_line ADD CONSTRAINT order_line_quantity_check CHECK (quantity >= 1);
```

## Tipos de `packages/shared/src/types/api.ts` (delta)

```ts
export type CartLineDto = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  /** `false` cuando el producto dejó de estar `active && available` desde que se agregó (FR-007). */
  available: boolean;
};

export type CartDto = {
  lines: CartLineDto[];
};

export type AddressDto = {
  id: string;
  label: string;
  text: string;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
};

export type OrderLineDto = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
};

export type OrderSummaryDto = {
  id: string;
  status: OrderStatus;
  addressText: string;
  rejectionReason: string | null;
  lines: OrderLineDto[];
  createdAt: string;
};
```

`OrderDto` de E1 (`{ id, status, createdAt }`, usado por el reporte de HU-10) **no se toca**: es
la forma reducida que el panel de administrador sigue consumiendo. `OrderSummaryDto` es la forma
completa que E2 introduce para el cliente y el negocio — dos tipos con dos consumidores
distintos, igual criterio que `CategoryDto` vs. `CategoryRef` en E3.
