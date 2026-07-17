"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import {
  mapHeaders,
  normalizeRow,
  normalizeRut,
  isRealRut,
  type RawRow,
} from "./import";
import type { ClientStatus } from "@/types/enums";

const MAX_ROWS = 2000;

export type ImportSummary = {
  creados: number;
  actualizados: number;
  errores: { fila: number; motivo: string }[];
  ignoradas: string[]; // columnas del CSV que no se reconocieron
};

/**
 * Carga masiva de clientes desde las filas ya parseadas de un CSV.
 *
 * Deduplica por RUT solo cuando es un RUT real: los comodines contables
 * (55.555.555-5, etc.) los comparten clientes distintos, así que se insertan
 * como nuevos en vez de pisarse entre sí.
 *
 * En una actualización solo se tocan los campos que trae el CSV: nunca borra
 * datos existentes con celdas vacías.
 */
export async function importClients(
  rows: RawRow[],
): Promise<ActionResult<ImportSummary>> {
  try {
    const user = await requireUser();
    if (!rows.length) return { ok: false, error: "El archivo no tiene filas." };
    if (rows.length > MAX_ROWS) {
      return {
        ok: false,
        error: `Demasiadas filas (${rows.length}). El máximo es ${MAX_ROWS}.`,
      };
    }

    const { map, ignored } = mapHeaders(Object.keys(rows[0]));
    if (!Object.values(map).includes("companyName")) {
      return {
        ok: false,
        error:
          "No se encontró la columna del nombre del cliente. Descarga la plantilla para ver el formato.",
      };
    }

    // Índice de RUTs reales ya existentes → id, para decidir insert vs update.
    const existing = await db
      .select({ id: clients.id, rut: clients.rut })
      .from(clients);
    const byRut = new Map<string, string>();
    for (const c of existing) {
      if (isRealRut(c.rut)) byRut.set(normalizeRut(c.rut)!, c.id);
    }

    const summary: ImportSummary = {
      creados: 0,
      actualizados: 0,
      errores: [],
      ignoradas: ignored,
    };

    for (let i = 0; i < rows.length; i++) {
      const fila = i + 2; // +1 encabezado, +1 base 1 (como lo ve el usuario)
      const d = normalizeRow(rows[i], map);

      if (!d.companyName) {
        summary.errores.push({ fila, motivo: "Sin nombre de cliente." });
        continue;
      }

      const values = {
        companyName: d.companyName,
        rut: d.rut ?? null,
        legalName: d.legalName ?? null,
        email: d.email ?? null,
        phone: d.phone ?? null,
        industry: d.industry ?? null,
        taxActivity: d.taxActivity ?? null,
        taxAddress: d.taxAddress ?? null,
        comuna: d.comuna ?? null,
        region: d.region ?? null,
        website: d.website ?? null,
        instagram: d.instagram ?? null,
        linkedin: d.linkedin ?? null,
        billingEmail: d.billingEmail ?? null,
        internalNotes: d.internalNotes ?? null,
      };

      try {
        const key = isRealRut(d.rut) ? normalizeRut(d.rut) : null;
        const existingId = key ? byRut.get(key) : undefined;

        if (existingId) {
          // Solo sobrescribe lo que viene con valor: no borra datos previos.
          const patch = Object.fromEntries(
            Object.entries(values).filter(([, v]) => v !== null),
          );
          await db
            .update(clients)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(clients.id, existingId));
          summary.actualizados++;
        } else {
          const [row] = await db
            .insert(clients)
            .values({
              ...values,
              // normalizeRow solo conserva `status` si coincide con CLIENT_STATUSES.
              status: (d.status as ClientStatus) ?? "Prospecto",
              createdBy: user.id,
            })
            .returning({ id: clients.id });
          if (key) byRut.set(key, row.id); // evita duplicar dentro del mismo CSV
          summary.creados++;
        }
      } catch (err) {
        console.error("[importClients:" + fila + "]", err);
        summary.errores.push({
          fila,
          motivo: `No se pudo guardar "${d.companyName}".`,
        });
      }
    }

    await logActivity({
      entityType: "client",
      action: `bulk_import:${summary.creados}+${summary.actualizados}`,
      actorId: user.id,
    });

    revalidatePath("/clients");
    return { ok: true, data: summary };
  } catch (err) {
    return handleActionError(err, "importClients");
  }
}
