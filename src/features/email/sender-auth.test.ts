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
