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
 * solo si el From es del dominio del estudio. Módulo puro.
 */

import { domainOf } from "./addresses";

export type SenderAuth = { verified: boolean; reason: string };

export type SenderAuthOptions = {
  studioDomain: string;
  authservId?: string;
  /** `off` desactiva la verificación (solo para diagnóstico). */
  mode?: string | null;
};

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

  for (const item of parsed.results) {
    if (item.result !== "pass") continue;
    if (
      item.method === "dmarc" &&
      domainsAligned(domainFromProp(item.props["header.from"]), fromDomain)
    ) {
      return { verified: true, reason: "dmarc=pass" };
    }
    if (
      item.method === "dkim" &&
      (domainsAligned(domainFromProp(item.props["header.d"]), fromDomain) ||
        domainsAligned(domainFromProp(item.props["header.i"]), fromDomain))
    ) {
      return { verified: true, reason: "dkim=pass alineado" };
    }
    if (
      item.method === "spf" &&
      domainsAligned(domainFromProp(item.props["smtp.mailfrom"]), fromDomain)
    ) {
      return { verified: true, reason: "spf=pass alineado" };
    }
  }
  const summary = parsed.results
    .map((item) => `${item.method}=${item.result}`)
    .join(", ");
  return {
    verified: false,
    reason: `sin autenticación alineada (${summary || "sin resultados"})`,
  };
}
