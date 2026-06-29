# ADR-004 — Proveedor de IA para propuestas

**Estado:** Aceptado (arquitectura) · **Fecha:** 2026-06-29

## Contexto

El prototipo generaba propuestas con `InvokeLLM` de Base44. La generación con IA es el
diferenciador del producto, pero en V1 se decide **dejar solo la arquitectura lista** y
generar/editar propuestas a mano.

## Decisión

- **Interfaz `LLMProvider` intercambiable** (`src/lib/ai/provider.ts`) que define
  `generateProposal(input): ProposalSections`. Implementación por defecto: **Anthropic Claude**
  (`claude-opus-4-8`, alternativa `claude-sonnet-4-6`); OpenAI swappable detrás de la misma
  interfaz.
- El contrato de salida es el `response_json_schema` con las 12 secciones de la propuesta
  (context, diagnosis, main_objective, specific_objectives, scope, work_stages, deliverables,
  timeline, client_requirements, exclusions, team, commercial_conditions).
- Las llamadas a la IA son **server-side** (server action / route); la API key nunca llega al
  cliente.
- En V1 el botón "Generar con IA" existe pero está **inerte** (stub) hasta activar la fase.

## Consecuencias

- Migrar de "manual" a "IA viva" no requiere refactor: se implementa el provider y se conecta
  el botón.
- Pendiente al activar: definir presupuesto/quién asume el costo de API y límites de uso.
