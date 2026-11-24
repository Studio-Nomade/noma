/**
 * Regulariza Finanzas en Noma desde la carpeta local 02_FINANCE de Sebastián:
 *
 *   1. Facturas y notas de crédito emitidas en 2026: consolidado de Nubox
 *      (CSV) + XML de cada mes (las posteriores al consolidado).
 *   2. Notas de crédito: anulan la factura del mismo cliente y monto.
 *   3. Cesiones a factoring: consolidado («Cedido») y carpetas
 *      04_Factoring/AAAAMMDD_Factoring DTE NNN - Entidad. La cobranza no las
 *      persigue (cobra el factoring).
 *   4. Cartolas BCI de 2026 → movimientos del banco (sin duplicar).
 *   5. Conciliación automática conservadora (monto exacto, fecha, RUT/nombre;
 *      solo coincidencias únicas). Lo dudoso queda para revisar en Noma.
 *   6. Lo que Nubox da por saldado y no se encontró en las cartolas se marca
 *      como conciliado, con una observación.
 *
 * Uso:
 *   FINANCE_DIR="…/02_FINANCE" REPORT_DIR="…" npx tsx scripts/finance-regularize.ts           # simulación (no guarda)
 *   FINANCE_DIR="…/02_FINANCE" REPORT_DIR="…" npx tsx scripts/finance-regularize.ts --apply   # guarda
 *
 * Es idempotente: se puede volver a correr cuando haya cartolas o facturas
 * nuevas. Nunca borra ni modifica montos de documentos ya cargados.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import Papa from "papaparse";
import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bankAccounts,
  bankTransactions,
  clients,
  cobranzaCases,
  finContacts,
  finDocuments,
  importBatches,
  reconciliationDocuments,
  reconciliationTransactions,
  reconciliations,
} from "@/db/schema";
import { decodeXml, parseDte } from "@/features/finance/import/dte-xml";
import { parseFile } from "@/features/finance/import/parse";
import { mapTransactions } from "@/features/finance/import/mappers";
import { money, periodoSii, toNum } from "@/features/finance/helpers";
import {
  creditNoteTargets,
  docFromNuboxRow,
  docTypeFromDte,
  factoringFromFolder,
  pickAutoMatches,
  type RegDoc,
} from "@/features/finance/regularize";
import { isRealRut, normalizeRut } from "@/lib/text/rut";

const APPLY = process.argv.includes("--apply");
const YEAR = "2026";
const FIN = process.env.FINANCE_DIR ?? "";
const REPORT_DIR = process.env.REPORT_DIR ?? process.cwd();
const VENTAS = join(FIN, "01_INGRESOS Y VENTAS", "01_Facturas Emitidas");
const BANCOS = join(FIN, "04_BANCOS Y FINANCIAMIENTO");

class DryRun extends Error {}

function ls(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir) : [];
}

function clp(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

// ── 1. Lectura de la carpeta ─────────────────────────────────

function readNuboxCsv(): RegDoc[] {
  const dir = join(VENTAS, "00_Consolidados Nubox");
  const files = ls(dir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort();
  const out: RegDoc[] = [];
  for (const file of files) {
    const text = readFileSync(join(dir, file), "utf8").replace(/^﻿/, "");
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
    });
    for (const row of parsed.data) {
      const doc = docFromNuboxRow(row, file);
      if (doc && doc.fechaEmision.startsWith(YEAR)) out.push(doc);
    }
  }
  return out;
}

function readXmls(): RegDoc[] {
  const out: RegDoc[] = [];
  for (const month of ls(VENTAS).filter((m) => /^\d{2}_/.test(m))) {
    for (const sub of ["3. XML", "- Notas de Crédito"]) {
      const dir = join(VENTAS, month, sub);
      for (const file of ls(dir).filter((f) =>
        f.toLowerCase().endsWith(".xml"),
      )) {
        const xml = decodeXml(readFileSync(join(dir, file)));
        const venc = /<FchVenc>([\d-]+)<\/FchVenc>/.exec(xml)?.[1] ?? null;
        for (const dte of parseDte(xml)) {
          const type = docTypeFromDte(dte.tipoDte);
          if (!type || !dte.fchEmis?.startsWith(YEAR)) continue;
          out.push({
            type,
            folio: dte.folio,
            rut: (dte.rutReceptor ?? "").toUpperCase(),
            nombre: dte.rznSocReceptor ?? "",
            fechaEmision: dte.fchEmis,
            fechaVencimiento: venc,
            neto: dte.mntNeto,
            exento: dte.mntExento,
            iva: dte.iva,
            total: dte.mntTotal,
            cedido: false,
            nuboxSaldada: false,
            source: `${month}/${file}`,
          });
        }
      }
    }
  }
  return out;
}

function mergeDocs(csv: RegDoc[], xml: RegDoc[]): RegDoc[] {
  const byKey = new Map<string, RegDoc>();
  for (const d of csv) byKey.set(`${d.type}|${d.folio}`, d);
  for (const d of xml) {
    const key = `${d.type}|${d.folio}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, d);
    else if (!prev.fechaVencimiento && d.fechaVencimiento)
      prev.fechaVencimiento = d.fechaVencimiento;
  }
  return [...byKey.values()].sort((a, b) =>
    a.fechaEmision.localeCompare(b.fechaEmision),
  );
}

function readFactoring() {
  const out = new Map<string, { fecha: string; entidad: string }>();
  for (const name of ls(join(BANCOS, "04_Factoring"))) {
    const f = factoringFromFolder(name);
    if (f) out.set(f.folio, { fecha: f.fecha, entidad: f.entidad });
  }
  return out;
}

async function readCartolas() {
  const dir = join(BANCOS, "01_Cuentas Bancarias", "Cartolas Banco BCI");
  const files = ls(dir)
    .filter((f) => f.startsWith(YEAR) && f.toLowerCase().endsWith(".xlsx"))
    .sort();
  const out: {
    file: string;
    txns: ReturnType<typeof mapTransactions>["valid"];
    rejected: number;
  }[] = [];
  for (const file of files) {
    const { rows } = await parseFile(readFileSync(join(dir, file)), file);
    const { valid, rejected } = mapTransactions(rows, {
      fecha: "Fecha",
      glosa: "Descripción",
      cargo: "Cargo",
      abono: "Abono",
      saldo: "Saldo",
      documento: "N° Documento",
    });
    out.push({ file, txns: valid, rejected: rejected.length });
  }
  return out;
}

// ── 2. Base de datos ─────────────────────────────────────────

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function main() {
  if (!FIN || !existsSync(VENTAS)) {
    throw new Error(`FINANCE_DIR no apunta a 02_FINANCE (${FIN}).`);
  }
  const csv = readNuboxCsv();
  const xml = readXmls();
  const docs = mergeDocs(csv, xml);
  const factoring = readFactoring();
  const cartolas = await readCartolas();
  const ncTargets = creditNoteTargets(docs);
  const today = new Date().toISOString().slice(0, 10);

  console.log(`Modo: ${APPLY ? "GUARDAR" : "SIMULACIÓN (no guarda nada)"}`);
  console.log(
    `Leídos: ${csv.length} documentos del consolidado de Nubox, ${xml.length} XML, ${docs.length} documentos únicos de ${YEAR}.`,
  );
  console.log(
    `Cesiones a factoring en carpetas: ${factoring.size}. Cartolas: ${cartolas.map((c) => c.file).join(", ") || "ninguna"}.`,
  );

  if (process.argv.includes("--read-only")) {
    const ncs = docs.filter((d) => d.type === "NOTA_CREDITO").length;
    console.log(
      JSON.stringify(
        {
          facturas: docs.length - ncs,
          notasCredito: ncs,
          ncAnulan: Object.fromEntries(ncTargets),
          cedidasNubox: docs.filter((d) => d.cedido).length,
          saldadasNubox: docs.filter((d) => d.nuboxSaldada).map((d) => d.folio),
          cartolas: cartolas.map((c) => ({
            file: c.file,
            movimientos: c.txns.length,
            abonos: c.txns.filter((t) => t.tipo === "ABONO").length,
            rechazadas: c.rejected,
          })),
          ultimas: docs
            .slice(-5)
            .map((d) => `${d.folio} ${d.fechaEmision} ${d.nombre} ${d.total}`),
        },
        null,
        2,
      ),
    );
    return;
  }

  const report: string[] = [];
  const stats = {
    contactos: 0,
    documentosNuevos: 0,
    anuladas: 0,
    cedidas: 0,
    movimientosNuevos: 0,
    conciliacionesAuto: 0,
    saldadasNubox: 0,
  };

  try {
    await db.transaction(async (tx: Tx) => {
      // Contactos (clientes) por RUT, enlazados a la ficha del cliente.
      const clientRows = await tx
        .select({ id: clients.id, rut: clients.rut })
        .from(clients);
      const clientByRut = new Map<string, string>();
      for (const c of clientRows)
        if (isRealRut(c.rut)) clientByRut.set(normalizeRut(c.rut)!, c.id);
      const ruts = [...new Set(docs.map((d) => d.rut || "SIN-RUT"))];
      for (const rut of ruts) {
        const d = docs.find((x) => (x.rut || "SIN-RUT") === rut)!;
        await tx
          .insert(finContacts)
          .values({
            rut,
            name: d.nombre || rut,
            type: "CLIENTE",
            status: "ACTIVO",
            clientId: isRealRut(rut)
              ? (clientByRut.get(normalizeRut(rut)!) ?? null)
              : null,
          })
          .onConflictDoUpdate({
            target: [finContacts.rut, finContacts.type],
            set: {
              clientId: sql`coalesce(${finContacts.clientId}, excluded.client_id)`,
            },
          });
      }
      stats.contactos = ruts.length;
      const contacts = await tx
        .select({
          id: finContacts.id,
          rut: finContacts.rut,
          name: finContacts.name,
          email: finContacts.email,
          clientEmail: clients.billingEmail,
          clientEmail2: clients.email,
        })
        .from(finContacts)
        .leftJoin(clients, eq(clients.id, finContacts.clientId))
        .where(
          and(eq(finContacts.type, "CLIENTE"), inArray(finContacts.rut, ruts)),
        );
      const contactByRut = new Map(contacts.map((c) => [c.rut, c]));

      // Documentos: solo se insertan los que faltan.
      const [batch] = await tx
        .insert(importBatches)
        .values({
          type: "NUBOX_VENTAS",
          status: "CONFIRMADO",
          fileName: "Regularización 02_FINANCE (consolidado Nubox + XML)",
          rowsDetected: docs.length,
          rowsValid: docs.length,
          confirmedAt: new Date(),
          summary: { origen: "scripts/finance-regularize.ts" },
        })
        .returning({ id: importBatches.id });
      for (const d of docs) {
        const contactId = contactByRut.get(d.rut || "SIN-RUT")!.id;
        const vencida = d.fechaVencimiento && d.fechaVencimiento < today;
        const rows = await tx
          .insert(finDocuments)
          .values({
            direction: "VENTA",
            type: d.type,
            folio: d.folio,
            contactId,
            fechaEmision: d.fechaEmision,
            fechaVencimiento: d.fechaVencimiento,
            neto: money(d.neto),
            iva: money(d.iva),
            exento: money(d.exento),
            total: money(d.total),
            status: vencida ? "VENCIDA" : "EMITIDA",
            recordStatus: "ACTIVO",
            periodoSii: periodoSii(d.fechaEmision),
            importBatchId: batch.id,
            sourceFile: d.source,
          })
          .onConflictDoNothing()
          .returning({ id: finDocuments.id });
        stats.documentosNuevos += rows.length;
      }
      await tx
        .update(importBatches)
        .set({ rowsInserted: stats.documentosNuevos })
        .where(eq(importBatches.id, batch.id));

      const dbDocs = await tx
        .select({
          id: finDocuments.id,
          type: finDocuments.type,
          folio: finDocuments.folio,
          status: finDocuments.status,
          total: finDocuments.total,
          montoConciliado: finDocuments.montoConciliado,
          fechaEmision: finDocuments.fechaEmision,
          fechaVencimiento: finDocuments.fechaVencimiento,
          contactId: finDocuments.contactId,
        })
        .from(finDocuments)
        .where(
          and(
            eq(finDocuments.direction, "VENTA"),
            sql`${finDocuments.fechaEmision} >= ${`${YEAR}-01-01`}`,
          ),
        );
      const docId = (type: string, folio: string) =>
        dbDocs.find((d) => d.type === type && d.folio === folio);

      // Notas de crédito → factura anulada.
      for (const [ncFolio, facFolio] of ncTargets) {
        const fac = docId("FACTURA_VENTA", facFolio);
        if (!fac || fac.status === "ANULADA" || toNum(fac.montoConciliado) > 0)
          continue;
        await tx
          .update(finDocuments)
          .set({
            status: "ANULADA",
            observacion: `Anulada por la nota de crédito N° ${ncFolio}.`,
          })
          .where(eq(finDocuments.id, fac.id));
        fac.status = "ANULADA";
        stats.anuladas++;
      }

      // Cesiones a factoring.
      const cedidas = new Map<string, { fecha: string; entidad: string }>();
      for (const d of docs)
        if (d.type === "FACTURA_VENTA" && d.cedido)
          cedidas.set(d.folio, {
            fecha: d.fechaEmision,
            entidad: "Factoring (según Nubox)",
          });
      for (const [folio, f] of factoring) cedidas.set(folio, f);
      for (const [folio, f] of cedidas) {
        const fac = docId("FACTURA_VENTA", folio);
        if (!fac) continue;
        await tx
          .insert(cobranzaCases)
          .values({
            documentId: fac.id,
            factoringEntity: f.entidad,
            factoringAt: f.fecha,
          })
          .onConflictDoUpdate({
            target: cobranzaCases.documentId,
            set: {
              factoringEntity: sql`coalesce(${cobranzaCases.factoringEntity}, excluded.factoring_entity)`,
              factoringAt: sql`coalesce(${cobranzaCases.factoringAt}, excluded.factoring_at)`,
            },
          });
        stats.cedidas++;
      }

      // Cuenta BCI y movimientos de las cartolas.
      let [account] = await tx
        .select()
        .from(bankAccounts)
        .where(ilike(bankAccounts.bank, "%bci%"))
        .limit(1);
      if (!account) {
        [account] = await tx
          .insert(bankAccounts)
          .values({ bank: "BCI", name: "Cuenta corriente", currency: "CLP" })
          .returning();
      }
      const existing = await tx
        .select({
          fecha: bankTransactions.fecha,
          monto: bankTransactions.monto,
          glosa: bankTransactions.glosa,
          tipo: bankTransactions.tipo,
          saldo: bankTransactions.saldo,
        })
        .from(bankTransactions)
        .where(eq(bankTransactions.bankAccountId, account.id));
      const saldoKey = (v: unknown) =>
        v === null || v === undefined ? "" : String(Math.round(Number(v)));
      const keys = new Set(
        existing.map(
          (t) =>
            `${String(t.fecha).slice(0, 10)}|${t.tipo}|${Math.round(Number(t.monto))}|${t.glosa}|${saldoKey(t.saldo)}`,
        ),
      );
      for (const c of cartolas) {
        const fresh = c.txns.filter((t) => {
          const key = `${t.fecha.slice(0, 10)}|${t.tipo}|${Math.round(t.monto)}|${t.glosa}|${saldoKey(t.saldo)}`;
          if (t.isDuplicate || keys.has(key)) return false;
          keys.add(key);
          return true;
        });
        if (!fresh.length) continue;
        const [b] = await tx
          .insert(importBatches)
          .values({
            type: "CARTOLA_BANCARIA",
            status: "CONFIRMADO",
            fileName: c.file,
            rowsDetected: c.txns.length + c.rejected,
            rowsValid: c.txns.length,
            rowsRejected: c.rejected,
            rowsInserted: fresh.length,
            confirmedAt: new Date(),
            summary: { origen: "scripts/finance-regularize.ts" },
          })
          .returning({ id: importBatches.id });
        await tx.insert(bankTransactions).values(
          fresh.map((t) => ({
            bankAccountId: account.id,
            fecha: t.fecha.slice(0, 10),
            glosa: t.glosa,
            monto: money(t.monto),
            tipo: t.tipo,
            saldo: t.saldo !== null ? money(t.saldo) : null,
            status: "PENDIENTE" as const,
            recordStatus: "ACTIVO" as const,
            importBatchId: b.id,
            sourceFile: c.file,
          })),
        );
        stats.movimientosNuevos += fresh.length;
      }

      // Conciliación automática.
      const cedidaIds = new Set(
        (
          await tx
            .select({ id: cobranzaCases.documentId })
            .from(cobranzaCases)
            .where(sql`${cobranzaCases.factoringAt} is not null`)
        ).map((r) => r.id),
      );
      const contactById = new Map(contacts.map((c) => [c.id, c]));
      const openDocs = dbDocs
        .filter(
          (d) =>
            d.type === "FACTURA_VENTA" &&
            ["EMITIDA", "VENCIDA", "PARCIAL"].includes(d.status) &&
            !cedidaIds.has(d.id),
        )
        .map((d) => {
          const c = d.contactId ? contactById.get(d.contactId) : undefined;
          return {
            id: d.id,
            folio: d.folio,
            fechaEmision: String(d.fechaEmision),
            saldo: toNum(d.total) - toNum(d.montoConciliado),
            rut: c?.rut ?? null,
            nombre: c?.name ?? null,
          };
        });
      const abonos = (
        await tx
          .select()
          .from(bankTransactions)
          .where(
            and(
              eq(bankTransactions.bankAccountId, account.id),
              eq(bankTransactions.tipo, "ABONO"),
              eq(bankTransactions.status, "PENDIENTE"),
              eq(bankTransactions.recordStatus, "ACTIVO"),
            ),
          )
      ).map((t) => ({
        id: t.id,
        fecha: String(t.fecha),
        glosa: t.glosa,
        monto: toNum(t.monto) - toNum(t.montoConciliado),
      }));
      const matches = pickAutoMatches(abonos, openDocs);
      for (const m of matches) {
        const txn = abonos.find((t) => t.id === m.txnId)!;
        const [rec] = await tx
          .insert(reconciliations)
          .values({
            status: "ACTIVA",
            note: "Conciliación automática (regularización 02_FINANCE)",
          })
          .returning({ id: reconciliations.id });
        let applied = 0;
        for (const id of m.docIds) {
          const d = openDocs.find((x) => x.id === id)!;
          await tx.insert(reconciliationDocuments).values({
            reconciliationId: rec.id,
            documentId: id,
            amountApplied: money(d.saldo),
          });
          const doc = dbDocs.find((x) => x.id === id)!;
          await tx
            .update(finDocuments)
            .set({
              montoConciliado: money(toNum(doc.montoConciliado) + d.saldo),
              status: "CONCILIADA",
            })
            .where(eq(finDocuments.id, id));
          doc.status = "CONCILIADA";
          applied += d.saldo;
        }
        await tx.insert(reconciliationTransactions).values({
          reconciliationId: rec.id,
          bankTransactionId: txn.id,
          amountApplied: money(applied),
        });
        await tx
          .update(bankTransactions)
          .set({ montoConciliado: money(applied), status: "CONCILIADO" })
          .where(eq(bankTransactions.id, txn.id));
        stats.conciliacionesAuto++;
      }

      // Saldadas en Nubox sin abono encontrado en las cartolas.
      for (const d of docs.filter(
        (x) => x.type === "FACTURA_VENTA" && x.nuboxSaldada,
      )) {
        const fac = docId("FACTURA_VENTA", d.folio);
        if (!fac || !["EMITIDA", "VENCIDA", "PARCIAL"].includes(fac.status))
          continue;
        await tx
          .update(finDocuments)
          .set({
            status: "CONCILIADA",
            montoConciliado: money(toNum(fac.total)),
            observacion:
              "Saldada según Nubox; sin abono identificado en las cartolas cargadas.",
          })
          .where(eq(finDocuments.id, fac.id));
        fac.status = "CONCILIADA";
        stats.saldadasNubox++;
      }

      // Informe: lo que queda por cobrar (sin cesión ni anulación).
      const porCobrar = dbDocs
        .filter(
          (d) =>
            d.type === "FACTURA_VENTA" &&
            ["EMITIDA", "VENCIDA", "PARCIAL"].includes(d.status) &&
            !cedidaIds.has(d.id),
        )
        .map((d) => {
          const c = d.contactId ? contactById.get(d.contactId) : undefined;
          return {
            folio: d.folio,
            cliente: c?.name ?? "—",
            emision: String(d.fechaEmision),
            venc: d.fechaVencimiento ? String(d.fechaVencimiento) : "—",
            saldo: toNum(d.total) - toNum(d.montoConciliado),
            correo: c?.email || c?.clientEmail || c?.clientEmail2 || "",
          };
        })
        .sort((a, b) => a.emision.localeCompare(b.emision));
      const pendientes = await tx
        .select({
          fecha: bankTransactions.fecha,
          glosa: bankTransactions.glosa,
          monto: bankTransactions.monto,
        })
        .from(bankTransactions)
        .where(
          and(
            eq(bankTransactions.bankAccountId, account.id),
            eq(bankTransactions.tipo, "ABONO"),
            eq(bankTransactions.status, "PENDIENTE"),
            sql`${bankTransactions.fecha} >= ${`${YEAR}-01-01`}`,
          ),
        );

      report.push(
        `# Regularización de Finanzas en Noma · ${today}`,
        "",
        `Modo: **${APPLY ? "guardado" : "simulación (no se guardó nada)"}**.`,
        "",
        "| | |",
        "|---|---:|",
        `| Documentos de ${YEAR} leídos (Nubox + XML) | ${docs.length} |`,
        `| Documentos nuevos en Noma | ${stats.documentosNuevos} |`,
        `| Facturas anuladas por nota de crédito | ${stats.anuladas} |`,
        `| Facturas cedidas a factoring | ${stats.cedidas} |`,
        `| Movimientos nuevos del banco | ${stats.movimientosNuevos} |`,
        `| Conciliaciones automáticas | ${stats.conciliacionesAuto} |`,
        `| Saldadas según Nubox (sin abono en cartolas) | ${stats.saldadasNubox} |`,
        `| **Facturas por cobrar** | **${porCobrar.length} · ${clp(porCobrar.reduce((a, p) => a + p.saldo, 0))}** |`,
        "",
        "## Por cobrar (sin cesión ni anulación)",
        "",
        "Revisa esta lista antes de activar la cobranza: si alguna ya está pagada, concíliala en Noma › Finanzas › Banco.",
        "",
        "| Folio | Cliente | Emisión | Vence | Saldo | Correo de cobranza |",
        "|---|---|---|---|---:|---|",
        ...porCobrar.map(
          (p) =>
            `| ${p.folio} | ${p.cliente} | ${p.emision} | ${p.venc} | ${clp(p.saldo)} | ${p.correo || "**falta**"} |`,
        ),
        "",
        `## Abonos del banco sin conciliar (${pendientes.length})`,
        "",
        "Pueden ser pagos de facturas anteriores a 2026, anticipos de factoring o transferencias de socios. Se concilian a mano en Noma.",
        "",
        "| Fecha | Glosa | Monto |",
        "|---|---|---:|",
        ...pendientes
          .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
          .map(
            (t) =>
              `| ${String(t.fecha)} | ${t.glosa.replace(/\|/g, "/")} | ${clp(toNum(t.monto))} |`,
          ),
      );
      if (!APPLY) throw new DryRun();
    });
  } catch (error) {
    if (!(error instanceof DryRun)) throw error;
  }

  const file = join(
    REPORT_DIR,
    `${today.replace(/-/g, "")}_Regularizacion_Finanzas_Noma${APPLY ? "" : "_simulacion"}.md`,
  );
  writeFileSync(file, report.join("\n") + "\n");
  console.log("");
  console.log(JSON.stringify(stats, null, 2));
  console.log(`Informe: ${basename(file)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
