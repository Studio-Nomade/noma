import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userIntegrations } from "@/db/schema";
import { CONNECTION_PROVIDERS, providerCredentialsById } from "./providers";
import { getConnectionStates } from "./tokens";

export type IntegrationOverview = {
  ai: {
    openai: { configured: boolean };
    gemini: { configured: boolean };
  };
  google: {
    connected: boolean;
    configured: boolean;
  };
  personal: {
    provider: "asana" | "slack";
    configured: boolean;
    connected: boolean;
    updatedAt: string | null;
  }[];
  centralAsana: {
    configured: boolean;
  };
  encryptionConfigured: boolean;
};

export async function getIntegrationOverview(
  userId: string,
): Promise<IntegrationOverview> {
  const [[google], connectionStates] = await Promise.all([
    db
      .select({ token: userIntegrations.googleRefreshToken })
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, userId))
      .limit(1),
    getConnectionStates(userId),
  ]);

  return {
    ai: {
      openai: { configured: Boolean(process.env.OPENAI_API_KEY?.trim()) },
      gemini: { configured: Boolean(process.env.GEMINI_API_KEY?.trim()) },
    },
    google: {
      connected: Boolean(google?.token),
      configured: Boolean(
        process.env.GOOGLE_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CLIENT_SECRET?.trim(),
      ),
    },
    personal: CONNECTION_PROVIDERS.map((provider) => ({
      provider,
      configured: providerCredentialsById(provider).configured,
      connected: Boolean(connectionStates[provider]?.connected),
      updatedAt: connectionStates[provider]?.updatedAt.toISOString() ?? null,
    })),
    centralAsana: {
      configured: Boolean(
        process.env.ASANA_ACCESS_TOKEN?.trim() &&
        process.env.ASANA_PROJECT_GID?.trim(),
      ),
    },
    encryptionConfigured: Boolean(
      process.env.NOMA_TOKEN_ENCRYPTION_KEY?.trim(),
    ),
  };
}
