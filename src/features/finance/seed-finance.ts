import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  businessLines,
  costCenters,
  ledgerAccounts,
  bankAccounts,
  importTemplates,
  cobranzaTemplates,
} from "@/db/schema";
import type { Area, LedgerAccountType, CobranzaMoment } from "@/types/enums";

/**
 * Seed del módulo CFO / Finanzas — idempotente.
 * Líneas de negocio alineadas a las áreas del estudio, centros de costo espejo,
 * plan de cuentas base, cuenta BCI por defecto y plantillas de importación.
 *
 * Nota: el cruce fino con el plan de cuentas real de Chipax queda para una fase
 * posterior (ver plan). Este plan de cuentas es una base editable.
 */

// Líneas de negocio = áreas de Noma (código estable) + administración interna.
const BUSINESS_LINES: { code: string; name: string; area?: Area }[] = [
  { code: "B&D", name: "Branding & Design", area: "B&D" },
  { code: "WD", name: "Web Design", area: "WD" },
  { code: "A&D", name: "Architecture & Design", area: "A&D" },
  { code: "A&A", name: "Audiovisual & Animation", area: "A&A" },
  { code: "CE", name: "Clínica de Emprendimientos", area: "CE" },
  { code: "MP", name: "Mercado Público", area: "MP" },
  { code: "CSM", name: "Content & Social Media", area: "CSM" },
  { code: "STR", name: "Strategy / Consultoría", area: "STR" },
  { code: "ADMIN", name: "Administración / gastos internos" },
];

type Acc = {
  code: string;
  name: string;
  type: LedgerAccountType;
  parent?: string;
  area?: Area;
};
const ACCOUNTS: Acc[] = [
  { code: "1", name: "Ingresos", type: "INGRESO" },
  { code: "1.1", name: "Ventas de servicios", type: "INGRESO", parent: "1" },
  { code: "1.2", name: "Otros ingresos", type: "INGRESO", parent: "1" },
  { code: "2", name: "Costos", type: "COSTO" },
  {
    code: "2.1",
    name: "Costos directos de proyectos",
    type: "COSTO",
    parent: "2",
  },
  {
    code: "2.2",
    name: "Freelance y colaboradores",
    type: "COSTO",
    parent: "2",
  },
  { code: "3", name: "Gastos", type: "GASTO" },
  { code: "3.1", name: "Gastos de administración", type: "GASTO", parent: "3" },
  {
    code: "3.2",
    name: "Servicios básicos y arriendo",
    type: "GASTO",
    parent: "3",
  },
  { code: "3.3", name: "Honorarios", type: "GASTO", parent: "3" },
  { code: "3.4", name: "Remuneraciones", type: "GASTO", parent: "3" },
  { code: "3.5", name: "Software y suscripciones", type: "GASTO", parent: "3" },
  { code: "3.6", name: "Marketing y publicidad", type: "GASTO", parent: "3" },
  { code: "3.7", name: "Impuestos", type: "GASTO", parent: "3" },
  { code: "4", name: "Activos", type: "ACTIVO" },
  { code: "4.1", name: "Banco", type: "ACTIVO", parent: "4" },
  { code: "5", name: "Pasivos", type: "PASIVO" },
  { code: "6", name: "Patrimonio", type: "PATRIMONIO" },
];

const TEMPLATES: {
  name: string;
  type: "NUBOX_VENTAS" | "NUBOX_COMPRAS" | "CARTOLA_BANCARIA";
  columnMapping: Record<string, string>;
}[] = [
  {
    name: "Nubox — Registro de Ventas (por defecto)",
    type: "NUBOX_VENTAS",
    columnMapping: {
      tipoDoc: "Tipo Doc",
      folio: "Folio",
      rutContacto: "RUT cliente",
      nombreContacto: "Razon Social",
      fechaEmision: "Fecha Docto",
      fechaVencimiento: "Fecha Vencimiento",
      exento: "Monto Exento",
      neto: "Monto Neto",
      iva: "Monto IVA",
      total: "Monto Total",
    },
  },
  {
    name: "Nubox — Registro de Compras (por defecto)",
    type: "NUBOX_COMPRAS",
    columnMapping: {
      tipoDoc: "Tipo Doc",
      folio: "Folio",
      rutContacto: "RUT Proveedor",
      nombreContacto: "Razon Social",
      fechaEmision: "Fecha Docto",
      fechaVencimiento: "Fecha Vencimiento",
      exento: "Monto Exento",
      neto: "Monto Neto",
      iva: "Monto IVA Recuperable",
      total: "Monto Total",
    },
  },
  {
    name: "Cartola BCI (por defecto)",
    type: "CARTOLA_BANCARIA",
    columnMapping: {
      fecha: "Fecha",
      glosa: "Descripción",
      cargo: "Cargo",
      abono: "Abono",
      saldo: "Saldo",
    },
  },
];

