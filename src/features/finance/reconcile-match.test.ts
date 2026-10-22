import assert from "node:assert/strict";
import test from "node:test";
import { isFactoringGlosa, scoreMatch } from "./reconcile-match";

const doc = {
  fechaEmision: "2026-09-01",
  saldo: 1190000,
  contactRut: "76.000.000-1",
  contactName: "Cliente Demo SpA",
};

test("monto exacto y fecha cercana proponen la conciliación", () => {
  assert.ok(
    scoreMatch(
      {
        fecha: "2026-09-08",
        glosa: "TRANSFER DE OTRA EMPRESA",
        monto: 1190000,
        tipo: "ABONO",
      },
      doc,
    ) >= 70,
  );
});

test("el nombre del contacto en la glosa sube el puntaje", () => {
  const a = scoreMatch(
    {
      fecha: "2026-09-08",
      glosa: "TRANSFER DE OTRA",
      monto: 1190000,
      tipo: "ABONO",
    },
    doc,
  );
  const b = scoreMatch(
    {
      fecha: "2026-09-08",
      glosa: "TRANSFER DE CLIENTE DEMO",
      monto: 1190000,
      tipo: "ABONO",
    },
    doc,
  );
  assert.ok(b > a);
});

test("monto distinto o fuera de la ventana no se propone", () => {
  assert.equal(
    scoreMatch(
      { fecha: "2026-09-08", glosa: "x", monto: 1000, tipo: "ABONO" },
      doc,
    ),
    0,
  );
  assert.equal(
    scoreMatch(
      { fecha: "2027-03-01", glosa: "x", monto: 1190000, tipo: "ABONO" },
      doc,
    ),
    0,
  );
  assert.equal(
    scoreMatch(
      { fecha: "2026-08-01", glosa: "x", monto: 1190000, tipo: "ABONO" },
      doc,
    ),
    0,
  );
});

test("los abonos de factoring no se proponen contra facturas de clientes", () => {
  assert.equal(isFactoringGlosa("TRANSFER DE X CAPITAL SPA"), true);
  assert.equal(
    scoreMatch(
      {
        fecha: "2026-09-08",
        glosa: "ABONO FINANCIA CAPITAL",
        monto: 1190000,
        tipo: "ABONO",
      },
      doc,
    ),
    0,
  );
});
