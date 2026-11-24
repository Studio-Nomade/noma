import "server-only";

/**
 * Cliente mínimo de la API web de Slack con el token de bot de la app de Noma
 * (`SLACK_BOT_TOKEN`, scopes: channels:read, groups:read, channels:manage,
 * channels:join, users:read, users:read.email, chat:write). Sin token, las
 * funciones lanzan `SlackBotUnavailable` y quien llama degrada.
 */

export class SlackBotUnavailable extends Error {
  constructor() {
    super("Falta SLACK_BOT_TOKEN (app de Slack de Noma con permisos de bot).");
    this.name = "SlackBotUnavailable";
  }
}

export function slackBotConfigured() {
  return Boolean(process.env.SLACK_BOT_TOKEN?.trim());
}

async function slack<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) throw new SlackBotUnavailable();
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  } & T;
  if (!data.ok) throw new Error(`Slack ${method}: ${data.error ?? res.status}`);
  return data;
}

export type BotChannel = { id: string; name: string };

/** Canales públicos y privados visibles para el bot (sin archivados). */
export async function listChannels(): Promise<BotChannel[]> {
  const out: BotChannel[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const data = await slack<{
      channels: { id: string; name: string }[];
      response_metadata?: { next_cursor?: string };
    }>("conversations.list", {
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });
    out.push(...data.channels.map(({ id, name }) => ({ id, name })));
    cursor = data.response_metadata?.next_cursor || undefined;
    if (!cursor) break;
  }
  return out;
}

export async function createChannel(name: string): Promise<BotChannel> {
  const data = await slack<{ channel: { id: string; name: string } }>(
    "conversations.create",
    { name, is_private: false },
  );
  return { id: data.channel.id, name: data.channel.name };
}

/** Une al bot a un canal público existente (para poder escribir en él). */
export async function joinChannel(channelId: string) {
  await slack("conversations.join", { channel: channelId }).catch(
    () => undefined,
  );
}

export async function userIdByEmail(email: string): Promise<string | null> {
  try {
    const data = await slack<{ user: { id: string } }>("users.lookupByEmail", {
      email,
    });
    return data.user.id;
  } catch {
    return null;
  }
}

export async function inviteToChannel(channelId: string, userIds: string[]) {
  if (!userIds.length) return;
  await slack("conversations.invite", {
    channel: channelId,
    users: userIds.join(","),
  }).catch((error) => {
    // already_in_channel u otros: no detiene la preparación del proyecto.
    console.error("[project-setup:slack:invite]", error);
  });
}

export async function postToChannel(channelId: string, text: string) {
  await slack("chat.postMessage", { channel: channelId, text });
}
