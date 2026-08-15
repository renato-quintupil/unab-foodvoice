# Contrato de dominio: `packages/shared`

Paquete TypeScript consumido **tanto por `apps/web` como por `services/api`**. Es la única fuente de verdad de los enums, las reglas de validación de forma y los mensajes fijos al usuario (D-005).

## Frontera del paquete

**Contiene**: enums, esquemas Zod, tipos inferidos, constantes de mensajes en español, la máquina de estados del pedido.

**No contiene**: acceso a base de datos, cliente Prisma, lógica de red, componentes de interfaz, ni ninguna dependencia con efectos secundarios. Todo su código debe poder ejecutarse en el navegador y en Node por igual. Su única dependencia de producción es `zod`.

## Estructura

```text
packages/shared/src/
├── enums/
│   ├── role.ts              Role, UserStatus, AdminAction
│   └── order-status.ts      OrderStatus
├── schemas/
│   ├── auth.ts              LoginSchema
│   ├── user.ts              CreateUserSchema, UpdateUserSchema,
│   │                        ChangeRoleSchema, ChangeStatusSchema,
│   │                        ResetPasswordSchema, PasswordSchema
│   └── query.ts             ListUsersQuerySchema, OrdersQuerySchema
├── messages/
│   └── es.ts                Textos fijos en español
├── order-state/
│   └── machine.ts           transicionesValidas()
├── search/
│   └── normalizar.ts        normalizarBusqueda(), escaparLike()
├── types/
│   └── api.ts               UserDto, SessionUser, Paginated<T>
└── index.ts                 Superficie pública del paquete
```

---

## Enums

```ts
export const Role = {
  CLIENTE: 'CLIENTE',
  NEGOCIO: 'NEGOCIO',
  REPARTIDOR: 'REPARTIDOR',
  ADMINISTRADOR: 'ADMINISTRADOR',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = { ACTIVO: 'ACTIVO', DESACTIVADO: 'DESACTIVADO' } as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
```

Los cuatro roles son un conjunto **cerrado y no extensible** por el usuario final (spec § Entidades Clave, RN-003). Un usuario tiene exactamente un rol vigente (RN-001).

`AdminAction` enumera las seis acciones registrables de FR-034.

---

## Esquemas de validación

Cada esquema declara sus mensajes de error **en español dentro del propio esquema**, de modo que el texto que ve el usuario sea literalmente el mismo lo valide el formulario o lo valide el servidor (Principio II, D-005).

### `PasswordSchema` — FR-032

```ts
const MAX_PASSWORD_BYTES = 72; // límite impuesto por bcrypt (D-002)

export const PasswordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .refine(
    (v) => new TextEncoder().encode(v).length <= MAX_PASSWORD_BYTES,
    'La contraseña no puede superar los 72 caracteres.',
  );
```

Entre 8 y 72 caracteres, **sin otras exigencias de composición** (FR-032). Se reutiliza en `CreateUserSchema` y en `ResetPasswordSchema`: una sola definición para las dos rutas que asignan contraseña (FR-009, FR-026, SC-016).

**Sobre el máximo de 72**: lo exige FR-032, y su origen es una restricción de bcrypt, que trunca su entrada a 72 bytes (D-002). Sin este límite, dos contraseñas que compartan sus primeros 72 bytes serían equivalentes para el sistema sin que nadie lo advirtiera. La medición es en **bytes UTF-8** y no en caracteres, porque el truncamiento de bcrypt ocurre en bytes: una contraseña de 72 caracteres acentuados supera el límite real. El mensaje al usuario habla de caracteres porque es lo que la persona percibe; la validación es exacta.

Este máximo **no aparece en `LoginSchema`**: al iniciar sesión no se valida longitud alguna, para no revelar por diferencia de mensaje ninguna característica de las credenciales almacenadas (FR-008).

### `LoginSchema` — FR-001

```ts
export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase()
    .email('Debes ingresar un correo electrónico válido.'),
  password: z.string().min(1, 'Debes ingresar tu contraseña.'),
});
```

