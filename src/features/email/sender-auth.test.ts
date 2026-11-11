import assert from "node:assert/strict";
import test from "node:test";
import {
  domainsAligned,
  evaluateSenderAuth,
  parseAuthenticationResults,
} from "./sender-auth";

const opts = { studioDomain: "studionomade.cl" };
const ar = (value: string) => ({ "authentication-results": [value] });

test("parsea Authentication-Results de Gmail con comentarios", () => {
  const parsed = parseAuthenticationResults(
    "mx.google.com;\r\n       dkim=pass header.i=@cliente.cl header.s=s1 header.b=abc;\r\n       spf=pass (google.com: domain of a@cliente.cl designates 1.2.3.4 as permitted sender) smtp.mailfrom=a@cliente.cl;\r\n       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=cliente.cl",
  );
  assert.equal(parsed.authservId, "mx.google.com");
  assert.deepEqual(
    parsed.results.map((r) => `${r.method}=${r.result}`),
    ["dkim=pass", "spf=pass", "dmarc=pass"],
  );
  assert.equal(parsed.results[2].props["header.from"], "cliente.cl");
});

test("acepta dmarc, dkim o spf alineados con el From", () => {
  assert.equal(
    evaluateSenderAuth(
      ar("mx.google.com; dmarc=pass (p=NONE) header.from=cliente.cl"),
      "ana@cliente.cl",
      opts,
    ).verified,
    true,
  );
  assert.equal(
    evaluateSenderAuth(
      ar("mx.google.com; dkim=pass header.i=@mail.cliente.cl; dmarc=none"),
      "ana@cliente.cl",
      opts,
    ).verified,
    true,
  );
  assert.equal(
    evaluateSenderAuth(
      ar("mx.google.com; spf=pass smtp.mailfrom=bounce@cliente.cl"),
      "ana@cliente.cl",
      opts,
    ).verified,
    true,
  );
});

test("rechaza From falsificado aunque el correo autentique su propio dominio", () => {
  const result = evaluateSenderAuth(
    ar(
      "mx.google.com; dkim=pass header.i=@evil.com; spf=pass smtp.mailfrom=x@evil.com; dmarc=none header.from=cliente.cl",
    ),
    "jefe@cliente.cl",
    opts,
  );
  assert.equal(result.verified, false);
});

test("solo cuenta el primer encabezado y debe ser de mx.google.com", () => {
  // El remitente puede escribir su propio Authentication-Results más abajo.
  assert.equal(
    evaluateSenderAuth(
      {
        "authentication-results": [
          "mx.google.com; dmarc=fail header.from=cliente.cl",
          "mx.google.com; dmarc=pass header.from=cliente.cl",
        ],
      },
      "jefe@cliente.cl",
      opts,
    ).verified,
    false,
  );
  assert.equal(
    evaluateSenderAuth(
      ar("evil.example; dmarc=pass header.from=cliente.cl"),
      "jefe@cliente.cl",
      opts,
    ).verified,
    false,
  );
});

test("sin encabezado solo vale el dominio del estudio (interno)", () => {
  assert.equal(
    evaluateSenderAuth({}, "seba@studionomade.cl", opts).verified,
    true,
  );
  assert.equal(evaluateSenderAuth({}, "ana@cliente.cl", opts).verified, false);
  assert.equal(
    evaluateSenderAuth({}, "ana@cliente.cl", { ...opts, mode: "off" }).verified,
    true,
  );
});

test("alineación relajada de dominios", () => {
  assert.equal(domainsAligned("cliente.cl", "mkt.cliente.cl"), true);
  assert.equal(domainsAligned("cliente.cl", "otrocliente.cl"), false);
  assert.equal(domainsAligned("cl", "cliente.cl"), false);
});

// Remitente en Microsoft 365 sin SPF publicado ni DKIM propio: Gmail solo ve
// la cadena ARC que selló Microsoft (caso real, dominios anonimizados).
const m365Direct = (overrides: Record<string, string[]> = {}) => ({
  "authentication-results": [
    "mx.google.com;\r\n       arc=pass (i=1 spf=pass spfdomain=agencia.com dkim=pass dkdomain=agencia.com dmarc=pass fromdomain=agencia.com);\r\n       spf=none (google.com: ana@agencia.com does not designate permitted sender hosts) smtp.mailfrom=ana@agencia.com",
    "mx.microsoft.com 1; dkim=none (message not signed) header.d=none;dmarc=none action=none header.from=agencia.com;",
  ],
  "arc-seal": [
    "i=2; a=rsa-sha256; t=1794407821; cv=pass; d=google.com; s=arc-20260327; b=AAA",
    "i=1; a=rsa-sha256; s=arcselector10001; d=microsoft.com; cv=none; b=BBB",
  ],
  "arc-authentication-results": [
    "i=2; mx.google.com; arc=pass (i=1 spf=pass); spf=none smtp.mailfrom=ana@agencia.com",
    "i=1; mx.microsoft.com 1; spf=pass smtp.mailfrom=agencia.com;\r\n dmarc=pass action=none header.from=agencia.com; dkim=pass header.d=agencia.com; arc=none",
  ],
  ...overrides,
});

