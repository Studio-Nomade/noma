import assert from "node:assert/strict";
import test from "node:test";
import { resolveEmailStudioAi } from "./ai-config";
import { compileEmailDocument } from "./compiler.server";
import {
  buildAnthropicPlanRequest,
  EMAIL_PLAN_TOOL,
  EmailStudioProviderError,
  parseAnthropicPlanResponse,
} from "./generation-request";
import {
  compactDate,
  mailingAssetUrl,
  mailingFilename,
  mailingFolder,
  mailingSlug,
  nextVersionFilename,
  parseLocalMailingFolder,
  validateMailingAsset,
} from "./mailing-assets";
import { buildMailingFromBrief, toEmblueHtml } from "./mailing-brief";

// ── Proveedor (ADR-008) ────────────────────────────────────────────────

test("por defecto el proveedor es Claude y requiere ANTHROPIC_API_KEY", () => {
  const off = resolveEmailStudioAi({});
  assert.equal(off.provider, "anthropic");
  assert.equal(off.model, "claude-opus-5-5");
  assert.equal(off.configured, false);
  assert.match(off.reason ?? "", /ANTHROPIC_API_KEY/);

  const on = resolveEmailStudioAi({
    ANTHROPIC_API_KEY: "k",
    EMAIL_STUDIO_ANTHROPIC_MODEL: "claude-x",
  });
  assert.deepEqual(
    [on.provider, on.model, on.configured],
    ["anthropic", "claude-x", true],
  );
});

test("openai se elige explícitamente y no cae a Claude sin key", () => {
  const openai = resolveEmailStudioAi({
    EMAIL_STUDIO_AI_PROVIDER: "OpenAI",
    ANTHROPIC_API_KEY: "k",
  });
  assert.equal(openai.provider, "openai");
  assert.equal(openai.configured, false);
  assert.equal(openai.model, "gpt-5.6");
  assert.equal(
    resolveEmailStudioAi({
      EMAIL_STUDIO_AI_PROVIDER: "openai",
      OPENAI_API_KEY: "k",
    }).configured,
    true,
  );
});

test("un proveedor inválido no queda configurado", () => {
  const bad = resolveEmailStudioAi({
    EMAIL_STUDIO_AI_PROVIDER: "gemini",
    ANTHROPIC_API_KEY: "k",
  });
  assert.equal(bad.configured, false);
  assert.match(bad.reason ?? "", /gemini/);
});

test("la llamada a Claude fuerza la herramienta del plan e incluye la referencia", () => {
  const request = buildAnthropicPlanRequest(
    {
      projectName: "Prueba",
      reference: {
        url: "https://x.test/ref.pdf",
        mimeType: "application/pdf",
        filename: "ref.pdf",
      },
      assets: Array.from({ length: 14 }, (_, i) => ({
        id: `a${i}`,
        label: `Asset ${i}`,
        url: `https://x.test/a${i}.png`,
      })),
    },
    "claude-opus-5-5",
  );
  assert.equal(request.tool_choice.name, EMAIL_PLAN_TOOL);
  assert.equal(request.tools[0].input_schema.type, "object");
  assert.equal("$schema" in request.tools[0].input_schema, false);
  const content = request.messages[0].content;
  assert.equal(content[1].type, "document");
  // 1 texto + 1 referencia + 12 assets × (texto + imagen)
  assert.equal(content.length, 2 + 12 * 2);
});

test("se lee el plan desde el tool_use de la respuesta", () => {
  const plan = {
    subject: "Asunto",
    previewText: "Pre",
    variables: [],
    elements: [
      {
        type: "text",
        label: "Saludo",
        assetId: null,
        content: "Hola",
        href: null,
        alt: null,
        align: "center",
        fontSize: 16,
        color: "#111111",
        backgroundColor: "#ffffff",
        spacerHeight: null,
      },
    ],
  };
  const parsed = parseAnthropicPlanResponse({
    id: "msg_1",
    model: "claude-opus-5-5",
    content: [
      { type: "text", text: "..." },
      { type: "tool_use", name: EMAIL_PLAN_TOOL, input: plan, id: "t" },
    ],
    usage: { input_tokens: 10, output_tokens: 5 },
  });
  assert.equal(parsed.plan.subject, "Asunto");
  assert.equal(parsed.telemetry.totalTokens, 15);
  assert.throws(
    () =>
      parseAnthropicPlanResponse({
        id: "m",
        model: "c",
        content: [{ type: "text", text: "sin plan" }],
      }),
    /plan utilizable/,
  );
  assert.equal(new EmailStudioProviderError("x", 429).status, 429);
});

// ── Assets en assets.studionomade.cl ──────────────────────────────────

test("slug y fechas siguen la convención de carpetas", () => {
  assert.equal(
    mailingSlug("Capital Ya · Reconexión de Cuenta"),
    "capital-ya-reconexion-de-cuenta",
  );
  assert.equal(mailingSlug("Cumbre Anual Viña"), "cumbre-anual-vina");
  assert.equal(compactDate("2026-10-21"), "20261021");
  assert.equal(compactDate("20261021"), "20261021");
  assert.throws(() => compactDate("2026-02-30"));
  assert.deepEqual(
    parseLocalMailingFolder("20260720_Capital Ya Reconexión de Cuenta"),
    {
      date: "20260720",
      slug: "capital-ya-reconexion-de-cuenta",
    },
  );
});

