"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Copy, Check, RefreshCw, Ban, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generatePortalLink, revokePortalLink } from "./portal-actions";

export function PortalLinkCard({
  clientId,
  token,
  generatedAt,
}: {
  clientId: string;
  token: string | null;
  generatedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  // El origin real: así el enlace sirve igual en local, preview y producción.
  const url = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${token}`
    : "";

  function generate(regenerating = false) {
    startTransition(async () => {
      const res = await generatePortalLink(clientId);
      if (res.ok) {
        toast.success(
          regenerating
            ? "Enlace regenerado — el anterior dejó de funcionar"
            : "Enlace del portal generado",
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function revoke() {
    startTransition(async () => {
      const res = await revokePortalLink(clientId);
      if (res.ok) {
        toast.success("Acceso revocado");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Enlace copiado");
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-medium">Portal del cliente</h2>
        {token && (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium text-[var(--status-emerald)] [background:var(--status-emerald-bg)]">
            Activo
          </span>
        )}
      </div>

      {!token ? (
        <>
          <p className="text-muted-foreground mb-3 text-sm">
            Genera un enlace privado para que el cliente vea su estado de cuenta
            y el avance de sus proyectos. No necesita cuenta ni contraseña.
          </p>
          <Button variant="outline" onClick={() => generate()} disabled={pending}>
            <Link2 className="size-4" />
            {pending ? "Generando…" : "Generar enlace del portal"}
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={url} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copy} title="Copiar">
              {copied ? (
                <Check className="size-4 text-[var(--status-emerald)]" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            Cualquiera con este enlace puede ver la información del cliente:
            compártelo solo con él. Si se filtra, regenéralo o revócalo.
            {generatedAt &&
              ` · Creado el ${new Date(generatedAt).toLocaleDateString("es-CL")}`}
          </p>

          <div className="flex flex-wrap gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="border-border hover:bg-accent inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
            >
              <ExternalLink className="size-3.5" />
              Abrir portal
            </a>
            <button
              onClick={() => generate(true)}
              disabled={pending}
              className="border-border hover:bg-accent inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              <RefreshCw className="size-3.5" />
              Regenerar
            </button>
            <button
              onClick={revoke}
              disabled={pending}
              className="border-border inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-[var(--status-red)] hover:bg-[var(--status-red-bg)] disabled:opacity-50"
            >
              <Ban className="size-3.5" />
              Revocar acceso
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
