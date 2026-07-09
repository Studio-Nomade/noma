import type { DriveFile } from "./drive";

/**
 * Matching sugerido de notas de reunión (Opción A del spec). Compara documentos
 * recientes de Drive con el contexto de la oportunidad/reunión y devuelve
 * candidatos rankeados. Función pura y determinista (testeable sin red).
 */

export type MatchContext = {
  clientName: string;
  projectName: string;
  meetingTitle?: string | null;
  meetingDate?: string | null; // ISO
  organizerEmail?: string | null;
  participantEmails?: string[];
};

export type NoteCandidate = {
  fileId: string;
  name: string;
  webViewLink: string | null;
  modifiedTime: string;
  score: number;
  reasons: string[];
};

export type MatchResult = {
  status: "auto" | "candidates" | "not_found";
  candidates: NoteCandidate[];
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Tokens significativos (>3 chars) de un texto. */
function tokens(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
}

export function matchNotes(
  files: DriveFile[],
  ctx: MatchContext,
): MatchResult {
  const clientTokens = tokens(ctx.clientName);
  const projectTokens = tokens(ctx.projectName);
  const titleTokens = ctx.meetingTitle ? tokens(ctx.meetingTitle) : [];
  const meetingTime = ctx.meetingDate ? new Date(ctx.meetingDate).getTime() : null;

  const scored: NoteCandidate[] = files.map((f) => {
    const name = norm(f.name);
    const reasons: string[] = [];
    let score = 0;

    if (clientTokens.length && clientTokens.some((t) => name.includes(t))) {
      score += 40;
      reasons.push("nombre del cliente");
    }
    if (projectTokens.length && projectTokens.some((t) => name.includes(t))) {
      score += 35;
      reasons.push("nombre de la oportunidad");
    }
    if (titleTokens.length && titleTokens.some((t) => name.includes(t))) {
      score += 20;
      reasons.push("título del evento");
    }
    // Palabras típicas de notas automáticas.
    if (/notas|notes|gemini|meet|reunion|reunión|minuta/.test(name)) {
      score += 10;
      reasons.push("documento de notas");
    }
    // Proximidad temporal: creado/modificado cerca del término de la reunión.
    if (meetingTime) {
      const diffH = Math.abs(new Date(f.modifiedTime).getTime() - meetingTime) / 3.6e6;
      if (diffH <= 6) {
        score += 20;
        reasons.push("editado junto a la reunión");
      } else if (diffH <= 48) {
        score += 8;
        reasons.push("editado cerca de la reunión");
      }
    }
    // Organizador es dueño del documento.
    if (
      ctx.organizerEmail &&
      f.owners.some((o) => o.toLowerCase() === ctx.organizerEmail!.toLowerCase())
    ) {
      score += 10;
      reasons.push("creado por el organizador");
    }

    return {
      fileId: f.id,
      name: f.name,
      webViewLink: f.webViewLink,
      modifiedTime: f.modifiedTime,
      score,
      reasons,
    };
  });

  const ranked = scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return { status: "not_found", candidates: [] };

  const top = ranked[0];
  const second = ranked[1];
  // Alta confianza: único claro y con margen sobre el resto.
  const isAuto = top.score >= 70 && (!second || top.score - second.score >= 25);

  return {
    status: isAuto ? "auto" : "candidates",
    candidates: ranked.slice(0, 5),
  };
}
