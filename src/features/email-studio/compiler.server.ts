import mjml2html from "mjml";
import {
  emailDocumentSchema,
  type EmailBlock,
  type EmailDocument,
} from "./document";

export interface CompileEmailOptions {
  assetBaseUrl: string;
}

export interface CompiledEmail {
  document: EmailDocument;
  html: string;
  mjml: string;
  warnings: string[];
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function attribute(name: string, value: string | number | undefined): string {
  if (value === undefined) return "";
  return ` ${name}="${escapeAttribute(String(value))}"`;
}

function escapeText(value: string): string {
  return escapeAttribute(value).replace(/\r?\n/g, "<br />");
}

function normalizeBaseUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("La base de assets debe usar HTTP o HTTPS.");
  }
  return url;
}

function resolveHref(value: string): string {
  if (/^\{\{[a-z0-9_-]+\}\}$/i.test(value)) return value;
  const url = new URL(value);
  if (!["https:", "mailto:", "tel:"].includes(url.protocol)) {
    throw new Error(`El enlace "${value}" usa un protocolo no permitido.`);
  }
  return value;
}

function renderBlock(
  block: EmailBlock,
  assetUrl: (assetId: string) => string,
  assetAlt: (assetId: string) => string,
): string {
  switch (block.type) {
    case "image": {
      const image = `<mj-image${attribute("src", assetUrl(block.assetId))}${attribute("alt", block.alt ?? assetAlt(block.assetId))}${attribute("width", `${block.width}px`)}${attribute("padding", block.padding)}${attribute("align", block.align)}${block.href ? attribute("href", resolveHref(block.href)) : ""} />`;
      return image;
    }
    case "eyebrow":
      return `<mj-text${attribute("color", block.color)}${attribute("font-size", "12px")}${attribute("line-height", "20px")}${attribute("letter-spacing", "1.2px")}${attribute("text-transform", "uppercase")}${attribute("padding", block.padding)}${attribute("align", block.align)}>${escapeText(block.content)}</mj-text>`;
    case "heading":
      return `<mj-text${attribute("color", block.color)}${attribute("font-size", `${block.fontSize}px`)}${attribute("line-height", `${block.lineHeight}px`)}${attribute("font-weight", "700")}${attribute("padding", block.padding)}${attribute("align", block.align)}>${escapeText(block.content)}</mj-text>`;
    case "text":
      return `<mj-text${attribute("color", block.color)}${attribute("font-size", `${block.fontSize}px`)}${attribute("line-height", `${block.lineHeight}px`)}${attribute("padding", block.padding)}${attribute("align", block.align)}>${block.href ? `<a href="${escapeAttribute(resolveHref(block.href))}" style="color:inherit;text-decoration:inherit">${escapeText(block.content)}</a>` : escapeText(block.content)}</mj-text>`;
    case "button":
      return `<mj-button${attribute("href", resolveHref(block.href))}${attribute("background-color", block.backgroundColor)}${attribute("color", block.color)}${attribute("border-radius", `${block.borderRadius}px`)}${attribute("font-size", "18px")}${attribute("font-weight", "700")}${attribute("inner-padding", "14px 20px")}${attribute("padding", block.padding)}${attribute("align", block.align)}>${escapeText(block.label)}</mj-button>`;
    case "spacer":
      return `<mj-spacer${attribute("height", `${block.height}px`)} />`;
  }
}

