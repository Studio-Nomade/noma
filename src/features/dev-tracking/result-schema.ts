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
        veredicto: z
          .enum(["ya_existe", "bug", "requiere_desarrollo", "bloqueada"])
          .optional(),
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
