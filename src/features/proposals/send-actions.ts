"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { proposals, proposalNotes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { sendGmail } from "@/features/email/gmail";
import { buildProposalPdfData } from "./build-pdf-data";
import { renderProposalPdf } from "./proposal-pdf";

export async function sendProposalEmail(
  id: string,
  input: { to: string[]; cc: string[]; subject: string; body: string },
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (input.to.length === 0) {
      return { ok: false, error: "Selecciona al menos un destinatario." };
    }
    if (!user.email) {
      return { ok: false, error: "Tu usuario no tiene email." };
    }

    const bundle = await buildProposalPdfData(id);
    if (!bundle) return { ok: false, error: "Propuesta no encontrada." };
    const pdf = await renderProposalPdf(bundle.data);

    await sendGmail({
      userId: user.id,
      from: user.email,
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      body: input.body,
      attachment: { filename: bundle.filename, content: pdf },
    });

    // marca como Enviada y deja registro en el hilo
    const [p] = await db
      .select({ rootId: proposals.rootId, id: proposals.id })
      .from(proposals)
      .where(eq(proposals.id, id))
      .limit(1);
    await db
      .update(proposals)
      .set({ status: "Enviada", updatedAt: new Date() })
      .where(eq(proposals.id, id));
    await db.insert(proposalNotes).values({
      rootId: p?.rootId ?? id,
      authorId: user.id,
      authorEmail: user.email,
      body: `Propuesta enviada a ${input.to.join(", ")}.`,
    });

    revalidatePath(`/proposals/${id}`);
    revalidatePath("/proposals");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "sendProposalEmail");
  }
}
