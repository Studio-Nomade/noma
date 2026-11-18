/**
 * URL pública de Noma para links que salen de la app (Slack, correos,
 * paquetes). `NEXT_PUBLIC_SITE_URL` manda; si falta, en Vercel se usa el
 * dominio de producción del proyecto. Sin ninguno devuelve "" (link relativo).
 */
export function appBaseUrl(
  env: Record<string, string | undefined> = process.env,
) {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel)
    return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "";
}

/** Link de Slack (mrkdwn) solo si la URL es absoluta; si no, nada. */
export function slackLink(url: string, label: string) {
  return /^https?:\/\//.test(url) ? `<${url}|${label}>` : "";
}
