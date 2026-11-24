import "server-only";

import { and, desc, eq, gte, ilike, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  asanaSlackLinks,
  clientRequests,
  clients,
  cobranzaCases,
  finContacts,
  finDocuments,
  projects,
} from "@/db/schema";
import { listOpenProjectTasks } from "@/features/asana/asana";
import {
  getTodayBriefing,
  type BriefingUser,
} from "@/features/assistant/briefing";
import { addDays, studioDay } from "@/features/assistant/config";
import { listCalendarEvents } from "@/features/google/calendar";
import { toNum } from "@/features/finance/helpers";
import type { ClaudeTool } from "@/lib/ai/claude-tools";

/**
 * Herramientas de solo lectura de Noma en Slack (entrega 1A). Ninguna escribe
 * ni envía nada: las acciones con aprobación llegan en la entrega 1B.
 */

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function slackAgentTools(user: BriefingUser): ClaudeTool[] {
  return [
    {
      name: "resumen_del_dia",
      description:
        "Resumen de hoy de la persona que conversa: prioridades, reuniones y conteos de Asana, correo y Slack (el mismo resumen de las 08:30 en Noma).",
      input_schema: { type: "object", properties: {} },
      run: async () => {
        const b = await getTodayBriefing(user);
        return {
          dia: b.day,
          titular: b.headline,
          prioridades: b.priorities.map((p) => ({
            titulo: p.title,
            por_que: p.why,
            link: p.url,
          })),
          reuniones: b.meetings.map((m) => ({
            titulo: m.title,
            inicio: m.startsAt,
            meet: m.meetLink,
          })),
          conteos: b.counts,
        };
      },
    },
    {
      name: "agenda",
      description:
        "Reuniones del Google Calendar de la persona que conversa entre dos fechas (YYYY-MM-DD, zona Santiago). Por defecto, hoy y mañana.",
      input_schema: {
        type: "object",
        properties: {
          desde: { type: "string", description: "YYYY-MM-DD" },
          hasta: { type: "string", description: "YYYY-MM-DD (incluido)" },
        },
      },
      run: async (input) => {
        const desde = str(input.desde) ?? studioDay();
        const hasta = str(input.hasta) ?? addDays(desde, 1);
        const from = new Date(`${desde}T00:00:00-03:00`);
        const to = new Date(`${addDays(hasta, 1)}T00:00:00-03:00`);
        const res = await listCalendarEvents(user.id, from, to);
        if (!res.connected) return { conectado: false, motivo: res.reason };
        return res.events.slice(0, 40).map((e) => ({
          titulo: e.summary,
          inicio: e.startsAt,
          fin: e.endsAt,
          todo_el_dia: e.allDay,
          asistentes: e.attendeeEmails.length,
          meet: e.meetLink ?? null,
        }));
      },
    },
    {
      name: "tareas_asana",
      description:
        "Tareas abiertas de Asana en los proyectos activos del estudio. Filtra por proyecto (parte del nombre), responsable (parte del nombre) y/o vencimiento. Devuelve nombre, proyecto, responsable, fecha, sección, Estado y link.",
      input_schema: {
        type: "object",
        properties: {
          proyecto: {
            type: "string",
            description:
              "Parte del nombre del proyecto, p. ej. «Equifax» o «Box»",
          },
          responsable: {
            type: "string",
            description: "Parte del nombre del responsable, p. ej. «Javiera»",
          },
          vence_hasta: {
            type: "string",
            description:
              "YYYY-MM-DD: solo tareas con fecha hasta ese día (incluye atrasadas)",
          },
          sin_fecha: {
            type: "boolean",
            description:
              "Incluir tareas sin fecha (por defecto no si hay vence_hasta)",
          },
        },
      },
      run: async (input) => {
        const proyecto = str(input.proyecto);
        const responsable = str(input.responsable);
        const venceHasta = str(input.vence_hasta);
        const links = await db
          .select({
            gid: asanaSlackLinks.asanaProjectGid,
            name: asanaSlackLinks.asanaProjectName,
          })
          .from(asanaSlackLinks)
          .where(eq(asanaSlackLinks.active, true));
        const targets = links.filter(
          (l) => !proyecto || fold(l.name).includes(fold(proyecto)),
        );
        if (!targets.length)
          return { error: "No encontré un proyecto activo con ese nombre." };
        const out: Record<string, unknown>[] = [];
        for (const p of targets.slice(0, 8)) {
          const tasks = await listOpenProjectTasks(p.gid);
          for (const t of tasks) {
            if (
              responsable &&
              !fold(t.assignee?.name ?? "").includes(fold(responsable))
            )
              continue;
            if (venceHasta) {
              if (!t.due_on && !input.sin_fecha) continue;
              if (t.due_on && t.due_on > venceHasta) continue;
            }
            out.push({
              tarea: t.name,
              proyecto: p.name,
              responsable: t.assignee?.name ?? "Sin responsable",
              vence: t.due_on,
              seccion: t.memberships?.[0]?.section?.name ?? null,
              estado:
                t.custom_fields?.find((f) => f.name === "Estado")
                  ?.display_value ?? null,
              link: t.permalink_url,
            });
          }
        }
        out.sort((a, b) =>
          String(a.vence ?? "9999").localeCompare(String(b.vence ?? "9999")),
        );
        return { total: out.length, tareas: out.slice(0, 60) };
      },
    },
    {
      name: "por_cobrar",
      description:
        "Facturas de venta abiertas (sin pagar, sin anular y sin ceder a factoring) con cliente, emisión, vencimiento, días de atraso y saldo, según Finanzas en Noma.",
      input_schema: {
        type: "object",
        properties: {
          cliente: {
            type: "string",
            description: "Parte del nombre del cliente",
          },
        },
      },
      run: async (input) => {
        const cliente = str(input.cliente);
        const rows = await db
          .select({
            folio: finDocuments.folio,
            emision: finDocuments.fechaEmision,
            vence: finDocuments.fechaVencimiento,
            total: finDocuments.total,
            conciliado: finDocuments.montoConciliado,
            nombre: finContacts.name,
          })
          .from(finDocuments)
          .leftJoin(finContacts, eq(finContacts.id, finDocuments.contactId))
          .leftJoin(
            cobranzaCases,
            eq(cobranzaCases.documentId, finDocuments.id),
          )
          .where(
            and(
              eq(finDocuments.direction, "VENTA"),
              eq(finDocuments.type, "FACTURA_VENTA"),
              eq(finDocuments.recordStatus, "ACTIVO"),
              inArray(finDocuments.status, ["EMITIDA", "VENCIDA", "PARCIAL"]),
              isNull(cobranzaCases.factoringAt),
              cliente ? ilike(finContacts.name, `%${cliente}%`) : undefined,
            ),
          );
        const today = studioDay();
        const facturas = rows
          .map((r) => {
            const saldo = toNum(r.total) - toNum(r.conciliado);
            const venc = r.vence ? String(r.vence) : null;
            const atraso = venc
              ? Math.max(
                  0,
                  Math.round(
                    (new Date(today).getTime() - new Date(venc).getTime()) /
                      864e5,
                  ),
                )
              : null;
            return {
              folio: r.folio,
              cliente: r.nombre,
              emision: String(r.emision),
              vence: venc,
              dias_atraso: atraso,
              saldo,
            };
          })
          .filter((f) => f.saldo > 0)
          .sort((a, b) => a.emision.localeCompare(b.emision));
        return {
          total_clp: facturas.reduce((s, f) => s + f.saldo, 0),
          cantidad: facturas.length,
          facturas,
        };
      },
    },
    {
      name: "buscar_cliente",
      description:
        "Busca clientes en Noma por nombre y devuelve contacto, estado y proyectos.",
      input_schema: {
        type: "object",
        properties: { nombre: { type: "string" } },
        required: ["nombre"],
      },
      run: async (input) => {
        const nombre = str(input.nombre) ?? "";
        const found = await db
          .select({
            id: clients.id,
            nombre: clients.companyName,
            contacto: clients.contactName,
            correo: clients.email,
            estado: clients.status,
          })
          .from(clients)
          .where(
            or(
              ilike(clients.companyName, `%${nombre}%`),
              ilike(clients.contactName, `%${nombre}%`),
            ),
          )
          .limit(5);
        const projs = found.length
          ? await db
              .select({
                clientId: projects.clientId,
                nombre: projects.name,
                estado: projects.status,
              })
              .from(projects)
              .where(
                inArray(
                  projects.clientId,
                  found.map((c) => c.id),
                ),
              )
          : [];
        return found.map((c) => ({
          ...c,
          proyectos: projs
            .filter((p) => p.clientId === c.id)
            .map((p) => ({ nombre: p.nombre, estado: p.estado })),
        }));
      },
    },
    {
      name: "solicitudes_recientes",
      description:
        "Solicitudes de clientes que entraron a Noma (correo o WhatsApp) en los últimos días, con folio, cliente, asunto y estado.",
      input_schema: {
        type: "object",
        properties: {
          dias: {
            type: "number",
            description: "Días hacia atrás (por defecto 7)",
          },
        },
      },
      run: async (input) => {
        const dias = Math.min(Math.max(Number(input.dias) || 7, 1), 31);
        const since = new Date(Date.now() - dias * 864e5);
        const rows = await db
          .select({
            folio: clientRequests.folio,
            asunto: clientRequests.emailSubject,
            resumen: clientRequests.normalizedSummary,
            estado: clientRequests.status,
            cliente: clients.companyName,
            creada: clientRequests.createdAt,
          })
          .from(clientRequests)
          .leftJoin(clients, eq(clients.id, clientRequests.clientId))
          .where(gte(clientRequests.createdAt, since))
          .orderBy(desc(clientRequests.createdAt))
          .limit(40);
        return rows.map((r) => ({
          ...r,
          resumen: r.resumen?.slice(0, 200) ?? null,
          creada: r.creada?.toISOString(),
        }));
      },
    },
  ];
}
