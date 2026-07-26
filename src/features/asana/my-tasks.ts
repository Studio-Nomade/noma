import "server-only";

import { getUserConnection } from "@/features/integrations/tokens";
import { AsanaUserAuthError, getAsanaAccessTokenForUser } from "./user-auth";

export type MyAsanaTask = {
  id: string;
  name: string;
  dueOn: string | null;
  url: string | null;
};

export type MyAsanaTasksResult =
  | { connected: true; tasks: MyAsanaTask[] }
  | { connected: false; reason: string };

type AsanaTaskJson = {
  gid?: string;
  name?: string;
  due_on?: string | null;
  permalink_url?: string;
  completed?: boolean;
};

function sortTasks(tasks: MyAsanaTask[]) {
  return tasks.sort((a, b) => {
    if (!a.dueOn && !b.dueOn) return a.name.localeCompare(b.name, "es");
    if (!a.dueOn) return 1;
    if (!b.dueOn) return -1;
    return a.dueOn.localeCompare(b.dueOn);
  });
}

export async function getMyAsanaTasks(
  userId: string,
): Promise<MyAsanaTasksResult> {
  let token: string;
  try {
    token = await getAsanaAccessTokenForUser(userId);
  } catch (error) {
    if (error instanceof AsanaUserAuthError) {
      return { connected: false, reason: error.message };
    }
    return {
      connected: false,
      reason: "No se pudo abrir tu conexión personal de Asana.",
    };
  }

  const connection = await getUserConnection(userId, "asana").catch(() => null);
  const workspaceGid =
    typeof connection?.meta.workspaceGid === "string"
      ? connection.meta.workspaceGid
      : null;
  if (!workspaceGid) {
    return {
      connected: false,
      reason:
        "Asana no informó un workspace. Desconecta y vuelve a conectar tu cuenta.",
    };
  }

  const params = new URLSearchParams({
    assignee: "me",
    workspace: workspaceGid,
    completed_since: "now",
    limit: "100",
    opt_fields: "gid,name,due_on,permalink_url,completed",
  });

  try {
    const response = await fetch(
      `https://app.asana.com/api/1.0/tasks?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) {
      return {
        connected: false,
        reason:
          response.status === 401 || response.status === 403
            ? "Asana rechazó el acceso. Vuelve a conectar tu cuenta."
            : "Asana no está disponible en este momento.",
      };
    }

    const json = (await response.json()) as { data?: AsanaTaskJson[] };
    const tasks = (json.data ?? []).flatMap((task) => {
      if (!task.gid || task.completed) return [];
      return [
        {
          id: task.gid,
          name: task.name?.trim() || "Tarea sin nombre",
          dueOn: task.due_on ?? null,
          url: task.permalink_url ?? null,
        },
      ];
    });
    return { connected: true, tasks: sortTasks(tasks) };
  } catch {
    return {
      connected: false,
      reason: "No se pudo conectar con Asana.",
    };
  }
}
