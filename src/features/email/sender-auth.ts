/**
 * ¿El remitente (From) está autenticado? Lee el `Authentication-Results` que
 * agrega Gmail al recibir (authserv-id `mx.google.com`) y exige al menos un
 * mecanismo que pase ALINEADO con el dominio del From:
 *   - dmarc=pass con header.from del mismo dominio, o
 *   - dkim=pass con header.d / header.i alineado, o
 *   - spf=pass con smtp.mailfrom alineado (dominios sin DMARC).
 *
 * Solo cuenta el PRIMER encabezado: Gmail antepone el suyo, y cualquier otro
 * `Authentication-Results` más abajo pudo venir escrito por el remitente.
 * Correo interno del propio Workspace puede llegar sin encabezado: se acepta
 * solo si el From es del dominio del estudio.
 *
 * Respaldo ARC: dominios en Microsoft 365 sin SPF publicado ni firma DKIM
 * propia (p. ej. raidoit.com) llegan a Gmail solo con `arc=pass`, y lo mismo
 * pasa con correos que una regla del Workspace redirige a otro buzón. En ese
 * caso se acepta el resultado que registró el PRIMER sellador (ARC i=1) si:
 *   - el encabezado de Gmail dice `arc=pass` (Gmail validó la cadena),
 *   - la cadena es continua (i=1..N, sin duplicados) y TODOS los selladores
 *     son de confianza (por defecto google.com y microsoft.com: así nadie
 *     puede reciclar un i=1 legítimo con un sello propio encima), y
 *   - ese i=1 trae dmarc, dkim o spf en `pass` alineado con el From.
 * Módulo puro.
 */

import { domainOf } from "./addresses";

export type SenderAuth = { verified: boolean; reason: string };

export type SenderAuthOptions = {
  studioDomain: string;
  authservId?: string;
  /** `off` desactiva la verificación (solo para diagnóstico). */
  mode?: string | null;
  /**
   * Selladores ARC de confianza, separados por coma. Por defecto
   * `google.com,microsoft.com`; vacío desactiva el respaldo ARC.
   */
  trustedArcSealers?: string | null;
};

export const DEFAULT_TRUSTED_ARC_SEALERS = ["google.com", "microsoft.com"];

type ResInfo = {
  method: string;
  result: string;
  props: Record<string, string>;
};

function stripComments(value: string) {
  let out = value;
  // Comentarios RFC 5322 (pueden anidarse): se quitan de adentro hacia afuera.
  for (let i = 0; i < 5 && /\([^()]*\)/.test(out); i += 1) {
    out = out.replace(/\([^()]*\)/g, " ");
  }
  return out;
}

export function parseAuthenticationResults(header: string): {
  authservId: string;
  results: ResInfo[];
} {
  const parts = stripComments(header.replace(/\r?\n[ \t]+/g, " ")).split(";");
  const authservId = (parts.shift() ?? "").trim().split(/\s+/)[0].toLowerCase();
  const results: ResInfo[] = [];
  for (const part of parts) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    const head = tokens.shift();
    const match = head?.match(/^([a-z0-9_-]+)=([a-z]+)$/i);
    if (!match) continue;
    const props: Record<string, string> = {};
    for (const token of tokens) {
      const eq = token.indexOf("=");
      if (eq <= 0) continue;
      props[token.slice(0, eq).toLowerCase()] = token
        .slice(eq + 1)
        .replace(/^"|"$/g, "")
        .toLowerCase();
    }
    results.push({
      method: match[1].toLowerCase(),
      result: match[2].toLowerCase(),
      props,
    });
  }
  return { authservId, results };
}

/** Alineación relajada: mismo dominio o uno es subdominio del otro. */
export function domainsAligned(a: string, b: string) {
  const x = a.trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
  const y = b.trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
  if (!x || !y || !x.includes(".") || !y.includes(".")) return false;
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
}

function domainFromProp(value: string | undefined) {
  if (!value) return "";
  return value.includes("@") ? domainOf(value) : value;
}

