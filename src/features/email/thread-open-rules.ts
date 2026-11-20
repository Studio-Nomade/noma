/**
 * Apertura automática del hilo de correo al crear una tarea en un proyecto
 * con canal (spec del 20-11, modelo A). Cuando la tarea tiene «Correo de
 * contacto», Noma registra la solicitud con folio y le envía al contacto
 * «Solicitud registrada · [FOLIO] Título»: ese correo pasa a ser el hilo de la
 * solicitud (ENTREGA, CONSULTA, COMENTARIO, CLIENTE y la aprobación por
 * correo). Módulo puro.
 */

import { normalizeEmail } from "./addresses";

/** Campo de Asana con el correo del contacto del cliente. */
export const CONTACT_FIELD = "Correo de contacto";

/** Clave de idempotencia de la solicitud abierta desde una tarea. */
export function taskSourceKey(taskGid: string) {
  return `asana-task:${taskGid}`;
}

/**
 * Solo tareas creadas desde que existe la apertura automática: una tarea
 * antigua con «Correo de contacto» no debe escribirle al cliente.
 * NOMA_THREAD_OPEN_SINCE lo ajusta (ISO).
 */
export const THREAD_OPEN_SINCE_DEFAULT = "2026-11-21T03:00:00.000Z";

export function threadOpenSince(
  env: Record<string, string | undefined> = process.env,
) {
  return env.NOMA_THREAD_OPEN_SINCE?.trim() || THREAD_OPEN_SINCE_DEFAULT;
}

/** «[EQX-NOV-0601] Título»: la tarea ya tiene folio de Noma. */
const FOLIO_NAME_RE = /^\s*\[[A-Z][A-Z0-9]{0,9}-[A-Z]{3,4}-\d{2,6}\]/;

export function hasNomaFolio(name: string | null | undefined) {
  return FOLIO_NAME_RE.test(name ?? "");
}

/** Título limpio de la tarea (sin corchetes iniciales ni espacios extra). */
export function cleanTaskTitle(name: string | null | undefined) {
  return (name ?? "")
    .replace(/^\s*\[[^\]]*\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function openedTaskName(folio: string, title: string) {
  return `[${folio}] ${title}`;
}

export function openedSubject(folio: string, title: string) {
  return `Solicitud registrada · [${folio}] ${title}`.slice(0, 250);
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

/** Primer correo válido del campo (admite «Nombre <correo>» o varios). */
export function contactEmailFrom(value: string | null | undefined) {
  for (const raw of (value ?? "").split(/[\s,;]+/)) {
    const candidate = raw.replace(/^<|>$/g, "").trim();
    if (EMAIL_RE.test(candidate)) return normalizeEmail(candidate);
  }
  return null;
}

export type ThreadOpenDecision =
  | { open: true; contactEmail: string; title: string }
  | {
      open: false;
      reason:
        | "subtarea"
        | "completada"
        | "con_folio"
        | "sin_contacto"
        | "sin_titulo"
        | "anterior";
    };

/** ¿Noma abre el hilo de esta tarea? */
export function decideThreadOpen(input: {
  name: string | null | undefined;
  completed: boolean;
  isSubtask: boolean;
  contactField: string | null | undefined;
  createdAt: string | null | undefined;
  since: string;
}): ThreadOpenDecision {
  if (input.isSubtask) return { open: false, reason: "subtarea" };
  if (input.completed) return { open: false, reason: "completada" };
  // Las tareas que crea el flujo de correo ya nacen con folio y con hilo.
  if (hasNomaFolio(input.name)) return { open: false, reason: "con_folio" };
  const created = Date.parse(input.createdAt ?? "");
  const since = Date.parse(input.since);
  if (
    Number.isFinite(since) &&
    (!Number.isFinite(created) || created < since)
  ) {
    return { open: false, reason: "anterior" };
  }
  const contactEmail = contactEmailFrom(input.contactField);
  if (!contactEmail) return { open: false, reason: "sin_contacto" };
  const title = cleanTaskTitle(input.name);
  if (title.length < 3) return { open: false, reason: "sin_titulo" };
  return { open: true, contactEmail, title };
}

/** Resumen corto de la descripción de la tarea para el correo. */
export function summaryFromNotes(notes: string | null | undefined, max = 600) {
  const text = (notes ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
