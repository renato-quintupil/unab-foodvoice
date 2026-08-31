# HU-08 — Autenticación y sesión

> Reconstrucción retrospectiva. A diferencia de HU-02, HU-04, HU-05, HU-06,
> HU-07, HU-13 y HU-14, esta HU **no se redactó como borrador previo a la
> spec**: E1 se especificó directo con `/speckit.specify` sobre un borrador
> consolidado de la épica completa. Este documento se escribe después de que
> E1 · Acceso y usuarios ya está construida y verificada, a partir de
> `specs/001-acceso-y-usuarios/spec.md` (Historia de Usuario 1) y del código
> resultante, para dejar el mapa de HU completo. Se lee junto a
> [HU-09](./HU-09-gestion-de-usuarios-y-roles.md) y
> [HU-10](./HU-10-panel-y-reportes-del-administrador.md), las otras dos
> historias de la misma spec, sobre las que HU-08 es la base: sin sesión ni
> rol no hay nada que gestionar ni que restringir.

**Como** persona con una cuenta en el sistema, **quiero** iniciar sesión con
mi correo y contraseña y que el sistema recuerde quién soy y qué rol tengo
mientras la uso, **para** acceder solo a las funciones que me corresponden y
no tener que autenticarme en cada acción.

| Campo | Valor |
| --- | --- |
| **Épica** | E1 · Acceso y usuarios |
| **Prioridad** | P1 dentro de su spec (fase B, primera funcional tras los cimientos) |
| **MVP (web)** | Sí |
| **Causa raíz** | Ninguna otra épica puede construirse sin saber quién es el usuario y qué puede hacer: HU-08 es el cimiento de acceso de todo el producto. |
| **Depende de** | Ninguna funcional; solo de los cimientos técnicos (monorepo, `packages/shared`, esquema, semilla de administrador) de la fase A de esta misma spec |
| **Consumida por** | HU-09 y HU-10 (mismo rol de administrador y misma sesión), y todas las épicas posteriores (E2 a E9), que asumen sesión y rol ya resueltos |

---

## Alcance de esta HU

**Qué entra**: iniciar sesión con correo y contraseña; identificar el rol del
usuario autenticado y usarlo para permitir o rechazar funciones; mantener la
sesión activa mientras hay actividad del usuario; expirarla tras 30 minutos
de inactividad; cerrarla explícitamente; el bloqueo temporal tras 5 intentos
fallidos; los mensajes genéricos que no revelan si una cuenta existe; y la
página de inicio mínima por rol a la que se llega tras autenticarse.

**Qué no entra**: crear, editar, desactivar o reactivar usuarios, ni cambiar
su rol o restablecer su contraseña — eso es HU-09; el panel de métricas y
reportes del administrador — eso es HU-10; ninguna función específica de
cliente, negocio o repartidor, que llegan con sus propias épicas (E2, E3,
E5) y que en v1 no tienen navegación propia por decisión declarada de esta
spec.

---

## Convenciones que esta HU fija para toda la aplicación

Dos decisiones de esta spec no son solo de HU-08, pero se fijan aquí porque
es la primera historia que las necesita, y el resto de las épicas las hereda
sin volver a discutirlas:

- **Vocabulario visible**: "Desactivar"/"Reactivar" (nunca "dar de baja" ni
  "eliminar"), "Activo"/"Desactivado", "Restablecer contraseña", "Nuevo
  usuario". Los identificadores técnicos internos en mayúsculas
  (`CLIENTE`, `NEGOCIO`, `REPARTIDOR`, `ADMINISTRADOR`) nunca aparecen en
  pantalla — se muestran como **Cliente**, **Negocio**, **Repartidor** y
  **Administrador**.
- **Huso horario de referencia**: `America/Santiago`, declarado en un único
  lugar de `packages/shared` para que servidor e interfaz nunca discrepen.
  No tiene efecto observable dentro de HU-08 en sí, pero HU-10 lo hereda
  para el reporte de pedidos.

---

## Reglas de negocio

- **RN-01 · El correo es el único identificador de acceso**: se compara sin
  distinguir mayúsculas de minúsculas ni espacios sobrantes; la contraseña,
  en cambio, se compara carácter por carácter y nunca se normaliza (FR-001).
- **RN-02 · Los mensajes de error de autenticación no revelan nada**: ni si
  la cuenta existe, ni si está desactivada, ni cuál de los dos campos fue el
  incorrecto, ni ninguna característica de la contraseña almacenada. Los
  cuatro casos —correo inexistente, contraseña incorrecta, cuenta
  desactivada con credenciales correctas y cuenta bloqueada— muestran el
  mismo mensaje (FR-008, RN de HU-09 § FR-012).
- **RN-03 · La inactividad es el único plazo que termina una sesión por el
  paso del tiempo**: 30 minutos, igual para los cuatro roles, sin duración
  máxima absoluta. Solo cuenta como actividad una acción iniciada por la
  persona; ninguna consulta automática de la aplicación la mantiene viva
  (FR-005).
