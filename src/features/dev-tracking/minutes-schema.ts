import { z } from "zod";

/**
 * Salida estructurada de la minuta (Claude, JSON outputs). Módulo puro para
 * poder probar el prompt y el render sin red.
 */

export const BACKLOG_AREAS = [
  "Técnicos",
  "Comerciales",
  "IoT/Telemetría",
] as const;
export const BACKLOG_TYPES = [
  "Mejora funcional",
  "Bug / error",
  "Nuevo desarrollo",
  "Soporte operativo",
  "Infraestructura / deploy",
  "Data / base de datos",
] as const;
export const BACKLOG_ENVIRONMENTS = [
  "Web",
  "APK",
  "Web/APK",
  "No aplica",
] as const;
export const BACKLOG_PRIORITIES = [
  "Normal",
  "Media",
  "Alta",
  "Crítica",
] as const;
export const BACKLOG_DESTINATIONS = [
  "roadmap_en_curso",
  "backlog_general",
  "nuevo",
] as const;

export const minutesOutputSchema = z.object({
  resumen: z
    .string()
    .describe("3 a 8 líneas con lo esencial de la reunión, en español."),
  asistentes: z
    .array(
      z.object({
        nombre: z.string(),
        area: z.string().optional(),
        rol: z.string().optional(),
      }),
    )
    .default([]),
  temas: z
    .array(
      z.object({
        titulo: z.string(),
        detalle: z.string().optional(),
        minuto: z
          .string()
          .optional()
          .describe("Minuto aproximado, p. ej. 00:42"),
      }),
    )
    .default([]),
  acuerdos: z.array(z.string()).default([]),
  decisiones_pendientes: z.array(z.string()).default([]),
  confirmado_sin_desarrollo: z
    .array(z.string())
    .default([])
    .describe(
      "Aclaraciones que NO requieren tareas (evita crear tareas falsas).",
    ),
  cifras_dichas: z
    .array(z.object({ texto: z.string(), contexto: z.string().optional() }))
    .default([])
    .describe("Cifras mencionadas; se marcan como «dicho en la reunión»."),
  solicitudes: z
    .array(
      z.object({
        prefijo: z
          .string()
          .describe(
            "Prefijo del canal o área: OP, CO, TE, BO, IO, RC, EC, GE.",
          ),
        titulo: z.string(),
        detalle: z.string(),
        planteada_por: z.string().optional(),
        area: z.enum(BACKLOG_AREAS),
        tipo: z.enum(BACKLOG_TYPES),
        entorno: z.enum(BACKLOG_ENVIRONMENTS),
        prioridad_sugerida: z.enum(BACKLOG_PRIORITIES),
        evidencia: z.string().optional(),
        destino_sugerido: z.enum(BACKLOG_DESTINATIONS),
        roadmap_o_modulo: z
          .string()
          .optional()
          .describe(
            "Código del roadmap o módulo en curso al que pertenece (R74, NDes-006).",
          ),
        dependencias: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  preguntas_abiertas: z
    .array(
      z.object({
        pregunta: z.string(),
        para: z.string().describe("Persona o área que debe responder."),
        bloquea: z.string().optional(),
      }),
    )
    .default([]),
});

export type MinutesOutput = z.infer<typeof minutesOutputSchema>;

export const MINUTES_SYSTEM_PROMPT = `Eres el asistente de operaciones de Studio Nomade. Recibes la transcripción de una reunión entre el estudio y el equipo de un cliente sobre una plataforma que el estudio desarrolla y opera. Devuelves una minuta estructurada en español.

Reglas:
1. Lenguaje de negocio, no técnico. Nada de PR, ramas, merges ni despliegues.
2. Separa cada pedido como una solicitud propia, incluidos los dichos al pasar y los «lo dejamos en el backlog» que nadie anota: son los que se pierden.
3. Distingue lo que se aclaró y NO requiere desarrollo (va en confirmado_sin_desarrollo) de lo que sí.
4. Toda cifra dicha en la reunión va en cifras_dichas; no la des por verdadera ni la uses como dato en el resumen sin decir «según se dijo».
5. Lo que toque la planificación de Operaciones del cliente (dotación, turnos, rutas, calendario) se anota solo como «sugerencia para revisión de Operaciones», nunca como propuesta de reorganización.
6. No incluyas observaciones sobre el desempeño o la actitud de personas.
7. Área: Técnicos · Comerciales · IoT/Telemetría. Bodega y requisiciones cuentan como Comerciales; infraestructura, como Técnicos.
8. Prefijo de la solicitud según quién la plantea o el canal: OP Operaciones, CO Comercial, TE Técnicos, BO Bodega, IO IoT, RC reunión comercial, EC flujo de facturación con clientes finales, GE gerencia.
9. Si la solicitud pertenece a un módulo o roadmap en curso de la lista de contexto, indícalo en roadmap_o_modulo y destino_sugerido = roadmap_en_curso. Si es de otra área o un módulo futuro, backlog_general. Si es algo nuevo y grande, nuevo.
10. Las preguntas que el cliente debe responder van en preguntas_abiertas con la persona o área.`;

export function minutesUserPrompt(input: {
  meetingTitle: string;
  meetingDate: string;
  programName: string;
  clientName: string;
  attendees: { name?: string; email: string }[];
  modules: { code: string; name: string; ballOwner: string | null }[];
  transcript: string;
}) {
  const modules = input.modules.length
    ? input.modules
        .map(
          (m) =>
            `- ${m.code} · ${m.name}${m.ballOwner ? ` (pelota en ${m.ballOwner})` : ""}`,
        )
        .join("\n")
    : "- (sin módulos en curso)";
  const attendees = input.attendees
    .map((a) => (a.name ? `${a.name} <${a.email}>` : a.email))
    .join(", ");
  return [
    `Reunión: ${input.meetingTitle}`,
    `Fecha: ${input.meetingDate}`,
    `Programa: ${input.programName} · Cliente: ${input.clientName}`,
    `Invitados: ${attendees || "—"}`,
    "",
    "Módulos y roadmaps en curso (para asociar solicitudes):",
    modules,
    "",
    "Transcripción:",
    input.transcript,
  ].join("\n");
}
