import "server-only";

import {
  providerCredentialsById,
  type ConnectionProvider,
} from "@/features/integrations/providers";
import {
  getUserConnection,
  saveUserConnection,
  UserConnectionError,
} from "@/features/integrations/tokens";

const ASANA_TOKEN_URL = "https://app.asana.com/-/oauth_token";
const REFRESH_EARLY_MS = 60_000;

export class AsanaUserAuthError extends Error {
  constructor(
    message: string,
    readonly reason:
      "not_connected" | "invalid_token" | "refresh_failed" | "not_configured",
  ) {
    super(message);
    this.name = "AsanaUserAuthError";
  }
}

function mapConnectionError(error: UserConnectionError): AsanaUserAuthError {
  return new AsanaUserAuthError(
    error.message,
    error.reason === "not_connected" ? "not_connected" : "invalid_token",
  );
}

export async function getAsanaAccessTokenForUser(
  userId: string,
): Promise<string> {
  let connection;
  try {
    connection = await getUserConnection(userId, "asana");
  } catch (error) {
    if (error instanceof UserConnectionError) {
      throw mapConnectionError(error);
    }
    throw error;
  }

  if (
    !connection.expiresAt ||
    connection.expiresAt.getTime() > Date.now() + REFRESH_EARLY_MS
  ) {
    return connection.accessToken;
  }

  if (!connection.refreshToken) {
    throw new AsanaUserAuthError(
      "Tu sesión de Asana expiró. Vuelve a conectar tu cuenta.",
      "refresh_failed",
    );
  }

  const credentials = providerCredentialsById("asana");
  if (!credentials.clientId || !credentials.clientSecret) {
    throw new AsanaUserAuthError(
      "Asana OAuth no está configurado en Noma.",
      "not_configured",
    );
  }

  let response: Response;
  try {
    response = await fetch(ASANA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: connection.refreshToken,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new AsanaUserAuthError(
      "No se pudo renovar la conexión con Asana.",
      "refresh_failed",
    );
  }

  const json = (await response.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;
  if (!response.ok || !json?.access_token) {
    throw new AsanaUserAuthError(
      "La conexión con Asana expiró. Vuelve a conectar tu cuenta.",
      "refresh_failed",
    );
  }

  await saveUserConnection({
    userId,
    provider: "asana" satisfies ConnectionProvider,
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? connection.refreshToken,
    expiresAt: new Date(
      Date.now() +
        (typeof json.expires_in === "number" ? json.expires_in : 3_600) * 1_000,
    ),
    externalAccountId: connection.externalAccountId,
    meta: connection.meta,
  });

  return json.access_token;
}
