import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Rocket } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { getProposal } from "@/features/proposals/queries";
import { getSlaByProposal } from "@/features/sla/queries";
import { getInvoiceByProposal } from "@/features/invoices/queries";
import { getClientContacts } from "@/features/clients/queries";
import { SlaEditor } from "@/features/sla/sla-editor";
import { InvoiceManager } from "@/features/invoices/invoice-manager";
import { KickoffDialog } from "@/features/proposals/kickoff-dialog";
import { buildKickoffBody } from "@/features/proposals/kickoff-action";

export const metadata = { title: "SLA" };

export default async function SlaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, row] = await Promise.all([requireUser(), getProposal(id)]);
  if (!row) notFound();
  const { proposal, clientName, projectName } = row;
  const isFinance = roleFor(user.email).isFinance;
  const approved = proposal.status === "Aprobada";

  const [sla, invoice, contacts, kickoffBody] = await Promise.all([
    getSlaByProposal(id),
    isFinance && approved ? getInvoiceByProposal(id) : Promise.resolve(null),
    isFinance && approved && proposal.clientId
      ? getClientContacts(proposal.clientId)
      : Promise.resolve([]),
    isFinance && approved ? buildKickoffBody(id) : Promise.resolve(""),
  ]);

  return (
    <>
      <Link
        href={`/proposals/${id}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Volver a la propuesta
      </Link>

      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          SLA · {proposal.title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {clientName ?? "—"} · {projectName}
        </p>
      </div>

      {!approved ? (
        <div className="border-border bg-accent/40 rounded-xl border p-6 text-sm">
          El SLA se genera cuando la propuesta está <strong>Aprobada</strong>.
          Estado actual: <strong>{proposal.status}</strong>.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="border-border bg-card rounded-xl border p-6">
            <SlaEditor proposalId={id} sla={sla} />
          </div>

          {/* Finanzas: facturación + inicio oficial */}
          {isFinance && (
            <>
              <div className="border-border bg-card rounded-xl border p-6">
                <h2 className="font-heading mb-3 text-sm font-medium">
                  Facturación (anticipo inicial) · Finanzas
                </h2>
                <InvoiceManager proposalId={id} invoice={invoice} />
              </div>

              <div className="border-border bg-card rounded-xl border p-6">
                <h2 className="font-heading mb-1 text-sm font-medium">
                  Inicio oficial del proyecto · Finanzas
                </h2>
                <p className="text-muted-foreground mb-3 text-sm">
                  Envía al cliente el SLA + la propuesta + los datos de
                  transferencia para arrancar.
                </p>
                <KickoffDialog
                  proposalId={id}
                  senderEmail={user.email ?? ""}
                  contacts={contacts.map((c) => ({ email: c.email, name: c.name }))}
                  defaultBody={kickoffBody}
                  trigger={
                    <Button>
                      <Rocket className="size-4" />
                      Enviar inicio oficial
                    </Button>
                  }
                />
              </div>
            </>
          )}

          {!isFinance && (
            <p className="text-muted-foreground text-xs">
              La facturación y el envío de inicio oficial los gestiona el área de
              Finanzas (sales@studionomade.cl).
            </p>
          )}
        </div>
      )}
    </>
  );
}
