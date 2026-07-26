import "server-only";

import { unstable_cache } from "next/cache";
import {
  getUserConnection,
  UserConnectionError,
} from "@/features/integrations/tokens";

const SLACK_API_URL = "https://slack.com/api";
const MAX_CONVERSATIONS = 20;
const REQUEST_TIMEOUT_MS = 8_000;

export type MySlackChannel = {
  id: string;
  name: string;
  unread: number;
  url: string;
};

export type MySlackChannelsResult =
  | { connected: true; channels: MySlackChannel[] }
  | { connected: false; reason: string };

type SlackConversation = {
  id?: string;
  name?: string;
  user?: string;
  is_im?: boolean;
  is_mpim?: boolean;
};

type SlackApiResponse = {
  ok?: boolean;
  error?: string;
  channels?: SlackConversation[];
  channel?: SlackConversation & {
    unread_count_display?: number;
  };
};

function disconnectedReason(error: unknown) {
  if (error instanceof UserConnectionError) return error.message;
  return "No se pudo abrir tu conexión personal de Slack.";
}

function channelName(channel: SlackConversation) {
  if (channel.name?.trim()) return channel.name.trim();
  if (channel.is_im) {
    return channel.user ? `Mensaje directo · ${channel.user}` : "Mensaje directo";
  }
  if (channel.is_mpim) return "Mensaje grupal";
  return "Conversación de Slack";
}

async function slackRequest(
  path: string,
  token: string,
): Promise<SlackApiResponse> {
  const response = await fetch(`${SLACK_API_URL}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    return { ok: false, error: `http_${response.status}` };
  }
  return (await response.json()) as SlackApiResponse;
}

function isAuthorizationError(error: string | undefined) {
  return (
    error === "invalid_auth" ||
    error === "account_inactive" ||
    error === "token_revoked" ||
    error === "not_authed" ||
    error === "missing_scope"
  );
}

async function fetchMySlackChannels(
  userId: string,
): Promise<MySlackChannelsResult> {
  let connection;
  try {
    connection = await getUserConnection(userId, "slack");
  } catch (error) {
    return { connected: false, reason: disconnectedReason(error) };
  }

  const teamId =
    typeof connection.meta.teamId === "string"
      ? connection.meta.teamId
      : null;
  if (!teamId) {
    return {
      connected: false,
      reason:
        "Slack no informó el workspace. Desconecta y vuelve a conectar tu cuenta.",
    };
  }

  try {
    const params = new URLSearchParams({
      types: "public_channel,private_channel,im,mpim",
      exclude_archived: "true",
      limit: String(MAX_CONVERSATIONS),
    });
    const conversations = await slackRequest(
      `users.conversations?${params}`,
      connection.accessToken,
    );
    if (!conversations.ok) {
      return {
        connected: false,
        reason: isAuthorizationError(conversations.error)
          ? "Slack rechazó el acceso. Vuelve a conectar tu cuenta."
          : "Slack no está disponible en este momento.",
      };
    }

    const visible = (conversations.channels ?? [])
      .filter((channel): channel is SlackConversation & { id: string } =>
        Boolean(channel.id),
      )
      .slice(0, MAX_CONVERSATIONS);

    const channels = await Promise.all(
      visible.map(async (channel): Promise<MySlackChannel> => {
        const params = new URLSearchParams({ channel: channel.id });
        const detail = await slackRequest(
          `conversations.info?${params}`,
          connection.accessToken,
        ).catch(
          (): SlackApiResponse => ({
            ok: false,
          }),
        );
        const unread =
          detail.ok &&
          typeof detail.channel?.unread_count_display === "number"
            ? Math.max(0, detail.channel.unread_count_display)
            : 0;
        return {
          id: channel.id,
          name: channelName(detail.channel ?? channel),
          unread,
          url: `https://app.slack.com/client/${encodeURIComponent(teamId)}/${encodeURIComponent(channel.id)}`,
        };
      }),
    );

    channels.sort(
      (a, b) =>
        b.unread - a.unread || a.name.localeCompare(b.name, "es", {
          sensitivity: "base",
        }),
    );
    return { connected: true, channels };
  } catch {
    return {
      connected: false,
      reason: "No se pudo conectar con Slack.",
    };
  }
}

const getCachedMySlackChannels = unstable_cache(
  fetchMySlackChannels,
  ["my-slack-channels-v1"],
  { revalidate: 60 },
);

export async function getMySlackChannels(
  userId: string,
): Promise<MySlackChannelsResult> {
  try {
    await getUserConnection(userId, "slack");
  } catch (error) {
    return { connected: false, reason: disconnectedReason(error) };
  }
  return getCachedMySlackChannels(userId);
}
