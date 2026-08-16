# Checklist de Calidad de la Especificación: E3 · Administración de menú

**Propósito**: validar que la especificación está completa y es de calidad suficiente antes de pasar a la planificación
**Creado**: 2026-08-16
**Funcionalidad**: [spec.md](../spec.md)

## Calidad del Contenido

- [x] Sin detalles de implementación (lenguajes, frameworks, APIs)
- [x] Centrada en el valor para el usuario y las necesidades del negocio
- [x] Redactada para personas no técnicas
- [x] Todas las secciones obligatorias completadas

## Completitud de los Requisitos

- [x] No quedan marcadores [NEEDS CLARIFICATION]
- [x] Los requisitos son comprobables y no ambiguos
- [x] Los criterios de éxito son medibles
- [x] Los criterios de éxito son independientes de la tecnología
- [x] Todos los escenarios de aceptación están definidos
- [x] Los casos límite están identificados
- [x] El alcance está claramente delimitado
- [x] Las dependencias y los supuestos están identificados

## Preparación de la Funcionalidad

- [x] Todos los requisitos funcionales tienen criterios de aceptación claros
- [x] Las historias de usuario cubren los flujos principales
- [x] La funcionalidad satisface los resultados medibles de los Criterios de Éxito
- [x] No se filtran detalles de implementación en la especificación

## Notas

Resultado de la validación (iteración única, 2026-08-16):

- **Detalles de implementación**: la spec nombra `packages/shared` como origen de la función de
  normalización (FR-004, FR-014, FR-023) y usa `activo` / `disponible` como nombres de los dos
  interruptores. Ambas cosas vienen de la entrada del usuario y de E1, se explican en términos de
  negocio y no imponen lenguaje, framework ni contrato de API. Se acepta, con el mismo criterio con
  que `specs/001-acceso-y-usuarios/spec.md` referencia el código compartido.
- **Ambigüedad resuelta sin pregunta al usuario**: la entrada decía «partiendo la distribución de
  precios del catálogo activo en tercios», que admite dos lecturas —tercios por cantidad de
  productos o por rango de precio—. Se resolvió por cantidad (FR-032, supuesto 1), porque es la
  única compatible con las dos condiciones que la propia épica exige: que con menos de tres
  productos no haya tramos (RN-016) y que dos productos con el mismo precio caigan siempre en el
  mismo tramo. La alternativa descartada queda documentada.
- **Escenarios añadidos a los de la entrada**: HU14-E18 (reactivar categoría), HU14-E19 (dimensión
  sin categorías), HU02-E14 (catálogo grande) y HU02-E15 (reactivación bloqueada por categoría
  desactivada). Los cuatro cubren casos límite que la entrada declaraba en prosa pero dejaba sin
  criterio de aceptación.
- **Tres escenarios con verificación funcional condicionada** (HU02-E07, HU02-E08, HU02-E13 y el
  caso límite del carrito): dependen de E2, que aún no existe. Se declaran en
  § Entrega por fases con la mitad del contrato que E3 sí verifica. No es una omisión.
- **Columna de paso de validación**: la tabla de trazabilidad la incorporará cuando exista
  `quickstart.md`, que se redacta en la fase de planificación.
