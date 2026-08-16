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

**Las dos rutas son todas las rutas.** Una contraseña entra al sistema por exactamente dos caminos, y el inventario está cerrado:

| Camino | Esquema | Requisito |
|---|---|---|
| Alta de un usuario | `CreateUserSchema.password` | FR-009 |
| Restablecimiento por el administrador | `ResetPasswordSchema.password` | FR-026 |

No hay un tercero. `UpdateUserSchema` no admite `password` —lo que en un contrato menos explícito podría leerse como un olvido— y en v1 **no existe ninguna pantalla ni endpoint donde un usuario cambie su propia contraseña**, ni siquiera conociéndola, ni siquiera el administrador la suya (spec § Fuera de Alcance). Esa ausencia es deliberada y está declarada: el restablecimiento por el administrador es el único mecanismo de cambio después del alta. Que las dos rutas compartan `PasswordSchema` cierra el círculo —no hay forma de asignar una contraseña que esquive la validación de FR-032, porque no hay una tercera puerta que pudiera olvidarse de aplicarla—.

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
              .email('Debes ingresar un correo electrónico válido.')
              .max(254, 'El correo electrónico es demasiado largo.'),
  phone:    z.string().trim().min(6, 'El teléfono es obligatorio.').max(20),
  password: PasswordSchema,
  role:     z.nativeEnum(Role, { errorMap: () => ({ message: 'Debes seleccionar un rol válido.' }) }),
});
```

Los cinco campos son obligatorios (FR-014, SC-005). La **unicidad del correo no se valida aquí** (FR-017): requiere consultar la base de datos, así que vive en el servicio de NestJS (D-005, frontera de responsabilidad).

### `UpdateUserSchema` — FR-010

Los tres campos de contacto, todos opcionales, con al menos uno presente. Cada campo presente se valida **con exactamente las mismas reglas que en `CreateUserSchema`** —reutilizando sus definiciones, no repitiéndolas—, de modo que ninguna edición pueda dejar un usuario en un estado que su alta habría rechazado (FR-014). **No** admite `role`, `status` ni `password`: son acciones de impacto con endpoint y confirmación propios (FR-035).

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

### `OrdersQuerySchema` — FR-020

```ts
const FechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Debes ingresar una fecha con el formato AAAA-MM-DD.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00.000Z`)),
          'Esa fecha no existe.');

export const OrdersQuerySchema = z
  .object({
    status: z.nativeEnum(OrderStatus).optional(),
    from:   FechaSchema.optional(),
    to:     FechaSchema.optional(),
    page:   z.coerce.number().int().min(1).default(1),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to,
          { message: 'La fecha inicial no puede ser posterior a la final.', path: ['from'] });
```

Solo fecha, sin hora ni huso: el administrador filtra por días. La comparación `from <= to` funciona sobre las cadenas porque el formato `AAAA-MM-DD` ordena igual como texto que como fecha —una propiedad del formato ISO que evita convertir a `Date` solo para compararlas—.

Los dos extremos son **inclusivos** y se interpretan como días del calendario en el huso de referencia del producto. La conversión a un intervalo de instantes ocurre **en el servicio**, no aquí: este paquete valida la forma de la fecha y nada más. `FechaSchema` no comprueba que la fecha sea pasada ni acota la amplitud del rango (ver `api.md`).

El huso de referencia sí vive en este paquete, como constante:

```ts
export const HUSO_REFERENCIA = 'America/Santiago';
```

Está aquí, y no en el servicio, por la misma razón que `normalizarBusqueda`: la interfaz lo necesita para **mostrar** las fechas y el servidor para **interpretarlas**, y si cada lado tuviera el suyo, un reporte mostraría un día distinto del que consultó. Es una constante, no un ajuste por usuario: v1 no ofrece selección de huso (spec § Fuera de Alcance).

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
export const MSG_ERROR_INESPERADO        = 'No pudimos completar la operación. Vuelve a intentarlo en unos momentos.';
export const MSG_CONTRASENA_OLVIDADA     = 'Si olvidaste tu contraseña, solicita al administrador que te la restablezca.';
export const MSG_RANGO_FECHAS_INVALIDO   = 'La fecha inicial no puede ser posterior a la final.';
export const MSG_SIN_DATOS_PEDIDOS       = 'Todavía no hay pedidos registrados.';
```

Además, las **etiquetas visibles** de los enums y los textos de éxito, que la interfaz no puede escribir por su cuenta sin arriesgarse a que dos pantallas nombren distinto lo mismo (spec § Vocabulario visible):

```ts
export const ETIQUETA_ROL: Record<Role, string> = {
  CLIENTE: 'Cliente', NEGOCIO: 'Negocio',
  REPARTIDOR: 'Repartidor', ADMINISTRADOR: 'Administrador',
};

