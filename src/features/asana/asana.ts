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

export type AsanaConnectionResult<T> =
  { connected: true; data: T } | { connected: false; reason: string };

export type AsanaProject = {
  gid: string;
  name: string;
  completed: boolean;
  completedAt: string | null;
  url: string | null;
};

export type AsanaTask = {
  gid: string;
  name: string;
  completed: boolean;
  completedAt: string | null;
  url: string | null;
};

type AsanaResourceJson = {
  gid: string;
  name: string;
  completed?: boolean;
  completed_at?: string | null;
  permalink_url?: string;
};

function toProject(value: AsanaResourceJson): AsanaProject {
  return {
    gid: value.gid,
    name: value.name,
    completed: value.completed ?? false,
    completedAt: value.completed_at ?? null,
    url: value.permalink_url ?? null,
  };
}

function toTask(value: AsanaResourceJson): AsanaTask {
  return {
    gid: value.gid,
    name: value.name,
    completed: value.completed ?? false,
    completedAt: value.completed_at ?? null,
    url: value.permalink_url ?? null,
  };
}

function asanaToken() {
  return process.env.ASANA_ACCESS_TOKEN?.trim() || null;
}

async function asanaGet<T>(path: string): Promise<AsanaConnectionResult<T>> {
  const token = asanaToken();
  if (!token) {
    return {
      connected: false,
      reason: "Asana no está configurado. Agrega ASANA_ACCESS_TOKEN.",
    };
  }
  try {
    const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return {
        connected: false,
        reason:
          res.status === 401 || res.status === 403
            ? "El acceso a Asana no es válido o no tiene permisos."
            : "Asana no está disponible en este momento.",
      };
    }
    const json = (await res.json()) as { data: T };
    return { connected: true, data: json.data };
  } catch {
    return {
      connected: false,
      reason: "No se pudo conectar con Asana.",
    };
  }
}

/** Lista proyectos del workspace cuando se configuró ASANA_WORKSPACE_GID. */
export async function listProjects(): Promise<
  AsanaConnectionResult<AsanaProject[]>
> {
  const workspaceGid = process.env.ASANA_WORKSPACE_GID?.trim();
  if (!workspaceGid) {
    return {
      connected: false,
      reason: "Falta configurar ASANA_WORKSPACE_GID.",
    };
  }
  const result = await asanaGet<AsanaResourceJson[]>(
    `/workspaces/${workspaceGid}/projects?archived=false&opt_fields=gid,name,completed,completed_at,permalink_url`,
  );
  return result.connected
    ? { connected: true, data: result.data.map(toProject) }
    : result;
}

/** Lista solo los campos mínimos para calcular avance; no se expone el detalle. */
export async function listTasks(
  projectGid: string,
): Promise<AsanaConnectionResult<AsanaTask[]>> {
  const result = await asanaGet<AsanaResourceJson[]>(
    `/projects/${encodeURIComponent(projectGid)}/tasks?limit=100&opt_fields=gid,name,completed,completed_at,permalink_url`,
  );
  return result.connected
    ? { connected: true, data: result.data.map(toTask) }
    : result;
}

export async function getAsanaProject(
  gid: string,
): Promise<AsanaConnectionResult<AsanaProject>> {
  const result = await asanaGet<AsanaResourceJson>(
    `/projects/${encodeURIComponent(gid)}?opt_fields=gid,name,completed,completed_at,permalink_url`,
  );
  return result.connected
    ? { connected: true, data: toProject(result.data) }
    : result;
}

export async function getAsanaTask(
  gid: string,
): Promise<AsanaConnectionResult<AsanaTask>> {
  const result = await asanaGet<AsanaResourceJson>(
    `/tasks/${encodeURIComponent(gid)}?opt_fields=gid,name,completed,completed_at,permalink_url`,
  );
  return result.connected
    ? { connected: true, data: toTask(result.data) }
    : result;
}

export async function createAsanaTask(input: {
  name: string;
  notes?: string;
  projectGid?: string;
}): Promise<AsanaResult> {
  const token = asanaToken();
  const projectGid =
    input.projectGid?.trim() || process.env.ASANA_PROJECT_GID?.trim();
  if (!token || !projectGid) {
    return {
      connected: false,
      reason:
        "Asana no está configurado (ASANA_ACCESS_TOKEN / ASANA_PROJECT_GID).",
    };
  }

  let res: Response;
  try {
    res = await fetch("https://app.asana.com/api/1.0/tasks", {
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
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return {
      connected: false,
      reason: "No se pudo conectar con Asana.",
    };
  }

  if (!res.ok) {
    const txt = await res.text();
    return {
      connected: false,
      reason: `Asana rechazó la creación: ${txt.slice(0, 160)}`,
    };
  }

  let json: { data?: { gid: string; permalink_url?: string } };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return {
      connected: false,
      reason: "Asana devolvió una respuesta inválida.",
    };
  }
  if (!json.data?.gid) {
    return {
      connected: false,
      reason: "Asana devolvió una tarea sin identificador.",
    };
  }
  return {
    connected: true,
    gid: json.data.gid,
    url: json.data?.permalink_url ?? null,
  };
}
