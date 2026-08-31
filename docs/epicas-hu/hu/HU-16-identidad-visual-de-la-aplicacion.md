# HU-16 — Identidad visual de la aplicación

> Reconstrucción retrospectiva. A diferencia de HU-02, HU-04, HU-05, HU-06,
> HU-07, HU-13 y HU-14, esta HU **no se redactó como borrador previo a la
> spec**: E9 se especificó directo con `/speckit.specify` sobre un borrador
> consolidado de la épica completa. Este documento se escribe después de que
> E9 · Navegación y experiencia visual ya está construida y verificada, a
> partir de `specs/004-navegacion-por-rol/spec.md` (Historia de Usuario 2) y
> del código resultante, para dejar el mapa de HU completo. Se lee junto a
> [HU-15](./HU-15-navegacion-por-rol.md), de la que depende directamente: sin
> el encabezado de HU-15, la identidad visual solo alcanzaría al login.

**Como** usuario de cualquier rol, **quiero** que la aplicación se sienta
como un mismo producto coherente y con identidad propia, **para** que
transmita que la búsqueda/pedido por voz es lo que la distingue de una app
de delivery genérica.

| Campo | Valor |
| --- | --- |
| **Épica** | E9 · Navegación y experiencia visual *(transversal)* |
| **Prioridad** | P2 dentro de su spec |
| **MVP (web)** | Sí |
| **Causa raíz** | Login, encabezados y formularios existían con estilos genéricos, sin ninguna identidad que distinguiera al producto ni conectara la búsqueda por voz (E6) con su apariencia. |
| **Depende de** | HU-15 (necesita el encabezado ya construido para tener dónde aplicarse en cliente, negocio y administrador, más allá del login) |
| **Consumida por** | Ninguna HU futura; es terminal en el flujo de esta épica transversal |

---

## Alcance de esta HU

**Qué entra**: una identidad visual (marca, paleta cálida, motivo de voz)
para la pantalla de inicio de sesión, con los mismos campos y comportamiento
funcional de antes; la misma paleta, tipografía y marca aplicadas a los
encabezados de cliente, negocio y —agregado en la tercera ronda de
clarificación— administrador, para que los tres roles se sientan un mismo
producto coherente con el login.

**Qué no entra**: crear el encabezado en sí ni decidir sus destinos — eso es
HU-15, prerrequisito de esta historia; ningún cambio de comportamiento
funcional en formularios o controles ya existentes — solo cambia su
apariencia.

---

## Por qué depende de HU-15

Esta historia **depende de que exista el encabezado de HU-15** para tener
dónde aplicarse de forma consistente; sin HU-15 la identidad visual solo
alcanzaría al login. Se prueba de forma independiente comparando la
pantalla de login con cualquier encabezado de HU-15 y verificando que
comparten paleta, tipografía y marca — entrega valor por sí sola como
mejora de percepción, incluso si HU-15 ya está probada por separado.

---

## Reglas de negocio

- **Ningún cambio de identidad visual altera comportamiento**: el mismo
  formulario de login, los mismos campos, el mismo comportamiento funcional
  de antes — solo cambió su apariencia (FR-012, FR-014).
- **Coherencia entre los tres roles con encabezado**: cliente, negocio y
  administrador comparten la misma paleta, tipografía y marca entre sí y
  con el login; ninguno debe verse "más viejo" que los otros dos.
- **El repartidor y el resto de las pantallas no visuales quedan fuera**:
  esta épica no rediseña ninguna pantalla que no sea el login o los
  encabezados de HU-15 — no toca autenticación, carrito, direcciones,
  pedidos ni catálogo en su comportamiento (FR-014).

---

## Criterios de aceptación (Gherkin)

