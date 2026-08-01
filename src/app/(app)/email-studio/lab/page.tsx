import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { compileEmailDocument } from "@/features/email-studio/compiler.server";
import { EmailStudioSpike } from "@/features/email-studio/email-studio-spike";
import { emailStudioPrototype } from "@/features/email-studio/prototype-document";

export const metadata = { title: "Laboratorio · Email Studio" };

async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${protocol}://${host}` : "http://localhost:3001";
}

export default async function EmailStudioLabPage() {
  const compiled = await compileEmailDocument(emailStudioPrototype, {
    assetBaseUrl: await requestOrigin(),
  });

  return (
    <>
      <PageHeader
        title="Laboratorio de compilación"
        description="Contrato EmailDocument 1.0 y salida MJML/HTML de referencia."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Spike técnico</Badge>
            <Badge variant="secondary">MJML</Badge>
          </div>
        }
      />
      <EmailStudioSpike compiled={compiled} />
    </>
  );
}