export async function seedFinance() {
  // ── Líneas de negocio + centros de costo espejo ────────────
  for (const bl of BUSINESS_LINES) {
    await db
      .insert(businessLines)
      .values({ code: bl.code, name: bl.name })
      .onConflictDoUpdate({
        target: businessLines.code,
        set: { name: bl.name },
      });
    await db
      .insert(costCenters)
      .values({ code: `CC-${bl.code}`, name: bl.name })
      .onConflictDoUpdate({ target: costCenters.code, set: { name: bl.name } });
  }
  console.log(`✓ ${BUSINESS_LINES.length} líneas de negocio + centros de costo`);

  // ── Plan de cuentas (padres antes que hijos; array ya ordenado) ──
  for (const a of ACCOUNTS) {
    let parentId: string | null = null;
    if (a.parent) {
      const [p] = await db
        .select({ id: ledgerAccounts.id })
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.code, a.parent))
        .limit(1);
      parentId = p?.id ?? null;
    }
    await db
      .insert(ledgerAccounts)
      .values({ code: a.code, name: a.name, type: a.type, parentId })
      .onConflictDoUpdate({
        target: ledgerAccounts.code,
        set: { name: a.name, type: a.type, parentId },
      });
  }
  console.log(`✓ ${ACCOUNTS.length} cuentas del plan de cuentas`);

  // ── Cuenta bancaria por defecto (BCI) ──────────────────────
  const [bank] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.name, "Cuenta Corriente principal"))
    .limit(1);
  if (!bank) {
    await db.insert(bankAccounts).values({
      bank: "BCI",
      name: "Cuenta Corriente principal",
      currency: "CLP",
    });
    console.log("✓ cuenta bancaria BCI creada");
  } else {
    console.log("• cuenta bancaria ya existe, se omite");
  }

  // ── Plantillas de importación ──────────────────────────────
  for (const t of TEMPLATES) {
    const [existing] = await db
      .select({ id: importTemplates.id })
      .from(importTemplates)
      .where(eq(importTemplates.name, t.name))
      .limit(1);
    if (existing) {
      await db
        .update(importTemplates)
        .set({ columnMapping: t.columnMapping, type: t.type })
        .where(eq(importTemplates.id, existing.id));
    } else {
      await db.insert(importTemplates).values(t);
    }
  }
  console.log(`✓ ${TEMPLATES.length} plantillas de importación`);

  // ── Plantillas de cobranza (correos al cliente) ────────────
  for (const t of COBRANZA_TEMPLATES) {
    const [existing] = await db
      .select({ id: cobranzaTemplates.id })
      .from(cobranzaTemplates)
      .where(eq(cobranzaTemplates.name, t.name))
      .limit(1);
    if (!existing) {
      await db.insert(cobranzaTemplates).values(t);
    }
  }
  console.log(`✓ ${COBRANZA_TEMPLATES.length} plantillas de cobranza`);
}

// Variables disponibles: {cliente} {contacto} {proyecto} {monto} {folio}
// {mes} {anio} {estudio} {remitente}
const COBRANZA_TEMPLATES: {
  name: string;
  moment: CobranzaMoment;
  subject: string;
  body: string;
  isDefault: boolean;
}[] = [
  {
    name: "Inicio de proyecto",
    moment: "INICIO",
    isDefault: true,
    subject: "Inicio de proyecto {proyecto} · {estudio}",
    body: `Hola {contacto},

¡Gracias por confiar en {estudio}! Damos inicio al proyecto {proyecto}.

Adjuntamos la factura inicial N° {folio} por {monto}, correspondiente al primer hito. Te agradecemos gestionar su pago según las condiciones acordadas.

Cualquier duda, quedamos atentos.

Saludos cordiales,
{remitente}
{estudio}`,
  },
  {
    name: "Término de proyecto",
    moment: "TERMINO",
    isDefault: true,
    subject: "Cierre de proyecto {proyecto} · {estudio}",
    body: `Hola {contacto},

Hemos completado el proyecto {proyecto}. ¡Gracias por el trabajo conjunto!

Adjuntamos la factura final N° {folio} por {monto}. Te agradecemos gestionar su pago según las condiciones acordadas.

Quedamos disponibles para próximos desafíos.

Saludos cordiales,
{remitente}
{estudio}`,
  },
  {
    name: "Recordatorio de pago",
    moment: "RECORDATORIO",
    isDefault: true,
    subject: "Recordatorio de pago · Factura {folio} · {estudio}",
    body: `Hola {contacto},

Junto con saludar, te recordamos que la factura N° {folio} por {monto}, asociada al proyecto {proyecto}, se encuentra pendiente de pago.

Si ya realizaste el pago, por favor omite este mensaje. Si necesitas reenvío del documento o coordinar la gestión, quedamos atentos.

Muchas gracias,
{remitente}
{estudio}`,
  },
];
