import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import type { ConnectionProvider } from "./providers";

export class UserConnectionError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "not_connected"
      | "invalid_token"
      | "encryption_not_configured" = "not_connected",
  ) {
    super(message);
    this.name = "UserConnectionError";
  }
}

export type UserConnection = {
  userId: string;
  provider: ConnectionProvider;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  externalAccountId: string | null;
  meta: Record<string, unknown>;
};

export async function getUserConnection(
  userId: string,
  provider: ConnectionProvider,
): Promise<UserConnection> {
  const [row] = await db
    .select()
    .from(userConnections)
    .where(
      and(
        eq(userConnections.userId, userId),
        eq(userConnections.provider, provider),
      ),
    )
    .limit(1);

  if (!row) {
    throw new UserConnectionError(
      `No hay una cuenta de ${provider} conectada.`,
      "not_connected",
    );
  }

  try {
    return {
      userId: row.userId,
      provider,
      accessToken: decryptToken(row.accessToken),
      refreshToken: row.refreshToken ? decryptToken(row.refreshToken) : null,
      expiresAt: row.expiresAt,
      externalAccountId: row.externalAccountId,
      meta: row.meta ?? {},
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("no está configurada")
        ? "Falta configurar el cifrado de conexiones."
        : "La conexión guardada no se puede descifrar. Vuelve a conectarla.";
    throw new UserConnectionError(
      message,
      message.startsWith("Falta")
        ? "encryption_not_configured"
        : "invalid_token",
    );
  }
}

export async function saveUserConnection(input: {
  userId: string;
  provider: ConnectionProvider;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  externalAccountId?: string | null;
  meta?: Record<string, unknown>;
}) {
  const now = new Date();
  const values = {
    userId: input.userId,
    provider: input.provider,
    accessToken: encryptToken(input.accessToken),
    refreshToken: input.refreshToken ? encryptToken(input.refreshToken) : null,
    expiresAt: input.expiresAt ?? null,
    externalAccountId: input.externalAccountId ?? null,
    meta: input.meta ?? {},
    updatedAt: now,
  };

  await db
    .insert(userConnections)
    .values(values)
    .onConflictDoUpdate({
      target: [userConnections.userId, userConnections.provider],
      set: values,
    });
}

export async function disconnect(userId: string, provider: ConnectionProvider) {
  await db
    .delete(userConnections)
    .where(
      and(
        eq(userConnections.userId, userId),
        eq(userConnections.provider, provider),
      ),
    );
}

export async function getConnectionStates(userId: string) {
  const rows = await db
    .select({
      provider: userConnections.provider,
      expiresAt: userConnections.expiresAt,
      updatedAt: userConnections.updatedAt,
    })
    .from(userConnections)
    .where(eq(userConnections.userId, userId));

  return rows.reduce<
    Partial<
      Record<
        ConnectionProvider,
        { connected: true; expiresAt: Date | null; updatedAt: Date }
      >
    >
  >((states, row) => {
    if (row.provider === "asana" || row.provider === "slack") {
      states[row.provider] = {
        connected: true,
        expiresAt: row.expiresAt,
        updatedAt: row.updatedAt,
      };
    }
    return states;
  }, {});
}
