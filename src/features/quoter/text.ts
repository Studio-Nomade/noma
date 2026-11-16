import { richTextBlocks } from "@/features/services/rich-text";

/** Texto enriquecido de Noma (o legado) → texto plano compacto para prompts. */
export function richTextPlain(value: string | null | undefined): string {
  const raw = value?.trim();
  if (!raw) return "";
  if (!raw.startsWith("noma-")) return raw.replace(/\s+/g, " ");
  return richTextBlocks(raw, "deliverables")
    .map((block) =>
      block.runs
        .map((run) => run.text)
        .join("")
        .trim(),
    )
    .filter(Boolean)
    .join("; ");
}
