import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import { db } from "@/db";
import { importBatches } from "@/db/schema";
import { confirmImport, rejectImport } from "@/features/finance/import-actions";
import type { ImportPreview } from "@/features/finance/import/types";

export default async function ImportPreviewPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);
  if (!batch) notFound();

  const preview = batch.summary as unknown as ImportPreview | null;
  const s = preview?.summary;
  const isCartola = batch.type === "CARTOLA_BANCARIA";
  const isDraft = batch.status === "BORRADOR";

  return (
    <>
      <Link
        href="/finanzas/importar"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Volver a importar
      </Link>

      <PageHeader
        title="Vista previa de importación"
        description={batch.fileName}
        action={<StatusBadge value={batch.status} size="sm" />}
      />

      {s && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Filas detectadas" value={s.rowsDetected} />
          <MetricCard label="Válidas" value={s.rowsValid} />
          <MetricCard label="Rechazadas" value={s.rowsRejected} />
          <MetricCard label="Duplicadas" value={s.duplicates} />
          {!isCartola && (
            <>
              <MetricCard
                label="Total neto"
                value={formatMoney(s.totalNeto, "CLP")}
              />
              <MetricCard
                label="Total IVA"
                value={formatMoney(s.totalIva, "CLP")}
              />
            </>
          )}
          <MetricCard
            label={isCartola ? "Flujo neto" : "Total bruto"}
            value={formatMoney(s.totalBruto, "CLP")}
          />
          <MetricCard
            label="Rango"
            value={`${s.fechaMin ?? "—"} → ${s.fechaMax ?? "—"}`}
          />
        </div>
      )}

      {s?.warnings?.length ? (
        <div className="mb-6 rounded-lg border border-[var(--status-amber)] bg-[var(--status-amber-bg)] px-4 py-3 text-sm text-[var(--status-amber)]">
          {s.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      ) : null}

      {isDraft && (
        <div className="mb-6 flex gap-3">
          <form action={confirmImport}>
            <input type="hidden" name="batchId" value={batch.id} />
            <button
              type="submit"
              className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium"
            >
              Confirmar e importar
            </button>
          </form>
          <form action={rejectImport}>
            <input type="hidden" name="batchId" value={batch.id} />
            <button
              type="submit"
              className="border-border rounded-md border px-4 py-2 text-sm"
            >
              Descartar
            </button>
          </form>
        </div>
      )}

      {/* Preview de filas (primeras 50) */}
      {preview?.transactions && (
        <PreviewTable
          headers={["Fecha", "Glosa", "Tipo", "Monto", ""]}
          rows={preview.transactions.slice(0, 50).map((t) => [
            t.fecha.slice(0, 10),
            t.glosa,
            t.tipo,
            formatMoney(t.monto, "CLP"),
            t.isDuplicate ? "duplicado" : "",
          ])}
        />
      )}
      {preview?.documents && (
        <PreviewTable
          headers={["Folio", "Contacto", "RUT", "Emisión", "Total", ""]}
          rows={preview.documents.slice(0, 50).map((d) => [
            d.folio,
            d.nombre,
            d.rut,
            d.fechaEmision.slice(0, 10),
            formatMoney(d.total, "CLP"),
            d.isDuplicate ? "duplicado" : "",
          ])}
        />
      )}
    </>
  );
}

function PreviewTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="border-border bg-card overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-border border-b text-left text-xs">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-border/60 border-b">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={
                    j === r.length - 1 && c === "duplicado"
                      ? "text-[var(--status-amber)] px-4 py-2 text-xs"
                      : "px-4 py-2"
                  }
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
