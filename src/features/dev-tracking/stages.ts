/**
 * Etapas de trabajo de una solicitud, informadas por el arquitecto (Claude
 * Code) y reflejadas por Noma en el tablero de Asana del programa. Módulo puro.
 *
 * Flujo del tablero: Solicitudes / Inbox → Backlog priorizado → En curso →
 * Validación / QA → Completadas → «<Mes> (cerradas)».
 */

export const STAGES = [
  "priorizado",
  "en_desarrollo",
  "en_qa",
  "con_ajustes",
  "cerrado",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  priorizado: "Priorizada",
  en_desarrollo: "En desarrollo",
  en_qa: "En QA",
  con_ajustes: "Con ajustes",
  cerrado: "Cerrada",
};

/** Opción del campo «Estado», sección y «¿Ticket Activo?» en Asana. */
export const STAGE_ASANA: Record<
  Stage,
  { estado: string; section: string; ticketActivo: string[] }
> = {
  priorizado: {
    estado: "Priorizado",
    section: "Backlog priorizado",
    ticketActivo: ["Si", "Sí"],
  },
  en_desarrollo: {
    estado: "En desarrollo",
    section: "En curso",
    ticketActivo: ["Si", "Sí"],
  },
  en_qa: {
    estado: "En QA",
    section: "Validación / QA",
    ticketActivo: ["Si", "Sí"],
  },
  con_ajustes: {
    estado: "Con ajustes",
    section: "En curso",
    ticketActivo: ["Si", "Sí"],
  },
  cerrado: {
    estado: "Cerrado",
    section: "Completadas",
    ticketActivo: ["Finalizado"],
  },
};

/** Nombre de la tarea en Asana: «R76 · título» (el roadmap va adelante). */
export function asanaTaskName(title: string, roadmapCode: string | null) {
  return roadmapCode ? `${roadmapCode} · ${title}` : title;
}

/** Una solicitud revisada genera tarea salvo que ya exista en la plataforma. */
export function needsAsanaTask(item: {
  verdict: string | null;
  asanaTaskGid: string | null;
}) {
  return !item.asanaTaskGid && !!item.verdict && item.verdict !== "ya_existe";
}