test("ARC: acepta Microsoft 365 sin SPF/DKIM propio si la cadena es confiable", () => {
  const result = evaluateSenderAuth(m365Direct(), "ana@agencia.com", opts);
  assert.equal(result.verified, true);
  assert.match(
    result.reason,
    /^arc=pass: spf=pass alineado según microsoft\.com$/,
  );
});

test("ARC: acepta el correo redirigido por una regla del Workspace (i=1..4)", () => {
  const headers = m365Direct({
    "authentication-results": [
      "mx.google.com; arc=pass (i=3); spf=none (google.com: ana@agencia.com does not designate permitted sender hosts) smtp.mailfrom=ana@agencia.com; dara=fail header.i=@studionomade.cl",
    ],
    "arc-seal": [
      "i=4; a=rsa-sha256; cv=pass; d=google.com; s=arc-20260327; b=D",
      "i=3; a=rsa-sha256; cv=pass; d=google.com; s=arc-20260327; b=C",
      "i=2; a=rsa-sha256; cv=pass; d=google.com; s=arc-20260327; b=B",
      "i=1; a=rsa-sha256; s=arcselector10001; d=microsoft.com; cv=none; b=A",
    ],
  });
  assert.equal(
    evaluateSenderAuth(headers, "ana@agencia.com", opts).verified,
    true,
  );
});

test("ARC: rechaza si Gmail no validó la cadena", () => {
  const headers = m365Direct({
    "authentication-results": [
      "mx.google.com; arc=fail (signature failed); spf=none smtp.mailfrom=ana@agencia.com",
    ],
  });
  const result = evaluateSenderAuth(headers, "ana@agencia.com", opts);
  assert.equal(result.verified, false);
  assert.match(result.reason, /ARC: arc=fail/);
});

test("ARC: rechaza un sellador que no es de confianza en cualquier punto de la cadena", () => {
  const forgedFirst = m365Direct({
    "arc-seal": [
      "i=2; a=rsa-sha256; cv=pass; d=google.com; s=x; b=B",
      "i=1; a=rsa-sha256; cv=none; d=evil.example; s=x; b=A",
    ],
  });
  assert.equal(
    evaluateSenderAuth(forgedFirst, "ana@agencia.com", opts).verified,
    false,
  );

  // Un i=1 legítimo reciclado bajo un sello propio tampoco vale.
  const replayed = m365Direct({
    "arc-seal": [
      "i=3; a=rsa-sha256; cv=pass; d=google.com; s=x; b=C",
      "i=2; a=rsa-sha256; cv=pass; d=evil.example; s=x; b=B",
      "i=1; a=rsa-sha256; cv=none; d=microsoft.com; s=x; b=A",
    ],
  });
  const result = evaluateSenderAuth(replayed, "ana@agencia.com", opts);
  assert.equal(result.verified, false);
  assert.match(result.reason, /i=2 no confiable \(evil\.example\)/);
});

test("ARC: rechaza cadena incompleta, duplicada o sin resultados i=1", () => {
  const gap = m365Direct({
    "arc-seal": [
      "i=3; a=rsa-sha256; cv=pass; d=google.com; s=x; b=C",
      "i=1; a=rsa-sha256; cv=none; d=microsoft.com; s=x; b=A",
    ],
  });
  assert.equal(
    evaluateSenderAuth(gap, "ana@agencia.com", opts).verified,
    false,
  );

  const duplicated = m365Direct({
    "arc-seal": [
      "i=1; a=rsa-sha256; cv=none; d=microsoft.com; s=x; b=A",
      "i=1; a=rsa-sha256; cv=none; d=google.com; s=x; b=A",
    ],
  });
  assert.equal(
    evaluateSenderAuth(duplicated, "ana@agencia.com", opts).verified,
    false,
  );

  const noResults = m365Direct({ "arc-authentication-results": [] });
  assert.equal(
    evaluateSenderAuth(noResults, "ana@agencia.com", opts).verified,
    false,
  );
});

test("ARC: el i=1 debe autenticar el dominio del From", () => {
  // Cadena válida de otra organización: no sirve para suplantar al cliente.
  const result = evaluateSenderAuth(m365Direct(), "jefe@cliente.cl", opts);
  assert.equal(result.verified, false);
  assert.match(result.reason, /i=1 sin autenticación alineada/);

  const failing = m365Direct({
    "arc-authentication-results": [
      "i=1; mx.microsoft.com 1; spf=fail smtp.mailfrom=agencia.com; dmarc=fail header.from=agencia.com; dkim=none",
    ],
  });
  assert.equal(
    evaluateSenderAuth(failing, "ana@agencia.com", opts).verified,
    false,
  );
});

test("ARC: los selladores se configuran y vacío desactiva el respaldo", () => {
  assert.equal(
    evaluateSenderAuth(m365Direct(), "ana@agencia.com", {
      ...opts,
      trustedArcSealers: "",
    }).verified,
    false,
  );
  assert.equal(
    evaluateSenderAuth(m365Direct(), "ana@agencia.com", {
      ...opts,
      trustedArcSealers: "google.com",
    }).verified,
    false,
  );
  assert.equal(
    evaluateSenderAuth(m365Direct(), "ana@agencia.com", {
      ...opts,
      trustedArcSealers: "Google.com, Microsoft.com",
    }).verified,
    true,
  );
});
