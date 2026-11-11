/**
 * Equipo en copia de las entregas y consultas: quien comenta en Asana (el que
 * ejecuta) y el responsable de la tarea (quien supervisa) quedan en el hilo
 * con el cliente para dar seguimiento. Solo direcciones del estudio.
 * Módulo puro.
 */

import { domainOf, normalizeEmail } from "./addresses";

/** Máximo de copias en el hilo (cliente + equipo). */
export const MAX_THREAD_CC = 12;

export function deliveryCc(input: {
  requestCc: readonly string[];
  commenterEmail: string | null;
  assigneeEmail: string | null;
  studioDomain: string;
  /** Solicitante y direcciones propias (alias, casilla): nunca en copia. */
  exclude: readonly string[];
}): string[] {
  const studio = input.studioDomain.trim().toLowerCase();
  const excluded = new Set(input.exclude.map(normalizeEmail));
  const out: string[] = [];
  const push = (email: string | null) => {
    if (!email) return;
    const normalized = normalizeEmail(email);
    if (!normalized.includes("@") || excluded.has(normalized)) return;
    if (out.includes(normalized)) return;
    out.push(normalized);
  };
  // El equipo va primero para que el tope nunca lo deje fuera.
  for (const email of [input.commenterEmail, input.assigneeEmail]) {
    if (email && domainOf(email) === studio) push(email);
  }
  for (const email of input.requestCc) push(email);
  return out.slice(0, MAX_THREAD_CC);
}
