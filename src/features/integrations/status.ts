import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userConnections, userIntegrations } from "@/db/schema";
import { getGoogleAccessToken, GoogleAuthError } from "@/features/google/auth";
import {
  capabilityStatus,
  LEGACY_SCOPES,
  missingCount,
  parseScopes,
  type CapabilityStatus,
  type PersonalProvider,
} from "./capabilities";
import { providerCredentialsById } from "./providers";

/**
 * Estado detallado de las cuentas personales de un usuario: qué está
 * conectado y qué puede hacer Noma con cada una. Google se consulta en vivo
 * (tokeninfo); Slack y Asana usan los scopes guardados al conectar.
 */

export type ConnectionState =
  | "connected" // todo lo necesario concedido
  | "partial" // conectado, pero faltan permisos → reconectar
  | "disconnected"
  | "error" // token vencido o revocado → reconectar
  | "not_configured"; // faltan credenciales OAuth en el entorno

export type PersonalConnectionStatus = {
  provider: PersonalProvider;
  name: string;
  state: ConnectionState;
  account: string | null;
  capabilities: CapabilityStatus[];
  message: string | null;
  updatedAt: string | null;
};

const NAMES: Record<PersonalProvider, string> = {
  google: "Google Workspace",
  slack: "Slack",
  asana: "Asana",
};

function withCapabilities(
  provider: PersonalProvider,
  granted: string[],
  base: Omit<
    PersonalConnectionStatus,
    "capabilities" | "state" | "provider" | "name"
  >,
): PersonalConnectionStatus {
  const capabilities = capabilityStatus(provider, granted);
  return {
    provider,
    name: NAMES[provider],
    state: missingCount(capabilities) ? "partial" : "connected",
    capabilities,
    ...base,
  };
}

function empty(
  provider: PersonalProvider,
  state: ConnectionState,
  message: string | null = null,
): PersonalConnectionStatus {
  return {
    provider,
    name: NAMES[provider],
    state,
    account: null,
    capabilities: capabilityStatus(provider, []),
    message,
    updatedAt: null,
  };
}

async function googleStatus(userId: string): Promise<PersonalConnectionStatus> {
  const configured = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
  if (!configured) return empty("google", "not_configured");

  const [row] = await db
    .select({
      email: userIntegrations.email,
      token: userIntegrations.googleRefreshToken,
      updatedAt: userIntegrations.updatedAt,
    })
    .from(userIntegrations)
    .where(eq(userIntegrations.userId, userId))
    .limit(1);
  if (!row?.token) {
    return empty(
      "google",
      "disconnected",
      "Noma no tiene acceso a tu Google. Vuelve a entrar para concederlo.",
    );
  }

  try {
    const accessToken = await getGoogleAccessToken(userId);
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      { cache: "no-store", signal: AbortSignal.timeout(6_000) },
    );
    if (!res.ok) throw new Error(`tokeninfo ${res.status}`);
    const info = (await res.json()) as { scope?: string };
    return withCapabilities("google", parseScopes(info.scope), {
      account: row.email,
      message: null,
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (err) {
    if (!(err instanceof GoogleAuthError)) {
      console.warn("[integrations:google-status]", err);
    }
    return {
      ...empty(
        "google",
        "error",
        "Google no aceptó el acceso guardado. Vuelve a entrar para renovarlo.",
      ),
      account: row.email,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export async function getPersonalConnectionsStatus(
  userId: string,
): Promise<PersonalConnectionStatus[]> {
  const [google, rows] = await Promise.all([
    googleStatus(userId),
    db
      .select({
        provider: userConnections.provider,
        meta: userConnections.meta,
        updatedAt: userConnections.updatedAt,
      })
      .from(userConnections)
      .where(eq(userConnections.userId, userId)),
  ]);

  const others = (["slack", "asana"] as const).map((provider) => {
    if (!providerCredentialsById(provider).configured) {
      return empty(provider, "not_configured");
    }
    const row = rows.find((r) => r.provider === provider);
    if (!row) return empty(provider, "disconnected");
    const meta = row.meta ?? {};
    const saved = typeof meta.scope === "string" ? parseScopes(meta.scope) : [];
    const granted = saved.length ? saved : (LEGACY_SCOPES[provider] ?? []);
    const account =
      provider === "slack"
        ? ((meta.teamName as string | null) ?? null)
        : ((meta.accountEmail as string | null) ??
          (meta.accountName as string | null) ??
          null);
    return withCapabilities(provider, granted, {
      account,
      message: null,
      updatedAt: row.updatedAt.toISOString(),
    });
  });

  return [google, ...others];
}
