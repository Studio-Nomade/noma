import assert from "node:assert/strict";
import test from "node:test";
import {
  extractEmailRequest,
  sanitizeTitle,
  type EmailExtraction,
  type EmailExtractionInput,
  type StructuredGenerator,
} from "./extract";

const INPUT: EmailExtractionInput = {
  subject: "RE: Fwd: [EXTERNAL] Banner campaña Cyber para home",
  fromName: "Ana Pérez",
  fromEmail: "ana@cliente.cl",
  date: new Date("2026-10-17T13:00:00Z"), // sábado 17, 10:00 Santiago
  body: "Hola equipo,\n\nNecesitamos un banner 1200x400 para el lunes AM.\nRef: https://cliente.cl/cyber\n\nSaludos",
  attachmentNames: ["brief.pdf"],
  clientName: "Cliente A",
};

test("sanea títulos: prefijos, etiquetas, folios y largo", () => {
  assert.equal(
    sanitizeTitle("RE: Fwd: [EXTERNAL] banner cyber [EQ-0142]."),
    "Banner cyber",
  );
  assert.equal(sanitizeTitle('"Mailing octubre"'), "Mailing octubre");
  assert.equal(sanitizeTitle("", "RV: Post Instagram"), "Post Instagram");
  assert.equal(sanitizeTitle("   ", null), "Solicitud sin título");
  const long = sanitizeTitle(
    "Diseño de una serie de piezas gráficas para la campaña de fin de año con adaptaciones para redes sociales y mailing",
  );
  assert.ok(long.length <= 90, long);
  assert.ok(long.endsWith("…"));
  assert.ok(!long.includes("  "));
});

test("usa la salida del modelo y la normaliza", async () => {
  const calls: string[] = [];
  const generate: StructuredGenerator = async <T>(input: {
    input: string;
    schemaName: string;
  }) => {
    calls.push(input.schemaName);
    assert.match(input.input, /sábado 17 de octubre de 2026/);
    assert.match(input.input, /Adjuntos: brief\.pdf/);
    const output: EmailExtraction = {
      title: "Fwd: banner Cyber para home",
      summary: "Banner para home de la campaña Cyber.",
      details: ["1200x400", " "],
      requested_due_date: "lunes", // el modelo devolvió texto relativo
      priority: "alta",
      deliverable_type: "Banner web",
      links: ["https://cliente.cl/cyber."],
    };
    return output as T;
  };
  const result = await extractEmailRequest(INPUT, generate);
  assert.equal(result.source, "llm");
  assert.deepEqual(calls, ["email_request_extraction"]);
  assert.deepEqual(result.extraction, {
    title: "Banner Cyber para home",
    summary: "Banner para home de la campaña Cyber.",
    details: ["1200x400"],
    requested_due_date: "2026-10-19",
    priority: "alta",
    deliverable_type: "Banner web",
    links: ["https://cliente.cl/cyber"],
  });
});

test("descarta fechas del modelo en el pasado", async () => {
  const generate: StructuredGenerator = async <T>() =>
    ({
      title: "Banner",
      summary: "x",
      details: [],
      requested_due_date: "2025-01-01",
      priority: "media",
      deliverable_type: null,
      links: [],
    }) as T;
  const result = await extractEmailRequest(INPUT, generate);
  assert.equal(result.extraction.requested_due_date, null);
});

test("si el modelo falla, usa la extracción heurística", async () => {
  const result = await extractEmailRequest(INPUT, async () => {
    throw new Error("timeout");
  });
  assert.equal(result.source, "fallback");
  assert.equal(result.error, "timeout");
  assert.equal(result.extraction.title, "Banner campaña Cyber para home");
  assert.equal(result.extraction.summary, "Hola equipo,");
  assert.equal(result.extraction.requested_due_date, "2026-10-19");
  assert.deepEqual(result.extraction.links, ["https://cliente.cl/cyber"]);
  assert.equal(result.extraction.priority, "media");
});

test("sin IA configurada también usa la heurística", async () => {
  const result = await extractEmailRequest(
    { ...INPUT, body: "URGENTE: subir el banner hoy" },
    null,
  );
  assert.equal(result.source, "fallback");
  assert.equal(result.extraction.priority, "urgente");
  assert.equal(result.extraction.requested_due_date, "2026-10-17");
});