```gherkin
Característica: Identidad visual de la aplicación

  Escenario: HU16-E01 · Identidad visual del login
    Dado que abro la pantalla de inicio de sesión
    Cuando la miro
    Entonces veo una identidad visual (marca, paleta cálida, motivo de voz) distinta del formulario genérico anterior
    Y los mismos campos y comportamiento de antes

  Escenario: HU16-E02 · Coherencia entre login y encabezado de rol
    Dado que ya inicié sesión
    Cuando comparo el encabezado de mi rol con la pantalla de login
    Entonces ambos comparten la misma paleta, tipografía y marca

  Escenario: HU16-E03 · Sin cambios funcionales en controles existentes
    Dado que uso cualquier formulario o control ya existente (email, contraseña, botones)
    Cuando interactúo con él tras esta épica
    Entonces su comportamiento funcional es idéntico al de antes

  Escenario: HU16-E04 · Coherencia incluida la del administrador
    Dado que ya inicié sesión como administrador
    Cuando comparo su encabezado con el de cliente o negocio
    Entonces los tres comparten la misma paleta, tipografía y marca
```

---

## Casos límite cubiertos

- El rediseño del login no agrega ni quita ningún campo o comportamiento
  del formulario existente: solo cambia su apariencia.
- El rediseño de los encabezados no altera el comportamiento funcional de
  ninguna pantalla existente que no sea la landing de cliente o negocio
  (frontera con HU-15, FR-014/FR-016).
- El encabezado del administrador, agregado en la tercera ronda de
  clarificación, se alinea al mismo patrón visual sin agregarle ningún
  destino nuevo — la identidad visual no es excusa para ampliar alcance.

---

## Criterios de éxito (medibles, verificables sin leer código)

| ID | Criterio |
| --- | --- |
| SC-007 | Una persona que ve el login y luego cualquier pantalla de cliente o negocio percibe ambas como el mismo producto, sin un cambio de identidad visual entre una y otra. |
| SC-010 | Una persona que ve los encabezados de cliente, negocio y administrador, uno tras otro, los percibe como el mismo producto — ninguno se ve "más viejo" que los otros dos. |

---

## Frontera con HU-15 — a respetar

HU-16 no decide **qué** destinos tiene un encabezado ni **cómo** se navega
entre ellos — eso ya lo fijó HU-15. HU-16 solo decide **cómo se ve**: la
paleta, la tipografía, la marca y el motivo de voz que unifican login y
encabezados. Si HU-15 agregara un destino nuevo en el futuro, HU-16 no
necesitaría cambiar para que ese destino nuevo herede el mismo estilo — el
estilo vive en variables compartidas, no en cada destino por separado.

---

## Fuera de alcance de v1 (declarado, no omitido)

- **Rediseño de cualquier pantalla que no sea el login o los encabezados de
  HU-15**: autenticación, carrito, direcciones, pedidos y catálogo
  conservan su presentación previa en lo funcional.
- **Auditoría formal de accesibilidad**: fuera de alcance de v1 desde E1;
  esta historia mantiene el patrón de foco visible ya usado en el resto del
  producto.
- **Ilustraciones, animaciones o video de marca**: la identidad se expresa
  con paleta, tipografía y motivo de voz, no con contenido multimedia
  adicional.

---

## Qué construyó realmente (resumen de implementación)

- **`apps/web`** únicamente — E9 no toca `services/api` ni
  `packages/shared`.
- **Identidad visual** (`.tema-voz` en `globals.css`, tipografía Bricolage
  Grotesque vía `next/font/google`, login rediseñado): redefine los mismos
  nombres de variable CSS que ya usan `Button`/`Input` dentro de un wrapper,
  sin tocar `:root` ni el código de esos componentes — por eso el
  administrador, antes de la tercera ronda de clarificación, quedaba sin
  cambios visuales, y por eso alinearlo después (HU-15, FR-017) fue agregar
  `.tema-voz` a `admin/layout.tsx`, no reescribir componentes.
- **Verificación funcional**: 2026-08-19, junto con HU-15 (misma spec, 26
  pasos en total, dos rondas de enmiendas incluidas). Ningún defecto de la
  validación en sí; el hallazgo real de esta historia fue detectado después
  de darla por cerrada, al seguir usando la aplicación: el encabezado de
  administrador había quedado fuera del rediseño con el estilo visual
  anterior, mientras cliente y negocio ya lo tenían — corregido con la
  enmienda de la tercera ronda (FR-017) antes de tocar el código. Detalle en
  `specs/004-navegacion-por-rol/verificacion.md`.
