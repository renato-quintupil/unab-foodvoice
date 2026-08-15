# Checklist de Calidad de la Especificación: E1 · Acceso y usuarios

**Propósito**: validar la completitud y calidad de la especificación antes de pasar a la planificación
**Creado**: 2026-08-14
**Funcionalidad**: [spec.md](../spec.md)

## Calidad del Contenido

- [x] Sin detalles de implementación (lenguajes, frameworks, APIs)
- [x] Enfocado en el valor para el usuario y las necesidades del negocio
- [x] Redactado para personas no técnicas
- [x] Todas las secciones obligatorias completadas

## Completitud de los Requisitos

- [x] No quedan marcadores [NEEDS CLARIFICATION]
- [x] Los requisitos son verificables y no ambiguos
- [x] Los criterios de éxito son medibles
- [x] Los criterios de éxito son agnósticos de la tecnología
- [x] Todos los escenarios de aceptación están definidos
- [x] Los casos límite están identificados
- [x] El alcance está claramente delimitado
- [x] Las dependencias y supuestos están identificados

## Preparación de la Funcionalidad

- [x] Todos los requisitos funcionales tienen criterios de aceptación claros
- [x] Los escenarios de usuario cubren los flujos principales
- [x] La funcionalidad cumple los resultados medibles definidos en Criterios de Éxito
- [x] Ningún detalle de implementación se filtra en la especificación

## Alineación con la Constitución de FoodVoice

- [x] **Principio I (Simplicidad ante todo)**: se eligió la opción más simple en cada decisión abierta (sesión uniforme de 30 min en lugar de por rol; correo único como identificador en lugar de correo o teléfono; sin exportación ni tiempo real; sin permisos granulares dentro del rol)
- [x] **Principio II (Todo en español)**: todos los mensajes visibles exigidos por FR-003, FR-014, FR-022 y los escenarios Gherkin están especificados en español
- [x] **Principio III (Cero alcance fantasma)**: la sección "Fuera de Alcance (v1)" delimita explícitamente lo que no se construye
- [x] **Principio IV (Verificable por una persona no técnica)**: SC-010 lo exige de forma explícita y cada historia declara su prueba independiente
- [x] **Principio V (Datos del usuario con respeto)**: FR-007, FR-016 y FR-028 prohíben contraseñas en texto plano y credenciales en el código
- [x] **Principio X (Privacidad y datos mínimos)**: se piden solo nombre, correo y teléfono; la voz queda explícitamente excluida de la autenticación
- [x] **Principio XI (Calidad guiada por especificación)**: los criterios de aceptación están en formato Gherkin antes de programar
- [x] **Principio XII (Trazabilidad del pedido)**: FR-023 obliga a consumir la máquina de estados de HU-03 sin redefinirla; RN-002 preserva el historial ante bajas

## Cobertura de las Historias de Usuario de la Épica

- [x] HU-08 · Autenticación y sesión → Historia de Usuario 1 (P1), FR-001 a FR-008, FR-024, FR-025, FR-030
- [x] HU-09 · Gestión de usuarios y roles → Historia de Usuario 2 (P2), FR-009 a FR-017, FR-026, FR-027, FR-028
- [x] HU-10 · Panel y reportes del administrador → Historia de Usuario 3 (P3), FR-018 a FR-023, FR-029
- [x] Frontera HU-10 vs. HU-07 respetada: el panel es de solo lectura (FR-021, RN-004, SC-015)

## Notas

- Los ítems marcados como incompletos requieren actualizar la spec antes de `/speckit-clarify` o `/speckit-plan`.
- **Resultado de la validación**: todos los ítems pasan en la primera iteración. Las once ambigüedades detectadas en la redacción inicial se resolvieron con la persona responsable del producto antes de escribir la spec, por lo que no quedan marcadores `[NEEDS CLARIFICATION]` y `/speckit-clarify` no es necesario.
- **Dependencia conocida y aceptada**: la verificación funcional de las métricas y reportes de pedidos de HU-10 (parte de FR-019, más FR-020 y FR-023) queda condicionada a la entrega de E4 y E2. Está documentada en la spec como entrega por fases, no como un vacío de especificación.
