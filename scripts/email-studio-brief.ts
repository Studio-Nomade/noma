/**
 * Genera un mailing desde un brief JSON (ver docs/technical/email-studio.md,
 * "Generador por brief").
 *
 *   npm run email-studio:brief -- <brief.json> [--out <carpeta>] [--assets <carpeta>]
 *
 * - Escribe en <out> (default: carpeta del brief + "/salida"):
 *   index.html (HTML final con {{variables}}), emblue.html (variables ${{CAMPO}}),
 *   blueprint.json (EmailDocument) y manifest.json (assets y su ruta pública).
 * - Con --assets, lee cada pieza desde esa carpeta y valida peso y ancho según
 *   las reglas de assets.studionomade.cl. No sube nada: la publicación la hace
 *   el repo mailings-assets (etapa 1) o Noma (etapa 2).
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";
import {
  auditCompiledEmail,
  compileEmailDocument,
} from "../src/features/email-studio/compiler.server";
import { validateMailingAsset } from "../src/features/email-studio/mailing-assets";
import {
  buildMailingFromBrief,
  toEmblueHtml,
} from "../src/features/email-studio/mailing-brief";

function argValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const briefPath = args.find((arg) => !arg.startsWith("--"));
  if (!briefPath) {
    console.error(
      "Uso: npm run email-studio:brief -- <brief.json> [--out <carpeta>] [--assets <carpeta>]",
    );
    process.exitCode = 1;
    return;
  }
  const absoluteBrief = resolve(briefPath);
  const outDir = resolve(
    argValue(args, "--out") ?? join(dirname(absoluteBrief), "salida"),
  );
  const assetsDir = argValue(args, "--assets");

  const mailing = buildMailingFromBrief(
    JSON.parse(await readFile(absoluteBrief, "utf8")),
  );

  const problems: string[] = [];
  if (assetsDir) {
    for (const asset of mailing.assets) {
      const file = resolve(assetsDir, asset.source);
      try {
        const { size } = await stat(file);
        const meta = /\.(png|jpe?g|gif)$/i.test(file)
          ? await sharp(file).metadata()
          : null;
        problems.push(
          ...validateMailingAsset({
            filename: asset.filename,
            bytes: size,
            width: meta?.width ?? null,
          }),
        );
      } catch {
        problems.push(`${asset.source}: no se encontró en ${assetsDir}.`);
      }
    }
  } else {
    for (const asset of mailing.assets) {
      problems.push(...validateMailingAsset({ filename: asset.filename }));
    }
  }

  const compiled = await compileEmailDocument(mailing.document, {
    assetBaseUrl: mailing.brief.assetsBaseUrl,
  });
  const audit = auditCompiledEmail(compiled);
  const fields = Object.fromEntries(
    mailing.brief.variables.map((variable) => [
      variable.key,
      variable.emblueField,
    ]),
  );

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "index.html"), compiled.html);
  await writeFile(
    join(outDir, "emblue.html"),
    toEmblueHtml(compiled.html, fields),
  );
  await writeFile(
    join(outDir, "blueprint.json"),
    `${JSON.stringify(compiled.document, null, 2)}\n`,
  );
  await writeFile(
    join(outDir, "manifest.json"),
    `${JSON.stringify(
      {
        folder: mailing.folder,
        subject: mailing.brief.subject,
        preheader: mailing.brief.preheader,
        assets: mailing.assets,
        warnings: [...mailing.warnings, ...compiled.warnings],
        problems,
        audit,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Carpeta de assets: ${mailing.folder}`);
  for (const asset of mailing.assets) {
    console.log(`  ${asset.source} → ${asset.url}`);
  }
  for (const warning of [...mailing.warnings, ...compiled.warnings]) {
    console.log(`Aviso: ${warning}`);
  }
  for (const problem of problems) console.log(`Problema: ${problem}`);
  console.log(`Listo: ${outDir}`);
  if (problems.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
