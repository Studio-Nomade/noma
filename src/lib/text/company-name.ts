/**
 * Normaliza nombres de empresa a "Title Case".
 *
 * Los export contables (Chipax/SII) vienen EN MAYÚSCULAS, que en la ficha y en
 * los PDFs se lee como un grito. Capitalizar palabra por palabra a secas rompe
 * dos cosas del contexto chileno, así que se tratan aparte:
 *   · formas legales: "SPA" → "SpA", "S.A." se mantiene, "LTDA" → "Ltda."
 *   · siglas cortas: "BCM", "CCU", "OMG" no deben quedar "Bcm", "Ccu".
 */

/** Formas legales → escritura canónica (se comparan sin puntos ni tildes). */
const LEGAL_FORMS: Record<string, string> = {
  spa: "SpA",
  sa: "S.A.",
  sac: "S.A.C.",
  ltda: "Ltda.",
  limitada: "Limitada",
  eirl: "EIRL",
  llc: "LLC",
  inc: "Inc.",
  srl: "S.R.L.",
  cia: "Cía.",
  y: "y",
};

/** Conectores que van en minúscula salvo al inicio. */
const LOWERCASE_WORDS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "y",
  "e",
  "en",
  "para",
  "por",
  "con",
  "sin",
  "a",
  "al",
  "da",
  "do",
]);

/**
 * Palabras cortas que NO son siglas. Sin esta lista, la heurística de siglas
 * (2-3 letras en mayúscula) convertiría "IN-PASTA" en "IN-Pasta" o dejaría
 * "SIN" intacto.
 */
const NOT_ACRONYMS = new Set([
  "in",
  "on",
  "of",
  "the",
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "e",
  "en",
  "sin",
  "con",
  "por",
  "un",
  "una",
  "al",
  "da",
  "do",
  "su",
  "mi",
  "no",
  "si",
  "es",
  "va",
  "lo",
]);

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\./g, "");

/** ¿Es una sigla? (2-3 letras en mayúscula que no sean palabra corriente). */
function isAcronym(seg: string): boolean {
  const letters = seg.replace(/[^A-ZÑ&]/gi, "");
  if (!letters.length || letters.length > 3) return false;
  if (seg !== seg.toUpperCase()) return false;
  return !NOT_ACRONYMS.has(fold(seg));
}

/**
 * Capitaliza respetando guiones internos, evaluando cada segmento por separado:
 * así "CCU-PEPSICO" queda "CCU-Pepsico" (sigla + palabra) y no "Ccu-Pepsico".
 */
function capitalize(word: string): string {
  return word
    .split("-")
    .map((p) => {
      if (!p) return p;
      if (isAcronym(p)) return p;
      return p[0].toUpperCase() + p.slice(1).toLowerCase();
    })
    .join("-");
}

export function titleCaseCompany(raw?: string | null): string {
  const input = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!input) return "";

  // Si ya viene en mayúsculas/minúsculas mezcladas, se respeta lo que escribió
  // la persona: solo se normaliza lo que viene TODO EN MAYÚSCULAS.
  const hasLower = /[a-záéíóúñü]/.test(input);
  if (hasLower) return input;

  const words = input.split(" ");
  return words
    .map((word, i) => {
      const key = fold(word);
      if (!key) return word;

      const legal = LEGAL_FORMS[key];
      if (legal) return i === 0 ? capitalize(word) : legal;

      if (i > 0 && LOWERCASE_WORDS.has(key)) return key;

      return capitalize(word);
    })
    .join(" ");
}
