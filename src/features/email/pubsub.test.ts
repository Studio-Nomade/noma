import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  decodePushBody,
  safeEqual,
  verifyGoogleOidcToken,
  type Jwk,
} from "./pubsub";

test("decodifica el push de Gmail", () => {
  const data = Buffer.from(
    JSON.stringify({
      emailAddress: "Casilla@StudioNomade.cl",
      historyId: 12345,
    }),
  ).toString("base64");
  assert.deepEqual(decodePushBody({ message: { data } }), {
    emailAddress: "casilla@studionomade.cl",
    historyId: "12345",
  });
  assert.equal(decodePushBody({}), null);
  assert.equal(decodePushBody({ message: { data: "no-json" } }), null);
  assert.equal(
    decodePushBody({
      message: {
        data: Buffer.from(JSON.stringify({ emailAddress: "x@y.cl" })).toString(
          "base64",
        ),
      },
    }),
    null,
  );
});

test("compara tokens en tiempo constante", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual("", ""), false);
  assert.equal(safeEqual(null, "abc"), false);
});

// JWT firmado con una llave local (sin red): simula el OIDC de Pub/Sub.
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = { ...(publicKey.export({ format: "jwk" }) as Jwk), kid: "k1" };
const fetchJwks = async () => [jwk];
const NOW = Date.parse("2026-10-17T13:00:00Z");

function sign(claims: Record<string, unknown>, kid = "k1") {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(privateKey).toString("base64url")}`;
}

const valid = {
  iss: "https://accounts.google.com",
  aud: "https://noma.example/api/webhooks/gmail",
  exp: NOW / 1000 + 600,
  email: "pubsub@proyecto.iam.gserviceaccount.com",
  email_verified: true,
};
const options = {
  audience: valid.aud,
  serviceAccountEmail: valid.email,
  fetchJwks,
  now: NOW,
};

test("acepta un JWT OIDC válido de Pub/Sub", async () => {
  assert.equal(await verifyGoogleOidcToken(sign(valid), options), true);
});

test("rechaza audiencia, emisor, expiración, cuenta o firma inválidas", async () => {
  assert.equal(
    await verifyGoogleOidcToken(sign({ ...valid, aud: "otra" }), options),
    false,
  );
  assert.equal(
    await verifyGoogleOidcToken(
      sign({ ...valid, iss: "https://evil" }),
      options,
    ),
    false,
  );
  assert.equal(
    await verifyGoogleOidcToken(
      sign({ ...valid, exp: NOW / 1000 - 3600 }),
      options,
    ),
    false,
  );
  assert.equal(
    await verifyGoogleOidcToken(sign({ ...valid, email: "x@y.com" }), options),
    false,
  );
  assert.equal(await verifyGoogleOidcToken(sign(valid, "k2"), options), false);
  const token = sign(valid);
  const tampered = `${token.split(".")[0]}.${Buffer.from(
    JSON.stringify({ ...valid, aud: valid.aud }),
  ).toString("base64url")}x.${token.split(".")[2]}`;
  assert.equal(await verifyGoogleOidcToken(tampered, options), false);
  assert.equal(await verifyGoogleOidcToken("no.es.jwt", options), false);
});
