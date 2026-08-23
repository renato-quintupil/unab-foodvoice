# Registro de verificación: E1 · Acceso y usuarios

**Fecha**: 2026-08-15 · **Ejecutado sobre**: `docker compose up --build`, los tres
servicios sanos, con el administrador semilla creado.

Este documento recoge el resultado de las tareas de verificación de la Fase 6
(T122 a T128). **Distingue lo comprobado de lo pendiente**, porque una tabla que
no lo hiciera convertiría «no se verificó» en «se verificó y salió bien».

**Estado al 2026-08-15: las siete están ejecutadas y no queda ninguna
pendiente.** Las tres que exigían una persona —T122, T123 y T126— se recorrieron
ese mismo día, T126 con las esperas reales de 15 y 30 minutos. Lo único que
sigue fuera es lo que la propia spec excluye de v1: la auditoría formal de
accesibilidad y las pruebas con lectores de pantalla reales.

**Actualización 2026-08-23**: la verificación funcional de las métricas y
reportes de pedidos, condicionada a que existieran pedidos (E4/E2), quedó
cerrada por los pasos V-11 y V-12 de
[`specs/005-trazabilidad-pedido/verificacion.md`](../005-trazabilidad-pedido/verificacion.md):
con dos pedidos reales (uno aceptado, uno rechazado), el panel mostró
"En preparación: 1" y "Rechazado: 1" —coincidiendo exactamente— y el reporte
filtrado por estado y por rango de fechas devolvió exactamente los pedidos
esperados. FR-019, FR-020 y SC-006 quedan así verificados en su totalidad.

---

## Resumen

| Tarea | Qué exige | Estado |
|---|---|---|
| T122 | Accesibilidad contra las cuatro condiciones de FR-039 | ✅ Auditado en código y recorrido con teclado en A19 y B25 |
| T123 | Desde 360 px y sobre cuatro navegadores | ✅ Auditado en código y comprobado en navegador |
| T124 | Inventario de mensajes visibles | ✅ Inventariado y leído en E1 |
| T125 | Las cinco comprobaciones automáticas, sin caché | ✅ Las cinco en verde |
| T126 | Guía funcional A, B, C y E, por una persona no técnica | ✅ **Ejecutada**, con las esperas reales de 15 y 30 minutos |
| T127 | Verificación técnica de la sección D | ✅ Ejecutada contra el sistema real |
| T128 | Las dos tablas de cobertura | ✅ Recorridas · los 39 criterios verificados |

---

## T125 · Comprobaciones automáticas

Ejecutadas con `--force`, es decir **con la caché de Turborepo deshabilitada**:
un resultado en verde recuperado de la caché sería una afirmación sobre una
ejecución pasada, no sobre el código de ahora (architecture CHK006).

| Orden | Resultado |
|---|---|
| `pnpm test` | ✅ 235 pruebas · `packages/shared` 100 %, `services/api` 99,5 %, `apps/web` 87,6 % |
| `pnpm test:integration` | ✅ **180 pruebas, 19 baterías**, contra PostgreSQL real |
| `pnpm lint` | ✅ sin avisos |
| `pnpm typecheck` | ✅ los tres paquetes |
| `pnpm build` | ✅ en contenedor · ⚠️ ver la nota de Windows |

**Nota sobre `pnpm build` en Windows.** El paquete compartido y la API compilan
sin más. `apps/web` **compila correctamente** —«Compiled successfully», tipos
válidos, páginas generadas— pero falla al final, al copiar la salida
`standalone`, porque Windows no permite crear enlaces simbólicos sin el modo de
desarrollador activado. **No es un defecto del código**: la misma orden dentro
del contenedor Linux termina bien, y de hecho la imagen de `web` se construye y
arranca. Quien necesite ejecutar `pnpm build` en Windows debe activar el modo de
desarrollador, o construir con `docker compose build`.

---

## T127 · Verificación técnica (sección D)

Ejecutada con la aplicación en pie, consultando la base de datos y el registro
del contenedor.