test("la carpeta del envío es mailings/<cliente>/<AAAAMMDD_evento>/<NN_AAAAMMDD_envio>", () => {
  const folder = mailingFolder({
    client: "Studio Nomade",
    event: { name: "Prueba assets", date: "2026-10-21" },
    send: { number: 1, date: "2026-10-21", name: "Prueba" },
  });
  assert.equal(
    folder,
    "mailings/studio-nomade/20261021_prueba-assets/01_20261021_prueba",
  );
  assert.equal(
    mailingAssetUrl(folder, "isotipo-blanco.png"),
    "https://assets.studionomade.cl/mailings/studio-nomade/20261021_prueba-assets/01_20261021_prueba/isotipo-blanco.png",
  );
  assert.throws(() => mailingAssetUrl(folder, "a.png", "http://inseguro.test"));
});

test("nunca se sobrescribe: se sube la siguiente versión", () => {
  assert.equal(mailingFilename("Hero Principal.JPEG"), "hero-principal.jpg");
  assert.equal(nextVersionFilename("hero.png", []), "hero.png");
  assert.equal(nextVersionFilename("hero.png", ["hero.png"]), "hero-v2.png");
  assert.equal(
    nextVersionFilename("hero.png", ["hero.png", "hero-v2.png"]),
    "hero-v3.png",
  );
});

test("reglas de publicación de assets", () => {
  assert.deepEqual(
    validateMailingAsset({ filename: "a.png", bytes: 1000, width: 1200 }),
    [],
  );
  assert.equal(validateMailingAsset({ filename: "a.webp" }).length, 1);
  assert.equal(
    validateMailingAsset({ filename: "a.png", bytes: 300 * 1024 }).length,
    1,
  );
  assert.equal(
    validateMailingAsset({ filename: "a.jpg", width: 1600 }).length,
    1,
  );
  assert.deepEqual(
    validateMailingAsset({ filename: "invitacion.ics", bytes: 10_000_000 }),
    [],
  );
});

// ── Generador por brief ───────────────────────────────────────────────

const brief = {
  client: "Cliente Demo",
  event: { name: "Cumbre Anual Viña", date: "2026-11-05" },
  send: { number: 3, date: "2026-11-04", name: "Es mañana" },
  subject: "Mañana nos vemos en la Cumbre",
  preheader: "Te esperamos en Viña del Mar, {{nombre}}",
  variables: [
    { key: "nombre", label: "Nombre", sample: "Ana" },
    {
      key: "link_registro",
      label: "Registro",
      sample: "https://x.test",
      emblueField: "LINK",
    },
  ],
  blocks: [
    {
      type: "image",
      file: "piezas/Hero Cumbre.png",
      alt: "Cumbre 2026",
      href: "{{link_registro}}",
    },
    { type: "text", content: "Hola {{nombre}}, te esperamos." },
    {
      type: "button",
      label: "Ver agenda",
      href: "https://cliente.example/agenda",
    },
    { type: "spacer", height: 24 },
    { type: "image", file: "piezas/Hero Cumbre.png", alt: "Repetida" },
  ],
} as const;

test("el brief arma el documento con las URLs finales de cada pieza", async () => {
  const mailing = buildMailingFromBrief(structuredClone(brief) as never);
  assert.equal(
    mailing.folder,
    "mailings/cliente-demo/20261105_cumbre-anual-vina/03_20261104_es-manana",
  );
  assert.equal(mailing.assets.length, 1);
  assert.equal(mailing.assets[0].filename, "hero-cumbre.png");

  const compiled = await compileEmailDocument(mailing.document, {
    assetBaseUrl: mailing.brief.assetsBaseUrl,
  });
  assert.match(
    compiled.html,
    /https:\/\/assets\.studionomade\.cl\/mailings\/cliente-demo\/20261105_cumbre-anual-vina\/03_20261104_es-manana\/hero-cumbre\.png/,
  );
  assert.match(compiled.html, /Ver agenda/);
  assert.match(compiled.html, /\{\{nombre\}\}/);

  const emblue = toEmblueHtml(compiled.html, { link_registro: "LINK" });
  assert.match(emblue, /\$\{\{NOMBRE\}\}/);
  assert.match(emblue, /\$\{\{LINK\}\}/);
  assert.doesNotMatch(emblue, /\{\{nombre\}\}/);
});

test("el brief exige alt y enlaces seguros", () => {
  assert.throws(() =>
    buildMailingFromBrief({
      ...structuredClone(brief),
      blocks: [{ type: "image", file: "a.png", alt: "" }],
    } as never),
  );
  assert.throws(() =>
    buildMailingFromBrief({
      ...structuredClone(brief),
      blocks: [{ type: "button", label: "x", href: "http://inseguro.test" }],
    } as never),
  );
});

test("avisa cuando el asunto o el preheader son largos", () => {
  const mailing = buildMailingFromBrief({
    ...structuredClone(brief),
    subject: "a".repeat(120),
    preheader: "",
  } as never);
  assert.equal(mailing.warnings.length, 2);
});
