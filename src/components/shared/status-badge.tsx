import { cn } from "@/lib/utils";

type StatusColor = "blue" | "violet" | "emerald" | "amber" | "red" | "slate";

const COLOR_BY_VALUE: Record<string, StatusColor> = {
  // Cliente
  Prospecto: "blue",
  "Cliente activo": "emerald",
  "Cliente recurrente": "emerald",
  // Proyecto (estado)
  Levantamiento: "blue",
  "Brief recibido": "blue",
  "Propuesta en desarrollo": "violet",
  "Propuesta enviada": "violet",
  "En desarrollo": "emerald",
  // Etapa comercial
  "Nuevo lead": "blue",
  "Lead calificado": "blue",
  "Reunión inicial agendada": "violet",
  Diagnóstico: "violet",
  Propuesta: "violet",
  Negociación: "amber",
  Perdido: "red",
  "Stand by": "amber",
  "Traspasado a operación": "emerald",
  // Brief
  Borrador: "slate",
  Completado: "emerald",
  "Sin reunión agendada": "slate",
  "Reunión agendada": "blue",
  "Reunión realizada": "blue",
  "Notas pendientes": "amber",
  "Notas importadas": "violet",
  "Procesando notas": "violet",
  "Brief sugerido": "violet",
  "Brief en revisión": "amber",
  "Brief aprobado": "emerald",
  // Reunión de brief
  Agendada: "blue",
  Realizada: "emerald",
  Cancelada: "red",
  // Propuesta (estado)
  "En revisión": "amber",
  Enviada: "violet",
  Aprobada: "emerald",
  Rechazada: "red",
  // Servicio
  Activo: "emerald",
  Inactivo: "slate",
  // Comunes
  Aprobado: "emerald",
  Pausado: "amber",
  Cerrado: "slate",
  // Prioridad
  Alta: "red",
  Media: "amber",
  Baja: "slate",
  // Finanzas — documento
  EMITIDA: "blue",
  PAGADA: "emerald",
  PARCIAL: "amber",
  VENCIDA: "red",
  ANULADA: "slate",
  CONCILIADA: "emerald",
  // Finanzas — movimiento bancario
  PENDIENTE: "amber",
  CONCILIADO: "emerald",
  IGNORADO: "slate",
  // Finanzas — lote de importación
  BORRADOR: "amber",
  CONFIRMADO: "emerald",
  RECHAZADO: "red",
  // Finanzas — cobranza
  ENVIADO: "emerald",
  ERROR: "red",
};

const STYLE_BY_COLOR: Record<StatusColor, React.CSSProperties> = {
  blue: { color: "var(--status-blue)", background: "var(--status-blue-bg)" },
  violet: {
    color: "var(--status-violet)",
    background: "var(--status-violet-bg)",
  },
  emerald: {
    color: "var(--status-emerald)",
    background: "var(--status-emerald-bg)",
  },
  amber: { color: "var(--status-amber)", background: "var(--status-amber-bg)" },
  red: { color: "var(--status-red)", background: "var(--status-red-bg)" },
  slate: { color: "var(--status-slate)", background: "var(--status-slate-bg)" },
};

export function StatusBadge({
  value,
  size = "sm",
}: {
  value: string;
  size?: "xs" | "sm";
}) {
  const color = COLOR_BY_VALUE[value] ?? "slate";
  return (
    <span
      style={STYLE_BY_COLOR[color]}
      className={cn(
        "inline-flex items-center rounded-full font-medium whitespace-nowrap",
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
      )}
    >
      {value}
    </span>
  );
}
