import Link from "next/link";
import { count, desc } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { db } from "@/db";
import { importBatches, importTemplates } from "@/db/schema";
import { getBankAccounts } from "@/features/finance/queries";
import { ImportForm } from "@/features/finance/import-form";
import { formatDate } from "@/features/finance/helpers";
import { UrlPagination } from "@/components/shared/url-pagination";

const TYPE_LABELS: Record<string, string> = {
  NUBOX_VENTAS: "Nubox Ventas",
  NUBOX_COMPRAS: "Nubox Compras",
  CARTOLA_BANCARIA: "Cartola BCI",
};

export default async function ImportarPage({
  searchParams,
}: {
  searchParams: Promise<{
    confirmado?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const {
    confirmado,
    page: rawPage,
    pageSize: rawPageSize,
  } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const pageSize = [20, 50, 100, 200].includes(Number(rawPageSize))
    ? Number(rawPageSize)
    : 20;
  const [templates, accounts, batches, totalRows] = await Promise.all([
    db.select().from(importTemplates),
    getBankAccounts(),
    db
      .select()
      .from(importBatches)
      .orderBy(desc(importBatches.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(importBatches),
  ]);

  return (
    <>
      <PageHeader
        title="Importar"
        description="Carga facturas de Nubox y cartolas del banco (CSV / Excel)"
      />

      {confirmado !== undefined && (
        <div className="mb-6 rounded-lg border border-[var(--status-emerald)] bg-[var(--status-emerald-bg)] px-4 py-3 text-sm text-[var(--status-emerald)]">
          Importación confirmada: {confirmado} registro(s) insertado(s).
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ImportForm
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            type: t.type,
          }))}
          accounts={accounts.map((a) => ({
            id: a.id,
            bank: a.bank,
            name: a.name,
          }))}
        />

        <div className="glass rounded-xl p-5">
          <h2 className="font-heading mb-3 text-base font-medium">
            Importaciones recientes
          </h2>
          {batches.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aún no hay importaciones.
            </p>
          ) : (
            <div className="space-y-1">
              {batches.map((b) => (
                <Link
                  key={b.id}
                  href={`/finanzas/importar/${b.id}`}
                  className="hover:bg-accent flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="block truncate">{b.fileName}</span>
                    <span className="text-muted-foreground text-xs">
                      {TYPE_LABELS[b.type] ?? b.type} ·{" "}
                      {formatDate(b.createdAt)} · {b.rowsInserted}/{b.rowsValid}{" "}
                      insertados
                    </span>
                  </div>
                  <StatusBadge value={b.status} />
                </Link>
              ))}
            </div>
          )}
          <UrlPagination
            page={page}
            pageSize={pageSize}
            total={totalRows[0]?.value ?? 0}
          />
        </div>
      </div>
    </>
  );
}