- **RN-04 · El bloqueo se cuenta por correo, no por origen de la petición**:
  5 fallos consecutivos sobre el mismo correo bloquean ese correo 15
  minutos, se levante quien se levante desde qué dispositivo (FR-033).
- **RN-05 · El rechazo de una función fuera de rol no cierra la sesión**:
  equivocarse de dirección no es un problema de identidad; se muestra una
  página propia con el mensaje y un enlace de vuelta al inicio del rol
  correcto (FR-003).
- **RN-06 · La página de inicio de cliente, negocio y repartidor no ofrece
  ninguna función que su propia épica no haya construido todavía**: en v1
  solo nombre, rol y "Cerrar sesión" — inventarles opciones que no llevan a
  ninguna parte es alcance fantasma (FR-031, Principio III).

---

## Criterios de aceptación (Gherkin)

```gherkin
Característica: Autenticación y sesión

  Escenario: HU08-E01 · Inicio de sesión exitoso
    Dado un usuario activo con correo y contraseña válidos
    Cuando inicia sesión con esas credenciales
    Entonces el sistema lo lleva a la página de inicio de su rol

  Escenario: HU08-E02 · Credenciales inválidas
    Dado un usuario con correo registrado
    Cuando intenta iniciar sesión con la contraseña incorrecta
    Entonces el sistema muestra un mensaje genérico sin indicar cuál campo falló
    Y no crea ninguna sesión

  Escenario: HU08-E03 · Bloqueo tras 5 intentos fallidos
    Dado un correo con 5 intentos fallidos consecutivos
    Cuando intenta iniciar sesión de nuevo, incluso con la contraseña correcta
    Entonces el sistema lo rechaza con un mensaje de bloqueo temporal de 15 minutos

  Escenario: HU08-E04 · El bloqueo no revela si la cuenta existe
    Dado un correo sin ninguna cuenta asociada, con 5 intentos fallidos
    Cuando se compara su mensaje de bloqueo con el de una cuenta real bloqueada
    Entonces ambos mensajes son idénticos

  Escenario: HU08-E05 · Acceso denegado fuera de rol
    Dado un usuario autenticado con rol "cliente"
    Cuando intenta acceder a una función exclusiva de "negocio", por navegación, por URL directa o por llamada directa
    Entonces el sistema lo rechaza en los tres casos con una página propia en español
    Y su sesión sigue activa

  Escenario: HU08-E06 · Cierre de sesión explícito
    Dado un usuario con sesión activa
    Cuando cierra sesión
    Entonces vuelve a la pantalla de inicio de sesión sin ningún mensaje de error

  Escenario: HU08-E07 · Expiración por 30 minutos de inactividad
    Dado un usuario con sesión activa y sin ninguna acción durante 30 minutos
    Cuando intenta realizar una acción
    Entonces el sistema exige reautenticación con un mensaje explicativo

  Escenario: HU08-E08 · La sesión persiste durante el uso normal
    Dado un usuario que realiza acciones dentro de los 30 minutos entre cada una
    Cuando continúa usando la aplicación por más de 30 minutos en total
    Entonces ninguna de sus acciones exige reautenticación

  Escenario: HU08-E09 · La sesión se invalida por desactivación
    Dado un usuario con sesión activa
    Cuando un administrador lo desactiva
    Entonces su siguiente acción es rechazada de inmediato, sin esperar a que expire por tiempo

  Escenario: HU08-E10 · Inicio de sesión tras restablecer la contraseña
    Dado un usuario al que el administrador le restableció la contraseña
    Cuando intenta iniciar sesión con la contraseña anterior
    Entonces el sistema lo rechaza
    Y puede iniciar sesión con la nueva

  Escenario: HU08-E11 · Expiración a mitad de una acción no aplica cambios parciales
    Dado un usuario con la sesión a punto de expirar
    Cuando envía un formulario justo cuando la sesión ya venció
    Entonces el sistema rechaza la acción por completo, sin aplicar ningún cambio parcial
```

---

## Casos límite cubiertos

- Un usuario desactivado que ingresa sus credenciales correctas recibe el
  mismo mensaje que quien se equivoca de contraseña, y el intento cuenta
  igual para el bloqueo (FR-008, FR-012).
- El correo de un cambio de contacto no termina las sesiones abiertas de esa
  persona: la sesión identifica a la persona, no a su correo (FR-010).
- Una sesión que vence mientras una acción administrativa ya está en curso
  no la interrumpe a medias: la validez se comprueba una sola vez, antes de
  empezar a aplicarla (FR-030).
- Un mismo usuario con dos sesiones simultáneas en dos dispositivos: cerrar
  una no cierra la otra, salvo que sea una de las cuatro acciones
  administrativas de impacto, que terminan todas a la vez (FR-024).
