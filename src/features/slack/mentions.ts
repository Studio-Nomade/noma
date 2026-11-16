import "server-only";

import {
  getUserConnection,
  UserConnectionError,
} from "@/features/integrations/tokens";

/**
 * Menciones recientes a la persona en Slack (scope de usuario `search:read`),
 * para su resumen diario. Solo se usan en el prompt; no se guardan.
 */

export type SlackMention = {
  id: string;
  channel: string;
  author: string | null;
  text: string;
  at: string | null;
  url: string | null;
};

export type SlackMentionsResult =
  | { connected: true; mentions: SlackMention[] }
  | { connected: false; reason: string };

type SearchMatch = {
  iid?: string;
  ts?: string;
  text?: string;
  username?: string;
  permalink?: string;
  channel?: { name?: string; is_im?: boolean };
};

export async function getMySlackMentions(
  userId: string,
  sinceDay: string,
  limit = 10,
): Promise<SlackMentionsResult> {
  let connection;
  try {
    connection = await getUserConnection(userId, "slack");
  } catch (error) {
    return {
      connected: false,
      reason:
        error instanceof UserConnectionError
          ? error.message
          : "No se pudo abrir tu conexión de Slack.",
    };
  }
  const slackUserId = connection.externalAccountId;
  if (!slackUserId) {
    return {
      connected: false,
      reason: "Vuelve a conectar Slack para identificar tu usuario.",
    };
  }

  const params = new URLSearchParams({
    query: `<@${slackUserId}> after:${sinceDay}`,
    sort: "timestamp",
    sort_dir: "desc",
    count: String(limit),
  });
  try {
    const res = await fetch(`https://slack.com/api/search.messages?${params}`, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      messages?: { matches?: SearchMatch[] };
    };
    if (!json.ok) {
      return {
        connected: false,
        reason:
          json.error === "missing_scope"
            ? "Reconecta Slack para que Noma pueda buscar tus menciones."
            : "Slack no respondió la búsqueda de menciones.",
      };
    }
    const mentions = (json.messages?.matches ?? []).map((m, i) => ({
      id: m.iid ?? m.ts ?? String(i),
      channel: m.channel?.is_im
        ? "mensaje directo"
        : (m.channel?.name ?? "canal"),
      author: m.username ?? null,
      text: m.text ?? "",
      at: m.ts ? new Date(Number(m.ts) * 1000).toISOString() : null,
      url: m.permalink ?? null,
    }));
    return { connected: true, mentions };
  } catch {
    return { connected: false, reason: "No se pudo conectar con Slack." };
  }
}
