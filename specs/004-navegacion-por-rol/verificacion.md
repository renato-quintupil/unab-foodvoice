# Registro de verificación: E9 · Navegación y experiencia visual

**Fecha**: 2026-08-19 · **Ejecutado sobre**: `docker compose up --build` (api, web y
postgres en contenedores) en el worktree `004-navegacion-por-rol`, con el catálogo de E3
y tres usuarios de prueba creados desde el panel de administración de E1
(`cliente@foodvoice.local`, `negocio@foodvoice.local`, `admin@foodvoice.local`), más dos
direcciones ("Casa", "Trabajo") registradas para el cliente desde `/cliente/direcciones/nueva`.

Este documento recoge el resultado de T024–T025 y, en dos pasadas posteriores tras usar la
aplicación, de T028–T031 y T032–T035 de `tasks.md` — las 26 comprobaciones funcionales de
`quickstart.md` (V-01 a V-26), recorridas contra la aplicación real, no contra el código. **A
diferencia de E1, E3 y E2, esta validación no encontró ningún defecto en su primera pasada** —
las dos correcciones posteriores (FR-016 § H, FR-017 § I) no las encontró la validación inicial
en sí, sino el propio usuario al seguir usando la aplicación después de que T025 ya la había
cerrado sin objeciones. La única falla real que sí apareció (`/admin` como prefijo de todas sus
rutas) la encontró una prueba unitaria antes de llegar a la app, no la validación funcional — ver
§ I.

**Aclaración sobre quién ejecutó el recorrido**: lo hizo Claude, manejando el navegador real
(clics, formularios, cambios de sesión) contra los contenedores levantados — no lectura de
código ni de logs, que es lo que el Principio IV exige. La única excepción es el patrón mobile
(V-14/V-15): la herramienta de redimensionar ventana disponible en esta sesión no cambió el
viewport capturado en la práctica (limitación de la herramienta, no de la app), así que esos dos
pasos se confirmaron por revisión directa del código (`hidden md:block` / `md:hidden` en ambos
componentes de navegación) en vez de por observación visual en vivo. Queda anotado como pendiente
de una confirmación visual futura, idealmente desde un teléfono real o el devtools de un
navegador de escritorio.

---

## Resumen

