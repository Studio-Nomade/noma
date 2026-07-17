"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cobranzaMessages, cobranzaTemplates } from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { sendGmail } from "@/features/email/gmail";
import type { CobranzaMoment } from "@/types/enums";
import { resolveCobranzaSender } from "./sender";

function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

function revalidate() {
  revalidatePath("/finanzas/cobranza");
  revalidatePath("/finanzas");
}

/**
 * Envía (o encola) un correo de cobranza desde la casilla configurada (sales@).
 * Si el remitente no está autorizado o falta config de Google, guarda el mensaje
 * como PENDIENTE con el motivo — no falla el flujo. Se puede reenviar luego.
 */
export async function sendCobranza(input: {
  clientId?: string;
  projectId?: string;
  invoiceId?: string;
  templateId?: string;
  moment: CobranzaMoment;
  to: string;
  cc?: string;
  subject: string;
  body: string;
}): Promise<ActionResult<{ status: string; reason?: string }>> {
  try {
    const user = await requireFinance();
    const to = parseEmails(input.to);
    const cc = input.cc ? parseEmails(input.cc) : [];
    if (to.length === 0) {
      return { ok: false, error: "Indica al menos un destinatario." };
    }
    if (!input.subject.trim() || !input.body.trim()) {
      return { ok: false, error: "El asunto y el cuerpo son obligatorios." };
    }

    const sender = await resolveCobranzaSender();

    let status: "ENVIADO" | "PENDIENTE" | "ERROR" = "PENDIENTE";
    let error: string | null = null;
    let sentAt: Date | null = null;

    if (sender.ok) {
      try {
        await sendGmail({
          userId: sender.userId,
          from: sender.from,
          to,
          cc,
          subject: input.subject,
          body: input.body,
        });
        status = "ENVIADO";
        sentAt = new Date();
      } catch (e) {
        status = "ERROR";
        error = e instanceof Error ? e.message : "Error al enviar.";
      }
    } else {
      error = sender.reason;
    }

    await db.insert(cobranzaMessages).values({
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      invoiceId: input.invoiceId ?? null,
      templateId: input.templateId ?? null,
      moment: input.moment,
      fromEmail: sender.from,
      toEmail: to.join(", "),
      ccEmails: cc,
      subject: input.subject,
      body: input.body,
      status,
      error,
      sentById: user.id,
      sentByEmail: user.email,
      sentAt,
    });

    await logActivity({
      entityType: "cobranza_message",
      action: `cobranza_${status.toLowerCase()}`,
      actorId: user.id,
    });
    revalidate();

    if (status === "ENVIADO") return { ok: true, data: { status } };
    if (status === "PENDIENTE") {
      return {
        ok: true,
        data: { status, reason: error ?? undefined },
      };
    }
    return { ok: false, error: error ?? "No se pudo enviar." };
  } catch (err) {
    return handleActionError(err, "sendCobranza");
  }
}

/** Reintenta un mensaje PENDIENTE/ERROR con la config actual. */
export async function resendCobranza(formData: FormData): Promise<void> {
  const user = await requireFinance();
  const id = formData.get("id") as string;
  const [msg] = await db
    .select()
    .from(cobranzaMessages)
    .where(eq(cobranzaMessages.id, id))
    .limit(1);
  if (!msg || msg.status === "ENVIADO") return;

  const sender = await resolveCobranzaSender();
  if (!sender.ok) {
    await db
      .update(cobranzaMessages)
      .set({ status: "PENDIENTE", error: sender.reason })
      .where(eq(cobranzaMessages.id, id));
    revalidate();
    return;
  }
  try {
    await sendGmail({
      userId: sender.userId,
      from: sender.from,
      to: parseEmails(msg.toEmail),
      cc: msg.ccEmails ?? [],
      subject: msg.subject,
      body: msg.body,
    });
    await db
      .update(cobranzaMessages)
      .set({ status: "ENVIADO", error: null, sentAt: new Date() })
      .where(eq(cobranzaMessages.id, id));
    await logActivity({
      entityType: "cobranza_message",
      entityId: id,
      action: "cobranza_resent",
      actorId: user.id,
    });
  } catch (e) {
    await db
      .update(cobranzaMessages)
      .set({ status: "ERROR", error: e instanceof Error ? e.message : "Error" })
      .where(eq(cobranzaMessages.id, id));
  }
  revalidate();
}

// ── Plantillas de cobranza ───────────────────────────────────

function revalidateTemplates() {
  revalidatePath("/finanzas/cobranza/plantillas");
  revalidatePath("/finanzas/cobranza");
}

export async function saveCobranzaTemplate(formData: FormData): Promise<void> {
  await requireFinance();
  const id = (formData.get("id") as string) || "";
  const name = ((formData.get("name") as string) || "").trim();
  const moment = formData.get("moment") as CobranzaMoment;
  const subject = ((formData.get("subject") as string) || "").trim();
  const body = ((formData.get("body") as string) || "").trim();
  if (!name || !moment || !subject || !body) {
    throw new Error("Todos los campos son obligatorios.");
  }
  if (id) {
    await db
      .update(cobranzaTemplates)
      .set({ name, moment, subject, body, updatedAt: new Date() })
      .where(eq(cobranzaTemplates.id, id));
  } else {
    await db.insert(cobranzaTemplates).values({ name, moment, subject, body });
  }
  revalidateTemplates();
}

export async function deleteCobranzaTemplate(
  formData: FormData,
): Promise<void> {
  await requireFinance();
  const id = formData.get("id") as string;
  await db.delete(cobranzaTemplates).where(eq(cobranzaTemplates.id, id));
  revalidateTemplates();
}
