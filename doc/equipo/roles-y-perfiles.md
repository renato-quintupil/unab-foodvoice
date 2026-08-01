# Roles de Scrum y perfiles del equipo — FoodVoice

Este documento define la estructura de equipo del proyecto **FoodVoice** bajo el marco
de trabajo **Scrum** (Schwaber & Sutherland, 2020), distinguiendo entre las
**responsabilidades oficiales de Scrum** y los **perfiles técnicos** que se requieren
para construir el Mínimo Producto Viable (MPV).

> **Contexto académico:** FoodVoice es un proyecto de título unipersonal. El estudiante
> asume las tres responsabilidades de Scrum y todos los perfiles técnicos, separando
> los "sombreros" según el evento o la actividad en curso. Esta condición se documenta
> de forma explícita y no se oculta ante el tribunal evaluador.

---

## 1. Responsabilidades de Scrum (accountabilities)

La Guía de Scrum define **exactamente tres** responsabilidades. No existen roles
adicionales dentro del marco. Todo perfil técnico reside _dentro_ de los Developers.

### 1.1 Product Owner (PO)

Responsable de **maximizar el valor** del producto y único dueño del _Product Backlog_.

En FoodVoice:

- Prioriza las historias de usuario (HU-01 a HU-07) y decide el contenido de cada Sprint.
- Define y defiende el **alcance del MPV** ante el tribunal (por qué HU-05 y HU-07
  quedan fuera del primer incremento).
- Traduce el problema de negocio —las cinco causas raíz del diagrama de Ishikawa— en
  requisitos accionables.
- Establece los **criterios de aceptación** de cada historia.

### 1.2 Scrum Master (SM)

Responsable de que **Scrum se entienda y se aplique correctamente**. Es facilitador, no
jefe de proyecto.

En FoodVoice:

- Organiza y facilita los eventos: Sprint Planning, Daily, Sprint Review y Retrospective.
- Alinea los **hitos institucionales** (Sumativas S4, S8, S12) con las Sprint Reviews.
- Mantiene y actualiza el **plan de gestión de riesgos** (R-01 a R-10, según PMBOK).
- Remueve impedimentos y cuida la trazabilidad metodológica exigida por las rúbricas.

### 1.3 Developers (Equipo de Desarrollo)

Responsables de **construir un incremento de producto** utilizable en cada Sprint.
En un proyecto unipersonal, una sola persona cubre todos los perfiles técnicos
descritos en la sección 2.

---

## 2. Perfiles técnicos (dentro de Developers)

Los perfiles técnicos **no son roles de Scrum**: son competencias que residen dentro de
los Developers y que este proyecto necesita para su implementación. La **Arquitectura de
Software** es una de estas competencias transversales: no constituye un cuarto rol de Scrum,
sino la responsabilidad —dentro de los Developers— de dar coherencia técnica al sistema,
elaborar los diagramas y registrar las decisiones de arquitectura (ADR) que guían la
construcción del resto de perfiles.

| Perfil                                         | Tecnologías                          | Alcance en el MPV                                                        |
| ---------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| **Arquitectura de Software**                   | Diagramas C4/UML, ER, ADR; nube AWS  | Coherencia técnica transversal (web, móvil, servicios, base de datos e infraestructura) y decisiones de diseño |
| **Frontend Web**                               | Next.js + React + TypeScript + TailwindCSS + shadcn/ui | Interfaces de cliente, local comercial y administrador |
| **Desarrollo Móvil**                           | React Native + Expo + TypeScript + Expo Router + NativeWind | App del repartidor: geolocalización (`expo-location`) y mapa (`react-native-maps`) |
| **Backend / Base de datos**                    | NestJS + TypeScript, API REST (OpenAPI), PostgreSQL (Prisma/TypeORM) | **Dentro del MPV:** autenticación real y persistencia (HU-08); usuarios, pedidos, productos y estados |
| **Infraestructura / DevOps**                   | Terraform (IaC) sobre AWS (RDS, S3, CloudFront, VPC, IAM) | Aprovisionamiento de la infraestructura como código |
| **Diseño UI/UX**                               | Figma; design system y design tokens | Flujos, mockups y design system para web y móvil |
| **Integración de APIs de dispositivo**         | Web Speech API, Geolocation API      | Voz a texto (HU-06) y ubicación real (HU-04)                             |
| **QA / Aseguramiento de calidad**              | Checklist funcional                  | Validación de flujos críticos y controles definidos                      |

---

## 3. Estructura del monorepo y roles de usuarios

El proyecto se organiza como un **monorepo**. Cada área tiene un **usuario con rol especializado** con su directorio de trabajo. Los roles se
distinguen por nombre y descripción; no quedan aislados físicamente, sino acotados por sus responsabilidades.

| Carpeta          | Rol                | Responsabilidad Scrum | Perfil técnico                             |
| ---------------- | ------------------ | --------------------- | ------------------------------------------ |
| `apps/web`       | `web-frontend`     | Developer             | Frontend Web (Next.js + Tailwind + shadcn) |
| `apps/mobile`    | `mobile-dev`       | Developer             | Móvil (React Native + Expo + NativeWind)   |
| `design`         | `design-uiux`      | Developer             | UI/UX y design system (Figma)              |
| `services`       | `backend-services` | Developer             | Backend NestJS _(dentro del MPV: HU-08)_   |
| `infra`          | `infra-devops`     | Developer             | Infraestructura / DevOps (Terraform + AWS) |
| `package/shared` | `shared-libs`      | Developer             | Librerías y tipos compartidos              |
| _(transversal)_  | `software-architect` | Developer           | Arquitectura de Software                   |
| _(transversal)_  | `product-owner`    | Product Owner         | —                                          |
| _(transversal)_  | `scrum-master`     | Scrum Master          | —                                          |
| _(transversal)_  | `qa-tester`        | Developer             | QA / Calidad                               |

---

## 4. Referencias

- Schwaber, K., & Sutherland, J. (2020). _The Scrum Guide: The definitive guide to Scrum._ Scrum.org.
- Project Management Institute. (2021). _A guide to the project management body of knowledge (PMBOK guide)_ (7.ª ed.).
- Sommerville, I. (2016). _Software engineering_ (10.ª ed.). Pearson.
