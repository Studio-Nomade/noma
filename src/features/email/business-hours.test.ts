import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BUSINESS_HOURS,
  deferredSendAt,
  formatBusinessSlot,
  isWithinBusinessHours,
  nextBusinessSend,
  parseHolidays,
  wantsImmediateSend,
} from "./business-hours";

// Noviembre: Chile en horario de verano (UTC-3).
const at = (iso: string) => new Date(iso);

test("dentro del horario hábil sale de inmediato", () => {
  // Miércoles 11-11 10:00 local
  assert.equal(deferredSendAt(at("2026-11-11T13:00:00Z")), null);
  // 08:55 en punto y 17:59
  assert.equal(deferredSendAt(at("2026-11-11T11:55:00Z")), null);
  assert.equal(deferredSendAt(at("2026-11-11T20:59:00Z")), null);
});

test("de noche queda para las 08:55 del día siguiente", () => {
  // Jueves 12-11 22:00 local → viernes 13-11 08:55 local (11:55Z)
  assert.equal(
    deferredSendAt(at("2026-11-13T01:00:00Z"))?.toISOString(),
    "2026-11-13T11:55:00.000Z",
  );
  // 18:00 en punto ya es fuera de horario
  assert.equal(
    deferredSendAt(at("2026-11-11T21:00:00Z"))?.toISOString(),
    "2026-11-12T11:55:00.000Z",
  );
});

test("de madrugada sale el mismo día a las 08:55", () => {
  // Lunes 16-11 07:00 local
  assert.equal(
    deferredSendAt(at("2026-11-16T10:00:00Z"))?.toISOString(),
    "2026-11-16T11:55:00.000Z",
  );
});

test("viernes de noche y fin de semana → lunes 08:55", () => {
  const monday = "2026-11-16T11:55:00.000Z";
  assert.equal(
    deferredSendAt(at("2026-11-13T22:00:00Z"))?.toISOString(),
    monday,
  ); // vie 19:00
  assert.equal(
    deferredSendAt(at("2026-11-14T15:00:00Z"))?.toISOString(),
    monday,
  ); // sáb
  assert.equal(
    deferredSendAt(at("2026-11-15T23:30:00Z"))?.toISOString(),
    monday,
  ); // dom
});

test("salta feriados configurados", () => {
  const hours = {
    ...DEFAULT_BUSINESS_HOURS,
    holidays: parseHolidays("2026-12-25, nada, 2026-12-08"),
  };
  assert.equal(hours.holidays.size, 2);
  // Jueves 24-12 20:00 local → (25 feriado) → lunes 28-12
  assert.equal(
    nextBusinessSend(at("2026-12-24T23:00:00Z"), hours).toISOString(),
    "2026-12-28T11:55:00.000Z",
  );
  assert.equal(isWithinBusinessHours(at("2026-12-25T14:00:00Z"), hours), false);
});

test("en invierno (UTC-4) las 08:55 se calculan con su desfase", () => {
  // Miércoles 10-06 20:00 local (00:00Z del 11) → jueves 11-06 08:55 local
  assert.equal(
    deferredSendAt(at("2026-06-11T00:00:00Z"))?.toISOString(),
    "2026-06-11T12:55:00.000Z",
  );
});

test("«ENVIAR AHORA» salta el horario y el aviso se lee en español", () => {
  assert.equal(
    wantsImmediateSend("ENTREGA 01 ENVIAR AHORA\nPieza: https://x"),
    true,
  );
  assert.equal(wantsImmediateSend("Entrega 01\nhttps://x"), false);
  assert.equal(
    formatBusinessSlot(at("2026-11-13T11:55:00Z")),
    "el viernes 13-11 a las 08:55",
  );
});

test("«ENVIAR AHORA» no llega al cliente como nota", async () => {
  const { parseDeliveryCommand } = await import("./delivery-command");
  const parsed = parseDeliveryCommand(
    "ENTREGA 01 ENVIAR AHORA\nPieza: https://canva.link/abc\nVa con la versión final",
    null,
  );
  assert.equal(parsed?.note, "Va con la versión final");
  assert.equal(
    parseDeliveryCommand(
      "ENTREGA 01\nENVIAR AHORA\nPieza: https://canva.link/abc",
      null,
    )?.note,
    null,
  );
});