| # | Qué se comprobó | Resultado |
|---|---|---|
| D1 | La contraseña se almacena con bcrypt | ✅ `$2b$12$…`, 60 caracteres — **coste 12** (SC-027, comprobación 1) |
| D2 | Ninguna respuesta devuelve la contraseña ni su hash | ✅ `UserDto` no tiene el campo; el listado y el alta lo confirman (SC-027, comprobación 2) |
| D3 | La bitácora registra actor, afectado, acción e instante | ✅ Cinco columnas y ninguna más |
| D4 | Ninguna columna guarda datos personales | ✅ Sin nombre, correo, teléfono ni valores anteriores |
| D5 | Los usuarios van por referencia | ✅ Dos claves foráneas con `ON DELETE RESTRICT` |
| D6 | Los eventos de autenticación no dejan entrada | ✅ Tres fallos, un acierto y un bloqueo: la bitácora sigue con una sola entrada, la del alta |
| D7 | `apps/web` no sondea la API | ✅ Ningún `setInterval`, y una regla de ESLint lo impide (T075) |
| D8 | La recuperación deja actor igual al afectado | ✅ Verificado en `seed.integration-spec.ts` |
| D9 | Ningún secreto en el registro | ✅ Cero apariciones de la contraseña semilla, la del usuario, el prefijo del hash, la contraseña de PostgreSQL, la cadena de conexión y el valor de la cookie (SC-027, comprobación 3) |
| D10 | Una línea por petición con verbo, ruta, estado y duración | ✅ `POST /api/v1/auth/login 401 184ms` |
| D11 | `UPDATE` directo sobre la bitácora falla | ✅ `ERROR: admin_audit_log es de solo inserción (FR-034)` |
| D12 | `DELETE` directo sobre la bitácora falla | ✅ Mismo error, desde el motor |
| D13 | Un rol no administrador recibe 403 invocando la ruta directamente | ✅ `403 FORBIDDEN` con `MSG_SIN_PERMISO`, sin pasar por la interfaz |
| D14 | El panel no expone verbos de escritura | ✅ `POST`, `PUT`, `PATCH` y `DELETE` responden 404: las rutas no existen |

Comprobado además el **ciclo completo por la aplicación**, no por la API
directa: inicio de sesión del administrador (200), panel de métricas (200, con
los cuatro roles y los cinco estados presentes, incluidos los ceros), reporte de
pedidos filtrado por rango (200, lista vacía por diseño), cierre de sesión (204)
y **reutilización de la cookie cerrada, rechazada con 401** (SC-030).

Comprobado además, aunque la sección no lo enumere: **desactivar a un usuario
revoca su sesión en el acto** (FR-024) —su siguiente petición recibió `401`— y
**solo `web` publica puerto**; `api` y `postgres` quedan en la red interna
(D-006, D-013).

---

## T122 · Accesibilidad (FR-039, SC-038)

Las cuatro condiciones, auditadas sobre el código de las diez pantallas.

| Condición | Cómo se satisface | Estado |
|---|---|---|
| Recorrido completo por teclado, **incluidos los diálogos** | Los diálogos son `AlertDialog` de Radix, que atrapa el foco, cierra con `Esc` y lo devuelve al control que lo abrió. No hay ningún control construido sobre `div` con `onClick`: todos son `button`, `a`, `input` o `select` nativos | ✅ |
| Foco siempre visible | `:focus-visible` con contorno de 2 px y separación, declarado **una vez en `globals.css`** y no por componente, de modo que ningún control pueda quedarse sin él por descuido | ✅ |
| Cada campo con etiqueta asociada, y su error asociado al campo | Todos los campos usan `<Label htmlFor>` con `id` correspondiente; los erróneos llevan `aria-invalid` y `aria-describedby` apuntando al párrafo del error. Verificado por prueba en `login.test.tsx`, `usuarios.test.tsx` y `filtros.test.tsx` | ✅ |
| Contraste suficiente | Texto `#18181b` sobre `#ffffff` (16,1:1), texto tenue `#52525b` sobre blanco (7,6:1), y blanco sobre el primario `#b91c1c` (6,8:1). Los tres superan el 4,5:1 de AA | ✅ |

Además: `lang="es"` en la raíz, para que un lector de pantalla pronuncie el
español; `role="status"` con `aria-live` en el aviso de acción en curso; y
`<caption class="sr-only">` en las dos tablas.

**Ejecutado el 2026-08-15**: el recorrido solo con teclado de los pasos A19 y
B25. Sigue **fuera del alcance de v1** el recorrido con lector de pantalla real,
que FR-039 excluye expresamente junto con la auditoría formal de conformidad.

