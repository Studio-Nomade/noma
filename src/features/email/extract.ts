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
/** Canales que la IA puede reconocer (se mapean a opciones de Asana). */
export const REQUEST_CHANNELS = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "TikTok",
  "YouTube",
  "Email",
  "Web",
  "PDF - Documento",
  "Impreso",
  "Otro",
] as const;
export type RequestChannel = (typeof REQUEST_CHANNELS)[number];

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
  // ── Campos para la confirmación al cliente y Asana (v2) ──
  requester_first_name: z
    .string()
    .nullable()
    .describe(
      "Nombre de pila de quien escribe, tomado de la firma o el saludo (p. ej. 'Ana'), o null.",
    ),
  end_client: z
    .string()
    .nullable()
    .describe(
      "Marca o empresa para la que es la pieza cuando quien escribe es una agencia intermediaria (p. ej. 'Marca B'), o null si es el mismo cliente.",
    ),
  channels: z
    .array(z.enum(REQUEST_CHANNELS))
    .describe("Canales o formatos de publicación mencionados o evidentes."),
  format: z
    .string()
    .nullable()
    .describe(
      "Formato, medidas o duración pedidos (p. ej. 'Video 16:9 · 1:30', 'Post 1080x1350'), o null.",
    ),
  structure: z
    .object({
      title: z
        .string()
        .describe(
          "Nombre de la lista en 2–4 palabras (p. ej. 'Orden de las cuñas', 'Guion', 'Láminas').",
        ),
      items: z
        .array(
          z.object({
            title: z
              .string()
              .describe("Elemento en pocas palabras (p. ej. un nombre)."),
            detail: z
              .string()
              .nullable()
              .describe("Cargo, texto o aclaración breve, o null."),
            links: z
              .array(
                z.object({
                  label: z
                    .string()
                    .describe(
                      "Nombre corto del link (p. ej. 'Video parte 1'). Nunca la URL.",
                    ),
                  url: z.string(),
                  note: z
                    .string()
                    .nullable()
                    .describe(
                      "Tramo, minuto o aclaración (p. ej. '0:12 al 1:00'), o null.",
                    ),
                }),
              )
              .describe("Links de ese elemento."),
          }),
        )
        .describe("Elementos en el orden pedido."),
    })
    .nullable()
    .describe(
      "Lista ordenada que el cliente pide respetar (cuñas, guion, láminas, piezas), o null si no hay orden explícito.",
    ),
  considerations: z
    .array(z.string())
    .describe(
      "Indicaciones a respetar, una por viñeta en frase completa (subtítulos, logos, tono…).",
    ),
  materials: z
    .array(
      z.object({
        label: z
          .string()
          .describe(
            "Qué es, en pocas palabras (p. ej. 'Carpeta con fotos de la jornada').",
          ),
        url: z.string(),
        kind: z
          .string()
          .describe("Tipo corto: 'Drive', 'Carpeta', 'Referencia', 'Video'…"),
      }),
    )
    .describe(
      "Links de material de apoyo o referencias que NO están ya dentro de structure.",
    ),
  missing_info: z
    .array(z.string())
    .describe(
      "Datos que faltan para producir la pieza y que conviene pedir al cliente (máx. 3; p. ej. 'Fecha ideal de entrega'). Vacío si está todo.",
    ),
});

export type EmailExtraction = z.infer<typeof emailExtractionSchema>;
export type ExtractionStructure = NonNullable<EmailExtraction["structure"]>;

/**
 * Completa una extracción guardada antes de la v2 (sin los campos nuevos),
 * para que los eventos en curso se puedan reanudar sin volver a la IA.
 */
export function completeExtraction(
  raw: Partial<EmailExtraction> & Pick<EmailExtraction, "title" | "summary">,
): EmailExtraction {
  return {
    title: raw.title,
    summary: raw.summary,
    details: raw.details ?? [],
    requested_due_date: raw.requested_due_date ?? null,
    priority: raw.priority ?? "media",
    deliverable_type: raw.deliverable_type ?? null,
    links: raw.links ?? [],
    requester_first_name: raw.requester_first_name ?? null,
    end_client: raw.end_client ?? null,
    channels: raw.channels ?? [],
    format: raw.format ?? null,
    structure: raw.structure ?? null,
    considerations: raw.considerations ?? [],
    materials: raw.materials ?? [],
    missing_info: raw.missing_info ?? [],
  };
}

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
  "El resumen se le muestra al cliente como 'Qué entendimos': escríbelo en primera persona plural del estudio, claro y sin repetir la lista de structure.",
  "Si el correo trae links sin nombre visible, ponles un nombre corto según el contexto; nunca uses la URL como nombre.",
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
    requester_first_name: input.fromName?.trim().split(/\s+/)[0] || null,
    end_client: null,
    channels: [],
    format: null,
    structure: null,
    considerations: [],
    materials: [],
    missing_info: [],
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
    requester_first_name:
      clean(raw.requester_first_name)?.split(/\s+/)[0] ||
      input.fromName?.trim().split(/\s+/)[0] ||
      null,
    end_client: clean(raw.end_client),
    channels: [...new Set(raw.channels ?? [])].filter((channel) =>
      (REQUEST_CHANNELS as readonly string[]).includes(channel),
    ),
    format: clean(raw.format),
    structure: normalizeStructure(raw.structure),
    considerations: cleanList(raw.considerations, 12),
    materials: (raw.materials ?? [])
      .map((item) => ({
        label: item.label.trim(),
        url: safeUrl(item.url),
        kind: item.kind.trim() || "Link",
      }))
      .filter((item): item is { label: string; url: string; kind: string } =>
        Boolean(item.label && item.url),
      )
      .slice(0, 12),
    missing_info: cleanList(raw.missing_info, 3),
  };
}

function clean(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function cleanList(values: string[] | null | undefined, max: number) {
  return (values ?? [])
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Solo links http(s) externos; nunca links internos de Asana. */
function safeUrl(url: string | null | undefined) {
  return extractUrls(url ?? "")[0] ?? null;
}

function normalizeStructure(
  structure: EmailExtraction["structure"] | undefined,
): EmailExtraction["structure"] {
  if (!structure?.items?.length) return null;
  const items = structure.items
    .map((item) => ({
      title: item.title.trim(),
      detail: clean(item.detail),
      links: item.links
        .map((link) => ({
          label: link.label.trim() || "Link",
          url: safeUrl(link.url),
          note: clean(link.note),
        }))
        .filter(
          (link): link is { label: string; url: string; note: string | null } =>
            Boolean(link.url),
        ),
    }))
    .filter((item) => item.title)
    .slice(0, 20);
  if (!items.length) return null;
  return { title: clean(structure.title) ?? "Estructura", items };
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
