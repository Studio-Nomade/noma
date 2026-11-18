import { strict as assert } from "node:assert";
import { test } from "node:test";
import { appBaseUrl, slackLink } from "./app-url";

test("appBaseUrl usa NEXT_PUBLIC_SITE_URL sin barra final", () => {
  assert.equal(
    appBaseUrl({ NEXT_PUBLIC_SITE_URL: "https://noma.example.cl/" }),
    "https://noma.example.cl",
  );
});

test("appBaseUrl cae al dominio de producción de Vercel", () => {
  assert.equal(
    appBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: "noma.example.cl" }),
    "https://noma.example.cl",
  );
  assert.equal(appBaseUrl({}), "");
});

test("slackLink omite links relativos", () => {
  assert.equal(slackLink("/projects/1", "Abrir"), "");
  assert.equal(slackLink("https://x.cl/p", "Abrir"), "<https://x.cl/p|Abrir>");
});
