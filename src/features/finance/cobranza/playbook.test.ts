import assert from "node:assert/strict";
import test from "node:test";
import {
  COBRANZA_PLAYBOOK,
  formatInvoiceTable,
  playbookCodeFromName,
  totalPendiente,
  transferDetails,
} from "./playbook";
import { fillTemplate } from "./variables";

test("el playbook trae P1 a P8, sin datos bancarios reales", () => {
  assert.deepEqual(
    COBRANZA_PLAYBOOK.map((t) => t.code),
    ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"],
  );
  for (const t of COBRANZA_PLAYBOOK) {
    assert.doesNotMatch(
      t.body,
      /\d{6,}/,
      `${t.code} no debe tener números de cuenta`,
    );
    assert.doesNotMatch(t.body, /@/, `${t.code} no debe tener correos`);
  }
});

test("lee el código desde el nombre de la plantilla", () => {
  assert.equal(playbookCodeFromName("P3 · Seguimiento"), "P3");
  assert.equal(playbookCodeFromName("p7 estado"), "P7");
  assert.equal(playbookCodeFromName("Recordatorio de pago"), null);
});

test("tabla y total de facturas en texto plano", () => {
  const rows = [
    {
      folio: "101",
      fechaEmision: "2026-10-01",
      fechaVencimiento: "2026-10-31",
      total: 1190000,
      pendiente: 1190000,
    },
    {
      folio: "102",
      fechaEmision: "2026-10-02",
      total: 500000,
      pendiente: 250000,
    },
  ];
  const table = formatInvoiceTable(rows);
  assert.match(table, /Factura N° 101 · emitida 01-10-2026 · vence 31-10-2026/);
  assert.match(table, /vence —/);
  assert.equal(totalPendiente(rows), "$1.440.000");
});

test("los datos de transferencia salen del entorno", () => {
  assert.equal(transferDetails({}), "(datos de transferencia no configurados)");
  assert.equal(
    transferDetails({
      NOMA_COBRANZA_DATOS_TRANSFERENCIA: "Banco X\\nCuenta Y",
    }),
    "Banco X\nCuenta Y",
  );
});

test("P3 se completa con las variables del seguimiento", () => {
  const p3 = COBRANZA_PLAYBOOK.find((t) => t.code === "P3")!;
  const body = fillTemplate(p3.body, {
    contacto: "equipo",
    estudio: "Studio Nomade",
    tabla_facturas: "• Factura N° 1",
    total_pendiente: "$1",
    datos_transferencia: "Banco",
    remitente: "Finanzas",
  });
  assert.doesNotMatch(body, /\{\w+\}/);
});
