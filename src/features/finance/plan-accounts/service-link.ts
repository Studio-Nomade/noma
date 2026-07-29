import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { ledgerAccounts, services } from "@/db/schema";
import { AREA_LABELS } from "@/types/enums";

function areaCode(area: string) {
  return area.replaceAll("&", "AND").replaceAll(/[^A-Z0-9]+/g, "-");
}

async function accountByCode(code: string) {
  const [account] = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.code, code))
    .limit(1);
  return account ?? null;
}

async function upsertAccount(input: {
  code: string;
  name: string;
  type: "INGRESO";
  parentId?: string | null;
  area?: typeof services.$inferSelect.area | null;
}) {
  await db
    .insert(ledgerAccounts)
    .values({
      ...input,
      kind: "CUENTA",
      parentId: input.parentId ?? null,
      area: input.area ?? null,
    })
    .onConflictDoUpdate({
      target: ledgerAccounts.code,
      set: {
        name: input.name,
        type: input.type,
        parentId: input.parentId ?? null,
        area: input.area ?? null,
        updatedAt: new Date(),
      },
    });
  const account = await accountByCode(input.code);
  if (!account) throw new Error(`No se pudo crear la cuenta ${input.code}.`);
  return account.id;
}

async function incomeServicesParentId() {
  const [imported] = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(
      and(
        eq(ledgerAccounts.name, "Ingresos por Servicios del Giro"),
        eq(ledgerAccounts.type, "INGRESO"),
      ),
    )
    .limit(1);
  if (imported) return imported.id;

  const incomeId = await upsertAccount({
    code: "AUTO.INGRESOS",
    name: "Ingresos",
    type: "INGRESO",
  });
  const operatingId = await upsertAccount({
    code: "AUTO.INGRESOS.EXPLOTACION",
    name: "Ingresos de Explotación",
    type: "INGRESO",
    parentId: incomeId,
  });
  return upsertAccount({
    code: "AUTO.INGRESOS.EXPLOTACION.SERVICIOS",
    name: "Ingresos por Servicios del Giro",
    type: "INGRESO",
    parentId: operatingId,
  });
}

export async function ensureServiceLedgerAccount(serviceId: string) {
  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, serviceId))
    .limit(1);
  if (!service) throw new Error("El servicio no existe.");

  const servicesParentId = await incomeServicesParentId();
  const [importedArea] = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(
      and(
        eq(ledgerAccounts.parentId, servicesParentId),
        eq(ledgerAccounts.area, service.area),
        eq(ledgerAccounts.type, "INGRESO"),
      ),
    )
    .limit(1);
  const areaAccountId =
    importedArea?.id ??
    (await upsertAccount({
      code: `AUTO.INGRESOS.EXPLOTACION.SERVICIOS.${areaCode(service.area)}`,
      name: AREA_LABELS[service.area],
      type: "INGRESO",
      parentId: servicesParentId,
      area: service.area,
    }));
  const code = `SVC.${service.id}`;
  const [linked] = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(
      or(
        eq(ledgerAccounts.serviceId, service.id),
        eq(ledgerAccounts.code, code),
      ),
    )
    .limit(1);

  let ledgerAccountId = linked?.id;
  if (ledgerAccountId) {
    await db
      .update(ledgerAccounts)
      .set({
        code,
        name: service.name,
        type: "INGRESO",
        kind: "SERVICIO",
        parentId: areaAccountId,
        area: service.area,
        serviceId: service.id,
        updatedAt: new Date(),
      })
      .where(eq(ledgerAccounts.id, ledgerAccountId));
  } else {
    const [created] = await db
      .insert(ledgerAccounts)
      .values({
        code,
        name: service.name,
        type: "INGRESO",
        kind: "SERVICIO",
        parentId: areaAccountId,
        area: service.area,
        serviceId: service.id,
      })
      .returning({ id: ledgerAccounts.id });
    ledgerAccountId = created.id;
  }

  await db
    .update(services)
    .set({ ledgerAccountId, updatedAt: new Date() })
    .where(eq(services.id, service.id));
  return ledgerAccountId;
}
