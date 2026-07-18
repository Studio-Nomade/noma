export type StructuredContentItem = {
  title: string;
  description: string;
};

const PREFIX = "noma-list:v1:";

export function serializeStructuredContent(
  items: StructuredContentItem[],
): string {
  const clean = items
    .map((item) => ({
      title: item.title.trim(),
      description: item.description.trim(),
    }))
    .filter((item) => item.title || item.description);
  return clean.length ? `${PREFIX}${JSON.stringify(clean)}` : "";
}

export function parseStructuredContent(
  value: string | null | undefined,
  mode: "stages" | "deliverables",
): StructuredContentItem[] {
  const raw = value?.trim();
  if (!raw) return [];
  if (raw.startsWith(PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(PREFIX.length)) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is Record<string, unknown> =>
            Boolean(item && typeof item === "object"),
          )
          .map((item) => ({
            title: String(item.title ?? "").trim(),
            description: String(item.description ?? "").trim(),
          }))
          .filter((item) => item.title || item.description);
      }
    } catch {
      // Continúa con la migración tolerante del texto histórico.
    }
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (mode === "deliverables") {
    return lines.map((title) => ({
      title: title.replace(/^[-–—•]\s*/, ""),
      description: "",
    }));
  }

  const items: StructuredContentItem[] = [];
  for (const line of lines) {
    const heading = /^(?:nivel|etapa|fase)\s*\d*\s*[.:\-]?\s*(.*)$/i.exec(line);
    if (heading) {
      items.push({ title: heading[1] || line, description: "" });
    } else if (items.length > 0 && !items.at(-1)!.description) {
      items.at(-1)!.description = line;
    } else {
      items.push({ title: line, description: "" });
    }
  }
  return items;
}
