import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { quoterAiConfig } from "@/features/quoter/ai-config";
import { listLearnings, quoterMemoryStats } from "@/features/quoter/queries";
import { LearningsTable } from "@/features/quoter/learnings-table";
import { TeachForm } from "@/features/quoter/teach-form";

export const metadata = { title: "Memoria del cotizador" };

export default async function QuoterMemoryPage() {
  const [user, learnings, stats] = await Promise.all([
    requireUser(),
    listLearnings(),
    quoterMemoryStats(),
  ]);
  const canEdit = !roleFor(user.email).isReadOnly;
  const config = quoterAiConfig("draft");
  const active = learnings.filter((l) => l.active).length;

  return (
    <>
      <Link
        href="/proposals"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Propuestas
      </Link>
      <PageHeader
        title="Memoria del cotizador"
        description={`${active} regla(s) activas · ${stats.precedentsHistoric + stats.precedentsNoma} precedentes (${stats.precedentsHistoric} PDF históricos, ${stats.precedentsNoma} de Noma) · ${stats.drafts} borrador(es) con IA · ${config ? `${config.provider === "anthropic" ? "Claude" : "OpenAI"} · ${config.model}` : "IA sin configurar"}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-xl p-6 lg:col-span-2">
          <LearningsTable
            canEdit={canEdit}
            rows={learnings.map((l) => ({
              ...l,
              createdAt: l.createdAt.toISOString(),
            }))}
          />
        </div>
        <div className="space-y-6">
          {canEdit && (
            <div className="glass rounded-xl p-6">
              <h2 className="font-heading mb-3 text-sm font-medium">
                Enseñar a Noma
              </h2>
              <TeachForm />
            </div>
          )}
          <div className="glass text-muted-foreground space-y-2 rounded-xl p-6 text-xs">
            <h2 className="font-heading text-foreground text-sm font-medium">
              Cómo aprende
            </h2>
            <p>
              Cada propuesta con IA usa el catálogo, los valores ya cotizados,
              los precedentes parecidos y estas reglas.
            </p>
            <p>
              Al enviar, aprobar o rechazar una propuesta, Noma compara su
              borrador con lo que el equipo dejó y con el hilo de seguimiento, y
              agrega aquí las reglas nuevas. Entran activas: desactiva las que
              no correspondan.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
