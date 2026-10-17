import "server-only";

import { monthSectionName, normalizeSectionName } from "@/features/email/dates";
import { findEnumOption, type AsanaCustomFieldSetting } from "./custom-fields";

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

// ─────────────────────────────────────────────────────────────
// Operaciones del canal correo (token central ASANA_ACCESS_TOKEN).
// A diferencia de las funciones de arriba, estas LANZAN AsanaApiError para que
// la cola durable reintente; `status` distingue un rechazo definitivo de Asana
// (la operación no ocurrió) de una falla de red ambigua (status null).
// ─────────────────────────────────────────────────────────────

const ASANA_API = "https://app.asana.com/api/1.0";

export class AsanaApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "AsanaApiError";
  }
}

async function asanaRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  options: { body?: unknown; form?: FormData; timeoutMs?: number } = {},
): Promise<T> {
  const token = asanaToken();
  if (!token) {
    throw new AsanaApiError(
      "Asana no está configurado. Agrega ASANA_ACCESS_TOKEN.",
      0,
    );
  }
  let res: Response;
  try {
    res = await fetch(`${ASANA_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: options.form
        ? options.form
        : options.body !== undefined
          ? JSON.stringify({ data: options.body })
          : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
  } catch {
    throw new AsanaApiError("No se pudo conectar con Asana.", null);
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new AsanaApiError(
      `Asana ${method} ${path.split("?")[0]} → HTTP ${res.status}: ${detail}`,
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as { data: T };
  return json.data;
}

// ── Usuario del token (bot de Noma) ──────────────────────────
let botUserGidCache: string | null = null;

export async function getAsanaMe(): Promise<{
  gid: string;
  name: string;
  email: string | null;
}> {
  const me = await asanaRequest<{ gid: string; name: string; email?: string }>(
    "GET",
    "/users/me?opt_fields=gid,name,email",
  );
  return { gid: me.gid, name: me.name, email: me.email ?? null };
}

/**
 * gid del usuario de Asana con el que Noma comenta (NOMA_ASANA_BOT_USER_GID o
 * el dueño de ASANA_ACCESS_TOKEN). Sus comentarios nunca disparan correos.
 */
export async function resolveBotUserGid(): Promise<string> {
  const configured = process.env.NOMA_ASANA_BOT_USER_GID?.trim();
  if (configured) return configured;
  if (botUserGidCache) return botUserGidCache;
  botUserGidCache = (await getAsanaMe()).gid;
  return botUserGidCache;
}

// ── Secciones ────────────────────────────────────────────────
export type AsanaSection = { gid: string; name: string };

export async function listSections(projectGid: string) {
  return asanaRequest<AsanaSection[]>(
    "GET",
    `/projects/${encodeURIComponent(projectGid)}/sections?opt_fields=gid,name&limit=100`,
  );
}

export async function createSection(projectGid: string, name: string) {
  return asanaRequest<AsanaSection>(
    "POST",
    `/projects/${encodeURIComponent(projectGid)}/sections`,
    { body: { name } },
  );
}

const sectionCache = new Map<string, AsanaSection>();

/**
 * Sección del mes según la plantilla del canal ("{Mes} | {YYYY}" →
 * "Octubre | 2026"); si no existe se crea al final del proyecto.
 */
export async function ensureMonthSection(
  projectGid: string,
  date: Date,
  template = "{Mes} | {YYYY}",
): Promise<AsanaSection & { created: boolean }> {
  const name = monthSectionName(template, date);
  const key = `${projectGid}:${normalizeSectionName(name)}`;
  const cached = sectionCache.get(key);
  if (cached) return { ...cached, created: false };

  const sections = await listSections(projectGid);
  const existing = sections.find(
    (section) =>
      normalizeSectionName(section.name) === normalizeSectionName(name),
  );
  if (existing) {
    sectionCache.set(key, existing);
    return { ...existing, created: false };
  }
  const created = await createSection(projectGid, name);
  sectionCache.set(key, created);
  return { ...created, created: true };
}

// ── Campos personalizados (cacheados por proyecto) ───────────
const fieldCache = new Map<
  string,
  { settings: AsanaCustomFieldSetting[]; expiresAt: number }
>();

export async function getProjectCustomFields(
  projectGid: string,
): Promise<AsanaCustomFieldSetting[]> {
  const cached = fieldCache.get(projectGid);
  if (cached && cached.expiresAt > Date.now()) return cached.settings;
  const settings = await asanaRequest<AsanaCustomFieldSetting[]>(
    "GET",
    `/projects/${encodeURIComponent(projectGid)}/custom_field_settings?opt_fields=custom_field.gid,custom_field.name,custom_field.resource_subtype,custom_field.enum_options.gid,custom_field.enum_options.name,custom_field.enum_options.enabled&limit=100`,
  );
  fieldCache.set(projectGid, {
    settings,
    expiresAt: Date.now() + 10 * 60 * 1_000,
  });
  return settings;
}

/** Valores {gid campo → gid opción} para los enums que existan en el proyecto. */
export async function resolveEnumValues(
  projectGid: string,
  wanted: { field: string; options: string[] }[],
): Promise<Record<string, string>> {
  const settings = await getProjectCustomFields(projectGid);
  const values: Record<string, string> = {};
  for (const item of wanted) {
    const match = findEnumOption(settings, item.field, item.options);
    if (match) values[match.fieldGid] = match.optionGid;
  }
  return values;
}

/**
 * Fija un campo enum por nombre ("Estado" → "Enviado a cliente") si el campo y
 * la opción existen en el proyecto. Devuelve false si no aplica.
 */
export async function setEnumFieldByName(
  taskGid: string,
  projectGid: string,
  fieldName: string,
  optionNames: string | string[],
): Promise<boolean> {
  const settings = await getProjectCustomFields(projectGid);
  const match = findEnumOption(settings, fieldName, optionNames);
  if (!match) return false;
  await asanaRequest("PUT", `/tasks/${encodeURIComponent(taskGid)}`, {
    body: { custom_fields: { [match.fieldGid]: match.optionGid } },
  });
  return true;
}

// ── Tareas, comentarios y adjuntos ───────────────────────────
export async function createTask(input: {
  projectGid: string;
  sectionGid?: string | null;
  name: string;
  htmlNotes: string;
  dueOn?: string | null;
  assigneeGid?: string | null;
  customFields?: Record<string, string>;
}): Promise<{ gid: string; url: string | null }> {
  const task = await asanaRequest<{ gid: string; permalink_url?: string }>(
    "POST",
    "/tasks?opt_fields=gid,permalink_url",
    {
      body: {
        name: input.name.slice(0, 250),
        html_notes: input.htmlNotes,
        ...(input.sectionGid
          ? {
              memberships: [
                { project: input.projectGid, section: input.sectionGid },
              ],
            }
          : { projects: [input.projectGid] }),
        ...(input.dueOn ? { due_on: input.dueOn } : {}),
        ...(input.assigneeGid ? { assignee: input.assigneeGid } : {}),
        ...(input.customFields && Object.keys(input.customFields).length
          ? { custom_fields: input.customFields }
          : {}),
      },
    },
  );
  if (!task?.gid) {
    throw new AsanaApiError("Asana devolvió una tarea sin identificador.", 500);
  }
  return { gid: task.gid, url: task.permalink_url ?? null };
}

export async function addStory(taskGid: string, htmlText: string) {
  return asanaRequest<{ gid: string }>(
    "POST",
    `/tasks/${encodeURIComponent(taskGid)}/stories?opt_fields=gid`,
    { body: { html_text: htmlText } },
  );
}

export async function uploadAttachment(
  taskGid: string,
  file: { filename: string; mimeType: string; content: Buffer },
) {
  const form = new FormData();
  form.append("parent", taskGid);
  form.append("resource_subtype", "asana");
  form.append(
    "file",
    new Blob([new Uint8Array(file.content)], { type: file.mimeType }),
    file.filename,
  );
  return asanaRequest<{ gid: string }>("POST", "/attachments?opt_fields=gid", {
    form,
    timeoutMs: 30_000,
  });
}

export type AsanaStory = {
  gid: string;
  text: string | null;
  html_text: string | null;
  resource_subtype: string | null;
  created_at: string | null;
  created_by: { gid: string; name?: string } | null;
  target: { gid: string } | null;
};

const STORY_FIELDS =
  "gid,text,html_text,resource_subtype,created_at,created_by.gid,created_by.name,target.gid";

export async function getStory(storyGid: string) {
  return asanaRequest<AsanaStory>(
    "GET",
    `/stories/${encodeURIComponent(storyGid)}?opt_fields=${STORY_FIELDS}`,
  );
}

export async function listTaskStories(taskGid: string) {
  return asanaRequest<AsanaStory[]>(
    "GET",
    `/tasks/${encodeURIComponent(taskGid)}/stories?opt_fields=${STORY_FIELDS}&limit=100`,
  );
}

export async function getTaskState(taskGid: string) {
  return asanaRequest<{
    gid: string;
    completed: boolean;
    projects?: { gid: string }[];
  }>(
    "GET",
    `/tasks/${encodeURIComponent(taskGid)}?opt_fields=gid,completed,projects.gid`,
  );
}

export async function setTaskCompleted(taskGid: string, completed: boolean) {
  await asanaRequest("PUT", `/tasks/${encodeURIComponent(taskGid)}`, {
    body: { completed },
  });
}

// ── Webhooks ─────────────────────────────────────────────────
export type AsanaWebhookInfo = {
  gid: string;
  active: boolean;
  target: string;
  resource: { gid: string } | null;
};

export async function createWebhook(resourceGid: string, target: string) {
  // Asana hace el handshake contra `target` ANTES de responder esta llamada.
  return asanaRequest<AsanaWebhookInfo>(
    "POST",
    "/webhooks?opt_fields=gid,active,target,resource.gid",
    {
      body: {
        resource: resourceGid,
        target,
        filters: [
          {
            resource_type: "story",
            resource_subtype: "comment_added",
            action: "added",
          },
        ],
      },
      timeoutMs: 30_000,
    },
  );
}

export async function listWebhooks(workspaceGid: string, resourceGid?: string) {
  const params = new URLSearchParams({
    workspace: workspaceGid,
    limit: "100",
    opt_fields: "gid,active,target,resource.gid",
  });
  if (resourceGid) params.set("resource", resourceGid);
  return asanaRequest<AsanaWebhookInfo[]>("GET", `/webhooks?${params}`);
}

export async function deleteWebhook(webhookGid: string) {
  await asanaRequest("DELETE", `/webhooks/${encodeURIComponent(webhookGid)}`);
}