export async function compileEmailDocument(
  input: EmailDocument,
  options: CompileEmailOptions,
): Promise<CompiledEmail> {
  const document = emailDocumentSchema.parse(input);
  const baseUrl = normalizeBaseUrl(options.assetBaseUrl);
  const assets = new Map(
    document.assets.map((asset) => [
      asset.id,
      {
        ...asset,
        url: new URL(asset.path, baseUrl).toString(),
      },
    ]),
  );

  const asset = (id: string) => {
    const found = assets.get(id);
    if (!found) throw new Error(`No existe el asset "${id}".`);
    return found;
  };

  const cardStyles = document.sections
    .filter((section) => section.type === "card")
    .map(
      (section) =>
        `.email-card-${section.id} { border-radius: ${section.borderRadius}px; overflow: hidden; }`,
    )
    .join("\n");

  const body = document.sections
    .map((section) => {
      switch (section.type) {
        case "card": {
          const background = section.backgroundAssetId
            ? attribute("background-url", asset(section.backgroundAssetId).url)
            : "";
          const blocks = section.blocks
            .map((block) =>
              renderBlock(
                block,
                (id) => asset(id).url,
                (id) => asset(id).alt,
              ),
            )
            .join("\n");
          return `
            <mj-wrapper padding="0px ${section.outerPadding}px 0px" css-class="card-wrapper">
              <mj-section${attribute("background-color", section.backgroundColor)}${background} background-repeat="no-repeat" background-position="center bottom" padding="0px" css-class="email-card-${section.id}">
                <mj-column padding="0px">
                  ${blocks}
                </mj-column>
              </mj-section>
            </mj-wrapper>`;
        }
        case "legal":
          return `
            <mj-section padding="24px 28px 0px">
              <mj-column>
                <mj-text${attribute("color", section.color)} font-size="11px" line-height="16px" font-style="italic" align="center" padding="0px">
                  ${escapeText(section.content)}
                </mj-text>
              </mj-column>
            </mj-section>`;
        case "footer": {
          const social = section.links
            .map(
              (link) =>
                `<mj-social-element${attribute("href", resolveHref(link.href))}${attribute("src", asset(link.assetId).url)}${attribute("alt", link.label)} />`,
            )
            .join("\n");
          return `
            <mj-section padding="22px 28px 28px">
              <mj-column width="58%" vertical-align="middle">
                <mj-image${attribute("src", asset(section.logoAssetId).url)}${attribute("alt", asset(section.logoAssetId).alt)}${attribute("width", `${section.logoWidth}px`)} align="left" padding="0px" />
              </mj-column>
              <mj-column width="42%" vertical-align="middle">
                <mj-social mode="horizontal" align="right" icon-size="28px" padding="0px">
                  ${social}
                </mj-social>
              </mj-column>
            </mj-section>`;
        }
      }
    })
    .join("\n");

  const mjml = `
    <mjml lang="${escapeAttribute(document.language)}">
      <mj-head>
        <mj-title>${escapeAttribute(document.subject)}</mj-title>
        <mj-preview>${escapeAttribute(document.previewText)}</mj-preview>
        <mj-attributes>
          <mj-all${attribute("font-family", document.theme.fontFamily)} />
        </mj-attributes>
        <mj-style>
          ${cardStyles}
        </mj-style>
      </mj-head>
      <mj-body${attribute("width", `${document.width}px`)}${attribute("background-color", document.theme.canvasColor)}>
        ${
          document.theme.topBandHeight > 0
            ? `<mj-section${attribute("background-color", document.theme.topBandColor)} padding="0px">
          <mj-column>
            <mj-spacer${attribute("height", `${document.theme.topBandHeight}px`)} />
          </mj-column>
        </mj-section>`
            : ""
        }
        ${body}
      </mj-body>
    </mjml>`;

  const result = await mjml2html(mjml, {
    validationLevel: "strict",
    minify: false,
  });

  if (result.errors.length > 0) {
    throw new Error(
      result.errors
        .map((error) => `${error.line}: ${error.formattedMessage}`)
        .join("\n"),
    );
  }

  const warnings = [
    "El prototipo usa fuentes de sistema para conservar compatibilidad.",
    "Los fondos complejos requieren una revisión específica en Outlook de escritorio.",
    baseUrl.protocol === "https:"
      ? "Todos los assets fueron resueltos a URLs HTTPS absolutas."
      : "La vista local usa HTTP; la exportación final exigirá URLs HTTPS públicas.",
  ];

  return {
    document,
    html: result.html,
    mjml,
    warnings,
  };
}

