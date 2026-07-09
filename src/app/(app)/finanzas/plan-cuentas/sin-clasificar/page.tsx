import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/currency/format";
import {
  getUnclassifiedDocuments,
  getClassificationOptions,
} from "@/features/finance/queries";
import { ClassifyRow } from "@/features/finance/classify-row";
import { formatDate, toNum } from "@/features/finance/helpers";

const DIR_LABELS: Record<string, string> = { VENTA: "Venta", COMPRA: "Compra" };

export default async function SinClasificarPage() {
  const [docs, options] = await Promise.all([
    getUnclassifiedDocuments(),
    getClassificationOptions(),
  ]);

  return (
    <>
      <Link
        href="/finanzas/plan-cuentas"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Volver al plan de cuentas
      </Link>

      <PageHeader
        title="Sin clasificar"
        description="Asigna cuenta contable (y opcionalmente línea/centro) a cada documento"
      />

      {docs.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Todo clasificado"
          description="No hay documentos pendientes de clasificar. Los nuevos documentos se clasifican solos si coinciden con una regla."
        />
      ) : (
        <div className="space-y-3">
          {docs.map((d) => (
            <div
              key={d.id}
              className="border-border bg-card rounded-xl border p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="text-muted-foreground text-xs">
                    {DIR_LABELS[d.direction]} · #{d.folio} ·{" "}
                    {formatDate(d.fechaEmision)}
                  </span>
                  <span className="block font-medium">
                    {d.contactName ?? "Sin contacto"}
                    <span className="text-muted-foreground ml-2 text-xs">
                      {d.contactRut ?? ""}
                    </span>
                  </span>
                </div>
                <span className="font-medium">
                  {formatMoney(toNum(d.total), "CLP")}
                </span>
              </div>
              <ClassifyRow
                docId={d.id}
                ledgers={options.ledgers}
                centers={options.centers}
                lines={options.lines}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
