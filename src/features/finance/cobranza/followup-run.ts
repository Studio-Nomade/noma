import "server-only";

import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import {
  businessLines,
  clients,
  cobranzaCases,
  cobranzaMessages,
  cobranzaTemplates,
  finContacts,
  finDocuments,
  studioConfig,
} from "@/db/schema";
import { sendGmail } from "@/features/email/gmail";
import { appendTextSignature } from "@/features/email/signatures";
import { toNum } from "../helpers";
import {
  decideFollowup,
  type FollowupDecision,
  type FollowupReason,
} from "./followup";
import {
  formatInvoiceTable,
  getPlaybookTemplate,
  totalPendiente,
  transferDetails,
  type InvoiceRow,
} from "./playbook";
import { resolveCobranzaSender } from "./sender";
import { fillTemplate } from "./variables";

/**
 * El envío automático está APAGADO por defecto: el seguimiento deja borradores
 * (cobranza_messages en estado PENDIENTE) que Finanzas revisa y envía con
 * "Reintentar". Solo con `NOMA_COBRANZA_AUTOSEND=true` sale el correo solo.
 */
export function followupAutosendEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NOMA_COBRANZA_AUTOSEND?.trim().toLowerCase() === "true";
}

const OPEN_STATUSES = ["EMITIDA", "PARCIAL", "VENCIDA"] as const;

export interface FollowupCandidate {
  documentId: string;
  folio: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  total: number;
  pendiente: number;
  contactId: string | null;
  clientId: string | null;
  contactName: string;
  email: string | null;
  clientName: string | null;
  clientContact: string | null;
  area: string | null;
  decision: FollowupDecision;
  caseId: string | null;
  committedPaymentDate: string | null;
  factoringEntity: string | null;
  legalAt: string | null;
  paused: boolean;
  followupCount: number;
}

/** Facturas de venta abiertas con su decisión de seguimiento. */
export async function getFollowupCandidates(
  now: Date = new Date(),
): Promise<FollowupCandidate[]> {
  const rows = await db
    .select({
      documentId: finDocuments.id,
      folio: finDocuments.folio,
      status: finDocuments.status,
      recordStatus: finDocuments.recordStatus,
      fechaEmision: finDocuments.fechaEmision,
      fechaVencimiento: finDocuments.fechaVencimiento,
      total: finDocuments.total,
      montoConciliado: finDocuments.montoConciliado,
      contactId: finDocuments.contactId,
      contactName: finContacts.name,
      clientId: finContacts.clientId,
      contactEmail: finContacts.email,
      clientName: clients.companyName,
      clientContact: clients.contactName,
      billingEmail: clients.billingEmail,
      clientEmail: clients.email,
      area: businessLines.code,
      caseId: cobranzaCases.id,
      sentAt: cobranzaCases.sentAt,
      lastFollowupAt: cobranzaCases.lastFollowupAt,
      followupCount: cobranzaCases.followupCount,
      committedPaymentDate: cobranzaCases.committedPaymentDate,
      factoringEntity: cobranzaCases.factoringEntity,
      factoringAt: cobranzaCases.factoringAt,
      legalAt: cobranzaCases.legalAt,
      paused: cobranzaCases.paused,
    })
    .from(finDocuments)
    .leftJoin(finContacts, eq(finDocuments.contactId, finContacts.id))
    .leftJoin(clients, eq(finContacts.clientId, clients.id))
    .leftJoin(businessLines, eq(finDocuments.businessLineId, businessLines.id))
    .leftJoin(cobranzaCases, eq(cobranzaCases.documentId, finDocuments.id))
    .where(
      and(
        eq(finDocuments.direction, "VENTA"),
        eq(finDocuments.type, "FACTURA_VENTA"),
        eq(finDocuments.recordStatus, "ACTIVO"),
        inArray(finDocuments.status, [...OPEN_STATUSES]),
      ),
    );

  return rows.map((r) => {
    const total = toNum(r.total);
    const conciliado = toNum(r.montoConciliado);
    const decision = decideFollowup(
      {
        status: r.status,
        recordStatus: r.recordStatus,
        total,
        montoConciliado: conciliado,
        fechaEmision: r.fechaEmision,
        sentAt: r.sentAt,
        lastFollowupAt: r.lastFollowupAt,
        followupCount: r.followupCount ?? 0,
        committedPaymentDate: r.committedPaymentDate,
        factoringAt: r.factoringAt,
        legalAt: r.legalAt,
        paused: r.paused ?? false,
      },
      now,
    );
    return {
      documentId: r.documentId,
      folio: r.folio,
      fechaEmision: r.fechaEmision,
      fechaVencimiento: r.fechaVencimiento,
      total,
      pendiente: total - conciliado,
      contactId: r.contactId,
      clientId: r.clientId,
      contactName: r.contactName ?? "Sin contacto",
      email: r.billingEmail || r.contactEmail || r.clientEmail || null,
      clientName: r.clientName,
      clientContact: r.clientContact,
      area: r.area,
      decision,
      caseId: r.caseId,
      committedPaymentDate: r.committedPaymentDate,
      factoringEntity: r.factoringEntity,
      legalAt: r.legalAt,
      paused: r.paused ?? false,
      followupCount: r.followupCount ?? 0,
    };
  });
}

export interface FollowupRunResult {
  mode: "borrador" | "envio";
  evaluated: number;
  messages: number;
  sent: number;
  drafts: number;
  errors: number;
  suppressed: Partial<Record<FollowupReason, number>>;
}

