/**
 * Direcciones de correo: parseo de listas RFC 5322 simplificado, ruteo por
 * alias y validación de remitentes. Módulo puro (sin DB ni red) para tests.
 */

export type EmailAddress = { name: string | null; email: string };

const EMAIL_RE = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function normalizeEmail(value: string): string {
  return value.trim().replace(/^<|>$/g, "").toLowerCase();
}

export function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

/**
 * Divide una lista de direcciones respetando comillas y `<...>`:
 * `"Pérez, Ana" <ana@x.cl>, b@y.cl` → 2 entradas.
 */
export function parseAddressList(
  header: string | null | undefined,
): EmailAddress[] {
  if (!header) return [];
  const chunks: string[] = [];
  let current = "";
  let inQuotes = false;
  let inAngle = false;
  for (const char of header) {
    if (char === '"' && !inAngle) inQuotes = !inQuotes;
    else if (char === "<" && !inQuotes) inAngle = true;
    else if (char === ">" && !inQuotes) inAngle = false;
    if ((char === "," || char === ";") && !inQuotes && !inAngle) {
      chunks.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  chunks.push(current);

  const result: EmailAddress[] = [];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const angle = trimmed.match(/<([^>]+)>/);
    const candidate = angle ? angle[1] : trimmed;
    const email = candidate.match(EMAIL_RE)?.[0];
    if (!email) continue;
    const rawName = angle ? trimmed.slice(0, angle.index).trim() : "";
    const name = rawName.replace(/^"|"$/g, "").replace(/\\"/g, '"').trim();
    result.push({ name: name || null, email: normalizeEmail(email) });
  }
  return result;
}

/** Encabezados que pueden revelar el alias real al que se escribió. */
export const ROUTING_HEADERS = [
  "to",
  "cc",
  "delivered-to",
  "x-original-to",
  "x-forwarded-to",
] as const;

/**
 * Candidatos de ruteo en orden de prioridad (To → Cc → Delivered-To →
 * X-Original-To → X-Forwarded-To), en minúsculas y sin repetir.
 */
export function routingCandidates(
  headers: Record<string, string[] | undefined>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of ROUTING_HEADERS) {
    for (const value of headers[name] ?? []) {
      for (const address of parseAddressList(value)) {
        if (seen.has(address.email)) continue;
        seen.add(address.email);
        out.push(address.email);
      }
    }
  }
  return out;
}

/** Primer alias configurado que aparece entre los candidatos. */
export function matchAlias(
  candidates: string[],
  aliases: Iterable<string>,
): string | null {
  const known = new Set([...aliases].map(normalizeEmail));
  return candidates.find((candidate) => known.has(candidate)) ?? null;
}

/**
 * ¿El dominio del remitente está autorizado? Acepta coincidencia exacta o
 * subdominio (`mkt.cliente.cl` vale para `cliente.cl`).
 */
export function isAllowedSenderDomain(
  email: string,
  allowedDomains: readonly string[],
): boolean {
  const domain = domainOf(email);
  if (!domain) return false;
  return allowedDomains
    .map((value) => value.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean)
    .some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

/**
 * Quita de una lista las casillas propias (alias, casilla de servicio) y
 * duplicados, para armar el CC de una respuesta.
 */
export function externalRecipients(
  addresses: readonly string[],
  ownAddresses: Iterable<string>,
): string[] {
  const own = new Set([...ownAddresses].map(normalizeEmail));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of addresses) {
    const email = normalizeEmail(raw);
    if (!email || own.has(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}
