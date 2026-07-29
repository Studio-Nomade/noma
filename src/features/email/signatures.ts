import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { emailSignatures, userIntegrations } from "@/db/schema";
import type { Area } from "@/types/enums";

export type EmailPurpose = "commercial" | "legal" | "people";

const PURPOSE_DEFAULTS: Record<
  EmailPurpose,
  { name: string; email: string }
> = {
  commercial: {
    name: "Studio Nomade · Comercial",
    email: "sales@studionomade.cl",
  },
  legal: {
    name: "Studio Nomade · Legal",
    email: "legal@studionomade.cl",
  },
  people: {
    name: "Studio Nomade · Personas",
    email: "people@studionomade.cl",
  },
};

function signatureKeys(purpose: EmailPurpose, area?: Area | null) {
  return [
    ...(area ? [`${purpose}:${area}`] : []),
    `${purpose}:default`,
    "default",
  ];
}

export function appendTextSignature(body: string, signature: string) {
  const cleanBody = body.trimEnd();
  const cleanSignature = signature.trim();
  return cleanSignature ? `${cleanBody}\n\n${cleanSignature}` : cleanBody;
}

export type ResolvedEmailSender =
  | {
      ok: true;
      userId: string;
      from: string;
      fromName: string;
      signatureText: string;
      signatureHtml: string;
    }
  | {
      ok: false;
      from: string;
      fromName: string;
      signatureText: string;
      signatureHtml: string;
      reason: string;
    };

export async function resolveEmailSender(
  purpose: EmailPurpose,
  area?: Area | null,
): Promise<ResolvedEmailSender> {
  const keys = signatureKeys(purpose, area);
  const rows = await db
    .select()
    .from(emailSignatures)
    .where(
      and(
        inArray(emailSignatures.key, keys),
        eq(emailSignatures.status, "Activo"),
      ),
    );
  const signature = keys
    .map((key) => rows.find((row) => row.key === key))
    .find(Boolean);
  const fallback = PURPOSE_DEFAULTS[purpose];
  const from = (
    signature?.senderEmail ||
    (purpose === "commercial"
      ? process.env.NOMA_COBRANZA_FROM
      : undefined) ||
    fallback.email
  )
    .trim()
    .toLowerCase();
  const fromName = signature?.senderName?.trim() || fallback.name;
  const signatureText =
    signature?.signatureText?.trim() || `${fromName}\nStudio Nomade`;
  const signatureHtml =
    signature?.signatureHtml?.trim() ||
    `<p>${fromName}<br><strong>Studio Nomade</strong></p>`;

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return {
      ok: false,
      from,
      fromName,
      signatureText,
      signatureHtml,
      reason:
        "Falta configurar GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en el entorno.",
    };
  }
  const [integration] = await db
    .select({
      userId: userIntegrations.userId,
      token: userIntegrations.googleRefreshToken,
    })
    .from(userIntegrations)
    .where(eq(userIntegrations.email, from))
    .limit(1);
  if (!integration?.userId || !integration.token) {
    return {
      ok: false,
      from,
      fromName,
      signatureText,
      signatureHtml,
      reason: `La casilla remitente (${from}) no ha autorizado el envío. Debe iniciar sesión en Noma una vez con esa cuenta.`,
    };
  }
  return {
    ok: true,
    userId: integration.userId,
    from,
    fromName,
    signatureText,
    signatureHtml,
  };
}
