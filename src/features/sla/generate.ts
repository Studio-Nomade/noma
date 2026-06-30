import { BRAND } from "@/lib/brand/brand";

export type SlaParams = {
  lugar?: string;
  rondasCambios?: number;
  plazoAprobacionDias?: number;
  vigenciaMeses?: number;
  condicionesPago?: string;
};

export type SlaInput = {
  clientName: string;
  legalName?: string | null;
  rut?: string | null;
  projectName: string;
  areasLabel: string;
  services: { name: string; area: string }[];
  totalLabel: string;
  params: SlaParams;
};

export type SlaSection = { label: string; body: string };

/**
 * Genera las secciones del SLA a partir de la propuesta + parámetros.
 * Sigue la estructura de los SLA de ejemplo de Studio Nomade (ver
 * docs/sla/sla-analysis.md). Texto base editable después por el equipo.
 */
export function buildSlaSections(input: SlaInput): SlaSection[] {
  const p = input.params;
  const rondas = p.rondasCambios ?? 2;
  const plazoAprob = p.plazoAprobacionDias ?? 3;
  const vigencia = p.vigenciaMeses ?? 6;
  const condiciones =
    p.condicionesPago ?? "50% al inicio y 50% contra entrega final.";
  const cliente = input.legalName || input.clientName;
  const serviciosList = input.services.map((s) => `• ${s.name}`).join("\n");

  return [
    {
      label: "1. Información General",
      body:
        `El presente Acuerdo de Nivel de Servicio (SLA) regula la prestación de ` +
        `servicios entre ${BRAND.name} SpA y ${cliente}` +
        `${input.rut ? ` (RUT ${input.rut})` : ""}, en el marco del proyecto ` +
        `"${input.projectName}" (${input.areasLabel}). El valor total acordado ` +
        `es ${input.totalLabel}, según la propuesta comercial aprobada.`,
    },
    {
      label: "2. Esquema de Responsabilidades",
      body:
        `Studio Nomade se compromete a ejecutar los servicios con estándares ` +
        `profesionales, en los plazos acordados. El cliente se compromete a ` +
        `entregar oportunamente la información, materiales y aprobaciones ` +
        `necesarias (plazo de respuesta sugerido: ${plazoAprob} días hábiles), ` +
        `y a designar una contraparte responsable.`,
    },
    {
      label: "3. Descripción de los Servicios",
      body: `Los servicios incluidos en este acuerdo son:\n${serviciosList}`,
    },
    {
      label: "4. Objetivos de Nivel de Servicio (SLOs)",
      body:
        `Tiempos de respuesta a consultas: 1–2 días hábiles. Entregas según el ` +
        `cronograma del proyecto. Cada entregable se somete a aprobación del ` +
        `cliente antes de avanzar a la siguiente etapa.`,
    },
    {
      label: "5. Proceso de Trabajo y Aprobación",
      body:
        `Levantamiento de información → desarrollo interno → presentación de ` +
        `avance → revisión del cliente → consolidación de comentarios → ajustes ` +
        `→ aprobación final → cierre de etapa y entrega correspondiente.`,
    },
    {
      label: "6. Cronograma General",
      body:
        `El cronograma se rige por las etapas y fechas definidas en la propuesta ` +
        `aprobada. Los plazos pueden ajustarse por demoras del cliente en ` +
        `entregas o aprobaciones.`,
    },
    {
      label: "7. Rondas de Cambios",
      body:
        `Se contemplan ${rondas} rondas de cambios por entregable. Ajustes ` +
        `adicionales o cambios de alcance se cotizan por separado.`,
    },
    {
      label: "8. Exclusiones",
      body:
        `Queda excluido todo servicio, pieza o desarrollo no especificado ` +
        `explícitamente en la propuesta aprobada. Costos de terceros (imprenta, ` +
        `hosting, licencias, talento, etc.) no están incluidos salvo indicación.`,
    },
    {
      label: "9. Condiciones Comerciales",
      body: `Forma de pago: ${condiciones} Valores expresados en la moneda de la propuesta.`,
    },
    {
      label: "10. Procedimientos de Modificación y Rescisión",
      body:
        `Cualquier modificación al presente SLA debe constar por escrito y ser ` +
        `aceptada por ambas partes. La rescisión anticipada considera el pago de ` +
        `los servicios efectivamente ejecutados a la fecha.`,
    },
    {
      label: "11. Vigencia y Aceptación",
      body:
        `Este acuerdo tiene una vigencia de ${vigencia} meses desde su firma. ` +
        `La aceptación de la propuesta y/o el pago inicial constituyen aceptación ` +
        `de estas condiciones.` +
        `${p.lugar ? ` Suscrito en ${p.lugar}.` : ""}`,
    },
  ];
}
