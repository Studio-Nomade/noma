import Mustache from "mustache";
import { EMAIL_PARTIALS } from "@/features/email/email-templates/markup";
import {
  emailAssetsBase,
  escapeHtml,
} from "@/features/email/email-templates/render";
import type { StudioMinutes } from "./minutes-format";

/**
 * Cuerpo del correo de minuta: corto y centrado en el plan de acción. La
 * minuta completa va en el PDF adjunto. Usa la cabecera y el cierre de los
 * correos de Noma. Módulo puro.
 */

const F = "font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;";

// Cabecera de los correos de Noma con la etiqueta de minuta.
const INICIO = EMAIL_PARTIALS.inicio.replace(
  "Solicitudes · {{cliente}}",
  "Minuta · {{cliente}}",
);

function section(title: string, subtitle: string, body: string) {
  return `<tr>
    <td class="px" style="padding:36px 40px 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="stack stack-pad" width="34%" valign="top" style="padding-right:20px;">
            <div style="${F}font-size:22px;line-height:28px;font-weight:600;color:#555555;">${title}</div>
            <div style="${F}font-size:16px;line-height:22px;font-weight:200;color:#888888;">${subtitle}</div>
          </td>
          <td class="stack" width="66%" valign="top" style="${F}font-size:15px;line-height:24px;color:#333333;">${body}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

const TEMPLATE = `{{> inicio}}
  <tr>
    <td class="px" style="padding:32px 40px 0 40px;${F}font-size:16px;line-height:25px;color:#333333;">
      {{saludo}} gracias por la reunión. Te dejamos el <strong style="font-weight:600;color:#000000;">plan de acción</strong> que acordamos; la minuta completa va en el <strong style="font-weight:600;color:#000000;">PDF adjunto</strong>.
    </td>
  </tr>
  {{#resumen}}
  ${section("En breve", "La reunión", "{{resumen}}")}
  {{/resumen}}
  {{#tiene_tareas}}
  ${section(
    "Plan de acción",
    "Qué, quién y cuándo",
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      {{#tareas}}
      <tr>
        <td width="46" valign="top" style="${F}font-size:26px;line-height:26px;font-weight:200;color:#B0B0B0;padding-bottom:16px;">{{numero}}</td>
        <td valign="top" style="${F}font-size:15px;line-height:22px;color:#333333;padding-bottom:16px;">
          <strong style="font-weight:600;color:#000000;">{{tarea}}</strong><br>
          <span style="font-size:13px;color:#888888;">{{responsable}}{{#fecha}} · {{fecha}}{{/fecha}}</span>
        </td>
      </tr>
      {{/tareas}}
    </table>`,
  )}
  {{/tiene_tareas}}
  {{#tiene_acuerdos}}
  ${section(
    "Acuerdos",
    "Lo que quedó definido",
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      {{#acuerdos}}<tr><td width="18" valign="top" style="${F}font-size:15px;line-height:22px;color:#B0B0B0;padding-bottom:8px;">&mdash;</td><td valign="top" style="${F}font-size:15px;line-height:22px;color:#333333;padding:0 0 8px 6px;">{{.}}</td></tr>{{/acuerdos}}
    </table>`,
  )}
  {{/tiene_acuerdos}}
  {{#proxima}}
  ${section("Próxima reunión", "Seguimiento", "{{proxima}}")}
  {{/proxima}}
{{> cierre}}`;

const MAX_AGREEMENTS = 4;

export function renderMinutesEmail(input: {
  client: string;
  title: string;
  dateLabel: string;
  data: StudioMinutes;
  signature: string;
  /** Correo de quien envía (firma del pie). */
  senderEmail: string;
  greetingNames?: string[];
  now?: Date;
  assetsBase?: string;
}): { html: string; text: string } {
  const { data } = input;
  const brief =
    data.resumen_breve?.trim() || data.resumen.split(/(?<=\.)\s+/)[0];
  const names = (input.greetingNames ?? []).filter(Boolean);
  const saludo = names.length
    ? `Hola ${names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names.at(-1)}` : names[0]},`
    : "Hola,";
  const tareas = data.tareas.map((t, i) => ({
    numero: String(i + 1).padStart(2, "0"),
    tarea: t.tarea,
    responsable: t.responsable,
    fecha: t.fecha ?? "",
  }));
  const acuerdos = data.acuerdos.slice(0, MAX_AGREEMENTS);
  const view = {
    cliente: input.client,
    folio: input.dateLabel,
    referencia: input.title,
    titulo: "Minuta",
    preheader: brief,
    mostrar_estado: false,
    pasos: [],
    assets_base: input.assetsBase ?? emailAssetsBase(),
    anio: String((input.now ?? new Date()).getFullYear()),
    saludo,
    resumen: brief,
    tiene_tareas: tareas.length > 0,
    tareas,
    tiene_acuerdos: acuerdos.length > 0,
    acuerdos,
    proxima: data.proxima_reunion ?? "",
    cierre: "Quedamos atentos.",
    firma_nombre: input.signature,
    alias_solicitudes: input.senderEmail,
    nota_hilo:
      "La minuta completa va adjunta en PDF. Si algo no calza, respóndenos este correo y la corregimos.",
    pie: `Minuta de «${input.title}» · ${input.dateLabel}.`,
  };
  const html = Mustache.render(
    TEMPLATE,
    view,
    { ...EMAIL_PARTIALS, inicio: INICIO },
    { escape: escapeHtml },
  );
  const text = [
    saludo,
    "",
    "Gracias por la reunión. Te dejamos el plan de acción que acordamos; la minuta completa va en el PDF adjunto.",
    "",
    brief,
    ...(tareas.length
      ? [
          "",
          "Plan de acción:",
          ...tareas.map(
            (t) =>
              `${t.numero}. ${t.tarea} — ${t.responsable}${t.fecha ? ` · ${t.fecha}` : ""}`,
          ),
        ]
      : []),
    ...(acuerdos.length
      ? ["", "Acuerdos:", ...acuerdos.map((a) => `- ${a}`)]
      : []),
    ...(data.proxima_reunion
      ? ["", `Próxima reunión: ${data.proxima_reunion}`]
      : []),
    "",
    "Quedamos atentos.",
    `${input.signature} · Studio Nomade`,
    "Santiago | Madrid | Lisboa",
  ].join("\n");
  return { html, text };
}
