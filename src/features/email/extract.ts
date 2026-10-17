/**
 * Extracción estructurada de una solicitud recibida por correo.
 *
 * La llamada al modelo es inyectable (`generate`): en producción se pasa
 * `getLLMProvider().generateStructured` (OpenAI Responses API con JSON Schema
 * estricto); en tests, un mock. Si el modelo falla o no está configurado se usa
 * una extracción heurística para no bloquear la captura.
 */

import { z } from "zod";
import type { GenerateStructuredInput } from "@/lib/ai/provider";
import { extractUrls } from "./delivery-command";
import {
  STUDIO_TIME_ZONE,
  formatSpanishDate,
  localDateParts,
  normalizeDueDate,
  parseRelativeDueDate,
  toIsoDate,
} from "./dates";
import { cleanSubject } from "./folio";

export const TITLE_MAX_LENGTH = 90;
export const PRIORITIES = ["baja", "media", "alta", "urgente"] as const;
export type RequestPriority = (typeof PRIORITIES)[number];

export const emailExtractionSchema = z.object({
  title: z
    .string()
    .describe(
      "Título de la tarea en español, máx. 90 caracteres, frase nominal/imperativa (p. ej. 'Banner campaña Cyber para home'). Sin 'RE:', 'Fwd:' ni folios.",
    ),
  summary: z
    .string()
    .describe("Resumen de 1–3 oraciones de lo que pide el cliente."),
  details: z
    .array(z.string())
    .describe(
      "Viñetas con requisitos concretos: formatos, medidas, textos, referencias, restricciones.",
    ),
  requested_due_date: z
    .string()
    .nullable()
    .describe(
      "Fecha pedida por el cliente en formato YYYY-MM-DD o null si no la menciona. Resuelve fechas relativas contra la fecha del correo.",
    ),
  priority: z
    .enum(PRIORITIES)
    .describe("Prioridad inferida del tono y plazo del correo."),
  deliverable_type: z
    .string()
    .nullable()
    .describe(
      "Tipo de entregable o formato (p. ej. 'Mailing HTML', 'Post Instagram', 'Banner web') o null.",
    ),
  links: z
    .array(z.string())
    .describe("URLs relevantes mencionadas en el correo."),
});

export type EmailExtraction = z.infer<typeof emailExtractionSchema>;

export type EmailExtractionInput = {
  subject: string;
  fromName: string | null;
  fromEmail: string;
  date: Date;
  body: string;
  attachmentNames: string[];
  clientName: string;
};

export type StructuredGenerator = <T>(
  input: GenerateStructuredInput<T>,
) => Promise<T>;

export type ExtractionResult = {
  extraction: EmailExtraction;
  source: "llm" | "fallback";
  error: string | null;
};

const BODY_LIMIT = 12_000;

const INSTRUCTIONS = [
  "Eres el coordinador de solicitudes de Studio Nomade, un estudio de diseño y desarrollo.",
  "Recibes un correo de un cliente y lo conviertes en una tarea clara para el equipo.",
  "Responde siempre en español neutro de Chile y SOLO con el objeto estructurado.",
  "No inventes datos: si algo no está en el correo, usa null o una lista vacía.",
  "La fecha del correo se entrega en America/Santiago; úsala para resolver 'lunes AM', 'mañana', 'el 15', etc.",
  "Ignora firmas, avisos legales y texto citado de correos anteriores.",
].join("\n");

/** Título apto para Asana: sin prefijos de respuesta, folios ni etiquetas. */
export function sanitizeTitle(
  raw: string | null | undefined,
  fallback?: string | null,
): string {
  const clean = (value: string | null | undefined) => {
    let title = cleanSubject(value ?? "")
      .replace(/^\s*(\[[^\]]{1,20}\]\s*)+/, "") // [EXTERNAL], [EXT], [Externo]
      .replace(/^["'“”«»\s]+|["'“”«»\s]+$/g, "")
      .replace(/\s+/g, " ")
      .replace(/[\s.:;,–—-]+$/, "")
      .trim();
    title = cleanSubject(title);
    if (!title) return "";
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (title.length <= TITLE_MAX_LENGTH) return title;
    const cut = title.slice(0, TITLE_MAX_LENGTH - 1);
    const space = cut.lastIndexOf(" ");
    return `${(space > 40 ? cut.slice(0, space) : cut).replace(/[\s.:;,–—-]+$/, "")}…`;
  };
  return clean(raw) || clean(fallback) || "Solicitud sin título";
}

function firstParagraph(body: string) {
  const paragraph =
    body
      .split(/\n\s*\n/)
      .map((block) => block.replace(/\s+/g, " ").trim())
      .find((block) => block.length > 0) ?? "";
  return paragraph.length > 400 ? `${paragraph.slice(0, 399)}…` : paragraph;
}

/** Extracción sin IA: asunto como título, primer párrafo como resumen. */
export function fallbackExtraction(
  input: EmailExtractionInput,
): EmailExtraction {
  const haystack = `${input.subject}\n${input.body}`;
  return {
    title: sanitizeTitle(input.subject),
    summary: firstParagraph(input.body) || sanitizeTitle(input.subject),
    details: [],
    requested_due_date: parseRelativeDueDate(haystack, input.date),
    priority: /\b(urgente|urgencia|asap|lo antes posible)\b/i.test(haystack)
      ? "urgente"
      : "media",
    deliverable_type: null,
    links: extractUrls(input.body),
  };
}

/** Limpia y valida la salida del modelo (fecha, título, links). */
export function normalizeExtraction(
  raw: EmailExtraction,
  input: EmailExtractionInput,
): EmailExtraction {
  const links = extractUrls(...raw.links, input.body);
  return {
    title: sanitizeTitle(raw.title, input.subject),
    summary: raw.summary.trim() || firstParagraph(input.body),
    details: raw.details
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20),
    requested_due_date: normalizeDueDate(raw.requested_due_date, input.date),
    priority: PRIORITIES.includes(raw.priority) ? raw.priority : "media",
    deliverable_type: raw.deliverable_type?.trim() || null,
    links: links.slice(0, 20),
  };
}

export function buildExtractionPrompt(input: EmailExtractionInput): string {
  const local = localDateParts(input.date, STUDIO_TIME_ZONE);
  const localIso = toIsoDate(local);
  return [
    `Cliente: ${input.clientName}`,
    `Fecha del correo (America/Santiago): ${formatSpanishDate(localIso)} (${localIso})`,
    `De: ${input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail}`,
    `Asunto: ${input.subject}`,
    input.attachmentNames.length
      ? `Adjuntos: ${input.attachmentNames.join(", ")}`
      : "Adjuntos: ninguno",
    "",
    "Cuerpo:",
    input.body.slice(0, BODY_LIMIT),
  ].join("\n");
}

export async function extractEmailRequest(
  input: EmailExtractionInput,
  generate: StructuredGenerator | null,
): Promise<ExtractionResult> {
  if (!generate) {
    return {
      extraction: fallbackExtraction(input),
      source: "fallback",
      error: "IA no configurada",
    };
  }
  try {
    const raw = await generate({
      instructions: INSTRUCTIONS,
      input: buildExtractionPrompt(input),
      schema: emailExtractionSchema,
      schemaName: "email_request_extraction",
    });
    return {
      extraction: normalizeExtraction(raw, input),
      source: "llm",
      error: null,
    };
  } catch (error) {
    return {
      extraction: fallbackExtraction(input),
      source: "fallback",
      error:
        error instanceof Error ? error.message.slice(0, 300) : "Error de IA",
    };
  }
}