export type EmailAuditItem = {
  level: "pass" | "warning" | "error";
  label: string;
  detail: string;
};

export function auditCompiledEmail(compiled: CompiledEmail): EmailAuditItem[] {
  const items: EmailAuditItem[] = [];
  const htmlBytes = Buffer.byteLength(compiled.html, "utf8");
  const assets = new Map(
    compiled.document.assets.map((asset) => [asset.id, asset]),
  );
  const remoteAssets = compiled.document.assets.filter((asset) =>
    /^https:\/\//.test(asset.path),
  );
  const nonHttpsAssets = compiled.document.assets.filter(
    (asset) => !/^https:\/\//.test(asset.path),
  );
  let emptyAltCount = 0;
  for (const section of compiled.document.sections) {
    if (section.type === "card") {
      emptyAltCount += section.blocks.filter(
        (block) =>
          block.type === "image" &&
          (block.alt ?? assets.get(block.assetId)?.alt ?? "").trim() === "",
      ).length;
    }
    if (section.type === "footer") {
      emptyAltCount += [
        section.logoAssetId,
        ...section.links.map((link) => link.assetId),
      ].filter(
        (assetId) => (assets.get(assetId)?.alt ?? "").trim() === "",
      ).length;
    }
  }
  const insecureEmbeddedUrls = [
    ...compiled.html.matchAll(/(?:src|href)=["'](http:\/\/[^"']+)/gi),
  ].map((match) => match[1]);
  const variableTokens = new Set(
    [...compiled.html.matchAll(/\{\{([a-z0-9_-]+)\}\}/gi)].map(
      (match) => match[1],
    ),
  );
  const declaredVariables = new Set(
    compiled.document.variables.map((variable) => variable.key),
  );
  const undeclared = [...variableTokens].filter(
    (key) => !declaredVariables.has(key),
  );

  items.push({
    level: htmlBytes < 102_000 ? "pass" : "warning",
    label: "Peso del HTML",
    detail:
      htmlBytes < 102_000
        ? `${Math.ceil(htmlBytes / 1024)} KB, bajo el umbral de clipping de Gmail.`
        : `${Math.ceil(htmlBytes / 1024)} KB; Gmail podría recortar el mensaje.`,
  });
  items.push({
    level: insecureEmbeddedUrls.length === 0 ? "pass" : "error",
    label: "Enlaces embebidos",
    detail:
      insecureEmbeddedUrls.length === 0
        ? "El HTML no contiene recursos o enlaces HTTP inseguros."
        : `${insecureEmbeddedUrls.length} enlaces embebidos aún usan HTTP.`,
  });
  items.push({
    level: nonHttpsAssets.length === 0 ? "pass" : "error",
    label: "Assets públicos",
    detail:
      nonHttpsAssets.length === 0
        ? `${remoteAssets.length} assets resueltos con HTTPS.`
        : `${nonHttpsAssets.length} assets aún no usan HTTPS público.`,
  });
  items.push({
    level: emptyAltCount === 0 ? "pass" : "warning",
    label: "Textos alternativos",
    detail:
      emptyAltCount === 0
        ? "Todos los assets tienen texto alternativo."
        : `${emptyAltCount} usos de imagen requieren texto alternativo.`,
  });
  items.push({
    level: undeclared.length === 0 ? "pass" : "error",
    label: "Variables dinámicas",
    detail:
      undeclared.length === 0
        ? `${declaredVariables.size} variables declaradas y validadas.`
        : `Variables sin declarar: ${undeclared.join(", ")}.`,
  });
  items.push({
    level: "warning",
    label: "Outlook de escritorio",
    detail:
      "Revisar visualmente fondos, bordes redondeados y fuentes antes de entregar.",
  });

  return items;
}
