import Link from "next/link";
import { asc } from "drizzle-orm";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { db } from "@/db";
import { ledgerAccounts, businessLines, costCenters } from "@/db/schema";
import { getUnclassifiedDocuments } from "@/features/finance/queries";

const TYPE_LABELS: Record<string, string> = {
  INGRESO: "Ingreso",
  COSTO: "Costo",
  GASTO: "Gasto",
  ACTIVO: "Activo",
  PASIVO: "Pasivo",
  PATRIMONIO: "Patrimonio",
};

export default async function PlanCuentasPage() {
  const [accounts, lineas, centros, sinClasificar] = await Promise.all([
    db.select().from(ledgerAccounts).orderBy(asc(ledgerAccounts.code)),
    db.select().from(businessLines).orderBy(asc(businessLines.code)),
    db.select().from(costCenters).orderBy(asc(costCenters.code)),
    getUnclassifiedDocuments(),
  ]);

  return (
    <>
      <PageHeader
        title="Plan de cuentas"
        description="Cuentas contables, líneas de negocio y centros de costo"
        action={
          <Link
            href="/finanzas/plan-cuentas/sin-clasificar"
            className="border-border inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <Inbox className="size-4" /> Sin clasificar
            {sinClasificar.length > 0 && (
              <span className="bg-foreground text-background rounded-full px-1.5 py-0.5 text-[10px]">
                {sinClasificar.length}
              </span>
            )}
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass rounded-xl p-5 lg:col-span-2">
          <h2 className="font-heading mb-3 text-base font-medium">
            Plan de cuentas
          </h2>
          <div className="space-y-0.5">
            {accounts.map((a) => {
              const depth = (a.code.match(/\./g) ?? []).length;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-1 text-sm"
                  style={{ paddingLeft: `${depth * 16}px` }}
                >
                  <span
                    className={depth === 0 ? "font-medium" : "text-foreground"}
                  >
                    <span className="text-muted-foreground mr-2 tabular-nums">
                      {a.code}
                    </span>
                    {a.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {TYPE_LABELS[a.type] ?? a.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-xl p-5">
            <h2 className="font-heading mb-3 text-base font-medium">
              Líneas de negocio
            </h2>
            <ul className="space-y-1 text-sm">
              {lineas.map((l) => (
                <li key={l.id} className="flex justify-between">
                  <span>{l.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {l.code}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-xl p-5">
            <h2 className="font-heading mb-3 text-base font-medium">
              Centros de costo
            </h2>
            <ul className="space-y-1 text-sm">
              {centros.map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {c.code}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
