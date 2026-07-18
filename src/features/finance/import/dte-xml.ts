import { XMLParser } from "fast-xml-parser";

/**
 * Parser del XML de un DTE del SII (EnvioDTE). Extrae folio, receptor, totales
 * y el DETALLE por línea — que es lo que Nubox NO entrega y permite clasificar
 * en servicio / línea de negocio / plan de cuentas.
 *
 * Notas del formato real (verificadas con una factura de Studio Nomade):
 *  · encoding ISO-8859-1 → hay que decodificar el buffer como latin1 o los
 *    acentos del detalle quedan corruptos.
 *  · un EnvioDTE puede traer varios <DTE>; cada uno un <Documento>.
 *  · <Detalle> puede venir una o varias veces (aquí se fuerza a array).
 */

export type DteLine = {
  nroLin: number;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  unidad: string | null;
  precio: number | null;
  monto: number;
};

export type ParsedDte = {
  folio: string;
  tipoDte: string;
  fchEmis: string | null;
  rutReceptor: string | null;
  rznSocReceptor: string | null;
  mntNeto: number;
  mntExento: number;
  iva: number;
  mntTotal: number;
  lines: DteLine[];
};

/** Decodifica el XML respetando su encoding (SII usa ISO-8859-1). */
export function decodeXml(buf: Buffer): string {
  const head = buf.subarray(0, 120).toString("latin1").toLowerCase();
  const isUtf8 = head.includes("utf-8");
  return buf.toString(isUtf8 ? "utf8" : "latin1");
}

const num = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string | null => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s || null;
};

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // los montos se parsean a mano (evita perder ceros)
  trimValues: true,
  isArray: (name) => name === "DTE" || name === "Detalle",
});

/** Parsea el contenido de un EnvioDTE y devuelve sus documentos. */
export function parseDte(xml: string): ParsedDte[] {
  const root = parser.parse(xml) as Record<string, unknown>;
  const envio = (root.EnvioDTE ?? root) as Record<string, unknown>;
  const setDte = (envio.SetDTE ?? {}) as Record<string, unknown>;
  const dtes = (setDte.DTE ?? []) as Record<string, unknown>[];

  const out: ParsedDte[] = [];
  for (const dte of dtes) {
    const doc = (dte.Documento ?? {}) as Record<string, unknown>;
    const enc = (doc.Encabezado ?? {}) as Record<string, unknown>;
    const idDoc = (enc.IdDoc ?? {}) as Record<string, unknown>;
    const recep = (enc.Receptor ?? {}) as Record<string, unknown>;
    const tot = (enc.Totales ?? {}) as Record<string, unknown>;

    const folio = str(idDoc.Folio);
    if (!folio) continue;

    const detalles = (doc.Detalle ?? []) as Record<string, unknown>[];
    const lines: DteLine[] = detalles.map((d, i) => ({
      nroLin: num(d.NroLinDet) || i + 1,
      nombre: str(d.NmbItem) ?? "",
      descripcion: str(d.DscItem),
      cantidad: num(d.QtyItem) || 1,
      unidad: str(d.UnmdItem),
      precio: d.PrcItem != null ? num(d.PrcItem) : null,
      monto: num(d.MontoItem),
    }));

    out.push({
      folio,
      tipoDte: str(idDoc.TipoDTE) ?? "",
      fchEmis: str(idDoc.FchEmis),
      rutReceptor: str(recep.RUTRecep),
      rznSocReceptor: str(recep.RznSocRecep),
      mntNeto: num(tot.MntNeto),
      mntExento: num(tot.MntExe),
      iva: num(tot.IVA),
      mntTotal: num(tot.MntTotal),
      lines,
    });
  }
  return out;
}