async function p3Template(): Promise<{
  id: string | null;
  subject: string;
  body: string;
}> {
  const [saved] = await db
    .select()
    .from(cobranzaTemplates)
    .where(
      and(
        like(cobranzaTemplates.name, "P3%"),
        eq(cobranzaTemplates.status, "Activo"),
      ),
    )
    .limit(1);
  if (saved) return { id: saved.id, subject: saved.subject, body: saved.body };
  const base = getPlaybookTemplate("P3");
  return { id: null, subject: base.subject, body: base.body };
}

/**
 * Corre el seguimiento a 7 días: agrupa por cliente las facturas que tocan P3
 * y deja un correo por cliente (borrador o enviado, según el modo).
 */
export async function runCobranzaFollowup(
  now: Date = new Date(),
): Promise<FollowupRunResult> {
  const autosend = followupAutosendEnabled();
  const candidates = await getFollowupCandidates(now);
  const result: FollowupRunResult = {
    mode: autosend ? "envio" : "borrador",
    evaluated: candidates.length,
    messages: 0,
    sent: 0,
    drafts: 0,
    errors: 0,
    suppressed: {},
  };

  const due = new Map<string, FollowupCandidate[]>();
  for (const c of candidates) {
    if (!c.decision.send) {
      result.suppressed[c.decision.reason] =
        (result.suppressed[c.decision.reason] ?? 0) + 1;
      continue;
    }
    const key = c.contactId ?? `doc:${c.documentId}`;
    due.set(key, [...(due.get(key) ?? []), c]);
  }
  if (due.size === 0) return result;

  const [tpl, cfg, sender] = await Promise.all([
    p3Template(),
    db.select().from(studioConfig).limit(1),
    resolveCobranzaSender(),
  ]);
  const estudio = cfg[0]?.studioName ?? "Studio Nomade";

  for (const docs of due.values()) {
    const first = docs[0];
    const rows: InvoiceRow[] = docs.map((d) => ({
      folio: d.folio,
      fechaEmision: d.fechaEmision,
      fechaVencimiento: d.fechaVencimiento,
      total: d.total,
      pendiente: d.pendiente,
    }));
    const vars = {
      area: first.area ?? "Finanzas",
      cliente: first.clientName ?? first.contactName,
      contacto: first.clientContact ?? "equipo",
      folio: docs.map((d) => d.folio).join(", "),
      tabla_facturas: formatInvoiceTable(rows),
      total_pendiente: totalPendiente(rows),
      datos_transferencia: transferDetails(),
      estudio,
      remitente: sender.fromName ?? `Finanzas ${estudio}`,
    };
    const subject = fillTemplate(tpl.subject, vars);
    const body = fillTemplate(tpl.body, vars);

    let status: "ENVIADO" | "PENDIENTE" | "ERROR" = "PENDIENTE";
    let error: string | null = null;
    let sentAt: Date | null = null;

    if (!first.email) {
      error =
        "Sin correo de cobranza del cliente: complétalo en la ficha del cliente.";
    } else if (!autosend) {
      error =
        "Borrador del seguimiento a 7 días. Envío automático desactivado (NOMA_COBRANZA_AUTOSEND).";
    } else if (!sender.ok) {
      error = sender.reason;
    } else {
      try {
        await sendGmail({
          userId: sender.userId,
          from: sender.from,
          fromName: sender.fromName,
          to: [first.email],
          subject,
          body: appendTextSignature(body, sender.signatureText),
        });
        status = "ENVIADO";
        sentAt = now;
      } catch (e) {
        status = "ERROR";
        error = e instanceof Error ? e.message : "Error al enviar.";
      }
    }

    await db.insert(cobranzaMessages).values({
      clientId: first.clientId,
      templateId: tpl.id,
      moment: "RECORDATORIO",
      fromEmail: sender.from,
      toEmail: first.email ?? "",
      ccEmails: [],
      subject,
      body,
      status,
      error,
      sentByEmail: "seguimiento-automatico",
      sentAt,
    });
    result.messages++;
    if (status === "ENVIADO") result.sent++;
    else if (status === "PENDIENTE") result.drafts++;
    else result.errors++;

    // Registra el intento en cada caso (también en modo borrador), para que el
    // próximo seguimiento espere otros 7 días y no se dupliquen borradores.
    if (status !== "ERROR") {
      for (const d of docs) {
        await db
          .insert(cobranzaCases)
          .values({
            documentId: d.documentId,
            lastFollowupAt: now,
            followupCount: d.followupCount + 1,
          })
          .onConflictDoUpdate({
            target: cobranzaCases.documentId,
            set: {
              lastFollowupAt: now,
              followupCount: d.followupCount + 1,
              updatedAt: now,
            },
          });
      }
    }
  }

  return result;
}

/** Marca como enviadas (P1/P2) las facturas contables ligadas a una factura comercial. */
export async function markInvoiceSent(
  invoiceId: string,
  at: Date = new Date(),
) {
  const docs = await db
    .select({ id: finDocuments.id })
    .from(finDocuments)
    .where(eq(finDocuments.invoiceId, invoiceId));
  for (const d of docs) {
    await db
      .insert(cobranzaCases)
      .values({ documentId: d.id, sentAt: at })
      .onConflictDoUpdate({
        target: cobranzaCases.documentId,
        set: { sentAt: at, updatedAt: at },
      });
  }
}
