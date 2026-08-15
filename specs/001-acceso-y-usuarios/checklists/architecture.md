# Checklist de Calidad de Diseño — Arquitectura y decisiones técnicas: E1 · Acceso y usuarios

**Propósito**: validar que cada decisión técnica esté justificada, con alternativas evaluadas y consecuencias declaradas, y que el plan sea coherente con la constitución y con la spec. Es una puerta formal: cada ítem debe resolverse en `plan.md` o `research.md` (o justificarse explícitamente como decisión) antes de ejecutar `/speckit-tasks`.

**Creado**: 2026-08-15

**Funcionalidad**: [spec.md](../spec.md)

**Artefactos bajo prueba**: [plan.md](../plan.md), [research.md](../research.md)

**Alcance**: las 13 decisiones de investigación, el Constitution Check, la estructura del monorepo, las fases de entrega y el registro de complejidad.

> **Cómo usar esta checklist**: cada ítem pregunta si la *decisión está bien argumentada y documentada*, no si la arquitectura es la mejor posible. Marcar `[x]` solo cuando el artefacto responda la pregunta de forma inequívoca; si no, anotar el hallazgo y actualizar el plan.

## Calidad de las decisiones técnicas

- [ ] CHK001 ¿Cada una de las 13 decisiones declara explícitamente sus consecuencias negativas o costos asumidos, y no solo sus ventajas? [Completitud, Investigación]
- [ ] CHK002 ¿Está cuantificado el costo de la consulta de sesión por petición que impone la elección de sesión con estado, siquiera como orden de magnitud frente al objetivo de 5 segundos? [Medibilidad, Investigación §D-001, Spec §SC-001]
- [ ] CHK003 ¿Está justificado el factor de coste 12 de bcrypt con alguna referencia a su impacto real en el tiempo de respuesta, o es un valor adoptado sin medir? [Supuesto, Investigación §D-002, Spec §SC-001]
- [ ] CHK004 ¿Se evalúa el riesgo de que el hash señuelo de tiempo constante quede desactualizado respecto al coste configurado, reintroduciendo la diferencia de temporización que pretende cerrar? [Vacío, Investigación §D-002, Spec §FR-008]
- [ ] CHK005 ¿Está documentada la decisión de adoptar Turborepo frente a no usar ningún orquestador, con el beneficio concreto que aporta a un monorepo de tres paquetes? [Justificación, Investigación §D-008, Constitución §Principio I]
- [ ] CHK006 ¿Se declara qué ocurre con la caché de Turborepo en un entorno limpio, y si alguna verificación depende de ella? [Vacío, Investigación §D-008]
- [ ] CHK007 ¿Cada decisión de investigación se remite a un requisito de la spec o a un principio de la constitución, sin decisiones motivadas únicamente por preferencia técnica? [Trazabilidad, Investigación]

## Rigor del Constitution Check

- [ ] CHK008 ¿Está justificada la calificación "No aplica" de los Principios VI, VII y VIII con una razón específica de esta épica, y no por omisión? [Justificación, Plan §Constitution Check]
- [ ] CHK009 ¿La evaluación del Principio I identifica alguna decisión que *aumente* la complejidad, o el veredicto se apoya solo en las decisiones que la reducen? [Rigor, Plan §Constitution Check, Constitución §Principio I]
- [ ] CHK010 ¿Está declarado si la capa de tests de integración —añadida más allá de lo solicitado— constituye complejidad adicional bajo el Principio I, y no solo un beneficio? [Conflicto, Plan §Complexity Tracking, Constitución §Principio I]
- [ ] CHK011 ¿La excepción al Principio IV distingue con precisión qué criterios de éxito quedan fuera de la verificación no técnica y cuáles permanecen dentro? [Claridad, Plan §Constitution Check, Spec §SC-010]
- [ ] CHK012 ¿Se verifica que el Principio XII se cumple realmente, dado que en E1 no existe ningún pedido cuya trazabilidad se pueda ejercer? [Rigor, Plan §Constitution Check, Constitución §Principio XII]
- [ ] CHK013 ¿Está registrada la reevaluación posterior a la Fase 1 con evidencia de haberse ejecutado, más allá de una afirmación de que no hubo cambios? [Trazabilidad, Plan §Constitution Check]

## Alcance y ausencia de alcance fantasma

- [x] CHK014 ¿Está formalmente justificada la revocación de sesiones en el restablecimiento de contraseña, que añade comportamiento no exigido por ningún requisito de la spec? [Conflicto, Contrato §password-reset, Constitución §Principio III, Spec §FR-026] — **Resuelto 2026-08-15**: formalizada como D-014, con alternativas evaluadas y consecuencias declaradas.
- [x] CHK015 ¿Se declara si ese comportamiento adicional requiere una enmienda a la spec, o si queda como decisión de implementación documentada? [Vacío, Constitución §Principio III] — **Cerrado 2026-08-15**: requería enmienda, y la enmienda **fue aprobada** por la persona responsable del producto. FR-024 cubre ahora las cuatro acciones de impacto; se actualizaron además FR-011, FR-026, RN-001, la entidad Sesión, dos casos límite y los nuevos SC-025 y SC-026 (supuesto 20). D-014 deja de figurar como desviación en el registro de complejidad del plan.
- [ ] CHK016 ¿Existe algún elemento del plan —módulo, capa, herramienta— que no se remita a un requisito o a un principio? [Constitución §Principio III, Plan §Estructura]
- [ ] CHK017 ¿Está justificado que la máquina de estados del pedido viva en `packages/shared` en E1, siendo que ningún consumidor de esta épica la ejercita más allá de nombrar estados? [Justificación, Investigación §D-012, Plan §Complexity Tracking]

