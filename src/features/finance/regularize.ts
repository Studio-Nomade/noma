import { scoreMatch, isFactoringGlosa } from "./reconcile-match";

/**
 * Regularización de Finanzas desde la carpeta local de Sebastián (02_FINANCE):
 * consolidado de Nubox, XML de facturas emitidas, cesiones a factoring y
 * cartolas BCI. Módulo puro: lo usa `scripts/finance-regularize.ts`.
 */

export type RegDocType = "FACTURA_VENTA" | "NOTA_CREDITO";

export type RegDoc = {
  type: RegDocType;
  folio: string;
  rut: string;
  nombre: string;
  fechaEmision: string; // YYYY-MM-DD
  fechaVencimiento: string | null;
  neto: number;
  exento: number;
  iva: number;
  total: number;
  /** Nubox: cedida a factoring. */
  cedido: boolean;
  /** Nubox: saldada (pagada o anulada) según su propio estado de cobro. */
  nuboxSaldada: boolean;
  source: string;
};

/** «16/10/2026» → «2026-10-16». */
export function dmyToIso(raw: string | null | undefined): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((raw ?? "").trim());
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

const NUBOX_TYPES: Record<string, RegDocType> = {
  "FAC-EL": "FACTURA_VENTA",
  "FAC-EE": "FACTURA_VENTA",
  "N/C-EL": "NOTA_CREDITO",
};

/** Una fila del «Consolidado Nubox - Todos los documentos» (CSV con «;»). */
export function docFromNuboxRow(
  row: Record<string, string>,
  source: string,
): RegDoc | null {
  const type = NUBOX_TYPES[(row["Documento"] ?? "").trim()];
  if (!type) return null; // boletas y otros: fuera de la cobranza
  if ((row["Estado"] ?? "").trim() !== "Emitido") return null; // borradores
  const fecha = dmyToIso(row["Fecha"]);
  const folio = (row["Folio"] ?? "").trim();
  if (!fecha || !folio) return null;
  const n = (k: string) => Number((row[k] ?? "0").replace(/[^\d-]/g, "")) || 0;
  return {
    type,
    folio,
    rut: (row["Rut Cliente"] ?? "").trim().toUpperCase(),
    nombre: (row["Cliente"] ?? "").trim(),
    fechaEmision: fecha,
    fechaVencimiento: dmyToIso(row["Fecha vencimiento"]),
    neto: n("Monto neto"),
    exento: n("Monto exento"),
    iva: n("Monto IVA"),
    total: n("Monto total"),
    cedido: (row["Cedido"] ?? "").trim().toLowerCase() === "true",
    nuboxSaldada: (row["Estado de cobro"] ?? "").trim() === "BALANCED",
    source,
  };
}

/** Tipo de DTE del SII → tipo de documento de Noma. */
export function docTypeFromDte(tipoDte: string): RegDocType | null {
  if (tipoDte === "33" || tipoDte === "34") return "FACTURA_VENTA";
  if (tipoDte === "61") return "NOTA_CREDITO";
  return null;
}

/** «20261023_Factoring DTE 487 - Financia Capital» → folio, fecha y entidad. */
export function factoringFromFolder(
  name: string,
): { folio: string; fecha: string; entidad: string } | null {
  const m = /^(\d{4})(\d{2})(\d{2})_Factoring DTE (\d+)\s*-\s*(.+)$/i.exec(
    name.trim(),
  );
  if (!m) return null;
  return {
    folio: m[4],
    fecha: `${m[1]}-${m[2]}-${m[3]}`,
    entidad: m[5].trim(),
  };
}

/**
 * Notas de crédito que anulan una factura: misma contraparte, mismo total y
 * emitida antes que la nota. Devuelve folio de NC → folio de factura.
 */
