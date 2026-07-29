import "server-only";

/**
 * Solo permite rutas internas de la app como destino de redirección OAuth.
 * Cualquier valor externo (absoluto, con esquema, o protocol-relative "//host")
 * cae al fallback. Compartido por las rutas connect y callback.
 */
export function safeInternalRedirect(
  value: string | null | undefined,
): string {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/integrations";
}
