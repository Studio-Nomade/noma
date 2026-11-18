import { cn } from "@/lib/utils";

type Tone = "blue" | "violet" | "emerald" | "amber" | "red" | "slate";

const TONE_BY_STATUS: Record<string, Tone> = {
  // hitos
  en_prod: "emerald",
  pr_abierto: "violet",
  en_desarrollo: "blue",
  pendiente: "slate",
  bloqueado: "red",
  // roadmaps
  parcial: "amber",
  // tipos
  modulo: "violet",
  mejora: "blue",
  correccion: "amber",
};

const LABELS: Record<string, string> = {
  en_prod: "En producción",
  pr_abierto: "PR abierto",
  en_desarrollo: "En desarrollo",
  pendiente: "Pendiente",
  bloqueado: "Bloqueado",
  parcial: "Parcial",
  modulo: "Módulo",
  mejora: "Mejora",
  correccion: "Corrección",
};

export function devStatusLabel(value: string) {
  return LABELS[value] ?? value;
}

/** Punto + etiqueta para estados del seguimiento (hitos, roadmaps, tipos). */
export function DevBadge({
  value,
  size = "sm",
  className,
}: {
  value: string;
  size?: "xs" | "sm";
  className?: string;
}) {
  const tone = TONE_BY_STATUS[value] ?? "slate";
  return (
    <span
      style={{
        color: `var(--status-${tone})`,
        background: `var(--status-${tone}-bg)`,
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: "currentColor" }}
      />
      {devStatusLabel(value)}
    </span>
  );
}
