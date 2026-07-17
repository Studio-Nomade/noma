"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, proposalNotes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { BRAND } from "@/lib/brand/brand";
import { formatMoney } from "@/lib/currency/format";
import { sendGmail } from "@/features/email/gmail";
import { getProposal } from "./queries";
import { buildProposalPdfData } from "./build-pdf-data";
import { renderProposalPdf } from "./proposal-pdf";
import { getSlaByProposal } from "@/features/sla/queries";
import { renderSlaPdf } from "@/features/sla/sla-pdf";
import { getInvoiceByProposal } from "@/features/invoices/queries";

/** Cuerpo por defecto del correo de inicio oficial (con datos de transferencia). */
export async function buildKickoffBody(proposalId: string): Promise<string> {
  const row = await getProposal(proposalId);
  const invoice = await getInvoiceByProposal(proposalId);
  const cliente = row?.clientName ?? "";
  const total = invoice?.totalAmount
    ? formatMoney(invoice.totalAmount, "CLP")
    : "";
  const b = BRAND.bank;
  return `Hola ${cliente},

¡Bienvenidos a Studio Nomade! Con la propuesta aprobada, damos inicio oficial al proyecto.

Adjuntamos:
• Acuerdo de Nivel de Servicio (SLA)
• Propuesta aprobada
• Factura por el anticipo inicial${total ? ` (${total})` : ""}

Datos de transferencia:
Razón Social: ${b.razonSocial}
RUT: ${b.rut}
Banco: ${b.banco}
${b.tipoCuenta} N°: ${b.numeroCuenta}
Email: ${b.email}

Una vez confirmado el pago coordinamos el kick off. ¡Gracias por la confianza!

Saludos,
Studio Nomade`;
}

export async function sendKickoff(
  proposalId: string,
  input: { to: string[]; cc: string[]; body: string },
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!roleFor(user.email).isFinance) {
      return { ok: false, error: "Solo Finanzas puede enviar el inicio oficial." };
    }
    if (!user.email) return { ok: false, error: "Tu usuario no tiene email." };
    if (input.to.length === 0) {
      return { ok: false, error: "Selecciona al menos un destinatario." };
    }

    const bundle = await buildProposalPdfData(proposalId);
    if (!bundle) return { ok: false, error: "Propuesta no encontrada." };
    const sla = await getSlaByProposal(proposalId);

    const attachments: { filename: string; content: Buffer; mime?: string }[] = [];
    // Propuesta
    attachments.push({
      filename: bundle.filename,
      content: await renderProposalPdf(bundle.data),
    });
    // SLA (si existe)
    if (sla) {
      const slaPdf = await renderSlaPdf({
        title: bundle.data.title,
        clientName: bundle.clientName,
        projectName: bundle.projectName,
        sections: sla.sections ?? [],
        signedByName: sla.signedByName,
        signedAt: sla.signedAt ? sla.signedAt.toISOString() : null,
      });
      attachments.push({ filename: `SLA - ${bundle.filename}`, content: slaPdf });
    }

    await sendGmail({
      userId: user.id,
      from: user.email,
      to: input.to,
      cc: input.cc,
      subject: `Inicio de proyecto · ${bundle.projectName}`,
      body: input.body,
      attachments,
    });

    const row = await getProposal(proposalId);
    if (row) {
      await db
        .update(projects)
        .set({ status: "En desarrollo", updatedAt: new Date() })
        .where(eq(projects.id, row.proposal.projectId));
      await db.insert(proposalNotes).values({
        rootId: row.proposal.rootId ?? proposalId,
        authorId: user.id,
        authorEmail: user.email,
        body: `Correo de inicio oficial enviado a ${input.to.join(", ")} (SLA + propuesta).`,
      });
    }

    revalidatePath(`/proposals/${proposalId}/sla`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "sendKickoff");
  }
}
