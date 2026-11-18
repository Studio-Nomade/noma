import type { MinutesOutput } from "./minutes-schema";

/**
 * Correo de minuta (borrador en la casilla de operaciones). Lenguaje de
 * negocio: sin PR, ramas ni despliegues. Las solicitudes van con su código
 * para que el equipo pueda referirse a ellas. Módulo puro.
 */

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function list(items: string[]) {
  return items.length
    ? `<ul style="margin:4px 0 12px 18px;padding:0">${items
        .map((i) => `<li style="margin:2px 0">${esc(i)}</li>`)
        .join("")}</ul>`
    : `<p style="margin:4px 0 12px;color:#777">—</p>`;
}

export function renderMinutesEmail(input: {
  meetingTitle: string;
  meetingDate: string;
  programName: string;
  data: MinutesOutput;
  codes: string[];
}) {
  const { data } = input;
  const solicitudes = data.solicitudes.map(
    (s, i) => `${input.codes[i] ?? ""} · ${s.titulo} (${s.prioridad_sugerida})`,
  );
  const preguntas = data.preguntas_abiertas.map(
    (q) => `${q.pregunta} — ${q.para}`,
  );
  const cifras = data.cifras_dichas.map(
    (c) =>
      `${c.texto}${c.contexto ? ` (${c.contexto})` : ""} · dicho en la reunión, por verificar`,
  );

  const h = (t: string) =>
    `<h3 style="margin:18px 0 4px;font-size:14px;font-weight:600">${esc(t)}</h3>`;
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222;max-width:680px;margin:0 auto;padding:16px">
<p style="margin:0 0 4px;font-size:12px;color:#777">${esc(input.programName)}</p>
<h2 style="margin:0 0 2px;font-size:18px">Minuta · ${esc(input.meetingTitle)}</h2>
<p style="margin:0 0 16px;color:#555">${esc(input.meetingDate)}</p>
<p style="white-space:pre-wrap">${esc(data.resumen)}</p>
${h("Acuerdos")}${list(data.acuerdos)}
${h("Decisiones pendientes")}${list(data.decisiones_pendientes)}
${h("Qué se pidió")}${list(solicitudes)}
${h("Qué necesitamos de ustedes")}${list(preguntas)}
${data.confirmado_sin_desarrollo.length ? h("Aclaraciones (no requieren cambios)") + list(data.confirmado_sin_desarrollo) : ""}
${cifras.length ? h("Cifras mencionadas") + list(cifras) : ""}
<p style="margin-top:24px;color:#555">Saludos,<br>Studio Nomade · Operaciones</p>
</body></html>`;

  const text = [
    `Minuta · ${input.meetingTitle}`,
    input.meetingDate,
    "",
    data.resumen,
    "",
    "Acuerdos:",
    ...data.acuerdos.map((a) => `- ${a}`),
    "",
    "Decisiones pendientes:",
    ...data.decisiones_pendientes.map((a) => `- ${a}`),
    "",
    "Qué se pidió:",
    ...solicitudes.map((a) => `- ${a}`),
    "",
    "Qué necesitamos de ustedes:",
    ...preguntas.map((a) => `- ${a}`),
    ...(data.confirmado_sin_desarrollo.length
      ? [
          "",
          "Aclaraciones (no requieren cambios):",
          ...data.confirmado_sin_desarrollo.map((a) => `- ${a}`),
        ]
      : []),
    ...(cifras.length
      ? ["", "Cifras mencionadas:", ...cifras.map((a) => `- ${a}`)]
      : []),
    "",
    "Saludos,",
    "Studio Nomade · Operaciones",
  ].join("\n");

  return { html, text };
}
