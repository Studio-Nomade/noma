/**
 * Traduce las respuestas 401/403 de las APIs de Google a un motivo accionable.
 * Módulo puro (sin server-only) para poder testearlo.
 *
 * Google distingue, en el cuerpo del error:
 * - API no activada en el proyecto de Google Cloud (SERVICE_DISABLED /
 *   accessNotConfigured) → la arregla un admin una sola vez.
 * - Scope no concedido por el usuario (ACCESS_TOKEN_SCOPE_INSUFFICIENT /
 *   insufficientPermissions, o 401) → el usuario vuelve a entrar y marca la
 *   casilla del servicio en la pantalla de consentimiento.
 * - Sin acceso al recurso o bloqueo por política del dominio → otro 403.
 */

export type GoogleDenialKind = "api_disabled" | "scope" | "forbidden";

export type GoogleDenial = {
  kind: GoogleDenialKind;
  /** Motivo técnico de Google (para logs). */
  googleReason: string | null;
  message: string;
};

type GoogleErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: { reason?: string }[];
    details?: { reason?: string }[];
  };
};

export function classifyGoogleDenial(
  status: number,
  body: unknown,
  serviceName: string,
): GoogleDenial {
  const err = (body as GoogleErrorBody | null)?.error;
  const reasons = [
    ...(err?.details ?? []).map((d) => d.reason),
    ...(err?.errors ?? []).map((e) => e.reason),
    err?.status,
  ].filter((r): r is string => typeof r === "string" && r.length > 0);
  const has = (...keys: string[]) => reasons.some((r) => keys.includes(r));
  const googleReason = reasons[0] ?? null;

  if (has("SERVICE_DISABLED", "accessNotConfigured")) {
    return {
      kind: "api_disabled",
      googleReason,
      message: `La API de ${serviceName} no está activada en el proyecto de Google Cloud de Noma. Un administrador tiene que activarla una vez; no sirve volver a iniciar sesión.`,
    };
  }
  if (
    status === 401 ||
    has("ACCESS_TOKEN_SCOPE_INSUFFICIENT", "insufficientPermissions")
  ) {
    return {
      kind: "scope",
      googleReason,
      message: `Tu cuenta no concedió acceso a ${serviceName}. Cierra sesión, vuelve a entrar y marca la casilla de ${serviceName} en la pantalla de Google.`,
    };
  }
  return {
    kind: "forbidden",
    googleReason,
    message: `Google ${serviceName} rechazó el acceso: tu cuenta no tiene permiso sobre ese archivo o una política de Studio Nomade lo bloquea.`,
  };
}

/** Lee el cuerpo de una respuesta denegada y la clasifica (registra el motivo). */
export async function googleDenialFromResponse(
  res: Response,
  serviceName: string,
): Promise<GoogleDenial> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const denial = classifyGoogleDenial(res.status, body, serviceName);
  console.warn(
    `[google:${serviceName}] ${res.status} ${denial.kind} (${denial.googleReason ?? "sin motivo"})`,
  );
  return denial;
}
