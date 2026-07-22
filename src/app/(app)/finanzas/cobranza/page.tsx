import Link from "next/link";
import { Mail, Settings2, Send } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { db } from "@/db";
import { studioConfig } from "@/db/schema";
import { COBRANZA_MOMENT_LABELS, type CobranzaMoment } from "@/types/enums";
import { formatMoney } from "@/lib/currency/format";
import {
  getComposerContext,
  getCobranzaTemplates,
  getCobranzaMessages,
  getSugeridos,
} from "@/features/finance/cobranza/queries";
import { cobranzaFromEmail } from "@/features/finance/cobranza/sender";
import { CobranzaComposer } from "@/features/finance/cobranza/cobranza-composer";
import { resendCobranza } from "@/features/finance/cobranza/actions";
import { formatDate } from "@/features/finance/helpers";
import { UrlPagination } from "@/components/shared/url-pagination";

export default async function CobranzaPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    projectId?: string;
    invoiceId?: string;
    moment?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = [20, 50, 100, 200].includes(Number(sp.pageSize))
    ? Number(sp.pageSize)
    : 20;
  const [clients, templates, sugeridos, messagePage, cfg] = await Promise.all([
    getComposerContext(),
    getCobranzaTemplates(),
    getSugeridos(),
    getCobranzaMessages({ page, pageSize }),
    db.select().from(studioConfig).limit(1),
  ]);
  const mensajes = messagePage.rows;

  const studioName = cfg[0]?.studioName ?? "Studio Nomade";
  const senderEmail = cobranzaFromEmail();

  const prefill = sp.clientId
    ? {
        clientId: sp.clientId,
        projectId: sp.projectId,
        invoiceId: sp.invoiceId,
        moment: (sp.moment as CobranzaMoment) ?? "INICIO",
      }
    : undefined;

  return (
    <>
      <PageHeader
        title="Cobranza"
        description={`Correos automáticos al cliente desde ${senderEmail} · inicio y término de proyectos`}
        action={
          <Link
            href="/finanzas/cobranza/plantillas"
            className="border-border inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <Settings2 className="size-4" /> Plantillas
          </Link>
        }
      />

      {/* Sugeridos: proyectos en momento de cobrar */}
      {sugeridos.length > 0 && (
        <section className="mb-8">
          <h2 className="font-heading mb-3 flex items-center gap-2 text-base font-medium">
            <Send className="size-4" /> Sugeridos
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sugeridos.map((s) => {
              const qs = new URLSearchParams({
                clientId: s.clientId,
                projectId: s.projectId,
                moment: s.moment,
              });
              if (s.invoiceId) qs.set("invoiceId", s.invoiceId);
              return (
                <Link
                  key={s.projectId}
                  href={`/finanzas/cobranza?${qs.toString()}`}
                  className="glass hover-lift rounded-xl p-4"
                >
                  <span className="text-muted-foreground text-xs">
                    {COBRANZA_MOMENT_LABELS[s.moment]}
                  </span>
                  <span className="mt-1 block font-medium">
                    {s.projectName}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {s.clientName}
                    {s.total !== null && ` · ${formatMoney(s.total, "CLP")}`}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Compositor */}
      <section className="mb-10">
        <h2 className="font-heading mb-3 text-base font-medium">
          Redactar cobranza
        </h2>
        <CobranzaComposer
          clients={clients}
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            moment: t.moment,
            subject: t.subject,
            body: t.body,
          }))}
          studioName={studioName}
          senderName="Equipo Comercial"
          senderEmail={senderEmail}
          prefill={prefill}
        />
      </section>

      {/* Historial */}
      <section>
        <h2 className="font-heading mb-3 text-base font-medium">Historial</h2>
        {mensajes.length === 0 ? (
          <div className="border-border text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-sm">
            <Mail className="mx-auto mb-2 size-6 opacity-60" />
            Aún no se han enviado correos de cobranza.
          </div>
        ) : (
          <div className="glass-solid overflow-x-auto rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-left text-xs">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cliente / Para</th>
                  <th className="px-4 py-3">Momento</th>
                  <th className="px-4 py-3">Asunto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {mensajes.map((m) => (
                  <tr key={m.id} className="border-border/60 border-b">
                    <td className="px-4 py-3">
                      {formatDate(m.sentAt ?? m.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block max-w-[200px] truncate">
                        {m.clientName ?? "—"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {m.toEmail}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {COBRANZA_MOMENT_LABELS[m.moment]}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block max-w-[240px] truncate">
                        {m.subject}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={m.status} />
                      {m.error && m.status !== "ENVIADO" && (
                        <span className="text-muted-foreground mt-1 block max-w-[200px] truncate text-[10px]">
                          {m.error}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {m.status !== "ENVIADO" && (
                        <form action={resendCobranza}>
                          <input type="hidden" name="id" value={m.id} />
                          <button
                            type="submit"
                            className="text-xs text-[var(--status-blue)] hover:underline"
                          >
                            Reintentar
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <UrlPagination
          page={page}
          pageSize={pageSize}
          total={messagePage.total}
        />
      </section>
    </>
  );
}
