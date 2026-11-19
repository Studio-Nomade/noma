import { z } from "zod";
import { MILESTONE_STATUSES } from "./constants";
import { STAGES } from "./stages";

/**
 * Lo que el arquitecto (Claude Code) le devuelve a Noma (`POST …/resultados`).
 * Módulo puro: el schema se prueba sin base de datos.
 */

const moduleSchema = z.object({
  codigo: z.string().min(2).max(40),
  nombre: z.string().min(2).max(200).optional(),
  objetivo: z.string().max(2000).optional(),
  inicio: z.string().date().optional(),
  entrega_objetivo: z.string().date().optional(),
  avance: z.number().int().min(0).max(100).optional(),
  criterio: z.string().max(1000).optional(),
  pelota: z
    .object({
      quien: z.string().max(200).optional(),
      que: z.string().max(2000).optional(),
    })
    .optional(),
  proximo_seguimiento: z.string().date().optional(),
  en_produccion: z.array(z.string().max(500)).optional(),
  pendientes: z.array(z.string().max(500)).optional(),
  hitos: z
    .array(
      z.object({
        nombre: z.string().min(1).max(200),
        estado: z.enum(MILESTONE_STATUSES),
        fecha: z.string().date().optional(),
        asana_gid: z.string().max(40).optional(),
        prs: z.array(z.string().max(60)).optional(),
      }),
    )
    .optional(),
});

export const roadmapSchema = z.object({
  codigo: z.string().min(2).max(40),
  titulo: z.string().max(200).optional(),
  tipo: z.enum(["modulo", "mejora", "correccion"]).optional(),
  estado: z.enum(["en_prod", "parcial", "pendiente"]).optional(),
  mes: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

const VERDICTS = [
  "ya_existe",
  "bug",
  "requiere_desarrollo",
  "bloqueada",
] as const;

/**
 * Solicitud que no vino en un paquete (WhatsApp, correo, llamada): el
 * arquitecto la registra al implementarla. Idempotente por `id` dentro del
 * programa: reenviarla actualiza la misma solicitud.
 */
export const newRequestSchema = z.object({
  id: z.string().min(2).max(20), // R77-S1
  origen: z
    .enum(["whatsapp", "correo", "llamada", "reunion", "otro"])
    .default("whatsapp"),
  fecha: z.string().date().optional(),
  solicitante: z.string().max(200).optional(),
  area: z.string().max(60).optional(),
  titulo: z.string().min(3).max(300),
  detalle: z.string().max(4000).optional(),
  veredicto: z.enum(VERDICTS),
  // Igual que en `solicitudes`: código propio, `null` o el principal.
  roadmap: z.string().max(40).nullable().optional(),
  hito: z.string().max(40).optional(),
  estado: z.enum(STAGES).optional(),
  tipo: z.string().max(60).optional(),
  prioridad: z.enum(["Normal", "Media", "Alta", "Crítica"]).optional(),
  entorno: z.string().max(40).optional(),
  evidencia: z.string().max(1000).optional(),
  asana_gid: z.string().max(40).optional(),
  nota: z.string().max(2000).optional(),
});

export type NewRequest = z.infer<typeof newRequestSchema>;

export const resultSchema = z.object({
  paquete: z.string().max(40).optional(),
  /** Roadmap principal de la sesión (también vale para las solicitudes sin `roadmap`). */
  roadmap: roadmapSchema.optional(),
  /** Otros roadmaps o módulos que la sesión crea o actualiza. */
  roadmaps: z.array(roadmapSchema).max(20).default([]),
  solicitudes: z
    .array(
      z.object({
        id: z.string().min(2).max(20), // CO-01
        // Primera revisión: el veredicto. Después (merge, deploy) basta `estado`.
        veredicto: z.enum(VERDICTS).optional(),
        // Roadmap o módulo de esta solicitud (R76, NDes-006). `null` = sin
        // roadmap. Si se omite, toma el `roadmap` principal.
        roadmap: z.string().max(40).nullable().optional(),
        hito: z.string().max(40).optional(),
        // Etapa de trabajo; Noma la refleja en Asana (Estado y sección).
        estado: z.enum(STAGES).optional(),
        asana_gid: z.string().max(40).optional(),
        nota: z.string().max(2000).optional(),
      }),
    )
    .default([]),
  /** Solicitudes fuera de paquete (WhatsApp…): Noma las crea o actualiza. */
  solicitudes_nuevas: z.array(newRequestSchema).max(50).default([]),
  preguntas_nuevas: z
    .array(
      z.object({
        pregunta: z.string().min(3).max(1000),
        para: z.string().max(200).optional(),
        bloquea: z.string().max(100).optional(),
      }),
    )
    .default([]),
  modulos: z.array(moduleSchema).default([]),
  bitacora: z
    .array(
      z.object({
        modulo: z.string().max(40).optional(),
        texto: z.string().min(3).max(2000),
      }),
    )
    .default([]),
  desplegado: z
    .array(
      z.object({
        repo: z.string().min(2).max(80),
        numero: z.number().int().positive().optional(),
        titulo: z.string().max(300).optional(),
        fecha: z.string().date().optional(),
        roadmap: z.string().max(40).optional(),
      }),
    )
    .default([]),
});

export type ArchitectResult = z.infer<typeof resultSchema>;