export const ETIQUETA_ESTADO: Record<UserStatus, string> = {
  ACTIVO: 'Activo', DESACTIVADO: 'Desactivado',
};

export const ETIQUETA_ESTADO_PEDIDO: Record<OrderStatus, string> = {
  creado: 'Creado', en_preparacion: 'En preparación',
  asignado_repartidor: 'Asignado a repartidor',
  entregado: 'Entregado', cerrado: 'Cerrado',
};

export const MSG_EXITO: Record<AdminAction, (nombre: string) => string> = {
  CREAR:                (n) => `Se creó el usuario ${n}.`,
  EDITAR:               (n) => `Se guardaron los datos de ${n}.`,
  CAMBIAR_ROL:          (n) => `Se cambió el rol de ${n}.`,
  DESACTIVAR:           (n) => `Se desactivó a ${n}.`,
  REACTIVAR:            (n) => `Se reactivó a ${n}.`,
  RESTABLECER_PASSWORD: (n) => `Se restableció la contraseña de ${n}.`,
};
```

`ETIQUETA_ROL` y `ETIQUETA_ESTADO` son la razón por la que los identificadores internos en mayúsculas **nunca** llegan a la pantalla: la interfaz no tiene ninguna otra forma de nombrar un rol, y no puede caer en mostrar `ADMINISTRADOR` por descuido. `MSG_EXITO` está indexado por `AdminAction`, de modo que las seis acciones registrables y los seis mensajes de éxito no puedan desalinearse: añadir una acción sin su mensaje deja de compilar (FR-037).

`MSG_ERROR_INESPERADO` cubre el `500` de la API y el `502` del proxy. Es **el mismo texto para ambos** a propósito: para la persona que lo lee, «el servicio falló» y «el servicio no respondió» son la misma situación y admiten la misma reacción, y distinguirlos en pantalla solo revelaría la topología interna del despliegue (Principio II).

`MSG_CONTRASENA_OLVIDADA` es el aviso permanente de la pantalla de inicio de sesión que exige FR-026. No es un mensaje de error: se muestra antes de cualquier intento fallido, y existe porque en v1 no hay autoservicio de contraseña y una pantalla que no lo diga deja a la persona reintentando hasta bloquearse la cuenta (FR-033).

**Esta lista es la única fuente de estos textos.** Ningún otro documento del proyecto —`api.md` incluido— reproduce su contenido: los referencian por el nombre de la constante. Un texto copiado en dos sitios es un texto que puede divergir, y la igualdad literal que exige SC-018 dejaría de estar garantizada por construcción para pasar a depender de que nadie edite solo una de las dos copias.

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

## Frontera de responsabilidad: qué valida Zod y qué validan los servicios

El criterio es uno solo y no admite matices: **Zod valida todo lo que puede decidirse mirando únicamente la petición; los servicios validan todo lo que exige consultar el estado del sistema.** Enunciado así, ninguna regla puede caer en los dos lados ni en ninguno, porque toda regla o necesita leer la base de datos o no la necesita.

| Regla | Dónde vive | Por qué |
|---|---|---|
| Campos obligatorios presentes (FR-014) | Zod | Se ve en la petición |
| Longitudes de nombre, teléfono y correo (FR-014) | Zod | Se ven en la petición |
| Formato del correo (FR-014) y su normalización (FR-001) | Zod | Se ve en la petición |
| Rango de 8 a 72 bytes de la contraseña (FR-032) | Zod | Se ve en la petición |
| Rol dentro de los cuatro valores (RN-001) | Zod | Se ve en la petición |
| `page` entero ≥ 1, formato de `from`/`to`, `from <= to` (FR-015, FR-020) | Zod | Se ven en la petición |
| Unicidad del correo (FR-017, RN-005) | Servicio + restricción única del motor | Exige consultar el padrón |
| Autoprotección del administrador (FR-027) | Servicio | Exige comparar con la sesión de quien llama |
| Existencia del usuario `:id` | Servicio | Exige consultar el padrón |
| Verificación de la contraseña (FR-001) | Servicio | Exige leer el hash almacenado |
| Bloqueo temporal vigente (FR-033) | Servicio | Exige leer el contador y el reloj |
| Validez de la sesión y rol suficiente (FR-003, FR-005) | Guards | Exigen leer la sesión |

Dos consecuencias se siguen de la frontera y conviene dejarlas escritas. La primera: **el frontend nunca podrá anticipar los errores de la columna inferior**. Un correo duplicado o una autoprotección solo se descubren al enviar la petición, y la interfaz debe estar preparada para mostrar un `409` sobre un formulario que ella misma había dado por válido. La segunda: **las reglas de la columna superior se validan dos veces**, en el navegador y en el servidor, con el mismo esquema y el mismo mensaje. Eso no es duplicación —es una sola definición aplicada en dos puntos— y es lo que permite que la validación del servidor sea autoritativa sin que el usuario tenga que enviar el formulario para enterarse de que le falta un campo.

## Compatibilidad de versiones del paquete

**No existe versionado independiente de `packages/shared`, y la pregunta de qué ocurre si `apps/web` y `services/api` se despliegan con versiones distintas no tiene respuesta porque no puede ocurrir.** Cuatro condiciones lo garantizan por construcción:

1. Ambos consumidores lo declaran como `"@foodvoice/shared": "workspace:*"`. pnpm resuelve esa especificación al código del propio repositorio, nunca a un artefacto publicado.
2. El paquete no se publica en ningún registro. No hay ningún lugar del que descargar una versión distinta de la que está en el árbol.
3. Turborepo compila `packages/shared` antes que sus dos consumidores en cada `build`, de modo que ambos se compilan contra el mismo código fuente.
4. Las tres imágenes se construyen del mismo commit y se levantan juntas en el mismo `docker compose`.

La consecuencia práctica es que un cambio incompatible en el paquete —renombrar una constante, cambiar la forma de un esquema— **rompe la compilación de sus consumidores en el acto**, en la máquina de quien lo hizo, en lugar de manifestarse como un fallo en tiempo de ejecución tras un despliegue parcial. Es el resultado deseado: el error aparece en el único momento en que es barato arreglarlo.

Lo que sí exige atención es el caso inverso, y queda declarado aquí porque no es evidente: `normalizarBusqueda` alimenta una columna **persistida** (`search_normalized`, D-011). Cambiar esa función no rompe ninguna compilación, pero deja los datos ya guardados calculados con la versión anterior, y unos usuarios se encontrarán y otros no sin patrón visible. Por eso toda modificación de esa función **debe** ir acompañada de una migración que repueble la columna entera. Es la única parte de este paquete cuyo cambio tiene efectos que el compilador no puede detectar.

## Pruebas del paquete

Vitest, sobre lógica pura (D-009):

- Cada esquema acepta las entradas válidas y rechaza las inválidas **con el mensaje en español exacto**.
- `PasswordSchema` rechaza 7 caracteres y acepta 8; rechaza 73 y acepta 72; y rechaza una contraseña de menos de 72 caracteres acentuados que supere los 72 bytes UTF-8 —el caso que delata si la validación mide caracteres en vez de bytes— (SC-016, D-002).
- La normalización del correo (recorte y minúsculas) es consistente en todos los esquemas.
- `transicionesValidas` cubre los cinco estados; `cerrado` es terminal.
- Los mensajes fijos existen y no están vacíos — impide que una constante se borre por accidente y rompa la igualdad que exige SC-018.
- `OrdersQuerySchema` acepta `AAAA-MM-DD`, rechaza `15-08-2026`, rechaza el día inexistente `2026-02-30`, acepta `from = to`, rechaza `from > to` y acepta cada extremo por separado (FR-020).
- `UpdateUserSchema` aplica a cada campo presente las mismas reglas que `CreateUserSchema` —el test compara ambos resultados sobre las mismas entradas inválidas—, y rechaza un cuerpo sin ningún campo (FR-010, FR-014).
- `normalizarBusqueda` pliega acentos y la eñe, colapsa espacios y recorta; `escaparLike` neutraliza `%`, `_` y `\`. Se prueba con los casos de SC-021 —«MARÍA», «maria», «Nuñez» y «Nunez»— y con un término que contiene `%`, que debe encontrar solo a quien tenga ese carácter y no al padrón completo.
