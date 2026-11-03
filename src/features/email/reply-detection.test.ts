import assert from "node:assert/strict";
import test from "node:test";
import {
  detectReply,
  type ReplyCandidate,
  type ReplyLookups,
} from "./reply-detection";

const REQUEST: ReplyCandidate = {
  id: "req-1",
  folio: "EQ-0142",
  emailChannelId: "chan-1",
  requesterEmail: "ana@cliente.cl",
  ccEmails: ["jefa@cliente.cl"],
};

function lookups(
  overrides: Partial<ReplyLookups> = {},
): ReplyLookups & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    byThreadId: async (threadId) => {
      calls.push(`thread:${threadId}`);
      return threadId === "thread-1" ? REQUEST : null;
    },
    byMessageIds: async (ids) => {
      calls.push(`refs:${ids.join(",")}`);
      return ids.includes("<noma.1@studionomade.cl>") ? REQUEST : null;
    },
    byFolio: async (folio) => {
      calls.push(`folio:${folio}`);
      return folio === "EQ-0142" ? REQUEST : null;
    },
    isTrustedSender: async (_candidate, sender) =>
      sender.endsWith("@cliente.cl"),
    ...overrides,
  };
}

const base = {
  threadId: "thread-x",
  subject: "Consulta",
  inReplyTo: null,
  references: [],
  fromEmail: "ana@cliente.cl",
};

test("detecta respuesta por threadId de Gmail", async () => {
  const l = lookups();
  const match = await detectReply({ ...base, threadId: "thread-1" }, l);
  assert.equal(match?.via, "thread");
  assert.equal(match?.request.id, "req-1");
  assert.deepEqual(l.calls, ["thread:thread-1"]);
});

test("detecta respuesta por In-Reply-To/References cuando Gmail parte el hilo", async () => {
  const match = await detectReply(
    {
      ...base,
      inReplyTo: "<noma.1@studionomade.cl>",
      references: ["<orig@cliente.cl>", "<noma.1@studionomade.cl>"],
    },
    lookups(),
  );
  assert.equal(match?.via, "references");
});

test("detecta respuesta por folio en el asunto (hilo nuevo)", async () => {
  const match = await detectReply(
    { ...base, subject: "RE: Banner [EQ-0142]", fromEmail: "otra@cliente.cl" },
    lookups(),
  );
  assert.equal(match?.via, "folio");
});

test("folio de un remitente ajeno no se acepta", async () => {
  const match = await detectReply(
    { ...base, subject: "RE: Banner [EQ-0142]", fromEmail: "x@spam.com" },
    lookups(),
  );
  assert.equal(match, null);
});

test("folio aceptado si el remitente estaba en CC original", async () => {
  const match = await detectReply(
    { ...base, subject: "[EQ-0142]", fromEmail: "JEFA@cliente.cl" },
    lookups({ isTrustedSender: async () => false }),
  );
  assert.equal(match?.via, "folio");
});

test("correo nuevo sin hilo, referencias ni folio → no es respuesta", async () => {
  const l = lookups();
  assert.equal(await detectReply(base, l), null);
  assert.deepEqual(l.calls, ["thread:thread-x"]);
});

test("folio inexistente → no es respuesta", async () => {
  assert.equal(
    await detectReply({ ...base, subject: "Re: [EQ-9999]" }, lookups()),
    null,
  );
});