| Tarea | Qué exige | Estado |
|---|---|---|
| T024 | `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | ✅ 185/185 pruebas de `apps/web` en verde (incluidas las 4 suites nuevas de esta épica), `tsc --noEmit` limpio, `eslint` limpio sobre los archivos tocados, y build de producción exitoso (imagen Docker reconstruida sin errores) |
| T025 | V-01 a V-20 de `quickstart.md` | ✅ Ejecutados — 18/20 observados en vivo, 2/20 (mobile) confirmados por código, cero defectos |
| T028–T031 | Enmienda FR-016 (landing sin duplicar el encabezado) + V-21 a V-23 | ✅ Implementado, reconstruido y verificado en vivo con los tres roles |
| T032–T035 | Enmienda FR-017 (identidad visual del administrador) + V-24 a V-26 | ✅ Implementado, reconstruido y verificado en vivo — encontró y corrigió un bug propio de la prueba antes de llegar a la app |

---

## V-01 a V-20 · Guía funcional

### A · Navegación de cliente (HU-15)

| Paso | Resultado |
|---|---|
| V-01 | ✅ Al iniciar sesión como cliente aparece el encabezado con Menú, Carrito, Mis pedidos |
| V-02 | ✅ Recorrido Menú → Carrito → Mis pedidos sin escribir URL; el destino activo se distingue en cada pantalla |
| V-03 | ✅ El selector muestra "Casa · Av. Providencia 1234, depto 502" (la primera dirección creada, predeterminada automática por regla de E2) sin abrir nada |
| V-04 | ✅ Al abrir el selector aparece "Trabajo · Nueva Tajamar 555, oficina 12" y el link "Gestionar direcciones" |
| V-05 | ✅ Elegir "Trabajo" la muestra como predeterminada de inmediato, sin salir de la pantalla |
| V-06 | ✅ Navegar a `/menu` después de V-05 sigue mostrando "Trabajo" — confirma que `PUT /addresses/:id/default` persistió, no fue solo un cambio visual local |
| V-07 | ✅ "Gestionar direcciones" abre `/cliente/direcciones` sin cambios respecto de E2 |

### B · Cliente sin direcciones

| Paso | Resultado |
|---|---|
| V-08 | ✅ Antes de registrar direcciones, el encabezado mostraba el link "Registrar dirección" en vez de un espacio vacío |

### C · Navegación de negocio (HU-15)

| Paso | Resultado |
|---|---|
| V-09 | ✅ Al iniciar sesión como negocio aparece el encabezado con Pedidos, Productos, Categorías, sin selector de dirección (correcto, negocio no maneja direcciones) |
| V-10 | ✅ Recorrido Pedidos → Productos → Categorías → Pedidos sin escribir URL; el destino activo se distingue en cada pantalla; las pantallas de Productos/Categorías/Pedidos se comportan exactamente igual que antes de esta épica |

### D · Categorías del menú (HU-15, FR-008/FR-009)

| Paso | Resultado |
|---|---|
| V-11 | ✅ Fila de íconos (Todas, Ensaladas, Pizzas, Sándwiches) visible debajo del encabezado, junto a los tres desplegables de filtro ya existentes |
| V-12 | ✅ Elegir "Pizzas" desde la fila filtra el menú y el desplegable "Tipo de comida" pasa a mostrar "Pizzas" |
| V-13 | ✅ Cambiar el desplegable a "Sándwiches" actualiza la fila de íconos al mismo valor — sincronía confirmada en ambos sentidos |

### E · Patrón mobile (HU-15, FR-010)

| Paso | Resultado |
|---|---|
| V-14 | ⚠️ No observado visualmente en esta sesión (la herramienta de redimensionar ventana no afectó la captura real); confirmado por código: `navegacion.tsx` de ambos roles usa `hidden md:block` para el encabezado de escritorio y `md:hidden` para la barra inferior |
| V-15 | ⚠️ Mismo motivo que V-14 — la barra inferior usa los mismos `<Link>` y misma lógica de estado activo que el encabezado de escritorio, así que el comportamiento de navegación es idéntico por construcción, pero no se vio en vivo |

### F · Identidad visual (HU-16)

| Paso | Resultado |
|---|---|
| V-16 | ✅ El login muestra el panel de marca con la onda de voz y la paleta cálida, coincide con el mockup decidido; los mismos dos campos (correo, contraseña) y el mismo botón, sin cambios de comportamiento |
| V-17 | ✅ Encabezados de cliente y negocio comparten paleta, tipografía (Bricolage Grotesque) y marca "FV" con el login — se perciben como el mismo producto |

### G · Alcance excluido (FR-014, FR-015, Principio III)

| Paso | Resultado |
|---|---|
| V-18 | ✅ El panel de administrador (`/admin`) se ve exactamente igual que antes — fondo blanco, sin la paleta cálida, mismo encabezado Panel/Usuarios de E1 |
| V-19 | ✅ Ningún badge de conteo sobre Carrito ni sobre Pedidos, en ningún encabezado — confirmado visualmente en los dos roles |
| V-20 | ✅ Agregar un producto al carrito, verlo en `/cliente/carrito` con cantidad y subtotal correctos, y las pantallas de Categorías/Productos de negocio: todo se comporta igual que antes de esta épica |

### H · Landing sin duplicar el encabezado (FR-016, enmienda tras uso real)

Detectado por el usuario al mirar la landing de cliente ya con el encabezado de HU-15 puesto:
`/cliente` seguía mostrando la pantalla genérica `InicioDeRol` (Menú, Carrito, Direcciones, Mis
pedidos) **debajo** del encabezado que ya ofrecía lo mismo. Mismo problema en `/negocio`, con su
propia lista de botones de E3. Se amplió `spec.md` (FR-016, escenarios 12–14 de HU-15, SC-009) y
`tasks.md` (Fase 6, T028–T031) antes de tocar el código.

| Paso | Resultado |
|---|---|
| V-21 | ✅ Iniciar sesión como cliente aterriza directo en `/menu` — sin pantalla intermedia |
| V-22 | ✅ Iniciar sesión como negocio aterriza directo en `/negocio/pedidos` — sin pantalla intermedia |
| V-23 | ✅ Iniciar sesión como repartidor (usuario de prueba creado para esta verificación) sigue viendo la misma pantalla de siempre — «Ver el menú» y «Cerrar sesión», sin cambios |

Reconstruida la imagen Docker con el fix; `pnpm test` (185/185), `tsc --noEmit` y `eslint`
limpios antes de reconstruir.

### I · Identidad visual del administrador (FR-017, segunda enmienda tras uso real)

El usuario notó que el encabezado de administrador seguía con el estilo de E1 —texto subrayado
plano, sin marca ni íconos, sin `.tema-voz`— mientras cliente y negocio ya tenían el rediseño
completo. Se amplió `spec.md` (FR-017, escenarios 15–17 de HU-15, escenario 4 de HU-16, SC-010)
y `tasks.md` (Fase 7, T032–T035) antes de tocar el código. La prueba nueva de `NavegacionAdmin`
encontró un bug propio antes de llegar a la app real: `/admin` es prefijo de toda ruta
administrativa, así que "Panel" quedaba marcado activo también en `/admin/usuarios` con un
`startsWith` ingenuo — corregido con match exacto para la raíz.

| Paso | Resultado |
|---|---|
| V-24 | ✅ El encabezado de administrador tiene marca "FV" circular y la paleta cálida — ya no el texto subrayado plano de antes |
| V-25 | ✅ Ir a `/admin/usuarios` marca "Usuarios" como activo y "Panel" deja de estarlo; la gestión de usuarios (cambiar rol, desactivar, restablecer contraseña) sigue funcionando igual que antes |
| V-26 | ✅ El encabezado de administrador comparte paleta, tipografía y marca con cliente y negocio |

Reconstruida la imagen Docker con el fix; `pnpm test` (188/188), `tsc --noEmit` y `eslint`
limpios antes de reconstruir.

---

## Cobertura de los criterios de éxito

| Criterio | Pasos que lo cubren | Estado |
|---|---|---|
| SC-001 | V-02 | ✅ |
| SC-002 | V-10 | ✅ |
| SC-003 | V-03 | ✅ |
| SC-004 | V-12 | ✅ |
| SC-005 | V-02, V-07, V-10 (rutas anidadas heredan el encabezado por construcción del `layout.tsx`) | ✅ |
| SC-006 | V-15 | ⚠️ Confirmado por código, no observado en vivo (ver nota mobile arriba) |
| SC-007 | V-17 | ✅ |
| SC-008 | V-05 | ✅ |
| SC-009 | V-21, V-22 | ✅ |
| SC-010 | V-26 | ✅ |

### Lo que queda fuera de este registro

- **Confirmación visual en vivo del patrón mobile** (V-14, V-15, SC-006): quedó verificada por
  código, no por observación directa, por una limitación de la herramienta de automatización de
  esta sesión. Recomendado repetirla desde un teléfono real o el modo responsive de las
  herramientas de desarrollador de un navegador antes de considerar esto completamente cerrado.
- **Auditoría formal de accesibilidad y lectores de pantalla reales**: fuera de v1 por decisión
  declarada, heredado de E1/E3/E2.

Con T024, T025, T028–T031 y T032–T035 completas —salvo la confirmación visual mobile señalada
arriba—, **E9 · Navegación y experiencia visual queda verificada** al 2026-08-19.
