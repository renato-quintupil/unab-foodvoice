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

## Notas de frontera entre HU (a respetar al especificar)

- **HU-10 vs. HU-07**: HU-10 (Panel y reportes, E1) es de **solo lectura** — métricas,
  reportes, historial, visualización de estado general. HU-07 (Controles de flujos críticos,
  E8) es de **acción** — permisos, override manual de estados atascados, bloqueo/desbloqueo de
  operaciones. HU-10 no debe modificar datos operativos; HU-07 sí.
- **"Agotado"**: es un criterio de aceptación de HU-02 (disponibilidad de producto), pero debe
  respetarse también en HU-12 (el carrito no permite agregar un producto agotado) y en HU-06 /
  HU-13 (la búsqueda y el agregado por voz no deben sugerir ni agregar productos agotados).
- **HU-04 / HU-05 / HU-01 y la trazabilidad (HU-03)**: la máquina de estados
  (creado → en preparación → asignado a repartidor → entregado → cerrado, principio XII de la
  constitución) ya está construida en `packages/shared` desde E1. HU-01, HU-04 y HU-05
  disparan transiciones sobre ese contrato, no deben redefinir sus propios estados; HU-03
  añade el historial persistido de esas transiciones y su consulta. Los estados son **cinco**:
  no existe un estado "aceptado" (la aceptación del negocio es la transición
  creado → en preparación) ni estado de rechazo o cancelación en v1.
- **HU-03 y la entidad Pedido**: el historial se registra sobre pedidos que ya existen, y la
  entidad Pedido se crea en E2. Por eso E2 se especifica antes que E4.

## Orden sugerido de especificación

E1 → E3 → E2 → E4 → E6 → E5 → E7 → E8

Razón: E1 (roles) es prerequisito de casi todas las demás; E3 debe existir antes de E2 (no hay
pedido sin catálogo) y antes de E6 (no hay búsqueda sin catálogo clasificado); E2 crea la
entidad Pedido, sin la cual E4 no tiene sobre qué registrar historial. El contrato de estados
que E2, E5 y E7 consumen no bloquea este orden: ya está construido en `packages/shared`
desde E1.
