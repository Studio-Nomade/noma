/**
 * Webhooks de Asana: firma X-Hook-Signature (HMAC-SHA256 hex del cuerpo con
 * el secreto del handshake) y filtrado de eventos de comentarios.
 * Módulo puro (sin DB ni red).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export function signAsanaBody(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifyAsanaSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const expected = Buffer.from(signAsanaBody(rawBody, secret), "hex");
  const received = Buffer.from(signature, "hex");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

type AsanaEventJson = {
  action?: string;
  user?: { gid?: string } | null;
  resource?: {
    gid?: string;
    resource_type?: string;
    resource_subtype?: string;
  };
  parent?: { gid?: string; resource_type?: string } | null;
};

export type StoryAddedEvent = {
  storyGid: string;
  taskGid: string | null;
  userGid: string | null;
  subtype: string | null;
};

/** Eventos `story` `added` (comentarios nuevos), sin duplicados. */
export function storyAddedEvents(payload: unknown): StoryAddedEvent[] {
  const events = (payload as { events?: AsanaEventJson[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  const seen = new Set<string>();
  const out: StoryAddedEvent[] = [];
  for (const event of events) {
    const resource = event.resource;
    if (
      event.action !== "added" ||
      resource?.resource_type !== "story" ||
      !resource.gid ||
      seen.has(resource.gid)
    ) {
      continue;
    }
    // Asana puede omitir el subtipo en el evento; si viene y no es
    // comentario, se descarta sin pedir la story.
    if (
      resource.resource_subtype &&
      resource.resource_subtype !== "comment_added"
    ) {
      continue;
    }
    seen.add(resource.gid);
    out.push({
      storyGid: resource.gid,
      taskGid:
        event.parent?.resource_type === "task"
          ? (event.parent.gid ?? null)
          : null,
      userGid: event.user?.gid ?? null,
      subtype: resource.resource_subtype ?? null,
    });
  }
  return out;
}
