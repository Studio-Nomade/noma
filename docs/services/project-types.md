# Tipos de proyecto por área (propuesta para desplegable)

Derivado del levantamiento de los 94 presupuestos (ver services-by-area.md). El
campo **Tipo de Proyecto** del modal de proyecto debe ser un **desplegable
dependiente del área** (no texto libre). Propuesta de opciones por área:

## B&D · Branding & Design

- Desarrollo de Marca / Identidad
- Rediseño / Refresh de Marca
- Manual de Marca
- Naming
- Packaging
- Editorial & Presentaciones
- Papelería & Implementación
- Gestión de RRSS / Marketing Digital
- Merchandising

## WD · Web Design

- Diseño y Desarrollo Web
- Rediseño Web
- Landing / Minisitio
- E-commerce
- Migración Web
- Mantención Web
- SEO / Google Ads

## A&A · Audiovisual & Animation

- Video Corporativo
- Comercial / Spot
- Cápsula / Documental
- Cobertura de Evento
- Animación / Motion Graphics
- Fotografía / Sesión

## A&D · Architecture & Design

- Diseño de Stand / Ferias
- Interiorismo / Remodelación
- Memoria Constructiva
- Supervisión & Ejecución de Obra
- Render & Modelado 3D
- Packaging (con B&D)

## CE · Clínica de Emprendimientos

- Branding para Emprendimientos
- Identidad Express
- Plan Clínica de Emprendimiento

## MP · Mercado Público

- Producción Gráfica / Impresión
- Licitación / Mercado Público
- Gestión RRSS Sector Público

## Implementación sugerida

- Definir `PROJECT_TYPES_BY_AREA: Record<Area, string[]>` en `src/types/enums.ts`.
- En el modal de proyecto, el desplegable **Tipo de Proyecto** se filtra por el
  área seleccionada.
- Relacionado (mismo modal): **Responsable** = desplegable de `team_members`
  (usuarios de GSuite, Fase 6) y **Etapa comercial** = pipeline ordenado
  (`COMMERCIAL_STAGES` ya existe; ver nota de pipeline abajo).

> **Pipeline**: el orden actual `Nuevo lead → Levantamiento → Diagnóstico →
Propuesta → Negociación → Aprobado → Perdido/Stand by` sirve como pipeline. Se
> puede visualizar como tablero (kanban) en el Dashboard (Fase 5) para que avance
> con el cliente.
