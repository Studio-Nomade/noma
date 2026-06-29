import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { getClient, getClientProjects } from "@/features/clients/queries";
import { ClientDialog } from "@/features/clients/client-dialog";
import { CloseClientButton } from "@/features/clients/close-client-button";
import { AREA_LABELS } from "@/types/enums";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm">{value || "—"}</p>
    </div>
  );
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const projects = await getClientProjects(id);

  return (
    <>
      <Link
        href="/clients"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Volver a Clientes
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {client.companyName}
            </h1>
            <StatusBadge value={client.status} />
          </div>
          {client.industry && (
            <p className="text-muted-foreground mt-1 text-sm">
              {client.industry}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <ClientDialog
            client={client}
            trigger={
              <Button variant="outline">
                <Pencil className="size-4" />
                Editar
              </Button>
            }
          />
          {client.status !== "Cerrado" && <CloseClientButton id={client.id} />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="border-border bg-card space-y-5 rounded-xl border p-6 lg:col-span-2">
          <h2 className="font-heading text-sm font-medium">
            Información de contacto
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Contacto principal" value={client.contactName} />
            <Field label="Cargo" value={client.contactRole} />
            <Field label="Email" value={client.email} />
            <Field label="Teléfono" value={client.phone} />
            <Field label="Sitio web" value={client.website} />
            <Field label="Instagram" value={client.instagram} />
            <Field label="LinkedIn" value={client.linkedin} />
          </div>
          {client.internalNotes && (
            <div>
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Notas internas
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap">
                {client.internalNotes}
              </p>
            </div>
          )}
        </div>

        <div className="border-border bg-card rounded-xl border p-6">
          <h2 className="font-heading mb-4 text-sm font-medium">
            Proyectos ({projects.length})
          </h2>
          {projects.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin proyectos asociados todavía.
            </p>
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="hover:bg-accent/50 group flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {AREA_LABELS[p.area]}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge value={p.status} size="xs" />
                      <ExternalLink className="text-muted-foreground size-3.5 opacity-0 group-hover:opacity-100" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