export function creditNoteTargets(docs: RegDoc[]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  const ncs = docs
    .filter((d) => d.type === "NOTA_CREDITO")
    .sort((a, b) => a.fechaEmision.localeCompare(b.fechaEmision));
  for (const nc of ncs) {
    const target = docs
      .filter(
        (d) =>
          d.type === "FACTURA_VENTA" &&
          d.rut === nc.rut &&
          Math.round(d.total) === Math.round(nc.total) &&
          d.fechaEmision <= nc.fechaEmision &&
          !used.has(d.folio),
      )
      .sort((a, b) => b.fechaEmision.localeCompare(a.fechaEmision))[0];
    if (target) {
      out.set(nc.folio, target.folio);
      used.add(target.folio);
    }
  }
  return out;
}

export type OpenDoc = {
  id: string;
  folio: string;
  fechaEmision: string;
  saldo: number;
  rut: string | null;
  nombre: string | null;
};

export type BankTxn = {
  id: string;
  fecha: string;
  glosa: string;
  monto: number;
};

export type AutoMatch = { txnId: string; docIds: string[]; score: number };

/** Puntaje mínimo para conciliar sin revisión: monto exacto y ≤ 45 días. */
export const AUTO_MATCH_MIN = 70;

function combos<T>(items: T[], size: number): T[][] {
  if (size === 1) return items.map((i) => [i]);
  const out: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of combos(items.slice(i + 1), size - 1)) {
      out.push([item, ...rest]);
    }
  });
  return out;
}

/**
 * Conciliación automática conservadora: un abono se concilia solo si hay una
 * única mejor opción (una factura, o 2–3 facturas del mismo cliente que suman
 * el monto) con puntaje ≥ AUTO_MATCH_MIN. Los abonos de factoring y los
 * empates quedan para revisión manual en Noma.
 */
export function pickAutoMatches(txns: BankTxn[], docs: OpenDoc[]): AutoMatch[] {
  const taken = new Set<string>();
  const out: AutoMatch[] = [];
  const sorted = [...txns].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const txn of sorted) {
    if (isFactoringGlosa(txn.glosa)) continue;
    const open = docs.filter((d) => !taken.has(d.id) && d.saldo > 0);
    const options: { docIds: string[]; score: number }[] = [];
    for (const doc of open) {
      const score = scoreMatch(
        { fecha: txn.fecha, glosa: txn.glosa, monto: txn.monto, tipo: "ABONO" },
        {
          fechaEmision: doc.fechaEmision,
          saldo: doc.saldo,
          contactRut: doc.rut,
          contactName: doc.nombre,
        },
      );
      if (score >= AUTO_MATCH_MIN) options.push({ docIds: [doc.id], score });
    }
    if (!options.length) {
      // Pago de varias facturas del mismo cliente en una transferencia.
      const byRut = new Map<string, OpenDoc[]>();
      for (const d of open) {
        if (!d.rut) continue;
        byRut.set(d.rut, [...(byRut.get(d.rut) ?? []), d]);
      }
      for (const group of byRut.values()) {
        const recent = group.filter((d) => {
          const days =
            (new Date(txn.fecha).getTime() -
              new Date(d.fechaEmision).getTime()) /
            86_400_000;
          return days >= -5 && days <= 60;
        });
        for (const size of [2, 3]) {
          for (const set of combos(recent.slice(0, 12), size)) {
            const sum = set.reduce((a, d) => a + d.saldo, 0);
            if (Math.round(sum) !== Math.round(txn.monto)) continue;
            const glosaHit = scoreMatch(
              {
                fecha: txn.fecha,
                glosa: txn.glosa,
                monto: set[0].saldo,
                tipo: "ABONO",
              },
              {
                fechaEmision: set[0].fechaEmision,
                saldo: set[0].saldo,
                contactRut: set[0].rut,
                contactName: set[0].nombre,
              },
            );
            options.push({ docIds: set.map((d) => d.id), score: glosaHit });
          }
        }
      }
    }
    const best = options.sort((a, b) => b.score - a.score);
    if (!best.length || best[0].score < AUTO_MATCH_MIN) continue;
    if (best.length > 1 && best[1].score === best[0].score) continue; // empate
    out.push({ txnId: txn.id, ...best[0] });
    best[0].docIds.forEach((id) => taken.add(id));
  }
  return out;
}
