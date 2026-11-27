import { z } from "zod";

/**
 * Minuta de una reunión del estudio (Claude, salida estructurada) y su HTML
 * para el Google Doc y el correo. Módulo puro.
 */

export const studioMinutesSchema = z.object({
  resumen: z
    .string()
    .describe(
      "3 a 6 líneas con lo esencial, en español de Chile, tono cordial.",
    ),
  resumen_breve: z
    .string()
    .default("")
    .describe(
      "1 o 2 oraciones para el cuerpo del correo: objetivo de la reunión y resultado.",
    ),
  asistentes: z.array(z.string()).default([]).describe("Nombre (empresa)"),
  temas: z
    .array(z.object({ titulo: z.string(), detalle: z.string() }))
    .default([]),
  acuerdos: z.array(z.string()).default([]),
  tareas: z
    .array(
      z.object({
        tarea: z.string(),
        responsable: z.string().describe("Persona o «Studio Nomade» / cliente"),
        fecha: z.string().nullable().describe("DD-MM-AAAA o null"),
      }),
    )
    .default([]),
  proximos_pasos: z.array(z.string()).default([]),
  proxima_reunion: z.string().nullable().default(null),
  cifras_dichas: z
    .array(z.string())
    .default([])
    .describe("Cifras mencionadas, tal como se dijeron."),
  notas_internas: z
    .array(z.string())
    .default([])
    .describe(
      "Solo para el equipo (riesgos, tensiones, observaciones sobre personas). Nunca van al cliente.",
    ),
});

export type StudioMinutes = z.infer<typeof studioMinutesSchema>;

export const STUDIO_MINUTES_PROMPT = `Eres el asistente de operaciones de Studio Nomade (estudio de diseño y desarrollo en Chile). Recibes las notas y la transcripción de Gemini de una reunión y redactas la minuta que el estudio enviará a los asistentes.

Reglas:
- Español de Chile, claro y profesional. Nada inventado: solo lo que está en las notas.
- Acuerdos y tareas concretos, con responsable y fecha solo si se dijeron (si no, fecha null).
- Las cifras mencionadas van en «cifras_dichas» tal como se dijeron; se marcan «dicho en la reunión».
- Observaciones sobre personas, tensiones o temas sensibles van SOLO en «notas_internas», nunca en el resto.
- «tareas» es el plan de acción: cada tarea parte con un verbo, es verificable y tiene responsable; ordénalas por fecha y prioridad.
- Si se pide un ajuste a una minuta existente, devuelve la minuta completa con el ajuste aplicado.`;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function list(items: string[]) {
  return items.length
    ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
    : "<p>—</p>";
}

/** HTML de la minuta para el cliente (sin notas internas). */
export function renderStudioMinutes(input: {
  title: string;
  dateLabel: string;
  data: StudioMinutes;
  signature: string;
}): { html: string; text: string } {
  const { data } = input;
  const tareas = data.tareas.map(
    (t) => `${t.tarea} — ${t.responsable}${t.fecha ? ` · ${t.fecha}` : ""}`,
  );
  const cifras = data.cifras_dichas.map((c) => `${c} (dicho en la reunión)`);
  const h = (t: string) => `<h3>${esc(t)}</h3>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222;max-width:680px">
<h2>Minuta · ${esc(input.title)}</h2>
<p style="color:#555">${esc(input.dateLabel)}</p>
${data.asistentes.length ? `<p><strong>Asistentes:</strong> ${esc(data.asistentes.join(", "))}</p>` : ""}
<p style="white-space:pre-wrap">${esc(data.resumen)}</p>
${data.temas.length ? h("Temas") + data.temas.map((t) => `<p><strong>${esc(t.titulo)}.</strong> ${esc(t.detalle)}</p>`).join("") : ""}
${h("Acuerdos")}${list(data.acuerdos)}
${h("Tareas")}${list(tareas)}
${h("Próximos pasos")}${list(data.proximos_pasos)}
${data.proxima_reunion ? `${h("Próxima reunión")}<p>${esc(data.proxima_reunion)}</p>` : ""}
${cifras.length ? h("Cifras mencionadas") + list(cifras) : ""}
<p style="margin-top:24px">Saludos,<br>${esc(input.signature)}<br><span style="color:#777">Studio Nomade · Santiago | Madrid | Lisboa</span></p>
</body></html>`;
  const lines = (title: string, items: string[]) =>
    items.length ? ["", `${title}:`, ...items.map((i) => `- ${i}`)] : [];
  const text = [
    `Minuta · ${input.title}`,
    input.dateLabel,
    ...(data.asistentes.length
      ? ["", `Asistentes: ${data.asistentes.join(", ")}`]
      : []),
    "",
    data.resumen,
    ...lines(
      "Temas",
      data.temas.map((t) => `${t.titulo}: ${t.detalle}`),
    ),
    ...lines("Acuerdos", data.acuerdos),
    ...lines("Tareas", tareas),
    ...lines("Próximos pasos", data.proximos_pasos),
    ...(data.proxima_reunion
      ? ["", `Próxima reunión: ${data.proxima_reunion}`]
      : []),
    ...lines("Cifras mencionadas", cifras),
    "",
    "Saludos,",
    input.signature,
    "Studio Nomade · Santiago | Madrid | Lisboa",
  ].join("\n");
  return { html, text };
}

/** Resumen corto para Slack (mrkdwn). */
export function minutesSlackPreview(data: StudioMinutes): string {
  const bullets = (items: string[], max = 5) =>
    items
      .slice(0, max)
      .map((i) => `• ${i}`)
      .join("\n");
  return [
    data.resumen,
    data.acuerdos.length ? `\n*Acuerdos*\n${bullets(data.acuerdos)}` : "",
    data.tareas.length
      ? `\n*Tareas*\n${bullets(
          data.tareas.map(
            (t) =>
              `${t.tarea} — ${t.responsable}${t.fecha ? ` · ${t.fecha}` : ""}`,
          ),
        )}`
      : "",
    data.notas_internas.length
      ? `\n*Solo interno (no va al cliente)*\n${bullets(data.notas_internas, 3)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
