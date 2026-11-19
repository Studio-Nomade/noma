import type { NewRequest } from "./result-schema";

/**
 * Solicitudes que llegan fuera de una reunión (WhatsApp, correo, llamada) y
 * que el arquitecto implementa directo: `POST …/resultados` con
 * `solicitudes_nuevas`. Módulo puro: se prueba sin base de datos.
 */

/** Área del tablero de Asana (Técnicos · Comerciales · IoT/Telemetría). */
export function boardArea(area: string | undefined): string | null {
  if (!area) return null;
  const a = area.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (/^(iot|telemetr)/.test(a)) return "IoT/Telemetría";
  // Bodega y requisiciones cuentan como Comerciales (igual que en las minutas).
  if (/^(comercial|bodega|requisic|venta|cobranza|factur)/.test(a))
    return "Comerciales";
  if (/^(tecnic|operaci|infra|mantenc|terreno)/.test(a)) return "Técnicos";
  return area.trim();
}

const VERDICT_TYPE: Record<string, string> = {
  bug: "Bug / error",
  requiere_desarrollo: "Mejora funcional",
};

const ORIGIN_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  correo: "Correo",
  llamada: "Llamada",
  reunion: "Reunión",
  otro: "Otro",
};

function dmy(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}`;
}

/** Línea de origen que queda como evidencia («WhatsApp · 19-11-2026»). */
export function originLine(s: Pick<NewRequest, "origen" | "fecha">) {
  return `${ORIGIN_LABEL[s.origen] ?? s.origen}${s.fecha ? ` · ${dmy(s.fecha)}` : ""}`;
}

/**
 * Valores de la fila `dev_backlog` para una solicitud nueva. `roadmapCode`
 * llega ya normalizado (el propio de la solicitud o el principal).
 */
export function newRequestValues(s: NewRequest, roadmapCode: string | null) {
  const evidence = [originLine(s), s.evidencia].filter(Boolean).join(" · ");
  return {
    code: s.id,
    title: s.titulo,
    detail: s.detalle ?? null,
    raisedBy: s.solicitante ?? null,
    area: boardArea(s.area),
    type: s.tipo ?? VERDICT_TYPE[s.veredicto] ?? null,
    environment: s.entorno ?? null,
    priority: s.prioridad ?? "Normal",
    evidence,
    destination: roadmapCode ? "roadmap_en_curso" : "backlog_general",
    roadmapCode: s.veredicto === "ya_existe" ? null : roadmapCode,
    // Ya la revisó el arquitecto: entra como verificada, con su veredicto.
    status: "verificada",
    verdict: s.veredicto,
    verdictNote: s.nota ?? null,
    milestone: s.hito ?? null,
    stage: s.estado ?? null,
    asanaTaskGid: s.asana_gid ?? null,
  };
}
