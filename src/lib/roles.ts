/**
 * Roles de Noma (V1, basados en correo). Configurable por entorno.
 *
 * - SUPERADMIN: acceso total, ve todos los módulos (incluye Finanzas/CFO) y puede
 *   ejecutar acciones de administración. Por defecto: sebastian@, ana@, sales@.
 * - FINANCE: puede ver/operar el módulo financiero (facturar, conciliar, enviar inicio).
 * - ADMIN: puede borrar/configurar a nivel global.
 *
 * Los superadmins son, por definición, también finance y admin.
 *   NOMA_SUPERADMIN_EMAILS="sebastian@studionomade.cl,ana@studionomade.cl,sales@studionomade.cl"
 *   NOMA_FINANCE_EMAILS="sales@studionomade.cl,finanzas@studionomade.cl"
 *   NOMA_ADMIN_EMAILS="branding@studionomade.cl"
 */
function list(env: string | undefined, fallback: string): string[] {
  return (env ?? fallback)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const SUPERADMIN_EMAILS = list(
  process.env.NOMA_SUPERADMIN_EMAILS,
  "sebastian@studionomade.cl,ana@studionomade.cl,sales@studionomade.cl",
);
const FINANCE_EMAILS = list(
  process.env.NOMA_FINANCE_EMAILS,
  "sales@studionomade.cl",
);
const ADMIN_EMAILS = list(process.env.NOMA_ADMIN_EMAILS, "");

export type UserRole = {
  email: string;
  isSuperAdmin: boolean;
  isFinance: boolean;
  isAdmin: boolean;
};

export function roleFor(email?: string | null): UserRole {
  const e = (email ?? "").toLowerCase();
  const isSuperAdmin = SUPERADMIN_EMAILS.includes(e);
  return {
    email: e,
    isSuperAdmin,
    // superadmin ve todos los módulos, incluido Finanzas
    isFinance: isSuperAdmin || FINANCE_EMAILS.includes(e),
    // superadmin también puede administrar/borrar
    isAdmin: isSuperAdmin || ADMIN_EMAILS.includes(e),
  };
}
