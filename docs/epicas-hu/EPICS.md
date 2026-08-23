# FoodVoice · Épicas e Historias de Usuario

Este documento es la referencia de planificación de alto nivel del proyecto. Se irá actualizando a medida que avance la implementación (nuevas HU pueden aparecer dentro de una épica ya existente). Cada épica se especifica como una feature independiente de Spec Kit
(`/speckit-specify`); las HU de cada épica se incorporan como escenarios/criterios de aceptación dentro de esa spec.

## Decisiones de alcance (v1)

- **Mono-local**: v1 no contempla múltiples locales/negocios en la misma plataforma.
- **Sin módulo de pago**: fuera de alcance de este proyecto.
- **Sin geolocalización**: las direcciones se registran solo como texto libre (ver principio X de la constitución).

## Épicas

| ID  | Épica                          | Descripción                                                               |
| --- | ------------------------------ | ------------------------------------------------------------------------- |
| E1  | **Acceso y usuarios**          | Autenticación, sesión, roles y gestión de usuarios                        |
| E2  | **Gestión de pedidos**         | Creación, aceptación y preparación de pedidos                             |
| E3  | **Administración de menú**     | Alta/baja y disponibilidad de productos                                   |
| E4  | **Trazabilidad del pedido**    | Historial de estados de extremo a extremo                                 |
| E5  | **Reparto**                    | Asignación o selección de pedidos a repartidor                            |
| E6  | **Búsqueda por voz**           | Búsqueda de productos asistida por voz                                    |
| E7  | **Cierre del servicio**        | Confirmación digital de entrega y conformidad/reclamo entrega de feedback |
| E8  | **Controles y administración** | Controles de flujos críticos y supervisión                                |
| E9  | **Navegación y experiencia visual** *(transversal)* | Shell de navegación por rol e identidad visual de la aplicación construida |

**E9 es transversal**: no participa del orden de especificación E1→E8 (no bloquea
ni depende de ninguna otra épica), porque no agrega una capacidad de negocio
nueva sino la forma de moverse entre las pantallas que las demás épicas ya
construyeron. Se especifica cuando haga falta, no en un punto fijo de la
secuencia.

## Historias de usuario (HU)

| HU    | Nombre                                                                               |
| ----- | ------------------------------------------------------------------------------------ |
| HU-01 | Gestión de pedidos con estado visible (incluye aceptación/rechazo por el negocio)    |
| HU-02 | Administración de menú (alta/baja y disponibilidad de productos)                     |
| HU-03 | Trazabilidad del pedido                                                              |
| HU-04 | Asignación pedido a repartidor                                                       |
| HU-05 | Cierre digital del servicio                                                          |
| HU-06 | Búsqueda asistida por voz                                                            |
| HU-07 | Controles de flujos críticos                                                         |
| HU-08 | Autenticación y sesión                                                               |
| HU-09 | Gestión de usuarios y roles                                                          |
| HU-10 | Panel y reportes del administrador                                                   |
| HU-11 | Registro de dirección y ubicación del cliente (solo texto)                           |
| HU-12 | Carrito editable manual                                                              |
| HU-13 | Agregar al carrito por voz                                                           |
| HU-14 | Metadata y clasificación de productos (precio, tipo de comida, etiqueta de salud...) |
| HU-15 | Navegación por rol (header/nav, destinos por rol, selector de dirección de entrega, categorías del menú) |
| HU-16 | Identidad visual de la aplicación (login, marca, paleta y tipografía coherentes)     |

## Épicas / Historias de usuario

| Épica                           | HU relacionadas     |
| ------------------------------- | ------------------- |
| E1 · Acceso y usuarios          | HU-08, HU-09, HU-10 |
| E2 · Gestión de pedidos         | HU-01, HU-11, HU-12 |
| E3 · Administración de menú     | HU-02, HU-14        |
| E4 · Trazabilidad del pedido    | HU-03               |
| E5 · Reparto                    | HU-04               |
| E6 · Búsqueda por voz           | HU-06, HU-13        |
| E7 · Cierre del servicio        | HU-05               |
| E8 · Controles y administración | HU-07               |
| E9 · Navegación y experiencia visual *(transversal)* | HU-15, HU-16 |

## Notas de frontera entre HU (a respetar al especificar)

- **HU-10 vs. HU-07**: HU-10 (Panel y reportes, E1) es de **solo lectura** — métricas,
  reportes, historial, visualización de estado general. HU-07 (Controles de flujos críticos,
  E8) es de **acción** — permisos, override manual de estados atascados, bloqueo/desbloqueo de
  operaciones. HU-10 no debe modificar datos operativos; HU-07 sí.
- **"Agotado"**: es un criterio de aceptación de HU-02 (disponibilidad de producto), pero debe
  respetarse también en HU-12 (el carrito no permite agregar un producto agotado) y en HU-06 /
  HU-13 (la búsqueda y el agregado por voz no deben sugerir ni agregar productos agotados).
- **HU-04 / HU-05 / HU-01 y la trazabilidad (HU-03)**: la máquina de estados
  (principio XII de la constitución, enmendado a la versión 2.0.0 durante E2) ya está
  construida en `packages/shared` desde E1, con la rama de rechazo agregada por E2. Los
  estados son **seis**: `creado → en_preparacion → asignado_repartidor → entregado →
  cerrado`, más `rechazado` —terminal, alcanzable únicamente desde `creado`, con motivo
  obligatorio (RN-008, RN-010 de E2)—. No existe un estado "aceptado" independiente: la
  aceptación del negocio es la transición `creado → en_preparacion`. HU-01, HU-04 y HU-05
  disparan transiciones sobre ese contrato y no deben redefinir sus propios estados.
- **HU-03 y la entidad Pedido**: la entidad Pedido se crea en E2, por eso E2 se especifica
  antes que E4. **E2 ya escribe el historial** (`OrderStatusEvent`, append-only, con la
  creación y sus dos transiciones) porque el principio XII lo exige desde el primer
  pedido — pero no lo expone: no hay endpoint, DTO ni pantalla que lo consulte (RN-011 de
  E2). HU-03 incorpora esa consulta (API + pantalla) sobre las entradas que E2 ya dejó
  escritas, y dispone el mecanismo para que E5 (`asignado_repartidor`) y E7 (`entregado`,
  `cerrado`) seguirán agregando entradas cuando existan; HU-03 no dispara esas dos
  transiciones futuras, solo las que E2 ya construyó pueden verificarse funcionalmente
  hoy.

## Orden sugerido de especificación

E1 → E3 → E2 → E4 → E6 → E5 → E7 → E8

Razón: E1 (roles) es prerequisito de casi todas las demás; E3 debe existir antes de E2 (no hay
pedido sin catálogo) y antes de E6 (no hay búsqueda sin catálogo clasificado); E2 crea la
entidad Pedido, sin la cual E4 no tiene sobre qué registrar historial. El contrato de estados
que E2, E5 y E7 consumen no bloquea este orden: ya está construido en `packages/shared`
desde E1.

**E9 no forma parte de esta secuencia.** Es transversal: envuelve con navegación las pantallas
que las demás épicas ya construyeron, en vez de agregar una capacidad de negocio nueva. Su único
prerrequisito real es que exista al menos una pantalla por rol a la que navegar (ya lo hay desde
E1+E3+E2), y no bloquea a E4/E5/E6/E7/E8: cuando cada una agregue una pantalla nueva, extiende el
componente de navegación que E9 deja construido en vez de reabrir su spec.
