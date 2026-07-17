import "server-only";

/**
 * Asana: creación de tarea/proyecto al traspasar una oportunidad a operación.
 *
 * Preparado para conectar: usa ASANA_ACCESS_TOKEN + ASANA_PROJECT_GID del
 * entorno. Si no están configurados devuelve `{ connected: false }` para que el
 * llamador degrade (el usuario puede pegar el link de Asana manualmente).
 */

export type AsanaResult =
  | { connected: true; gid: string; url: string | null }
  | { connected: false; reason: string };

export async function createAsanaTask(input: {
  name: string;
  notes?: string;
}): Promise<AsanaResult> {
  const token = process.env.ASANA_ACCESS_TOKEN;
  const projectGid = process.env.ASANA_PROJECT_GID;
  if (!token || !projectGid) {
    return {
      connected: false,
      reason:
        "Asana no está configurado (ASANA_ACCESS_TOKEN / ASANA_PROJECT_GID).",
    };
  }

  const res = await fetch("https://app.asana.com/api/1.0/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        name: input.name,
        notes: input.notes ?? "",
        projects: [projectGid],
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    return {
      connected: false,
      reason: `Asana rechazó la creación: ${txt.slice(0, 160)}`,
    };
  }

  const json = (await res.json()) as {
    data?: { gid: string; permalink_url?: string };
  };
  return {
    connected: true,
    gid: json.data?.gid ?? "",
    url: json.data?.permalink_url ?? null,
  };
}