## Consistencia interna del plan

- [x] CHK018 ¿Es consistente el umbral de cobertura de pruebas que `quickstart.md` remite al plan, con lo que el plan efectivamente define? [Conflicto, Guía §Comprobaciones automáticas, Plan §Contexto Técnico] — **Resuelto 2026-08-15**: ver `ops.md` §CHK019.
- [x] CHK019 ¿Concuerdan las versiones declaradas en el resumen de investigación con las del Contexto Técnico del plan, sin discrepancias? [Consistencia, Investigación §Resumen de versiones, Plan §Contexto Técnico] — **Resuelto 2026-08-15**: cotejadas una a una, **concuerdan**. Node 22 LTS, TypeScript 5.x, Next.js 15, React 19, Tailwind 4, NestJS 11, Prisma 6, PostgreSQL 16 y Zod 3 coinciden en ambos documentos. La única entrada que el plan no repite es pnpm 9, que sí figura en `quickstart.md` §Requisitos previos.
- [ ] CHK020 ¿Es consistente la asignación de requisitos a fases con las dependencias reales entre ellos —ninguna fase depende de algo que se entrega después? [Consistencia, Plan §Trazabilidad requisito → fase]
- [ ] CHK021 ¿Coincide la estructura de carpetas del plan con la que describen los contratos y la guía de puesta en marcha? [Consistencia, Plan §Estructura, Contrato §shared.md]
- [ ] CHK022 ¿Es consistente la afirmación de que cada fase es "verificable de forma independiente" con el hecho de que la Fase B requiere el administrador semilla de la Fase A? [Claridad, Plan §Fases de entrega]

## Riesgos y supuestos

- [ ] CHK023 ¿Está documentado el riesgo de desincronización de versiones de `packages/shared` entre frontend y backend desplegados por separado? [Vacío, Dependencia]
- [ ] CHK024 ¿Se declara qué ocurre con las sesiones activas cuando cambia el esquema de la tabla `session` en una migración? [Vacío, Riesgo]
- [x] CHK025 ¿Están identificados los supuestos sobre el entorno de ejecución —reloj del sistema, huso horario del contenedor— de los que dependen la expiración de sesión y el bloqueo temporal? [Supuesto, Vacío, Spec §FR-005, §FR-033] — **Resuelto 2026-08-15**: el reloj es siempre el del proceso de la API, a través del `ClockService` (D-009) —nunca el del navegador, que el usuario controla—. Todas las marcas son `timestamptz` en UTC, de modo que el huso del contenedor solo afecta a cómo se muestran las fechas, no a ningún cálculo. Documentado en `data-model.md` §session.
- [ ] CHK026 ¿Cada riesgo de la tabla del plan declara una mitigación verificable, y no una intención? [Medibilidad, Plan §Riesgos y mitigaciones]
- [ ] CHK027 ¿Está evaluado el riesgo de que el `middleware.ts` de Next.js y los guards de NestJS diverjan en su interpretación de qué rol accede a qué ruta? [Vacío, Riesgo, Investigación §D-007]

## Calidad del registro de complejidad

- [ ] CHK028 ¿Cada desviación registrada declara la alternativa más simple y la razón concreta de su rechazo, sin argumentos genéricos? [Completitud, Plan §Complexity Tracking]
- [ ] CHK029 ¿Está la afirmación de que "ninguna de las tres es una desviación introducida por decisión técnica de este plan" respaldada, ítem por ítem, por la spec o la constitución? [Trazabilidad, Plan §Complexity Tracking]
- [ ] CHK030 ¿Se registra alguna desviación que el plan haya podido pasar por alto —por ejemplo, la elección de un patrón BFF que añade un salto de red y una capa de código? [Cobertura, Plan §Complexity Tracking, Investigación §D-006]

## Notas

- CHK014 y CHK015 abordaban el único punto en que el diseño excedía deliberadamente la letra de la spec. Se señaló al entregar el plan; esta checklist lo convirtió en una decisión formal en lugar de una nota al margen. **Cerrado el 2026-08-15 con la aprobación de la enmienda a FR-024**: el diseño ya no excede la spec en este punto, la implementa. El único resto de esta categoría es el máximo de 72 bytes de contraseña, que se recomienda reflejar en FR-032.
- CHK018 es un conflicto documental concreto: la guía de puesta en marcha remite a un umbral de cobertura que el plan no llega a definir.
- CHK009, CHK010 y CHK030 someten el Constitution Check a su propio criterio: una evaluación que solo encuentra cumplimiento merece revisarse antes que celebrarse.
