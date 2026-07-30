import Link from "next/link";
import { ArrowLeft, Bot, UserRound, Wrench } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { RequestActionsPanel } from "@/features/bot/request-actions-panel";
import { getRequestDetail } from "@/features/bot/requests-queries";
import { formatDate } from "@/features/finance/helpers";

const ROLE_ICON = { user: UserRound, assistant: Bot, tool: Wrench } as const;

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await getRequestDetail(id);
  if (!request) notFound();

  return (
    <>
      <Link
        href="/solicitudes"
        className="text-muted-foreground mb-4 inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Volver a solicitudes
      </Link>
      <PageHeader
        title={request.summary || "Detalle de solicitud"}
        description={`${request.clientName} · ${request.projectName} · ${formatDate(request.createdAt)}`}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="glass rounded-xl p-5">
          <h2 className="font-heading mb-4 text-lg font-medium">Conversación</h2>
          {request.messages.length ? (
            <ol className="space-y-3">
              {request.messages.map((message) => {
                const Icon =
                  ROLE_ICON[message.role as keyof typeof ROLE_ICON] ?? Bot;
                return (
                  <li
                    key={message.id}
                    className="border-border flex gap-3 rounded-lg border p-3"
                  >
                    <span className="bg-muted mt-0.5 rounded-full p-2">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-muted-foreground mb-1 text-xs">
                        {message.role === "user"
                          ? request.senderName || "Cliente"
                          : message.role === "tool"
                            ? "Herramienta del agente"
                            : "Agente Noma"}{" "}
                        · {formatDate(message.createdAt)}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {message.role === "tool"
                          ? "Acción procesada por el agente."
                          : message.content}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-muted-foreground text-sm">
              Esta solicitud histórica no tiene una conversación vinculada.
            </p>
          )}
        </section>

        <aside className="space-y-5">
          <div className="glass space-y-3 rounded-xl p-5">
            <h2 className="font-heading text-base font-medium">Seguimiento</h2>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={request.scopeClass} />
              <StatusBadge value={request.status} />
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Remitente</dt>
                <dd>
                  {request.senderName ?? "Remitente revocado"}
                  {request.senderProfile ? ` · ${request.senderProfile}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mensaje original</dt>
                <dd className="whitespace-pre-wrap">{request.rawText}</dd>
              </div>
            </dl>
          </div>
          <div className="glass rounded-xl p-5">
            <RequestActionsPanel
              requestId={request.id}
              scopeClass={request.scopeClass}
              status={request.status}
              asanaUrl={request.asanaUrl}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
