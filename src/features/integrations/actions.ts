"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import {
  CONNECTION_PROVIDERS,
  getOAuthProvider,
  providerCredentials,
} from "./providers";
import { disconnect, getUserConnection, UserConnectionError } from "./tokens";

const providerSchema = z.enum(CONNECTION_PROVIDERS);
const aiProviderSchema = z.enum(["openai", "gemini"]);

async function revokeProviderToken(
  providerId: z.infer<typeof providerSchema>,
  refreshToken: string | null,
  accessToken: string,
) {
  const provider = getOAuthProvider(providerId);
  if (!provider) return;
  const credentials = providerCredentials(provider);

  try {
    if (
      providerId === "asana" &&
      refreshToken &&
      credentials.clientId &&
      credentials.clientSecret
    ) {
      await fetch("https://app.asana.com/-/oauth_revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          token: refreshToken,
        }),
        signal: AbortSignal.timeout(8_000),
      });
    } else if (providerId === "slack") {
      await fetch("https://slack.com/api/auth.revoke", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        signal: AbortSignal.timeout(8_000),
      });
    }
  } catch (error) {
    console.warn(`[oauth:${providerId}:revoke]`, error);
  }
}

export async function disconnectProvider(
  rawProvider: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const provider = providerSchema.parse(rawProvider);
    try {
      const connection = await getUserConnection(user.id, provider);
      await revokeProviderToken(
        provider,
        connection.refreshToken,
        connection.accessToken,
      );
    } catch (error) {
      if (!(error instanceof UserConnectionError)) throw error;
    }
    await disconnect(user.id, provider);
    await logActivity({
      entityType: "user_connection",
      entityId: user.id,
      action: `${provider}_disconnected`,
      actorId: user.id,
    });
    revalidatePath("/");
    revalidatePath("/integrations");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "disconnectProvider");
  }
}

export async function testAIProvider(
  rawProvider: string,
): Promise<ActionResult<{ message: string }>> {
  try {
    await requireAdmin();
    const provider = aiProviderSchema.parse(rawProvider);

    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) return { ok: false, error: "OpenAI no está configurado." };
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        return {
          ok: false,
          error:
            response.status === 401
              ? "OpenAI rechazó la credencial configurada."
              : "OpenAI no está disponible en este momento.",
        };
      }
      return {
        ok: true,
        data: { message: "Conexión con OpenAI verificada." },
      };
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return { ok: false, error: "Gemini no está configurado." };
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: { "x-goog-api-key": apiKey },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        error:
          response.status === 400 || response.status === 403
            ? "Gemini rechazó la credencial configurada."
            : "Gemini no está disponible en este momento.",
      };
    }
    return {
      ok: true,
      data: { message: "Conexión con Gemini verificada." },
    };
  } catch (error) {
    return handleActionError(error, "testAIProvider");
  }
}
