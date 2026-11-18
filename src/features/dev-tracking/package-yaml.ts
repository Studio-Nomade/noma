/**
 * Serializador YAML mínimo (sin dependencias) para el paquete que Noma le
 * entrega al arquitecto. Soporta objetos, arreglos, strings, números, booleanos
 * y null; los strings con saltos de línea van como bloque literal `|`.
 */

type Scalar = string | number | boolean | null | undefined;
type Node = Scalar | Node[] | { [key: string]: Node };

const PLAIN_RE = /^[A-Za-z0-9 _.\-:/()áéíóúñÁÉÍÓÚÑ·,¿?¡!%]+$/;
const RESERVED = /^(true|false|null|yes|no|on|off|~)$/i;

function scalar(value: Scalar): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  const s = value;
  if (
    s.length > 0 &&
    PLAIN_RE.test(s) &&
    !RESERVED.test(s) &&
    !/^[\d.+-]/.test(s) &&
    !/: |#| $|^ /.test(s) &&
    !s.endsWith(":")
  ) {
    return s;
  }
  return JSON.stringify(s);
}

function render(node: Node, indent: number): string[] {
  const pad = " ".repeat(indent);
  if (Array.isArray(node)) {
    if (node.length === 0) return [`${pad}[]`];
    const lines: string[] = [];
    for (const item of node) {
      if (item !== null && typeof item === "object") {
        const inner = render(item, indent + 2);
        lines.push(`${pad}- ${inner[0].trimStart()}`);
        lines.push(...inner.slice(1));
      } else {
        lines.push(`${pad}- ${scalar(item as Scalar)}`);
      }
    }
    return lines;
  }
  if (node !== null && typeof node === "object") {
    const entries = Object.entries(node).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return [`${pad}{}`];
    const lines: string[] = [];
    for (const [key, value] of entries) {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${pad}${key}: []`);
        } else {
          lines.push(`${pad}${key}:`);
          lines.push(...render(value, indent + 2));
        }
      } else if (value !== null && typeof value === "object") {
        lines.push(`${pad}${key}:`);
        lines.push(...render(value, indent + 2));
      } else if (typeof value === "string" && value.includes("\n")) {
        lines.push(`${pad}${key}: |`);
        for (const l of value.replace(/\s+$/, "").split("\n")) {
          lines.push(`${pad}  ${l}`);
        }
      } else {
        lines.push(`${pad}${key}: ${scalar(value as Scalar)}`);
      }
    }
    return lines;
  }
  return [`${pad}${scalar(node)}`];
}

export function toYaml(node: Node): string {
  return render(node, 0).join("\n") + "\n";
}

export type PackageItem = {
  id: string;
  titulo: string;
  detalle: string | null;
  planteada_por: string | null;
  area: string | null;
  tipo: string | null;
  entorno: string | null;
  prioridad: string;
  evidencia: string | null;
  destino_sugerido: string | null;
  roadmap: string | null;
  dependencias: string[];
  asana_gid: string | null;
};

export function buildPackageYaml(input: {
  code: string;
  origen: string;
  titulo: string;
  fecha: string;
  programa: string;
  cliente: string;
  participantes: { nombre: string; area?: string }[];
  transcripcion: string | null;
  resumen: string | null;
  confirmado_sin_desarrollo: string[];
  solicitudes: PackageItem[];
  preguntas_abiertas: {
    pregunta: string;
    para: string | null;
    desde: string;
  }[];
  prioridad_confirmada_por_sebastian: boolean;
  resultado_endpoint: string;
}) {
  return toYaml({
    paquete: {
      id: input.code,
      origen: input.origen,
      titulo: input.titulo,
      fecha: input.fecha,
      programa: input.programa,
      cliente: input.cliente,
      participantes: input.participantes.map((p) => ({
        nombre: p.nombre,
        ...(p.area ? { area: p.area } : {}),
      })),
      fuente: { transcripcion: input.transcripcion ?? null },
      resumen: input.resumen ?? "",
      confirmado_sin_desarrollo: input.confirmado_sin_desarrollo,
      solicitudes: input.solicitudes.map((s) => ({
        id: s.id,
        titulo: s.titulo,
        detalle: s.detalle ?? "",
        planteada_por: s.planteada_por ?? null,
        area: s.area ?? null,
        tipo: s.tipo ?? null,
        entorno: s.entorno ?? null,
        prioridad: s.prioridad,
        evidencia: s.evidencia ?? null,
        destino_sugerido: s.destino_sugerido ?? null,
        roadmap: s.roadmap ?? null,
        dependencias: s.dependencias,
        asana_gid: s.asana_gid ?? null,
      })),
      preguntas_abiertas: input.preguntas_abiertas,
      prioridad_confirmada_por_sebastian:
        input.prioridad_confirmada_por_sebastian,
      resultado: {
        endpoint: input.resultado_endpoint,
        formato:
          "POST JSON {paquete, roadmap, solicitudes:[{id, veredicto, hito, asana_gid, nota}], preguntas_nuevas:[{pregunta, para, bloquea}], hitos:[{modulo, nombre, estado, fecha}], bitacora:[{modulo, texto}]}",
      },
    },
  });
}
