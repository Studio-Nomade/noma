import { ZodError } from "zod";

/** Resultado tipado de una server action (para feedback inline en la UI). */
export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string };

/**
 * Normaliza errores de server actions:
 * - Re-lanza los errores de control de Next (redirect / notFound) para no romperlos.
 * - Devuelve el primer mensaje de validación de Zod (seguro de mostrar).
 * - Para cualquier otro error: lo registra en el servidor y devuelve un mensaje
 *   genérico (no se filtran detalles internos/DB al cliente).
 */
export function handleActionError(
  err: unknown,
  context: string,
): {
  ok: false;
  error: string;
} {
  if (isNextControlFlowError(err)) throw err;

  if (err instanceof ZodError) {
    return { ok: false, error: err.issues[0]?.message ?? "Datos inválidos." };
  }

  console.error(`[action:${context}]`, err);
  return {
    ok: false,
    error: "No se pudo completar la operación. Intenta nuevamente.",
  };
}

/** Detecta los errores especiales que Next usa para redirect()/notFound(). */
function isNextControlFlowError(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("digest" in err)) return false;
  const digest = String((err as { digest: unknown }).digest);
  return digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND";
}