La contraseña **no** se valida aquí contra el mínimo de 8 caracteres: hacerlo revelaría, por diferencia de mensaje, información sobre la longitud de las credenciales almacenadas. En el inicio de sesión, cualquier fallo produce el mismo `MSG_CREDENCIALES_INVALIDAS` (FR-008).

### `CreateUserSchema` — FR-009, FR-014

```ts
export const CreateUserSchema = z.object({
  fullName: z.string().trim().min(2, 'El nombre completo es obligatorio.').max(120),
  email:    z.string().trim().toLowerCase()
              .email('Debes ingresar un correo electrónico válido.'),
  phone:    z.string().trim().min(6, 'El teléfono es obligatorio.').max(20),
  password: PasswordSchema,
  role:     z.nativeEnum(Role, { errorMap: () => ({ message: 'Debes seleccionar un rol válido.' }) }),
});
```

Los cinco campos son obligatorios (FR-014, SC-005). La **unicidad del correo no se valida aquí** (FR-017): requiere consultar la base de datos, así que vive en el servicio de NestJS (D-005, frontera de responsabilidad).

### `UpdateUserSchema` — FR-010

Los tres campos de contacto, todos opcionales, con al menos uno presente. **No** admite `role`, `status` ni `password`: son acciones de impacto con endpoint y confirmación propios (FR-035).

### `ListUsersQuerySchema` — FR-015

```ts
export const ListUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  role:   z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  page:   z.coerce.number().int().min(1).default(1),
});
```

No expone `pageSize`: el tamaño de página es la constante `PAGE_SIZE = 20`, también definida en este paquete para que la interfaz y la API no puedan discrepar. `PAGE_SIZE` es su **única fuente**: ni los contratos, ni la interfaz, ni la API repiten el número 20 como literal.

Tampoco expone parámetros de ordenamiento: el orden del listado es fijo, `created_at DESC, id DESC`, y no es elegible por el usuario (D-016).

---

## Normalización de búsqueda

```ts
export function normalizarBusqueda(texto: string): string;
export function escaparLike(texto: string): string;
```

`normalizarBusqueda` aplica, en este orden: `normalize('NFD')` → eliminación de marcas combinantes (`/\p{Mn}/gu`) → minúsculas → colapso de espacios consecutivos → recorte. `á → a`, `ü → u`, **`ñ → n`**.

**Por qué vive aquí y no en el backend**: es la misma función la que construye la columna `search_normalized` al guardar un usuario y la que prepara el término que el administrador escribe. Si fueran dos implementaciones, bastaría con que uno de los dos lados cambiara para que un usuario presente en la base dejara de encontrarse — un fallo silencioso, sin error ni excepción, que solo se descubre cuando alguien no aparece en el listado.

