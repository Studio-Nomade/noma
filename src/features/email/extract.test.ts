import assert from "node:assert/strict";
import test from "node:test";
import {
  completeExtraction,
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
    const output: EmailExtraction = completeExtraction({
      title: "Fwd: banner Cyber para home",
      summary: "Banner para home de la campaña Cyber.",
      details: ["1200x400", " "],
      requested_due_date: "lunes", // el modelo devolvió texto relativo
      priority: "alta",
      deliverable_type: "Banner web",
      links: ["https://cliente.cl/cyber."],
      channels: ["Web", "Web"],
      structure: {
        title: "Piezas",
        items: [
          {
            title: " Banner home ",
            detail: null,
            links: [
              { label: "Ref", url: "https://cliente.cl/cyber", note: null },
              {
                label: "Tarea",
                url: "https://app.asana.com/0/1/2",
                note: null,
              },
            ],
          },
          { title: " ", detail: null, links: [] },
        ],
      },
      missing_info: ["a", "b", "c", "d"],
    });
    return output as T;
  };
  const result = await extractEmailRequest(INPUT, generate);
  assert.equal(result.source, "llm");
  assert.deepEqual(calls, ["email_request_extraction"]);
  assert.deepEqual(result.extraction, {
    is_request: true,
    not_request_reason: null,
    title: "Banner Cyber para home",
    summary: "Banner para home de la campaña Cyber.",
    details: ["1200x400"],
    requested_due_date: "2026-10-19",
    priority: "alta",
    deliverable_type: "Banner web",
    links: ["https://cliente.cl/cyber"],
    requester_first_name: "Ana",
    end_client: null,
    channels: ["Web"],
    format: null,
    structure: {
      title: "Piezas",
      items: [
        {
          title: "Banner home",
          detail: null,
          links: [
            { label: "Ref", url: "https://cliente.cl/cyber", note: null },
          ],
        },
      ],
    },
    considerations: [],
    materials: [],
    missing_info: ["a", "b", "c"],
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

test("distingue correos que no son solicitudes (felicitación, comentario)", async () => {
  const generate: StructuredGenerator = async <T>() =>
    completeExtraction({
      is_request: false,
      not_request_reason: "  Felicitación por la mejora del canal  ",
      title: "Comentario sobre el canal de solicitudes",
      summary: "Agradecen la mejora.",
    }) as T;
  const result = await extractEmailRequest(
    {
      ...INPUT,
      subject: "Re: Canal de Solicitudes - Mejora en el flujo de correos",
      body: "Hola!! Muy buena noticia, chicos. Muchas gracias!",
    },
    generate,
  );
  assert.equal(result.source, "llm");
  assert.equal(result.extraction.is_request, false);
  assert.equal(
    result.extraction.not_request_reason,
    "Felicitación por la mejora del canal",
  );
});

test("sin IA o con extracciones antiguas se asume solicitud", async () => {
  assert.equal(
    completeExtraction({ title: "x", summary: "y" }).is_request,
    true,
  );
  const result = await extractEmailRequest(INPUT, null);
  assert.equal(result.source, "fallback");
  assert.equal(result.extraction.is_request, true);
  assert.equal(result.extraction.not_request_reason, null);
});