La auditoría de código decía que las condiciones estaban implementadas; no decía
que lo estuvieran bien. De hecho no lo estaban: la convergencia posterior
encontró que el mensaje de error se pintaba junto al campo pero **sin quedar
asociado a él** —ningún `aria-describedby`—, de modo que quien no ve la pantalla
enfocaba el campo y no oía por qué había fallado. Se corrigió en **T133**,
extrayendo el patrón a un único componente que entrega los atributos al control
en lugar de esperar que cada formulario los recuerde. Vale la pena dejarlo
escrito: una auditoría contra una lista de condiciones puede dar por buena una
condición que se cumple a medias, y aquí la mitad que faltaba era justamente la
que sirve a quien no mira la pantalla.

---

## T123 · Tamaños de pantalla y navegadores (FR-040)

| Condición | Cómo se satisface | Estado |
|---|---|---|
| Desde 360 px sin contenido inalcanzable | Las dos tablas viven dentro de un contenedor `overflow-x: auto`, de modo que **se desplazan ellas y no el cuerpo de la página**. Los formularios usan `max-width` y una sola columna. Las rejillas del panel son `grid` de una columna que pasa a dos y luego a cuatro o cinco. Los filtros usan `flex-wrap`. Los diálogos, `w-full max-w-lg` | ✅ Auditado |
| Dos últimas versiones estables de Chrome, Firefox, Edge y Safari | Nada del código usa API que no sea de línea base: `flex`, `grid`, `Intl.DateTimeFormat`, `fetch`. Radix y Next.js 15 declaran ese soporte | ✅ Comprobado en navegador |

**Ejecutado el 2026-08-15**: la aplicación abierta en navegador y estrechada a
360 px, sin contenido inalcanzable. Era una comprobación de diez minutos que
ninguna prueba automática sustituye, porque el recorte de una tabla no lo detecta
un test: se ve o no se ve.

---

## T124 · Inventario de mensajes visibles (SC-036, ux CHK001, ux CHK035)

Los **doce mensajes fijos** de `packages/shared/src/messages/es.ts`, contrastados
contra las cuatro condiciones de «mensaje claro y sin detalles técnicos»: en
español, sin jerga, sin nombres internos, y que una persona pueda repetirlo con
sus palabras.

| Constante | ¿Español? | ¿Sin jerga ni detalles técnicos? | ¿Dice qué hacer? |
|---|---|---|---|
| `MSG_CREDENCIALES_INVALIDAS` | Sí | Sí — deliberadamente no dice cuál de los dos falló | Implícito: revisar ambos |
| `MSG_CUENTA_BLOQUEADA` | Sí | Sí | Sí: esperar 15 minutos |
| `MSG_SIN_PERMISO` | Sí | Sí | — |
| `MSG_SESION_EXPIRADA` | Sí | Sí | Sí: volver a iniciar sesión |
| `MSG_SIN_RESULTADOS_USUARIOS` | Sí | Sí | — |
| `MSG_SIN_RESULTADOS_PEDIDOS` | Sí | Sí | — |
| `MSG_CORREO_YA_EXISTE` | Sí | Sí | Implícito: usar otro correo |
| `MSG_AUTOPROTECCION` | Sí | Sí | — |
| `MSG_ERROR_INESPERADO` | Sí | Sí — no menciona servicios, puertos ni trazas | Sí: reintentar |
| `MSG_CONTRASENA_OLVIDADA` | Sí | Sí | Sí: pedírselo al administrador |
| `MSG_RANGO_FECHAS_INVALIDO` | Sí | Sí | Sí: corregir el orden |
| `MSG_SIN_DATOS_PEDIDOS` | Sí | Sí | — |

Los **mensajes de validación por campo** viven en los esquemas Zod y son once:
correo inválido, correo demasiado largo, contraseña vacía, contraseña mínima,
contraseña máxima, nombre obligatorio, nombre demasiado largo, teléfono
obligatorio, teléfono demasiado largo, rol inválido y estado inválido, más «Debes
modificar al menos un dato.» y los dos de fecha. Todos empiezan por «Debes…» o
nombran el campo, y ninguno menciona un tipo, un esquema ni un código.

**Ejecutado el 2026-08-15** en el paso E1: la cuarta condición —que una persona
no técnica pueda repetir cada mensaje con sus palabras— se comprobó leyéndolos,
que es lo único que la comprueba: no puede autoevaluarse desde el código.
**SC-036 queda verificado.**

Un apunte que salió de la convergencia y no de esta lectura: cuatro pantallas
mostraban un literal recortado —«No pudimos completar la operación.»— en lugar
de `MSG_ERROR_INESPERADO`, perdiendo la mitad que dice **qué puede hacer la
persona**, que es la tercera condición. Corregido en **T134**. El inventario de
arriba no lo habría detectado, porque recorre las constantes y el defecto estaba
en quien no las usaba.