export function evaluateSenderAuth(
  rawHeaders: Record<string, string[] | undefined>,
  fromEmail: string,
  options: SenderAuthOptions,
): SenderAuth {
  if (options.mode?.trim().toLowerCase() === "off") {
    return { verified: true, reason: "verificación desactivada" };
  }
  const fromDomain = domainOf(fromEmail);
  if (!fromDomain) return { verified: false, reason: "From sin dominio" };

  const headers = rawHeaders["authentication-results"] ?? [];
  if (!headers.length) {
    return fromDomain === options.studioDomain.trim().toLowerCase()
      ? { verified: true, reason: "interno del Workspace" }
      : { verified: false, reason: "sin Authentication-Results" };
  }

  const expected = (options.authservId ?? "mx.google.com").toLowerCase();
  const parsed = parseAuthenticationResults(headers[0]);
  if (parsed.authservId !== expected) {
    return {
      verified: false,
      reason: `Authentication-Results de ${parsed.authservId || "origen desconocido"}`,
    };
  }

  const direct = alignedPass(parsed.results, fromDomain);
  if (direct) return { verified: true, reason: direct };

  const arc = evaluateArcFallback(
    rawHeaders,
    parsed.results,
    fromDomain,
    options,
  );
  if (arc.verified) return arc;

  const summary = parsed.results
    .map((item) => `${item.method}=${item.result}`)
    .join(", ");
  return {
    verified: false,
    reason: `sin autenticación alineada (${summary || "sin resultados"})${arc.reason ? `; ARC: ${arc.reason}` : ""}`,
  };
}

/** Primer mecanismo en `pass` alineado con el From, o null. */
function alignedPass(results: ResInfo[], fromDomain: string): string | null {
  for (const item of results) {
    if (item.result !== "pass") continue;
    if (
      item.method === "dmarc" &&
      domainsAligned(domainFromProp(item.props["header.from"]), fromDomain)
    ) {
      return "dmarc=pass";
    }
    if (
      item.method === "dkim" &&
      (domainsAligned(domainFromProp(item.props["header.d"]), fromDomain) ||
        domainsAligned(domainFromProp(item.props["header.i"]), fromDomain))
    ) {
      return "dkim=pass alineado";
    }
    if (
      item.method === "spf" &&
      domainsAligned(domainFromProp(item.props["smtp.mailfrom"]), fromDomain)
    ) {
      return "spf=pass alineado";
    }
  }
  return null;
}

/** `i=2; a=rsa-sha256; cv=pass; d=google.com` → { i: 2, rest: "a=…" }. */
function splitArcInstance(value: string): { i: number; rest: string } | null {
  const match = value
    .replace(/\r?\n[ \t]+/g, " ")
    .match(/^\s*i\s*=\s*(\d+)\s*;([\s\S]*)$/i);
  if (!match) return null;
  return { i: Number(match[1]), rest: match[2] };
}

function arcSealDomain(rest: string): string {
  for (const part of rest.split(";")) {
    const match = part.trim().match(/^d\s*=\s*([^\s;]+)$/i);
    if (match) return match[1].toLowerCase().replace(/\.$/, "");
  }
  return "";
}

export function parseTrustedSealers(
  value: string | null | undefined,
): string[] {
  if (value === undefined || value === null) return DEFAULT_TRUSTED_ARC_SEALERS;
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function evaluateArcFallback(
  rawHeaders: Record<string, string[] | undefined>,
  topResults: ResInfo[],
  fromDomain: string,
  options: SenderAuthOptions,
): SenderAuth {
  const arcTop = topResults.find((item) => item.method === "arc");
  if (!arcTop) return { verified: false, reason: "" };
  if (arcTop.result !== "pass") {
    return { verified: false, reason: `arc=${arcTop.result}` };
  }
  const trusted = parseTrustedSealers(options.trustedArcSealers);
  if (!trusted.length)
    return { verified: false, reason: "respaldo desactivado" };

  const seals = new Map<number, string>();
  for (const value of rawHeaders["arc-seal"] ?? []) {
    const parsed = splitArcInstance(value);
    if (!parsed || seals.has(parsed.i)) {
      return { verified: false, reason: "ARC-Seal inválido o duplicado" };
    }
    seals.set(parsed.i, arcSealDomain(parsed.rest));
  }
  if (!seals.size) return { verified: false, reason: "sin ARC-Seal" };
  for (let i = 1; i <= seals.size; i += 1) {
    const domain = seals.get(i);
    if (domain === undefined) {
      return { verified: false, reason: "cadena ARC incompleta" };
    }
    if (!trusted.includes(domain)) {
      return {
        verified: false,
        reason: `sellador i=${i} no confiable (${domain || "sin d="})`,
      };
    }
  }

  const firstResults = (rawHeaders["arc-authentication-results"] ?? [])
    .map(splitArcInstance)
    .filter((item): item is { i: number; rest: string } => item?.i === 1);
  if (firstResults.length !== 1) {
    return {
      verified: false,
      reason: "sin ARC-Authentication-Results i=1 único",
    };
  }
  const original = parseAuthenticationResults(firstResults[0].rest);
  const pass = alignedPass(original.results, fromDomain);
  if (!pass) {
    return { verified: false, reason: "i=1 sin autenticación alineada" };
  }
  return {
    verified: true,
    reason: `arc=pass: ${pass} según ${seals.get(1)}`,
  };
}
