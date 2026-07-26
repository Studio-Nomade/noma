import "server-only";

export type AsanaAccountMetadata = {
  externalAccountId: string | null;
  meta: Record<string, unknown>;
};

/**
 * Completa la identidad Asana del usuario después del intercambio OAuth.
 * Un fallo de esta consulta no invalida los tokens: P2 puede degradar con un
 * aviso y el usuario puede reconectar cuando la API vuelva a estar disponible.
 */
export async function getAsanaAccountMetadata(
  accessToken: string,
): Promise<AsanaAccountMetadata> {
  try {
    const response = await fetch(
      "https://app.asana.com/api/1.0/users/me" +
        "?opt_fields=gid,name,email,workspaces.gid,workspaces.name",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) {
      return { externalAccountId: null, meta: {} };
    }

    const json = (await response.json()) as {
      data?: {
        gid?: string;
        name?: string;
        email?: string;
        workspaces?: { gid?: string; name?: string }[];
      };
    };
    const user = json.data;
    const workspace = user?.workspaces?.find((item) => item.gid);
    return {
      externalAccountId: user?.gid ?? null,
      meta: {
        accountName: user?.name ?? null,
        accountEmail: user?.email ?? null,
        workspaceGid: workspace?.gid ?? null,
        workspaceName: workspace?.name ?? null,
      },
    };
  } catch {
    return { externalAccountId: null, meta: {} };
  }
}
