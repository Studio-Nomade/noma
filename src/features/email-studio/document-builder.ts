import type { EmailBlock, EmailDocument } from "./document";

export type BuilderProject = {
  id: string;
  name: string;
  subject: string;
  previewText: string;
  emailWidth: number;
  canvasColor: string;
  bodyColor: string;
  textColor: string;
};

export type BuilderAsset = {
  id: string;
  label: string;
  publicUrl: string | null;
  width: number | null;
};

export type BuilderElement = {
  id: string;
  type: string;
  assetId: string | null;
  label: string;
  content: string | null;
  href: string | null;
  alt: string;
  align: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  padding: string;
};

export type BuilderVariable = {
  key: string;
  label: string;
  sample: string;
  required: boolean;
};

function identifier(prefix: string, id: string): string {
  return `${prefix}-${id.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`;
}

function align(value: string): "left" | "center" | "right" {
  return value === "left" || value === "right" ? value : "center";
}

function spacerHeight(value: string | null): number {
  const height = Number.parseInt(value ?? "24", 10);
  return Number.isFinite(height) ? Math.min(200, Math.max(1, height)) : 24;
}

export function buildEmailDocument(input: {
  project: BuilderProject;
  assets: BuilderAsset[];
  elements: BuilderElement[];
  variables: BuilderVariable[];
}): EmailDocument {
  const assetRows = new Map(input.assets.map((asset) => [asset.id, asset]));
  const referencedAssetIds = [
    ...new Set(
      input.elements
        .map((element) => element.assetId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const assets = referencedAssetIds.map((assetId) => {
    const asset = assetRows.get(assetId);
    if (!asset?.publicUrl) {
      throw new Error(
        `El elemento referencia un asset sin URL pública: ${assetId}.`,
      );
    }
    return {
      id: identifier("asset", asset.id),
      label: asset.label,
      path: asset.publicUrl,
      alt:
        input.elements.find((element) => element.assetId === asset.id)?.alt ??
        asset.label,
      width: asset.width ?? input.project.emailWidth,
    };
  });
  const assetDocumentId = new Map(
    referencedAssetIds.map((id) => [id, identifier("asset", id)]),
  );

  const blocks: EmailBlock[] = [];

  for (const element of input.elements) {
    const id = identifier("block", element.id);
    switch (element.type) {
      case "image":
      case "template": {
        if (!element.assetId) continue;
        const asset = assetRows.get(element.assetId);
        const documentAssetId = assetDocumentId.get(element.assetId);
        if (!asset || !documentAssetId) continue;
        blocks.push({
          id,
          type: "image",
          assetId: documentAssetId,
          width: Math.min(
            input.project.emailWidth,
            asset.width ?? input.project.emailWidth,
          ),
          padding: element.padding || "0px",
          align: align(element.align),
          alt: element.alt,
          ...(element.href ? { href: element.href } : {}),
        });
        break;
      }
      case "text":
        blocks.push({
          id,
          type: "text",
          content: element.content || element.label,
          color: element.color,
          fontSize: element.fontSize,
          lineHeight: Math.round(element.fontSize * 1.5),
          padding: element.padding || "16px 32px",
          align: align(element.align),
          ...(element.href ? { href: element.href } : {}),
        });
        break;
      case "button":
        if (!element.href) continue;
        blocks.push({
          id,
          type: "button",
          label: element.content || element.label,
          href: element.href,
          backgroundColor: element.backgroundColor,
          color: element.color,
          borderRadius: 6,
          padding: element.padding || "16px 32px",
          align: align(element.align),
        });
        break;
      case "spacer":
        blocks.push({
          id,
          type: "spacer",
          height: spacerHeight(element.content),
        });
        break;
    }
  }

  if (blocks.length === 0) {
    throw new Error(
      "Agrega al menos un asset, texto o botón antes de generar el correo.",
    );
  }

  return {
    version: "1.0",
    id: identifier("email", input.project.id),
    name: input.project.name,
    subject: input.project.subject,
    previewText: input.project.previewText || input.project.subject,
    language: "es",
    width: input.project.emailWidth,
    theme: {
      canvasColor: input.project.canvasColor,
      topBandColor: input.project.canvasColor,
      topBandHeight: 0,
      textColor: input.project.textColor,
      fontFamily: "Arial, Helvetica, sans-serif",
    },
    assets,
    variables: input.variables.map((variable) => ({
      key: variable.key,
      label: variable.label,
      sample: variable.sample,
      required: variable.required,
    })),
    sections: [
      {
        id: "main-content",
        type: "card",
        label: "Contenido del correo",
        backgroundColor: input.project.bodyColor,
        borderRadius: 0,
        outerPadding: 0,
        blocks,
      },
    ],
  };
}
