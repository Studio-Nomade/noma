/**
 * Reglas puras del ciclo de las tareas en los tableros con canal de correo
 * (asignación y cierre hechos por el equipo). Ver task-lifecycle.ts.
 */

import { foldName } from "@/features/asana/custom-fields";

/** Stories del equipo que Noma procesa fuera de los comentarios. */
export const LIFECYCLE_SUBTYPES = [
  "assigned",
  "marked_complete",
  // Subtarea creada o movida dentro de una solicitud (pieza), o agregada
  // también al proyecto: Noma completa sus campos y evita el duplicado.
  "added_to_task",
  "added_to_project",
] as const;

/** Stories que ponen una subtarea (pieza) dentro de una solicitud. */
export function isPieceStory(story: { resource_subtype?: string | null }) {
  return (
    story.resource_subtype === "added_to_task" ||
    story.resource_subtype === "added_to_project"
  );
}

export function isLifecycleStory(story: { resource_subtype?: string | null }) {
  return (LIFECYCLE_SUBTYPES as readonly string[]).includes(
    story.resource_subtype ?? "",
  );
}

/** Estados iniciales que pasan a «Planificada» al asignar la tarea. */
const PLANNABLE = ["Por revisar"].map(foldName);

/** ¿Al asignarla, la tarea pasa a Planificada? Nunca retrocede un avance. */
export function shouldPlanOnAssign(estado: string | null | undefined) {
  if (!estado?.trim()) return true;
  return PLANNABLE.includes(foldName(estado));
}
