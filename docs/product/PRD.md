# PRD · Noma v1.0

## 1. Descripción

Noma es la plataforma de gestión interna de Studio Nomade. Centraliza el ciclo de vida
comercial y operativo del estudio: desde el primer contacto con un prospecto hasta la entrega
de una propuesta comercial. Reemplaza planillas, documentos sueltos, conversaciones dispersas
y carpetas desordenadas, unificando clientes, proyectos, briefs, propuestas y biblioteca de
servicios.

## 2. Objetivo

Proveer al equipo una herramienta interna, rápida y sin fricción para:

- Registrar y gestionar clientes y prospectos.
- Crear y seguir proyectos desde el levantamiento hasta el cierre.
- Documentar briefs estructurados por área.
- Generar propuestas comerciales consistentes (con IA en fase futura).
- Mantener una biblioteca de servicios viva (precios en UF).
- Tener visibilidad del pipeline en un dashboard operativo.

## 3. Problema que resuelve

| Problema                             | Impacto                               |
| ------------------------------------ | ------------------------------------- |
| Información de clientes dispersa     | Pérdida de contexto, datos duplicados |
| Briefs sin estructura                | Propuestas incompletas, reproceso     |
| Propuestas desde cero cada vez       | Tiempo excesivo, inconsistencia       |
| Sin visibilidad del pipeline         | Dificulta priorización y seguimiento  |
| Servicios sin precio ni entregables  | Cotizaciones inconsistentes           |
| Documentos/SLA/presupuestos en Drive | Procesos no estandarizados            |

## 4. Usuarios

Uso **interno** del equipo de Studio Nomade. Roles:

- **Admin** (directores/socios): acceso total, configuración y biblioteca de servicios.
- **User** (ejecutivos, líderes de área): crear/editar clientes, proyectos, briefs, propuestas.

En V1 todos ven todo (ver [ADR-003](../decisions/ADR-003-auth-permisos.md)).

## 5. Áreas del estudio

B&D Branding & Design · WD Web Design · A&D Architecture & Design · A&A Audiovisual &
Animation · CE Clínica de Emprendimientos · SN Studio Nomade (Operations & Governance).

## 6. Módulos del MVP

| Módulo                | Descripción                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| Dashboard             | Métricas + próximas acciones/entregas + pipeline + actividad reciente       |
| Clientes              | Registro y gestión de clientes/prospectos e historial de proyectos          |
| Proyectos             | Seguimiento operativo y comercial, prioridad, próxima acción, links         |
| Briefs                | Formularios por área (general + específicos en JSON)                        |
| Propuestas            | Secciones editables, selección de servicios, estados, versiones (IA futura) |
| Servicios             | Biblioteca por área con entregables, tiempos y precios en UF                |
| Configuración         | Datos del estudio, equipo, plantilla de condiciones                         |
| Onboarding + Contexto | Perfiles, procesos, mapa de herramientas, carga de documentos               |

## 7. Fuera de alcance (V1)

Portal cliente · firma digital · facturación · gestión de tareas/subtareas · chat interno ·
integraciones automáticas (Google/Asana/Slack) · notificaciones automáticas · PDF
pixel-perfect · timetracking · generación con IA "viva". Todo queda **preparado en
arquitectura** (ver [roadmap](roadmap.md) y [product-scope](product-scope.md)).

## 8. Criterios de éxito

- 100% de clientes activos registrados en Noma.
- Todo proyecto nuevo se crea en Noma desde el primer contacto.
- Cada propuesta se prepara en Noma (no desde cero).
- Estado del pipeline visible en el dashboard en < 10 s.
- Preparar una propuesta estándar toma < 30 min.
- Biblioteca de servicios con precios reales (UF) actualizados.