- Tras 15 minutos, el contador de intentos fallidos queda en cero: un
  fallo posterior no vuelve a bloquear la cuenta sin otros 5 fallos
  consecutivos.
- Un formulario abierto sin enviarse durante los 30 minutos de inactividad
  pierde lo escrito al expirar; no se guarda ningún borrador (FR-030).

---

## Criterios de éxito (medibles, verificables sin leer código)

| ID | Criterio |
| --- | --- |
| SC-001 | Un usuario con credenciales correctas llega a la vista de su rol en menos de 5 segundos. |
| SC-002 | El 100 % de los intentos con credenciales inválidas son rechazados sin crear sesión. |
| SC-003 | El 100 % de los intentos de acceder a una función fuera del rol del usuario autenticado son bloqueados, incluso invocando el punto de entrada directamente sin pasar por la interfaz. |
| SC-006 | El 100 % de los usuarios desactivados pierden el acceso de inmediato —incluida su sesión abierta— sin perder su historial de pedidos asociado. |
| SC-013 | El 100 % de las sesiones sin actividad durante 30 minutos exigen reautenticación en la siguiente acción. |
| SC-017 | El 100 % de los intentos dentro de los 15 minutos posteriores a un bloqueo son rechazados, y el acceso vuelve a permitirse automáticamente al vencer ese lapso. |
| SC-018 | El mensaje tras 5 intentos fallidos es idéntico, palabra por palabra, para un correo registrado y para uno no registrado. |
| SC-028 | Los cuatro mensajes de intento fallido —correo inexistente, contraseña incorrecta, cuenta desactivada y cuenta bloqueada— son indistinguibles entre sí salvo por el hecho de estar bloqueada. |
| SC-030 | El 100 % de los cierres de sesión explícitos terminan esa sesión, y ninguna acción posterior con ella se acepta, incluido volver atrás en el navegador. |
| SC-031 | Durante un uso continuado sin pausas de 30 minutos, el 100 % de las acciones se aceptan sin volver a pedir autenticación. |
| SC-035 | El 100 % de las acciones enviadas con una sesión ya expirada se rechazan sin aplicar ningún cambio. |

---

## Frontera con HU-09 y HU-10 — a respetar

HU-08 define **el mecanismo** de sesión y rol; no decide **quién** puede
tener cada rol ni **qué hace** el administrador con ellos. Crear, desactivar
o cambiar el rol de un usuario es HU-09; consultar métricas o el reporte de
pedidos con ese rol ya resuelto es HU-10. Las cuatro acciones administrativas
de impacto que invalidan sesiones (FR-024) están definidas aquí porque son
una propiedad de la sesión, pero **quién las ejecuta** vive en HU-09.

---

## Fuera de alcance de v1 (declarado, no omitido)

- **Autorregistro**: no existe; toda alta pasa por el administrador (HU-09).
- **Recuperación de contraseña por autoservicio**: ni correo de recuperación
  ni tokens temporales; el restablecimiento lo hace el administrador
  (HU-09).
- **Cambio de la propia contraseña por el usuario**, incluido el
  administrador sobre la suya: no existe ninguna pantalla para eso en v1.
- **Autenticación federada** (Google u otros proveedores externos).
- **Límite de sesiones simultáneas por usuario** ni una vista de "sesiones
  activas" desde la que cerrarlas.
- **Defensas frente a ataques distribuidos o sobre múltiples cuentas**: el
  bloqueo de FR-033 protege una cuenta concreta y nada más.
- **Registro consultable de eventos de autenticación** (inicios de sesión,
  fallos, bloqueos): no hay vista para eso en v1.

---

## Qué construyó realmente (resumen de implementación)

- **`packages/shared`**: el enum de roles y la máquina de estados de sesión
  conceptual; los mensajes fijos de credenciales inválidas, bloqueo temporal
  y expiración, compartidos entre frontend y backend.
- **`services/api`**: el módulo `auth` (NestJS), con sesión con estado en
  base de datos (modelo `Session`) e identificador opaco en cookie
  `httpOnly` — nada de JWT. `LoginAttemptControl` lleva el contador de
  intentos fallidos por correo ingresado, exista o no la cuenta, separado
  del modelo `User` precisamente para que el comportamiento observable sea
  idéntico en ambos casos. Contraseñas con bcrypt (coste 12), nunca en texto
  plano.
- **`apps/web`**: la pantalla de inicio de sesión y las páginas de inicio
  mínimas por rol; el guard de rol que rechaza al procesar la acción, no
  solo al pintar la pantalla.
- **Verificación funcional**: 2026-08-15, con las esperas reales de 15 y 30
  minutos (bloqueo y expiración por inactividad), sin las cuales SC-001,
  SC-007, SC-036 y SC-038 no eran verificables. Encontró que el error de
  formulario no quedaba asociado a su campo, corregido antes de cerrar la
  épica (T133). Detalle en
  `specs/001-acceso-y-usuarios/verificacion.md`.