---

## T128 · Cobertura de escenarios y criterios

Los **33 escenarios** `HU<nn>-E<nn>` tienen prueba automática o paso de guía; los
**39 criterios de éxito**, otro tanto. La verificación automática cubre 35 de los
39. Los **cuatro restantes solo se comprueban a mano**, y quedaron comprobados
al ejecutarse T126 el 2026-08-15:

| Criterio | Qué mide | Por qué no tiene cobertura automática |
|---|---|---|
| SC-001 | Inicio de sesión bajo 5 segundos | Se cronometra a mano (supuesto 22). No se instrumenta la aplicación: sería alcance no pedido para un umbral que se comprueba mirando la pantalla |
| SC-007 | Carga del panel bajo 5 segundos | Ídem |
| SC-036 | Mensajes claros para una persona no técnica | Requiere una persona; ver T124 |
| SC-038 | Recorrido completo por teclado | Requiere una persona; ver T122 |

Los cuatro dependían de que se ejecutara **T126**, y por eso aparecían aquí en
lugar de darse por buenos: si la guía no se ejecuta, nadie los comprueba.
Ejecutada la guía, los 39 criterios quedan verificados. Que **la mitad de los
cuatro se corrigiera después de la primera auditoría** —SC-036 por T134 y SC-038
por T133— es la razón por la que no bastaba con auditar el código.

---

## T126 · Validación funcional (ejecutada el 2026-08-15)

Recorridas las secciones **A, B, C y E** de `quickstart.md` con la aplicación en
contenedores, **incluidas las dos esperas reales**. Este apartado separa lo que
quedó respaldado por evidencia en la base de datos de lo que consta por
observación de quien validó, porque la distinción es justamente lo que hace útil
a este documento.

### Pasos con evidencia registrada

| Paso | Qué se observó | Evidencia |
|---|---|---|
| A3 | Cinco fallos sobre `maria.perez@ejemplo.cl` y rechazo de la **contraseña correcta** al sexto intento | `login_attempt_control`: bloqueo a las 20:28:12, vencimiento a las 20:43:12 — **quince minutos exactos**, no aproximados |
| A4 | El mensaje tras cinco fallos sobre un correo **inexistente** es idéntico al de una cuenta real | Dos filas de bloqueo sobre correos sin usuario, con el mismo `MSG_CUENTA_BLOQUEADA` en pantalla (SC-018) |
| A5 | Transcurridos los 15 minutos reales, entra con su contraseña de siempre y **sin intervención del administrador** | La fila del correo desaparece de `login_attempt_control`, que solo ocurre por inicio de sesión exitoso o restablecimiento |
| A9 | Sesión abandonada con la pestaña abierta: la siguiente acción lleva a `/login` con el aviso de expiración | `last_activity_at` **congelado en 21:22:17 durante cuarenta minutos**. Si algún sondeo mantuviera viva la sesión, esa marca habría avanzado (SC-024) |

Los cuatro se comprobaron sin leer código: las consultas a la base solo
confirmaron *por qué* ocurrió lo que ya se veía en pantalla.

### Resto de la validación

Los demás pasos de **A**, y las secciones **B**, **C** y **E** completas, se
recorrieron con la aplicación en la mano, incluido el cronometraje de SC-001 y
SC-007, que bajan de los 5 segundos. Quedan así verificados los cuatro criterios
que no tienen cobertura automática: **SC-001, SC-007, SC-036 y SC-038**.

**Una precisión sobre el orden**, porque afecta a la validez de E2: las tareas
T133 a T136 —entre ellas la asociación de cada mensaje de error con su campo—
se aplicaron y la imagen de `web` se reconstruyó **antes** de recorrer la
sección E. El paso E2 auditó por tanto el código corregido, no el anterior.

### Lo que sigue fuera de alcance, por declaración y no por olvido

- **Auditoría formal de accesibilidad y pruebas con lectores de pantalla
  reales**: FR-039 las excluye expresamente de v1. Lo que sí se recorrió son sus
  cuatro condiciones comprobables, incluido el manejo completo por teclado
  (A19, B25).
- **Métricas y reportes de pedidos**: dependían de que existieran pedidos
  (E4/E2). En 2026-08-15 la sección C se validó con las métricas de usuarios y
  con la superficie de pedidos vacía por diseño; la parte de pedidos quedó
  cerrada el 2026-08-23 (ver actualización arriba), una vez que E4 y E2
  entregaron pedidos reales con historial.
