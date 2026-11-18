import "server-only";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { devPrograms } from "@/db/schema";

/**
 * API de servicio del seguimiento (la usa Claude Code desde la máquina del
 * arquitecto). Un solo token del estudio en `DEV_TRACKING_API_TOKEN`, enviado
 * como `Authorization: Bearer …`. Sin token configurado, la API está apagada.
 */
export function checkDevTrackingToken(request: Request): boolean {
  const expected = process.env.DEV_TRACKING_API_TOKEN?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const given = header.replace(/^Bearer\s+/i, "").trim();
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function loadProgram(programId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(programId)) return null;
  const [program] = await db
    .select()
    .from(devPrograms)
    .where(eq(devPrograms.id, programId))
    .limit(1);
  return program ?? null;
}

export function unauthorized() {
  return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
}

export function notFound(what = "Programa") {
  return Response.json(
    { ok: false, error: `${what} no encontrado.` },
    { status: 404 },
  );
}
