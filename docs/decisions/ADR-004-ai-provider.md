# ADR-004 — Proveedores de IA centralizados

**Estado:** Reemplazado parcialmente · **Fecha:** 2026-07-26

## Contexto

El prototipo generaba propuestas con `InvokeLLM` de Base44. La generación con IA es el
diferenciador del producto, pero en V1 se decide **dejar solo la arquitectura lista** y
generar/editar propuestas a mano.

## Decisión

- **Interfaz `LLMProvider` intercambiable** (`src/lib/ai/provider.ts`) que define
  `generateProposal(input): ProposalSections`.
- Las cuentas API habilitables son **OpenAI** y **Gemini**, centralizadas a nivel Studio Nomade
  mediante `OPENAI_API_KEY` y `GEMINI_API_KEY`.
- No se conectan cuentas personales: una suscripción ChatGPT/Gemini no incluye cuota API.
- Anthropic queda fuera por decisión de producto.
- El contrato de salida es el `response_json_schema` con las 12 secciones de la propuesta
  (context, diagnosis, main_objective, specific_objectives, scope, work_stages, deliverables,
  timeline, client_requirements, exclusions, team, commercial_conditions).
- Las llamadas a la IA son **server-side** (server action / route); la API key nunca llega al
  cliente.
- En V1 el botón "Generar con IA" existe pero está **inerte** (stub) hasta activar la fase.

## Consecuencias

- Migrar de "manual" a "IA viva" no requiere refactor: se implementa el provider detrás del
  contrato estable y se conecta el flujo.
- Pendiente al activar: definir presupuesto/quién asume el costo de API y límites de uso.
