"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Braces,
  CheckCircle2,
  ExternalLink,
  FileImage,
  Layers3,
  Monitor,
  MousePointerClick,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CompiledEmail } from "./compiler.server";
import type { EmailDocument } from "./document";

type WorkspaceTab = "reference" | "preview" | "blueprint" | "html";
type ViewportMode = "desktop" | "mobile";

function plainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ");
}

function sampleText(value: string, document: EmailDocument): string {
  return document.variables.reduce(
    (current, variable) =>
      current.replaceAll(`{{${variable.key}}}`, variable.sample),
    plainText(value),
  );
}

function ReferenceMockup({ document }: { document: EmailDocument }) {
  const card = document.sections.find((section) => section.type === "card");
  const legal = document.sections.find((section) => section.type === "legal");
  const footer = document.sections.find((section) => section.type === "footer");
  const assets = new Map(document.assets.map((asset) => [asset.id, asset]));

  if (!card || card.type !== "card") return null;

  return (
    <div
      className="mx-auto min-h-[940px] w-full overflow-hidden"
      style={{
        maxWidth: document.width,
        backgroundColor: document.theme.canvasColor,
        color: document.theme.textColor,
        fontFamily: document.theme.fontFamily,
      }}
    >
      <div
        className="h-14"
        style={{ backgroundColor: document.theme.topBandColor }}
      />
      <div className="px-6">
        <div
          className="overflow-hidden"
          style={{
            backgroundColor: card.backgroundColor,
            borderRadius: card.borderRadius,
          }}
        >
          {card.blocks.map((block) => {
            if (block.type === "spacer") {
              return <div key={block.id} style={{ height: block.height }} />;
            }
            if (block.type === "image") {
              const asset = assets.get(block.assetId);
              if (!asset) return null;
              const verticalPadding = block.padding.split(" ")[0] ?? "0px";
              return (
                <div
                  key={block.id}
                  className={cn(
                    "flex",
                    block.align === "center" && "justify-center",
                    block.align === "right" && "justify-end",
                  )}
                  style={{ padding: `${verticalPadding} 24px` }}
                >
                  <Image
                    src={asset.path}
                    alt={asset.alt}
                    width={block.width}
                    height={72}
                    className="h-auto max-h-16 w-auto object-contain"
                  />
                </div>
              );
            }
            if (block.type === "button") {
              return (
                <div key={block.id} className="px-12 pt-6">
                  <div
                    className="px-5 py-4 text-center text-lg font-semibold"
                    style={{
                      backgroundColor: block.backgroundColor,
                      borderRadius: block.borderRadius,
                      color: block.color,
                    }}
                  >
                    {block.label}
                  </div>
                </div>
              );
            }

            const fontSize =
              block.type === "heading"
                ? block.fontSize
                : block.type === "text"
                  ? block.fontSize
                  : 12;
            const lineHeight =
              block.type === "heading"
                ? block.lineHeight
                : block.type === "text"
                  ? block.lineHeight
                  : 20;

            return (
              <div
                key={block.id}
                className={cn(
                  "whitespace-pre-line",
                  block.align === "center" && "text-center",
                  block.align === "right" && "text-right",
                  block.type === "heading" && "font-bold",
                  block.type === "eyebrow" &&
                    "font-medium tracking-[0.14em] uppercase",
                )}
                style={{
                  color: block.color,
                  fontSize,
                  lineHeight: `${lineHeight}px`,
                  padding: block.padding,
                }}
              >
                {sampleText(block.content, document)}
              </div>
            );
          })}
        </div>
      </div>

      {legal?.type === "legal" && (
        <p
          className="px-8 pt-6 text-center text-[11px] leading-4 italic"
          style={{ color: legal.color }}
        >
          {legal.content}
        </p>
      )}

      {footer?.type === "footer" && (
        <div className="flex items-center justify-between gap-6 px-8 py-7">
          {assets.get(footer.logoAssetId) && (
            <Image
              src={assets.get(footer.logoAssetId)!.path}
              alt={assets.get(footer.logoAssetId)!.alt}
              width={footer.logoWidth}
              height={64}
              className="h-auto max-h-12 w-auto object-contain"
            />
          )}
          <div className="flex items-center gap-3">
            {footer.links.map((link) => {
              const asset = assets.get(link.assetId);
              return asset ? (
                <Image
                  key={link.label}
                  src={asset.path}
                  alt={link.label}
                  width={28}
                  height={28}
                  className="size-7 object-contain"
                />
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function EmailStudioSpike({
  compiled,
}: {
  compiled: Pick<CompiledEmail, "document" | "html" | "mjml" | "warnings">;
}) {
  const [tab, setTab] = useState<WorkspaceTab>("preview");
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const document = compiled.document;

  const blueprint = useMemo(
    () => JSON.stringify(document, null, 2),
    [document],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="glass overflow-hidden rounded-xl">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <div className="bg-muted flex flex-wrap rounded-lg p-1">
            <WorkspaceTabButton
              active={tab === "reference"}
              onClick={() => setTab("reference")}
            >
              Referencia
            </WorkspaceTabButton>
            <WorkspaceTabButton
              active={tab === "preview"}
              onClick={() => setTab("preview")}
            >
              HTML generado
            </WorkspaceTabButton>
            <WorkspaceTabButton
              active={tab === "blueprint"}
              onClick={() => setTab("blueprint")}
            >
              Blueprint
            </WorkspaceTabButton>
            <WorkspaceTabButton
              active={tab === "html"}
              onClick={() => setTab("html")}
            >
              Código
            </WorkspaceTabButton>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={viewport === "desktop" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={viewport === "desktop"}
              onClick={() => setViewport("desktop")}
            >
              <Monitor />
              Desktop
            </Button>
            <Button
              type="button"
              variant={viewport === "mobile" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={viewport === "mobile"}
              onClick={() => setViewport("mobile")}
            >
              <Smartphone />
              Móvil
            </Button>
          </div>
        </div>

        <div className="bg-muted/40 min-h-[780px] overflow-auto p-4 sm:p-6">
          {tab === "reference" && (
            <div
              className="mx-auto overflow-hidden rounded-lg shadow-xl transition-[width] duration-300"
              style={{
                width: viewport === "desktop" ? 760 : 390,
                maxWidth: "100%",
              }}
            >
              <ReferenceMockup document={document} />
            </div>
          )}

          {tab === "preview" && (
            <div
              className="bg-background mx-auto overflow-hidden rounded-lg shadow-xl transition-[width] duration-300"
              style={{
                width: viewport === "desktop" ? 760 : 390,
                maxWidth: "100%",
              }}
            >
              <iframe
                title="Vista previa del HTML generado"
                srcDoc={compiled.html}
                sandbox=""
                suppressHydrationWarning
                className="h-[1050px] w-full border-0"
              />
            </div>
          )}

          {tab === "blueprint" && (
            <pre className="bg-background border-border mx-auto max-h-[960px] max-w-4xl overflow-auto rounded-lg border p-5 font-mono text-xs leading-5">
              {blueprint}
            </pre>
          )}

          {tab === "html" && (
            <pre className="bg-background border-border mx-auto max-h-[960px] max-w-4xl overflow-auto rounded-lg border p-5 font-mono text-xs leading-5">
              {compiled.html}
            </pre>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="glass rounded-xl p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2
              className="size-4"
              style={{ color: "var(--status-emerald)" }}
            />
            <h2 className="text-sm font-semibold">Contrato válido</h2>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            EmailDocument {document.version} compilado sin errores.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric value={document.sections.length} label="Secciones" />
            <Metric value={document.assets.length} label="Assets" />
            <Metric value={document.variables.length} label="Variables" />
          </div>
        </section>

        <section className="glass rounded-xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <Layers3 className="size-4" />
            <h2 className="text-sm font-semibold">Estructura detectada</h2>
          </div>
          <div className="space-y-2">
            {document.sections.map((section) => (
              <div
                key={section.id}
                className="border-border bg-background/45 flex items-center gap-3 rounded-lg border p-3"
              >
                {section.type === "card" ? (
                  <FileImage className="text-muted-foreground size-4" />
                ) : section.type === "legal" ? (
                  <Type className="text-muted-foreground size-4" />
                ) : (
                  <MousePointerClick className="text-muted-foreground size-4" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">
                    {section.label}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {section.type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <Braces className="size-4" />
            <h2 className="text-sm font-semibold">Variables preservadas</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {document.variables.map((variable) => (
              <span
                key={variable.key}
                className="border-border bg-background/55 rounded-md border px-2 py-1 font-mono text-[10px]"
                title={variable.sample}
              >
                {`{{${variable.key}}}`}
              </span>
            ))}
          </div>
        </section>

        <section className="glass rounded-xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="size-4" />
            <h2 className="text-sm font-semibold">Compatibilidad</h2>
          </div>
          <ul className="text-muted-foreground space-y-2 text-xs leading-5">
            {compiled.warnings.map((warning) => (
              <li key={warning} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-border bg-muted/55 rounded-xl border border-dashed p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4" />
            <h2 className="text-sm font-semibold">Estado actual</h2>
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-5">
            Este contrato ya alimenta la carga de referencias, los assets
            versionados, la generación asistida, el preview y la exportación.
          </p>
          <Button
            className="mt-3 w-full"
            variant="outline"
            render={<Link href="/email-studio" />}
            nativeButton={false}
          >
            <ExternalLink />
            Volver a proyectos
          </Button>
        </section>
      </aside>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-muted/60 rounded-lg px-2 py-2 text-center">
      <div className="font-heading text-lg font-semibold">{value}</div>
      <div className="text-muted-foreground text-[10px]">{label}</div>
    </div>
  );
}
