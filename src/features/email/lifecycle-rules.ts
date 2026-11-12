/**
 * Reglas puras del ciclo de las tareas en los tableros con canal de correo
 * (asignación y cierre hechos por el equipo). Ver task-lifecycle.ts.
 */

import { foldName } from "@/features/asana/custom-fields";

/** Stories del equipo que Noma procesa fuera de los comentarios. */
export const LIFECYCLE_SUBTYPES = ["assigned", "marked_complete"] as const;

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
