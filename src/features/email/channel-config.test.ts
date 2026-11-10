import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  emailChannelConfigSchema,
  emailChannelsFileSchema,
  resolveSlackWebhook,
} from "./channel-config";

test("el ejemplo de canales es válido y se normaliza", () => {
  const parsed = emailChannelsFileSchema.parse(
    JSON.parse(
      readFileSync(resolve("scripts/email-channels.example.json"), "utf8"),
    ),
  );
  assert.equal(parsed.channels.length, 2);
  assert.equal(parsed.channels[0].month_section_template, "{Mes} | {YYYY}");
  assert.equal(parsed.channels[0].status, "active");
});

test("normaliza alias, prefijo y dominios; rechaza duplicados", () => {
  const parsed = emailChannelsFileSchema.parse({
    channels: [
      {
        alias: " Cliente@StudioNomade.cl ",
        asana_project_gid: "123",
        folio_prefix: "g360",
        allowed_sender_domains: ["@Cliente.CL"],
      },
    ],
  });
  assert.equal(parsed.channels[0].alias, "cliente@studionomade.cl");
  assert.equal(parsed.channels[0].folio_prefix, "G360");
  assert.deepEqual(parsed.channels[0].allowed_sender_domains, ["cliente.cl"]);

  const duplicated = emailChannelsFileSchema.safeParse({
    channels: [
      { alias: "a@x.cl", asana_project_gid: "1", folio_prefix: "AA" },
      { alias: "b@x.cl", asana_project_gid: "2", folio_prefix: "AA" },
    ],
  });
  assert.equal(duplicated.success, false);

  const fixedWithoutSection = emailChannelsFileSchema.safeParse({
    channels: [
      {
        alias: "a@x.cl",
        asana_project_gid: "1",
        folio_prefix: "AA",
        section_strategy: "fixed",
      },
    ],
  });
  assert.equal(fixedWithoutSection.success, false);
});

const base = {
  alias: "canal@studio.cl",
  asana_project_gid: "123",
  folio_prefix: "ABC",
};

test("slack_webhook_env solo acepta variables SLACK_…_WEBHOOK_URL", () => {
  assert.equal(
    emailChannelConfigSchema.safeParse({
      ...base,
      slack_webhook_env: "SLACK_CLIENTE_WEBHOOK_URL",
    }).success,
    true,
  );
  for (const bad of ["DATABASE_URL", "SLACK_CLIENTE", "slack_x_webhook_url"]) {
    assert.equal(
      emailChannelConfigSchema.safeParse({ ...base, slack_webhook_env: bad })
        .success,
      false,
      bad,
    );
  }
});

test("ignored_senders se normaliza a minúsculas", () => {
  const parsed = emailChannelConfigSchema.parse({
    ...base,
    ignored_senders: [" Servicio@Cliente.com "],
  });
  assert.deepEqual(parsed.ignored_senders, ["servicio@cliente.com"]);
});

test("webhook del canal con respaldo al operativo", () => {
  const env = {
    SLACK_OPERATIONS_WEBHOOK_URL: "https://hooks.example/ops",
    SLACK_CLIENTE_WEBHOOK_URL: " https://hooks.example/cliente ",
    DATABASE_URL: "postgres://secreto",
  };
  assert.equal(
    resolveSlackWebhook("SLACK_CLIENTE_WEBHOOK_URL", env),
    "https://hooks.example/cliente",
  );
  assert.equal(
    resolveSlackWebhook("SLACK_FALTA_WEBHOOK_URL", env),
    "https://hooks.example/ops",
  );
  assert.equal(
    resolveSlackWebhook("DATABASE_URL", env),
    "https://hooks.example/ops",
  );
  assert.equal(resolveSlackWebhook(null, {}), null);
});
