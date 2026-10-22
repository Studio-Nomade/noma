import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { detectStatementLayout, tableFromMatrix } from "./bank-statement";
import { mapTransactions } from "./mappers";
import { parseFile } from "./parse";

// Cartola ficticia con la forma de la "CartolaHistorica" de BCI (datos inventados).
function fakeBciMatrix(): string[][] {
  const empty = () => Array(12).fill("");
  const m: string[][] = [];
  m.push(empty());
  m.push([" Cartola de cuenta corriente", ...Array(11).fill("")]);
  m.push([
    "Empresa",
    "",
    "",
    "",
    "EMPRESA DEMO SPA",
    "",
    "",
    "",
    "Ejecutivo",
    "",
    "X",
    "",
  ]);
  m.push([
    "N° de cuenta",
    "",
    "",
    "",
    "00000000",
    "",
    "",
    "",
    "Periodo",
    "",
    "01-09-2026 al 30-09-2026",
    "",
  ]);
  for (let i = 0; i < 18; i++) m.push(empty());
  m.push([
    "Fecha",
    "",
    "Sucursal",
    "",
    "",
    "Descripción",
    "",
    "N° Documento",
    "",
    "Cheques y otros cargos",
    "Depósitos y Abono",
    "Saldo diario",
  ]);
  m.push([
    "02/09/2026",
    "",
    "OF CENTRAL",
    "",
    "",
    "TRANSFER DE CLIENTE DEMO",
    "",
    "111",
    "",
    "",
    "1.190.000",
    "2.190.000",
  ]);
  m.push([
    "02/09/2026",
    "",
    "OF CENTRAL",
    "",
    "",
    "TRANSFER DE CLIENTE DEMO",
    "",
    "112",
    "",
    "",
    "1.190.000",
    "3.380.000",
  ]);
  m.push([
    "03/09/2026",
    "",
    "OF CENTRAL",
    "",
    "",
    "PAGO PROVEEDOR DEMO",
    "",
    "113",
    "",
    "250.000",
    "",
    "3.130.000",
  ]);
  m.push(empty());
  return m;
}

test("detecta la cartola BCI, su fila de encabezados y el período", () => {
  const layout = detectStatementLayout(fakeBciMatrix());
  assert.equal(layout.layout, "BCI_CARTOLA");
  assert.equal(layout.headerIndex, 22);
  assert.equal(layout.periodo, "01-09-2026 al 30-09-2026");
});

test("una tabla plana mantiene el encabezado en la primera fila", () => {
  const layout = detectStatementLayout([
    ["Fecha", "Glosa", "Monto"],
    ["01/01/2026", "x", "1"],
  ]);
  assert.equal(layout.layout, "TABLA");
  assert.equal(layout.headerIndex, 0);
});

test("mapea cargos, abonos y saldo de BCI con los alias por defecto", () => {
  const matrix = fakeBciMatrix();
  const { rows } = tableFromMatrix(
    matrix,
    detectStatementLayout(matrix).headerIndex,
  );
  const { valid, rejected } = mapTransactions(rows, {
    fecha: "Fecha",
    glosa: "Descripción",
    cargo: "Cargo",
    abono: "Abono",
    saldo: "Saldo",
  });
  assert.equal(rejected.length, 0);
  assert.equal(valid.length, 3);
  assert.deepEqual(
    valid.map((t) => [t.tipo, t.monto, t.saldo]),
    [
      ["ABONO", 1190000, 2190000],
      ["ABONO", 1190000, 3380000],
      ["CARGO", 250000, 3130000],
    ],
  );
  // Dos abonos iguales del mismo día no se marcan como duplicados: los
  // distingue el N° de documento.
  assert.equal(valid.filter((t) => t.isDuplicate).length, 0);
  assert.match(valid[0].glosa, /doc 111$/);
});

test("parseFile lee la hoja CartolaHistorica de un .xlsx", async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Otra").addRow(["nada"]);
  const ws = wb.addWorksheet("CartolaHistorica");
  for (const row of fakeBciMatrix()) ws.addRow(row);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const parsed = await parseFile(buffer, "Septiembre.xlsx");
  assert.equal(parsed.meta?.layout, "BCI_CARTOLA");
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.rows[2]["Cheques y otros cargos"], "250.000");
});

test("dos movimientos idénticos con distinto saldo diario no son duplicados", () => {
  const rows = [
    {
      Fecha: "05/09/2026",
      Descripción: "PAGO TARJETA",
      "N° Documento": "9",
      "Cheques y otros cargos": "100.000",
      "Depósitos y Abono": "",
      "Saldo diario": "900.000",
    },
    {
      Fecha: "05/09/2026",
      Descripción: "PAGO TARJETA",
      "N° Documento": "9",
      "Cheques y otros cargos": "100.000",
      "Depósitos y Abono": "",
      "Saldo diario": "800.000",
    },
    {
      Fecha: "05/09/2026",
      Descripción: "PAGO TARJETA",
      "N° Documento": "9",
      "Cheques y otros cargos": "100.000",
      "Depósitos y Abono": "",
      "Saldo diario": "800.000",
    },
  ];
  const { valid } = mapTransactions(rows, {});
  assert.deepEqual(
    valid.map((t) => Boolean(t.isDuplicate)),
    [false, false, true],
  );
});