`escaparLike` neutraliza `\`, `%` y `_` para que el término se busque literalmente. Se aplica **después** de normalizar.

La eñe se pliega a `n` deliberadamente (D-011): «Nuñez» y «Nunez» se encuentran mutuamente, en línea con el objetivo de FR-015 de que el administrador dé con la persona sin acertar la ortografía exacta. El nombre almacenado y mostrado conserva siempre su forma original; `search_normalized` es derivada y nunca se muestra.

---

## Mensajes fijos en español

```ts
export const MSG_CREDENCIALES_INVALIDAS = 'Correo electrónico o contraseña incorrectos.';
export const MSG_CUENTA_BLOQUEADA       = 'Demasiados intentos fallidos. Vuelve a intentarlo en 15 minutos.';
export const MSG_SIN_PERMISO            = 'No tienes permiso para acceder a esta función.';
export const MSG_SESION_EXPIRADA        = 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.';
export const MSG_SIN_RESULTADOS_USUARIOS = 'No hay usuarios que coincidan con los criterios seleccionados.';
export const MSG_SIN_RESULTADOS_PEDIDOS  = 'No hay pedidos para los filtros seleccionados.';
export const MSG_CORREO_YA_EXISTE        = 'Ya existe un usuario registrado con ese correo electrónico.';
export const MSG_AUTOPROTECCION          = 'No puedes desactivar tu propia cuenta ni cambiar tu propio rol.';
```

**Por qué son constantes y no literales dispersos**: SC-018 exige que el mensaje de bloqueo sea idéntico *palabra por palabra* para un correo registrado y para uno inexistente. Con dos literales escritos en dos ramas del código, esa igualdad depende de que nadie edite uno solo de los dos. Con una constante, es imposible que diverjan. El mismo razonamiento aplica a `MSG_CREDENCIALES_INVALIDAS` (FR-008) y a los mensajes de "sin resultados" (FR-015, FR-022, SC-020), que la spec exige unificar en toda la épica.

---

## Máquina de estados del pedido

```ts
export const OrderStatus = {
  CREADO: 'creado',
  EN_PREPARACION: 'en_preparacion',
  ASIGNADO_REPARTIDOR: 'asignado_repartidor',
  ENTREGADO: 'entregado',
  CERRADO: 'cerrado',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export function transicionesValidas(desde: OrderStatus): readonly OrderStatus[];
export function esTransicionValida(desde: OrderStatus, hacia: OrderStatus): boolean;
```

Transiciones, estrictamente lineales según el Principio XII:

```text
creado ──► en_preparacion ──► asignado_repartidor ──► entregado ──► cerrado
```

`cerrado` es terminal: `transicionesValidas('cerrado')` devuelve el conjunto vacío.

**Alcance en E1** (D-012): esta épica **solo consume** los nombres de los estados, para los filtros y las métricas de HU-10 (FR-023). No define la entidad `Pedido` ni persiste nada — eso pertenece a E4/E2 (Principio III). Vive aquí, y no en el backend, porque la máquina de estados debe ser compartida por frontend y backend, y porque HU-03 la define como única para todo el producto.

---

## Tipos de transporte

```ts
export type UserDto = {
  id: string; fullName: string; email: string;
  phone: string; role: Role; status: UserStatus; createdAt: string;
};

export type SessionUser = Pick<UserDto, 'id' | 'fullName' | 'email' | 'role'>;

export type Paginated<T> = {
  items: T[]; total: number; page: number; pageSize: number; totalPages: number;
};
```

**Ningún tipo expuesto por este paquete contiene la contraseña ni su hash** (FR-007, FR-016). `UserDto` es la única forma en que un usuario cruza la frontera de la API, lo que hace que la omisión sea estructural y no dependa de recordar excluir el campo en cada respuesta.

`SessionUser.role` proviene de la sesión, no de la fila del usuario: el cambio de rol rige desde el próximo inicio de sesión (FR-011, D-007).

---

## Pruebas del paquete

Vitest, sobre lógica pura (D-009):

- Cada esquema acepta las entradas válidas y rechaza las inválidas **con el mensaje en español exacto**.
- `PasswordSchema` rechaza 7 caracteres y acepta 8; rechaza 73 y acepta 72; y rechaza una contraseña de menos de 72 caracteres acentuados que supere los 72 bytes UTF-8 —el caso que delata si la validación mide caracteres en vez de bytes— (SC-016, D-002).
- La normalización del correo (recorte y minúsculas) es consistente en todos los esquemas.
- `transicionesValidas` cubre los cinco estados; `cerrado` es terminal.
- Los mensajes fijos existen y no están vacíos — impide que una constante se borre por accidente y rompa la igualdad que exige SC-018.
- `normalizarBusqueda` pliega acentos y la eñe, colapsa espacios y recorta; `escaparLike` neutraliza `%`, `_` y `\`. Se prueba con los casos de SC-021 —«MARÍA», «maria», «Nuñez» y «Nunez»— y con un término que contiene `%`, que debe encontrar solo a quien tenga ese carácter y no al padrón completo.
