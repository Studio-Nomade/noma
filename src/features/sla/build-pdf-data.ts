import { getClient } from "@/features/clients/queries";
import { getProposal } from "@/features/proposals/queries";
import { getSlaByProposal } from "./queries";
import type { SlaPdfData } from "./sla-pdf";

/** Código del documento: áreas + fecha de la propuesta, p. ej. A&D_N261121. */
export function slaDocumentCode(areas: readonly string[], createdAt: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${String(createdAt.getFullYear()).slice(2)}${pad(createdAt.getMonth() + 1)}${pad(createdAt.getDate())}`;
  return `${areas.join("+")}_N${ymd}`;
}

/** Reúne lo necesario para el PDF del SLA de una propuesta (null si no hay SLA). */
export async function buildSlaPdfData(
  proposalId: string,
): Promise<{ data: SlaPdfData; filename: string } | null> {
  const row = await getProposal(proposalId);
  if (!row) return null;
  const sla = await getSlaByProposal(proposalId);
  if (!sla) return null;
  const client = row.proposal.clientId
    ? await getClient(row.proposal.clientId)
    : null;
  const areas = row.projectAreas?.length ? row.projectAreas : [row.projectArea];
  const code = slaDocumentCode(areas, new Date(row.proposal.createdAt));
  const clientName = row.clientName ?? "Cliente";

  return {
    data: {
      title: row.proposal.title,
      clientName,
      projectName: row.projectName,
      sections: sla.sections ?? [],
      signedByName: sla.signedByName,
      signedAt: sla.signedAt ? sla.signedAt.toISOString() : null,
      area: areas[0],
      code,
      clientLegalName: client?.legalName ?? null,
      clientRut: client?.rut ?? null,
      updatedAt: (sla.updatedAt ?? sla.createdAt).toISOString(),
    },
    filename: `${code} – ${clientName} | ${row.proposal.title} – SLA.pdf`,
  };
}
