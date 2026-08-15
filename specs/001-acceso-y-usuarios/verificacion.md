# Registro de verificación: E1 · Acceso y usuarios

**Fecha**: 2026-08-15 · **Ejecutado sobre**: `docker compose up --build`, los tres
servicios sanos, con el administrador semilla creado.

Este documento recoge el resultado de las tareas de verificación de la Fase 6
(T122 a T128). **Distingue lo comprobado de lo pendiente**, porque una tabla que
no lo hiciera convertiría «no se verificó» en «se verificó y salió bien».

---

## Resumen

| Tarea | Qué exige | Estado |
|---|---|---|
| T122 | Accesibilidad contra las cuatro condiciones de FR-039 | ✅ Auditado en código · ⚠️ falta el recorrido con lector de pantalla |
| T123 | Desde 360 px y sobre cuatro navegadores | ✅ Auditado en código · ⚠️ falta la matriz de navegadores |
| T124 | Inventario de mensajes visibles | ✅ Inventariado · ⚠️ falta la lectura por una persona no técnica |
| T125 | Las cinco comprobaciones automáticas, sin caché | ✅ Las cinco en verde |
| T126 | Guía funcional A, B, C y E, por una persona no técnica | ⚠️ **Pendiente**: exige una persona y esperas reales |
| T127 | Verificación técnica de la sección D | ✅ Ejecutada contra el sistema real |
| T128 | Las dos tablas de cobertura | ✅ Recorridas · cuatro criterios dependen de T126 |

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

**Lo que falta**: un recorrido real con lector de pantalla y solo teclado
(pasos A19 y B25 de la guía). La auditoría de código dice que las condiciones
están implementadas; no dice que la experiencia resultante sea buena.

---

## T123 · Tamaños de pantalla y navegadores (FR-040)

| Condición | Cómo se satisface | Estado |
|---|---|---|
| Desde 360 px sin contenido inalcanzable | Las dos tablas viven dentro de un contenedor `overflow-x: auto`, de modo que **se desplazan ellas y no el cuerpo de la página**. Los formularios usan `max-width` y una sola columna. Las rejillas del panel son `grid` de una columna que pasa a dos y luego a cuatro o cinco. Los filtros usan `flex-wrap`. Los diálogos, `w-full max-w-lg` | ✅ Auditado |
| Dos últimas versiones estables de Chrome, Firefox, Edge y Safari | Nada del código usa API que no sea de línea base: `flex`, `grid`, `Intl.DateTimeFormat`, `fetch`. Radix y Next.js 15 declaran ese soporte | ⚠️ **No verificado en navegador real** |

**Lo que falta**: abrir la aplicación en los cuatro navegadores y estrechar la
ventana a 360 px. Es una comprobación de diez minutos que ninguna prueba
sustituye.

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

**Lo que falta**: la cuarta condición —que una persona no técnica pueda repetir
cada mensaje con sus palabras— **no puede autoevaluarse**. Requiere leérselos a
alguien y escuchar cómo los reformula.

---

## T128 · Cobertura de escenarios y criterios

Los **33 escenarios** `HU<nn>-E<nn>` tienen prueba automática o paso de guía; los
**39 criterios de éxito**, otro tanto. La verificación automática cubre 35 de los
39. Los **cuatro que solo se comprueban a mano** siguen pendientes, y es
importante que no se lean como cubiertos:

| Criterio | Qué mide | Por qué no tiene cobertura automática |
|---|---|---|
| SC-001 | Inicio de sesión bajo 5 segundos | Se cronometra a mano (supuesto 22). No se instrumenta la aplicación: sería alcance no pedido para un umbral que se comprueba mirando la pantalla |
| SC-007 | Carga del panel bajo 5 segundos | Ídem |
| SC-036 | Mensajes claros para una persona no técnica | Requiere una persona; ver T124 |
| SC-038 | Recorrido completo por teclado | Requiere una persona; ver T122 |

Los cuatro dependen de que se ejecute **T126**. Si la guía no se ejecuta, nadie
los comprueba — y esa es exactamente la razón por la que aparecen aquí en lugar
de darse por buenos.

---

## Pendiente de una persona

Tres cosas, ninguna bloqueante para el código y todas necesarias antes de dar la
épica por cerrada:

1. **T126** · Recorrer `quickstart.md` A, B, C y E con la aplicación en la mano,
   incluidas las esperas reales de 15 y 30 minutos, y cronometrar SC-001 y
   SC-007.
2. **T123** · Abrir la aplicación en Chrome, Firefox, Edge y Safari, y
   estrecharla a 360 px.
3. **T122 / T124** · El recorrido con teclado y lector de pantalla, y la lectura
   de los mensajes por alguien que no haya escrito el código.
