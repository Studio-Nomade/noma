# ADR-004 — Proveedores de IA centralizados

**Estado:** Aceptado · **Fecha:** 2026-07-30

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
- El botón "Generar con IA" de propuestas permanece **inerte** (stub).
- El agente de WhatsApp usa OpenAI Responses API mediante el mismo `LLMProvider`, con
  herramientas ejecutadas server-side y modelo configurable por `OPENAI_MODEL`.
- Email Studio activa un flujo acotado de visión server-side mediante Responses API:
  recibe una referencia PNG/JPG/WEBP o PDF y los assets públicos, devuelve un plan
  estructurado validado con Zod y no conserva la respuesta en OpenAI (`store: false`).
  Usa `EMAIL_STUDIO_OPENAI_MODEL` (default `gpt-5.6`) para no compartir la selección
  de modelo con otros agentes.
- La asistencia de Email Studio nunca bloquea el trabajo: si la API no está
  configurada o falla, se conserva y compila la estructura editada manualmente.
- Email Studio valida y compila el plan candidato antes de persistirlo, guarda un
  checkpoint recuperable y limita los intentos por usuario/hora mediante un
  bloqueo transaccional en Postgres.
- La observabilidad de Email Studio registra estado, modelo, tokens, duración e
  ID de respuesta. No almacena prompts, referencias firmadas ni la salida del
  modelo.

## Consecuencias

- El contrato se amplía sin exponer la API key al cliente y conserva la degradación cuando OpenAI
  no está configurado.
- Pendiente: activar la generación de propuestas y definir su presupuesto,
  límites de uso y observabilidad antes de escalar ese flujo.
