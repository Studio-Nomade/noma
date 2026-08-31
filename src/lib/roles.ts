/**
 * Tiers de acceso de Noma basados en correo. Cada lista es configurable por
 * entorno; superadmin hereda todas las capacidades.
 */
function list(env: string | undefined, fallback: string): string[] {
  return (env ?? fallback)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

const SUPERADMIN_EMAILS = list(
  process.env.NOMA_SUPERADMIN_EMAILS,
  "sebastian@studionomade.cl,ana@studionomade.cl",
);
const COMMERCIAL_EMAILS = list(
  process.env.NOMA_COMERCIAL_EMAILS,
  "sales@studionomade.cl",
);
const LEGAL_EMAILS = list(
  process.env.NOMA_LEGAL_EMAILS,
  "legal@studionomade.cl",
);
const PEOPLE_EMAILS = list(
  process.env.NOMA_PEOPLE_EMAILS,
  "people@studionomade.cl,legal@studionomade.cl",
);
// Dirección de Arte: parte fija del estudio que gestiona el catálogo de
// servicios sin ser superadmin ni finanzas. Solo habilita `canEditCatalog`.
const ARTE_EMAILS = list(
  process.env.NOMA_ARTE_EMAILS,
  "catalina@studionomade.cl,javiera@studionomade.cl",
);

export type UserRole = {
  email: string;
  tier:
    | "superadmin"
    | "comercialFinanciero"
    | "legalCompliance"
    | "personas"
    | "direccionArte"
    | "lectura";
  isSuperAdmin: boolean;
  isCommercialFinance: boolean;
  isLegalCompliance: boolean;
  isPeople: boolean;
  isArte: boolean;
  canFinance: boolean;
  canEditCatalog: boolean;
  canLegal: boolean;
  canPeople: boolean;
  canManagePeople: boolean;
  isReadOnly: boolean;
  /** Alias de compatibilidad; usar `canFinance` en código nuevo. */
  isFinance: boolean;
  /** Alias de compatibilidad para módulos de administración global. */
  isAdmin: boolean;
};

export function roleFor(email?: string | null): UserRole {
  const normalized = (email ?? "").trim().toLowerCase();
  const isSuperAdmin = SUPERADMIN_EMAILS.includes(normalized);
  const isCommercialFinance = COMMERCIAL_EMAILS.includes(normalized);
  const isLegalCompliance = LEGAL_EMAILS.includes(normalized);
  const isPeople = PEOPLE_EMAILS.includes(normalized);
  const isArte = ARTE_EMAILS.includes(normalized);
  const tier = isSuperAdmin
    ? "superadmin"
    : isCommercialFinance
      ? "comercialFinanciero"
      : isLegalCompliance
        ? "legalCompliance"
        : isPeople
          ? "personas"
          : isArte
            ? "direccionArte"
            : "lectura";
  const canFinance = isSuperAdmin || isCommercialFinance;
  const canLegal = isSuperAdmin || isLegalCompliance;
  const canPeople = isSuperAdmin || isPeople;
  const canManagePeople =
    isSuperAdmin || normalized === "people@studionomade.cl";

  return {
    email: normalized,
    tier,
    isSuperAdmin,
    isCommercialFinance,
    isLegalCompliance,
    isPeople,
    isArte,
    canFinance,
    canEditCatalog: canFinance || isArte,
    canLegal,
    canPeople,
    canManagePeople,
    isReadOnly: tier === "lectura",
    isFinance: canFinance,
    isAdmin: isSuperAdmin,
  };
}
