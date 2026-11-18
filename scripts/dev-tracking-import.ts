import { config } from "dotenv";
config({ path: ".env.local" });

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { and, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clientContacts,
  clients,
  devLog,
  devMeetingTypes,
  devMilestones,
  devModules,
  devPrograms,
  devPrs,
  devRoadmaps,
  projects,
} from "@/db/schema";
import {
  detectRoadmapCode,
  isPromotion,
  normalizeRoadmapCode,
} from "@/features/dev-tracking/roadmap-code";

/**
 * Importa un programa de seguimiento de desarrollo (tablero + PR + Asana) a
 * las tablas `dev_*`. El insumo es privado y vive fuera de este repo:
 *
 *   ${NOMA_DATA_DIR:-../noma-ops}/data/dev-tracking/<slug>/
 *     program.json       { project, name, startDate, repos[], asanaProjectGid }
 *     seguimiento.json   el objeto `window.SEGUIMIENTO` del tablero HTML
 *     prs/<repo>.tsv     mes<TAB>base<TAB>numero<TAB>titulo (PR mergeados)
 *     asana_tasks.json   (opcional) tareas del proyecto de Asana
 *
 * program.json puede traer además (opcional):
 *   client         nombre del cliente; con createProject, se crea si falta
 *   createProject  { name, area, status } para crear el proyecto si no existe
 *   contacts       [{ name, email, role }] → client_contacts (solo completa vacíos)
 *   slackWebhookEnv  variable del webhook de Slack del canal del programa
 *                   (SLACK_…_WEBHOOK_URL; solo el nombre, nunca la URL)
 *   meetingTypes   [{ name, cadence, weekday, timeOfDay, durationMin, contacts:
 *                   [email], description, producesBacklog }] → dev_meeting_types
 *
 * Idempotente: upsert por clave natural (código, repo+número, fecha+texto).
 * Uso: npm run dev-tracking:import -- appscinco
 */

type ProgramFile = {
  project: string; // nombre (ilike) o UUID del proyecto en Noma
  name: string;
  startDate?: string;
  repos: { name: string; label: string; countBase: "non_main" | "all" }[];
  asanaProjectGid?: string;
  slackWebhookEnv?: string;
  client?: string;
  createProject?: { name: string; area?: string; status?: string };
  contacts?: { name: string; email: string; role?: string }[];
  meetingTypes?: {
    name: string;
    description?: string;
    cadence?: "weekly" | "biweekly" | "monthly" | "adhoc";
    weekday?: number;
    timeOfDay?: string;
    durationMin?: number;
    contacts?: string[];
    producesBacklog?: boolean;
  }[];
};

type Seguimiento = {
  actualizado?: string;
  inicioProyecto?: string;
  modulos: {
    id: string;
    nombre: string;
    objetivo?: string;
    inicio?: string;
    entregaObjetivo?: string;
    avance?: number;
    criterio?: string;
    pelota?: { quien?: string; que?: string };
    proximoSeguimiento?: string;
    enProduccion?: string[];
    pendientes?: string[];
    hitos?: { nombre: string; estado: string; fecha?: string }[];
  }[];
  roadmaps: [string, string, string, string, string][]; // id, titulo, mes, estado, tipo
  bitacora: { fecha: string; modulo?: string; texto: string }[];
};

type AsanaTask = {
  gid: string;
  name: string;
  completed?: boolean;
};

const slug = process.argv[2];
if (!slug) {
  console.error("Uso: npm run dev-tracking:import -- <slug>");
  process.exit(1);
}
const dataRoot = resolve(
  process.env.NOMA_DATA_DIR ?? "../noma-ops",
  "data/dev-tracking",
  slug,
);
if (!existsSync(dataRoot)) {
  console.error(`No existe el insumo: ${dataRoot}`);
  process.exit(1);
}

