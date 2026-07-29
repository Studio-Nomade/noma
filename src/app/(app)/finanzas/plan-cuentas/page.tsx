import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { db } from "@/db";
import {
  ledgerAccounts,
  businessLines,
  costCenters,
  services,
} from "@/db/schema";
import { getUnclassifiedDocuments } from "@/features/finance/queries";
import { AccountsTree } from "@/features/finance/plan-accounts/accounts-tree";

export default async function PlanCuentasPage() {
  const [accounts, lineas, centros, sinClasificar] = await Promise.all([
    db
      .select({
        id: ledgerAccounts.id,
        code: ledgerAccounts.code,
        name: ledgerAccounts.name,
        type: ledgerAccounts.type,
        kind: ledgerAccounts.kind,
        description: ledgerAccounts.description,
        parentId: ledgerAccounts.parentId,
        serviceId: ledgerAccounts.serviceId,
        serviceName: services.name,
      })
      .from(ledgerAccounts)
      .leftJoin(services, eq(ledgerAccounts.serviceId, services.id))
      .orderBy(asc(ledgerAccounts.code)),
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
          <AccountsTree accounts={accounts} />
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
