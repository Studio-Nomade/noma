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
 * Divide un encabezado en entradas por `,`/`;` fuera de comillas y `<...>`.
 * Respeta escapes `\"` dentro de comillas.
 */
function splitAddressHeader(header: string): string[] {
  const chunks: string[] = [];
  let current = "";
  let inQuotes = false;
  let inAngle = false;
  let escaped = false;
  for (const char of header) {
    if (escaped) {
      escaped = false;
      current += char;
      continue;
    }
    if (char === "\\" && inQuotes) {
      escaped = true;
      current += char;
      continue;
    }
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
  return chunks;
}

/**
 * Último `<addr-spec>` que está FUERA de comillas (RFC 5322). Un nombre visible
 * como `"Jefe <jefe@cliente.cl>" <otro@evil.com>` no puede suplantar la
 * dirección real: se devuelve `otro@evil.com`.
 */
function angleAddressOutsideQuotes(
  chunk: string,
): { start: number; value: string } | null {
  let inQuotes = false;
  let escaped = false;
  let open = -1;
  let found: { start: number; value: string } | null = null;
  for (let index = 0; index < chunk.length; index += 1) {
    const char = chunk[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inQuotes) {
      escaped = true;
      continue;
    }
    if (char === '"' && open === -1) {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (char === "<") open = index;
    else if (char === ">" && open !== -1) {
      found = { start: open, value: chunk.slice(open + 1, index) };
      open = -1;
    }
  }
  return found;
}

/** Texto fuera de comillas (para direcciones sin `<...>`). */
function unquoted(chunk: string): string {
  return chunk.replace(/"(?:[^"\\]|\\.)*"/g, " ");
}

/**
 * Parsea una lista de direcciones: `"Pérez, Ana" <ana@x.cl>, b@y.cl` → 2
 * entradas. La dirección siempre sale del `<...>` fuera de comillas (o, sin
 * él, del texto fuera de comillas); el nombre visible nunca aporta dirección.
 * Debe recibir el encabezado CRUDO: las encoded-words (RFC 2047) se decodifican
 * después, solo en el nombre (ver `mime.ts`).
 */
export function parseAddressList(
  header: string | null | undefined,
): EmailAddress[] {
  if (!header) return [];
  const result: EmailAddress[] = [];
  for (const chunk of splitAddressHeader(header)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const angle = angleAddressOutsideQuotes(trimmed);
    const candidate = angle ? angle.value : unquoted(trimmed);
    const email = candidate.match(EMAIL_RE)?.[0];
    if (!email) continue;
    const rawName = angle ? trimmed.slice(0, angle.start).trim() : "";
    const name = rawName.replace(/^"|"$/g, "").replace(/\\(.)/g, "$1").trim();
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
 * Dominios de correo público: nunca valen como dominio autorizado de un
 * cliente (cualquiera puede crear una cuenta). Para esos remitentes se usa
 * `client_contacts` con la dirección exacta.
 */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.cl",
  "hotmail.com",
  "hotmail.cl",
  "hotmail.es",
  "live.com",
  "live.cl",
  "msn.com",
  "yahoo.com",
  "yahoo.es",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "zoho.com",
]);

export function isPublicEmailDomain(domain: string) {
  return PUBLIC_EMAIL_DOMAINS.has(
    domain.trim().toLowerCase().replace(/^@/, ""),
  );
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
    .filter((value) => value && !isPublicEmailDomain(value))
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