function readJson<T>(name: string): T | null {
  const file = resolve(dataRoot, name);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const program = readJson<ProgramFile>("program.json");
  if (!program) throw new Error("Falta program.json");
  const seguimiento = readJson<Seguimiento>("seguimiento.json");
  const asanaTasks = readJson<AsanaTask[]>("asana_tasks.json") ?? [];

  // 1. Proyecto y programa
  let [project] = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      name: projects.name,
    })
    .from(projects)
    .where(
      UUID_RE.test(program.project)
        ? eq(projects.id, program.project)
        : ilike(projects.name, `%${program.project}%`),
    )
    .limit(2);
  if (!project && program.createProject && program.client) {
    let [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(ilike(clients.companyName, `%${program.client}%`))
      .limit(1);
    if (!client) {
      [client] = await db
        .insert(clients)
        .values({ companyName: program.client, status: "Cliente recurrente" })
        .returning({ id: clients.id });
      console.log(`Cliente creado: ${program.client}`);
    }
    const area = (program.createProject.area ??
      "WD") as typeof projects.$inferInsert.area;
    [project] = await db
      .insert(projects)
      .values({
        name: program.createProject.name,
        clientId: client.id,
        area,
        areas: [area],
        status: (program.createProject.status ??
          "En desarrollo") as typeof projects.$inferInsert.status,
        ...(program.asanaProjectGid
          ? { asanaProjectGid: program.asanaProjectGid }
          : {}),
      })
      .returning({
        id: projects.id,
        clientId: projects.clientId,
        name: projects.name,
      });
    console.log(`Proyecto creado: ${project.name}`);
  }
  if (!project) throw new Error(`Proyecto no encontrado: ${program.project}`);
  const [client] = await db
    .select({ name: clients.companyName })
    .from(clients)
    .where(eq(clients.id, project.clientId));

  const [row] = await db
    .insert(devPrograms)
    .values({
      projectId: project.id,
      clientId: project.clientId,
      name: program.name,
      startDate: program.startDate ?? seguimiento?.inicioProyecto ?? null,
      repos: program.repos,
      asanaProjectGid: program.asanaProjectGid ?? null,
      slackWebhookEnv: program.slackWebhookEnv ?? null,
      sourceUpdatedAt: seguimiento?.actualizado
        ? new Date(seguimiento.actualizado)
        : null,
    })
    .onConflictDoUpdate({
      target: devPrograms.projectId,
      set: {
        name: program.name,
        repos: program.repos,
        asanaProjectGid: program.asanaProjectGid ?? null,
        ...(program.slackWebhookEnv
          ? { slackWebhookEnv: program.slackWebhookEnv }
          : {}),
        sourceUpdatedAt: seguimiento?.actualizado
          ? new Date(seguimiento.actualizado)
          : null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: devPrograms.id });
  const programId = row.id;
  console.log(
    `Programa «${program.name}» → proyecto «${project.name}» (${client?.name ?? "?"})`,
  );

  // 2. Módulos e hitos
  const moduleIdByCode = new Map<string, string>();
  if (seguimiento) {
    let order = 0;
    for (const m of seguimiento.modulos) {
      const [mod] = await db
        .insert(devModules)
        .values({
          programId,
          code: m.id,
          name: m.nombre,
          objective: m.objetivo ?? null,
          startDate: m.inicio ?? null,
          targetDate: m.entregaObjetivo ?? null,
          progress: m.avance ?? 0,
          criteria: m.criterio ?? null,
          ballOwner: m.pelota?.quien ?? null,
          ballWhat: m.pelota?.que ?? null,
          nextFollowUp: m.proximoSeguimiento ?? null,
          inProduction: m.enProduccion ?? [],
          pending: m.pendientes ?? [],
          sortOrder: order++,
        })
        .onConflictDoUpdate({
          target: [devModules.programId, devModules.code],
          set: {
            name: m.nombre,
            objective: m.objetivo ?? null,
            startDate: m.inicio ?? null,
            targetDate: m.entregaObjetivo ?? null,
            progress: m.avance ?? 0,
            criteria: m.criterio ?? null,
            ballOwner: m.pelota?.quien ?? null,
            ballWhat: m.pelota?.que ?? null,
            nextFollowUp: m.proximoSeguimiento ?? null,
            inProduction: m.enProduccion ?? [],
            pending: m.pendientes ?? [],
            sortOrder: order - 1,
            updatedAt: new Date(),
          },
        })
        .returning({ id: devModules.id });
      moduleIdByCode.set(m.id, mod.id);
      let h = 0;
      for (const hito of m.hitos ?? []) {
        await db
          .insert(devMilestones)
          .values({
            moduleId: mod.id,
            name: hito.nombre,
            status: hito.estado,
            date: hito.fecha ?? null,
            sortOrder: h++,
          })
          .onConflictDoUpdate({
            target: [devMilestones.moduleId, devMilestones.name],
            set: {
              status: hito.estado,
              date: hito.fecha ?? null,
              sortOrder: h - 1,
              updatedAt: new Date(),
            },
          });
      }
    }
    console.log(`Módulos: ${seguimiento.modulos.length}`);

    // 3. Roadmaps (+ rastro en Asana por código en el nombre de la tarea)
    const gidsByCode = new Map<string, string[]>();
    for (const t of asanaTasks) {
      const code = detectRoadmapCode(t.name);
      if (!code) continue;
      gidsByCode.set(code, [...(gidsByCode.get(code) ?? []), t.gid]);
    }
    let maxR = 0;
    let maxN = 0;
    for (const [id, titulo, mes, estado, tipo] of seguimiento.roadmaps) {
      const code = normalizeRoadmapCode(id);
      if (code.startsWith("R")) maxR = Math.max(maxR, Number(code.slice(1)));
      if (code.startsWith("NDes-"))
        maxN = Math.max(maxN, Number(code.slice(5)));
      const moduleId =
        moduleIdByCode.get(code) ??
        (tipo === "modulo" ? moduleIdByCode.get(id) : undefined) ??
        null;
      await db
        .insert(devRoadmaps)
        .values({
          programId,
          code,
          title: titulo,
          month: mes,
          status: estado,
          kind: tipo,
          moduleId,
          asanaTaskGids: gidsByCode.get(code) ?? [],
        })
        .onConflictDoUpdate({
          target: [devRoadmaps.programId, devRoadmaps.code],
          set: {
            title: titulo,
            month: mes,
            status: estado,
            kind: tipo,
            moduleId,
            asanaTaskGids: gidsByCode.get(code) ?? [],
            updatedAt: new Date(),
          },
        });
    }
    await db
      .update(devPrograms)
      .set({
        nextRoadmapNumber: sql`greatest(${devPrograms.nextRoadmapNumber}, ${maxR + 1})`,
        nextModuleNumber: sql`greatest(${devPrograms.nextModuleNumber}, ${maxN + 1})`,
      })
      .where(eq(devPrograms.id, programId));
    console.log(
      `Roadmaps: ${seguimiento.roadmaps.length} (con rastro en Asana: ${[...gidsByCode.keys()].length}) · siguiente R${maxR + 1}, NDes-${String(maxN + 1).padStart(3, "0")}`,
    );

    // 4. Bitácora
    for (const b of seguimiento.bitacora ?? []) {
      await db
        .insert(devLog)
        .values({
          programId,
          date: b.fecha,
          moduleId: b.modulo ? (moduleIdByCode.get(b.modulo) ?? null) : null,
          moduleCode: b.modulo ?? null,
          text: b.texto,
          source: "import",
        })
        .onConflictDoNothing();
    }
    console.log(`Bitácora: ${seguimiento.bitacora?.length ?? 0}`);
  }

  // 5. PR por repo
  const prsDir = resolve(dataRoot, "prs");
  let total = 0;
  if (existsSync(prsDir)) {
    for (const file of readdirSync(prsDir).filter((f) => f.endsWith(".tsv"))) {
      const repo = basename(file, ".tsv");
      const repoConfig = program.repos.find((r) => r.name === repo);
      // En repos que trabajan sobre develop, todo PR a main es una promoción.
      const promotion = (base: string, title: string) =>
        isPromotion(base, null, title) ||
        (base === "main" && repoConfig?.countBase === "non_main");
      const lines = readFileSync(resolve(prsDir, file), "utf8")
        .split("\n")
        .filter(Boolean);
      for (const line of lines) {
        const [month, base, number, ...rest] = line.split("\t");
        const title = rest.join("\t").trim();
        if (!month || !base || !/^\d+$/.test(number ?? "")) {
          console.warn(`  línea ignorada en ${file}: ${line.slice(0, 60)}`);
          continue;
        }
        const roadmapCode = detectRoadmapCode(title);
        await db
          .insert(devPrs)
          .values({
            programId,
            repo,
            number: Number(number),
            title,
            baseBranch: base,
            month,
            roadmapCode,
            moduleId: roadmapCode
              ? (moduleIdByCode.get(roadmapCode) ?? null)
              : null,
            isPromotion: promotion(base, title),
            source: "import",
          })
          .onConflictDoUpdate({
            target: [devPrs.programId, devPrs.repo, devPrs.number],
            set: {
              title,
              baseBranch: base,
              month,
              roadmapCode,
              isPromotion: promotion(base, title),
              updatedAt: new Date(),
            },
          });
        total++;
      }
      console.log(`PR ${repo}: ${lines.length}`);
    }
  }
  console.log(`PR en total: ${total}`);

  const [count] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(devPrs)
    .where(and(eq(devPrs.programId, programId), eq(devPrs.isPromotion, false)));
  console.log(`PR sin promociones: ${count.n}`);

  // 6. Contactos del cliente (solo completa lo que falta; no pisa datos).
  const contactIdByEmail = new Map<string, string>();
  for (const c of program.contacts ?? []) {
    const email = c.email.trim().toLowerCase();
    const [existing] = await db
      .select({
        id: clientContacts.id,
        name: clientContacts.name,
        role: clientContacts.role,
      })
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.clientId, project.clientId),
          ilike(clientContacts.email, email),
        ),
      )
      .limit(1);
    if (existing) {
      if (!existing.name || !existing.role) {
        await db
          .update(clientContacts)
          .set({
            name: existing.name ?? c.name,
            role: existing.role ?? c.role ?? null,
            updatedAt: new Date(),
          })
          .where(eq(clientContacts.id, existing.id));
      }
      contactIdByEmail.set(email, existing.id);
    } else {
      const [row] = await db
        .insert(clientContacts)
        .values({
          clientId: project.clientId,
          name: c.name,
          email,
          role: c.role ?? null,
        })
        .returning({ id: clientContacts.id });
      contactIdByEmail.set(email, row.id);
    }
  }
  if (program.contacts?.length) {
    console.log(`Contactos del cliente: ${program.contacts.length}`);
  }

  // 7. Tipos de reunión (por nombre dentro del programa).
  let order = 0;
  for (const t of program.meetingTypes ?? []) {
    const contactIds = (t.contacts ?? [])
      .map((e) => contactIdByEmail.get(e.trim().toLowerCase()))
      .filter((id): id is string => Boolean(id));
    const values = {
      programId,
      name: t.name,
      description: t.description ?? null,
      cadence: t.cadence ?? "adhoc",
      weekday: t.weekday ?? null,
      timeOfDay: t.timeOfDay ?? null,
      durationMin: t.durationMin ?? 60,
      contactIds,
      producesBacklog: t.producesBacklog ?? true,
      sortOrder: order++,
      updatedAt: new Date(),
    };
    const [existing] = await db
      .select({ id: devMeetingTypes.id })
      .from(devMeetingTypes)
      .where(
        and(
          eq(devMeetingTypes.programId, programId),
          eq(devMeetingTypes.name, t.name),
        ),
      )
      .limit(1);
    if (existing) {
      await db
        .update(devMeetingTypes)
        .set(values)
        .where(eq(devMeetingTypes.id, existing.id));
    } else {
      await db.insert(devMeetingTypes).values(values);
    }
  }
  if (program.meetingTypes?.length) {
    console.log(`Tipos de reunión: ${program.meetingTypes.length}`);
  }

  console.log("");
  console.log(`ID del programa (NOMA_PROGRAM_ID): ${programId}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
