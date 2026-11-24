import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  creditNoteTargets,
  docFromNuboxRow,
  dmyToIso,
  factoringFromFolder,
  pickAutoMatches,
  type RegDoc,
} from "./regularize";

const row = (over: Record<string, string>) => ({
  Fecha: "05/10/2026",
  Documento: "FAC-EL",
  Folio: "486",
  "Rut Cliente": "86853800-7",
  Cliente: "INSTALACIONES HIDRAULICAS HIDROCINCO LIMITADA",
  "Monto neto": "3016125",
  "Monto exento": "0",
  "Monto IVA": "573064",
  "Monto total": "3589189",
  Estado: "Emitido",
  "Fecha vencimiento": "16/10/2026",
  "Estado de cobro": "EXPIRED",
  Cedido: "false",
  ...over,
});

test("lee una fila del consolidado de Nubox", () => {
  const d = docFromNuboxRow(row({}), "csv")!;
  assert.equal(d.type, "FACTURA_VENTA");
  assert.equal(d.fechaEmision, "2026-10-05");
  assert.equal(d.fechaVencimiento, "2026-10-16");
  assert.equal(d.total, 3589189);
  assert.equal(d.cedido, false);
  assert.equal(docFromNuboxRow(row({ Estado: "Borrador" }), "csv"), null);
  assert.equal(docFromNuboxRow(row({ Documento: "BOL-VO" }), "csv"), null);
  assert.equal(
    docFromNuboxRow(
      row({ "Estado de cobro": "BALANCED", Cedido: "true" }),
      "csv",
    )?.nuboxSaldada,
    true,
  );
  assert.equal(dmyToIso("1/9/2026"), "2026-09-01");
});

test("lee la carpeta de una cesión a factoring", () => {
  assert.deepEqual(
    factoringFromFolder("20261023_Factoring DTE 487 - Financia Capital"),
    { folio: "487", fecha: "2026-10-23", entidad: "Financia Capital" },
  );
  assert.equal(factoringFromFolder("Contratos"), null);
});

function doc(over: Partial<RegDoc>): RegDoc {
  return {
    type: "FACTURA_VENTA",
    folio: "1",
    rut: "1-9",
    nombre: "X",
    fechaEmision: "2026-10-01",
    fechaVencimiento: null,
    neto: 0,
    exento: 0,
    iva: 0,
    total: 100,
    cedido: false,
    nuboxSaldada: false,
    source: "t",
    ...over,
  };
}

test("una nota de crédito anula la factura del mismo cliente y monto", () => {
  const map = creditNoteTargets([
    doc({ folio: "480", total: 12985244 }),
    doc({ folio: "481", total: 500 }),
    doc({
      type: "NOTA_CREDITO",
      folio: "20",
      total: 12985244,
      fechaEmision: "2026-10-16",
    }),
  ]);
  assert.equal(map.get("20"), "480");
});

test("concilia solo coincidencias únicas y deja los empates", () => {
  const docs = [
    {
      id: "a",
      folio: "1",
      fechaEmision: "2026-10-01",
      saldo: 833000,
      rut: "86853800-7",
      nombre: "Hidrocinco",
    },
    {
      id: "b",
      folio: "2",
      fechaEmision: "2026-10-01",
      saldo: 1190000,
      rut: "1-9",
      nombre: "Muñoz Pattillo",
    },
    {
      id: "c",
      folio: "3",
      fechaEmision: "2026-10-01",
      saldo: 1190000,
      rut: "2-7",
      nombre: "Otro",
    },
    {
      id: "d",
      folio: "4",
      fechaEmision: "2026-10-05",
      saldo: 3589189,
      rut: "86853800-7",
      nombre: "Hidrocinco",
    },
  ];
  const matches = pickAutoMatches(
    [
      {
        id: "t1",
        fecha: "2026-10-10",
        glosa: "Transf de HIDROCINCO",
        monto: 833000,
      },
      { id: "t2", fecha: "2026-10-10", glosa: "Transferencia", monto: 1190000 },
      {
        id: "t3",
        fecha: "2026-10-12",
        glosa: "Abono FINANCIA CAPITAL",
        monto: 3589189,
      },
    ],
    docs,
  );
  assert.deepEqual(
    matches.map((m) => [m.txnId, m.docIds]),
    [["t1", ["a"]]],
  );
});

test("un pago puede cubrir dos facturas del mismo cliente", () => {
  const matches = pickAutoMatches(
    [
      {
        id: "t",
        fecha: "2026-10-20",
        glosa: "Transf HIDROCINCO",
        monto: 4422189,
      },
    ],
    [
      {
        id: "a",
        folio: "1",
        fechaEmision: "2026-10-01",
        saldo: 833000,
        rut: "86853800-7",
        nombre: "Hidrocinco",
      },
      {
        id: "d",
        folio: "4",
        fechaEmision: "2026-10-05",
        saldo: 3589189,
        rut: "86853800-7",
        nombre: "Hidrocinco",
      },
    ],
  );
  assert.deepEqual(matches[0]?.docIds.sort(), ["a", "d"]);
});
