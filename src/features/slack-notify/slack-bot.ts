import "server-only";

/**
 * Cliente mínimo de la API de Slack con el token del bot Noma
 * (SLACK_BOT_TOKEN, `xoxb-…`). Es el único camino para publicar avisos: nunca
 * se usa un token de usuario.
 */

const TIMEOUT_MS = 8_000;

export function slackBotConfigured() {
  return Boolean(botToken());
}

function botToken() {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  // Solo tokens de bot: un token de usuario (xoxp-) no se acepta.
  return token && token.startsWith("xoxb-") ? token : null;
}

type SlackApiResponse = { ok: boolean; error?: string; [key: string]: unknown };

async function slackApi<T extends SlackApiResponse>(
  method: string,
  body: Record<string, unknown>,
  { form = false }: { form?: boolean } = {},
): Promise<T> {
  const token = botToken();
  if (!token) throw new Error("SLACK_BOT_TOKEN no configurado.");
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: form
      ? {
          authorization: `Bearer ${token}`,
          "content-type": "application/x-www-form-urlencoded",
        }
      : {
          authorization: `Bearer ${token}`,
          "content-type": "application/json; charset=utf-8",
        },
    body: form
      ? new URLSearchParams(
          Object.entries(body).map(([k, v]) => [k, String(v)]),
        ).toString()
      : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Slack ${method}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** Publica como el bot Noma; con `threadTs`, responde en ese hilo. */
export async function postBotMessage(input: {
  channel: string;
  text: string;
  mrkdwn: string;
  threadTs?: string | null;
}): Promise<{ ts: string; channel: string }> {
  const result = await slackApi<
    SlackApiResponse & { ts?: string; channel?: string }
  >("chat.postMessage", {
    channel: input.channel,
    text: input.text,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: input.mrkdwn.slice(0, 2900) },
      },
    ],
    unfurl_links: false,
    unfurl_media: false,
    ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
  });
  if (!result.ok || !result.ts) {
    throw new Error(`Slack chat.postMessage: ${result.error ?? "sin ts"}`);
  }
  return { ts: result.ts, channel: result.channel ?? input.channel };
}

/** Usuario de Slack por correo (null si no existe o falta el permiso). */
export async function lookupSlackUserByEmail(
  email: string,
): Promise<string | null> {
  const result = await slackApi<SlackApiResponse & { user?: { id?: string } }>(
    "users.lookupByEmail",
    { email },
    { form: true },
  );
  if (!result.ok) {
    if (result.error !== "users_not_found") {
      console.error("[slack-notify:lookup]", result.error);
    }
    return null;
  }
  return result.user?.id ?? null;
}
