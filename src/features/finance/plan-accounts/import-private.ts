import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ledgerAccounts, services } from "@/db/schema";
import type {
  Area,
  LedgerAccountKind,
  LedgerAccountType,
} from "@/types/enums";

type SourceRow = {
  nivel: number;
  tipo: string;
  nombre: string;
  cuentaPadre: string | null;
  tipoCuenta: string;
  descripcion: string | null;
};

const SOURCE_CANDIDATES = [
  "data/normalized/plan_de_cuentas.json",
  "data/normalized/plan_de_cuentas.csv",
  "context/estructura financiera/plan_de_cuentas.xlsx",
  "context/estructura financiera/plan_de_cuentas.csv",
  "context/estructura financiera/plan_de_cuentas.json",
] as const;

function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function valueByNames(row: Record<string, unknown>, names: string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [
      key
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replaceAll(/[^a-z0-9]/g, ""),
      value,
    ]),
  );
  for (const name of names) {
    const value = normalized.get(name);
    if (value != null) return value;
  }
  return null;
}

function normalizeRow(row: Record<string, unknown>): SourceRow | null {
  const nombre = text(valueByNames(row, ["nombre", "cuenta", "servicio"]));
  if (!nombre) return null;
  const rawLevel = Number(valueByNames(row, ["nivel", "level"]) ?? 1);
  return {
    nivel: Number.isFinite(rawLevel) ? Math.max(1, Math.trunc(rawLevel)) : 1,
    tipo: text(valueByNames(row, ["tipo", "kind"])) || "Cuenta",
    nombre,
    cuentaPadre:
      text(valueByNames(row, ["cuentapadre", "padre", "parent"])) || null,
    tipoCuenta:
      text(valueByNames(row, ["tipodecuenta", "tipocuenta", "accounttype"])) ||
      "Gastos",
    descripcion:
      text(valueByNames(row, ["descripcion", "description"])) || null,
  };
}

async function readRows(path: string): Promise<SourceRow[]> {
  const extension = extname(path).toLowerCase();
  let rows: Record<string, unknown>[];
  if (extension === ".json") {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    rows = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } else if (extension === ".csv") {
    rows = Papa.parse<Record<string, unknown>>(readFileSync(path, "utf8"), {
      header: true,
      skipEmptyLines: true,
    }).data;
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const headers = (sheet.getRow(1).values as unknown[])
      .slice(1)
      .map((value) => text(value));
    rows = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = (row.values as unknown[]).slice(1);
      rows.push(
        Object.fromEntries(headers.map((header, index) => [header, values[index]])),
      );
    });
  }
  return rows.flatMap((row) => {
    const normalized = normalizeRow(row);
    return normalized ? [normalized] : [];
  });
}

function accountType(value: string): LedgerAccountType {
  const normalized = value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toUpperCase();
  if (normalized.includes("INGRES")) return "INGRESO";
  if (normalized.includes("COST")) return "COSTO";
  if (normalized.includes("ACTIV")) return "ACTIVO";
  if (normalized.includes("PASIV")) return "PASIVO";
  if (normalized.includes("PATRIM")) return "PATRIMONIO";
  return "GASTO";
}

function accountKind(value: string): LedgerAccountKind {
  const normalized = value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toUpperCase();
  if (normalized.includes("SERVICIO")) return "SERVICIO";
  if (normalized.includes("PRODUCTO")) return "PRODUCTO";
  return "CUENTA";
}

function accountArea(path: string): Area | null {
  const normalized = path
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (normalized.includes("branding")) return "B&D";
  if (normalized.includes("web")) return "WD";
  if (normalized.includes("arquitect")) return "A&D";
  if (normalized.includes("audiovisual")) return "A&A";
  return null;
}

function stableCode(path: string, level: number) {
  const hash = createHash("sha1").update(path).digest("hex").slice(0, 12);
  return `PC.${String(level).padStart(2, "0")}.${hash}`;
}

export async function importPrivatePlanOfAccounts() {
  const dataDir = process.env.NOMA_DATA_DIR ?? "../noma-ops";
  const path = SOURCE_CANDIDATES.map((candidate) =>
    resolve(dataDir, candidate),
  ).find(existsSync);
  if (!path) return null;

  const rows = await readRows(path);
  const stack = new Map<
    number,
    { id: string; code: string; name: string; path: string }
  >();
  const byName = new Map<
    string,
    { id: string; code: string; name: string; path: string }
  >();
  let linkedServices = 0;

  for (const row of rows) {
    const explicitParent = row.cuentaPadre
      ? byName.get(row.cuentaPadre.toLocaleLowerCase("es-CL"))
      : null;
    const parent = explicitParent ?? stack.get(row.nivel - 1) ?? null;
    const fullPath = parent ? `${parent.path} / ${row.nombre}` : row.nombre;
    const code = stableCode(fullPath, row.nivel);
    const kind = accountKind(row.tipo);
    const area = accountArea(fullPath);

    let serviceId: string | null = null;
    if (kind !== "CUENTA") {
      const conditions = [eq(services.name, row.nombre)];
      if (area) conditions.push(eq(services.area, area));
      const [service] = await db
        .select({ id: services.id })
        .from(services)
        .where(and(...conditions))
        .limit(1);
      serviceId = service?.id ?? null;
    }

    await db
      .insert(ledgerAccounts)
      .values({
        code,
        name: row.nombre,
        type: accountType(row.tipoCuenta),
        kind,
        description: row.descripcion,
        parentId: parent?.id ?? null,
        area,
        serviceId,
      })
      .onConflictDoUpdate({
        target: ledgerAccounts.code,
        set: {
          name: row.nombre,
          type: accountType(row.tipoCuenta),
          kind,
          description: row.descripcion,
          parentId: parent?.id ?? null,
          area,
          serviceId,
          updatedAt: new Date(),
        },
      });
    const [account] = await db
      .select({ id: ledgerAccounts.id })
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.code, code))
      .limit(1);
    if (!account) continue;

    const indexed = {
      id: account.id,
      code,
      name: row.nombre,
      path: fullPath,
    };
    stack.set(row.nivel, indexed);
    for (const level of [...stack.keys()]) {
      if (level > row.nivel) stack.delete(level);
    }
    byName.set(row.nombre.toLocaleLowerCase("es-CL"), indexed);

    if (serviceId) {
      await db
        .update(services)
        .set({ ledgerAccountId: account.id, updatedAt: new Date() })
        .where(eq(services.id, serviceId));
      linkedServices += 1;
    }
  }

  return { path, accounts: rows.length, linkedServices };
}
