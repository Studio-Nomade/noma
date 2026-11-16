/**
 * Diferencias entre el borrador de la IA y la propuesta que el equipo cerró
 * (pura, testeable). Es la materia prima de los aprendizajes automáticos.
 */

export type DiffLine = {
  serviceId: string;
  name: string;
  tier: string;
  quantity: number;
  amount: number | null;
  currency: string | null;
};

export type DiffInput = {
  draftLines: DiffLine[];
  finalLines: DiffLine[];
  draftDiscount: { kind: string; value: number } | null;
  finalDiscount: { kind: string | null; value: number | null } | null;
  draftSections: Record<string, string>;
  finalSections: Record<string, string | null>;
};

const fmt = (amount: number | null, currency: string | null) =>
  amount == null
    ? "s/v"
    : `${String(Math.round(amount * 100) / 100).replace(".", ",")} ${currency ?? "UF"}`;

function similarity(a: string, b: string) {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-záéíóúñü0-9]+/i)
        .filter((w) => w.length > 3),
    );
  const wa = words(a);
  const wb = words(b);
  if (!wa.size && !wb.size) return 1;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return (2 * shared) / (wa.size + wb.size || 1);
}

/** Lista de cambios en lenguaje simple; vacía si el equipo envió tal cual. */
export function describeChanges(input: DiffInput): string[] {
  const changes: string[] = [];
  const draftById = new Map(input.draftLines.map((l) => [l.serviceId, l]));
  const finalById = new Map(input.finalLines.map((l) => [l.serviceId, l]));

  for (const line of input.draftLines) {
    const final = finalById.get(line.serviceId);
    if (!final) {
      changes.push(
        `Quitó «${line.name}» (la IA lo propuso a ${fmt(line.amount, line.currency)} × ${line.quantity}).`,
      );
      continue;
    }
    if (final.tier !== line.tier) {
      changes.push(
        `«${line.name}»: cambió el nivel de ${line.tier} a ${final.tier}.`,
      );
    }
    if (final.quantity !== line.quantity) {
      changes.push(
        `«${line.name}»: cambió la cantidad de ${line.quantity} a ${final.quantity}.`,
      );
    }
    if (
      final.amount != null &&
      line.amount != null &&
      Math.abs(final.amount - line.amount) >= 0.01
    ) {
      changes.push(
        `«${line.name}»: cambió el valor de ${fmt(line.amount, line.currency)} a ${fmt(final.amount, final.currency)}.`,
      );
    }
  }
  for (const line of input.finalLines) {
    if (!draftById.has(line.serviceId)) {
      changes.push(
        `Agregó «${line.name}» a ${fmt(line.amount, line.currency)} × ${line.quantity} (${line.tier}).`,
      );
    }
  }

  const d = input.draftDiscount;
  const f = input.finalDiscount;
  const finalHas = f?.kind && f.value != null && f.value > 0;
  if (d && !finalHas)
    changes.push(`Quitó el descuento propuesto (${d.value} ${d.kind}).`);
  if (!d && finalHas)
    changes.push(`Agregó un descuento de ${f!.value} ${f!.kind}.`);
  if (
    d &&
    finalHas &&
    (d.kind !== f!.kind || Math.abs(d.value - (f!.value ?? 0)) >= 0.01)
  ) {
    changes.push(
      `Cambió el descuento de ${d.value} ${d.kind} a ${f!.value} ${f!.kind}.`,
    );
  }

  for (const [key, draftText] of Object.entries(input.draftSections)) {
    const finalText = input.finalSections[key] ?? "";
    if (!draftText.trim() && !finalText.trim()) continue;
    if (similarity(draftText, finalText) < 0.6) {
      changes.push(
        `Reescribió la sección «${key}». Texto final: ${finalText.replace(/\s+/g, " ").slice(0, 600) || "(vacía)"}`,
      );
    }
  }
  return changes;
}
