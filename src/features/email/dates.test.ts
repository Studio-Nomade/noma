import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSpanishDate,
  monthSectionName,
  normalizeDueDate,
  normalizeSectionName,
  parseRelativeDueDate,
} from "./dates";

test("nombre de sección mensual en español con mayúscula inicial", () => {
  const date = new Date("2026-10-17T15:00:00Z");
  assert.equal(monthSectionName("{Mes} | {YYYY}", date), "Octubre | 2026");
  assert.equal(monthSectionName("{MM}-{YY} {mes}", date), "10-26 octubre");
  assert.equal(monthSectionName("{MES} {YYYY}", date), "OCTUBRE 2026");
});

test("la sección usa la hora de Santiago, no UTC", () => {
  // 1 nov 02:00 UTC = 31 oct 23:00 en Santiago (UTC-3 en horario de verano).
  assert.equal(
    monthSectionName("{Mes} | {YYYY}", new Date("2026-11-01T02:00:00Z")),
    "Octubre | 2026",
  );
  assert.equal(
    monthSectionName("{Mes} | {YYYY}", new Date("2027-01-01T04:00:00Z")),
    "Enero | 2027",
  );
});

test("normaliza nombres de sección para comparar", () => {
  assert.equal(
    normalizeSectionName("  octubre|2026 "),
    normalizeSectionName("Octubre | 2026"),
  );
  assert.equal(normalizeSectionName("Septiembre"), "septiembre");
});

// Sábado 17 de octubre de 2026, 10:00 en Santiago.
const EMAIL_DATE = new Date("2026-10-17T13:00:00Z");

test("resuelve fechas relativas contra la fecha del correo", () => {
  const cases: [string, string | null][] = [
    ["lo necesito para el lunes AM", "2026-10-19"],
    ["lunes en la mañana", "2026-10-19"],
    ["para el viernes", "2026-10-23"],
    ["el sábado", "2026-10-24"], // hoy es sábado → el próximo
    ["mañana", "2026-10-18"],
    ["mañana en la mañana", "2026-10-18"],
    ["pasado mañana", "2026-10-19"],
    ["hoy", "2026-10-17"],
    ["el 20/10", "2026-10-20"],
    ["el 05/01", "2027-01-05"], // ya pasó este año → año siguiente
    ["30 de octubre", "2026-10-30"],
    ["15 de enero de 2027", "2027-01-15"],
    ["fin de mes", "2026-10-31"],
    ["la próxima semana", "2026-10-19"],
    ["llamar al +56 9-1234-5678", null],
    ["en la mañana", null],
    ["sin fecha", null],
    ["31/02", null],
  ];
  for (const [text, expected] of cases) {
    assert.equal(parseRelativeDueDate(text, EMAIL_DATE), expected, text);
  }
});

test("valida la fecha propuesta por la IA", () => {
  assert.equal(normalizeDueDate("2026-10-20", EMAIL_DATE), "2026-10-20");
  assert.equal(normalizeDueDate("2026-10-01", EMAIL_DATE), null); // pasada
  assert.equal(normalizeDueDate("2028-01-01", EMAIL_DATE), null); // > 1 año
  assert.equal(normalizeDueDate("2026-02-30", EMAIL_DATE), null);
  assert.equal(normalizeDueDate("lunes", EMAIL_DATE), "2026-10-19");
  assert.equal(normalizeDueDate(null, EMAIL_DATE), null);
});

test("formatea fechas en español", () => {
  assert.equal(formatSpanishDate("2026-10-19"), "lunes 19 de octubre de 2026");
  assert.equal(
    formatSpanishDate("2026-10-21"),
    "miércoles 21 de octubre de 2026",
  );
});
