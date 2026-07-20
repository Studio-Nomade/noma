import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  clientContacts,
  projects,
  invoices,
  cobranzaTemplates,
  cobranzaMessages,
} from "@/db/schema";
import type { CobranzaMoment } from "@/types/enums";
import { toNum } from "../helpers";

export async function getCobranzaTemplates() {
  return db
    .select()
    .from(cobranzaTemplates)
    .orderBy(cobranzaTemplates.moment, cobranzaTemplates.name);
}

export async function getCobranzaMessages(limit = 50) {
  return db
    .select({
      id: cobranzaMessages.id,
      moment: cobranzaMessages.moment,
      toEmail: cobranzaMessages.toEmail,
      fromEmail: cobranzaMessages.fromEmail,
      subject: cobranzaMessages.subject,
      status: cobranzaMessages.status,
      error: cobranzaMessages.error,
      sentAt: cobranzaMessages.sentAt,
      createdAt: cobranzaMessages.createdAt,
      clientName: clients.companyName,
    })
    .from(cobranzaMessages)
    .leftJoin(clients, eq(cobranzaMessages.clientId, clients.id))
    .orderBy(desc(cobranzaMessages.createdAt))
    .limit(limit);
}

export type ComposerInvoice = {
  id: string;
  folio: string | null;
  total: number;
  projectId: string | null;
  status: string;
};
export type ComposerClient = {
  id: string;
  name: string;
  email: string | null;
  contactName: string | null;
  projects: { id: string; name: string; status: string }[];
  invoices: ComposerInvoice[];
};

/** Clientes con sus proyectos y facturas, para el compositor de cobranza. */
export async function getComposerContext(): Promise<ComposerClient[]> {
  const [cl, pr, inv, contacts] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.companyName,
        email: clients.email,
        billingEmail: clients.billingEmail,
        contactName: clients.contactName,
      })
      .from(clients)
      .orderBy(clients.companyName),
    db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
        status: projects.status,
      })
      .from(projects),
    db
      .select({
        id: invoices.id,
        folio: invoices.folio,
        total: invoices.totalAmount,
        clientId: invoices.clientId,
        projectId: invoices.projectId,
        status: invoices.status,
      })
      .from(invoices),
    db
      .select({
        clientId: clientContacts.clientId,
        email: clientContacts.email,
        isPrimary: clientContacts.isPrimary,
      })
      .from(clientContacts),
  ]);

  const primaryEmail = new Map<string, string>();
  for (const c of contacts) {
    if (c.isPrimary && c.email && !primaryEmail.has(c.clientId)) {
      primaryEmail.set(c.clientId, c.email);
    }
  }

  return cl.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.billingEmail || primaryEmail.get(c.id) || c.email || null,
    contactName: c.contactName,
    projects: pr
      .filter((p) => p.clientId === c.id)
      .map((p) => ({ id: p.id, name: p.name, status: p.status })),
    invoices: inv
      .filter((i) => i.clientId === c.id)
      .map((i) => ({
        id: i.id,
        folio: i.folio,
        total: toNum(i.total),
        projectId: i.projectId,
        status: i.status,
      })),
  }));
}

export type Sugerido = {
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  moment: CobranzaMoment;
  invoiceId: string | null;
  folio: string | null;
  total: number | null;
};

// Estados que sugieren INICIO (proyecto recién arrancado) vs TERMINO (cerrado).
const INICIO_STATUSES = ["Aprobado", "En desarrollo"];
const TERMINO_STATUSES = ["Cerrado"];

/** Proyectos en momento de cobrar (inicio o término), con su factura si existe. */
export async function getSugeridos(projectId?: string): Promise<Sugerido[]> {
  const relevant = [...INICIO_STATUSES, ...TERMINO_STATUSES];
  const relevantMoment = or(
    inArray(
      projects.status,
      relevant as (typeof projects.status.enumValues)[number][],
    ),
    eq(projects.commercialStage, "Aprobado"),
  );
  const pr = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      clientId: projects.clientId,
      clientName: clients.companyName,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(
      projectId
        ? and(eq(projects.id, projectId), relevantMoment)
        : relevantMoment,
    );

  if (pr.length === 0) return [];

  const inv = await db
    .select({
      id: invoices.id,
      folio: invoices.folio,
      total: invoices.totalAmount,
      projectId: invoices.projectId,
    })
    .from(invoices)
    .where(
      and(
        inArray(
          invoices.projectId,
          pr.map((p) => p.id),
        ),
      ),
    );

  return pr.map((p) => {
    const i = inv.find((x) => x.projectId === p.id) ?? null;
    return {
      clientId: p.clientId,
      clientName: p.clientName,
      projectId: p.id,
      projectName: p.name,
      moment: (TERMINO_STATUSES.includes(p.status)
        ? "TERMINO"
        : "INICIO") as CobranzaMoment,
      invoiceId: i?.id ?? null,
      folio: i?.folio ?? null,
      total: i ? toNum(i.total) : null,
    };
  });
}
